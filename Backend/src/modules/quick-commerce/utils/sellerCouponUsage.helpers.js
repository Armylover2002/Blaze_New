import mongoose from 'mongoose';
import { ValidationError } from '../../../core/auth/errors.js';
import { SellerCoupon } from '../models/sellerCoupon.model.js';
import { SellerCouponUsage } from '../models/sellerCouponUsage.model.js';

const getConsumerIdentity = ({ userId = null, sessionId = null } = {}) => {
  const normalizedUserId = userId && mongoose.Types.ObjectId.isValid(String(userId))
    ? String(userId)
    : '';
  if (normalizedUserId) {
    return {
      consumerKey: `user:${normalizedUserId}`,
      userId: new mongoose.Types.ObjectId(normalizedUserId),
      sessionId: null,
    };
  }

  const normalizedSessionId = String(sessionId || '').trim();
  if (normalizedSessionId) {
    return {
      consumerKey: `session:${normalizedSessionId}`,
      userId: null,
      sessionId: normalizedSessionId,
    };
  }

  return null;
};

export const getQuickSellerCouponUsageConsumer = (context = {}) => getConsumerIdentity(context);

export const getQuickSellerCouponEffectivePerUserLimit = (coupon) => {
  const configured = Number(coupon?.perUserLimit);
  if (Number.isFinite(configured) && configured > 0) return configured;
  return 1;
};

export const isQuickSellerCouponUsageAvailable = async (coupon, context = {}) => {
  if (!coupon) return true;

  const consumer = getConsumerIdentity(context);
  if (!consumer) return false;

  const usageLimit = Number(coupon?.usageLimit);
  const hasUsageLimit = Number.isFinite(usageLimit) && usageLimit > 0;
  if (hasUsageLimit && Number(coupon.usedCount || 0) >= usageLimit) {
    return false;
  }

  if (!coupon._id) return false;
  const perUserLimit = getQuickSellerCouponEffectivePerUserLimit(coupon);
  const usage = await SellerCouponUsage.findOne({
    couponId: coupon._id,
    consumerKey: consumer.consumerKey,
  }).select('count').lean();

  return Number(usage?.count || 0) < perUserLimit;
};

export const consumeQuickSellerCouponUsage = async (coupon, context = {}) => {
  if (!coupon?._id) {
    throw new ValidationError('Coupon not found');
  }

  const consumer = getConsumerIdentity(context);
  if (!consumer) {
    throw new ValidationError('Customer identity is required to use this coupon');
  }

  const usageLimit = Number(coupon?.usageLimit);
  const hasUsageLimit = Number.isFinite(usageLimit) && usageLimit > 0;
  if (hasUsageLimit) {
    const usageResult = await SellerCoupon.updateOne(
      {
        _id: coupon._id,
        $or: [
          { usageLimit: { $exists: false } },
          { usageLimit: null },
          { usageLimit: 0 },
          { $expr: { $lt: ['$usedCount', '$usageLimit'] } },
        ],
      },
      { $inc: { usedCount: 1 } },
    );

    if (!usageResult.matchedCount) {
      throw new ValidationError('This coupon has reached its usage limit');
    }
  }

  const perUserLimit = getQuickSellerCouponEffectivePerUserLimit(coupon);
  const now = new Date();
  const perUserResult = await SellerCouponUsage.updateOne(
    {
      couponId: coupon._id,
      consumerKey: consumer.consumerKey,
      count: { $lt: perUserLimit },
    },
    {
      $setOnInsert: {
        couponId: coupon._id,
        sellerId: coupon.sellerId,
        userId: consumer.userId,
        sessionId: consumer.sessionId,
        consumerKey: consumer.consumerKey,
        count: 0,
        firstUsedAt: now,
      },
      $set: { lastUsedAt: now },
      $inc: { count: 1 },
    },
    { upsert: true },
  );

  if (!perUserResult.matchedCount && !perUserResult.upsertedCount) {
    if (hasUsageLimit) {
      await SellerCoupon.updateOne({ _id: coupon._id }, { $inc: { usedCount: -1 } });
    }
    throw new ValidationError('You have reached the per-user limit for this coupon');
  }

  return true;
};
