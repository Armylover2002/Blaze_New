export const COMMISSION_TYPES = ["percentage", "flat", "hybrid"];

export const MOCK_PLATFORM_COMMISSION = {
  type: "hybrid",
  percentage: 5,
  flatAmount: 20,
  driverShare: 78,
  platformShare: 17,
  partnerShare: 5,
  status: "active",
};

export const MOCK_VEHICLE_PRICING = [
  { vehicle: "Bike", baseFare: 40, minimumFare: 60, perKm: 8, perMinute: 1.5, waitingCharge: 2, loadingCharge: 0, unloadingCharge: 0, nightCharge: 15, peakCharge: 10, holidayCharge: 25, extraStopCharge: 20, cancellationCharge: 30, fuelSurcharge: 5, insuranceFee: 10, platformFee: 8, gst: 5, status: "active" },
  { vehicle: "Three Wheeler", baseFare: 60, minimumFare: 90, perKm: 10, perMinute: 2, waitingCharge: 2, loadingCharge: 15, unloadingCharge: 15, nightCharge: 20, peakCharge: 15, holidayCharge: 30, extraStopCharge: 25, cancellationCharge: 40, fuelSurcharge: 8, insuranceFee: 15, platformFee: 10, gst: 5, status: "active" },
  { vehicle: "Mini Truck", baseFare: 120, minimumFare: 200, perKm: 18, perMinute: 3, waitingCharge: 5, loadingCharge: 50, unloadingCharge: 50, nightCharge: 40, peakCharge: 30, holidayCharge: 60, extraStopCharge: 40, cancellationCharge: 80, fuelSurcharge: 15, insuranceFee: 25, platformFee: 20, gst: 5, status: "active" },
  { vehicle: "Pickup", baseFare: 150, minimumFare: 280, perKm: 22, perMinute: 4, waitingCharge: 6, loadingCharge: 80, unloadingCharge: 80, nightCharge: 50, peakCharge: 40, holidayCharge: 80, extraStopCharge: 50, cancellationCharge: 100, fuelSurcharge: 20, insuranceFee: 35, platformFee: 25, gst: 5, status: "active" },
  { vehicle: "Tempo", baseFare: 180, minimumFare: 320, perKm: 24, perMinute: 5, waitingCharge: 7, loadingCharge: 100, unloadingCharge: 100, nightCharge: 55, peakCharge: 45, holidayCharge: 90, extraStopCharge: 60, cancellationCharge: 120, fuelSurcharge: 25, insuranceFee: 40, platformFee: 30, gst: 5, status: "active" },
  { vehicle: "EV Loader", baseFare: 100, minimumFare: 180, perKm: 15, perMinute: 2.5, waitingCharge: 3, loadingCharge: 40, unloadingCharge: 40, nightCharge: 25, peakCharge: 20, holidayCharge: 40, extraStopCharge: 35, cancellationCharge: 70, fuelSurcharge: 0, insuranceFee: 20, platformFee: 15, gst: 5, status: "active" },
  { vehicle: "Van", baseFare: 130, minimumFare: 220, perKm: 20, perMinute: 3.5, waitingCharge: 5, loadingCharge: 60, unloadingCharge: 60, nightCharge: 45, peakCharge: 35, holidayCharge: 70, extraStopCharge: 45, cancellationCharge: 90, fuelSurcharge: 18, insuranceFee: 30, platformFee: 22, gst: 5, status: "active" },
];

export const MOCK_GOODS_PRICING = [
  { goodsType: "Furniture", basePrice: 200, perKm: 5, loadingFee: 150, handlingFee: 80, insurance: 50, minimumCharge: 350, maxWeightKg: 500, status: "active" },
  { goodsType: "Electronics", basePrice: 80, perKm: 3, loadingFee: 30, handlingFee: 40, insurance: 100, minimumCharge: 150, maxWeightKg: 25, status: "active" },
  { goodsType: "Documents", basePrice: 30, perKm: 2, loadingFee: 0, handlingFee: 10, insurance: 20, minimumCharge: 60, maxWeightKg: 5, status: "active" },
  { goodsType: "Medicines", basePrice: 50, perKm: 2.5, loadingFee: 0, handlingFee: 25, insurance: 30, minimumCharge: 100, maxWeightKg: 15, status: "active" },
  { goodsType: "Groceries", basePrice: 40, perKm: 2, loadingFee: 10, handlingFee: 15, insurance: 10, minimumCharge: 80, maxWeightKg: 40, status: "active" },
  { goodsType: "Fragile Items", basePrice: 100, perKm: 4, loadingFee: 50, handlingFee: 60, insurance: 80, minimumCharge: 200, maxWeightKg: 50, status: "active" },
  { goodsType: "Heavy Machinery", basePrice: 500, perKm: 12, loadingFee: 300, handlingFee: 200, insurance: 200, minimumCharge: 800, maxWeightKg: 2000, status: "active" },
  { goodsType: "Industrial Parts", basePrice: 150, perKm: 6, loadingFee: 80, handlingFee: 50, insurance: 60, minimumCharge: 280, maxWeightKg: 200, status: "active" },
];

export const MOCK_ZONE_PRICING = [
  { zone: "Andheri East", baseFare: 80, perKm: 14, extraKm: 16, waiting: 4, peakMultiplier: 1.3, nightMultiplier: 1.2, status: "active" },
  { zone: "Bandra West", baseFare: 90, perKm: 16, extraKm: 18, waiting: 4, peakMultiplier: 1.5, nightMultiplier: 1.25, status: "active" },
  { zone: "Powai", baseFare: 85, perKm: 15, extraKm: 17, waiting: 4, peakMultiplier: 1.15, nightMultiplier: 1.15, status: "active" },
  { zone: "Thane West", baseFare: 100, perKm: 20, extraKm: 22, waiting: 5, peakMultiplier: 1.2, nightMultiplier: 1.2, status: "active" },
  { zone: "Dadar", baseFare: 75, perKm: 13, extraKm: 15, waiting: 3, peakMultiplier: 1.4, nightMultiplier: 1.2, status: "active" },
  { zone: "Vashi", baseFare: 95, perKm: 18, extraKm: 20, waiting: 5, peakMultiplier: 1.25, nightMultiplier: 1.15, status: "active" },
];

export const MOCK_SURGE_RULES = [
  { id: "SR-001", name: "Rain Surge", type: "Rain", multiplier: 1.4, dynamic: true, status: "active", activeHours: "On demand" },
  { id: "SR-002", name: "Festival Surge", type: "Festival", multiplier: 1.6, dynamic: false, status: "active", activeHours: "Diwali week" },
  { id: "SR-003", name: "Weekend Surge", type: "Weekend", multiplier: 1.2, dynamic: false, status: "active", activeHours: "Sat–Sun 10AM–8PM" },
  { id: "SR-004", name: "Rush Hour", type: "Rush Hour", multiplier: 1.35, dynamic: true, status: "active", activeHours: "8–11AM, 5–9PM" },
  { id: "SR-005", name: "Night Surge", type: "Night", multiplier: 1.25, dynamic: false, status: "active", activeHours: "10PM–6AM" },
  { id: "SR-006", name: "Traffic Surge", type: "Traffic", multiplier: 1.3, dynamic: true, status: "active", activeHours: "Auto-detect" },
  { id: "SR-007", name: "Manual Override", type: "Manual Surge", multiplier: 2.0, dynamic: false, status: "inactive", activeHours: "Admin triggered" },
];

export const MOCK_PLATFORM_FEES = {
  convenienceFee: 15,
  platformFee: 20,
  insuranceFee: 25,
  serviceFee: 10,
  gstPercent: 5,
  roundOff: true,
};

export const MOCK_COMMISSION_DASHBOARD = {
  todayCommission: 12400,
  weeklyCommission: 68200,
  monthlyCommission: 284500,
  pendingSettlement: 45600,
  paidSettlement: 238900,
  platformRevenue: 842000,
  driverRevenue: 3256000,
};

export const MOCK_SETTLEMENT_CHART = [
  { name: "Week 1", platform: 62000, driver: 248000, settlement: 58000 },
  { name: "Week 2", platform: 71000, driver: 284000, settlement: 65000 },
  { name: "Week 3", platform: 68000, driver: 272000, settlement: 62000 },
  { name: "Week 4", platform: 84000, driver: 336000, settlement: 78000 },
];

export const BUSINESS_FLOW_STEPS = [
  { step: 1, label: "Customer Books", icon: "ShoppingCart" },
  { step: 2, label: "Vehicle Selected", icon: "Truck" },
  { step: 3, label: "Goods Type", icon: "Package" },
  { step: 4, label: "Pricing Rule", icon: "IndianRupee" },
  { step: 5, label: "Coupon Applied", icon: "Ticket" },
  { step: 6, label: "Surge Pricing", icon: "TrendingUp" },
  { step: 7, label: "Taxes & Fees", icon: "Receipt" },
  { step: 8, label: "Platform Commission", icon: "Percent" },
  { step: 9, label: "Driver Earnings", icon: "Wallet" },
  { step: 10, label: "Wallet Settlement", icon: "CreditCard" },
  { step: 11, label: "Reports", icon: "FileText" },
];
