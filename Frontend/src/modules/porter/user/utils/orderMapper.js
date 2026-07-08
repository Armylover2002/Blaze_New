import { resolveTrackingStage } from "../constants/booking";

export function mapPartnerFromOrder(order) {
  const driver = order?.dispatch?.driver;
  if (!driver?.name && !driver?.id && !driver?.phone) return null;

  const trips = driver.totalRatings ?? driver.trips ?? driver.totalTrips;

  return {
    id: driver.id ? String(driver.id) : undefined,
    name: driver.name || "Delivery Partner",
    phone: driver.phone || "",
    rating: Number(driver.rating) > 0 ? Number(driver.rating) : null,
    trips: Number(trips) > 0 ? Number(trips) : null,
    vehicle: order.vehicleName || driver.vehicleName || order.vehicle || null,
    vehicleNumber: driver.vehicleNumber || order.dispatch?.vehicleNumber || null,
    profilePhoto: driver.profilePhoto || null,
    pickupOtp: order.deliveryState?.pickupOtp || "",
  };
}

export function mapActiveShipmentFromOrder(order) {
  if (!order?.id && !order?._id) return null;

  const id = String(order.id || order._id);
  const partner = mapPartnerFromOrder(order);

  return {
    id,
    orderNumber: order.orderNumber,
    trackingId: order.orderNumber,
    status: order.status,
    stage: resolveTrackingStage(order.status),
    pickup: order.pickup,
    delivery: order.delivery,
    parcel: order.parcel,
    vehicleId: order.vehicleId ? String(order.vehicleId) : null,
    vehicle: order.vehicleName || order.vehicle,
    vehicleName: order.vehicleName,
    route: order.route,
    pricing: order.pricing,
    payment: order.payment,
    dispatch: order.dispatch,
    deliveryState: order.deliveryState,
    partner,
    total: order.pricing?.total,
    scheduledAt: order.scheduledAt,
    schedule: order.schedule,
    rating: order.rating,
    createdAt: order.createdAt,
  };
}

export function resolveActiveRouteForStatus(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "scheduled") {
    return "/porter/scheduled";
  }
  if (["searching_partner", "created"].includes(normalized)) {
    return "/porter/finding-partner";
  }
  if (["assigned", "partner_accepted", "en_route_pickup", "at_pickup"].includes(normalized)) {
    return "/porter/partner-assigned";
  }
  return "/porter/tracking";
}
