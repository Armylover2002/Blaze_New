import mongoose from 'mongoose';
import { ValidationError } from '../../../../core/auth/errors.js';
import { SellerCoupon } from '../../models/sellerCoupon.model.js';
import { SellerCouponUsage } from '../../models/sellerCouponUsage.model.js';
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
    
    const code = String(body?.code || '').trim().toUpperCase();
    if (!code) throw new ValidationError('Coupon code is required');
    
    // Check if duplicate code exists for this seller
    const existing = await SellerCoupon.findOne({
        sellerId: sid,
        code
    }).select('_id').lean();
    
    if (existing) {
        throw new ValidationError('A coupon with this code already exists for your shop');
    }

    const seller = await Seller.findById(sid).select('name shopName').lean();
    if (!seller) throw new ValidationError('Seller not found');

    const discountType = body?.discountType;
    if (!discountType || !['percentage', 'fixed', 'free_delivery'].includes(discountType)) {
        throw new ValidationError('Discount type must be percentage, fixed, or free_delivery');
    }

    const couponType = body?.couponType || 'generic';
    const validCouponTypes = ['generic', 'min_order_value', 'free_delivery'];
    if (!validCouponTypes.includes(couponType)) {
        throw new ValidationError('Unsupported coupon strategy. Please choose generic, minimum order value, or free delivery.');
    }

    const discountValue = Number(body?.discountValue);
    if (!Number.isFinite(discountValue) || discountValue <= 0) {
        throw new ValidationError('Discount value must be greater than 0');
    }

    const validTill = body?.validTill ? new Date(body.validTill) : null;
    if (!validTill || Number.isNaN(validTill.getTime())) {
        throw new ValidationError('A valid expiry date is required');
    }
    
    const validFrom = body?.validFrom ? new Date(body.validFrom) : new Date();

    let doc;
    try {
        doc = await SellerCoupon.create({
            sellerId: sid,
            sellerName: seller.shopName || seller.name || 'Unknown Seller',
            code,
            discountType,
            couponType,
            discountValue,
            minOrderValue: Number(body?.minOrderValue) || 0,
            maxDiscount: body?.maxDiscount ? Number(body.maxDiscount) : undefined,
            validFrom,
            validTill,
            usageLimit: body?.usageLimit ? Number(body.usageLimit) : null,
            perUserLimit: body?.perUserLimit ? Number(body.perUserLimit) : 1,
            description: String(body?.description || '').trim(),
            status: 'Pending',
            isActive: true
        });
    } catch (err) {
        if (err?.code === 11000) {
            throw new ValidationError('A coupon with this code already exists for your shop');
        }
        throw err;
    }

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

    const code = String(body?.code || '').trim().toUpperCase();
    if (!code) throw new ValidationError('Coupon code is required');

    // Check duplicate excluding current
    const duplicate = await SellerCoupon.findOne({
        sellerId: sid,
        code,
        _id: { $ne: cid }
    }).select('_id').lean();

    if (duplicate) {
        throw new ValidationError('A coupon with this code already exists for your shop');
    }

    const discountType = body?.discountType;
    if (!discountType || !['percentage', 'fixed', 'free_delivery'].includes(discountType)) {
        throw new ValidationError('Discount type must be percentage, fixed, or free_delivery');
    }

    const couponType = body?.couponType || 'generic';
    const validCouponTypes = ['generic', 'min_order_value', 'free_delivery'];
    if (!validCouponTypes.includes(couponType)) {
        throw new ValidationError('Unsupported coupon strategy. Please choose generic, minimum order value, or free delivery.');
    }

    const discountValue = Number(body?.discountValue);
    if (!Number.isFinite(discountValue) || discountValue <= 0) {
        throw new ValidationError('Discount value must be greater than 0');
    }

    const validTill = body?.validTill ? new Date(body.validTill) : null;
    if (!validTill || Number.isNaN(validTill.getTime())) {
        throw new ValidationError('A valid expiry date is required');
    }
    
    const validFrom = body?.validFrom ? new Date(body.validFrom) : new Date();

    let updated;
    try {
        updated = await SellerCoupon.findOneAndUpdate(
            { _id: cid, sellerId: sid },
            {
                $set: {
                    code,
                    discountType,
                    couponType,
                    discountValue,
                    minOrderValue: Number(body?.minOrderValue) || 0,
                    maxDiscount: body?.maxDiscount ? Number(body.maxDiscount) : undefined,
                    validFrom,
                    validTill,
                    usageLimit: body?.usageLimit ? Number(body.usageLimit) : null,
                    perUserLimit: body?.perUserLimit ? Number(body.perUserLimit) : 1,
                    description: String(body?.description || '').trim(),
                    status: 'Pending' // Reset to Pending upon edit
                }
            },
            { new: true }
        ).lean();
    } catch (err) {
        if (err?.code === 11000) {
            throw new ValidationError('A coupon with this code already exists for your shop');
        }
        throw err;
    }

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

    const result = await SellerCoupon.findOne({ _id: cid, sellerId: sid }).lean();
    if (!result) {
      throw new ValidationError('Coupon not found');
    }

    const usageCount = await SellerCouponUsage.countDocuments({ couponId: cid });
    const isLiveCoupon = String(result.status || '').trim() === 'Approved' || Boolean(result.isActive) || Number(result.usedCount || 0) > 0 || usageCount > 0;

    if (isLiveCoupon) {
        const deactivated = await SellerCoupon.findOneAndUpdate(
            { _id: cid, sellerId: sid },
            { $set: { isActive: false } },
            { new: true }
        ).lean();

        if (!deactivated) {
            throw new ValidationError('Coupon not found');
        }

        try {
            const { invalidateCache } = await import('../../../../middleware/cache.js');
            await invalidateCache('quick_coupons*');
            await invalidateCache('quick_offers*');
        } catch (err) {
            console.error('Failed to invalidate quick coupons cache on delete:', err);
        }

        return { id: cid, deactivated: true };
    }

    const deleted = await SellerCoupon.findOneAndDelete({ _id: cid, sellerId: sid }).lean();
    if (!deleted) {
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
