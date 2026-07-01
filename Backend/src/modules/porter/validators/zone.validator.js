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
    displayOrder: z.coerce.number().int().min(0).optional(),
});

const normalizeCoordinates = (coords = []) => {
    const parsed = coords.map((c) => ({
        lat: Number(c.lat ?? c.latitude),
        lng: Number(c.lng ?? c.longitude),
    }));

    for (const c of parsed) {
        if (isNaN(c.lat) || isNaN(c.lng) || c.lat < -90 || c.lat > 90 || c.lng < -180 || c.lng > 180) {
            throw new ValidationError('Invalid latitude or longitude values');
        }
    }

    const uniquePoints = new Set();
    const finalCoords = [];
    
    for (let i = 0; i < parsed.length; i++) {
        const c = parsed[i];
        if (i > 0 && c.lat === parsed[i - 1].lat && c.lng === parsed[i - 1].lng) {
            throw new ValidationError('Duplicate consecutive points are not allowed');
        }
        uniquePoints.add(`${c.lat},${c.lng}`);
        finalCoords.push(c);
    }

    if (uniquePoints.size < 3) {
        throw new ValidationError('Polygon must have at least 3 unique points');
    }

    const first = finalCoords[0];
    const last = finalCoords[finalCoords.length - 1];
    if (first.lat !== last.lat || first.lng !== last.lng) {
        finalCoords.push({ ...first });
    }

    return finalCoords;
};

export const validateCreateZoneDto = (body = {}) => {
    const result = zoneBodySchema.safeParse(body);
    if (!result.success) {
        throw new ValidationError(result.error.errors[0].message);
    }

    const coordinates = normalizeCoordinates(result.data.coordinates);

    return {
        ...result.data,
        name: result.data.name.trim(),
        country: result.data.country.trim(),
        unit: result.data.unit,
        status: result.data.status || 'active',
        coordinates,
        displayOrder: result.data.displayOrder,
    };
};

export const validateUpdateZoneDto = (body = {}) => {
    const partial = zoneBodySchema.partial().safeParse(body);
    if (!partial.success) {
        throw new ValidationError(partial.error.errors[0].message);
    }

    const data = { ...partial.data };
    delete data.displayOrder;
    
    if (data.name !== undefined) data.name = data.name.trim();
    if (data.country !== undefined) data.country = data.country.trim();
    if (Array.isArray(data.coordinates)) {
        data.coordinates = normalizeCoordinates(data.coordinates);
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
