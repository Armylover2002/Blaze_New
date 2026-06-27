import { z } from 'zod';
import mongoose from 'mongoose';
import { ValidationError } from '../../../core/auth/errors.js';

const pricingBodySchema = z.object({
    vehicleId: z.string().min(1, 'Vehicle is required'),
    zoneId: z.string().optional().nullable(),
    enableDistanceCharges: z.boolean().optional(),
    basePrice: z.coerce.number().min(0, 'Base price is required'),
    baseDistance: z.coerce.number().min(0, 'Base distance is required'),
    distancePrice: z.coerce.number().min(0, 'Price per KM is required'),
    serviceTax: z.coerce.number().min(0).optional(),
    commissionType: z.enum(['Percentage', 'Fixed']),
    commissionValue: z.coerce.number().min(0, 'Commission value is required'),
    status: z.enum(['active', 'inactive']).optional(),
    description: z.string().max(500).optional(),
});

export const validateCreatePricingDto = (body = {}) => {
    const result = pricingBodySchema.safeParse(body);
    if (!result.success) {
        throw new ValidationError(result.error.errors[0].message);
    }
    if (!mongoose.Types.ObjectId.isValid(result.data.vehicleId)) {
        throw new ValidationError('Invalid vehicle id');
    }
    if (result.data.zoneId && !mongoose.Types.ObjectId.isValid(result.data.zoneId)) {
        throw new ValidationError('Invalid zone id');
    }
    return {
        ...result.data,
        zoneId: result.data.zoneId || null,
        serviceTax: result.data.serviceTax ?? 0,
        status: result.data.status || 'active',
        description: (result.data.description || '').trim(),
        pricingConfigured: true,
    };
};

export const validateUpdatePricingDto = (body = {}) => {
    const partial = pricingBodySchema.omit({ vehicleId: true }).partial().safeParse(body);
    if (!partial.success) {
        throw new ValidationError(partial.error.errors[0].message);
    }
    const data = { ...partial.data };
    if (data.zoneId !== undefined && data.zoneId && !mongoose.Types.ObjectId.isValid(data.zoneId)) {
        throw new ValidationError('Invalid zone id');
    }
    if (data.description !== undefined) data.description = data.description.trim();
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
