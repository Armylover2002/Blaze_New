import { FoodRestaurant } from '../../restaurant/models/restaurant.model.js';
import { FoodFeeSettings } from '../../admin/models/feeSettings.model.js';
import { ValidationError } from '../../../../core/auth/errors.js';
import { resolveRestaurantCommissionPercentage } from '../../constants/commission.constants.js';
import { roadDistanceKm } from './order.helpers.js';
import { resolveRestaurantObjectId, validateAndApplyCoupon } from '../../shared/coupon.util.js';
import { resolveDiscountSplitByCoupon } from '../../shared/discountSplit.util.js';

function roundCurrency(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Number(num.toFixed(2));
}

function calculateBaseDeliveryFeeForDistance(distanceKm, feeSettings) {
  const distance = Number(distanceKm);
  if (!Number.isFinite(distance) || distance < 0) return 0;

  if (Array.isArray(feeSettings?.deliveryDistanceSlabs) && feeSettings.deliveryDistanceSlabs.length > 0) {
    const baseSlab = feeSettings.deliveryDistanceSlabs.find((s) => Number(s.fromKm || 0) === 0);
    
    if (!baseSlab) {
      // Fallback: If no base slab exists starting at 0, do traditional range matching
      const matchedSlab = feeSettings.deliveryDistanceSlabs.find(
        (slab) => distance >= Number(slab.fromKm) && distance <= Number(slab.toKm)
      );
      if (matchedSlab) {
        return roundCurrency(Number(matchedSlab.deliveryFee));
      }
      const sortedSlabs = [...feeSettings.deliveryDistanceSlabs].sort((a, b) => Number(b.toKm) - Number(a.toKm));
      if (sortedSlabs.length > 0 && distance > Number(sortedSlabs[0].toKm)) {
        return roundCurrency(Number(sortedSlabs[0].deliveryFee));
      }
      return 60;
    }

    const baseFee = Number(baseSlab.deliveryFee || 0);
    const baseMax = Number(baseSlab.toKm || 0);

    // If distance is within the base slab (e.g. 0-5 km)
    if (distance <= baseMax) {
      return roundCurrency(baseFee);
    }

    // Distance is greater than baseMax (e.g. > 5 km).
    const sorted = [...feeSettings.deliveryDistanceSlabs].sort((a, b) => Number(a.fromKm || 0) - Number(b.fromKm || 0));
    let totalFee = baseFee;

    for (const slab of sorted) {
      const slabMin = Number(slab.fromKm || 0);
      if (slabMin === 0) continue; // Skip base slab as it is already included

      const slabMax = slab.toKm == null ? null : Number(slab.toKm);
      const rate = Number(slab.deliveryFee || 0);

      if (distance <= slabMin) continue;

      const upper = slabMax == null ? distance : Math.min(distance, slabMax);
      const kmInSlab = Math.max(0, upper - slabMin);

      if (kmInSlab > 0) {
        totalFee += kmInSlab * rate;
      }
    }

    return roundCurrency(totalFee);
  }

  // Pure distance-based default: 60 delivery fee
  return 60;
}

function resolveSponsorRule(subtotal, distanceKm, sponsorRules = []) {
  const safeSubtotal = Number(subtotal);
  const safeDistance = Number(distanceKm);
  if (!Number.isFinite(safeSubtotal) || !Number.isFinite(safeDistance)) return null;

  const normalizedRules = (Array.isArray(sponsorRules) ? sponsorRules : [])
    .map((rule, index) => ({
      index,
      minOrderAmount: Number(rule?.minOrderAmount),
      maxOrderAmount:
        rule?.maxOrderAmount == null || rule?.maxOrderAmount === ''
          ? null
          : Number(rule.maxOrderAmount),
      maxDistanceKm: Number(rule?.maxDistanceKm),
      sponsorType: String(rule?.sponsorType || '').trim().toUpperCase(),
      sponsoredKm:
        rule?.sponsoredKm == null || rule?.sponsoredKm === ''
          ? null
          : Number(rule.sponsoredKm),
    }))
    .filter((rule) =>
      Number.isFinite(rule.minOrderAmount) &&
      Number.isFinite(rule.maxDistanceKm) &&
      ["USER_FULL", "RESTAURANT_FULL", "SPLIT"].includes(rule.sponsorType),
    )
    .sort((a, b) => {
      if (b.minOrderAmount !== a.minOrderAmount) return b.minOrderAmount - a.minOrderAmount;
      if (a.maxDistanceKm !== b.maxDistanceKm) return a.maxDistanceKm - b.maxDistanceKm;
      return a.index - b.index;
    });

  return normalizedRules.find((rule) => {
    const orderOk =
      safeSubtotal >= rule.minOrderAmount &&
      (rule.maxOrderAmount == null || safeSubtotal <= rule.maxOrderAmount);
    return orderOk && safeDistance <= rule.maxDistanceKm;
  }) || null;
}

export async function calculateOrderPricing(userId, dto) {
  const restaurant = await FoodRestaurant.findById(dto.restaurantId)
    .select("status location commissionPercentage")
    .lean();
  if (!restaurant) throw new ValidationError("Restaurant not found");
  if (restaurant.status !== "approved")
    throw new ValidationError("Restaurant not available");

  const items = Array.isArray(dto.items) ? dto.items : [];
  const subtotal = items.reduce(
    (sum, it) => sum + (Number(it.price) || 0) * (Number(it.quantity) || 1),
    0,
  );

  const feeDoc = await FoodFeeSettings.findOne({ isActive: true })
    .sort({ createdAt: -1 })
    .lean();
  const feeSettings = {
    deliveryFee: 25,
    baseDistanceKm: 3,
    baseDeliveryFee: 25,
    perKmCharge: 10,
    sponsorRules: [],
    platformFee: 5,
    gstRate: 5,
    ...(feeDoc || {}),
  };
  feeSettings.deliveryDistanceSlabs = Array.isArray(feeSettings.deliveryDistanceSlabs)
    ? feeSettings.deliveryDistanceSlabs
    : [];

  const packagingFee = 0;
  const platformFee = Number(feeSettings.platformFee || 0);

  const restaurantCoords = restaurant?.location?.coordinates;
  const customerCoords = dto?.address?.location?.coordinates;
  const distanceKm =
    Array.isArray(restaurantCoords) &&
    restaurantCoords.length === 2 &&
    Array.isArray(customerCoords) &&
    customerCoords.length === 2
      ? await roadDistanceKm(
          Number(restaurantCoords[1]),
          Number(restaurantCoords[0]),
          Number(customerCoords[1]),
          Number(customerCoords[0]),
        )
      : 0;

  const totalDeliveryFee = calculateBaseDeliveryFeeForDistance(distanceKm, feeSettings);
  const matchedRule = (Array.isArray(feeSettings?.deliveryDistanceSlabs) && feeSettings.deliveryDistanceSlabs.length > 0)
    ? null
    : resolveSponsorRule(subtotal, distanceKm, feeSettings.sponsorRules);
  let restaurantDeliveryFee = 0;
  let userDeliveryFee = totalDeliveryFee;
  let sponsoredKm = 0;
  let deliverySponsorType = 'USER_FULL';

  if (matchedRule?.sponsorType === 'RESTAURANT_FULL') {
    restaurantDeliveryFee = totalDeliveryFee;
    userDeliveryFee = 0;
    sponsoredKm = roundCurrency(distanceKm);
    deliverySponsorType = 'RESTAURANT_FULL';
  } else if (matchedRule?.sponsorType === 'SPLIT') {
    const safeSponsoredKm = Math.max(0, Math.min(Number(distanceKm || 0), Number(matchedRule.sponsoredKm || 0)));
    restaurantDeliveryFee = Math.min(
      totalDeliveryFee,
      calculateBaseDeliveryFeeForDistance(safeSponsoredKm, feeSettings),
    );
    userDeliveryFee = Math.max(0, roundCurrency(totalDeliveryFee - restaurantDeliveryFee));
    sponsoredKm = roundCurrency(safeSponsoredKm);
    deliverySponsorType = 'SPLIT';
  }
  const deliveryFee = roundCurrency(userDeliveryFee);

  const gstRate = Number(feeSettings.gstRate || 0);
  let tax = 0;

  let discount = 0;
  let appliedCoupon = null;
  const codeRaw = dto.couponCode
    ? String(dto.couponCode).trim().toUpperCase()
    : "";
  const resolvedRestaurantObjectId = await resolveRestaurantObjectId(dto.restaurantId);

  if (codeRaw) {
    const validation = await validateAndApplyCoupon({
      couponCode: codeRaw,
      itemSubtotal: subtotal,
      userId,
      resolvedRestaurantObjectId,
    });

    if (validation?.discount > 0) {
      discount = validation.discount;
      appliedCoupon = validation.appliedCoupon;
    }
  }

  const discountedSubtotal = Math.max(0, subtotal - discount);
  tax =
    Number.isFinite(gstRate) && gstRate > 0
      ? Math.round(discountedSubtotal * (gstRate / 100))
      : 0;

  const total = Math.max(
    0,
    subtotal + packagingFee + deliveryFee + platformFee + tax - discount,
  );

  const commissionPercentage = resolveRestaurantCommissionPercentage(
    restaurant?.commissionPercentage,
  );
  // Commission on food GMV after restaurant-borne discount (not full pre-discount subtotal).
  let restaurantDiscountShareForCommission = 0;
  if (discount > 0) {
    const split = await resolveDiscountSplitByCoupon({
      couponCode: appliedCoupon?.code || codeRaw || "",
      discount,
      couponSource: appliedCoupon?.source,
    });
    restaurantDiscountShareForCommission = Math.max(
      0,
      Number(split.restaurantDiscountShare || 0),
    );
  }
  const commissionBase = Math.max(0, subtotal - restaurantDiscountShareForCommission);
  const restaurantCommission = roundCurrency(
    commissionBase * (commissionPercentage / 100),
  );

  return {
    pricing: {
      subtotal,
      tax,
      packagingFee,
      deliveryFee,
      totalDeliveryFee: roundCurrency(totalDeliveryFee),
      userDeliveryFee: roundCurrency(userDeliveryFee),
      restaurantDeliveryFee: roundCurrency(restaurantDeliveryFee),
      sponsoredDelivery: roundCurrency(restaurantDeliveryFee) > 0,
      sponsoredKm,
      deliveryDistanceKm: roundCurrency(distanceKm),
      deliverySponsorType,
      platformFee,
      discount,
      restaurantCommissionPercentage: commissionPercentage,
      restaurantCommission,
      total,
      currency: "INR",
      couponCode: appliedCoupon?.code || codeRaw || null,
      appliedCoupon,
    },
  };
}
