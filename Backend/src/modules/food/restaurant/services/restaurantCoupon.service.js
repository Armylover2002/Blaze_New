import mongoose from 'mongoose';
import { ValidationError } from '../../../../core/auth/errors.js';
import { RestaurantCoupon } from '../../admin/models/restaurantCoupon.model.js';
import { FoodRestaurant } from '../models/restaurant.model.js';

export async function listRestaurantCoupons(restaurantId) {
    if (!restaurantId || !mongoose.Types.ObjectId.isValid(String(restaurantId))) {
        throw new ValidationError('Invalid restaurant id');
    }
    const filter = {
        restaurantId: new mongoose.Types.ObjectId(String(restaurantId))
    };
    return RestaurantCoupon.find(filter).sort({ createdAt: -1 }).lean();
}

export async function createRestaurantCoupon(restaurantId, body) {
    if (!restaurantId || !mongoose.Types.ObjectId.isValid(String(restaurantId))) {
        throw new ValidationError('Invalid restaurant id');
    }
    const rid = new mongoose.Types.ObjectId(String(restaurantId));
    
    const couponCode = String(body?.couponCode || '').trim().toUpperCase();
    if (!couponCode) throw new ValidationError('Coupon code is required');
    
    // Check if duplicate couponCode exists for this restaurant
    const existing = await RestaurantCoupon.findOne({
        restaurantId: rid,
        couponCode
    }).select('_id').lean();
    
    if (existing) {
        throw new ValidationError('A coupon with this code already exists for your restaurant');
    }

    const restaurant = await FoodRestaurant.findById(rid).select('restaurantName').lean();
    if (!restaurant) throw new ValidationError('Restaurant not found');

    const discountType = body?.discountType;
    if (!discountType || !['percentage', 'fixed'].includes(discountType)) {
        throw new ValidationError('Discount type must be percentage or fixed');
    }

    const discountValue = Number(body?.discountValue);
    if (!Number.isFinite(discountValue) || discountValue <= 0) {
        throw new ValidationError('Discount value must be greater than 0');
    }

    const expiryDate = body?.expiryDate ? new Date(body.expiryDate) : null;
    if (!expiryDate || Number.isNaN(expiryDate.getTime())) {
        throw new ValidationError('A valid expiry date is required');
    }

    const doc = await RestaurantCoupon.create({
        restaurantId: rid,
        restaurantName: restaurant.restaurantName || 'Unknown Restaurant',
        couponCode,
        discountType,
        discountValue,
        minOrderAmount: Number(body?.minOrderAmount) || 0,
        expiryDate,
        usageLimit: body?.usageLimit ? Number(body.usageLimit) : null,
        description: String(body?.description || '').trim(),
        status: 'Pending'
    });

    try {
        const { invalidateCache } = await import('../../../../middleware/cache.js');
        await invalidateCache('offers*');
    } catch (err) {
        console.error('Failed to invalidate offers cache on create:', err);
    }

    return doc.toObject();
}

export async function updateRestaurantCoupon(restaurantId, couponId, body) {
    if (!restaurantId || !mongoose.Types.ObjectId.isValid(String(restaurantId))) {
        throw new ValidationError('Invalid restaurant id');
    }
    if (!couponId || !mongoose.Types.ObjectId.isValid(String(couponId))) {
        throw new ValidationError('Invalid coupon id');
    }
    const rid = new mongoose.Types.ObjectId(String(restaurantId));
    const cid = new mongoose.Types.ObjectId(String(couponId));

    const existingCoupon = await RestaurantCoupon.findOne({ _id: cid, restaurantId: rid }).lean();
    if (!existingCoupon) {
        throw new ValidationError('Coupon not found');
    }

    const couponCode = String(body?.couponCode || '').trim().toUpperCase();
    if (!couponCode) throw new ValidationError('Coupon code is required');

    // Check duplicate excluding current
    const duplicate = await RestaurantCoupon.findOne({
        restaurantId: rid,
        couponCode,
        _id: { $ne: cid }
    }).select('_id').lean();

    if (duplicate) {
        throw new ValidationError('A coupon with this code already exists for your restaurant');
    }

    const discountType = body?.discountType;
    if (!discountType || !['percentage', 'fixed'].includes(discountType)) {
        throw new ValidationError('Discount type must be percentage or fixed');
    }

    const discountValue = Number(body?.discountValue);
    if (!Number.isFinite(discountValue) || discountValue <= 0) {
        throw new ValidationError('Discount value must be greater than 0');
    }

    const expiryDate = body?.expiryDate ? new Date(body.expiryDate) : null;
    if (!expiryDate || Number.isNaN(expiryDate.getTime())) {
        throw new ValidationError('A valid expiry date is required');
    }

    const updated = await RestaurantCoupon.findOneAndUpdate(
        { _id: cid, restaurantId: rid },
        {
            $set: {
                couponCode,
                discountType,
                discountValue,
                minOrderAmount: Number(body?.minOrderAmount) || 0,
                expiryDate,
                usageLimit: body?.usageLimit ? Number(body.usageLimit) : null,
                description: String(body?.description || '').trim(),
                status: 'Pending' // Reset to Pending upon edit
            }
        },
        { new: true }
    ).lean();

    try {
        const { invalidateCache } = await import('../../../../middleware/cache.js');
        await invalidateCache('offers*');
    } catch (err) {
        console.error('Failed to invalidate offers cache on update:', err);
    }

    return updated;
}

export async function deleteRestaurantCoupon(restaurantId, couponId) {
    if (!restaurantId || !mongoose.Types.ObjectId.isValid(String(restaurantId))) {
        throw new ValidationError('Invalid restaurant id');
    }
    if (!couponId || !mongoose.Types.ObjectId.isValid(String(couponId))) {
        throw new ValidationError('Invalid coupon id');
    }
    const rid = new mongoose.Types.ObjectId(String(restaurantId));
    const cid = new mongoose.Types.ObjectId(String(couponId));

    const result = await RestaurantCoupon.findOneAndDelete({ _id: cid, restaurantId: rid }).lean();
    if (!result) {
        throw new ValidationError('Coupon not found');
    }

    try {
        const { invalidateCache } = await import('../../../../middleware/cache.js');
        await invalidateCache('offers*');
    } catch (err) {
        console.error('Failed to invalidate offers cache on delete:', err);
    }

    return { id: cid };
}
