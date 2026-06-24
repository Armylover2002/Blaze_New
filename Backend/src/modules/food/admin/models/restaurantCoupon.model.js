import mongoose from 'mongoose';

const restaurantCouponSchema = new mongoose.Schema(
    {
        restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodRestaurant', required: true, index: true },
        restaurantName: { type: String, required: true },
        couponCode: { type: String, required: true, trim: true, uppercase: true, index: true },
        discountType: { type: String, enum: ['percentage', 'fixed'], required: true },
        discountValue: { type: Number, required: true, min: 0 },
        minOrderAmount: { type: Number, default: 0, min: 0 },
        expiryDate: { type: Date, required: true },
        usageLimit: { type: Number, default: null, min: 0 },
        usedCount: { type: Number, default: 0, min: 0 },
        description: { type: String },
        status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending', index: true }
    },
    { collection: 'food_restaurant_coupons', timestamps: true }
);

export const RestaurantCoupon = mongoose.model('RestaurantCoupon', restaurantCouponSchema, 'food_restaurant_coupons');
