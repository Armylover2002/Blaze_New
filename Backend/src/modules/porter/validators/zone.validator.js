import { z } from 'zod';
import mongoose from 'mongoose';
import { ValidationError } from '../../../core/auth/errors.js';

const coordinateSchema = z.object({
    lat: z.coerce.number(),
    lng: z.coerce.number(),
}).or(z.object({
    latitude: z.coerce.number(),
    longitude: z.coerce.number(),
}));

const zoneBodySchema = z.object({
    name: z.string().min(1, 'Zone name is required').max(120),
    country: z.string().min(1, 'Country is required').max(80),
    unit: z.enum(['kilometer', 'mile']).default('kilometer'),
    status: z.enum(['active', 'inactive']).optional(),
    coordinates: z.array(coordinateSchema).min(3, 'Draw a polygon with at least 3 points'),
    polygon: z.string().optional(),
    displayOrder: z.coerce.number().int().min(0).optional(),
});

const normalizeCoordinates = (coords = []) => coords.map((c) => ({
    lat: Number(c.lat ?? c.latitude),
    lng: Number(c.lng ?? c.longitude),
}));

export const validateCreateZoneDto = (body = {}) => {
    const result = zoneBodySchema.safeParse(body);
    if (!result.success) {
        throw new ValidationError(result.error.errors[0].message);
    }

    const coordinates = normalizeCoordinates(result.data.coordinates);
    const polygon = result.data.polygon?.trim()
        || `${coordinates.length}-point polygon`;

    return {
        ...result.data,
        name: result.data.name.trim(),
        country: result.data.country.trim(),
        unit: result.data.unit,
        status: result.data.status || 'active',
        coordinates,
        polygon,
        displayOrder: result.data.displayOrder ?? 0,
    };
};

export const validateUpdateZoneDto = (body = {}) => {
    const partial = zoneBodySchema.partial().safeParse(body);
    if (!partial.success) {
        throw new ValidationError(partial.error.errors[0].message);
    }

    const data = { ...partial.data };
    if (data.name !== undefined) data.name = data.name.trim();
    if (data.country !== undefined) data.country = data.country.trim();
    if (Array.isArray(data.coordinates)) {
        data.coordinates = normalizeCoordinates(data.coordinates);
        if (data.coordinates.length < 3) {
            throw new ValidationError('Draw a polygon with at least 3 points');
        }
        data.polygon = data.polygon?.trim() || `${data.coordinates.length}-point polygon`;
    }
    return data;
};

export const validateZoneId = (id) => {
    if (!mongoose.Types.ObjectId.isValid(String(id))) {
        throw new ValidationError('Invalid zone id');
    }
    return String(id);
};

export const validateZoneStatusDto = (body = {}) => {
    const status = String(body.status || '').trim();
    if (!['active', 'inactive'].includes(status)) {
        throw new ValidationError('Invalid zone status');
    }
    return { status };
};
