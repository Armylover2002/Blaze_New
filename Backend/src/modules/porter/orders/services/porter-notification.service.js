import { notifyOwnerSafely, notifyAdminsSafely } from '../../../../core/notifications/firebase.service.js';
import { PORTER_ORDER_STATUS } from '../constants/porterOrderStatus.constants.js';
import { logger } from '../../../../utils/logger.js';

const PORTER_FCM_TYPE = 'porter_order';

const templates = {
    [PORTER_ORDER_STATUS.PARTNER_ACCEPTED]: {
        customer: { title: 'Driver assigned', body: 'Your Porter driver is on the way to pickup.' },
        driver: null,
    },
    [PORTER_ORDER_STATUS.AT_PICKUP]: {
        customer: { title: 'Driver arrived', body: 'Your driver has reached the pickup location.' },
        driver: null,
    },
    [PORTER_ORDER_STATUS.PICKED_UP]: {
        customer: { title: 'Parcel picked up', body: 'Your parcel is on its way to the destination.' },
        driver: null,
    },
    [PORTER_ORDER_STATUS.IN_TRANSIT]: {
        customer: { title: 'On the way', body: 'Your parcel is in transit.' },
        driver: null,
    },
    [PORTER_ORDER_STATUS.AT_DROP]: {
        customer: { title: 'Near destination', body: 'Your driver has arrived at the drop location.' },
        driver: { title: 'OTP required', body: 'Ask the receiver for the delivery OTP to complete.' },
    },
    [PORTER_ORDER_STATUS.DELIVERED]: {
        customer: { title: 'Delivered', body: 'Your Porter delivery has been completed.' },
        driver: { title: 'Delivery complete', body: 'Trip completed successfully.' },
    },
    [PORTER_ORDER_STATUS.CANCELLED_BY_USER]: {
        customer: { title: 'Order cancelled', body: 'Your Porter order was cancelled.' },
        driver: { title: 'Order cancelled', body: 'The customer cancelled this Porter order.' },
    },
    [PORTER_ORDER_STATUS.CANCELLED_BY_ADMIN]: {
        customer: { title: 'Order cancelled', body: 'Your Porter order was cancelled by support.' },
        driver: { title: 'Order cancelled', body: 'This Porter order was cancelled by admin.' },
    },
    [PORTER_ORDER_STATUS.CANCELLED_BY_DRIVER]: {
        customer: { title: 'Order cancelled', body: 'Your Porter order was cancelled by the driver.' },
        driver: null,
    },
    new_order: {
        driver: { title: 'New Parcel Delivery', body: 'Parcel pickup request nearby.' },
    },
    admin_failure: {
        admin: { title: 'Porter alert', body: 'A high-priority Porter operation needs attention.' },
    },
};

function buildData(order, status) {
    const orderId = String(order._id || order.id);
    return {
        type: PORTER_FCM_TYPE,
        module: 'porter',
        documentType: 'porter_order',
        orderId,
        orderNumber: order.orderNumber || '',
        status: status || order.status,
        link: `/food/delivery?porterOrderId=${orderId}`,
        targetUrl: '/food/delivery',
    };
}

function buildRefundCustomerBody(order, refund = {}) {
    const amount = Number(refund?.amount) || Number(order?.pricing?.total) || 0;
    const status = String(refund?.status || '').toLowerCase();
    if (status !== 'processed' || amount <= 0) return '';

    const method = String(refund?.method || order?.payment?.method || '').toLowerCase();
    if (method === 'wallet') {
        return ` ₹${amount} has been credited to your Blaze wallet.`;
    }
    if (method === 'razorpay') {
        return ` ₹${amount} will be refunded to your original online payment method within 5–7 business days.`;
    }
    return ` ₹${amount} refund has been initiated.`;
}

function buildCouponForfeitSuffix(order) {
    if (!order?.couponCode || !order?.couponConsumed) return '';
    return ` Coupon ${order.couponCode} cannot be reused.`;
}

function buildCancellationCustomerBody(order, { cancelledBy, refund } = {}) {
    const base = cancelledBy === 'admin'
        ? 'Your Porter order was cancelled by support.'
        : 'Your Porter order was cancelled.';
    return `${base}${buildRefundCustomerBody(order, refund)}${buildCouponForfeitSuffix(order)}`.trim();
}

/**
 * Unified cancel notification — customer gets cancel + refund + coupon policy in one push.
 * Driver gets assignment-cancelled notice when they were assigned.
 */
export async function notifyPorterOrderCancellation(order, { refund = {}, cancelledBy = 'user' } = {}) {
    if (!order) return;

    const data = buildData(order, order.status);
    const userId = order.userId?._id || order.userId;
    const partnerId = order.dispatch?.deliveryPartnerId?._id || order.dispatch?.deliveryPartnerId;

    const customerTitle = 'Order cancelled';
    const customerBody = buildCancellationCustomerBody(order, { cancelledBy, refund });

    const driverTitle = cancelledBy === 'admin' ? 'Order cancelled' : 'Order cancelled';
    const driverBody = cancelledBy === 'admin'
        ? 'This Porter order was cancelled by admin.'
        : 'The customer cancelled this Porter order.';

    try {
        if (userId) {
            await notifyOwnerSafely(
                { ownerType: 'USER', ownerId: String(userId) },
                {
                    title: customerTitle,
                    body: customerBody,
                    data: {
                        ...data,
                        cancelledBy,
                        refundStatus: refund?.status || order.payment?.refund?.status || '',
                        refundAmount: String(refund?.amount || order.payment?.refund?.amount || 0),
                        refundMethod: refund?.method || order.payment?.refund?.method || '',
                        couponForfeited: order.couponConsumed ? 'true' : 'false',
                    },
                },
            );
        }
        if (partnerId) {
            await notifyOwnerSafely(
                { ownerType: 'DELIVERY_PARTNER', ownerId: String(partnerId), platform: 'mobile' },
                { title: driverTitle, body: driverBody, data },
            );
        }
    } catch (err) {
        logger.warn(`[PorterFCM] cancellation notify failed: ${err.message}`);
    }
}

export async function notifyPorterOrderStatusChange(order, { previousStatus } = {}) {
    if (!order) return;
    const status = order.status;
    const tpl = templates[status];
    if (!tpl) return;

    const data = buildData(order, status);
    const userId = order.userId?._id || order.userId;
    const partnerId = order.dispatch?.deliveryPartnerId?._id || order.dispatch?.deliveryPartnerId;

    try {
        if (tpl.customer && userId) {
            await notifyOwnerSafely(
                { ownerType: 'USER', ownerId: String(userId) },
                { title: tpl.customer.title, body: tpl.customer.body, data },
            );
        }
        if (tpl.driver && partnerId) {
            await notifyOwnerSafely(
                { ownerType: 'DELIVERY_PARTNER', ownerId: String(partnerId), platform: 'mobile' },
                { title: tpl.driver.title, body: tpl.driver.body, data },
            );
        }
    } catch (err) {
        logger.warn(`[PorterFCM] status notify failed (${status}): ${err.message}`);
    }

    if (status === PORTER_ORDER_STATUS.FAILED) {
        await notifyPorterAdminAlert(order, `Order ${order.orderNumber} failed`, previousStatus);
    }
}

export async function notifyPorterRefund(order, refund = {}) {
    if (!order) return;
    const status = String(refund?.status || '').toLowerCase();
    if (status !== 'processed' && status !== 'pending') return;

    const userId = order.userId?._id || order.userId;
    if (!userId) return;

    const amount = Number(refund?.amount) || 0;
    const toWallet = String(refund?.method || '').toLowerCase() === 'wallet';
    const title = status === 'pending' ? 'Refund initiated' : (toWallet ? 'Wallet credited' : 'Refund completed');
    const body = status === 'pending'
        ? `Your refund of ₹${amount} for order ${order.orderNumber} has been initiated.`
        : toWallet
            ? `₹${amount} has been credited to your Blaze wallet for order ${order.orderNumber}.`
            : `₹${amount} has been refunded to your original payment method for order ${order.orderNumber}.`;

    try {
        await notifyOwnerSafely(
            { ownerType: 'USER', ownerId: String(userId) },
            { title, body, data: { ...buildData(order, order.status), refundStatus: status, refundAmount: String(amount) } },
        );
    } catch (err) {
        logger.warn(`[PorterFCM] refund notify failed: ${err.message}`);
    }
}

export async function notifyPorterDriverAssignmentRemoved(order, partnerId) {
    if (!order || !partnerId) return;
    try {
        await notifyOwnerSafely(
            { ownerType: 'DELIVERY_PARTNER', ownerId: String(partnerId), platform: 'mobile' },
            {
                title: 'Assignment removed',
                body: `Order ${order.orderNumber} has been removed from your queue.`,
                data: buildData(order, order.status),
            },
        );
    } catch (err) {
        logger.warn(`[PorterFCM] assignment removed notify failed: ${err.message}`);
    }
}

export async function notifyPorterPartnerReleasedForRedispatch(order) {
    if (!order) return;
    const userId = order.userId?._id || order.userId;
    if (!userId) return;
    try {
        await notifyOwnerSafely(
            { ownerType: 'USER', ownerId: String(userId) },
            {
                title: 'Finding new partner',
                body: 'Your delivery partner cancelled. We are matching you with another partner.',
                data: buildData(order, order.status),
            },
        );
    } catch (err) {
        logger.warn(`[PorterFCM] partner released notify failed: ${err.message}`);
    }
}

export async function notifyPorterNewOrderToDriver(partnerId, order) {
    if (!partnerId || !order) return;
    const tpl = templates.new_order?.driver;
    if (!tpl) return;
    try {
        await notifyOwnerSafely(
            { ownerType: 'DELIVERY_PARTNER', ownerId: String(partnerId), platform: 'mobile' },
            {
                title: tpl.title,
                body: tpl.body,
                data: buildData(order, PORTER_ORDER_STATUS.SEARCHING_PARTNER),
            },
        );
    } catch (err) {
        logger.warn(`[PorterFCM] new order notify failed: ${err.message}`);
    }
}

export async function notifyPorterAdminAlert(order, message, detail = '') {
    const tpl = templates.admin_failure.admin;
    try {
        await notifyAdminsSafely({
            title: tpl.title,
            body: message || tpl.body,
            data: {
                type: PORTER_FCM_TYPE,
                module: 'porter',
                orderId: order ? String(order._id || order.id) : '',
                orderNumber: order?.orderNumber || '',
                detail: String(detail || ''),
                link: order ? `/porter/admin/orders/${order._id || order.id}` : '/porter/admin/orders',
            },
        });
    } catch (err) {
        logger.warn(`[PorterFCM] admin alert failed: ${err.message}`);
    }
}

function formatScheduleLocal(scheduledAt) {
    if (!scheduledAt) return '';
    try {
        return new Date(scheduledAt).toLocaleString('en-IN', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch {
        return String(scheduledAt);
    }
}

export async function notifyPorterOrderScheduled(order) {
    if (!order) return;
    const userId = order.userId?._id || order.userId;
    if (!userId) return;
    const when = formatScheduleLocal(order.scheduledAt);
    try {
        await notifyOwnerSafely(
            { ownerType: 'USER', ownerId: String(userId) },
            {
                title: 'Order scheduled successfully',
                body: when
                    ? `Your Porter pickup is scheduled for ${when}. We'll notify you before we start searching.`
                    : 'Your Porter pickup has been scheduled successfully.',
                data: { ...buildData(order, PORTER_ORDER_STATUS.SCHEDULED), link: '/porter/scheduled' },
            },
        );
    } catch (err) {
        logger.warn(`[PorterFCM] schedule notify failed: ${err.message}`);
    }
}

export async function notifyPorterScheduleReminder(order) {
    if (!order) return;
    const userId = order.userId?._id || order.userId;
    if (!userId) return;
    const when = formatScheduleLocal(order.scheduledAt);
    try {
        await notifyOwnerSafely(
            { ownerType: 'USER', ownerId: String(userId) },
            {
                title: 'Pickup starting soon',
                body: when
                    ? `Your scheduled Porter pickup starts at ${when}. Please keep your parcel ready.`
                    : 'Your scheduled Porter pickup starts in about 15 minutes.',
                data: { ...buildData(order, PORTER_ORDER_STATUS.SCHEDULED), link: '/porter/scheduled' },
            },
        );
    } catch (err) {
        logger.warn(`[PorterFCM] schedule reminder failed: ${err.message}`);
    }
}

export async function notifyPorterSearchingAfterSchedule(order) {
    if (!order) return;
    const userId = order.userId?._id || order.userId;
    if (!userId) return;
    try {
        await notifyOwnerSafely(
            { ownerType: 'USER', ownerId: String(userId) },
            {
                title: 'Searching for a driver',
                body: `It's time for order ${order.orderNumber || ''}. We're finding a nearby delivery partner.`.trim(),
                data: { ...buildData(order, PORTER_ORDER_STATUS.SEARCHING_PARTNER), link: '/porter/finding-partner' },
            },
        );
    } catch (err) {
        logger.warn(`[PorterFCM] searching-after-schedule notify failed: ${err.message}`);
    }
}

export async function notifyPorterOrderRescheduled(order, previousScheduledAt) {
    if (!order) return;
    const userId = order.userId?._id || order.userId;
    if (!userId) return;
    const when = formatScheduleLocal(order.scheduledAt);
    try {
        await notifyOwnerSafely(
            { ownerType: 'USER', ownerId: String(userId) },
            {
                title: 'Order rescheduled',
                body: when
                    ? `Your Porter pickup was moved to ${when}.`
                    : 'Your Porter schedule was updated.',
                data: {
                    ...buildData(order, PORTER_ORDER_STATUS.SCHEDULED),
                    previousScheduledAt: previousScheduledAt ? String(previousScheduledAt) : '',
                    link: '/porter/scheduled',
                },
            },
        );
    } catch (err) {
        logger.warn(`[PorterFCM] reschedule notify failed: ${err.message}`);
    }
}
