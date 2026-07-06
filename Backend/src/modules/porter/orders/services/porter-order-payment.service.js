import mongoose from 'mongoose';
import { Transaction } from '../../../../core/payments/models/transaction.model.js';
import { recordTransaction } from '../../../../core/payments/transaction.service.js';
import { ValidationError } from '../../../../core/auth/errors.js';
import { PORTER_PAYMENT_STATUS } from '../constants/porterOrderStatus.constants.js';

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
    if (existing) return { refundedAt: new Date(), duplicate: true };

    await recordTransaction({
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

    return { refundedAt: new Date() };
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
