/**
 * Local pricing simulator — no API calls.
 * Combines vehicle, goods, zone, surge, fees, commission, and coupon logic.
 */

function roundAmount(n, roundOff = true) {
  return roundOff ? Math.round(n) : Math.round(n * 100) / 100;
}

export function calculateCouponDiscount(subtotal, coupon) {
  if (!coupon || coupon.status !== "active") return 0;
  if (subtotal < (coupon.minOrderValue || 0)) return 0;
  let discount = 0;
  if (coupon.discountType === "percentage") {
    discount = (subtotal * coupon.discountValue) / 100;
    if (coupon.maxDiscount) discount = Math.min(discount, coupon.maxDiscount);
  } else {
    discount = coupon.discountValue;
  }
  return Math.min(discount, subtotal);
}

export function calculateCommission(amount, commission) {
  if (!commission) return 0;
  if (commission.type === "percentage") {
    return (amount * commission.percentage) / 100;
  }
  if (commission.type === "flat") {
    return commission.flatAmount;
  }
  // hybrid
  return (amount * commission.percentage) / 100 + commission.flatAmount;
}

export function calculateTripPrice({
  vehiclePricing,
  goodsPricing,
  zonePricing,
  platformFees,
  platformCommission,
  distanceKm = 5,
  waitingMinutes = 0,
  surgeMultiplier = 1,
  coupon = null,
  applyNight = false,
  applyPeak = false,
}) {
  if (!vehiclePricing) return null;

  const zone = zonePricing || {};
  const goods = goodsPricing || {};
  const fees = platformFees || {};

  const baseFare = zone.baseFare || vehiclePricing.baseFare;
  const perKm = zone.perKm || vehiclePricing.perKm;
  const distanceCharge = perKm * distanceKm;
  const waitingCharge = (vehiclePricing.waitingCharge || 0) * waitingMinutes;

  let goodsCharge = (goods.basePrice || 0) + (goods.perKm || 0) * distanceKm
    + (goods.loadingFee || 0) + (goods.handlingFee || 0) + (goods.insurance || 0);

  let surcharges = 0;
  if (applyNight) surcharges += vehiclePricing.nightCharge || 0;
  if (applyPeak) surcharges += vehiclePricing.peakCharge || 0;

  const subtotalBeforeSurge = baseFare + distanceCharge + waitingCharge + goodsCharge + surcharges;
  const surgeAmount = subtotalBeforeSurge * (surgeMultiplier - 1);
  const subtotalAfterSurge = subtotalBeforeSurge + surgeAmount;

  const convenienceFee = fees.convenienceFee || 0;
  const platformFee = fees.platformFee || vehiclePricing.platformFee || 0;
  const insuranceFee = fees.insuranceFee || vehiclePricing.insuranceFee || 0;
  const serviceFee = fees.serviceFee || 0;
  const feesTotal = convenienceFee + platformFee + insuranceFee + serviceFee;

  const preTaxTotal = Math.max(subtotalAfterSurge, vehiclePricing.minimumFare || 0) + feesTotal;
  const couponDiscount = calculateCouponDiscount(preTaxTotal, coupon);
  const afterDiscount = preTaxTotal - couponDiscount;

  const gstPercent = fees.gstPercent || vehiclePricing.gst || 5;
  const gst = (afterDiscount * gstPercent) / 100;
  const customerPays = roundAmount(afterDiscount + gst, fees.roundOff);

  const commissionAmount = calculateCommission(afterDiscount, platformCommission);
  const driverPct = platformCommission?.driverShare ?? 78;
  const platformPct = platformCommission?.platformShare ?? 17;
  const partnerPct = platformCommission?.partnerShare ?? 5;

  const driverEarnings = roundAmount((afterDiscount * driverPct) / 100, fees.roundOff);
  const platformEarnings = roundAmount((afterDiscount * platformPct) / 100 + commissionAmount, fees.roundOff);
  const partnerEarnings = roundAmount((afterDiscount * partnerPct) / 100, fees.roundOff);

  return {
    baseFare,
    distanceCharge: roundAmount(distanceCharge, fees.roundOff),
    waitingCharge: roundAmount(waitingCharge, fees.roundOff),
    goodsCharge: roundAmount(goodsCharge, fees.roundOff),
    surcharges: roundAmount(surcharges, fees.roundOff),
    surgeAmount: roundAmount(surgeAmount, fees.roundOff),
    convenienceFee,
    platformFee,
    insuranceFee,
    serviceFee,
    feesTotal,
    couponDiscount: roundAmount(couponDiscount, fees.roundOff),
    gst: roundAmount(gst, fees.roundOff),
    commissionAmount: roundAmount(commissionAmount, fees.roundOff),
    driverEarnings,
    platformEarnings,
    partnerEarnings,
    customerPays,
    subtotal: roundAmount(preTaxTotal, fees.roundOff),
  };
}

export function formatCommissionLabel(commission) {
  if (!commission) return "—";
  if (commission.type === "percentage") return `${commission.percentage}%`;
  if (commission.type === "flat") return `₹${commission.flatAmount}`;
  return `${commission.percentage}% + ₹${commission.flatAmount}`;
}
