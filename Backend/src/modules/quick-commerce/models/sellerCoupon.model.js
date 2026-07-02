import mongoose from 'mongoose';

const sellerCouponSchema = new mongoose.Schema(
    {
        sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Seller', required: true, index: true },
        sellerName: { type: String, required: true },
        couponCode: { type: String, required: true, trim: true, uppercase: true, index: true },
        discountType: { type: String, enum: ['percentage', 'fixed'], required: true },
        discountValue: { type: Number, required: true, min: 0 },
        minOrderAmount: { type: Number, default: 0, min: 0 },
        expiryDate: { type: Date, required: true },
        usageLimit: { type: Number, default: null, min: 0 },
        usedCount: { type: Number, default: 0, min: 0 },
        description: { type: String },
        status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending', index: true },
        isActive: { type: Boolean, default: true } // admin can deactivate approved coupons
    },
    { collection: 'quick_seller_coupons', timestamps: true }
);

// Coupon apply / duplicate-check look up by sellerId + couponCode.
sellerCouponSchema.index({ sellerId: 1, couponCode: 1 });
// Public coupon listing filters by sellerId + status + active expiry window.
sellerCouponSchema.index({ sellerId: 1, status: 1, expiryDate: 1 });

export const SellerCoupon = mongoose.model('SellerCoupon', sellerCouponSchema, 'quick_seller_coupons');
