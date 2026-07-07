import mongoose from 'mongoose';
import { Transaction } from '../../../../core/payments/models/transaction.model.js';
import { recordTransaction } from '../../../../core/payments/transaction.service.js';
import { ValidationError } from '../../../../core/auth/errors.js';
import { PORTER_PAYMENT_STATUS } from '../constants/porterOrderStatus.constants.js';
import {
    createPaymentLink,
    fetchRazorpayPaymentLink,
    isRazorpayConfigured,
    initiateRazorpayRefund,
} from '../../../food/orders/helpers/razorpay.helper.js';
import { logger } from '../../../../utils/logger.js';

const PAID_LINK_STATUSES = ['paid', 'captured', 'authorized'];
const FAILED_LINK_STATUSES = ['expired', 'cancelled', 'canceled', 'failed'];

/**
 * Create a Razorpay collect-QR (payment link) for a COD Porter order at delivery.
 * Mirrors the Food `createCollectQr` flow (reuses the same Razorpay helper).
 * The order doc is mutated + saved by the caller-facing wrapper.
 */
export async function createPorterCollectQr(order, customerInfo = {}) {
    if (String(order.payment?.status) === PORTER_PAYMENT_STATUS.PAID) {
        throw new ValidationError('Order already paid');
    }
    const amountDue = Number(order.pricing?.total) || 0;
    if (amountDue < 1) throw new ValidationError('No amount due');
    if (!isRazorpayConfigured()) throw new ValidationError('QR payment not configured');

    const link = await createPaymentLink({
        amountPaise: Math.round(amountDue * 100),
        currency: 'INR',
        description: `Porter order ${order.orderNumber} - COD collect`,
        orderId: order._id.toString(),
        customerName: customerInfo.name || 'Customer',
        customerEmail: customerInfo.email || 'customer@example.com',
        customerPhone: customerInfo.phone || undefined,
    });

    order.payment.qr = {
        paymentLinkId: link.id,
        shortUrl: link.short_url,
        status: link.status || 'created',
        expiresAt: link.expire_by ? new Date(link.expire_by * 1000) : null,
    };
    await order.save();

    return {
        shortUrl: link?.short_url ?? null,
        imageUrl: link?.short_url ?? null,
        amount: amountDue,
        expiresAt: link?.expire_by ? new Date(link.expire_by * 1000) : null,
    };
}

/**
 * Sync a Porter COD collect-QR against Razorpay. When the link is paid, the
 * order is switched to an online-paid state (method → razorpay) so it is NOT
 * double-counted as physical cash-in-hand. Returns the current payment object.
 */
export async function syncPorterCollectQr(order) {
    const linkId = order.payment?.qr?.paymentLinkId;
    if (!linkId || !isRazorpayConfigured()) return order.payment;
    if (String(order.payment?.status) === PORTER_PAYMENT_STATUS.PAID) return order.payment;

    let link;
    try {
        link = await fetchRazorpayPaymentLink(linkId);
    } catch (err) {
        logger.warn(`[Porter] QR link fetch failed for ${linkId}: ${err?.message || err}`);
        return order.payment;
    }

    const status = String(link?.status || '').toLowerCase();
    if (!status) return order.payment;
    order.payment.qr.status = status;

    if (PAID_LINK_STATUSES.includes(status)) {
        // Paid online via QR — treat as online payment, not cash-in-hand.
        order.payment.method = 'razorpay';
        order.payment.status = PORTER_PAYMENT_STATUS.PAID;
        order.payment.paidAt = new Date();
    } else if (FAILED_LINK_STATUSES.includes(status)) {
        // leave status as-is (still collectable via cash)
    }
    order.markModified('payment');
    await order.save();
    return order.payment;
}

async function findExistingCharge(orderId, idempotencyKey) {
    return Transaction.findOne({
        orderId: new mongoose.Types.ObjectId(orderId),
        module: 'porter',
        category: 'order_payment',
        entityType: 'user',
        'metadata.idempotencyKey': idempotencyKey,
        status: 'completed',
    }).lean();
}

export async function chargePorterOrderWallet({ userId, orderId, orderNumber, amount, paymentMethod }) {
    const total = Number(amount) || 0;
    if (total <= 0) {
        return { status: PORTER_PAYMENT_STATUS.PAID, paidAt: new Date() };
    }

    if (paymentMethod === 'cash') {
        return { status: PORTER_PAYMENT_STATUS.PENDING, paidAt: null };
    }

    if (paymentMethod !== 'wallet') {
        throw new ValidationError('Only wallet and cash payments are supported currently');
    }

    const idempotencyKey = `porter:charge:${String(orderId)}`;
    const existing = await findExistingCharge(orderId, idempotencyKey);
    if (existing) {
        return { status: PORTER_PAYMENT_STATUS.PAID, paidAt: new Date(), duplicate: true };
    }

    await recordTransaction({
        entityType: 'user',
        entityId: String(userId),
        type: 'debit',
        amount: total,
        description: `Porter order ${orderNumber}`,
        category: 'order_payment',
        orderId: String(orderId),
        module: 'porter',
        metadata: { module: 'porter', orderNumber, idempotencyKey },
    });

    return { status: PORTER_PAYMENT_STATUS.PAID, paidAt: new Date() };
}

export async function refundPorterOrderWallet({ userId, orderId, orderNumber, amount, reason }) {
    const total = Number(amount) || 0;
    if (total <= 0) return null;

    const idempotencyKey = `porter:refund:${String(orderId)}`;
    const existing = await Transaction.findOne({
        orderId: new mongoose.Types.ObjectId(orderId),
        module: 'porter',
        category: 'order_refund',
        entityType: 'user',
        'metadata.idempotencyKey': idempotencyKey,
        status: 'completed',
    }).lean();
    if (existing) return { refundedAt: new Date(), duplicate: true, transactionId: existing._id };

    const result = await recordTransaction({
        entityType: 'user',
        entityId: String(userId),
        type: 'credit',
        amount: total,
        description: `Refund for Porter order ${orderNumber}${reason ? ` — ${reason}` : ''}`,
        category: 'order_refund',
        orderId: String(orderId),
        module: 'porter',
        metadata: { module: 'porter', orderNumber, reason, idempotencyKey },
    });

    return { refundedAt: new Date(), transactionId: result?.txn?._id || null };
}

/**
 * Unified refund entry point for a cancelled Porter order.
 * - Online (razorpay) paid → attempt automatic Razorpay gateway refund
 *   (reuses Food's `initiateRazorpayRefund`), falling back to a wallet credit
 *   if the gateway call fails or is not configured.
 * - Wallet / QR-cash paid → wallet credit.
 * - Unpaid (e.g. cash / pending) → no refund required.
 * Never throws — refund failures degrade gracefully so cancellation still
 * completes; the resulting status is persisted by the caller.
 */
export async function processPorterRefund(order, reason) {
    const amount = Number(order.pricing?.total) || 0;
    const paymentStatus = String(order.payment?.status || '').toLowerCase();

    if (paymentStatus !== PORTER_PAYMENT_STATUS.PAID || amount <= 0) {
        return { status: 'not_required', amount: 0, method: null };
    }

    const method = String(order.payment?.method || '').toLowerCase();
    const rzpPaymentId = order.payment?.razorpayPaymentId || order.payment?.razorpay?.paymentId || null;

    // Online payment → try gateway refund first.
    if (method === 'razorpay' && rzpPaymentId && isRazorpayConfigured()) {
        try {
            const res = await initiateRazorpayRefund(rzpPaymentId, amount);
            if (res?.success) {
                return {
                    status: 'processed',
                    amount,
                    method: 'razorpay',
                    refundId: res.refundId || null,
                    processedAt: new Date(),
                };
            }
            logger.warn(`[Porter] Razorpay refund not successful for order ${order.orderNumber}; falling back to wallet`);
        } catch (err) {
            logger.warn(`[Porter] Razorpay refund failed for order ${order.orderNumber} (${err?.message || err}); falling back to wallet`);
        }
    }

    // Wallet credit (default + fallback path).
    const walletRes = await refundPorterOrderWallet({
        userId: order.userId,
        orderId: order._id,
        orderNumber: order.orderNumber,
        amount,
        reason,
    });
    return {
        status: 'processed',
        amount,
        method: 'wallet',
        transactionId: walletRes?.transactionId || null,
        processedAt: new Date(),
    };
}

/**
 * Runs the unified refund, mutates + saves the refund state onto the order,
 * and returns the refund result. Idempotent via payment.status guard.
 */
export async function applyPorterRefund(order, reason) {
    if (String(order.payment?.status) === PORTER_PAYMENT_STATUS.REFUNDED) {
        return { status: order.payment?.refund?.status || 'processed', amount: order.payment?.refund?.amount || 0, method: order.payment?.refund?.method || null };
    }

    const result = await processPorterRefund(order, reason);
    if (!order.payment) order.payment = {};
    order.payment.refund = {
        status: result.status,
        amount: result.amount || 0,
        method: result.method || undefined,
        refundId: result.refundId || undefined,
        transactionId: result.transactionId || undefined,
        reason: reason || undefined,
        initiatedAt: new Date(),
        processedAt: result.processedAt || (result.status === 'processed' ? new Date() : undefined),
    };
    if (result.status === 'processed') {
        order.payment.status = PORTER_PAYMENT_STATUS.REFUNDED;
    }
    if (order.cancellation) {
        order.cancellation.refundStatus = result.status;
        order.cancellation.refundAmount = result.amount || 0;
    }
    order.markModified('payment');
    await order.save();
    return result;
}

export async function settlePorterDriverEarning({
    deliveryPartnerId,
    orderId,
    orderNumber,
    driverEarning,
    platformFee,
    paymentMethod,
}) {
    const { settlePorterOrderEarningsAtomic } = await import('./porter-wallet-atomic.service.js');
    return settlePorterOrderEarningsAtomic({
        _id: orderId,
        orderNumber,
        dispatch: { deliveryPartnerId },
        pricing: { driverEarning, platformFee, total: 0, commission: 0, serviceTax: 0 },
        payment: { method: paymentMethod },
        userId: null,
    });
}
