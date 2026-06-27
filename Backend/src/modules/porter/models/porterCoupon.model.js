import mongoose from 'mongoose';
import { actionPerformerSchema } from '../../../core/models/actionPerformer.schema.js';

const mediaSchema = new mongoose.Schema(
    {
        url: { type: String, default: '' },
        publicId: { type: String, default: null },
    },
    { _id: false },
);

const porterCouponSchema = new mongoose.Schema(
    {
        code: {
            type: String,
            required: true,
            trim: true,
            uppercase: true,
        },
        name: {
            type: String,
            required: true,
            trim: true,
        },
        description: {
            type: String,
            default: '',
            trim: true,
        },
        discountType: {
            type: String,
            enum: ['percentage', 'flat'],
            default: 'percentage',
        },
        discountValue: {
            type: Number,
            required: true,
            min: 0,
        },
        maxDiscount: {
            type: Number,
            default: 0,
            min: 0,
        },
        minOrderValue: {
            type: Number,
            default: 0,
            min: 0,
        },
        maxUses: {
            type: Number,
            default: 0,
            min: 0,
        },
        usedCount: {
            type: Number,
            default: 0,
            min: 0,
        },
        perUserLimit: {
            type: Number,
            default: 1,
            min: 0,
        },
        validFrom: {
            type: Date,
            required: true,
            index: true,
        },
        validUntil: {
            type: Date,
            required: true,
            index: true,
        },
        firstOrderOnly: { type: Boolean, default: false },
        newCustomerOnly: { type: Boolean, default: false },
        active: { type: Boolean, default: true },
        autoApply: { type: Boolean, default: false },
        zones: { type: [String], default: ['All Zones'] },
        zoneIds: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'PorterZone',
        }],
        vehicleTypes: { type: [String], default: ['All'] },
        vehicleIds: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'PorterVehicle',
        }],
        customerSegment: {
            type: String,
            default: 'All Customers',
            trim: true,
        },
        status: {
            type: String,
            enum: ['active', 'scheduled', 'expired', 'inactive'],
            default: 'active',
            index: true,
        },
        image: { type: mediaSchema, default: null },
        banner: { type: mediaSchema, default: null },
        campaignRevenue: { type: Number, default: 0, min: 0 },
        totalDiscountGiven: { type: Number, default: 0, min: 0 },
        displayOrder: { type: Number, default: 0 },
        isDeleted: { type: Boolean, default: false, index: true },
        deletedAt: { type: Date, default: null },
        deletedBy: { type: actionPerformerSchema, default: null },
        createdBy: { type: actionPerformerSchema, default: null },
        updatedBy: { type: actionPerformerSchema, default: null },
        statusHistory: {
            type: [{
                status: { type: String, enum: ['active', 'scheduled', 'expired', 'inactive'] },
                changedAt: { type: Date, default: Date.now },
                changedBy: { type: actionPerformerSchema, default: null },
            }],
            default: [],
        },
    },
    {
        collection: 'porter_coupons',
        timestamps: true,
    },
);

porterCouponSchema.index({ code: 1 }, { unique: true, partialFilterExpression: { isDeleted: false } });
porterCouponSchema.index({ status: 1, validFrom: 1, validUntil: 1 });
porterCouponSchema.index({ isDeleted: 1, status: 1, createdAt: -1 });

export const PorterCoupon = mongoose.models.PorterCoupon
    || mongoose.model('PorterCoupon', porterCouponSchema, 'porter_coupons');
