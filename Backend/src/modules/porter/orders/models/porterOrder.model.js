import mongoose from 'mongoose';
import { actionPerformerSchema } from '../../../../core/models/actionPerformer.schema.js';
import {
    PORTER_ORDER_STATUS,
    PORTER_DISPATCH_STATUS,
    PORTER_DELIVERY_PHASE,
    PORTER_PAYMENT_STATUS,
    PORTER_PAYMENT_METHODS,
} from '../constants/porterOrderStatus.constants.js';

const locationSchema = new mongoose.Schema({
    title: { type: String, trim: true, default: '' },
    address: { type: String, trim: true, required: true },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    placeId: { type: String, trim: true },
}, { _id: false });

const parcelSchema = new mongoose.Schema({
    parcelName: { type: String, trim: true, default: '' },
    parcelDescription: { type: String, trim: true, default: '' },
    weightKg: { type: Number, default: 0, min: 0 },
    quantity: { type: Number, default: 1, min: 1 },
    instructions: { type: String, trim: true, default: '' },
    receiverName: { type: String, trim: true, default: '' },
    receiverPhone: { type: String, trim: true, default: '' },
}, { _id: false });

const porterOrderSchema = new mongoose.Schema(
    {
        orderNumber: { type: String, unique: true, index: true },
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodUser', required: true, index: true },
        status: {
            type: String,
            enum: Object.values(PORTER_ORDER_STATUS),
            default: PORTER_ORDER_STATUS.CREATED,
            index: true,
        },
        pickup: { type: locationSchema, required: true },
        delivery: { type: locationSchema, required: true },
        parcel: { type: parcelSchema, default: () => ({}) },
        vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: 'PorterVehicle', index: true },
        vehicleName: { type: String, trim: true },
        zoneId: { type: mongoose.Schema.Types.ObjectId, ref: 'PorterZone', index: true },
        route: {
            distanceKm: { type: Number },
            durationMin: { type: Number },
            distanceText: { type: String },
            durationText: { type: String },
            polyline: { type: String },
        },
        pricing: {
            baseFare: { type: Number, default: 0 },
            distanceCharge: { type: Number, default: 0 },
            serviceTax: { type: Number, default: 0 },
            platformFee: { type: Number, default: 0 },
            discount: { type: Number, default: 0 },
            total: { type: Number, default: 0 },
            driverEarning: { type: Number, default: 0 },
            commission: { type: Number, default: 0 },
        },
        couponId: { type: mongoose.Schema.Types.ObjectId, ref: 'PorterCoupon' },
        couponCode: { type: String, trim: true },
        payment: {
            method: { type: String, enum: PORTER_PAYMENT_METHODS, default: 'wallet' },
            status: { type: String, enum: Object.values(PORTER_PAYMENT_STATUS), default: PORTER_PAYMENT_STATUS.PENDING },
            paymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },
            razorpayOrderId: { type: String },
            razorpayPaymentId: { type: String },
            razorpay: {
                orderId: { type: String },
                amount: { type: Number },
                currency: { type: String },
                key: { type: String },
                paymentId: { type: String },
                signature: { type: String },
            },
            paidAt: { type: Date },
            collectedAt: { type: Date },
            collectedBy: { type: actionPerformerSchema, default: null },
            settlementStatus: { type: String, enum: ['pending', 'settled'], default: 'pending' },
            qr: {
                paymentLinkId: { type: String },
                shortUrl: { type: String },
                status: { type: String },
                expiresAt: { type: Date },
            },
            refund: {
                status: { type: String, enum: ['not_required', 'pending', 'processed', 'failed'], default: 'not_required' },
                amount: { type: Number, default: 0 },
                method: { type: String },
                refundId: { type: String },
                transactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction' },
                reason: { type: String },
                initiatedAt: { type: Date },
                processedAt: { type: Date },
            },
        },
        dispatch: {
            status: { type: String, enum: Object.values(PORTER_DISPATCH_STATUS), default: PORTER_DISPATCH_STATUS.UNASSIGNED, index: true },
            deliveryPartnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodDeliveryPartner', index: true },
            activeVehicleId: { type: String },
            assignedAt: { type: Date },
            acceptedAt: { type: Date },
            rejectedPartnerIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'FoodDeliveryPartner' }],
            scheduledDispatchedAt: { type: Date },
            manuallyAssigned: { type: Boolean, default: false },
        },
        deliveryState: {
            currentPhase: { type: String, enum: Object.values(PORTER_DELIVERY_PHASE) },
            pickupOtp: { type: String },
            pickupOtpVerifiedAt: { type: Date },
            pickupPhotoUrl: { type: String },
            deliveryPhotoUrl: { type: String },
            pickedUpAt: { type: Date },
            deliveredAt: { type: Date },
            completedAt: { type: Date },
        },
        scheduledAt: { type: Date, index: true },
        // Schedule metadata for delayed dispatch / reminders / admin ops UI.
        schedule: {
            status: {
                type: String,
                enum: ['none', 'scheduled', 'dispatching', 'completed', 'cancelled'],
                default: 'none',
            },
            timezone: { type: String },
            activatedAt: { type: Date },
            dispatchStartedAt: { type: Date },
            scheduledUpdatedAt: { type: Date },
            lastUpdatedAt: { type: Date },
            bullJobId: { type: String },
            reminderJobId: { type: String },
            reminderScheduledAt: { type: Date },
            reminderSentAt: { type: Date },
        },
        rating: { score: { type: Number, min: 1, max: 5 }, comment: { type: String }, tags: [{ type: String }] },
        cancellation: {
            reason: { type: String },
            cancelledBy: { type: String },
            cancelledAt: { type: Date },
            note: { type: String },
            refundStatus: { type: String },
            refundAmount: { type: Number },
        },
        isDeleted: { type: Boolean, default: false, index: true },
        deletedAt: { type: Date, default: null },
        deletedBy: { type: actionPerformerSchema, default: null },
        createdBy: { type: actionPerformerSchema, default: null },
        updatedBy: { type: actionPerformerSchema, default: null },
        statusHistory: {
            type: [{
                status: { type: String },
                note: { type: String },
                changedAt: { type: Date, default: Date.now },
                changedBy: { type: actionPerformerSchema, default: null },
            }],
            default: [],
        },
    },
    { collection: 'porter_orders', timestamps: true },
);

porterOrderSchema.index({ userId: 1, status: 1, createdAt: -1 });
porterOrderSchema.index({ 'dispatch.deliveryPartnerId': 1, status: 1, createdAt: -1 });
porterOrderSchema.index({ 'dispatch.status': 1, status: 1, createdAt: -1 });
porterOrderSchema.index({ isDeleted: 1, status: 1, createdAt: -1 });
porterOrderSchema.index({ pickup: '2dsphere' });
porterOrderSchema.index({ scheduledAt: 1, status: 1 });

export const PorterOrder = mongoose.models.PorterOrder
    || mongoose.model('PorterOrder', porterOrderSchema, 'porter_orders');
