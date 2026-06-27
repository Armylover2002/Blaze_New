const now = new Date();
const daysAgo = (d) => new Date(now.getTime() - d * 86400000).toISOString();
const daysAhead = (d) => new Date(now.getTime() + d * 86400000).toISOString();

export const PROMOTION_TYPES = [
  "Festival Offer", "Flash Offer", "Weekend Offer", "Referral Offer",
  "Free Loading", "Free Waiting", "Free First Delivery",
];

export const MOCK_PROMOTIONS = [
  {
    id: "PROMO-001", name: "Diwali Festival Bonanza", type: "Festival Offer",
    description: "Special festive rates with free loading on all tempo bookings during Diwali week.",
    banner: null, startDate: daysAgo(5), endDate: daysAhead(10), status: "active",
    discount: "15% off + Free Loading", targetZones: ["All Zones"],
    ordersGenerated: 1240, revenue: 620000, conversionRate: 18.5,
  },
  {
    id: "PROMO-002", name: "Flash Friday 2-Hour Deal", type: "Flash Offer",
    description: "Every Friday 6–8 PM: 25% off on bike and three-wheeler express deliveries.",
    banner: null, startDate: daysAgo(30), endDate: daysAhead(60), status: "active",
    discount: "25% off", targetZones: ["Andheri East", "Bandra West", "Dadar"],
    ordersGenerated: 890, revenue: 178000, conversionRate: 22.1,
  },
  {
    id: "PROMO-003", name: "Weekend Family Move", type: "Weekend Offer",
    description: "Reduced rates on furniture and appliance moves every Saturday–Sunday.",
    banner: null, startDate: daysAgo(60), endDate: daysAhead(90), status: "active",
    discount: "₹200 off", targetZones: ["All Zones"],
    ordersGenerated: 456, revenue: 912000, conversionRate: 12.8,
  },
  {
    id: "PROMO-004", name: "Refer & Earn ₹300", type: "Referral Offer",
    description: "Refer a friend and both get ₹300 credit on next booking.",
    banner: null, startDate: daysAgo(90), endDate: daysAhead(90), status: "active",
    discount: "₹300 credit", targetZones: ["All Zones"],
    ordersGenerated: 2340, revenue: 468000, conversionRate: 31.2,
  },
  {
    id: "PROMO-005", name: "Free Loading Week", type: "Free Loading",
    description: "Zero loading charges on all pickup and tempo bookings this week.",
    banner: null, startDate: daysAgo(3), endDate: daysAhead(4), status: "active",
    discount: "Free Loading", targetZones: ["Powai", "Thane West", "Vashi"],
    ordersGenerated: 312, revenue: 249600, conversionRate: 15.6,
  },
  {
    id: "PROMO-006", name: "Free Waiting 30 Min", type: "Free Waiting",
    description: "First 30 minutes of waiting time free on corporate zone deliveries.",
    banner: null, startDate: daysAgo(15), endDate: daysAhead(45), status: "active",
    discount: "30 min free", targetZones: ["Powai", "Andheri East"],
    ordersGenerated: 178, revenue: 142400, conversionRate: 9.4,
  },
  {
    id: "PROMO-007", name: "First Delivery Free", type: "Free First Delivery",
    description: "Completely free first delivery for new app sign-ups up to ₹150.",
    banner: null, startDate: daysAgo(120), endDate: daysAhead(60), status: "active",
    discount: "100% off (max ₹150)", targetZones: ["All Zones"],
    ordersGenerated: 5120, revenue: 384000, conversionRate: 42.5,
  },
  {
    id: "PROMO-008", name: "Holi Color Run Promo", type: "Festival Offer",
    description: "Holi season promotion with surge-free pricing in select zones.",
    banner: null, startDate: daysAgo(90), endDate: daysAgo(75), status: "expired",
    discount: "Surge-free", targetZones: ["Bandra West", "Colaba"],
    ordersGenerated: 680, revenue: 340000, conversionRate: 16.2,
  },
  {
    id: "PROMO-009", name: "Monsoon Relief Package", type: "Flash Offer",
    description: "Rain-day flash offers with priority driver assignment.",
    banner: null, startDate: daysAhead(20), endDate: daysAhead(50), status: "scheduled",
    discount: "20% off", targetZones: ["All Zones"],
    ordersGenerated: 0, revenue: 0, conversionRate: 0,
  },
  {
    id: "PROMO-010", name: "EV Fleet Green Week", type: "Weekend Offer",
    description: "10% cashback on all EV loader bookings during Green Week.",
    banner: null, startDate: daysAgo(7), endDate: daysAhead(7), status: "active",
    discount: "10% cashback", targetZones: ["All Zones"],
    ordersGenerated: 245, revenue: 196000, conversionRate: 11.3,
  },
];

export const MOCK_PROMOTION_CHART = [
  { name: "Mon", orders: 120, revenue: 48000 },
  { name: "Tue", orders: 145, revenue: 58000 },
  { name: "Wed", orders: 132, revenue: 52800 },
  { name: "Thu", orders: 168, revenue: 67200 },
  { name: "Fri", orders: 210, revenue: 84000 },
  { name: "Sat", orders: 285, revenue: 114000 },
  { name: "Sun", orders: 260, revenue: 104000 },
];

export function getPromotionSummary(promotions = MOCK_PROMOTIONS) {
  const active = promotions.filter((p) => p.status === "active").length;
  const scheduled = promotions.filter((p) => p.status === "scheduled").length;
  const expired = promotions.filter((p) => p.status === "expired").length;
  const totalOrders = promotions.reduce((s, p) => s + p.ordersGenerated, 0);
  const totalRevenue = promotions.reduce((s, p) => s + p.revenue, 0);
  const avgConversion = promotions.filter((p) => p.conversionRate > 0).reduce((s, p, _, arr) => s + p.conversionRate / arr.length, 0);
  return {
    totalPromotions: promotions.length,
    activePromotions: active,
    scheduledPromotions: scheduled,
    expiredPromotions: expired,
    totalOrders,
    totalRevenue,
    avgConversion: avgConversion.toFixed(1) + "%",
  };
}
