/**
 * Ride fare preview calculator — local only, no API.
 */

function round(n, enabled = true) {
  return enabled ? Math.round(n) : Math.round(n * 100) / 100;
}

function calcAdminCommission(amount, admin) {
  if (admin.commissionType === "percentage") {
    return (amount * admin.commissionPercentage) / 100;
  }
  if (admin.commissionType === "fixed") {
    return admin.commissionFlat || 0;
  }
  return (amount * admin.commissionPercentage) / 100 + (admin.commissionFlat || 0);
}

export function validateRideFareConfig(config) {
  const errors = {};
  if (!config.vehicle) errors.vehicle = "Vehicle is required";
  const baseFare = Number(config.basicFare?.baseFare);
  if (!Number.isFinite(baseFare) || baseFare < 0) errors.baseFare = "Valid base fare is required";
  const pricePerKm = Number(config.distancePricing?.pricePerKm);
  if (!Number.isFinite(pricePerKm) || pricePerKm < 0) errors.pricePerKm = "Valid price per KM is required";
  const admin = config.adminEarnings || {};
  if (admin.commissionType === "percentage" || admin.commissionType === "hybrid") {
    const commPct = Number(admin.commissionPercentage);
    if (!Number.isFinite(commPct) || commPct < 0) errors.commission = "Commission is required";
    else if (commPct > 100) errors.commission = "Commission cannot exceed 100%";
  }
  if (admin.commissionType === "fixed" || admin.commissionType === "hybrid") {
    if (Number(admin.commissionFlat) < 0) errors.commission = "Commission cannot be negative";
  }
  const gst = Number(admin.gstPercent);
  if (gst > 100) errors.gst = "GST cannot exceed 100%";
  const nightPct = Number(config.nightCharges?.nightChargePercent);
  if (nightPct > 100) errors.nightCharge = "Night charge cannot exceed 100%";
  const peakMult = Number(config.peakHour?.peakMultiplier);
  if (config.peakHour?.enabled && peakMult < 1) errors.peakMultiplier = "Peak multiplier minimum is 1";
  return errors;
}

export function calculateRideFarePreview(config, preview = {}) {
  const {
    distanceKm = 8,
    rideTimeMinutes = 25,
    waitingMinutes = 5,
    applyPeak = false,
    applyNight = false,
    couponDiscount = 0,
  } = preview;

  const roundOff = config.adminEarnings?.roundOffFare !== false;
  const dist = config.distancePricing || {};
  const time = config.timePricing || {};
  const admin = config.adminEarnings || {};
  const peak = config.peakHour || {};
  const night = config.nightCharges || {};

  const baseFare = Number(config.basicFare?.baseFare) || 0;
  const minFare = Number(config.basicFare?.minimumFare) || 0;

  let distanceFare = 0;
  if (dist.enabled !== false) {
    const billableKm = Math.max(0, distanceKm - (dist.includedDistanceKm || 0));
    distanceFare = billableKm * (Number(dist.pricePerKm) || 0);
  }

  const timeFare = rideTimeMinutes * (Number(time.pricePerMinute) || 0);
  const waitingFree = Number(time.loadingTimeFreeMinutes) || 0;
  const billableWait = Math.max(0, waitingMinutes - waitingFree);
  const waitingCharge = billableWait * (Number(time.waitingChargePerMinute) || 0);

  let rideSubtotal = baseFare + distanceFare + timeFare + waitingCharge;

  if (applyPeak && peak.enabled) {
    rideSubtotal *= Number(peak.peakMultiplier) || 1;
  }
  if (applyNight && night.enabled) {
    const nightPct = (rideSubtotal * (Number(night.nightChargePercent) || 0)) / 100;
    rideSubtotal += nightPct + (Number(night.flatNightFee) || 0);
  }

  rideSubtotal = Math.max(rideSubtotal, minFare);

  const platformFee = Number(admin.platformFee) || 0;
  const convenienceFee = Number(admin.convenienceFee) || 0;
  const technologyFee = Number(admin.technologyFee) || 0;
  const insuranceFee = Number(admin.insuranceFee) || 0;
  const feesTotal = platformFee + convenienceFee + technologyFee + insuranceFee;

  const preTax = rideSubtotal + feesTotal;
  const adminCommission = calcAdminCommission(preTax, admin);

  let discountBase = preTax;
  if (config.couponSupport?.couponAppliesOn === "ride_fare") discountBase = rideSubtotal;
  else if (config.couponSupport?.couponAppliesOn === "platform_fee") discountBase = feesTotal;

  const maxDisc = Number(config.couponSupport?.maximumDiscount) || 0;
  let discount = Math.min(Number(couponDiscount) || 0, maxDisc, discountBase);

  const afterDiscount = Math.max(0, preTax - discount);
  const serviceTax = (afterDiscount * (Number(admin.serviceTaxPercent) || 0)) / 100;
  const gst = (afterDiscount * (Number(admin.gstPercent) || 0)) / 100;
  const taxes = serviceTax + gst;

  const finalPayable = round(afterDiscount + taxes, roundOff);

  const driver = config.driverEarnings || {};
  const surgeShare = (Number(driver.surgeSharePercent) || 80) / 100;
  let driverEarnings = rideSubtotal * surgeShare;
  if (applyPeak) driverEarnings += Number(driver.peakBonus) || 0;
  if (applyNight) driverEarnings += Number(driver.nightBonus) || 0;
  driverEarnings += Number(driver.incentive) || 0;
  driverEarnings = Math.max(driverEarnings, Number(driver.minimumDriverEarning) || 0);
  driverEarnings = round(driverEarnings, roundOff);

  const adminEarnings = round(adminCommission + feesTotal - discount * (discountBase < preTax ? 0 : 0) + (preTax - rideSubtotal - feesTotal > 0 ? 0 : 0), roundOff);
  const adminTotal = round(adminCommission + platformFee + convenienceFee + technologyFee, roundOff);

  return {
    baseFare: round(baseFare, roundOff),
    distanceFare: round(distanceFare, roundOff),
    timeFare: round(timeFare, roundOff),
    waitingCharge: round(waitingCharge, roundOff),
    platformFee: round(platformFee, roundOff),
    convenienceFee: round(convenienceFee, roundOff),
    technologyFee: round(technologyFee, roundOff),
    insuranceFee: round(insuranceFee, roundOff),
    adminCommission: round(adminCommission, roundOff),
    serviceTax: round(serviceTax, roundOff),
    gst: round(gst, roundOff),
    taxes: round(taxes, roundOff),
    discount: round(discount, roundOff),
    finalPayable,
    driverEarnings,
    adminEarnings: adminTotal,
    rideSubtotal: round(rideSubtotal, roundOff),
  };
}
