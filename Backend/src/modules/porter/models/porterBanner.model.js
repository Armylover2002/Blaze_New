import mongoose from 'mongoose';
import { actionPerformerSchema } from '../../../core/models/actionPerformer.schema.js';

const mediaSchema = new mongoose.Schema(
    {
        url: { type: String, default: '' },
        publicId: { type: String, default: null },
    },
    { _id: false },
);

const porterBannerSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true,
            index: true,
        },
        subtitle: {
            type: String,
            default: '',
            trim: true,
        },
        image: {
            type: mediaSchema,
            default: () => ({ url: '', publicId: null }),
        },
        priority: {
            type: Number,
            default: 1,
            index: true,
        },
        status: {
            type: String,
            enum: ['active', 'inactive', 'scheduled', 'expired'],
            default: 'active',
            index: true,
        },
        redirectType: {
            type: String,
            enum: ['promotional', 'announcement', 'offer', 'seasonal', 'feature', 'internal', 'external'],
            default: 'promotional',
        },
        redirectValue: {
            type: String,
            default: 'Home',
            trim: true,
        },
        link: {
            type: String,
            default: '',
            trim: true,
        },
        startDate: {
            type: Date,
            required: true,
            index: true,
        },
        endDate: {
            type: Date,
            required: true,
            index: true,
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
                status: { type: String, enum: ['active', 'inactive', 'scheduled', 'expired'] },
                changedAt: { type: Date, default: Date.now },
                changedBy: { type: actionPerformerSchema, default: null },
            }],
            default: [],
        },
    },
    {
        collection: 'porter_banners',
        timestamps: true,
    },
);

porterBannerSchema.index({ status: 1, priority: 1 });
porterBannerSchema.index({ status: 1, startDate: 1, endDate: 1 });
porterBannerSchema.index({ isDeleted: 1, status: 1, displayOrder: 1 });

export const PorterBanner = mongoose.models.PorterBanner
    || mongoose.model('PorterBanner', porterBannerSchema, 'porter_banners');
