export const MOCK_PRICING_RULES = [
  { id: "PR-001", name: "City Standard Bike", type: "vehicle", scope: "Bike", zone: "All Zones", baseFare: 40, perKm: 8, waitingCharge: 2, minimumFare: 60, commissionPercent: 12, surgeMultiplier: 1.0, nightCharge: 15, holidayCharge: 25, status: "active" },
  { id: "PR-002", name: "City Mini Truck", type: "vehicle", scope: "Mini Truck", zone: "All Zones", baseFare: 120, perKm: 18, waitingCharge: 5, minimumFare: 200, commissionPercent: 15, surgeMultiplier: 1.0, nightCharge: 40, holidayCharge: 60, status: "active" },
  { id: "PR-003", name: "Andheri Zone Premium", type: "zone", scope: "Andheri East", zone: "Andheri East", baseFare: 80, perKm: 14, waitingCharge: 4, minimumFare: 150, commissionPercent: 14, surgeMultiplier: 1.2, nightCharge: 30, holidayCharge: 50, status: "active" },
  { id: "PR-004", name: "Bandra Surge", type: "zone", scope: "Bandra West", zone: "Bandra West", baseFare: 90, perKm: 16, waitingCharge: 4, minimumFare: 160, commissionPercent: 14, surgeMultiplier: 1.5, nightCharge: 35, holidayCharge: 55, status: "active" },
  { id: "PR-005", name: "Pickup Heavy Load", type: "vehicle", scope: "Pickup", zone: "All Zones", baseFare: 150, perKm: 22, waitingCharge: 6, minimumFare: 280, commissionPercent: 16, surgeMultiplier: 1.0, nightCharge: 50, holidayCharge: 80, status: "active" },
  { id: "PR-006", name: "Thane Intercity", type: "zone", scope: "Thane", zone: "Thane", baseFare: 100, perKm: 20, waitingCharge: 5, minimumFare: 220, commissionPercent: 15, surgeMultiplier: 1.1, nightCharge: 45, holidayCharge: 70, status: "active" },
  { id: "PR-007", name: "EV Loader Eco", type: "vehicle", scope: "EV Loader", zone: "All Zones", baseFare: 100, perKm: 15, waitingCharge: 3, minimumFare: 180, commissionPercent: 13, surgeMultiplier: 1.0, nightCharge: 25, holidayCharge: 40, status: "active" },
  { id: "PR-008", name: "Three Wheeler Local", type: "vehicle", scope: "Three Wheeler", zone: "All Zones", baseFare: 60, perKm: 10, waitingCharge: 2, minimumFare: 90, commissionPercent: 11, surgeMultiplier: 1.0, nightCharge: 20, holidayCharge: 30, status: "inactive" },
  { id: "PR-009", name: "Powai Corporate", type: "zone", scope: "Powai", zone: "Powai", baseFare: 85, perKm: 15, waitingCharge: 4, minimumFare: 170, commissionPercent: 14, surgeMultiplier: 1.15, nightCharge: 32, holidayCharge: 48, status: "active" },
  { id: "PR-010", name: "Tempo Industrial", type: "vehicle", scope: "Tempo", zone: "All Zones", baseFare: 180, perKm: 24, waitingCharge: 7, minimumFare: 320, commissionPercent: 17, surgeMultiplier: 1.0, nightCharge: 55, holidayCharge: 90, status: "active" },
];

export const MOCK_COMMISSION_SUMMARY = {
  avgCommission: "14.2%",
  activeRules: MOCK_PRICING_RULES.filter((r) => r.status === "active").length,
  surgeZones: 3,
  revenueShare: "₹8.4L",
};

export const MOCK_PRICING_CHART = [
  { name: "Mon", revenue: 42000, commission: 5800 },
  { name: "Tue", revenue: 48000, commission: 6400 },
  { name: "Wed", revenue: 51000, commission: 7100 },
  { name: "Thu", revenue: 46000, commission: 6200 },
  { name: "Fri", revenue: 62000, commission: 8900 },
  { name: "Sat", revenue: 75000, commission: 10200 },
  { name: "Sun", revenue: 68000, commission: 9400 },
];
