// Single source of truth for every Porter booking-related storage key.
// Draft keys = temporary booking form data (must be wiped after a successful order).
// Active keys = the created/live order pointer (kept so tracking can recover).
export const PORTER_BOOKING_KEYS = {
  pickup: "porter_booking_pickup",
  delivery: "porter_booking_delivery",
  parcel: "porter_booking_parcel",
  vehicleId: "porter_booking_vehicle_id",
  selectedVehicle: "porter_booking_selected_vehicle",
  paymentMethod: "porter_booking_payment_method",
  coupon: "porter_booking_coupon",
  couponPricing: "porter_booking_coupon_pricing",
  scheduledAt: "porter_booking_scheduled_at",
  activeShipment: "porter_booking_active_shipment",
  activeOrderId: "porter_active_order_id",
};

// Backwards-compatible alias used by the existing read/write helpers below.
const KEYS = PORTER_BOOKING_KEYS;

const DRAFT_KEYS = [
  KEYS.pickup,
  KEYS.delivery,
  KEYS.parcel,
  KEYS.vehicleId,
  KEYS.selectedVehicle,
  KEYS.paymentMethod,
  KEYS.coupon,
  KEYS.couponPricing,
  KEYS.scheduledAt,
];

const ACTIVE_KEYS = [KEYS.activeShipment, KEYS.activeOrderId];

const readJson = (key, fallback = null) => {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
};

const writeJson = (key, value) => {
  try {
    if (value == null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
};

const removeKeys = (keys) => {
  keys.forEach((key) => {
    try { sessionStorage.removeItem(key); } catch { /* ignore */ }
  });
};

export const readStoredVehicleId = () => {
  try {
    return sessionStorage.getItem(KEYS.vehicleId) || null;
  } catch {
    return null;
  }
};

export const writeStoredVehicleId = (vehicleId) => {
  try {
    if (vehicleId) sessionStorage.setItem(KEYS.vehicleId, String(vehicleId));
    else sessionStorage.removeItem(KEYS.vehicleId);
  } catch {
    // ignore
  }
};

export const readStoredSelectedVehicle = () => readJson(KEYS.selectedVehicle, null);
export const writeStoredSelectedVehicle = (vehicle) => writeJson(KEYS.selectedVehicle, vehicle);

export const readStoredPaymentMethod = () => {
  try {
    return sessionStorage.getItem(KEYS.paymentMethod) || "wallet";
  } catch {
    return "wallet";
  }
};

export const writeStoredPaymentMethod = (method) => {
  try {
    if (method) sessionStorage.setItem(KEYS.paymentMethod, String(method));
  } catch {
    // ignore
  }
};

export const readStoredCoupon = () => readJson(KEYS.coupon, null);
export const writeStoredCoupon = (coupon) => writeJson(KEYS.coupon, coupon);

export const readStoredCouponPricing = () => readJson(KEYS.couponPricing, null);
export const writeStoredCouponPricing = (pricing) => writeJson(KEYS.couponPricing, pricing);

export const readStoredScheduledAt = () => readJson(KEYS.scheduledAt, null);
export const writeStoredScheduledAt = (value) => writeJson(KEYS.scheduledAt, value);

export const readStoredActiveShipment = () => readJson(KEYS.activeShipment, null);
export const writeStoredActiveShipment = (shipment) => writeJson(KEYS.activeShipment, shipment);

// Wipe only the temporary booking form draft (keeps the active-order pointer so
// live tracking can still recover after a successful booking).
export const clearStoredBookingDraft = () => removeKeys(DRAFT_KEYS);

// Wipe the active-order pointer (used once the order reaches a terminal state).
export const clearStoredActiveOrder = () => removeKeys(ACTIVE_KEYS);

// Full reset — draft + active order pointer.
export const clearAllBookingStorage = () => removeKeys([...DRAFT_KEYS, ...ACTIVE_KEYS]);
