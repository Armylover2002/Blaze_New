import { z } from 'zod';
import mongoose from 'mongoose';
import { ValidationError } from '../../../core/auth/errors.js';

const latSchema = z.coerce.number().min(-90).max(90);
const lngSchema = z.coerce.number().min(-180).max(180);

const coordinateSchema = z.object({
    lat: latSchema,
    lng: lngSchema,
});

export const validateReverseGeocodeQuery = (query = {}) => {
    const lat = latSchema.safeParse(query.lat);
    const lng = lngSchema.safeParse(query.lng);
    if (!lat.success || !lng.success) {
        throw new ValidationError('lat and lng query parameters are required');
    }
    return { lat: lat.data, lng: lng.data };
};

export const validatePlaceIdQuery = (query = {}) => {
    const placeId = String(query.placeId || '').trim();
    if (!placeId) throw new ValidationError('placeId query parameter is required');
    return { placeId };
};

export const validateRoutePreviewBody = (body = {}) => {
    const schema = z.object({
        pickup: coordinateSchema,
        delivery: coordinateSchema,
    });
    const result = schema.safeParse(body);
    if (!result.success) {
        throw new ValidationError(result.error.errors?.[0]?.message || 'Invalid route preview payload');
    }
    return result.data;
};

export const validateQuotePreviewBody = (body = {}) => {
    const schema = z.object({
        pickup: coordinateSchema,
        delivery: coordinateSchema,
        vehicleId: z.string().refine((val) => mongoose.Types.ObjectId.isValid(val), {
            message: 'Invalid vehicleId',
        }).optional(),
    });
    const result = schema.safeParse(body);
    if (!result.success) {
        throw new ValidationError(result.error.errors?.[0]?.message || 'Invalid quote preview payload');
    }
    return result.data;
};
