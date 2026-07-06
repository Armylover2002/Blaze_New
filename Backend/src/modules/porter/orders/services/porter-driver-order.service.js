import mongoose from 'mongoose';
import { PorterOrder } from '../models/porterOrder.model.js';
import { FoodDeliveryPartner } from '../../../food/delivery/models/deliveryPartner.model.js';
import { NotFoundError, ValidationError, ConflictError } from '../../../../core/auth/errors.js';
import {
    PORTER_ORDER_STATUS,
    PORTER_DISPATCH_STATUS,
    PORTER_DELIVERY_PHASE,
} from '../constants/porterOrderStatus.constants.js';
import { PORTER_DISPATCH_DOCUMENT_TYPE } from '../constants/porterDispatch.constants.js';
import {
    appendStatusHistory,
    logPorterOrderAction,
    mapPorterOrderForDriver,
    haversineKm,
} from '../utils/porterOrder.helpers.js';
import {
    emitPorterOrderStatus,
    emitPorterOrderCancelled,
    partnerSupportsParcel,
} from './porter-order-dispatch.service.js';
import { settlePorterOrderEarnings } from './porter-order.service.js';
import { notifyPorterOrderStatusChange } from './porter-notification.service.js';
import {
    assertPorterStatusTransition,
    assertPartnerNotBusy,
} from '../utils/porter-order-transition.util.js';

const baseFilter = { isDeleted: { $ne: true } };

async function getPartnerOrder(orderId, partnerId) {
    const order = await PorterOrder.findOne({
        _id: orderId,
        'dispatch.deliveryPartnerId': new mongoose.Types.ObjectId(partnerId),
        ...baseFilter,
    });
    if (!order) throw new NotFoundError('Order not found');
    return order;
}

export async function listAvailablePorterOrdersForDriver(partnerId) {
    const partner = await FoodDeliveryPartner.findById(partnerId)
        .select({ driverVehicles: 1, activeVehicleId: 1, lastLat: 1, lastLng: 1 })
        .lean();

    const support = partnerSupportsParcel(partner, null);
    if (!support.ok) return [];

    const orders = await PorterOrder.find({
        status: PORTER_ORDER_STATUS.SEARCHING_PARTNER,
        'dispatch.status': PORTER_DISPATCH_STATUS.UNASSIGNED,
        ...baseFilter,
    })
        .sort({ createdAt: -1 })
        .limit(20)
        .populate('userId', 'name phone')
        .lean();

    const lat = partner?.lastLat;
    const lng = partner?.lastLng;

    return orders
        .filter((o) => {
            if (!o.vehicleId) return true;
            const supportCheck = partnerSupportsParcel(partner, o.vehicleId);
            return supportCheck.ok;
        })
        .map((o) => {
            const mapped = mapPorterOrderForDriver(o);
            if (Number.isFinite(lat) && Number.isFinite(lng) && o.pickup?.lat != null) {
                mapped.distanceKm = Number(haversineKm(lat, lng, o.pickup.lat, o.pickup.lng).toFixed(2));
            }
            return mapped;
        });
}

export async function acceptPorterOrder(partnerId, orderId, performer = null) {
    const partner = await FoodDeliveryPartner.findById(partnerId).lean();
    if (!partner || partner.status !== 'approved') {
        throw new ValidationError('Partner not approved');
    }
    if (partner.availabilityStatus !== 'online') {
        throw new ValidationError('Go online to accept orders');
    }

    const orderPreview = await PorterOrder.findOne({
        _id: orderId,
        status: PORTER_ORDER_STATUS.SEARCHING_PARTNER,
        ...baseFilter,
    }).lean();

    if (!orderPreview) throw new ConflictError('Order already taken or unavailable');

    const support = partnerSupportsParcel(partner, orderPreview.vehicleId);
    if (!support.ok) throw new ValidationError('Your active vehicle cannot accept this order');

    await assertPartnerNotBusy(PorterOrder, partnerId);

    const activeVehicleId = support.activeVehicle?.id || support.activeVehicle?.porterVehicleId;
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const order = await PorterOrder.findOneAndUpdate(
            {
                _id: orderId,
                status: PORTER_ORDER_STATUS.SEARCHING_PARTNER,
                'dispatch.status': PORTER_DISPATCH_STATUS.UNASSIGNED,
                isDeleted: { $ne: true },
            },
            {
                $set: {
                    status: PORTER_ORDER_STATUS.PARTNER_ACCEPTED,
                    'dispatch.status': PORTER_DISPATCH_STATUS.ACCEPTED,
                    'dispatch.deliveryPartnerId': new mongoose.Types.ObjectId(partnerId),
                    'dispatch.activeVehicleId': activeVehicleId ? String(activeVehicleId) : null,
                    'dispatch.assignedAt': new Date(),
                    'dispatch.acceptedAt': new Date(),
                    'deliveryState.currentPhase': PORTER_DELIVERY_PHASE.EN_ROUTE_PICKUP,
                },
            },
            { new: true, session },
        );

        if (!order) {
            await session.abortTransaction();
            throw new ConflictError('Order already taken by another partner');
        }

        appendStatusHistory(order, order.status, performer, 'Partner accepted');
        await order.save({ session });
        await session.commitTransaction();

        await emitPorterOrderStatus(order, order.userId, partnerId);
        await notifyPorterOrderStatusChange(order);
        await logPorterOrderAction({
            orderId: order._id,
            orderNumber: order.orderNumber,
            action: 'partner_accepted',
            toStatus: order.status,
            performedBy: performer,
            metadata: { partnerId: String(partnerId) },
        });

        return mapPorterOrderForDriver(order);
    } catch (err) {
        await session.abortTransaction();
        throw err;
    } finally {
        session.endSession();
    }
}

export async function rejectPorterOrder(partnerId, orderId) {
    await PorterOrder.updateOne(
        { _id: orderId, status: PORTER_ORDER_STATUS.SEARCHING_PARTNER },
        { $addToSet: { 'dispatch.rejectedPartnerIds': new mongoose.Types.ObjectId(partnerId) } },
    );
    return { rejected: true };
}

export async function confirmPorterReachedPickup(partnerId, orderId, performer = null) {
    const order = await getPartnerOrder(orderId, partnerId);
    const allowed = new Set([
        PORTER_ORDER_STATUS.PARTNER_ACCEPTED,
        PORTER_ORDER_STATUS.EN_ROUTE_PICKUP,
        PORTER_ORDER_STATUS.ASSIGNED,
    ]);
    if (!allowed.has(order.status)) throw new ValidationError('Invalid status for reached pickup');

    assertPorterStatusTransition(order.status, PORTER_ORDER_STATUS.AT_PICKUP);
    order.status = PORTER_ORDER_STATUS.AT_PICKUP;
    order.deliveryState.currentPhase = PORTER_DELIVERY_PHASE.AT_PICKUP;
    appendStatusHistory(order, order.status, performer);
    await order.save();
    await emitPorterOrderStatus(order, order.userId, partnerId);
    void notifyPorterOrderStatusChange(order);
    return mapPorterOrderForDriver(order);
}

export async function verifyPorterPickupOtp(partnerId, orderId, otp) {
    const order = await getPartnerOrder(orderId, partnerId);
    if (order.status !== PORTER_ORDER_STATUS.AT_PICKUP) {
        throw new ValidationError('Not at pickup location');
    }
    if (String(order.deliveryState?.pickupOtp) !== String(otp)) {
        throw new ValidationError('Invalid pickup OTP');
    }
    order.deliveryState.pickupOtpVerifiedAt = new Date();
    await order.save();
    return { verified: true };
}

export async function confirmPorterPickedUp(partnerId, orderId, performer = null) {
    const order = await getPartnerOrder(orderId, partnerId);
    if (![PORTER_ORDER_STATUS.AT_PICKUP].includes(order.status)) {
        throw new ValidationError('Cannot mark picked up — verify pickup OTP first');
    }
    if (!order.deliveryState?.pickupOtpVerifiedAt) {
        throw new ValidationError('Pickup OTP must be verified before collection');
    }

    assertPorterStatusTransition(order.status, PORTER_ORDER_STATUS.PICKED_UP);
    order.status = PORTER_ORDER_STATUS.PICKED_UP;
    order.deliveryState.currentPhase = PORTER_DELIVERY_PHASE.PICKED_UP;
    order.deliveryState.pickedUpAt = new Date();
    appendStatusHistory(order, order.status, performer);
    await order.save();

    assertPorterStatusTransition(order.status, PORTER_ORDER_STATUS.IN_TRANSIT);
    order.status = PORTER_ORDER_STATUS.IN_TRANSIT;
    order.deliveryState.currentPhase = PORTER_DELIVERY_PHASE.EN_ROUTE_DROP;
    appendStatusHistory(order, order.status, performer, 'En route to drop');
    await order.save();
    await emitPorterOrderStatus(order, order.userId, partnerId);
    void notifyPorterOrderStatusChange(order);
    return mapPorterOrderForDriver(order);
}

export async function confirmPorterReachedDrop(partnerId, orderId, performer = null) {
    const order = await getPartnerOrder(orderId, partnerId);
    const allowed = [PORTER_ORDER_STATUS.PICKED_UP, PORTER_ORDER_STATUS.IN_TRANSIT];
    if (!allowed.includes(order.status)) throw new ValidationError('Invalid status for reached drop');

    assertPorterStatusTransition(order.status, PORTER_ORDER_STATUS.AT_DROP);
    order.status = PORTER_ORDER_STATUS.AT_DROP;
    order.deliveryState.currentPhase = PORTER_DELIVERY_PHASE.AT_DROP;
    appendStatusHistory(order, order.status, performer);
    await order.save();
    await emitPorterOrderStatus(order, order.userId, partnerId);
    void notifyPorterOrderStatusChange(order);
    return mapPorterOrderForDriver(order);
}

export async function completePorterDelivery(partnerId, orderId, otp, performer = null) {
    const order = await getPartnerOrder(orderId, partnerId);
    if (order.status !== PORTER_ORDER_STATUS.AT_DROP) {
        throw new ValidationError('Not at drop location');
    }
    if (String(order.deliveryState?.dropOtp) !== String(otp)) {
        throw new ValidationError('Invalid delivery OTP');
    }

    assertPorterStatusTransition(order.status, PORTER_ORDER_STATUS.DELIVERED);
    order.status = PORTER_ORDER_STATUS.DELIVERED;
    order.deliveryState.currentPhase = PORTER_DELIVERY_PHASE.DELIVERED;
    order.deliveryState.dropOtpVerifiedAt = new Date();
    order.deliveryState.deliveredAt = new Date();
    appendStatusHistory(order, order.status, performer, 'Delivered');
    await order.save();

    await settlePorterOrderEarnings(order);
    await emitPorterOrderStatus(order, order.userId, partnerId);
    void notifyPorterOrderStatusChange(order);
    await logPorterOrderAction({
        orderId: order._id,
        orderNumber: order.orderNumber,
        action: 'delivered',
        toStatus: order.status,
        performedBy: performer,
    });

    return mapPorterOrderForDriver(order);
}

export async function getActivePorterOrderForDriver(partnerId) {
    const order = await PorterOrder.findOne({
        'dispatch.deliveryPartnerId': new mongoose.Types.ObjectId(partnerId),
        status: {
            $in: [
                PORTER_ORDER_STATUS.ASSIGNED,
                PORTER_ORDER_STATUS.PARTNER_ACCEPTED,
                PORTER_ORDER_STATUS.EN_ROUTE_PICKUP,
                PORTER_ORDER_STATUS.AT_PICKUP,
                PORTER_ORDER_STATUS.PICKED_UP,
                PORTER_ORDER_STATUS.IN_TRANSIT,
                PORTER_ORDER_STATUS.AT_DROP,
            ],
        },
        ...baseFilter,
    })
        .sort({ createdAt: -1 })
        .lean();

    return order ? mapPorterOrderForDriver(order) : null;
}

export async function listPorterTripHistoryForDriver(partnerId, query = {}) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const filter = {
        'dispatch.deliveryPartnerId': new mongoose.Types.ObjectId(partnerId),
        status: { $in: [PORTER_ORDER_STATUS.DELIVERED, PORTER_ORDER_STATUS.COMPLETED] },
        ...baseFilter,
    };

    const [docs, total] = await Promise.all([
        PorterOrder.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        PorterOrder.countDocuments(filter),
    ]);

    return {
        records: docs.map(mapPorterOrderForDriver),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        module: 'porter',
        documentType: PORTER_DISPATCH_DOCUMENT_TYPE,
    };
}
