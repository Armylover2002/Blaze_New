import mongoose from 'mongoose';
import { PorterOrder } from '../models/porterOrder.model.js';

/**
 * Porter driver finance/history helpers.
 *
 * These mirror the Food `SellerReturn` merge helpers so that Porter (parcel)
 * trips, earnings and cash-collected values can be folded into the SHARED
 * delivery-partner History / Pocket / Wallet screens without changing any
 * Food or Quick behaviour. They are additive only.
 */

const DELIVERED_STATUSES = ['delivered', 'completed'];

const toObjectId = (id) => new mongoose.Types.ObjectId(id);

const isCash = (order) => String(order?.payment?.method || '').toLowerCase() === 'cash';

/**
 * Trip DTO shaped identically to the Food `toTripDto` output (plus parcel
 * metadata) so the shared driver History/Pocket UI renders it unchanged.
 */
export const toPorterTripDto = (order) => {
    const deliveredAt = order?.deliveryState?.deliveredAt || order?.deliveryState?.completedAt || null;
    const dateForUi = deliveredAt || order?.createdAt || order?.updatedAt || null;
    const time = dateForUi
        ? new Date(dateForUi).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
        : '';

    const status = String(order?.status || '').toLowerCase();
    const isDelivered = DELIVERED_STATUSES.includes(status);
    const isCancelled = status.startsWith('cancelled') || status === 'failed';
    const uiStatus = isDelivered ? 'Completed' : isCancelled ? 'Cancelled' : 'Pending';

    const paymentMethod = order?.payment?.method || 'wallet';
    const total = Number(order?.pricing?.total) || 0;
    const earning = Number(order?.pricing?.driverEarning) || 0;
    const codAmount = isCash(order) ? total : 0;
    const codCollectedAmount = isCash(order) && order?.payment?.status === 'paid' ? total : 0;
    const distanceKm = Number(order?.route?.distanceKm) || 0;

    return {
        id: order?._id,
        _id: order?._id,
        orderId: order?.orderNumber || String(order?._id),
        module: 'parcel',
        documentType: 'porter_order',
        tripType: 'parcel',
        isParcel: true,
        status: uiStatus,
        restaurantName: order?.parcel?.parcelName || 'Parcel Delivery',
        restaurant: 'Parcel Delivery',
        senderName: order?.pickup?.title || 'Sender',
        receiverName: order?.parcel?.receiverName || 'Receiver',
        pickupAddress: order?.pickup?.address || '',
        dropAddress: order?.delivery?.address || '',
        vehicleName: order?.vehicleName || '',
        items: [],
        orderItems: [],
        paymentMethod,
        totalAmount: total,
        orderTotal: total,
        codAmount,
        codCollectedAmount,
        deliveryEarning: earning,
        earningAmount: earning,
        amount: earning,
        distanceKm,
        weightKg: Number(order?.parcel?.weightKg) || 0,
        createdAt: order?.createdAt,
        deliveredAt,
        completedAt: deliveredAt,
        date: dateForUi,
        time,
    };
};

const buildTripMatch = (partnerId, statusFilter, range) => {
    const match = { 'dispatch.deliveryPartnerId': toObjectId(partnerId), isDeleted: { $ne: true } };
    const sf = String(statusFilter || '').toLowerCase();

    if (sf === 'completed') {
        match.status = { $in: DELIVERED_STATUSES };
        if (range) match['deliveryState.deliveredAt'] = { $gte: range.start, $lte: range.end };
    } else if (sf === 'cancelled') {
        match.status = { $regex: '^cancelled', $options: 'i' };
        if (range) match.createdAt = { $gte: range.start, $lte: range.end };
    } else if (sf === 'pending') {
        if (range) match.createdAt = { $gte: range.start, $lte: range.end };
        match.status = { $nin: [...DELIVERED_STATUSES], $not: { $regex: '^cancelled', $options: 'i' } };
    } else if (range) {
        match.createdAt = { $gte: range.start, $lte: range.end };
    }

    return match;
};

export const listPorterDriverTrips = async (partnerId, { statusFilter = null, range = null, limit = 1000 } = {}) => {
    const match = buildTripMatch(partnerId, statusFilter, range);
    const docs = await PorterOrder.find(match)
        .sort({ 'deliveryState.deliveredAt': -1, createdAt: -1 })
        .limit(limit)
        .lean();
    return docs.map(toPorterTripDto);
};

export const sumPorterDriverEarnings = async (partnerId, range = null) => {
    const match = {
        'dispatch.deliveryPartnerId': toObjectId(partnerId),
        status: { $in: DELIVERED_STATUSES },
        isDeleted: { $ne: true },
    };
    if (range) match['deliveryState.deliveredAt'] = { $gte: range.start, $lte: range.end };

    const agg = await PorterOrder.aggregate([
        { $match: match },
        {
            $group: {
                _id: null,
                totalEarnings: { $sum: { $ifNull: ['$pricing.driverEarning', 0] } },
                totalTrips: { $sum: 1 },
            },
        },
    ]);

    return {
        totalEarnings: Number(agg?.[0]?.totalEarnings) || 0,
        totalTrips: Number(agg?.[0]?.totalTrips) || 0,
    };
};

export const sumPorterDriverCashCollected = async (partnerId) => {
    const agg = await PorterOrder.aggregate([
        {
            $match: {
                'dispatch.deliveryPartnerId': toObjectId(partnerId),
                status: { $in: DELIVERED_STATUSES },
                'payment.method': 'cash',
                'payment.status': 'paid',
                isDeleted: { $ne: true },
            },
        },
        { $group: { _id: null, cashCollected: { $sum: { $ifNull: ['$pricing.total', 0] } } } },
    ]);
    return Number(agg?.[0]?.cashCollected) || 0;
};

export const countPorterDriverDeliveries = async (partnerId) => PorterOrder.countDocuments({
    'dispatch.deliveryPartnerId': toObjectId(partnerId),
    status: { $in: DELIVERED_STATUSES },
    isDeleted: { $ne: true },
});

export const listPorterDriverPaymentTransactions = async (partnerId, { range = null, limit = 2000 } = {}) => {
    const match = {
        'dispatch.deliveryPartnerId': toObjectId(partnerId),
        status: { $in: DELIVERED_STATUSES },
        isDeleted: { $ne: true },
    };
    if (range) match['deliveryState.deliveredAt'] = { $gte: range.start, $lte: range.end };

    const docs = await PorterOrder.find(match)
        .sort({ 'deliveryState.deliveredAt': -1, createdAt: -1 })
        .select('orderNumber pricing payment deliveryState createdAt')
        .limit(limit)
        .lean();

    return docs.map((o) => {
        const date = o?.deliveryState?.deliveredAt || o?.createdAt || new Date();
        return {
            _id: o._id,
            type: 'payment',
            amount: Number(o?.pricing?.driverEarning) || 0,
            status: 'Completed',
            date,
            createdAt: date,
            orderId: o.orderNumber || String(o._id),
            paymentMethod: o?.payment?.method || 'wallet',
            module: 'porter',
            metadata: {
                orderId: o.orderNumber || String(o._id),
                module: 'porter',
                documentType: 'porter_order',
            },
            description: `Parcel delivery earning - ${o.orderNumber || o._id}`,
        };
    });
};

/**
 * Whether Porter trips should be included for a given module filter.
 * - no module ("all") → include (additive to Food view)
 * - "parcel"/"porter" → include (Porter only)
 * - "food"/"quick" → exclude (Food behaviour unchanged)
 */
export const shouldIncludePorter = (moduleFilter) => {
    const m = String(moduleFilter || '').trim().toLowerCase();
    return m === '' || m === 'parcel' || m === 'porter';
};

/**
 * Whether Food/SellerReturn queries should run for a given module filter.
 * Porter-only views skip Food entirely so the merge stays clean.
 */
export const shouldIncludeFood = (moduleFilter) => {
    const m = String(moduleFilter || '').trim().toLowerCase();
    return m !== 'parcel' && m !== 'porter';
};
