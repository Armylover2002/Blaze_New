import { MOCK_DRIVERS } from "./drivers";

const customers = ["Aarav Sharma", "Diya Patel", "Rohan Gupta", "Priya Nair", "Kabir Mehta", "Neha Joshi", "Arjun Reddy", "Tara Iyer"];
const issueTypes = ["Delivery Delay", "Damaged Goods", "Wrong Pickup", "Payment Dispute", "Driver Behavior", "Missing Item", "Overcharge", "Cancellation"];
const categories = ["Delivery", "Payment", "Driver", "Vehicle", "Account", "Safety"];
const priorities = ["low", "medium", "high", "critical"];
const statuses = ["open", "in_progress", "escalated", "resolved", "closed"];
const agents = ["Support Agent A", "Support Agent B", "Ops Lead", "Finance Desk", "Unassigned"];
const vehicles = ["Mini Truck", "Bike", "Pickup", "Three Wheeler", "EV Loader", "Tempo", "Van"];

function buildTimeline(status, created) {
  const steps = [{ label: "Ticket created", author: "System", type: "system", at: created.toISOString(), message: "Customer submitted a support request." }];
  if (["in_progress", "escalated", "resolved", "closed"].includes(status)) {
    const t = new Date(created); t.setHours(t.getHours() + 2);
    steps.push({ label: "Assigned to agent", author: "Admin", type: "internal", at: t.toISOString(), message: "Ticket assigned for investigation." });
  }
  if (["escalated", "resolved", "closed"].includes(status)) {
    const t = new Date(created); t.setHours(t.getHours() + 8);
    steps.push({ label: "Escalated to operations", author: "Ops Lead", type: "escalation", at: t.toISOString(), message: "Escalated due to SLA breach risk." });
  }
  if (["resolved", "closed"].includes(status)) {
    const t = new Date(created); t.setHours(t.getHours() + 24);
    steps.push({ label: "Resolution provided", author: "Support Agent", type: "reply", at: t.toISOString(), message: "Refund processed and driver coached on handling fragile items." });
  }
  if (status === "closed") {
    const t = new Date(created); t.setHours(t.getHours() + 30);
    steps.push({ label: "Ticket closed", author: "Admin", type: "system", at: t.toISOString(), message: "Customer confirmed resolution." });
  }
  return steps;
}

function makeTicket(i) {
  const driver = MOCK_DRIVERS[i % MOCK_DRIVERS.length];
  const status = statuses[i % statuses.length];
  const priority = priorities[i % priorities.length];
  const created = new Date(2026, 5, 1 + (i % 24), 9 + (i % 8), (i * 7) % 60);
  const updated = new Date(created);
  updated.setHours(updated.getHours() + (i % 12) + 1);
  return {
    id: `TKT-${String(4001 + i)}`,
    customer: customers[i % customers.length],
    driverName: driver.name,
    driverId: driver.id,
    vehicle: vehicles[i % vehicles.length],
    orderId: `ORD-${String(900 + (i % 25) + 1)}`,
    issueType: issueTypes[i % issueTypes.length],
    category: categories[i % categories.length],
    priority,
    assignedTo: status === "open" ? "Unassigned" : agents[(i % agents.length) || 1],
    status,
    subject: `${issueTypes[i % issueTypes.length]} for order ORD-${String(900 + (i % 25) + 1)}`,
    description: `Customer reported ${issueTypes[i % issueTypes.length].toLowerCase()} during active delivery. Requires review and follow-up.`,
    createdAt: created.toISOString(),
    updatedAt: updated.toISOString(),
    resolutionHours: status === "resolved" || status === "closed" ? 4 + (i % 20) : null,
    internalNotes: i % 3 === 0 ? "Driver contacted. Awaiting warehouse confirmation." : "Monitoring SLA window.",
    attachments: i % 4 === 0 ? [{ name: "delivery-proof.jpg", type: "image" }, { name: "invoice.pdf", type: "pdf" }] : [{ name: "screenshot.png", type: "image" }],
    timeline: buildTimeline(status, created),
  };
}

export const MOCK_SUPPORT_TICKETS = Array.from({ length: 40 }, (_, i) => makeTicket(i + 1));

export const SUPPORT_PRIORITIES = ["low", "medium", "high", "critical"];
export const SUPPORT_STATUSES = ["open", "in_progress", "escalated", "resolved", "closed"];
export const SUPPORT_CATEGORIES = categories;

export const MOCK_SUPPORT_SUMMARY = {
  open: MOCK_SUPPORT_TICKETS.filter((t) => t.status === "open").length,
  resolved: MOCK_SUPPORT_TICKETS.filter((t) => t.status === "resolved" || t.status === "closed").length,
  escalated: MOCK_SUPPORT_TICKETS.filter((t) => t.status === "escalated").length,
  highPriority: MOCK_SUPPORT_TICKETS.filter((t) => t.priority === "high" || t.priority === "critical").length,
  avgResolutionHours: "6.4 hrs",
};
