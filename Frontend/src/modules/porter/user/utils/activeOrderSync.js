import { resolveTrackingStage } from "../constants/booking";
import { mapPartnerFromOrder } from "./orderMapper";
import {
  PORTER_SEARCHING_STATUSES,
  PORTER_SCHEDULED_STATUS,
} from "../constants/booking";

/** Stop page-level /active polling once the order leaves search/wait phases. */
export const PORTER_ACTIVE_POLL_STOP_STATUSES = new Set([
  "assigned",
  "partner_accepted",
  "en_route_pickup",
  "at_pickup",
  "picked_up",
  "in_transit",
  "at_drop",
  "delivered",
  "completed",
  "cancelled_by_user",
  "cancelled_by_admin",
  "cancelled_by_driver",
  "failed",
]);

/** Statuses where partner profile details are needed from a full GET /active. */
const PARTNER_DETAIL_STATUSES = new Set([
  "assigned",
  "partner_accepted",
  "en_route_pickup",
  "at_pickup",
]);

/**
 * Adaptive search poll delay (ms).
 * 0–20s → 5s | 20–60s → 10s | 60s+ → 20s
 */
export function getAdaptiveSearchPollDelayMs(elapsedMs) {
  const elapsed = Math.max(0, Number(elapsedMs) || 0);
  if (elapsed < 20_000) return 5_000;
  if (elapsed < 60_000) return 10_000;
  return 20_000;
}

export function isSearchingPartnerStatus(status) {
  return PORTER_SEARCHING_STATUSES.includes(String(status || "").toLowerCase());
}

export function isScheduledOrderStatus(status) {
  return String(status || "").toLowerCase() === PORTER_SCHEDULED_STATUS;
}

export function shouldStopActiveOrderPolling(status) {
  return PORTER_ACTIVE_POLL_STOP_STATUSES.has(String(status || "").toLowerCase());
}

/**
 * Merge a Porter socket payload into the persisted activeShipment shape.
 * Avoids a full GET /active when the socket already carries enough for routing/UI.
 */
export function mergeSocketEventIntoShipment(prev, event) {
  if (!event?.orderId) return prev || null;

  const id = String(event.orderId);
  if (prev?.id && String(prev.id) !== id) return prev;

  const status = event.redispatch || event.cancelled
    ? String(event.status || prev?.status || "searching_partner").toLowerCase()
    : String(event.status || prev?.status || "").toLowerCase();

  const searchingAgain = isSearchingPartnerStatus(status) || event.redispatch === true;

  const dispatch = searchingAgain
    ? {
      ...(prev?.dispatch || {}),
      ...(event.dispatch || {}),
      deliveryPartnerId: null,
      driver: null,
      status: event.dispatch?.status || "unassigned",
    }
    : event.dispatch
      ? { ...(prev?.dispatch || {}), ...event.dispatch }
      : prev?.dispatch;

  const deliveryState = event.deliveryState
    ? { ...(prev?.deliveryState || {}), ...event.deliveryState }
    : prev?.deliveryState;

  const orderLike = {
    ...(prev || {}),
    id,
    orderNumber: event.orderNumber || prev?.orderNumber,
    status,
    dispatch,
    deliveryState,
  };

  const partner = searchingAgain
    ? null
    : mapPartnerFromOrder(orderLike) || prev?.partner || null;

  const merged = {
    ...(prev || {}),
    id,
    orderNumber: event.orderNumber || prev?.orderNumber,
    trackingId: event.orderNumber || prev?.trackingId || prev?.orderNumber,
    status,
    stage: resolveTrackingStage(status),
    dispatch,
    deliveryState,
    partner,
    redispatch: event.redispatch === true,
  };

  return merged;
}

/**
 * Full GET /active is required when socket lacks partner profile fields.
 */
export function socketEventRequiresFullRefresh(prev, event) {
  if (!event?.orderId) return false;
  if (event.cancelled) return false;

  const status = String(event.status || "").toLowerCase();
  if (!PARTNER_DETAIL_STATUSES.has(status)) return false;

  const hasPartner =
    Boolean(prev?.partner?.name || prev?.partner?.phone)
    || Boolean(prev?.dispatch?.driver?.name || prev?.dispatch?.driver?.phone);

  return !hasPartner;
}
