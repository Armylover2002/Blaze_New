import { z } from 'zod';
import mongoose from 'mongoose';
import { ValidationError } from '../../../core/auth/errors.js';

const allowedCategories = ['bike', 'electric_bike', 'scooter', 'electric_scooter', 'bicycle', 'mini_truck', 'pickup', 'van', 'tempo', 'truck'];

const vehicleBodySchema = z.object({
    name: z.string().min(1, 'Vehicle name is required').max(120),
    category: z.enum(allowedCategories, {
        errorMap: () => ({ message: 'Invalid category' })
    }),
    iconUrl: z.string().optional(),
    description: z.string().max(500).optional(),
    minWeight: z.coerce.number().min(0, 'Min weight must be >= 0'),
    maxWeight: z.coerce.number().min(0, 'Max weight must be >= 0'),
    status: z.enum(['active', 'inactive']).optional(),
    supportedServices: z.array(z.enum(['food', 'quick', 'parcel']))
        .min(1, 'At least one supported service is required')
        .optional(),
});

export const validateCreateVehicleDto = (body = {}) => {
    let services = body.supportedServices;
    if (typeof services === 'string') {
        try { services = JSON.parse(services); } catch { services = []; }
    }
    if (Array.isArray(services)) {
        services = Array.from(new Set(services)); // deduplicate
    }

    const normalized = {
        ...body,
        supportedServices: services,
    };
    const result = vehicleBodySchema.safeParse(normalized);
    if (!result.success) {
        throw new ValidationError(result.error.errors[0].message);
    }
    if (result.data.maxWeight <= result.data.minWeight) {
        throw new ValidationError('Max weight must be strictly greater than min weight');
    }
    return {
        ...result.data,
        name: result.data.name.trim(),
        category: result.data.category.trim(),
        iconUrl: (result.data.iconUrl || '').trim(),
        description: (result.data.description || '').trim(),
        status: result.data.status || 'active',
        supportedServices: result.data.supportedServices || [],
    };
};

export const validateUpdateVehicleDto = (body = {}) => {
    let services = body.supportedServices;
    if (typeof services === 'string') {
        try { services = JSON.parse(services); } catch { services = undefined; }
    }
    if (Array.isArray(services)) {
        services = Array.from(new Set(services)); // deduplicate
    }

    const normalized = {
        ...body,
        supportedServices: services,
    };
    const partial = vehicleBodySchema.partial().safeParse(normalized);
    if (!partial.success) {
        throw new ValidationError(partial.error.errors[0].message);
    }
    const data = { ...partial.data };
    if (data.name !== undefined) data.name = data.name.trim();
    if (data.category !== undefined) data.category = data.category.trim();
    if (data.iconUrl !== undefined) data.iconUrl = data.iconUrl.trim();
    if (data.description !== undefined) data.description = data.description.trim();
    if (data.minWeight !== undefined && data.maxWeight !== undefined
        && data.maxWeight <= data.minWeight) {
        throw new ValidationError('Max weight must be strictly greater than min weight');
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
