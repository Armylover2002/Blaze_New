import { z } from 'zod';
import mongoose from 'mongoose';
import { ValidationError } from '../../../core/auth/errors.js';

const updateUserSchema = z.object({
    name: z.string().min(1, 'Name is required').max(120).optional(),
    email: z.string().email('Valid email required').optional(),
    phone: z.string().min(6, 'Phone is required').max(20).optional(),
    address: z.string().max(300).optional(),
    status: z.enum(['active', 'inactive']).optional(),
    verification: z.enum(['verified', 'pending']).optional(),
});

export const validateUpdatePorterUserDto = (body = {}) => {
    const result = updateUserSchema.safeParse(body);
    if (!result.success) {
        throw new ValidationError(result.error.errors[0].message);
    }
    return result.data;
};

export const validateUserId = (id) => {
    if (!mongoose.Types.ObjectId.isValid(String(id))) {
        throw new ValidationError('Invalid user id');
    }
    return String(id);
};
