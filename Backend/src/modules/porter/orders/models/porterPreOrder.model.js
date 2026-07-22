import mongoose from 'mongoose';

const porterPreOrderSchema = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodUser', required: true, index: true },
        dto: { type: mongoose.Schema.Types.Mixed, required: true },
        pricingResult: { type: mongoose.Schema.Types.Mixed, required: true },
        orderNumber: { type: String, required: true },
        razorpayOrderId: { type: String, required: true, index: true },
        paymentMethod: { type: String, default: 'razorpay' },
        createdAt: { type: Date, default: Date.now, expires: 1800 }, // Auto-delete after 30 minutes
    },
    { collection: 'porter_pre_orders', timestamps: true }
);

export const PorterPreOrder = mongoose.models.PorterPreOrder
    || mongoose.model('PorterPreOrder', porterPreOrderSchema, 'porter_pre_orders');
