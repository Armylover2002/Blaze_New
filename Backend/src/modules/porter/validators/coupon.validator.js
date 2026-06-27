import { z } from 'zod';
import mongoose from 'mongoose';
import { ValidationError } from '../../../core/auth/errors.js';

const couponBodySchema = z.object({
    code: z.string().min(1, 'Coupon code is required').max(40),
    name: z.string().min(1, 'Coupon name is required').max(120),
    description: z.string().max(500).optional(),
    discountType: z.enum(['percentage', 'flat']).optional(),
    discountValue: z.coerce.number().positive('Valid discount required'),
    maxDiscount: z.coerce.number().min(0).optional(),
    minOrderValue: z.coerce.number().min(0).optional(),
    maxUses: z.coerce.number().min(0).optional(),
    perUserLimit: z.coerce.number().min(0).optional(),
    validFrom: z.string().min(1, 'Start date required'),
    validUntil: z.string().min(1, 'End date required'),
    firstOrderOnly: z.boolean().optional(),
    newCustomerOnly: z.boolean().optional(),
    active: z.boolean().optional(),
    autoApply: z.boolean().optional(),
    zones: z.array(z.string()).optional(),
    vehicleTypes: z.array(z.string()).optional(),
    customerSegment: z.string().optional(),
    status: z.enum(['active', 'scheduled', 'expired', 'inactive']).optional(),
});

const parseDate = (value) => {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) {
        throw new ValidationError('Invalid date');
    }
    return d;
};

const deriveCouponStatus = (validFrom, validUntil, status) => {
    if (status) return status;
    const now = Date.now();
    if (validUntil.getTime() < now) return 'expired';
    if (validFrom.getTime() > now) return 'scheduled';
    return 'active';
};

export const validateCreateCouponDto = (body = {}) => {
    const result = couponBodySchema.safeParse(body);
    if (!result.success) {
        throw new ValidationError(result.error.errors[0].message);
    }
    const validFrom = parseDate(result.data.validFrom);
    const validUntil = parseDate(result.data.validUntil);
    if (validUntil.getTime() <= validFrom.getTime()) {
        throw new ValidationError('End date must be after start date');
    }
    if (result.data.discountType === 'percentage'
        && (result.data.maxDiscount === undefined || result.data.maxDiscount <= 0)) {
        throw new ValidationError('maxDiscount is required for percentage coupons');
    }
    return {
        ...result.data,
        code: result.data.code.trim().toUpperCase(),
        name: result.data.name.trim(),
        description: (result.data.description || '').trim(),
        discountType: result.data.discountType || 'percentage',
        maxDiscount: Number(result.data.maxDiscount || 0),
        minOrderValue: Number(result.data.minOrderValue || 0),
        maxUses: Number(result.data.maxUses || 0),
        perUserLimit: Number(result.data.perUserLimit ?? 1),
        zones: result.data.zones?.length ? result.data.zones : ['All Zones'],
        vehicleTypes: result.data.vehicleTypes?.length ? result.data.vehicleTypes : ['All'],
        customerSegment: result.data.customerSegment || 'All Customers',
        validFrom,
        validUntil,
        status: deriveCouponStatus(validFrom, validUntil, result.data.status),
        active: result.data.active !== false,
    };
};

export const validateUpdateCouponDto = (body = {}) => {
    const partial = couponBodySchema.partial().safeParse(body);
    if (!partial.success) {
        throw new ValidationError(partial.error.errors[0].message);
    }
    const data = { ...partial.data };
    if (data.code !== undefined) data.code = data.code.trim().toUpperCase();
    if (data.name !== undefined) data.name = data.name.trim();
    if (data.description !== undefined) data.description = data.description.trim();
    if (data.validFrom) data.validFrom = parseDate(data.validFrom);
    if (data.validUntil) data.validUntil = parseDate(data.validUntil);
    if (data.validFrom && data.validUntil && data.validUntil.getTime() <= data.validFrom.getTime()) {
        throw new ValidationError('End date must be after start date');
    }
    return data;
};

export const validateCouponId = (id) => {
    if (!mongoose.Types.ObjectId.isValid(String(id))) {
        throw new ValidationError('Invalid coupon id');
    }
    return String(id);
};

export const validateCouponStatusDto = (body = {}) => {
    const status = String(body.status || '').trim();
    if (!['active', 'scheduled', 'expired', 'inactive'].includes(status)) {
        throw new ValidationError('Invalid coupon status');
    }
    return { status };
};
