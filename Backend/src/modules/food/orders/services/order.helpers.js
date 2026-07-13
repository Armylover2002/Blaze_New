import mongoose from 'mongoose';
import { logger } from '../../../../utils/logger.js';
import {
  sendNotificationToOwner,
  sendNotificationToOwners,
} from "../../../../core/notifications/firebase.service.js";
import { getIO, rooms } from '../../../../config/socket.js';
import { addOrderJob } from '../../../../queues/producers/order.producer.js';

export function enqueueOrderEvent(action, payload = {}) {
  try {
    void addOrderJob({ action, ...payload }).catch((err) => {
      logger.warn(`BullMQ enqueue order event failed: ${action} - ${err?.message || err}`);
    });
  } catch (err) {
    logger.warn(`BullMQ enqueue order event failed (sync): ${action} - ${err?.message || err}`);
  }

  // Synchronous fallback in development or when BullMQ is disabled
  if (process.env.BULLMQ_ENABLED !== 'true') {
    if ([
      'delivery_completed',
      'order_cancelled',
      'order_cancelled_by_user',
      'order_cancelled_by_watchdog',
      'payment_verified',
    ].includes(action)) {
      import('../../../../queues/processors/payment.processor.js')
        .then(({ processPaymentJob }) => {
          logger.info(`[BullMQ:fallback] Running sync payment processor for action=${action}`);
          processPaymentJob({
            data: { action, ...payload },
            id: `sync_${action}_${Date.now()}`
          }).catch((err) => {
            logger.error(`[BullMQ:fallback] Sync payment processor failed: ${err.message}`);
          });
        })
        .catch((err) => {
          logger.error(`[BullMQ:fallback] Failed to import payment processor: ${err.message}`);
        });
    }
  }
}


export function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/** Road/travel distance in km (Google Distance Matrix with Haversine fallback). */
export async function roadDistanceKm(lat1, lon1, lat2, lon2) {
  const { getRoadDistanceKmValue } = await import('../../../../services/roadDistance.service.js');
  return getRoadDistanceKmValue(
    { lat: lat1, lng: lon1 },
    { lat: lat2, lng: lon2 },
  );
}

/** Full road distance result including whether the value is an estimate. */
export async function roadDistanceDetails(lat1, lon1, lat2, lon2) {
  const { getRoadDistanceKm } = await import('../../../../services/roadDistance.service.js');
  return getRoadDistanceKm(
    { lat: lat1, lng: lon1 },
    { lat: lat2, lng: lon2 },
  );
}

export function generateFourDigitDeliveryOtp() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export function shouldShowDeliveryPartnerPhone(order) {
  if (!order) return false;
  const status = String(order.orderStatus || order.status || "").toLowerCase();
  const deliveryStatus = String(order.deliveryState?.status || "").toLowerCase();

  // Robust fallback: if order is already picked up or delivered, show phone number anyway
  const isPostPickup = ["picked_up", "reached_drop", "delivered"].includes(status) || 
                       deliveryStatus === "picked_up" || 
                       deliveryStatus === "reached_drop";
                       
  if (isPostPickup) return true;

  const reachedPickup = deliveryStatus === "reached_pickup" || status === "reached_pickup";
  const photoUploaded = !!order.deliveryState?.billImageUrl;

  return reachedPickup && photoUploaded;
}

export function sanitizeOrderForExternal(orderDoc, roleContext = "") {
  const o = orderDoc?.toObject ? orderDoc.toObject() : { ...(orderDoc || {}) };
  delete o.deliveryOtp;
  const dv = o.deliveryVerification;
  if (dv && dv.dropOtp != null) {
    const d = dv.dropOtp;
    o.deliveryVerification = {
      ...dv,
      dropOtp: {
        required: Boolean(d.required),
        verified: Boolean(d.verified),
      },
    };
  }
  o.orderMongoId = (o._id || orderDoc?._id || "").toString();
  // Ensure orderId field for UI always contains the pretty ID
  o.orderId = o.orderId || o.order_id || o.orderMongoId;

  // Mask Delivery Partner phone for Restaurant panel
  if (String(roleContext).toUpperCase() === "RESTAURANT") {
    if (!shouldShowDeliveryPartnerPhone(o)) {
      if (o.dispatch?.deliveryPartnerId && typeof o.dispatch.deliveryPartnerId === "object") {
        o.dispatch.deliveryPartnerId = {
          ...o.dispatch.deliveryPartnerId,
          phone: "Hidden until photo upload",
        };
      }
      if (o.deliveryPartnerId && typeof o.deliveryPartnerId === "object") {
        o.deliveryPartnerId = {
          ...o.deliveryPartnerId,
          phone: "Hidden until photo upload",
        };
      }
      if (Array.isArray(o.dispatchPlan?.legs)) {
        o.dispatchPlan.legs = o.dispatchPlan.legs.map((leg) => {
          if (leg?.deliveryPartnerId && typeof leg.deliveryPartnerId === "object") {
            return {
              ...leg,
              deliveryPartnerId: {
                ...leg.deliveryPartnerId,
                phone: "Hidden until photo upload",
              },
            };
          }
          return leg;
        });
      }
    }
  }

  return o;
}

export function emitDeliveryDropOtpToUser(order, plainOtp) {
  try {
    const io = getIO();
    if (!io || !plainOtp) return;

    const payload = {
      orderMongoId: order._id?.toString?.(),
      orderId: order.orderId || order.order_id || order._id?.toString?.(),
      otp: plainOtp,
      message:
        "Share this OTP with your delivery partner to hand over the order.",
    };

    // Emit to specific user room if logged in
    if (order.userId) {
      io.to(rooms.user(order.userId)).emit("delivery_drop_otp", payload);
    }

    // Always emit to tracking room (covers guests and active trackers)
    const orderId = order.orderId || order.order_id || order._id?.toString?.();
    if (orderId) {
      io.to(rooms.tracking(orderId)).emit("delivery_drop_otp", payload);
    }
  } catch (e) {
    logger.warn(`emitDeliveryDropOtpToUser failed: ${e?.message || e}`);
  }
}

export async function notifyOwnersSafely(targets, payload) {
  try {
    await sendNotificationToOwners(targets, payload);
  } catch (error) {
    logger.warn(`FCM notification failed: ${error?.message || error}`);
  }
}

export async function notifyOwnerSafely(target, payload) {
  try {
    await sendNotificationToOwner({ ...target, payload });
  } catch (error) {
    logger.warn(`FCM notification failed: ${error?.message || error}`);
  }
}

export function buildOrderIdentityFilter(orderIdOrMongoId) {
  const raw = String(orderIdOrMongoId || "").trim();
  if (!raw) return null;
  if (mongoose.isValidObjectId(raw))
    return { _id: new mongoose.Types.ObjectId(raw) };
  
  // Search BOTH underscore and camelCase variants for robust lookup
  return { 
    $or: [
        { order_id: raw },
        { orderId: raw }
    ]
  };
}

export function toGeoPoint(lat, lng) {
  if (lat == null || lng == null) return undefined;
  const a = Number(lat);
  const b = Number(lng);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return undefined;
  return { type: "Point", coordinates: [b, a] };
}

export function isTerminalOrderStatus(status) {
  const s = String(status || "").trim().toLowerCase();
  return (
    s === "cancelled_by_user" ||
    s === "cancelled_by_restaurant" ||
    s === "cancelled_by_admin" ||
    s === "cancelled_by_system"
  );
}

export function pushStatusHistory(order, { byRole, byId, from, to, note = "" }) {
  const fromNorm = String(from || "").trim();
  const toNorm = String(to || "").trim();
  if (!toNorm || fromNorm === toNorm) return;
  order.statusHistory.push({
    at: new Date(),
    byRole,
    byId: byId || undefined,
    from: fromNorm,
    to: toNorm,
    note,
  });
}

export function normalizeOrderForClient(orderDoc) {
  const order = orderDoc?.toObject ? orderDoc.toObject() : orderDoc || {};
  const mongoId = (order._id || orderDoc?._id || "").toString();
  const displayId = order.orderId || order.order_id || mongoId;
  return {
    ...order,
    orderMongoId: mongoId,
    orderId: displayId,
    status: order?.orderStatus || order?.status || "",
    deliveredAt:
      order?.deliveryState?.deliveredAt || order?.deliveredAt || null,
    deliveryPartnerId:
      order?.dispatch?.deliveryPartnerId || order?.deliveryPartnerId || null,
    rating: order?.ratings?.restaurant?.rating ?? order?.rating ?? null,
    deliveryState: {
      ...(order?.deliveryState || {}),
      currentLocation: order?.lastRiderLocation?.coordinates?.length >= 2 ? {
        lat: order.lastRiderLocation.coordinates[1],
        lng: order.lastRiderLocation.coordinates[0]
      } : (order?.deliveryState?.currentLocation || null)
    }
  };
}

export async function applyAggregateRating(model, entityId, newRating) {
  if (!entityId) return;
  const doc = await model.findById(entityId).select("rating totalRatings");
  if (!doc) return;

  const totalRatings = Number(doc.totalRatings || 0);
  const currentAverage = Number(doc.rating || 0);
  const nextTotal = totalRatings + 1;
  const nextAverage = Number(
    ((currentAverage * totalRatings + Number(newRating)) / nextTotal).toFixed(1),
  );

  doc.totalRatings = nextTotal;
  doc.rating = nextAverage;
  await doc.save();
}

export function buildDeliverySocketPayload(orderDoc, restaurantDoc = null) {
  const order = orderDoc?.toObject ? orderDoc.toObject() : orderDoc || {};
  const isQuickOrder = String(order?.orderType || '').trim().toLowerCase() === 'quick';
  const restaurant = restaurantDoc || order?.restaurantId || null;
  const seller = isQuickOrder ? restaurant : null;
  const restaurantLocation = restaurant?.location || {};
  const deliveryAddress = order?.deliveryAddress || {};
  const storeAddressText = [
    restaurantLocation?.formattedAddress,
    restaurantLocation?.address,
    restaurant?.shopInfo?.formattedAddress,
    restaurant?.shopInfo?.address,
    restaurant?.addressLine1,
  ]
    .map((part) => String(part || '').trim())
    .find(Boolean) || '';

  const sellerPickupLat = restaurantLocation?.latitude ??
    (Array.isArray(restaurantLocation?.coordinates) ? restaurantLocation.coordinates[1] : undefined);
  const sellerPickupLng = restaurantLocation?.longitude ??
    (Array.isArray(restaurantLocation?.coordinates) ? restaurantLocation.coordinates[0] : undefined);

  let pickupPoints = Array.isArray(order?.pickupPoints) ? [...order.pickupPoints] : [];
  if (isQuickOrder && seller?._id) {
    const quickPickupPoint = {
      legId: `quick:${seller._id}`,
      pickupType: 'quick',
      sourceId: String(seller._id),
      sourceName: String(seller.shopName || seller.name || 'Store').trim(),
      address: storeAddressText,
      phone: String(seller.phone || '').trim(),
      ...(Number.isFinite(Number(sellerPickupLat)) && Number.isFinite(Number(sellerPickupLng))
        ? {
            location: {
              coordinates: [Number(sellerPickupLng), Number(sellerPickupLat)],
              lat: Number(sellerPickupLat),
              lng: Number(sellerPickupLng),
              address: storeAddressText,
              formattedAddress: storeAddressText,
            },
          }
        : {}),
    };
    if (!pickupPoints.length) pickupPoints = [quickPickupPoint];
  }

  const customerAddressParts = [
    deliveryAddress.formattedAddress,
    deliveryAddress.street || deliveryAddress.address,
    deliveryAddress.additionalDetails,
    deliveryAddress.city,
    deliveryAddress.state,
    deliveryAddress.zipCode,
  ]
    .map((v) => String(v || '').trim())
    .filter((part) => part && part.toUpperCase() !== 'NA');

  const customerLocation = Array.isArray(deliveryAddress?.location?.coordinates)
    && deliveryAddress.location.coordinates.length >= 2
    ? {
        lat: Number(deliveryAddress.location.coordinates[1]),
        lng: Number(deliveryAddress.location.coordinates[0]),
      }
    : (Number.isFinite(Number(deliveryAddress?.location?.lat)) && Number.isFinite(Number(deliveryAddress?.location?.lng))
        ? {
            lat: Number(deliveryAddress.location.lat),
            lng: Number(deliveryAddress.location.lng),
          }
        : null);

  const primaryQuickPickup = pickupPoints.find((point) => point?.pickupType === 'quick') || pickupPoints[0] || null;

  const payload = {
    orderMongoId:
      orderDoc?._id?.toString?.() || order?._id?.toString?.() || order?._id,
    orderId: order?.orderId || order?.order_id || order?._id?.toString?.(),
    orderType: order?.orderType || "food",
    status: orderDoc?.orderStatus || order?.orderStatus,
    items: order?.items || [],
    pickupPoints,
    pricing: order?.pricing,
    total: order?.pricing?.total,
    payment: order?.payment,
    paymentMethod: order?.payment?.method,
    restaurantId:
      restaurant?._id?.toString?.() ||
      order?.restaurantId?._id?.toString?.() ||
      order?.restaurantId?.toString?.() ||
      order?.restaurantId,
    restaurantName: seller?.shopName || restaurant?.shopName || restaurant?.restaurantName || order?.restaurantName || "",
    restaurantAddress: storeAddressText,
    restaurantPhone: restaurant?.phone || "",
    restaurantLocation: {
      latitude: sellerPickupLat,
      longitude: sellerPickupLng,
      address: storeAddressText,
      area: restaurantLocation?.area || restaurant?.area || "",
      city: restaurantLocation?.city || restaurant?.city || "",
      state: restaurantLocation?.state || restaurant?.state || "",
      ...(Array.isArray(restaurantLocation?.coordinates) ? { coordinates: restaurantLocation.coordinates } : {}),
    },
    deliveryAddress: order?.deliveryAddress,
    customerAddress: [...new Set(customerAddressParts)].join(', '),
    customerLocation,
    customerName: order?.customerName || deliveryAddress?.name || deliveryAddress?.fullName || order?.userId?.name || "",
    customerPhone: order?.customerPhone || deliveryAddress?.phone || order?.userId?.phone || "",
    userName: order?.customerName || deliveryAddress?.name || deliveryAddress?.fullName || order?.userId?.name || "",
    userPhone: order?.customerPhone || deliveryAddress?.phone || order?.userId?.phone || "",
    note: order?.note || "",
    riderEarning: order?.riderEarning || 0,
    earnings: order?.riderEarning || order?.pricing?.deliveryFee || 0,
    deliveryFee: order?.pricing?.deliveryFee || 0,
    deliveryFleet: order?.deliveryFleet,
    dispatch: order?.dispatch,
    createdAt: order?.createdAt,
    updatedAt: order?.updatedAt,
  };

  if (isQuickOrder && seller?._id) {
    payload.orderType = 'quick';
    payload.storeId = String(seller._id);
    payload.sellerId = String(seller._id);
    payload.storeName = String(seller.shopName || seller.name || 'Store').trim();
    payload.sellerName = payload.storeName;
    payload.storeAddress = storeAddressText;
    payload.sellerAddress = storeAddressText;
    payload.storePhone = String(seller.phone || '').trim();
    payload.sellerPhone = payload.storePhone;
    payload.seller = {
      _id: seller._id,
      shopName: seller.shopName || seller.name || 'Store',
      name: seller.name || seller.shopName || 'Store',
      phone: seller.phone || '',
      location: restaurantLocation,
    };
    if (primaryQuickPickup) {
      payload.dispatchLeg = {
        legId: primaryQuickPickup.legId || `quick:${seller._id}`,
        pickupType: 'quick',
        sourceId: String(primaryQuickPickup.sourceId || seller._id),
        sourceName: primaryQuickPickup.sourceName || payload.storeName,
        address: primaryQuickPickup.address || storeAddressText,
        phone: primaryQuickPickup.phone || payload.storePhone,
        location: primaryQuickPickup.location || payload.restaurantLocation,
      };
    }
  }

  return payload;
}

export function canExposeOrderToRestaurant(orderLike) {
  const method = String(orderLike?.payment?.method || "").toLowerCase();
  const status = String(orderLike?.payment?.status || "").toLowerCase();
  if (["cash", "wallet"].includes(method)) return true;
  return ["paid", "authorized", "captured", "settled"].includes(status);
}

export async function notifyRestaurantNewOrder(orderDoc) {
  try {
    if (!orderDoc || !canExposeOrderToRestaurant(orderDoc)) return;

    const io = getIO();
    if (io) {
      const payload = {
        ...orderDoc.toObject(),
        orderMongoId: orderDoc._id?.toString?.() || undefined,
        orderId: orderDoc.order_id || orderDoc._id?.toString?.(),
      };
      logger.info(
        `[RestaurantOrders] Emitting new_order to ${rooms.restaurant(orderDoc.restaurantId)} for order ${orderDoc._id?.toString?.() || ''}`,
      );
      io.to(rooms.restaurant(orderDoc.restaurantId)).emit("new_order", payload);
    }

    await notifyOwnersSafely(
      [{ ownerType: "RESTAURANT", ownerId: orderDoc.restaurantId }],
      {
        title: "New order received",
        body: `Order #${orderDoc.order_id || orderDoc._id} is waiting for review.`,
        data: {
          type: "new_order",
          orderId: orderDoc._id.toString(),
          orderMongoId: orderDoc._id?.toString?.() || "",
          link: `/restaurant/orders/${orderDoc._id?.toString?.() || ""}`,
        },
      },
    );
  } catch {
    // Do not block order/payment flow if notification fails.
  }
}

export const STATUS_PRIORITY = {
  created: 10,
  confirmed: 20,
  preparing: 30,
  ready_for_pickup: 40,
  reached_pickup: 50,
  picked_up: 60,
  reached_drop: 70,
  delivered: 80,
  cancelled_by_user: 100,
  cancelled_by_restaurant: 100,
  cancelled_by_admin: 100,
};

/**
 * Returns true if the next status is a valid forward progression from the current status.
 * Prevents "reversing" order status (e.g. from Preparing back to Created).
 */
export function isStatusAdvance(current, next) {
  // If current status is missing, it's effectively 'created' or start of flow
  if (!current) return true;
  
  const currentPrio = STATUS_PRIORITY[current] || 0;
  const nextPrio = STATUS_PRIORITY[next] || 0;

  // Terminal states (100) cannot transition to anything else
  if (currentPrio >= 100) return false;
  
  // Delivered (80) cannot transition to anything (except maybe cancellation if allowed, but here we say no)
  if (currentPrio === 80) return false;

  // Special case: Cancellation is almost always an advance unless already delivered
  if (nextPrio === 100 && currentPrio < 80) return true;

  return nextPrio > currentPrio;
}
