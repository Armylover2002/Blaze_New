import mongoose from 'mongoose';
import { PorterOrder } from '../models/porterOrder.model.js';
import { PorterCoupon } from '../../models/porterCoupon.model.js';
import { PORTER_PAYMENT_STATUS } from '../constants/porterOrderStatus.constants.js';
import { logger } from '../../../../utils/logger.js';

/** Discount rupees applied on this order — used for coupon subsidy reporting. */
export function resolvePorterCouponDiscountAmount(order) {
    return Math.max(0, Math.round(Number(order?.pricing?.discount) || 0));
}

/** Mongo $inc payload when a coupon is consumed — used for usedCount + subsidy reporting. */
export function buildCouponConsumptionIncrement(order) {
    const discountAmount = resolvePorterCouponDiscountAmount(order);
    const incFields = { usedCount: 1 };
    if (discountAmount > 0) {
        incFields.totalDiscountGiven = discountAmount;
    }
    return incFields;
}

/** Whether coupon consumption is allowed for the current order payment state. */
export function canConsumePorterCoupon(order) {
    if (!order?.couponId || order.couponConsumed) {
        return false;
    }
    return String(order.payment?.status || '').toLowerCase() === PORTER_PAYMENT_STATUS.PAID;
}

/**
 * Mark a Porter coupon as consumed for this order (idempotent).
 * Called only when payment is captured (wallet, Razorpay verify/webhook, COD delivery).
 * Updates usedCount and totalDiscountGiven for admin coupon reporting.
 */
export async function markPorterCouponConsumed(order) {
    if (!order?.couponId) return false;
    if (order.couponConsumed) return true;

    const couponId = order.couponId?._id || order.couponId;
    const incFields = buildCouponConsumptionIncrement(order);

    await PorterCoupon.updateOne(
        { _id: couponId },
        { $inc: incFields },
    );

    await PorterOrder.updateOne(
        { _id: order._id, couponConsumed: { $ne: true } },
        { $set: { couponConsumed: true } },
    );
    order.couponConsumed = true;
    return true;
}

/**
 * Consume coupon only when payment is captured — keeps wallet / Razorpay / COD timing consistent.
 */
export async function consumePorterCouponIfPaid(order) {
    if (!canConsumePorterCoupon(order)) {
        return false;
    }
    return markPorterCouponConsumed(order);
}

/**
 * After a terminal cancel, keep consumed coupons non-reusable for paid orders.
 * Unpaid/abandoned orders never incremented usedCount, so nothing to release.
 */
export async function finalizePorterCouponOnCancel(order) {
    if (!order?.couponId) return;

    const wasPaid = [PORTER_PAYMENT_STATUS.PAID, PORTER_PAYMENT_STATUS.REFUNDED]
        .includes(String(order.payment?.status || '').toLowerCase());

    if (wasPaid && order.couponConsumed) {
        await PorterOrder.updateOne(
            { _id: order._id },
            { $set: { 'cancellation.couponForfeited': true } },
        );
        return;
    }

    if (!order.couponConsumed) {
        return;
    }

    logger.warn(`[PorterCoupon] Order ${order.orderNumber} cancelled with couponConsumed but unpaid — no release`);
}

/** Count coupon uses that actually consumed the coupon (paid / verified orders only). */
export async function countPorterCouponUsesForUser(couponId, userId) {
    return PorterOrder.countDocuments({
        userId: new mongoose.Types.ObjectId(userId),
        couponId: new mongoose.Types.ObjectId(couponId),
        isDeleted: { $ne: true },
        $or: [
            { couponConsumed: true },
            { 'payment.status': { $in: ['paid', 'refunded'] } },
        ],
    });
}
