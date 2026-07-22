import {
    PORTER_ORDER_STATUS,
    PORTER_PAYMENT_STATUS,
} from '../constants/porterOrderStatus.constants.js';
import { appendStatusHistory, logPorterOrderAction } from '../utils/porterOrder.helpers.js';
import { consumePorterCouponIfPaid } from './porter-coupon-lifecycle.service.js';
import { startPorterDispatch } from './porter-order-dispatch.service.js';
import {
    schedulePorterOrderDispatch,
    isFuturePorterSchedule,
    parseAndValidatePorterScheduledAt,
    normalizePorterTimezone,
} from './porter-scheduled-dispatch.service.js';

function isValidScheduledOrder(scheduledAt) {
    return isFuturePorterSchedule(scheduledAt)
        && (() => {
            try {
                parseAndValidatePorterScheduledAt(scheduledAt);
                return true;
            } catch {
                return false;
            }
        })();
}

/**
 * Idempotent post-payment activation for Razorpay Porter orders.
 * Mirrors verify-payment: coupon consume (when paid), status transition, audit log, dispatch.
 * Safe when verify and webhook both run, or when payment was synced before activation.
 */
export async function ensurePorterOrderActivatedAfterPaidPayment(order, { performer = null, source = 'payment' } = {}) {
    if (!order) {
        return { activated: false, reason: 'missing_order' };
    }

    if (String(order.payment?.status || '').toLowerCase() !== PORTER_PAYMENT_STATUS.PAID) {
        return { activated: false, reason: 'not_paid' };
    }

    await consumePorterCouponIfPaid(order);

    if (order.status !== PORTER_ORDER_STATUS.CREATED) {
        return { activated: false, reason: 'already_activated', order };
    }

    const historyNote = source === 'webhook'
        ? 'Payment captured via Razorpay webhook'
        : 'Searching for partner after payment';

    if (isValidScheduledOrder(order.scheduledAt)) {
        order.status = PORTER_ORDER_STATUS.SCHEDULED;
        order.schedule = order.schedule || {};
        order.schedule.status = 'scheduled';
        if (!order.schedule.timezone) {
            order.schedule.timezone = 'Asia/Kolkata';
        } else {
            order.schedule.timezone = normalizePorterTimezone(order.schedule.timezone) || 'Asia/Kolkata';
        }
        order.schedule.scheduledUpdatedAt = new Date();
        order.schedule.lastUpdatedAt = new Date();
        order.markModified('schedule');
        appendStatusHistory(
            order,
            PORTER_ORDER_STATUS.SCHEDULED,
            performer,
            source === 'webhook'
                ? 'Scheduled for later dispatch after webhook payment'
                : 'Scheduled for later dispatch after payment',
        );
        await order.save();

        await logPorterOrderAction({
            orderId: order._id,
            orderNumber: order.orderNumber,
            action: 'order_scheduled',
            toStatus: order.status,
            performedBy: performer,
            metadata: {
                scheduledAt: order.scheduledAt?.toISOString?.() || order.scheduledAt,
                source,
            },
        });

        await schedulePorterOrderDispatch(order._id, order.scheduledAt, {
            timezone: normalizePorterTimezone(order.schedule?.timezone) || 'Asia/Kolkata',
        });

        try {
            const { notifyPorterOrderScheduled } = await import('./porter-notification.service.js');
            void notifyPorterOrderScheduled(order);
        } catch {
            // non-blocking
        }

        return { activated: true, order, mode: 'scheduled' };
    }

    order.status = PORTER_ORDER_STATUS.SEARCHING_PARTNER;
    appendStatusHistory(order, PORTER_ORDER_STATUS.SEARCHING_PARTNER, performer, historyNote);
    await order.save();

    await logPorterOrderAction({
        orderId: order._id,
        orderNumber: order.orderNumber,
        action: 'order_created',
        toStatus: order.status,
        performedBy: performer,
        metadata: { source },
    });

    startPorterDispatch(order._id).catch(() => {});

    return { activated: true, order, mode: 'instant' };
}
