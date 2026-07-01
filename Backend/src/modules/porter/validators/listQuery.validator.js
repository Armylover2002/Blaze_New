import { z } from 'zod';
import { ValidationError } from '../../../core/auth/errors.js';

const listQuerySchema = z.object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    search: z.string().optional(),
    status: z.string().optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
    createdFrom: z.string().optional(),
    createdTo: z.string().optional(),
    validFrom: z.string().optional(),
    validUntil: z.string().optional(),
    zoneId: z.string().optional(),
    vehicleId: z.string().optional(),
    city: z.string().optional(),
    category: z.string().optional(),
    discountType: z.string().optional(),
    verification: z.string().optional(),
});

export const validateListQuery = (query = {}) => {
    const result = listQuerySchema.safeParse(query);
    if (!result.success) {
        throw new ValidationError(result.error.errors[0].message);
    }
    return result.data;
};
