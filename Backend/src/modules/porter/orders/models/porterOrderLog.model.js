import mongoose from 'mongoose';
import { actionPerformerSchema } from '../../../../core/models/actionPerformer.schema.js';

const porterOrderLogSchema = new mongoose.Schema(
    {
        orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'PorterOrder', required: true, index: true },
        orderNumber: { type: String, index: true },
        action: { type: String, required: true, index: true },
        fromStatus: { type: String },
        toStatus: { type: String },
        metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
        performedBy: { type: actionPerformerSchema, default: null },
        isDeleted: { type: Boolean, default: false, index: true },
    },
    { collection: 'porter_order_logs', timestamps: true },
);

porterOrderLogSchema.index({ orderId: 1, createdAt: -1 });

export const PorterOrderLog = mongoose.models.PorterOrderLog
    || mongoose.model('PorterOrderLog', porterOrderLogSchema, 'porter_order_logs');
