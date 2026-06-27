const templates = [
  { type: "critical", title: "Vehicle Offline", description: "Vehicle {ref} went offline unexpectedly during an active trip." },
  { type: "warning", title: "Order Delayed", description: "Order {ref} is delayed beyond the estimated delivery window." },
  { type: "announcement", title: "New Feature Released", description: "Surge pricing controls are now available in the pricing module." },
  { type: "info", title: "Driver Assigned", description: "A driver has been assigned to order {ref}." },
  { type: "critical", title: "Payment Failed", description: "Settlement payout {ref} failed at the gateway." },
  { type: "warning", title: "Low Wallet Balance", description: "Driver wallet for {ref} dropped below the minimum threshold." },
  { type: "announcement", title: "Scheduled Maintenance", description: "Platform maintenance is scheduled this weekend at 2 AM." },
  { type: "info", title: "Zone Updated", description: "Coverage boundaries for zone {ref} were updated." },
];

const recipients = ["All Drivers", "All Customers", "Operations Team", "Finance Team", "Zone Managers", "Driver: Rahul Verma", "Customer: Aarav Sharma"];

function makeNotification(i) {
  const tpl = templates[i % templates.length];
  const ref = `ORD-${String(900 + (i % 25) + 1)}`;
  const created = new Date();
  created.setHours(created.getHours() - i * 5);
  const read = i % 3 !== 0;
  return {
    id: `NTF-${String(8001 + i)}`,
    type: tpl.type,
    title: tpl.title,
    description: tpl.description.replace("{ref}", ref),
    recipient: recipients[i % recipients.length],
    createdAt: created.toISOString(),
    status: read ? "read" : "unread",
  };
}

export const MOCK_NOTIFICATIONS = Array.from({ length: 30 }, (_, i) => makeNotification(i));

export const NOTIFICATION_TEMPLATES = [
  { id: "tpl-1", name: "Order Delay Alert", type: "warning", title: "Order Delayed", description: "Your order is delayed beyond the estimated delivery window." },
  { id: "tpl-2", name: "Promo Announcement", type: "announcement", title: "Special Offer", description: "Enjoy discounted delivery charges this festive season." },
  { id: "tpl-3", name: "Driver Onboarding", type: "info", title: "Welcome Aboard", description: "Welcome to the Porter fleet. Complete your verification to start earning." },
  { id: "tpl-4", name: "Critical System Alert", type: "critical", title: "System Alert", description: "Immediate attention required for a critical operational issue." },
];

export const NOTIFICATION_TYPES = ["critical", "warning", "announcement", "info"];
