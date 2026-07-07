import mongoose from 'mongoose';
import { FoodDeliveryPartner } from '../../../food/delivery/models/deliveryPartner.model.js';
import { PorterVehicle } from '../../models/porterVehicle.model.js';
import { PorterOrder } from '../models/porterOrder.model.js';
import { getIO, rooms } from '../../../../config/socket.js';
import { logger } from '../../../../utils/logger.js';
import { filterEligiblePartners } from '../../../food/orders/services/order-dispatch.service.js';
import {
    PORTER_DISPATCH_RADII_KM,
    PORTER_SOCKET_EVENTS,
    PORTER_DISPATCH_DOCUMENT_TYPE,
    PORTER_SERVICE_KEY,
} from '../constants/porterDispatch.constants.js';
import {
    PORTER_ORDER_STATUS,
    PORTER_DISPATCH_STATUS,
} from '../constants/porterOrderStatus.constants.js';
import { haversineKm, mapPorterOrderForDriver } from '../utils/porterOrder.helpers.js';
import { getBusyPorterPartnerIds } from '../utils/porter-order-transition.util.js';
import { FoodAdmin } from '../../../../core/admin/admin.model.js';
import { notifyPorterNewOrderToDriver } from './porter-notification.service.js';

const STALE_GPS_MS = 10 * 60 * 1000;
const allowedStatuses = process.env.NODE_ENV === 'production' ? ['approved'] : ['approved', 'pending'];

export function partnerSupportsParcel(partner, orderVehicleId) {
    const vehicles = Array.isArray(partner.driverVehicles) ? partner.driverVehicles : [];
    if (!vehicles.length) {
        return partner.vehicleType ? { ok: false, reason: 'no_driver_vehicles' } : { ok: false, reason: 'no_vehicles' };
    }

    const activeId = partner.activeVehicleId ? String(partner.activeVehicleId) : null;
    const activeVehicle = activeId
        ? vehicles.find((v) => String(v.id || v._id || v.porterVehicleId) === activeId)
        : vehicles.find((v) => v.isDefault) || vehicles[0];

    if (!activeVehicle) return { ok: false, reason: 'no_active_vehicle' };
    if (activeVehicle.status === 'inactive') return { ok: false, reason: 'inactive_vehicle' };

    const services = Array.isArray(activeVehicle.supportedServices) ? activeVehicle.supportedServices : [];
    if (!services.includes(PORTER_SERVICE_KEY)) {
        return { ok: false, reason: 'service_not_supported' };
    }

    if (orderVehicleId) {
        const orderVeh = String(orderVehicleId);
        const driverVeh = activeVehicle.porterVehicleId ? String(activeVehicle.porterVehicleId) : null;
        if (driverVeh && driverVeh !== orderVeh) {
            return { ok: false, reason: 'vehicle_mismatch' };
        }
    }

    return { ok: true, activeVehicle };
}

async function listNearbyPorterPartners({ lat, lng, maxKm, orderVehicleId, rejectedIds = [] }) {
    const rejected = new Set(rejectedIds.map(String));
    const busyIds = await getBusyPorterPartnerIds(PorterOrder);

    const allOnline = await FoodDeliveryPartner.find({
        availabilityStatus: 'online',
        status: { $in: allowedStatuses },
        isActive: { $ne: false },
        isDeleted: { $ne: true },
    })
        .select('_id status name lastLat lastLng lastLocationAt driverVehicles activeVehicleId vehicleType')
        .lean();

    const scored = [];
    for (const p of allOnline) {
        if (rejected.has(String(p._id))) continue;
        if (busyIds.has(String(p._id))) continue;

        const support = partnerSupportsParcel(p, orderVehicleId);
        if (!support.ok) continue;

        const isStale = !p.lastLocationAt || Date.now() - new Date(p.lastLocationAt).getTime() > STALE_GPS_MS;
        if (p.lastLat == null || p.lastLng == null || isStale) continue;

        const d = haversineKm(lat, lng, p.lastLat, p.lastLng);
        if (!Number.isFinite(d) || d > maxKm) continue;

        scored.push({
            partnerId: p._id,
            distanceKm: d,
            status: p.status,
            activeVehicleId: support.activeVehicle?.id || support.activeVehicle?.porterVehicleId,
        });
    }

    scored.sort((a, b) => a.distanceKm - b.distanceKm);
    const eligible = await filterEligiblePartners(scored);
    return eligible;
}

function buildPorterSocketPayload(order, partnerDistanceKm) {
    const mapped = mapPorterOrderForDriver(order);
    return {
        ...mapped,
        documentType: PORTER_DISPATCH_DOCUMENT_TYPE,
        module: 'parcel',
        distanceKm: partnerDistanceKm,
        earnings: order.pricing?.driverEarning ?? 0,
        pickupLocation: order.pickup,
        dropLocation: order.delivery,
        customerLocation: order.delivery,
        restaurantLocation: order.pickup,
    };
}

export async function emitPorterOrderToPartner(order, partnerId, distanceKm) {
    const io = getIO();
    if (!io) return;

    const payload = buildPorterSocketPayload(order, distanceKm);
    io.to(rooms.delivery(partnerId)).emit(PORTER_SOCKET_EVENTS.ORDER_AVAILABLE, payload);
    io.to(rooms.delivery(partnerId)).emit(PORTER_SOCKET_EVENTS.PLAY_SOUND, {
        documentType: PORTER_DISPATCH_DOCUMENT_TYPE,
        module: 'parcel',
        orderId: String(order._id),
    });
    void notifyPorterNewOrderToDriver(partnerId, order);
}

export async function emitPorterOrderCancelled(order, userId, partnerId) {
    const io = getIO();
    if (!io) return;

    const payload = {
        orderId: String(order._id),
        orderNumber: order.orderNumber,
        status: order.status,
        documentType: PORTER_DISPATCH_DOCUMENT_TYPE,
        cancelled: true,
    };

    if (userId) io.to(rooms.user(userId)).emit(PORTER_SOCKET_EVENTS.ORDER_CANCELLED, payload);
    if (partnerId) io.to(rooms.delivery(partnerId)).emit(PORTER_SOCKET_EVENTS.ORDER_CANCELLED, payload);
    io.to(rooms.tracking(String(order._id))).emit(PORTER_SOCKET_EVENTS.ORDER_CANCELLED, payload);
}

export async function emitPorterOrderStatus(order, userId, partnerId) {
    const io = getIO();
    if (!io) return;

    const payload = {
        orderId: String(order._id),
        orderNumber: order.orderNumber,
        status: order.status,
        dispatch: order.dispatch,
        deliveryState: order.deliveryState,
        documentType: PORTER_DISPATCH_DOCUMENT_TYPE,
        module: 'parcel',
    };

    if (userId) io.to(rooms.user(userId)).emit(PORTER_SOCKET_EVENTS.ORDER_STATUS, payload);
    if (partnerId) io.to(rooms.delivery(partnerId)).emit(PORTER_SOCKET_EVENTS.ORDER_STATUS, payload);
    io.to(rooms.tracking(String(order._id))).emit('order-status-update', payload);

    try {
        const admins = await FoodAdmin.find({ isActive: true }).select('_id').lean();
        for (const admin of admins) {
            io.to(rooms.admin(admin._id)).emit(PORTER_SOCKET_EVENTS.ADMIN_ORDER_UPDATE, payload);
        }
    } catch {
        // non-blocking admin socket fan-out
    }
}

export async function startPorterDispatch(orderId, { attempt = 0 } = {}) {
    const order = await PorterOrder.findById(orderId);
    if (!order || order.isDeleted) return null;

    if (order.status !== PORTER_ORDER_STATUS.SEARCHING_PARTNER) return order;

    const lat = order.pickup?.lat;
    const lng = order.pickup?.lng;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        logger.warn(`[PorterDispatch] Order ${order.orderNumber} missing pickup coordinates`);
        return order;
    }

    const radiusIndex = Math.min(attempt, PORTER_DISPATCH_RADII_KM.length - 1);
    const maxKm = PORTER_DISPATCH_RADII_KM[radiusIndex];
    const rejectedIds = order.dispatch?.rejectedPartnerIds || [];

    const partners = await listNearbyPorterPartners({
        lat,
        lng,
        maxKm,
        orderVehicleId: order.vehicleId,
        rejectedIds,
    });

    logger.info(`[PorterDispatch] Order ${order.orderNumber} attempt=${attempt} maxKm=${maxKm} partners=${partners.length}`);

    if (!partners.length) {
        if (attempt < PORTER_DISPATCH_RADII_KM.length - 1) {
            setTimeout(() => startPorterDispatch(orderId, { attempt: attempt + 1 }), 8000);
        }
        return order;
    }

    const top = partners.slice(0, 5);
    for (const p of top) {
        await emitPorterOrderToPartner(order, p.partnerId, p.distanceKm);
    }

    return order;
}

export async function assignPorterOrderToPartner(orderId, partnerId, activeVehicleId) {
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
                    status: PORTER_ORDER_STATUS.ASSIGNED,
                    'dispatch.status': PORTER_DISPATCH_STATUS.ASSIGNED,
                    'dispatch.deliveryPartnerId': partnerId,
                    'dispatch.activeVehicleId': activeVehicleId ? String(activeVehicleId) : null,
                    'dispatch.assignedAt': new Date(),
                },
            },
            { new: true, session },
        );

        if (!order) {
            await session.abortTransaction();
            return null;
        }

        await session.commitTransaction();

        const io = getIO();
        if (io) {
            io.to(rooms.delivery(partnerId)).emit(PORTER_SOCKET_EVENTS.ORDER_CLAIMED, {
                orderId: String(order._id),
                documentType: PORTER_DISPATCH_DOCUMENT_TYPE,
            });
        }

        return order;
    } catch (err) {
        await session.abortTransaction();
        throw err;
    } finally {
        session.endSession();
    }
}

export async function hydrateDriverVehiclesFromCatalog(partner) {
    const vehicles = Array.isArray(partner.driverVehicles) ? partner.driverVehicles : [];
    if (!vehicles.length) return [];

    const catalogIds = vehicles
        .map((v) => v.porterVehicleId)
        .filter((id) => id && mongoose.Types.ObjectId.isValid(String(id)));

    const catalog = catalogIds.length
        ? await PorterVehicle.find({ _id: { $in: catalogIds }, isDeleted: { $ne: true } })
            .select({ name: 1, vehicleCode: 1, supportedServices: 1, icon: 1 })
            .lean()
        : [];

    const catalogMap = new Map(catalog.map((c) => [String(c._id), c]));

    return vehicles.map((v, idx) => {
        const cat = v.porterVehicleId ? catalogMap.get(String(v.porterVehicleId)) : null;
        const id = v.id || v._id || `veh-${idx}`;
        return {
            id: String(id),
            porterVehicleId: v.porterVehicleId ? String(v.porterVehicleId) : null,
            vehicleCode: v.vehicleCode || v.vehicleType || cat?.vehicleCode || '',
            vehicleName: v.vehicleName || cat?.name || 'Vehicle',
            vehicleNumber: v.vehicleNumber || '',
            model: v.model || '',
            supportedServices: Array.isArray(v.supportedServices) && v.supportedServices.length
                ? v.supportedServices
                : (cat?.supportedServices || []),
            status: v.status || 'active',
            isDefault: Boolean(v.isDefault),
            iconUrl: cat?.iconUrl || cat?.icon || null,
        };
    });
}
