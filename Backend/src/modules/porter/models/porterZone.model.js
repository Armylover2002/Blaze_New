import mongoose from 'mongoose';
import { actionPerformerSchema } from '../../../core/models/actionPerformer.schema.js';
import { ValidationError } from '../../../core/auth/errors.js';
import { findOverlappingZone, ZONE_OVERLAP_MESSAGE } from '../../../utils/zoneOverlap.js';


const porterZoneSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            unique: true,
        },
        zoneCode: {
            type: String,
            unique: true,
            index: true,
        },
        country: {
            type: String,
            default: 'India',
            trim: true,
            index: true,
        },
        unit: {
            type: String,
            default: 'kilometer',
            enum: ['kilometer', 'mile'],
        },

        status: {
            type: String,
            enum: ['active', 'inactive'],
            default: 'active',
            index: true,
        },
        geometry: {
            type: {
                type: String,
                enum: ['Polygon'],
                required: true,
            },
            coordinates: {
                type: [[[Number]]], // Array of arrays of arrays of numbers: [[[lng, lat]]]
                required: true,
            },
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
        collection: 'porter_zones',
        timestamps: true,
    },
);

porterZoneSchema.index({ geometry: '2dsphere' });
porterZoneSchema.index({ status: 1, country: 1 });
porterZoneSchema.index({ status: 1, displayOrder: 1 });
porterZoneSchema.index({ isDeleted: 1, status: 1, createdAt: -1 });
porterZoneSchema.index({ isDeleted: 1, createdAt: -1 });

porterZoneSchema.pre('save', async function (next) {
    try {
        if (this.isNew || this.isModified('geometry')) {
            const ring = this.geometry?.coordinates?.[0];
            if (Array.isArray(ring) && ring.length >= 3) {
                const coordinates = ring.map(([lng, lat]) => ({ lat, lng }));
                const overlapping = await findOverlappingZone(this.constructor, coordinates, {
                    excludeId: this._id,
                    extraFilter: { isDeleted: { $ne: true } },
                });
                if (overlapping) {
                    return next(new ValidationError(ZONE_OVERLAP_MESSAGE));
                }
            }
        }

        if (!this.isNew) {
            return next();
        }

        if (!this.zoneCode) {
            let prefix = this.name.replace(/[^a-zA-Z]/g, '').substring(0, 3).toUpperCase();
            if (prefix.length < 3) prefix = prefix.padEnd(3, 'X');
            
            // Find the highest counter for this prefix
            const lastZone = await this.constructor.findOne(
                { zoneCode: new RegExp(`^${prefix}\\d+$`) },
                { zoneCode: 1 }
            ).sort({ zoneCode: -1 });

            let sequence = 1;
            if (lastZone && lastZone.zoneCode) {
                const lastSeq = parseInt(lastZone.zoneCode.substring(prefix.length), 10);
                if (!isNaN(lastSeq)) {
                    sequence = lastSeq + 1;
                }
            }
            this.zoneCode = `${prefix}${String(sequence).padStart(3, '0')}`;
        }

        if (!this.displayOrder) {
            const maxOrderZone = await this.constructor.findOne({}, { displayOrder: 1 }).sort({ displayOrder: -1 });
            this.displayOrder = maxOrderZone && maxOrderZone.displayOrder ? maxOrderZone.displayOrder + 1 : 1;
        }
        return next();
    } catch (error) {
        return next(error);
    }
});

export const PorterZone = mongoose.models.PorterZone
    || mongoose.model('PorterZone', porterZoneSchema, 'porter_zones');
