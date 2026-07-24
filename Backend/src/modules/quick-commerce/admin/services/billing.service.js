import mongoose from 'mongoose';
import { ValidationError } from '../../../../core/auth/errors.js';
import { QuickFeeSettings } from '../models/feeSettings.model.js';
import { QuickCategory } from '../../models/category.model.js';
import { calculateHeaderGstAmount } from './commission.service.js';

const DEFAULT_QUICK_FEE_SETTINGS = {
  deliveryFee: 25,
  deliveryFeeRanges: [],
  freeDeliveryThreshold: 0,
  platformFee: 0,
  returnWindowHours: 72,
  returnsEnabled: true,
  isActive: true,
};


const sanitizeFeeSettingsForApi = (doc) => {
  if (!doc) return null;
  const { returnDeliveryCommission, returnPickupFee, ...rest } = doc;
  return rest;
};

export async function getFeeSettings() {
  const doc = await QuickFeeSettings.findOne({ isActive: true }).sort({ createdAt: -1 }).lean();
  return { feeSettings: sanitizeFeeSettingsForApi(doc) };
}

export async function upsertFeeSettings(body) {
  const existing = await QuickFeeSettings.findOne({ isActive: true }).sort({ createdAt: -1 });
  if (existing) {
    const $set = {};
    const $unset = {};

    if (body.deliveryFeeRanges !== undefined) $set.deliveryFeeRanges = body.deliveryFeeRanges;

    if (body.platformFee === null) $unset.platformFee = 1;
    else if (body.platformFee !== undefined) $set.platformFee = body.platformFee;

    if (body.returnWindowHours === null) $unset.returnWindowHours = 1;
    else if (body.returnWindowHours !== undefined) {
      $set.returnWindowHours = body.returnWindowHours;
    }

    if (body.returnsEnabled !== undefined) $set.returnsEnabled = Boolean(body.returnsEnabled);

    if (body.isActive !== undefined) $set.isActive = body.isActive;

    const update = {};
    if (Object.keys($set).length) update.$set = $set;
    if (Object.keys($unset).length) update.$unset = $unset;
    if (!Object.keys(update).length) return sanitizeFeeSettingsForApi(existing.toObject());

    const updated = await QuickFeeSettings.findByIdAndUpdate(existing._id, update, { new: true }).lean();
    return sanitizeFeeSettingsForApi(updated);
  }

  const payload = {
    deliveryFeeRanges: body.deliveryFeeRanges ?? [],
    isActive: body.isActive ?? true,
    returnWindowHours: body.returnWindowHours ?? 72,
    returnsEnabled: body.returnsEnabled ?? true,
  };
  if (body.platformFee !== undefined && body.platformFee !== null) payload.platformFee = body.platformFee;

  const created = await QuickFeeSettings.create(payload);
  return sanitizeFeeSettingsForApi(created.toObject());
}

export async function getActiveFeeSettings() {
  const doc = await QuickFeeSettings.findOne({ isActive: true }).sort({ createdAt: -1 }).lean();
  return doc || DEFAULT_QUICK_FEE_SETTINGS;
}

export async function calculateHandlingFeeFromProducts(products = []) {
  const ids = new Set();

  for (const product of products) {
    const candidates = [product?.headerId, product?.categoryId, product?.subcategoryId];
    candidates.forEach((value) => {
      const normalized =
        value && typeof value === 'object' && value._id ? String(value._id) : String(value || '').trim();
      if (normalized && mongoose.Types.ObjectId.isValid(normalized)) {
        ids.add(normalized);
      }
    });
  }

  if (!ids.size) return 0;

  const categories = await QuickCategory.find({ _id: { $in: Array.from(ids) } })
    .select('_id handlingFees')
    .lean();

  return categories.reduce(
    (maxFee, category) => Math.max(maxFee, Number(category?.handlingFees || 0)),
    0,
  );
}

export function matchFeeRange(ranges, distance, resolver) {
  if (!Array.isArray(ranges) || ranges.length === 0) return 0;
  const sorted = [...ranges].sort((a, b) => Number(a.min) - Number(b.min));
  let matched = null;
  for (let i = 0; i < sorted.length; i += 1) {
    const range = sorted[i] || {};
    const min = Number(range.min);
    const max = Number(range.max);
    if (!Number.isFinite(min) || !Number.isFinite(max)) continue;
    const isLast = i === sorted.length - 1;
    const inRange = isLast
      ? distance >= min && distance <= max
      : distance >= min && distance < max;
    if (inRange) {
      matched = range;
      break;
    }
  }
  return matched ? resolver(matched) : 0;
}

export function calculateCustomerDeliveryFee(feeSettings, distanceKm) {
  const distance = Number(distanceKm);
  if (!Number.isFinite(distance) || distance < 0) return 0;
  const ranges = Array.isArray(feeSettings.deliveryFeeRanges) ? feeSettings.deliveryFeeRanges : [];
  if (ranges.length > 0) {
    const fee = matchFeeRange(ranges, distance, (range) => Number(range.fee || 0));
    return Number.isFinite(fee) && fee > 0 ? fee : 0;
  }
  return 0;
}

export function calculateRiderEarning(feeSettings = {}, distanceKm) {
  const distance = Number(distanceKm);
  if (!Number.isFinite(distance) || distance < 0) return 0;
  const ranges = Array.isArray(feeSettings.deliveryFeeRanges) ? feeSettings.deliveryFeeRanges : [];
  if (ranges.length > 0) {
    const earning = matchFeeRange(ranges, distance, (range) => {
      const basePay = Number(range.deliveryBoyBasePay || 0);
      const perKm = Number(range.deliveryBoyPerKm || 0);
      if (basePay > 0) return basePay;
      if (perKm > 0) return distance * perKm;
      return 0;
    });
    return Number.isFinite(earning) && earning > 0 ? Math.round(earning * 100) / 100 : 0;
  }
  return 0;
}

export async function calculateQuickPricing({
  subtotal = 0,
  discount = 0,
  products = [],
  items = [],
  distanceKm = 0,
} = {}) {
  const feeSettings = await getActiveFeeSettings();
  const safeSubtotal = Number(subtotal || 0);
  const safeDiscount = Math.max(0, Number(discount || 0));
  const platformFee = Number(feeSettings.platformFee || 0);

  const handlingFee = await calculateHandlingFeeFromProducts(products);

  const deliveryFee = calculateCustomerDeliveryFee(feeSettings, distanceKm);

  // GST % comes from Header Category only (not fee settings).
  const gst = await calculateHeaderGstAmount({
    products,
    items,
    subtotal: safeSubtotal,
  });

  const total = Math.max(0, safeSubtotal + deliveryFee + platformFee + gst - safeDiscount);

  return {
    pricing: {
      subtotal: safeSubtotal,
      gst,
      tax: 0,
      packagingFee: 0,
      deliveryFee,
      platformFee,
      handlingFee,
      restaurantCommission: 0,
      discount: safeDiscount,
      total,
      currency: 'INR',
    },
    snapshots: {
      feeSettings,
    },
  };
}

export async function getRiderEarning(distanceKm) {
  const feeSettings = await getActiveFeeSettings();
  return calculateRiderEarning(feeSettings, distanceKm);
}
