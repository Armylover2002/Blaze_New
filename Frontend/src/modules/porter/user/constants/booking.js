export const PAYMENT_METHODS = [
  { id: "razorpay", label: "Pay Online", subtitle: "Pay securely with Cards, UPI, Netbanking", icon: "🌐", recommended: true },
  { id: "wallet", label: "Blaze Wallet", subtitle: "Pay instantly from wallet balance", icon: "💳" },
  { id: "cash", label: "Cash on delivery", subtitle: "Pay driver at pickup handover", icon: "💵" },
];

export const CANCEL_REASONS = [
  "Changed my mind",
  "Found another option",
  "Incorrect pickup/drop address",
  "Taking too long to find partner",
  "Other",
];

export const PORTER_STATUS_LABELS = {
  created: "Created",
  searching_partner: "Finding partner",
  assigned: "Partner assigned",
  partner_accepted: "Partner on the way",
  en_route_pickup: "En route to pickup",
  at_pickup: "At pickup",
  picked_up: "Picked up",
  in_transit: "In transit",
  at_drop: "At destination",
  delivered: "Delivered",
  completed: "Completed",
  cancelled_by_user: "Cancelled",
  cancelled_by_admin: "Cancelled by admin",
  cancelled_by_driver: "Cancelled by driver",
  failed: "Failed",
};

export const TRACKING_STAGES = [
  { id: "searching_partner", label: "Finding partner", statuses: ["created", "searching_partner"] },
  { id: "to_pickup", label: "Partner en route", statuses: ["assigned", "partner_accepted", "en_route_pickup"] },
  { id: "at_pickup", label: "At pickup", statuses: ["at_pickup"] },
  { id: "picked_up", label: "Picked up", statuses: ["picked_up"] },
  { id: "in_transit", label: "In transit", statuses: ["in_transit", "at_drop"] },
  { id: "delivered", label: "Delivered", statuses: ["delivered", "completed"] },
];

export function resolveTrackingStage(status) {
  const s = String(status || "").toLowerCase();
  const found = TRACKING_STAGES.find((stage) => stage.statuses.includes(s));
  return found?.id || "searching_partner";
}
