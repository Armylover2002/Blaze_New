import { z } from 'zod';
import mongoose from 'mongoose';
import { ValidationError } from '../../../core/auth/errors.js';

const vehicleBodySchema = z.object({
    name: z.string().min(1, 'Vehicle name is required').max(120),
    category: z.string().min(1, 'Category is required').max(80),
    icon: z.string().max(200).optional(),
    iconUrl: z.string().optional(),
    description: z.string().max(500).optional(),
    minWeight: z.coerce.number().min(0),
    maxWeight: z.coerce.number().min(0),
    status: z.enum(['active', 'inactive']).optional(),
    supportedServices: z.array(z.enum(['food', 'quick', 'parcel'])).optional(),
    displayOrder: z.coerce.number().int().min(0).optional(),
});

export const validateCreateVehicleDto = (body = {}) => {
    const normalized = {
        ...body,
        supportedServices: typeof body.supportedServices === 'string'
            ? (() => { try { return JSON.parse(body.supportedServices); } catch { return []; } })()
            : body.supportedServices,
    };
    const result = vehicleBodySchema.safeParse(normalized);
    if (!result.success) {
        throw new ValidationError(result.error.errors[0].message);
    }
    if (result.data.maxWeight < result.data.minWeight) {
        throw new ValidationError('Max weight must be greater than or equal to min weight');
    }
    return {
        ...result.data,
        name: result.data.name.trim(),
        category: result.data.category.trim(),
        icon: (result.data.icon || 'Truck').trim(),
        iconUrl: (result.data.iconUrl || '').trim(),
        description: (result.data.description || '').trim(),
        status: result.data.status || 'active',
        supportedServices: result.data.supportedServices || [],
        displayOrder: result.data.displayOrder ?? 0,
    };
};

export const validateUpdateVehicleDto = (body = {}) => {
    const normalized = {
        ...body,
        supportedServices: typeof body.supportedServices === 'string'
            ? (() => { try { return JSON.parse(body.supportedServices); } catch { return undefined; } })()
            : body.supportedServices,
    };
    const partial = vehicleBodySchema.partial().safeParse(normalized);
    if (!partial.success) {
        throw new ValidationError(partial.error.errors[0].message);
    }
    const data = { ...partial.data };
    if (data.name !== undefined) data.name = data.name.trim();
    if (data.category !== undefined) data.category = data.category.trim();
    if (data.icon !== undefined) data.icon = data.icon.trim();
    if (data.iconUrl !== undefined) data.iconUrl = data.iconUrl.trim();
    if (data.description !== undefined) data.description = data.description.trim();
    if (data.minWeight !== undefined && data.maxWeight !== undefined
        && data.maxWeight < data.minWeight) {
        throw new ValidationError('Max weight must be greater than or equal to min weight');
    }
    return data;
};

export const validateVehicleId = (id) => {
    if (!mongoose.Types.ObjectId.isValid(String(id))) {
        throw new ValidationError('Invalid vehicle id');
    }
    return String(id);
};

export const validateVehicleStatusDto = (body = {}) => {
    const status = String(body.status || '').trim();
    if (!['active', 'inactive'].includes(status)) {
        throw new ValidationError('Invalid vehicle status');
    }
    return { status };
};
