import mongoose from 'mongoose';
import { ValidationError } from '../../../../core/auth/errors.js';
import { SellerCoupon } from '../../models/sellerCoupon.model.js';
import { Seller } from '../models/seller.model.js';

export async function listSellerCoupons(sellerId) {
    if (!sellerId || !mongoose.Types.ObjectId.isValid(String(sellerId))) {
        throw new ValidationError('Invalid seller id');
    }
    const filter = {
        sellerId: new mongoose.Types.ObjectId(String(sellerId))
    };
    return SellerCoupon.find(filter).sort({ createdAt: -1 }).lean();
}

export async function createSellerCoupon(sellerId, body) {
    if (!sellerId || !mongoose.Types.ObjectId.isValid(String(sellerId))) {
        throw new ValidationError('Invalid seller id');
    }
    const sid = new mongoose.Types.ObjectId(String(sellerId));
    
    const couponCode = String(body?.couponCode || '').trim().toUpperCase();
    if (!couponCode) throw new ValidationError('Coupon code is required');
    
    // Check if duplicate couponCode exists for this seller
    const existing = await SellerCoupon.findOne({
        sellerId: sid,
        couponCode
    }).select('_id').lean();
    
    if (existing) {
        throw new ValidationError('A coupon with this code already exists for your shop');
    }

    const seller = await Seller.findById(sid).select('name shopName').lean();
    if (!seller) throw new ValidationError('Seller not found');

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

    const doc = await SellerCoupon.create({
        sellerId: sid,
        sellerName: seller.shopName || seller.name || 'Unknown Seller',
        couponCode,
        discountType,
        discountValue,
        minOrderAmount: Number(body?.minOrderAmount) || 0,
        expiryDate,
        usageLimit: body?.usageLimit ? Number(body.usageLimit) : null,
        description: String(body?.description || '').trim(),
        status: 'Pending',
        isActive: true
    });

    try {
        const { invalidateCache } = await import('../../../../middleware/cache.js');
        await invalidateCache('quick_coupons*');
        await invalidateCache('quick_offers*');
    } catch (err) {
        console.error('Failed to invalidate quick coupons cache on create:', err);
    }

    return doc.toObject();
}

export async function updateSellerCoupon(sellerId, couponId, body) {
    if (!sellerId || !mongoose.Types.ObjectId.isValid(String(sellerId))) {
        throw new ValidationError('Invalid seller id');
    }
    if (!couponId || !mongoose.Types.ObjectId.isValid(String(couponId))) {
        throw new ValidationError('Invalid coupon id');
    }
    const sid = new mongoose.Types.ObjectId(String(sellerId));
    const cid = new mongoose.Types.ObjectId(String(couponId));

    const existingCoupon = await SellerCoupon.findOne({ _id: cid, sellerId: sid }).lean();
    if (!existingCoupon) {
        throw new ValidationError('Coupon not found');
    }

    const couponCode = String(body?.couponCode || '').trim().toUpperCase();
    if (!couponCode) throw new ValidationError('Coupon code is required');

    // Check duplicate excluding current
    const duplicate = await SellerCoupon.findOne({
        sellerId: sid,
        couponCode,
        _id: { $ne: cid }
    }).select('_id').lean();

    if (duplicate) {
        throw new ValidationError('A coupon with this code already exists for your shop');
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

    const updated = await SellerCoupon.findOneAndUpdate(
        { _id: cid, sellerId: sid },
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
        await invalidateCache('quick_coupons*');
        await invalidateCache('quick_offers*');
    } catch (err) {
        console.error('Failed to invalidate quick coupons cache on update:', err);
    }

    return updated;
}

export async function deleteSellerCoupon(sellerId, couponId) {
    if (!sellerId || !mongoose.Types.ObjectId.isValid(String(sellerId))) {
        throw new ValidationError('Invalid seller id');
    }
    if (!couponId || !mongoose.Types.ObjectId.isValid(String(couponId))) {
        throw new ValidationError('Invalid coupon id');
    }
    const sid = new mongoose.Types.ObjectId(String(sellerId));
    const cid = new mongoose.Types.ObjectId(String(couponId));

    const result = await SellerCoupon.findOneAndDelete({ _id: cid, sellerId: sid }).lean();
    if (!result) {
        throw new ValidationError('Coupon not found');
    }

    try {
        const { invalidateCache } = await import('../../../../middleware/cache.js');
        await invalidateCache('quick_coupons*');
        await invalidateCache('quick_offers*');
    } catch (err) {
        console.error('Failed to invalidate quick coupons cache on delete:', err);
    }

    return { id: cid };
}
