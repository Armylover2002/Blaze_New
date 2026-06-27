export const RIDE_VEHICLE_TYPES = [
  "Bike", "Scooter", "Auto", "Pickup", "Mini Truck", "Tempo", "Van", "Truck", "Container", "EV Van",
];

export const RIDE_TYPES = ["Standard", "Express", "Scheduled", "Intercity"];
export const VEHICLE_CATEGORIES = ["Two Wheeler", "Three Wheeler", "Light Commercial", "Heavy Commercial", "Electric"];
export const COUPON_APPLIES_ON = [
  { value: "ride_fare", label: "Ride Fare" },
  { value: "platform_fee", label: "Platform Fee" },
  { value: "total_bill", label: "Total Bill" },
];

function buildPreset(vehicle, overrides = {}) {
  const base = {
    vehicle,
    basicFare: {
      baseFare: 40,
      rideType: "Standard",
      vehicleCategory: "Two Wheeler",
      minimumFare: 60,
      maximumFare: "",
      currency: "INR",
    },
    distancePricing: {
      enabled: true,
      baseDistanceKm: 2,
      includedDistanceKm: 2,
      pricePerKm: 8,
      minimumDistanceKm: 1,
      maximumDistanceKm: 100,
    },
    timePricing: {
      pricePerMinute: 1.5,
      waitingChargePerMinute: 2,
      loadingTimeFreeMinutes: 5,
      loadingChargePerMinute: 3,
      unloadingTimeFreeMinutes: 5,
      unloadingChargePerMinute: 3,
    },
    driverEarnings: {
      minimumDriverEarning: 50,
      guaranteedDriverEarnings: 80,
      nightBonus: 25,
      peakBonus: 20,
      incentive: 15,
      surgeSharePercent: 80,
    },
    adminEarnings: {
      commissionType: "percentage",
      commissionPercentage: 12,
      commissionFlat: 20,
      platformFee: 15,
      convenienceFee: 10,
      technologyFee: 5,
      insuranceFee: 8,
      serviceTaxPercent: 0,
      gstPercent: 5,
      roundOffFare: true,
    },
    peakHour: {
      enabled: true,
      morningStart: "08:00",
      morningEnd: "11:00",
      eveningStart: "17:00",
      eveningEnd: "21:00",
      peakMultiplier: 1.3,
    },
    nightCharges: {
      enabled: true,
      nightStart: "22:00",
      nightEnd: "06:00",
      nightChargePercent: 15,
      flatNightFee: 30,
    },
    weekendPricing: {
      enabled: true,
      saturdayMultiplier: 1.15,
      sundayMultiplier: 1.2,
      holidayMultiplier: 1.5,
    },
    cancellation: {
      customerCancellationFee: 40,
      driverCancellationPenalty: 100,
      freeCancellationTimeMinutes: 5,
      lateCancellationFee: 80,
    },
    extraCharges: {
      tollCharges: 0,
      parkingCharges: 0,
      stateTax: 0,
      intercityCharge: 50,
      outstationCharge: 200,
      returnTripCharge: 150,
      extraStopCharge: 25,
      extraStopPrice: 30,
    },
    couponSupport: {
      allowCoupons: true,
      maximumDiscount: 200,
      minimumRideAmount: 100,
      couponAppliesOn: "total_bill",
    },
  };
  return { ...base, ...overrides, basicFare: { ...base.basicFare, ...overrides.basicFare }, distancePricing: { ...base.distancePricing, ...overrides.distancePricing } };
}

export const RIDE_FARE_PRESETS = {
  Bike: buildPreset("Bike", {
    basicFare: { baseFare: 40, rideType: "Standard", vehicleCategory: "Two Wheeler", minimumFare: 60, maximumFare: 500 },
    distancePricing: { pricePerKm: 8, includedDistanceKm: 2 },
    timePricing: { pricePerMinute: 1.5, waitingChargePerMinute: 2 },
    driverEarnings: { minimumDriverEarning: 50, guaranteedDriverEarnings: 80 },
    adminEarnings: { commissionPercentage: 12, platformFee: 8 },
  }),
  Scooter: buildPreset("Scooter", {
    basicFare: { baseFare: 35, rideType: "Express", vehicleCategory: "Two Wheeler", minimumFare: 55, maximumFare: 450 },
    distancePricing: { pricePerKm: 7, includedDistanceKm: 2 },
    timePricing: { pricePerMinute: 1.2, waitingChargePerMinute: 1.5 },
    adminEarnings: { commissionPercentage: 11, platformFee: 7 },
  }),
  Auto: buildPreset("Auto", {
    basicFare: { baseFare: 60, rideType: "Standard", vehicleCategory: "Three Wheeler", minimumFare: 90, maximumFare: 800 },
    distancePricing: { pricePerKm: 10, includedDistanceKm: 1.5 },
    timePricing: { pricePerMinute: 2, waitingChargePerMinute: 2.5, loadingChargePerMinute: 4 },
    driverEarnings: { minimumDriverEarning: 70, guaranteedDriverEarnings: 100, peakBonus: 25 },
    adminEarnings: { commissionPercentage: 14, platformFee: 12 },
  }),
  Pickup: buildPreset("Pickup", {
    basicFare: { baseFare: 150, rideType: "Standard", vehicleCategory: "Light Commercial", minimumFare: 280, maximumFare: 5000 },
    distancePricing: { pricePerKm: 22, includedDistanceKm: 3, baseDistanceKm: 3 },
    timePricing: { pricePerMinute: 4, waitingChargePerMinute: 6, loadingTimeFreeMinutes: 10, loadingChargePerMinute: 8 },
    driverEarnings: { minimumDriverEarning: 150, guaranteedDriverEarnings: 250, surgeSharePercent: 75 },
    adminEarnings: { commissionType: "hybrid", commissionPercentage: 5, commissionFlat: 25, platformFee: 25 },
    peakHour: { peakMultiplier: 1.4 },
  }),
  "Mini Truck": buildPreset("Mini Truck", {
    basicFare: { baseFare: 120, rideType: "Standard", vehicleCategory: "Light Commercial", minimumFare: 200, maximumFare: 4500 },
    distancePricing: { pricePerKm: 18, includedDistanceKm: 3 },
    timePricing: { pricePerMinute: 3, waitingChargePerMinute: 5, loadingChargePerMinute: 6 },
    adminEarnings: { commissionPercentage: 15, platformFee: 20 },
  }),
  Tempo: buildPreset("Tempo", {
    basicFare: { baseFare: 180, rideType: "Scheduled", vehicleCategory: "Heavy Commercial", minimumFare: 320, maximumFare: 8000 },
    distancePricing: { pricePerKm: 24, includedDistanceKm: 4, maximumDistanceKm: 200 },
    timePricing: { pricePerMinute: 5, waitingChargePerMinute: 7, loadingTimeFreeMinutes: 15 },
    driverEarnings: { minimumDriverEarning: 200, guaranteedDriverEarnings: 350 },
    adminEarnings: { commissionType: "hybrid", commissionPercentage: 6, commissionFlat: 30, platformFee: 30 },
    extraCharges: { intercityCharge: 80, outstationCharge: 350 },
  }),
  Van: buildPreset("Van", {
    basicFare: { baseFare: 130, rideType: "Standard", vehicleCategory: "Light Commercial", minimumFare: 220, maximumFare: 6000 },
    distancePricing: { pricePerKm: 20, includedDistanceKm: 3 },
    adminEarnings: { commissionPercentage: 14, platformFee: 22 },
  }),
  Truck: buildPreset("Truck", {
    basicFare: { baseFare: 350, rideType: "Scheduled", vehicleCategory: "Heavy Commercial", minimumFare: 600, maximumFare: 15000 },
    distancePricing: { pricePerKm: 35, includedDistanceKm: 5, maximumDistanceKm: 500 },
    timePricing: { pricePerMinute: 8, waitingChargePerMinute: 10, loadingTimeFreeMinutes: 20, loadingChargePerMinute: 12 },
    driverEarnings: { minimumDriverEarning: 400, guaranteedDriverEarnings: 600, surgeSharePercent: 70 },
    adminEarnings: { commissionType: "hybrid", commissionPercentage: 8, commissionFlat: 50, platformFee: 45, gstPercent: 5 },
    peakHour: { peakMultiplier: 1.5 },
    extraCharges: { intercityCharge: 150, outstationCharge: 500, returnTripCharge: 300 },
  }),
  Container: buildPreset("Container", {
    basicFare: { baseFare: 800, rideType: "Intercity", vehicleCategory: "Heavy Commercial", minimumFare: 1500, maximumFare: 50000 },
    distancePricing: { pricePerKm: 55, includedDistanceKm: 10, maximumDistanceKm: 1000 },
    timePricing: { pricePerMinute: 12, waitingChargePerMinute: 15, loadingTimeFreeMinutes: 30 },
    driverEarnings: { minimumDriverEarning: 800, guaranteedDriverEarnings: 1200, surgeSharePercent: 65 },
    adminEarnings: { commissionType: "percentage", commissionPercentage: 10, platformFee: 80, gstPercent: 5 },
    weekendPricing: { holidayMultiplier: 1.8 },
    extraCharges: { intercityCharge: 300, outstationCharge: 1200, returnTripCharge: 800 },
  }),
  "EV Van": buildPreset("EV Van", {
    basicFare: { baseFare: 100, rideType: "Express", vehicleCategory: "Electric", minimumFare: 180, maximumFare: 4000 },
    distancePricing: { pricePerKm: 15, includedDistanceKm: 3 },
    timePricing: { pricePerMinute: 2.5, waitingChargePerMinute: 3 },
    driverEarnings: { minimumDriverEarning: 100, guaranteedDriverEarnings: 160, incentive: 25 },
    adminEarnings: { commissionPercentage: 13, platformFee: 15, technologyFee: 8 },
    nightCharges: { nightChargePercent: 12, flatNightFee: 25 },
  }),
};

export const DEFAULT_RIDE_FARE_CONFIG = JSON.parse(JSON.stringify(RIDE_FARE_PRESETS.Bike));

export function getRideFareConfigForVehicle(vehicle) {
  const preset = RIDE_FARE_PRESETS[vehicle];
  return preset ? JSON.parse(JSON.stringify(preset)) : JSON.parse(JSON.stringify(DEFAULT_RIDE_FARE_CONFIG));
}
