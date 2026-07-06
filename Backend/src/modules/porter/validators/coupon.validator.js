import { z } from 'zod';
import mongoose from 'mongoose';
import { ValidationError } from '../../../core/auth/errors.js';
import {
    computeLifecycleStatus,
    resolveCouponStatusForSave,
    validateStatusCombination,
    validateStatusTransition,
} from '../utils/coupon-lifecycle.helpers.js';

const objectIdSchema = z.string().refine(
    (val) => mongoose.Types.ObjectId.isValid(val),
    { message: 'Invalid id' },
);

const couponEditableSchema = z.object({
    code: z.string().min(1, 'Coupon code is required').max(40),
    name: z.string().min(1, 'Coupon name is required').max(120),
    description: z.string().max(500).optional(),
    discountType: z.enum(['percentage', 'flat']).optional(),
    discountValue: z.coerce.number(),
    maxDiscount: z.coerce.number().min(0).optional(),
    minOrderValue: z.coerce.number().min(0).optional(),
    maxUses: z.coerce.number().min(1, 'maxUses must be at least 1').optional(),
    perUserLimit: z.coerce.number().min(1, 'perUserLimit must be at least 1').optional(),
    validFrom: z.string().min(1, 'Start date required'),
    validUntil: z.string().min(1, 'End date required'),
    firstOrderOnly: z.boolean().optional(),
    newCustomerOnly: z.boolean().optional(),
    autoApply: z.boolean().optional(),
    status: z.enum(['active', 'scheduled', 'expired', 'inactive']).optional(),
    zoneIds: z.array(objectIdSchema).optional(),
    vehicleIds: z.array(objectIdSchema).optional(),
    // Backward compatibility — converted to ObjectIds in service, never persisted
    zones: z.array(z.string()).optional(),
    vehicleTypes: z.array(z.string()).optional(),
});

const SERVER_MANAGED_KEYS = new Set([
    'usedCount',
    'campaignRevenue',
    'totalDiscountGiven',
    'createdBy',
    'updatedBy',
    'statusHistory',
    'createdAt',
    'updatedAt',
    'deletedAt',
    'deletedBy',
    'isDeleted',
    'active',
    'image',
    'banner',
    'customerSegment',
    '_id',
    'id',
]);

export const stripServerManagedFields = (body = {}) => {
    const clean = { ...body };
    SERVER_MANAGED_KEYS.forEach((key) => delete clean[key]);
    return clean;
};

const parseDate = (value, label = 'date') => {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) {
        throw new ValidationError(`Invalid ${label}`);
    }
    return d;
};

const deriveCouponStatus = (validFrom, validUntil, status, now = new Date()) => (
    resolveCouponStatusForSave({
        validFrom,
        validUntil,
        currentStatus: undefined,
        requestedStatus: status,
        now,
    })
);

export const validateDiscountRules = (data) => {
    const discountType = data.discountType || 'percentage';
    const discountValue = Number(data.discountValue);
    const maxDiscount = Number(data.maxDiscount ?? 0);
    const minOrderValue = Number(data.minOrderValue ?? 0);
    const maxUses = Number(data.maxUses ?? 1);
    const perUserLimit = Number(data.perUserLimit ?? 1);

    if (discountType === 'percentage') {
        if (discountValue < 0 || discountValue > 100) {
            throw new ValidationError('Percentage discount must be between 0 and 100');
        }
        if (maxDiscount <= 0) {
            throw new ValidationError('maxDiscount is required for percentage coupons');
        }
    } else if (discountType === 'flat') {
        if (discountValue <= 0) {
            throw new ValidationError('Flat discount must be greater than 0');
        }
        if (discountValue > minOrderValue) {
            throw new ValidationError('Flat discount cannot be greater than minOrderValue');
        }
    }

    if (minOrderValue < 0) {
        throw new ValidationError('minOrderValue must be 0 or greater');
    }
    
    if (maxUses < 1) {
        throw new ValidationError('maxUses must be at least 1');
    }
    
    if (perUserLimit < 1) {
        throw new ValidationError('perUserLimit must be at least 1');
    }
};

const normalizeEditableFields = (data, { isCreate = false } = {}) => {
    const normalized = { ...data };

    if (normalized.code !== undefined) {
        normalized.code = normalized.code.trim().toUpperCase();
    }
    if (normalized.name !== undefined) {
        normalized.name = normalized.name.trim();
    }
    if (normalized.description !== undefined) {
        normalized.description = normalized.description.trim();
    }

    if (normalized.discountType === undefined && isCreate) {
        normalized.discountType = 'percentage';
    }
    if (normalized.maxDiscount !== undefined) {
        normalized.maxDiscount = Number(normalized.maxDiscount);
    }
    if (normalized.minOrderValue !== undefined) {
        normalized.minOrderValue = Number(normalized.minOrderValue);
    }
    if (normalized.maxUses !== undefined) {
        normalized.maxUses = Number(normalized.maxUses);
    }
    if (normalized.perUserLimit !== undefined) {
        normalized.perUserLimit = Number(normalized.perUserLimit);
    }
    if (normalized.discountValue !== undefined) {
        normalized.discountValue = Number(normalized.discountValue);
    }

    if (normalized.discountType === 'flat') {
        normalized.maxDiscount = normalized.discountValue;
    }
    if (normalized.perUserLimit !== undefined) {
        normalized.perUserLimit = Number(normalized.perUserLimit);
    }
    if (normalized.discountValue !== undefined) {
        normalized.discountValue = Number(normalized.discountValue);
    }

    return normalized;
};

export const validateCreateCouponDto = (body = {}) => {
    const cleaned = stripServerManagedFields(body);
    const result = couponEditableSchema.safeParse(cleaned);
    if (!result.success) {
        throw new ValidationError(result.error.errors[0].message);
    }

    const data = normalizeEditableFields(result.data, { isCreate: true });
    const validFrom = parseDate(data.validFrom, 'validFrom');
    const validUntil = parseDate(data.validUntil, 'validUntil');

    if (validUntil.getTime() <= validFrom.getTime()) {
        throw new ValidationError('validUntil must be after validFrom');
    }

    validateDiscountRules(data);

    const now = new Date();
    const status = deriveCouponStatus(validFrom, validUntil, data.status, now);
    if (data.status === 'scheduled' || data.status === 'expired') {
        validateStatusCombination(data.status, validFrom, validUntil, now);
    }

    return {
        code: data.code,
        name: data.name,
        description: data.description || '',
        discountType: data.discountType || 'percentage',
        discountValue: data.discountValue,
        maxDiscount: Number(data.maxDiscount ?? 0),
        minOrderValue: Number(data.minOrderValue ?? 0),
        maxUses: Number(data.maxUses ?? 1),
        perUserLimit: Number(data.perUserLimit ?? 1),
        validFrom,
        validUntil,
        firstOrderOnly: Boolean(data.firstOrderOnly),
        newCustomerOnly: Boolean(data.newCustomerOnly),
        autoApply: Boolean(data.autoApply),
        status,
        zoneIds: data.zoneIds,
        vehicleIds: data.vehicleIds,
        zones: data.zones,
        vehicleTypes: data.vehicleTypes,
    };
};

export const validateUpdateCouponDto = (body = {}) => {
    const cleaned = stripServerManagedFields(body);
    const partial = couponEditableSchema.partial().safeParse(cleaned);
    if (!partial.success) {
        throw new ValidationError(partial.error.errors[0].message);
    }

    const data = normalizeEditableFields(partial.data);

    if (data.validFrom) data.validFrom = parseDate(data.validFrom, 'validFrom');
    if (data.validUntil) data.validUntil = parseDate(data.validUntil, 'validUntil');

    if (data.validFrom && data.validUntil && data.validUntil.getTime() <= data.validFrom.getTime()) {
        throw new ValidationError('validUntil must be after validFrom');
    }

    if ((data.status === 'scheduled' || data.status === 'expired') && data.validFrom && data.validUntil) {
        validateStatusCombination(data.status, data.validFrom, data.validUntil, new Date());
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
