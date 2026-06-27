export const PAYMENT_METHODS = [
  { id: "wallet", label: "Blaze Wallet", subtitle: "Balance: ₹1,240", icon: "💳", recommended: true },
  { id: "upi", label: "UPI", subtitle: "Google Pay, PhonePe, Paytm", icon: "📲" },
  { id: "card", label: "Credit / Debit Card", subtitle: "Visa, Mastercard, RuPay", icon: "💳" },
  { id: "cash", label: "Cash on Delivery", subtitle: "Pay partner at pickup", icon: "💵" },
  { id: "netbanking", label: "Net Banking", subtitle: "All major banks", icon: "🏦" },
];

export const OFFERS = [
  { id: "o1", title: "Free insurance up to ₹5,000", subtitle: "On all parcel bookings this week", icon: "🛡️" },
  { id: "o2", title: "Zero surge on EV Van", subtitle: "Go green & save on delivery", icon: "⚡" },
  { id: "o3", title: "Refer & earn ₹100", subtitle: "Share Blaze Porter with friends", icon: "🎁" },
];

export const EMERGENCY_CONTACTS = [
  { id: "ec1", name: "Mom", phone: "+91 98765 11111", relation: "Family" },
  { id: "ec2", name: "Office Security", phone: "+91 98765 22222", relation: "Workplace" },
];

export const SOS_OPTIONS = [
  { id: "call_police", label: "Call Police (100)", icon: "🚔", action: "tel:100" },
  { id: "call_ambulance", label: "Call Ambulance (108)", icon: "🚑", action: "tel:108" },
  { id: "share_location", label: "Share live location", icon: "📍", action: "share" },
  { id: "alert_contacts", label: "Alert emergency contacts", icon: "📞", action: "alert" },
  { id: "report_issue", label: "Report safety issue", icon: "⚠️", action: "report" },
];

export const CANCEL_REASONS = [
  "Changed delivery address",
  "Wrong parcel details entered",
  "Found another delivery option",
  "Delivery partner taking too long",
  "Scheduled pickup by mistake",
  "Other reason",
];
