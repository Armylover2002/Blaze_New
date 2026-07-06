import mongoose from 'mongoose';
import { actionPerformerSchema } from '../../../core/models/actionPerformer.schema.js';

const porterPricingSchema = new mongoose.Schema(
    {
        vehicleId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'PorterVehicle',
            required: true,
            index: true,
        },

        enableDistanceCharges: {
            type: Boolean,
            default: true,
        },
        basePrice: {
            type: Number,
            default: 0,
            min: 0,
        },
        baseDistance: {
            type: Number,
            default: 0,
            min: 0,
        },
        distancePrice: {
            type: Number,
            default: 0,
            min: 0,
        },
        serviceTax: {
            type: Number,
            default: 0,
            min: 0,
        },
        commissionType: {
            type: String,
            enum: ['Percentage', 'Fixed'],
            default: 'Percentage',
        },
        commissionValue: {
            type: Number,
            default: 0,
            min: 0,
        },
        status: {
            type: String,
            enum: ['active', 'inactive'],
            default: 'active',
            index: true,
        },
        description: {
            type: String,
            default: '',
            trim: true,
        },

        isDeleted: {
            type: Boolean,
            default: false,
            index: true,
        },
        deletedAt: { type: Date, default: null },
        deletedBy: { type: actionPerformerSchema, default: null },
        createdBy: { type: actionPerformerSchema, default: null },
        updatedBy: { type: actionPerformerSchema, default: null },
        statusHistory: {
            type: [{
                status: { type: String, enum: ['active', 'inactive'] },
                changedAt: { type: Date, default: Date.now },
                changedBy: { type: actionPerformerSchema, default: null },
            }],
            default: [],
        },
    },
    {
        collection: 'porter_pricing',
        timestamps: true,
    },
);

porterPricingSchema.index({ vehicleId: 1 }, { unique: true, partialFilterExpression: { isDeleted: false } });
porterPricingSchema.index({ status: 1, vehicleId: 1 });
porterPricingSchema.index({ isDeleted: 1, status: 1, createdAt: -1 });

export const PorterPricing = mongoose.models.PorterPricing
    || mongoose.model('PorterPricing', porterPricingSchema, 'porter_pricing');
