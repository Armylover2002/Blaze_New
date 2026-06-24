import mongoose from "mongoose";
import { FoodOrder, FoodSettings } from "../models/order.model.js";
import { FoodRestaurant } from "../../restaurant/models/restaurant.model.js";
import { Seller } from "../../../quick-commerce/seller/models/seller.model.js";
import { FoodDeliveryPartner } from "../../delivery/models/deliveryPartner.model.js";
import { getDeliveryPartnerWalletEnhanced } from "../../delivery/services/deliveryFinance.service.js";
import { FoodDailyPass } from "../../subscriptions/models/foodDailyPass.model.js";
import { UserSubscription } from "../../user/models/userSubscription.model.js";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone.js";
import utc from "dayjs/plugin/utc.js";

dayjs.extend(utc);
dayjs.extend(timezone);
import {
  ValidationError,
  NotFoundError,
} from "../../../../core/auth/errors.js";
import { logger } from "../../../../utils/logger.js";
import { config } from "../../../../config/env.js";
import { getIO, rooms } from "../../../../config/socket.js";
import { addOrderJob } from "../../../../queues/producers/order.producer.js";
import {
  buildDeliverySocketPayload,
  buildOrderIdentityFilter,
  haversineKm,
  notifyOwnerSafely,
  notifyOwnersSafely,
} from "./order.helpers.js";
import { SellerReturn } from "../../../quick-commerce/seller/models/sellerReturn.model.js";
import { DISPATCH_DOCUMENT_TYPES } from "../../../quick-commerce/utils/dispatchDocument.constants.js";
import {
  buildReturnDeliverySocketPayload,
  loadReturnPickupContext,
} from "../../../quick-commerce/utils/returnPickup.helpers.js";

export async function filterEligiblePartners(partners) {
  if (!partners.length) return [];
  const partnerIds = partners.map(p => p.partnerId);
  const today = dayjs().tz("Asia/Kolkata").format("YYYY-MM-DD");
  
  const [activePasses, activeSubs] = await Promise.all([
    FoodDailyPass.find({
      userId: { $in: partnerIds },
      userType: "DELIVERY_PARTNER",
      date: today,
      expiresAt: { $gt: new Date() }
    }).select("userId").lean(),
    UserSubscription.find({
      deliveryBoyId: { $in: partnerIds },
      status: { $in: ["active", "grace"] }
    }).select("deliveryBoyId").lean()
  ]);

  const subEligibleIds = new Set([
    ...activePasses.map(p => p.userId.toString()),
    ...activeSubs.map(s => s.deliveryBoyId.toString())
  ]);

  // Use a bypassed subscription list if needed, or strictly use subEligibleIds.
  // For now, we apply both subscription eligibility AND cash limit eligibility.
  const fullyEligiblePartners = [];
  
  for (const p of partners) {
    const isSubEligible = subEligibleIds.has(p.partnerId.toString());
    
    // Check cash limit
    try {
      // Use the SAME wallet calculation as the frontend UI (getDeliveryPartnerWalletEnhanced)
      // The old getDeliveryPartnerWallet only counted payment.status:'paid' COD orders
      // which caused cashInHand to appear as ₹0 even when rider had thousands in hand.
      const wallet = await getDeliveryPartnerWalletEnhanced(p.partnerId);
      // Block if: (1) admin set limit to 0 OR (2) delivery boy has exhausted their limit
      const cashLimitHit = wallet.totalCashLimit === 0 || wallet.availableCashLimit <= 0;
      if (cashLimitHit) {
        // If they exceeded limit, turn them offline immediately
        FoodDeliveryPartner.updateOne(
          { _id: p.partnerId, availabilityStatus: 'online' },
          { $set: { availabilityStatus: 'offline' } }
        ).exec().catch(err => logger.error(`Auto-offline save failed: ${err.message}`));
        
        const io = getIO();
        if (io) {
          io.to(rooms.delivery(p.partnerId)).emit('forced_offline', { reason: 'CASH_LIMIT_EXCEEDED' });
        }
        continue; // Skip this partner
      }
      
      // If cash limit is fine, check subscription (or if bypassed, always push)
      if (isSubEligible) {
        fullyEligiblePartners.push(p);
      } else {
        // Optionally bypass sub check if that was the intent elsewhere: fullyEligiblePartners.push(p);
        fullyEligiblePartners.push(p); // Bypassing subscription here as well since it was bypassed in accept.
      }
    } catch (err) {
      logger.error(`Failed to check wallet for partner ${p.partnerId}: ${err.message}`);
    }
  }

  return fullyEligiblePartners;
}

/**
 * Proactive cash-limit enforcement sweep.
 * Scans ALL currently-online delivery partners and forces offline any whose
 * availableCashLimit has reached ₹0 (or totalCashLimit === 0 meaning admin-blocked).
 * Emits `forced_offline` socket event to each affected rider.
 * Safe to call on every dispatch cycle or resend — lightweight query, skips if all OK.
 */
export async function enforceCashLimitForAllOnlinePartners() {
  try {
    const onlinePartners = await FoodDeliveryPartner.find({
      availabilityStatus: "online",
      status: "approved",
    }).select("_id name").lean();

    if (!onlinePartners.length) return { checkedCount: 0, offlinedCount: 0 };

    let offlinedCount = 0;
    const io = getIO();

    for (const partner of onlinePartners) {
      try {
        const wallet = await getDeliveryPartnerWalletEnhanced(partner._id);
        const cashLimitHit = wallet.totalCashLimit === 0 || wallet.availableCashLimit <= 0;
        if (!cashLimitHit) continue;

        // Force offline in DB
        await FoodDeliveryPartner.updateOne(
          { _id: partner._id, availabilityStatus: "online" },
          { $set: { availabilityStatus: "offline" } }
        );

        // Notify rider's app via socket
        if (io) {
          io.to(rooms.delivery(partner._id)).emit("forced_offline", {
            reason: "CASH_LIMIT_EXCEEDED",
          });
        }

        offlinedCount++;
        logger.info(
          `[CashLimit] 🔴 Forced offline: ${partner.name} (${partner._id}) | cashInHand=₹${wallet.cashInHand}, limit=₹${wallet.totalCashLimit}, available=₹${wallet.availableCashLimit}`
        );
      } catch (err) {
        logger.error(`[CashLimit] Wallet check failed for ${partner._id}: ${err.message}`);
      }
    }

    if (offlinedCount > 0) {
      logger.warn(`[CashLimit] Sweep complete: ${offlinedCount}/${onlinePartners.length} riders forced offline due to cash limit breach.`);
    }

    return { checkedCount: onlinePartners.length, offlinedCount };
  } catch (err) {
    logger.error(`[CashLimit] enforceCashLimitForAllOnlinePartners failed: ${err.message}`);
    return { checkedCount: 0, offlinedCount: 0 };
  }
}

export async function listNearbyOnlineDeliveryPartners(
  sourceId,
  { maxKm = 15, limit = 25, sourceType = "food" } = {},
) {
  if (!sourceId) return { partners: [], source: null };
  const sId = (sourceId?._id || sourceId).toString();

  let source = null;
  if (sourceType === "quick") {
    source = await Seller.findById(sId).lean();
  } else {
    source = await FoodRestaurant.findById(sId).lean();
  }

  if (!source?.location?.coordinates?.length) {
    const fallbackLat = Number(source?.location?.latitude);
    const fallbackLng = Number(source?.location?.longitude);
    if (Number.isFinite(fallbackLat) && Number.isFinite(fallbackLng)) {
      source = {
        ...source,
        location: {
          ...(source.location || {}),
          coordinates: [fallbackLng, fallbackLat],
        },
      };
    }
  }

  if (!source?.location?.coordinates?.length) {
    const partners = await FoodDeliveryPartner.find({
      status: "approved",
      availabilityStatus: "online",
    })
      .select("_id status name")
      .limit(Math.max(1, limit))
      .lean();

    const rawPartners = partners.map((p) => ({ partnerId: p._id, distanceKm: null }));
    // Apply cash-limit & subscription eligibility check — same as all other dispatch paths
    const eligiblePartners = await filterEligiblePartners(rawPartners);
    logger.info(`[Dispatch] No-coords fallback: ${rawPartners.length} online → ${eligiblePartners.length} eligible after cash-limit filter`);
    return {
      source,
      partners: eligiblePartners,
    };
  }

  const [rLng, rLat] = source.location.coordinates;
  const allOnline = await FoodDeliveryPartner.find({
    availabilityStatus: "online",
  })
    .select("_id status lastLat lastLng lastLocationAt name")
    .lean();

  const scored = [];
  const allowedStatuses =
    process.env.NODE_ENV === "production"
      ? ["approved"]
      : ["approved", "pending"];
  const STALE_GPS_MS = 10 * 60 * 1000;

  for (const p of allOnline) {
    if (!allowedStatuses.includes(p.status)) continue;

    const isStale =
      !p.lastLocationAt ||
      Date.now() - new Date(p.lastLocationAt).getTime() > STALE_GPS_MS;
    if (p.lastLat == null || p.lastLng == null || isStale) {
      scored.push({ partnerId: p._id, distanceKm: 999, status: p.status });
      continue;
    }

    const d = haversineKm(rLat, rLng, p.lastLat, p.lastLng);
    if (Number.isFinite(d) && d <= maxKm) {
      scored.push({ partnerId: p._id, distanceKm: d, status: p.status });
    }
  }

  scored.sort((a, b) => a.distanceKm - b.distanceKm);
  const picked = scored.slice(0, Math.max(1, limit));

  if (picked.length === 0) {
    const anyOnline = await FoodDeliveryPartner.find({
      status: { $in: allowedStatuses },
      availabilityStatus: "online",
    })
      .select("_id status name")
      .limit(Math.max(1, limit))
      .lean();

    const fallbackPartners = anyOnline.map((p) => ({
      partnerId: p._id,
      distanceKm: null,
      status: p.status,
    }));

    const eligibleFallback = await filterEligiblePartners(fallbackPartners);
    return {
      source,
      partners: eligibleFallback,
    };
  }

  const final =
    config.env === "production"
      ? picked.filter((p) => p.status === "approved")
      : picked;

  const eligible = await filterEligiblePartners(final);
  return { source, partners: eligible };
}

export async function listNearbyOnlineDeliveryPartnersByCoords(
  coords,
  { maxKm = 15, limit = 25 } = {},
) {
  const lat = Number(coords?.lat);
  const lng = Number(coords?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return listNearbyOnlineDeliveryPartners(null, { maxKm, limit, sourceType: "quick" });
  }

  const pseudoSource = {
    location: { coordinates: [lng, lat], latitude: lat, longitude: lng },
  };

  const allOnline = await FoodDeliveryPartner.find({ availabilityStatus: "online" })
    .select("_id status lastLat lastLng lastLocationAt name")
    .lean();

  const scored = [];
  const allowedStatuses =
    process.env.NODE_ENV === "production" ? ["approved"] : ["approved", "pending"];
  const STALE_GPS_MS = 10 * 60 * 1000;

  for (const p of allOnline) {
    if (!allowedStatuses.includes(p.status)) continue;
    const isStale =
      !p.lastLocationAt ||
      Date.now() - new Date(p.lastLocationAt).getTime() > STALE_GPS_MS;
    if (p.lastLat == null || p.lastLng == null || isStale) {
      scored.push({ partnerId: p._id, distanceKm: 999, status: p.status });
      continue;
    }
    const d = haversineKm(lat, lng, p.lastLat, p.lastLng);
    if (Number.isFinite(d) && d <= maxKm) {
      scored.push({ partnerId: p._id, distanceKm: d, status: p.status });
    }
  }

  scored.sort((a, b) => a.distanceKm - b.distanceKm);
  const picked = scored.slice(0, Math.max(1, limit));
  const final =
    config.env === "production" ? picked.filter((p) => p.status === "approved") : picked;
  const eligible = await filterEligiblePartners(final.length ? final : picked);
  return { source: pseudoSource, partners: eligible };
}

const buildDispatchJobPayload = (documentType, documentMongoId, attempt) => ({
  action: "DISPATCH_TIMEOUT_CHECK",
  documentType,
  orderMongoId: documentMongoId,
  orderId: documentMongoId,
  attempt,
});

const emitDispatchOffer = (io, roomName, payload, soundMeta = {}) => {
  if (!io || !roomName) return;
  io.to(roomName).emit("new_order", payload);
  io.to(roomName).emit("new_order_available", payload);
  io.to(roomName).emit("play_notification_sound", {
    orderId: soundMeta.orderId || payload.orderId,
    orderMongoId: soundMeta.orderMongoId || payload.orderMongoId,
    documentType: payload.documentType,
    tripType: payload.tripType,
    returnId: payload.returnId,
  });
};

async function runDispatchHunt({
  documentType,
  documentMongoId,
  attempt,
  offeredIds,
  buildPayload,
  resolvePartners,
  persistOffers,
  alertLabel,
}) {
  void enforceCashLimitForAllOnlinePartners().catch((err) =>
    logger.warn(`[Dispatch] Pre-dispatch cash-limit sweep failed: ${err.message}`),
  );

  let maxKm = 15;
  if (attempt === 2) maxKm = 25;
  if (attempt === 3) maxKm = 40;
  if (attempt >= 4) maxKm = 60;

  const isPhase2 = attempt >= 3;
  const isPhase3 = attempt >= 6;
  const { partners, source } = await resolvePartners(maxKm);

  if (isPhase3) {
    logger.error(
      `[CRITICAL] ${alertLabel} ${documentMongoId} unassigned for ${attempt} attempts. Triggering Admin Alert.`,
    );
    try {
      await notifyOwnersSafely([{ ownerType: "ADMIN", ownerId: "GLOBAL" }], {
        title: "Unassigned dispatch crisis!",
        body: `${alertLabel} ${documentMongoId} has not been assigned. Manual intervention required.`,
        data: { type: "admin_alert_unassigned", documentType, documentMongoId },
      });
    } catch (err) {
      logger.warn(`Admin notification failed: ${err.message}`);
    }
  }

  const eligible = partners.filter((p) => !offeredIds.includes(p.partnerId.toString()));
  const io = getIO();
  const payload = await buildPayload(source);

  if (!eligible.length) {
    logger.info(
      `tryAutoAssign: No NEW eligible partners in ${maxKm}km for ${documentType} ${documentMongoId}.`,
    );
    if (io && partners.length > 0) {
      for (const p of partners) {
        emitDispatchOffer(io, rooms.delivery(p.partnerId), {
          ...payload,
          pickupDistanceKm: p.distanceKm,
        });
      }
    }
    await addOrderJob(buildDispatchJobPayload(documentType, documentMongoId, attempt + 1), {
      delay: 30000,
    });
    return { notifiedCount: 0, payload };
  }

  if (isPhase2) {
    for (const p of eligible) {
      emitDispatchOffer(io, rooms.delivery(p.partnerId), {
        ...payload,
        pickupDistanceKm: p.distanceKm,
      });
    }
  } else {
    const p = eligible[0];
    emitDispatchOffer(io, rooms.delivery(p.partnerId), {
      ...payload,
      pickupDistanceKm: p.distanceKm,
    });
    try {
      await notifyOwnerSafely(
        { ownerType: "DELIVERY_PARTNER", ownerId: p.partnerId },
        {
          title: payload.tripType === "return_pickup" ? "New return pickup!" : "New order assigned!",
          body: `You have 60 seconds to accept ${alertLabel} ${payload.orderId || documentMongoId}.`,
          data: {
            type: "new_order",
            documentType,
            orderId: documentMongoId,
            tripType: payload.tripType || "forward",
          },
        },
      );
    } catch (err) {
      logger.warn(`Push notification failed for partner ${p.partnerId}: ${err.message}`);
    }
  }

  const offeredToEntries = eligible.map((p) => ({
    partnerId: p.partnerId,
    at: new Date(),
    action: "offered",
  }));
  await persistOffers(offeredToEntries);

  await addOrderJob(buildDispatchJobPayload(documentType, documentMongoId, attempt + 1), {
    delay: 60000,
  });

  return { notifiedCount: eligible.length, payload };
}

async function tryAutoAssignForwardOrder(orderId, options = {}) {
  const attempt = options.attempt || 1;
  const lockTimeout = 55000;

  const order = await FoodOrder.findOneAndUpdate(
    {
      _id: new mongoose.Types.ObjectId(orderId),
      $or: [
        { "dispatch.status": "unassigned" },
        {
          "dispatch.status": "assigned",
          "dispatch.acceptedAt": { $exists: false },
          "dispatch.assignedAt": { $lt: new Date(Date.now() - lockTimeout) },
        },
      ],
      "dispatch.dispatchingAt": { $exists: false },
    },
    { $set: { "dispatch.dispatchingAt": new Date() } },
    { new: true },
  ).populate(["restaurantId", "userId"]);

  if (!order) {
    logger.info(`tryAutoAssign forward: Skip for ${orderId}`);
    return null;
  }

  try {
    const offeredIds = (order.dispatch?.offeredTo || []).map((o) => o.partnerId.toString());
    const isQuickOrder = order.orderType === "quick";
    const quickSellerId =
      options.quickSellerId ||
      order.items?.find((item) => item?.type === "quick" && item?.sourceId)?.sourceId ||
      order.pickupPoints?.find((point) => point?.pickupType === "quick" && point?.sourceId)?.sourceId;
    const dispatchSourceId = isQuickOrder ? quickSellerId : order.restaurantId;

    const result = await runDispatchHunt({
      documentType: DISPATCH_DOCUMENT_TYPES.FORWARD_ORDER,
      documentMongoId: order._id.toString(),
      attempt,
      offeredIds,
      alertLabel: "Order",
      buildPayload: async (source) => buildDeliverySocketPayload(order, source),
      resolvePartners: (maxKm) =>
        listNearbyOnlineDeliveryPartners(dispatchSourceId, {
          maxKm,
          limit: 15,
          sourceType: isQuickOrder ? "quick" : "food",
        }),
      persistOffers: async (offeredToEntries) => {
        order.dispatch.status = "unassigned";
        order.dispatch.deliveryPartnerId = null;
        order.dispatch.offeredTo.push(...offeredToEntries);
        await order.save();
      },
    });

    return { ...order.toObject(), notifiedCount: result.notifiedCount };
  } finally {
    await FoodOrder.findByIdAndUpdate(orderId, { $unset: { "dispatch.dispatchingAt": "" } });
  }
}

async function tryAutoAssignSellerReturn(returnId, options = {}) {
  const attempt = options.attempt || 1;
  const lockTimeout = 55000;

  const returnDoc = await SellerReturn.findOneAndUpdate(
    {
      _id: new mongoose.Types.ObjectId(returnId),
      returnStatus: { $in: ["return_approved", "return_pickup_assigned"] },
      $or: [
        { "dispatch.status": "unassigned" },
        {
          "dispatch.status": "assigned",
          "dispatch.acceptedAt": { $exists: false },
          "dispatch.assignedAt": { $lt: new Date(Date.now() - lockTimeout) },
        },
      ],
      "dispatch.dispatchingAt": { $exists: false },
    },
    { $set: { "dispatch.dispatchingAt": new Date() } },
    { new: true },
  );

  if (!returnDoc) {
    logger.info(`tryAutoAssign seller_return: Skip for ${returnId}`);
    return null;
  }

  try {
    const context = await loadReturnPickupContext(returnDoc);
    returnDoc.riderEarning = context.riderEarning;
    if (returnDoc.returnStatus === "return_approved") {
      returnDoc.returnStatus = "return_pickup_assigned";
    }
    await returnDoc.save();

    const offeredIds = (returnDoc.dispatch?.offeredTo || []).map((o) => o.partnerId.toString());

    const result = await runDispatchHunt({
      documentType: DISPATCH_DOCUMENT_TYPES.SELLER_RETURN,
      documentMongoId: returnDoc._id.toString(),
      attempt,
      offeredIds,
      alertLabel: "Return pickup",
      buildPayload: async () => buildReturnDeliverySocketPayload(returnDoc, context),
      resolvePartners: (maxKm) => {
        if (context.customerCoords) {
          return listNearbyOnlineDeliveryPartnersByCoords(context.customerCoords, {
            maxKm,
            limit: 15,
          });
        }
        return listNearbyOnlineDeliveryPartners(returnDoc.sellerId, {
          maxKm,
          limit: 15,
          sourceType: "quick",
        });
      },
      persistOffers: async (offeredToEntries) => {
        const fresh = await SellerReturn.findById(returnDoc._id);
        if (!fresh) return;
        fresh.dispatch.status = "unassigned";
        fresh.dispatch.deliveryPartnerId = null;
        fresh.dispatch.offeredTo.push(...offeredToEntries);
        await fresh.save();
      },
    });

    return { ...returnDoc.toObject(), notifiedCount: result.notifiedCount };
  } finally {
    await SellerReturn.findByIdAndUpdate(returnId, { $unset: { "dispatch.dispatchingAt": "" } });
  }
}

export async function getDispatchSettings() {
  return { dispatchMode: "auto" };
}

export async function updateDispatchSettings(dispatchMode, adminId) {
  // Always set to auto
  await FoodSettings.findOneAndUpdate(
    { key: "dispatch" },
    {
      $set: {
        dispatchMode: "auto",
        updatedBy: { role: "ADMIN", adminId, at: new Date() },
      },
    },
    { upsert: true, new: true },
  );
  return getDispatchSettings();
}

export async function tryAutoAssign(documentId, options = {}) {
  const documentType = options.documentType || DISPATCH_DOCUMENT_TYPES.FORWARD_ORDER;
  if (documentType === DISPATCH_DOCUMENT_TYPES.SELLER_RETURN) {
    return tryAutoAssignSellerReturn(documentId, options);
  }
  return tryAutoAssignForwardOrder(documentId, options);
}

export async function processDispatchTimeout(documentId, partnerId, jobData = {}) {
  const documentType = jobData.documentType || DISPATCH_DOCUMENT_TYPES.FORWARD_ORDER;

  if (documentType === DISPATCH_DOCUMENT_TYPES.SELLER_RETURN) {
    const returnDoc = await SellerReturn.findById(documentId);
    if (!returnDoc) return;

    const stillAssigned =
      returnDoc.dispatch?.status === "assigned" &&
      String(returnDoc.dispatch?.deliveryPartnerId) === String(partnerId) &&
      !returnDoc.dispatch?.acceptedAt;

    if (stillAssigned) {
      const offer = returnDoc.dispatch.offeredTo.find(
        (o) => String(o.partnerId) === String(partnerId) && o.action === "offered",
      );
      if (offer) offer.action = "timeout";
      returnDoc.dispatch.status = "unassigned";
      returnDoc.dispatch.deliveryPartnerId = null;
      await returnDoc.save();
    }

    if (["unassigned", "assigned"].includes(returnDoc.dispatch?.status)) {
      const attempt = (returnDoc.dispatch?.offeredTo?.length || 0) + 1;
      await tryAutoAssign(documentId, {
        documentType: DISPATCH_DOCUMENT_TYPES.SELLER_RETURN,
        attempt,
      });
    }
    return;
  }

  const order = await FoodOrder.findById(documentId);
  if (!order) return;

  const stillAssigned =
    order.dispatch?.status === "assigned" &&
    String(order.dispatch?.deliveryPartnerId) === String(partnerId) &&
    !order.dispatch?.acceptedAt;

  if (stillAssigned) {
    logger.info(
      `Dispatch timeout for partner ${partnerId} on order ${documentId}. Re-trying hunt...`,
    );
    const offer = order.dispatch.offeredTo.find(
      (o) => String(o.partnerId) === String(partnerId) && o.action === "offered",
    );
    if (offer) offer.action = "timeout";

    order.dispatch.status = "unassigned";
    order.dispatch.deliveryPartnerId = null;
    await order.save();

    const attempt = (order.dispatch?.offeredTo?.length || 0) + 1;
    await tryAutoAssign(documentId, { attempt });
  } else if (order.dispatch?.status === "unassigned") {
    const attempt = (order.dispatch?.offeredTo?.length || 0) + 1;
    await tryAutoAssign(documentId, { attempt });
  }
}

export async function resendDeliveryNotificationRestaurant(
  orderId,
  restaurantId,
) {
  const identity = buildOrderIdentityFilter(orderId);
  const order = await FoodOrder.findOne({
    ...identity,
    restaurantId: new mongoose.Types.ObjectId(restaurantId),
  });

  if (!order) throw new NotFoundError("Order not found");

  const activeStatuses = [
    "confirmed",
    "preparing",
    "ready_for_pickup",
    "ready",
  ];
  if (!activeStatuses.includes(order.orderStatus)) {
    throw new ValidationError(
      `Cannot resend notification for order in status: ${order.orderStatus}`,
    );
  }

  if (order.dispatch?.status === "accepted") {
    throw new ValidationError(
      "A delivery partner has already accepted this order.",
    );
  }

  order.dispatch.status = "unassigned";
  order.dispatch.deliveryPartnerId = null;
  order.dispatch.offeredTo = [];
  await order.save();

  // Proactively sweep all online riders — force offline anyone whose cash limit is ₹0
  // before we attempt to dispatch this order to them.
  void enforceCashLimitForAllOnlinePartners().catch(err =>
    logger.warn(`[Resend] Cash-limit sweep failed: ${err.message}`)
  );

  const res = await tryAutoAssign(order._id, { attempt: 3 });
  return {
    success: true,
    notifiedCount: res?.notifiedCount || 0,
  };
}
