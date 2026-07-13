import { FoodFeeSettings } from '../admin/models/feeSettings.model.js';
import { getRoadDistanceKmValue } from '../../../services/roadDistance.service.js';
import {
  calculateDistanceKm,
  normalizeDeliveryAddress,
  normalizeRestaurantLocation,
  parseGeoPoint,
} from './geo.utils.js';

export const round2 = (value) => Math.round((Number(value) || 0) * 100) / 100;

export function resolveRestaurantToUserDistanceKm(restaurant, address) {
  const normalizedAddress = normalizeDeliveryAddress(address);
  const normalizedRestaurant = restaurant
    ? { ...restaurant, location: normalizeRestaurantLocation(restaurant.location) }
    : restaurant;
  const distanceKm = calculateDistanceKm(normalizedRestaurant, normalizedAddress);
  return Number.isFinite(distanceKm) ? Number(distanceKm.toFixed(2)) : null;
}

/** Road/travel distance (same source as home & restaurant details pages). */
export async function resolveRestaurantToUserRoadDistanceKm(restaurant, address) {
  const normalizedAddress = normalizeDeliveryAddress(address);
  const normalizedRestaurant = restaurant
    ? { ...restaurant, location: normalizeRestaurantLocation(restaurant.location) }
    : restaurant;

  const from = parseGeoPoint(normalizedRestaurant);
  const to = parseGeoPoint(normalizedAddress);
  if (!from || !to) {
    return resolveRestaurantToUserDistanceKm(restaurant, address);
  }

  try {
    const distanceKm = await getRoadDistanceKmValue(from, to);
    if (Number.isFinite(distanceKm) && distanceKm > 0) {
      return Number(distanceKm.toFixed(2));
    }
  } catch {
    // Fall through to straight-line estimate.
  }

  return resolveRestaurantToUserDistanceKm(restaurant, address);
}

function resolveBaseDeliveryFee(feeSettings = {}) {
  const ranges = Array.isArray(feeSettings.deliveryFeeRanges)
    ? feeSettings.deliveryFeeRanges
    : [];
  const rangeFees = ranges
    .map((range) => Number(range?.fee))
    .filter((fee) => Number.isFinite(fee) && fee >= 0);

  const flat = Number(feeSettings.deliveryFee ?? feeSettings.baseDeliveryFee);
  const hasPositiveFlat = Number.isFinite(flat) && flat > 0;

  if (rangeFees.length > 0) {
    const minRangeFee = Math.min(...rangeFees);
    return hasPositiveFlat ? flat : minRangeFee;
  }

  return Number.isFinite(flat) && flat >= 0 ? flat : 0;
}

function matchFeeRange(ranges, distanceKm, pickValue) {
  if (!Array.isArray(ranges) || ranges.length === 0 || !Number.isFinite(distanceKm)) {
    return null;
  }

  const sorted = [...ranges].sort((a, b) => Number(a.min) - Number(b.min));
  for (let i = 0; i < sorted.length; i += 1) {
    const range = sorted[i] || {};
    const min = Number(range.min);
    const max = Number(range.max);
    if (!Number.isFinite(min) || !Number.isFinite(max)) continue;

    const isLast = i === sorted.length - 1;
    const inRange = isLast
      ? distanceKm >= min && distanceKm <= max
      : distanceKm >= min && distanceKm < max;

    if (inRange) {
      const value = pickValue(range);
      return Number.isFinite(value) ? value : null;
    }
  }

  return null;
}

export async function loadActiveFeeSettings() {
  const feeDoc = await FoodFeeSettings.findOne({ isActive: { $ne: false } })
    .sort({ createdAt: -1 })
    .lean();

  return (
    feeDoc || {
      deliveryFee: 0,
      deliveryFeeRanges: [],
      platformFee: 0,
      gstRate: 0,
    }
  );
}

export function hasDeliveryFeeRanges(feeSettings = {}) {
  return Array.isArray(feeSettings.deliveryFeeRanges) && feeSettings.deliveryFeeRanges.length > 0;
}

export function resolveUserDeliveryFee(feeSettings = {}, { subtotal = 0, distanceKm = null } = {}) {
  const ranges = Array.isArray(feeSettings.deliveryFeeRanges)
    ? feeSettings.deliveryFeeRanges
    : [];

  if (ranges.length > 0 && Number.isFinite(distanceKm)) {
    const matchedFee = matchFeeRange(ranges, distanceKm, (range) => Number(range.fee));
    if (Number.isFinite(matchedFee)) {
      return {
        deliveryFee: matchedFee,
        distanceKm: Number(distanceKm.toFixed(2)),
        source: 'distance',
      };
    }
  }

  const fallbackFee = resolveBaseDeliveryFee(feeSettings);
  return {
    deliveryFee: fallbackFee,
    distanceKm: Number.isFinite(distanceKm) ? Number(distanceKm.toFixed(2)) : null,
    source: Number.isFinite(distanceKm) ? 'default_unmatched_range' : 'default',
  };
}

export function calculateRiderEarning(feeSettings = {}, distanceKm) {
  const distance = Number(distanceKm);
  if (!Number.isFinite(distance) || distance < 0) return 0;

  const ranges = Array.isArray(feeSettings.deliveryFeeRanges)
    ? feeSettings.deliveryFeeRanges
    : [];
  if (ranges.length === 0) return 0;

  const earning = matchFeeRange(ranges, distance, (range) => {
    const basePay = Number(range.deliveryBoyBasePay || 0);
    const perKm = Number(range.deliveryBoyPerKm || 0);

    if (basePay > 0) return basePay;
    if (perKm > 0) return distance * perKm;
    return 0;
  });

  return Number.isFinite(earning) ? round2(earning) : 0;
}
