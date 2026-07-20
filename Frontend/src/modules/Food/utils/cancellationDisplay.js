/**
 * Shared cancellation display labels for Food module UIs.
 * Distinguishes acceptance timeout from active restaurant reject.
 */

const TIMEOUT_REASON_RE =
  /restaurant not accept|did not respond|not accepted within|timed?\s*out|auto[- ]?reject/i;

export function isRestaurantAcceptanceTimeout(order = {}) {
  const reason = String(
    order.cancellationReason || order.reason || order.cancelReason || "",
  ).trim();
  const status = String(order.orderStatus || order.status || "").toLowerCase();
  if (!status.includes("cancel")) return false;
  if (TIMEOUT_REASON_RE.test(reason)) return true;
  return Boolean(order.isAcceptanceTimeout);
}

/**
 * @returns {string} User-facing cancellation label
 */
export function getCancellationDisplayLabel(order = {}) {
  const status = String(order.orderStatus || order.status || "").toLowerCase();
  const by = String(order.cancelledBy || "").toLowerCase();

  if (isRestaurantAcceptanceTimeout(order)) {
    return "Restaurant did not accept";
  }

  if (
    status === "cancelled_by_restaurant" ||
    by === "restaurant" ||
    status.includes("restaurant")
  ) {
    return "Cancelled by Restaurant";
  }

  if (status === "cancelled_by_admin" || by === "admin") {
    return "Cancelled by Admin";
  }

  if (
    status === "cancelled_by_user" ||
    by === "user" ||
    by === "customer"
  ) {
    return "Cancelled by Customer";
  }

  if (status === "cancelled_by_system" || by === "system") {
    return "Cancelled automatically";
  }

  if (status.includes("cancel")) {
    return "Cancelled";
  }

  return "";
}
