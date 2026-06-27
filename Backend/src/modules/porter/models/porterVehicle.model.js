import mongoose from 'mongoose';
import { actionPerformerSchema } from '../../../core/models/actionPerformer.schema.js';

const porterVehicleSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            index: true,
        },
        vehicleCode: {
            type: String,
            required: true,
            trim: true,
            uppercase: true,
        },
        category: {
            type: String,
            required: true,
            trim: true,
            index: true,
        },
        icon: {
            type: String,
            default: 'Truck',
            trim: true,
        },
        iconUrl: {
            type: String,
            default: '',
            trim: true,
        },
        iconPublicId: {
            type: String,
            default: null,
        },
        description: {
            type: String,
            default: '',
            trim: true,
        },
        minWeight: {
            type: Number,
            default: 0,
            min: 0,
        },
        maxWeight: {
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
        supportedServices: {
            type: [{ type: String, enum: ['food', 'quick', 'parcel'] }],
            default: [],
        },
        assignedDrivers: {
            type: Number,
            default: 0,
            min: 0,
        },
        count: {
            type: Number,
            default: 0,
            min: 0,
        },
        displayOrder: {
            type: Number,
            default: 0,
            index: true,
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
        collection: 'porter_vehicles',
        timestamps: true,
    },
);

porterVehicleSchema.index({ category: 1, status: 1 });
porterVehicleSchema.index({ status: 1, displayOrder: 1 });
porterVehicleSchema.index({ isDeleted: 1, status: 1, name: 1 });
porterVehicleSchema.index({ vehicleCode: 1 }, { unique: true, partialFilterExpression: { isDeleted: false } });

export const PorterVehicle = mongoose.models.PorterVehicle
    || mongoose.model('PorterVehicle', porterVehicleSchema, 'porter_vehicles');
