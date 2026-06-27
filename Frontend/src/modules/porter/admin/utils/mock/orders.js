import { MOCK_DRIVERS } from "./drivers";

const customers = ["John Doe", "Alice Smith", "Bob Johnson", "Charlie Brown", "Eve Davis", "Frank White", "Grace Lee", "Hank Green", "Ivy Taylor", "Jack Wilson", "Karen Hall", "Leo Martin", "Mia Clark", "Noah Lewis", "Olivia Walker"];
const pickups = ["Andheri East", "Juhu", "Powai", "Borivali", "Dadar", "Thane", "Vashi", "Chembur", "Malad", "Goregaon", "Bandra West", "Colaba"];
const drops = ["Bandra West", "Colaba", "Goregaon", "Malad", "Mulund", "Worli", "Nerul", "Sion", "Bhayandar", "Dombivli", "Kalyan", "Fort"];
const goodsTypes = ["Documents", "Electronics", "Furniture", "Medicines", "Groceries", "Food", "Flowers", "Fragile Items", "Parcels", "Hardware"];
const vehicles = ["Mini Truck", "Bike", "Pickup", "Three Wheeler", "EV Loader", "Tempo", "Van"];
const statuses = [
  "pending", "assigned", "driver_accepted", "picked_up", "in_transit",
  "near_destination", "delivered", "cancelled", "failed", "refunded",
];
const payments = ["Prepaid", "Cash", "Wallet", "UPI"];

const ASSIGNED_FLOW = ["assigned", "driver_accepted", "picked_up", "in_transit", "near_destination", "delivered", "refunded"];
const PICKED_FLOW = ["picked_up", "in_transit", "near_destination", "delivered", "refunded"];
const TRANSIT_FLOW = ["in_transit", "near_destination", "delivered", "refunded"];

function makeOrder(index) {
  const id = `ORD-${String(900 + index)}`;
  const status = statuses[index % statuses.length];
  const driver = ["pending", "failed"].includes(status) ? null : MOCK_DRIVERS[index % MOCK_DRIVERS.length];
  const created = new Date();
  created.setHours(created.getHours() - index * 2);
  return {
    id,
    customer: customers[index % customers.length],
    customerPhone: `+91 98${String(10000000 + index * 211).slice(0, 8)}`,
    pickup: pickups[index % pickups.length],
    pickupAddress: `Warehouse ${index + 1}, ${pickups[index % pickups.length]}, Mumbai`,
    drop: drops[index % drops.length],
    dropAddress: `Office ${index + 1}, ${drops[index % drops.length]}, Mumbai`,
    driverId: driver?.id || null,
    driverName: driver?.name || "Unassigned",
    vehicle: vehicles[index % vehicles.length],
    goodsType: goodsTypes[index % goodsTypes.length],
    distanceKm: 4 + (index % 18),
    amount: 120 + index * 35,
    paymentStatus: ["cancelled", "refunded", "failed"].includes(status) ? "refunded" : payments[index % payments.length],
    deliveryStatus: status,
    createdAt: created.toISOString(),
    timeline: buildTimeline(status, created),
  };
}

function buildTimeline(status, created) {
  const at = (mins) => { const t = new Date(created); t.setMinutes(t.getMinutes() + mins); return t.toISOString(); };
  const steps = [
    { label: "Order Placed", status: "completed", at: created.toISOString() },
  ];
  if (ASSIGNED_FLOW.includes(status)) steps.push({ label: "Driver Assigned", status: "completed", at: at(5) });
  if (["driver_accepted", ...PICKED_FLOW].includes(status)) steps.push({ label: "Driver Accepted", status: status === "driver_accepted" ? "active" : "completed", at: at(8) });
  if (PICKED_FLOW.includes(status)) steps.push({ label: "Picked Up", status: status === "picked_up" ? "active" : "completed", at: at(20) });
  if (TRANSIT_FLOW.includes(status)) steps.push({ label: "In Transit", status: status === "in_transit" ? "active" : "completed", at: at(35) });
  if (["near_destination", "delivered", "refunded"].includes(status)) steps.push({ label: "Near Destination", status: status === "near_destination" ? "active" : "completed", at: at(48) });
  if (["delivered", "refunded"].includes(status)) steps.push({ label: "Delivered", status: "completed", at: at(55) });
  if (status === "cancelled") steps.push({ label: "Cancelled", status: "cancelled", at: at(10) });
  if (status === "failed") steps.push({ label: "Delivery Failed", status: "cancelled", at: at(40) });
  if (status === "refunded") steps.push({ label: "Refund Processed", status: "cancelled", at: at(70) });
  if (status === "pending") steps.push({ label: "Awaiting Driver", status: "active", at: null });
  return steps;
}

export const MOCK_ORDERS = Array.from({ length: 40 }, (_, i) => makeOrder(i + 1));

export const ORDER_STATUS_OPTIONS = [
  { label: "All Status", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Assigned", value: "assigned" },
  { label: "Driver Accepted", value: "driver_accepted" },
  { label: "Picked Up", value: "picked_up" },
  { label: "In Transit", value: "in_transit" },
  { label: "Near Destination", value: "near_destination" },
  { label: "Delivered", value: "delivered" },
  { label: "Cancelled", value: "cancelled" },
  { label: "Failed", value: "failed" },
  { label: "Refunded", value: "refunded" },
];

export const ORDER_STATUS_TABS = [
  { label: "All Orders", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Assigned", value: "assigned" },
  { label: "Driver Accepted", value: "driver_accepted" },
  { label: "Picked Up", value: "picked_up" },
  { label: "In Transit", value: "in_transit" },
  { label: "Near Destination", value: "near_destination" },
  { label: "Delivered", value: "delivered" },
  { label: "Cancelled", value: "cancelled" },
  { label: "Failed", value: "failed" },
  { label: "Refunded", value: "refunded" },
];
