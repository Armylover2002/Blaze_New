import crypto from 'crypto';
import { PorterOrderLog } from '../models/porterOrderLog.model.js';
import { PORTER_TERMINAL_STATUSES } from '../constants/porterOrderStatus.constants.js';

export const PORTER_DRIVER_POPULATE_SELECT = 'name phone rating totalRatings vehicleNumber vehicleName profilePhoto';

const mapDriverFromDispatch = (deliveryPartnerId) => {
    if (!deliveryPartnerId || typeof deliveryPartnerId !== 'object' || !deliveryPartnerId.name) {
        return undefined;
    }

    const rating = Number(deliveryPartnerId.rating);
    const totalRatings = Number(deliveryPartnerId.totalRatings);

    return {
        id: String(deliveryPartnerId._id || deliveryPartnerId),
        name: deliveryPartnerId.name,
        phone: deliveryPartnerId.phone || '',
        rating: Number.isFinite(rating) && rating > 0 ? rating : undefined,
        totalRatings: Number.isFinite(totalRatings) && totalRatings > 0 ? totalRatings : undefined,
        vehicleNumber: deliveryPartnerId.vehicleNumber || undefined,
        vehicleName: deliveryPartnerId.vehicleName || undefined,
        profilePhoto: deliveryPartnerId.profilePhoto || undefined,
    };
};

export const generateOrderNumber = () => {
    const date = new Date();
    const ymd = date.toISOString().slice(0, 10).replace(/-/g, '');
    const suffix = crypto.randomInt(1000, 9999);
    return `PRT${ymd}${suffix}`;
};

export const generateOtp = (digits = 4) => {
    const max = 10 ** digits;
    const min = 10 ** (digits - 1);
    return String(crypto.randomInt(min, max));
};

export const appendStatusHistory = (order, status, performer = null, note = '') => {
    if (!order.statusHistory) order.statusHistory = [];
    order.statusHistory.push({
        status,
        note,
        changedAt: new Date(),
        changedBy: performer,
    });
};

export async function logPorterOrderAction({
    orderId,
    orderNumber,
    action,
    fromStatus,
    toStatus,
    metadata = {},
    performedBy = null,
}) {
    await PorterOrderLog.create({
        orderId,
        orderNumber,
        action,
        fromStatus,
        toStatus,
        metadata,
        performedBy,
    });
}

export const isTerminalPorterStatus = (status) => PORTER_TERMINAL_STATUSES.has(status);

export const haversineKm = (lat1, lng1, lat2, lng2) => {
    const toRad = (deg) => (deg * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2
        + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
};

export const mapPorterOrderForUser = (doc) => {
    if (!doc) return null;
    const o = typeof doc.toObject === 'function' ? doc.toObject() : doc;
    const pickupOtpStatuses = new Set(['at_pickup', 'partner_accepted', 'en_route_pickup', 'assigned']);

    return {
        id: String(o._id),
        orderNumber: o.orderNumber,
        status: o.status,
        pickup: o.pickup,
        delivery: o.delivery,
        parcel: o.parcel,
        vehicleId: o.vehicleId ? String(o.vehicleId) : null,
        vehicleName: o.vehicleName,
        route: o.route,
        pricing: o.pricing,
        payment: o.payment,
        dispatch: o.dispatch ? {
            status: o.dispatch.status,
            deliveryPartnerId: o.dispatch.deliveryPartnerId?._id
                ? String(o.dispatch.deliveryPartnerId._id)
                : (o.dispatch.deliveryPartnerId ? String(o.dispatch.deliveryPartnerId) : null),
            driver: mapDriverFromDispatch(o.dispatch.deliveryPartnerId),
        } : undefined,
        deliveryState: {
            currentPhase: o.deliveryState?.currentPhase,
            pickupOtp: pickupOtpStatuses.has(o.status) ? o.deliveryState?.pickupOtp : undefined,
            pickupOtpVerifiedAt: o.deliveryState?.pickupOtpVerifiedAt,
            pickupPhotoUrl: o.deliveryState?.pickupPhotoUrl,
            deliveryPhotoUrl: o.deliveryState?.deliveryPhotoUrl,
            pickedUpAt: o.deliveryState?.pickedUpAt,
            deliveredAt: o.deliveryState?.deliveredAt,
        },
        scheduledAt: o.scheduledAt,
        rating: o.rating,
        createdAt: o.createdAt,
        updatedAt: o.updatedAt,
    };
};

export const mapPorterOrderForDriver = (doc) => {
    const base = mapPorterOrderForUser(doc);
    if (!base) return null;
    const o = typeof doc.toObject === 'function' ? doc.toObject() : doc;
    return {
        ...base,
        module: 'parcel',
        documentType: 'porter_order',
        orderId: base.id,
        orderMongoId: base.id,
        earnings: o.pricing?.driverEarning ?? 0,
        pickupAddress: o.pickup?.address,
        dropAddress: o.delivery?.address,
        senderName: o.userId?.name || 'Sender',
        senderPhone: o.userId?.phone,
        receiverName: o.parcel?.receiverName || 'Receiver',
        receiverPhone: o.parcel?.receiverPhone,
        deliveryState: {
            currentPhase: o.deliveryState?.currentPhase,
            pickedUpAt: o.deliveryState?.pickedUpAt,
            deliveredAt: o.deliveryState?.deliveredAt,
        },
    };
};
