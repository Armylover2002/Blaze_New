import mongoose from 'mongoose';

const porterEarningSchema = new mongoose.Schema(
    {
        orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'PorterOrder', required: true, unique: true, index: true },
        orderNumber: { type: String, index: true },
        deliveryPartnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodDeliveryPartner', required: true, index: true },
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodUser', index: true },
        module: { type: String, default: 'porter', index: true },
        grossFare: { type: Number, default: 0 },
        commission: { type: Number, default: 0 },
        platformFee: { type: Number, default: 0 },
        tax: { type: Number, default: 0 },
        netEarning: { type: Number, default: 0 },
        distanceKm: { type: Number },
        paymentMethod: { type: String },
        settledAt: { type: Date },
        walletTransactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction' },
        isDeleted: { type: Boolean, default: false, index: true },
    },
    { collection: 'porter_earnings', timestamps: true },
);

porterEarningSchema.index({ deliveryPartnerId: 1, createdAt: -1 });
porterEarningSchema.index({ module: 1, deliveryPartnerId: 1, createdAt: -1 });

export const PorterEarning = mongoose.models.PorterEarning
    || mongoose.model('PorterEarning', porterEarningSchema, 'porter_earnings');
