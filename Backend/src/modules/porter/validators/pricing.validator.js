import { z } from 'zod';
import mongoose from 'mongoose';
import { ValidationError } from '../../../core/auth/errors.js';

const pricingBodySchema = z.object({
    vehicleId: z.string().min(1, 'Vehicle is required').optional(),

    enableDistanceCharges: z.boolean().optional(),
    basePrice: z.coerce.number().min(0, 'Base price must be 0 or greater'),
    baseDistance: z.coerce.number().min(0, 'Base distance must be 0 or greater'),
    distancePrice: z.coerce.number().min(0, 'Price per KM must be 0 or greater'),
    serviceTax: z.coerce.number().min(0).max(100).optional(),
    commissionType: z.enum(['Percentage', 'Fixed']),
    commissionValue: z.coerce.number().min(0, 'Commission value is required'),
    status: z.enum(['active', 'inactive']).optional(),
    description: z.string().max(500).optional(),
});

const SERVER_MANAGED_KEYS = new Set([
    'displayOrder',
    'pricingConfigured',
    'createdBy',
    'updatedBy',
    'statusHistory',
    'createdAt',
    'updatedAt',
    'deletedAt',
    'deletedBy',
    'isDeleted',
    '_id',
    'id',
]);

export const stripServerManagedFields = (body = {}) => {
    const clean = { ...body };
    SERVER_MANAGED_KEYS.forEach((key) => delete clean[key]);
    return clean;
};

const validateCommissionRules = (data) => {
    if (data.commissionType === 'Percentage') {
        if (data.commissionValue < 0 || data.commissionValue > 100) {
            throw new ValidationError('Commission percentage must be between 0 and 100');
        }
    } else if (data.commissionValue <= 0) {
        throw new ValidationError('Flat commission must be greater than 0');
    }
};

export { validateCommissionRules };

export const validateCreatePricingDto = (body = {}) => {
    const cleaned = stripServerManagedFields(body);
    const result = pricingBodySchema.safeParse(cleaned);
    if (!result.success) {
        throw new ValidationError(result.error.errors[0].message);
    }
    if (!result.data.vehicleId || !mongoose.Types.ObjectId.isValid(result.data.vehicleId)) {
        throw new ValidationError('Invalid vehicle id');
    }

    const payload = {
        vehicleId: result.data.vehicleId,

        enableDistanceCharges: result.data.enableDistanceCharges !== false,
        basePrice: Number(result.data.basePrice),
        baseDistance: Number(result.data.baseDistance),
        distancePrice: Number(result.data.distancePrice),
        serviceTax: Number(result.data.serviceTax ?? 0),
        commissionType: result.data.commissionType,
        commissionValue: Number(result.data.commissionValue),
        status: result.data.status || 'active',
        description: (result.data.description || '').trim(),
    };

    validateCommissionRules(payload);
    return payload;
};

export const validateUpdatePricingDto = (body = {}) => {
    const cleaned = stripServerManagedFields(body);
    const partial = pricingBodySchema.omit({ vehicleId: true }).partial().safeParse(cleaned);
    if (!partial.success) {
        throw new ValidationError(partial.error.errors[0].message);
    }

    const data = { ...partial.data };

    if (data.description !== undefined) data.description = data.description.trim();
    if (data.basePrice !== undefined) data.basePrice = Number(data.basePrice);
    if (data.baseDistance !== undefined) data.baseDistance = Number(data.baseDistance);
    if (data.distancePrice !== undefined) data.distancePrice = Number(data.distancePrice);
    if (data.serviceTax !== undefined) data.serviceTax = Number(data.serviceTax);
    if (data.commissionValue !== undefined) data.commissionValue = Number(data.commissionValue);

    if (data.commissionType !== undefined || data.commissionValue !== undefined) {
        validateCommissionRules({
            commissionType: data.commissionType || 'Percentage',
            commissionValue: data.commissionValue ?? 0,
        });
    }

    return data;
};

export const validatePricingId = (id) => {
    if (!mongoose.Types.ObjectId.isValid(String(id))) {
        throw new ValidationError('Invalid pricing id');
    }
    return String(id);
};

export const validatePricingStatusDto = (body = {}) => {
    const status = String(body.status || '').trim();
    if (!['active', 'inactive'].includes(status)) {
        throw new ValidationError('Invalid pricing status');
    }
    return { status };
};
