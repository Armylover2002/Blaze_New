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
