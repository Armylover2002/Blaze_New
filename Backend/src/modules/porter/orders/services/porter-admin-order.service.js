import mongoose from 'mongoose';
import { PorterOrder } from '../models/porterOrder.model.js';
import { PorterOrderLog } from '../models/porterOrderLog.model.js';
import { FoodDeliveryPartner } from '../../../food/delivery/models/deliveryPartner.model.js';
import { NotFoundError, ValidationError, ConflictError, ForbiddenError } from '../../../../core/auth/errors.js';
import {
    PORTER_ORDER_STATUS,
    PORTER_DISPATCH_STATUS,
    PORTER_DELIVERY_PHASE,
    PORTER_PAYMENT_STATUS,
    PORTER_TERMINAL_STATUSES,
} from '../constants/porterOrderStatus.constants.js';
import {
    appendStatusHistory,
    logPorterOrderAction,
    isTerminalPorterStatus,
} from '../utils/porterOrder.helpers.js';
import {
    emitPorterOrderStatus,
    emitPorterOrderCancelled,
    partnerSupportsParcel,
} from './porter-order-dispatch.service.js';
import { applyPorterRefund } from './porter-order-payment.service.js';
import { finalizePorterCouponOnCancel } from './porter-coupon-lifecycle.service.js';
import { settlePorterOrderEarningsAtomic } from './porter-wallet-atomic.service.js';
import { notifyPorterOrderCancellation } from './porter-notification.service.js';
import { activateScheduledPorterOrder } from './porter-scheduled-dispatch.service.js';
import { assertPartnerNotBusy } from '../utils/porter-order-transition.util.js';

const baseFilter = { isDeleted: { $ne: true } };

const PRE_PICKUP_STATUSES = new Set([
    PORTER_ORDER_STATUS.SCHEDULED,
    PORTER_ORDER_STATUS.SEARCHING_PARTNER,
    PORTER_ORDER_STATUS.ASSIGNED,
    PORTER_ORDER_STATUS.PARTNER_ACCEPTED,
    PORTER_ORDER_STATUS.EN_ROUTE_PICKUP,
    PORTER_ORDER_STATUS.AT_PICKUP,
]);

async function loadOrder(orderId) {
    const order = await PorterOrder.findOne({ _id: orderId, ...baseFilter });
    if (!order) throw new NotFoundError('Order not found');
    return order;
}

async function validateAssignablePartner(partnerId, vehicleId) {
    const partner = await FoodDeliveryPartner.findById(partnerId).lean();
    if (!partner || partner.status !== 'approved') {
        throw new ValidationError('Driver not approved');
    }
    const support = partnerSupportsParcel(partner, vehicleId);
    if (!support.ok) throw new ValidationError('Driver cannot accept this Porter vehicle type');
    await assertPartnerNotBusy(PorterOrder, partnerId);
    return { partner, support };
}

export async function adminAssignPorterDriver(orderId, driverId, performer = null) {
    const order = await loadOrder(orderId);
    if (isTerminalPorterStatus(order.status)) {
        throw new ValidationError('Cannot assign driver to a closed order');
    }

    const assignable = new Set([
        PORTER_ORDER_STATUS.SCHEDULED,
        PORTER_ORDER_STATUS.SEARCHING_PARTNER,
        PORTER_ORDER_STATUS.ASSIGNED,
    ]);
    if (!assignable.has(order.status)) {
        throw new ValidationError('Order is not in an assignable state');
    }

    if (order.status === PORTER_ORDER_STATUS.SCHEDULED) {
        await activateScheduledPorterOrder(orderId, performer, {
            reason: 'Manual assign activated scheduled order',
            allowEarly: true,
        });
    }

    const { support } = await validateAssignablePartner(driverId, order.vehicleId);
    const activeVehicleId = support.activeVehicle?.id || support.activeVehicle?.porterVehicleId;
    const fromStatus = order.status;

    const updated = await PorterOrder.findOneAndUpdate(
        {
            _id: orderId,
            status: { $in: [...assignable] },
            ...baseFilter,
        },
        {
            $set: {
                status: PORTER_ORDER_STATUS.PARTNER_ACCEPTED,
                'dispatch.status': PORTER_DISPATCH_STATUS.ACCEPTED,
                'dispatch.deliveryPartnerId': new mongoose.Types.ObjectId(driverId),
                'dispatch.activeVehicleId': activeVehicleId ? String(activeVehicleId) : null,
                'dispatch.assignedAt': new Date(),
                'dispatch.acceptedAt': new Date(),
                'dispatch.manuallyAssigned': true,
                'deliveryState.currentPhase': PORTER_DELIVERY_PHASE.EN_ROUTE_PICKUP,
            },
        },
        { new: true },
    );

    if (!updated) throw new ConflictError('Order state changed — refresh and retry');

    appendStatusHistory(updated, updated.status, performer, 'Manually assigned by admin');
    await updated.save();

    await emitPorterOrderStatus(updated, updated.userId, driverId);
    await notifyPorterOrderStatusChange(updated);
    await logPorterOrderAction({
        orderId: updated._id,
        orderNumber: updated.orderNumber,
        action: 'admin_assign',
        fromStatus,
        toStatus: updated.status,
        metadata: { driverId: String(driverId) },
        performedBy: performer,
    });

    return updated;
}

export async function adminReassignPorterDriver(orderId, driverId, performer = null) {
    const order = await loadOrder(orderId);
    if (!PRE_PICKUP_STATUSES.has(order.status)) {
        throw new ValidationError('Can only reassign before parcel pickup');
    }

    const previousDriverId = order.dispatch?.deliveryPartnerId;
    const { support } = await validateAssignablePartner(driverId, order.vehicleId);
    const activeVehicleId = support.activeVehicle?.id || support.activeVehicle?.porterVehicleId;
    const fromStatus = order.status;

    order.status = PORTER_ORDER_STATUS.PARTNER_ACCEPTED;
    order.dispatch.status = PORTER_DISPATCH_STATUS.ACCEPTED;
    order.dispatch.deliveryPartnerId = new mongoose.Types.ObjectId(driverId);
    order.dispatch.activeVehicleId = activeVehicleId ? String(activeVehicleId) : null;
    order.dispatch.assignedAt = new Date();
    order.dispatch.acceptedAt = new Date();
    order.dispatch.manuallyAssigned = true;
    order.deliveryState.currentPhase = PORTER_DELIVERY_PHASE.EN_ROUTE_PICKUP;
    appendStatusHistory(order, order.status, performer, 'Reassigned by admin');
    await order.save();

    if (previousDriverId && String(previousDriverId) !== String(driverId)) {
        await emitPorterOrderCancelled(order, order.userId, previousDriverId);
    }
    await emitPorterOrderStatus(order, order.userId, driverId);
    await notifyPorterOrderStatusChange(order);
    await logPorterOrderAction({
        orderId: order._id,
        orderNumber: order.orderNumber,
        action: 'admin_reassign',
        fromStatus,
        toStatus: order.status,
        metadata: {
            previousDriverId: previousDriverId ? String(previousDriverId) : null,
            driverId: String(driverId),
        },
        performedBy: performer,
    });

    return order;
}

export async function adminCancelPorterOrder(orderId, reason, performer = null, note = null) {
    const order = await loadOrder(orderId);
    if (isTerminalPorterStatus(order.status)) {
        throw new ValidationError('Order is already closed');
    }

    const nonCancellable = new Set([
        PORTER_ORDER_STATUS.PICKED_UP,
        PORTER_ORDER_STATUS.IN_TRANSIT,
        PORTER_ORDER_STATUS.AT_DROP,
        PORTER_ORDER_STATUS.DELIVERED,
    ]);
    if (nonCancellable.has(order.status)) {
        throw new ValidationError('Cannot cancel after pickup');
    }

    const fromStatus = order.status;
    const previousDriver = order.dispatch?.deliveryPartnerId;

    const cancelled = await PorterOrder.findOneAndUpdate(
        {
            _id: orderId,
            status: { $nin: [...PORTER_TERMINAL_STATUSES, ...nonCancellable] },
            'payment.status': { $ne: PORTER_PAYMENT_STATUS.REFUNDED },
            ...baseFilter,
        },
        {
            $set: {
                status: PORTER_ORDER_STATUS.CANCELLED_BY_ADMIN,
                'dispatch.status': PORTER_DISPATCH_STATUS.CANCELLED,
                'schedule.status': 'cancelled',
                'schedule.lastUpdatedAt': new Date(),
                cancellation: { reason, cancelledBy: 'admin', cancelledAt: new Date(), note: note || undefined },
            },
        },
        { new: true },
    );

    if (!cancelled) throw new ValidationError('Order cannot be cancelled');

    appendStatusHistory(cancelled, cancelled.status, performer, note ? `${reason} — ${note}` : reason);
    await cancelled.save();

    const { removePorterScheduledJobs } = await import('./porter-scheduled-dispatch.service.js');
    void removePorterScheduledJobs(cancelled._id, cancelled);

    const refundResult = await applyPorterRefund(cancelled, reason);
    await finalizePorterCouponOnCancel(cancelled);

    await emitPorterOrderCancelled(cancelled, cancelled.userId, previousDriver);
    await emitPorterOrderStatus(cancelled, cancelled.userId, previousDriver);
    void notifyPorterOrderCancellation(cancelled, { refund: refundResult, cancelledBy: 'admin' });
    await logPorterOrderAction({
        orderId: cancelled._id,
        orderNumber: cancelled.orderNumber,
        action: 'cancelled_by_admin',
        fromStatus,
        toStatus: cancelled.status,
        metadata: { reason },
        performedBy: performer,
    });

    return cancelled;
}

export async function adminForceClosePorterOrder(orderId, { reason, markDelivered = false }, performer = null) {
    if (!performer || performer.role !== 'ADMIN') {
        throw new ForbiddenError('Only admins can force-close Porter orders');
    }

    const order = await loadOrder(orderId);
    if (isTerminalPorterStatus(order.status)) {
        throw new ValidationError('Order is already closed');
    }

    const fromStatus = order.status;
    const previousDriver = order.dispatch?.deliveryPartnerId;
    const targetStatus = markDelivered ? PORTER_ORDER_STATUS.DELIVERED : PORTER_ORDER_STATUS.FAILED;

    order.status = targetStatus;
    order.dispatch.status = PORTER_DISPATCH_STATUS.CANCELLED;
    order.cancellation = {
        reason: reason || 'Force closed by admin',
        cancelledBy: 'admin_force',
        cancelledAt: new Date(),
    };
    if (markDelivered) {
        order.deliveryState.currentPhase = PORTER_DELIVERY_PHASE.DELIVERED;
        order.deliveryState.deliveredAt = new Date();
    }
    appendStatusHistory(order, order.status, performer, reason || 'Force closed');
    await order.save();

    if (markDelivered && order.dispatch?.deliveryPartnerId) {
        await settlePorterOrderEarningsAtomic(order);
    }

    await emitPorterOrderCancelled(order, order.userId, previousDriver);
    await emitPorterOrderStatus(order, order.userId, previousDriver);
    await notifyPorterOrderStatusChange(order, { previousStatus: fromStatus });
    await logPorterOrderAction({
        orderId: order._id,
        orderNumber: order.orderNumber,
        action: 'admin_force_close',
        fromStatus,
        toStatus: order.status,
        metadata: { reason, markDelivered },
        performedBy: performer,
    });

    return order;
}

export async function getPorterOrderLogsAdmin(orderId) {
    const order = await PorterOrder.findOne({ _id: orderId, ...baseFilter })
        .select({ orderNumber: 1, statusHistory: 1, status: 1 })
        .lean();
    if (!order) throw new NotFoundError('Order not found');

    const logs = await PorterOrderLog.find({ orderId, isDeleted: { $ne: true } })
        .sort({ createdAt: -1 })
        .limit(200)
        .lean();

    return {
        orderId: String(orderId),
        orderNumber: order.orderNumber,
        currentStatus: order.status,
        statusHistory: order.statusHistory || [],
        auditLogs: logs,
    };
}

export async function listAssignablePorterDrivers(orderId) {
    const order = await PorterOrder.findOne({ _id: orderId, ...baseFilter })
        .select({ vehicleId: 1, pickup: 1 })
        .lean();
    if (!order) throw new NotFoundError('Order not found');

    const partners = await FoodDeliveryPartner.find({
        status: 'approved',
        availabilityStatus: 'online',
        'driverVehicles.0': { $exists: true },
    })
        .select({ name: 1, phone: 1, driverVehicles: 1, activeVehicleId: 1, supportedServices: 1 })
        .limit(100)
        .lean();

    return partners
        .filter((p) => partnerSupportsParcel(p, order.vehicleId).ok)
        .map((p) => ({
            id: String(p._id),
            name: p.name,
            phone: p.phone,
            activeVehicleId: p.activeVehicleId,
        }));
}
