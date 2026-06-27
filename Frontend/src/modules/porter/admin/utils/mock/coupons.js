const now = new Date();
const daysAgo = (d) => new Date(now.getTime() - d * 86400000).toISOString();
const daysAhead = (d) => new Date(now.getTime() + d * 86400000).toISOString();

export const COUPON_STATUSES = ["active", "scheduled", "expired", "inactive"];
export const DISCOUNT_TYPES = ["percentage", "flat"];
export const VEHICLE_TYPES = ["Bike", "Mini Truck", "Pickup", "Three Wheeler", "EV Loader", "Tempo", "Van"];
export const ZONE_OPTIONS = ["All Zones", "Andheri East", "Bandra West", "Powai", "Thane West", "Dadar", "Vashi"];
export const GOODS_TYPE_OPTIONS = ["Documents", "Electronics", "Furniture", "Medicines", "Groceries", "Fragile Items", "Heavy Machinery", "Industrial Parts"];

export const MOCK_COUPONS = [
  {
    id: "CPN-001", code: "BLAZE50", name: "First Delivery 50% Off", description: "50% off on first porter booking for new customers.",
    discountType: "percentage", discountValue: 50, maxDiscount: 200, minOrderValue: 150,
    maxUses: 5000, usedCount: 3842, perUserLimit: 1,
    validFrom: daysAgo(60), validUntil: daysAhead(30),
    firstOrderOnly: true, newCustomerOnly: true, active: true, autoApply: false,
    zones: ["All Zones"], vehicleTypes: ["All"], goodsTypes: ["All"],
    customerSegment: "New Customers", status: "active",
    image: null, banner: null,
    campaignRevenue: 482000, totalDiscountGiven: 76840,
  },
  {
    id: "CPN-002", code: "MONSOON100", name: "Monsoon Flat ₹100", description: "Flat ₹100 off during monsoon season on orders above ₹300.",
    discountType: "flat", discountValue: 100, maxDiscount: 100, minOrderValue: 300,
    maxUses: 2000, usedCount: 1456, perUserLimit: 3,
    validFrom: daysAgo(15), validUntil: daysAhead(45),
    firstOrderOnly: false, newCustomerOnly: false, active: true, autoApply: false,
    zones: ["Andheri East", "Bandra West", "Powai"], vehicleTypes: ["Mini Truck", "Pickup", "Tempo"], goodsTypes: ["All"],
    customerSegment: "All Customers", status: "active",
    image: null, banner: null,
    campaignRevenue: 312000, totalDiscountGiven: 145600,
  },
  {
    id: "CPN-003", code: "WEEKEND20", name: "Weekend Saver 20%", description: "20% off on weekend deliveries.",
    discountType: "percentage", discountValue: 20, maxDiscount: 150, minOrderValue: 200,
    maxUses: 10000, usedCount: 6234, perUserLimit: 2,
    validFrom: daysAgo(90), validUntil: daysAhead(60),
    firstOrderOnly: false, newCustomerOnly: false, active: true, autoApply: true,
    zones: ["All Zones"], vehicleTypes: ["All"], goodsTypes: ["All"],
    customerSegment: "All Customers", status: "active",
    image: null, banner: null,
    campaignRevenue: 890000, totalDiscountGiven: 187020,
  },
  {
    id: "CPN-004", code: "FURNITURE15", name: "Furniture Move 15%", description: "15% off on furniture and heavy goods deliveries.",
    discountType: "percentage", discountValue: 15, maxDiscount: 500, minOrderValue: 500,
    maxUses: 500, usedCount: 287, perUserLimit: 1,
    validFrom: daysAgo(30), validUntil: daysAhead(15),
    firstOrderOnly: false, newCustomerOnly: false, active: true, autoApply: false,
    zones: ["All Zones"], vehicleTypes: ["Pickup", "Tempo", "Mini Truck"], goodsTypes: ["Furniture", "Heavy Machinery"],
    customerSegment: "All Customers", status: "active",
    image: null, banner: null,
    campaignRevenue: 425000, totalDiscountGiven: 63750,
  },
  {
    id: "CPN-005", code: "DIWALI250", name: "Diwali Mega Offer", description: "₹250 off on festive season bookings.",
    discountType: "flat", discountValue: 250, maxDiscount: 250, minOrderValue: 600,
    maxUses: 3000, usedCount: 3000, perUserLimit: 1,
    validFrom: daysAgo(120), validUntil: daysAgo(30),
    firstOrderOnly: false, newCustomerOnly: false, active: false, autoApply: false,
    zones: ["All Zones"], vehicleTypes: ["All"], goodsTypes: ["All"],
    customerSegment: "All Customers", status: "expired",
    image: null, banner: null,
    campaignRevenue: 720000, totalDiscountGiven: 750000,
  },
  {
    id: "CPN-006", code: "CORP500", name: "Corporate Bulk Discount", description: "₹500 off for corporate accounts on bulk shipments.",
    discountType: "flat", discountValue: 500, maxDiscount: 500, minOrderValue: 1500,
    maxUses: 200, usedCount: 45, perUserLimit: 5,
    validFrom: daysAgo(10), validUntil: daysAhead(80),
    firstOrderOnly: false, newCustomerOnly: false, active: true, autoApply: false,
    zones: ["Powai", "Andheri East", "Bandra West"], vehicleTypes: ["Tempo", "Pickup"], goodsTypes: ["Industrial Parts", "Electronics"],
    customerSegment: "Corporate", status: "active",
    image: null, banner: null,
    campaignRevenue: 198000, totalDiscountGiven: 22500,
  },
  {
    id: "CPN-007", code: "BIKE30", name: "Bike Express 30%", description: "30% off on bike deliveries under 5km.",
    discountType: "percentage", discountValue: 30, maxDiscount: 80, minOrderValue: 80,
    maxUses: 8000, usedCount: 5120, perUserLimit: 4,
    validFrom: daysAgo(45), validUntil: daysAhead(20),
    firstOrderOnly: false, newCustomerOnly: false, active: true, autoApply: false,
    zones: ["All Zones"], vehicleTypes: ["Bike", "Three Wheeler"], goodsTypes: ["Documents", "Groceries"],
    customerSegment: "All Customers", status: "active",
    image: null, banner: null,
    campaignRevenue: 256000, totalDiscountGiven: 40960,
  },
  {
    id: "CPN-008", code: "NEWYEAR2026", name: "New Year Launch", description: "Scheduled launch coupon for New Year campaign.",
    discountType: "percentage", discountValue: 25, maxDiscount: 300, minOrderValue: 250,
    maxUses: 5000, usedCount: 0, perUserLimit: 1,
    validFrom: daysAhead(30), validUntil: daysAhead(60),
    firstOrderOnly: false, newCustomerOnly: false, active: true, autoApply: false,
    zones: ["All Zones"], vehicleTypes: ["All"], goodsTypes: ["All"],
    customerSegment: "All Customers", status: "scheduled",
    image: null, banner: null,
    campaignRevenue: 0, totalDiscountGiven: 0,
  },
  {
    id: "CPN-009", code: "MEDIC10", name: "Medicine Express 10%", description: "10% off on medicine and pharma deliveries.",
    discountType: "percentage", discountValue: 10, maxDiscount: 50, minOrderValue: 100,
    maxUses: 1500, usedCount: 892, perUserLimit: 3,
    validFrom: daysAgo(20), validUntil: daysAhead(40),
    firstOrderOnly: false, newCustomerOnly: false, active: true, autoApply: true,
    zones: ["All Zones"], vehicleTypes: ["Bike"], goodsTypes: ["Medicines"],
    customerSegment: "All Customers", status: "active",
    image: null, banner: null,
    campaignRevenue: 89000, totalDiscountGiven: 4460,
  },
  {
    id: "CPN-010", code: "REFER150", name: "Referral Reward", description: "₹150 off when referred by an existing customer.",
    discountType: "flat", discountValue: 150, maxDiscount: 150, minOrderValue: 200,
    maxUses: 10000, usedCount: 2340, perUserLimit: 1,
    validFrom: daysAgo(180), validUntil: daysAhead(90),
    firstOrderOnly: true, newCustomerOnly: true, active: true, autoApply: false,
    zones: ["All Zones"], vehicleTypes: ["All"], goodsTypes: ["All"],
    customerSegment: "Referred Customers", status: "active",
    image: null, banner: null,
    campaignRevenue: 468000, totalDiscountGiven: 351000,
  },
];

export const MOCK_COUPON_USAGE = [
  { id: "CU-001", couponId: "CPN-001", orderId: "ORD-1042", customer: "Rahul Sharma", discount: 120, orderTotal: 340, usedAt: daysAgo(2) },
  { id: "CU-002", couponId: "CPN-001", orderId: "ORD-1038", customer: "Priya Patel", discount: 85, orderTotal: 220, usedAt: daysAgo(3) },
  { id: "CU-003", couponId: "CPN-002", orderId: "ORD-1055", customer: "Amit Kumar", discount: 100, orderTotal: 450, usedAt: daysAgo(1) },
  { id: "CU-004", couponId: "CPN-003", orderId: "ORD-1060", customer: "Sneha Desai", discount: 64, orderTotal: 380, usedAt: daysAgo(0) },
  { id: "CU-005", couponId: "CPN-007", orderId: "ORD-1058", customer: "Vikram Singh", discount: 42, orderTotal: 160, usedAt: daysAgo(1) },
  { id: "CU-006", couponId: "CPN-004", orderId: "ORD-1045", customer: "Meera Joshi", discount: 225, orderTotal: 1800, usedAt: daysAgo(4) },
  { id: "CU-007", couponId: "CPN-010", orderId: "ORD-1062", customer: "Arjun Mehta", discount: 150, orderTotal: 310, usedAt: daysAgo(0) },
  { id: "CU-008", couponId: "CPN-005", orderId: "ORD-0980", customer: "Kavita Rao", discount: 250, orderTotal: 820, usedAt: daysAgo(45) },
];

export function getCouponSummary(coupons = MOCK_COUPONS) {
  const active = coupons.filter((c) => c.status === "active").length;
  const expired = coupons.filter((c) => c.status === "expired").length;
  const scheduled = coupons.filter((c) => c.status === "scheduled").length;
  const totalRedemption = coupons.reduce((s, c) => s + c.usedCount, 0);
  const totalDiscount = coupons.reduce((s, c) => s + c.totalDiscountGiven, 0);
  const campaignRevenue = coupons.reduce((s, c) => s + c.campaignRevenue, 0);
  return {
    totalCoupons: coupons.length,
    activeCoupons: active,
    expiredCoupons: expired,
    scheduledCoupons: scheduled,
    totalRedemption,
    totalDiscountGiven: totalDiscount,
    campaignRevenue,
  };
}
