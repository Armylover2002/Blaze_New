import { z } from 'zod';
import mongoose from 'mongoose';
import { ValidationError } from '../../../core/auth/errors.js';

export const BANNER_TYPES = ['promotional', 'offer', 'announcement', 'festival', 'hero'];
export const BANNER_TARGETS = ['home', 'food', 'quick', 'porter', 'vehicles', 'offers', 'coupons', 'orders', 'tracking'];
export const BANNER_STATUSES = ['active', 'inactive', 'scheduled', 'expired'];

const LEGACY_TYPE_MAP = {
    promotional: 'promotional',
    announcement: 'announcement',
    offer: 'offer',
    seasonal: 'festival',
    feature: 'hero',
    internal: 'announcement',
    external: 'promotional',
    festival: 'festival',
    hero: 'hero',
};

const LEGACY_TARGET_MAP = {
    home: 'home',
    food: 'food',
    quick: 'quick',
    porter: 'porter',
    vehicles: 'vehicles',
    offers: 'offers',
    coupons: 'coupons',
    orders: 'orders',
    tracking: 'tracking',
    Home: 'home',
    Orders: 'orders',
    'Driver App': 'porter',
    'Customer App': 'home',
    Checkout: 'orders',
    Dashboard: 'home',
};

export const normalizeBannerType = (value, fallback = 'promotional') => {
    const key = String(value || '').trim();
    if (!key) return fallback;
    const lower = key.toLowerCase();
    if (BANNER_TYPES.includes(lower)) return lower;
    if (LEGACY_TYPE_MAP[key]) return LEGACY_TYPE_MAP[key];
    if (LEGACY_TYPE_MAP[lower]) return LEGACY_TYPE_MAP[lower];
    return fallback;
};

export const normalizeBannerTarget = (value, fallback = 'home') => {
    const key = String(value || '').trim();
    if (!key) return fallback;
    const lower = key.toLowerCase();
    if (BANNER_TARGETS.includes(lower)) return lower;
    if (LEGACY_TARGET_MAP[key]) return LEGACY_TARGET_MAP[key];
    if (LEGACY_TARGET_MAP[lower]) return LEGACY_TARGET_MAP[lower];
    return fallback;
};

const bannerEditableSchema = z.object({
    title: z.string().min(1, 'Title required').max(120),
    type: z.string().optional(),
    target: z.string().optional(),
    priority: z.coerce.number().int().min(1, 'Priority must be at least 1').optional(),
    startDate: z.string().min(1, 'Start date required'),
    endDate: z.string().min(1, 'End date required'),
    status: z.enum(BANNER_STATUSES).optional(),
    // Backward compatibility — normalized in service, never persisted
    redirectType: z.string().optional(),
    redirectValue: z.string().optional(),
});

const SERVER_MANAGED_KEYS = new Set([
    'displayOrder',
    'createdBy',
    'updatedBy',
    'statusHistory',
    'createdAt',
    'updatedAt',
    'deletedAt',
    'deletedBy',
    'isDeleted',
    'imagePublicId',
    'subtitle',
    'link',
    'linkUrl',
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

export const deriveBannerStatus = (startDate, endDate, status) => {
    const now = Date.now();
    if (endDate.getTime() < now) return 'expired';
    if (startDate.getTime() > now) return status === 'inactive' ? 'inactive' : 'scheduled';
    if (status === 'scheduled' || status === 'active') return 'active';
    return status || 'active';
};

export const validateCreateBannerDto = (body = {}) => {
    const cleaned = stripServerManagedFields(body);
    const result = bannerEditableSchema.safeParse(cleaned);
    if (!result.success) {
        throw new ValidationError(result.error.errors[0].message);
    }

    const startDate = parseDate(result.data.startDate, 'startDate');
    const endDate = parseDate(result.data.endDate, 'endDate');

    if (endDate.getTime() <= startDate.getTime()) {
        throw new ValidationError('endDate must be after startDate');
    }

    const type = normalizeBannerType(result.data.type || result.data.redirectType);
    const target = normalizeBannerTarget(result.data.target || result.data.redirectValue);

    if (!BANNER_TYPES.includes(type)) {
        throw new ValidationError('Invalid banner type');
    }
    if (!BANNER_TARGETS.includes(target)) {
        throw new ValidationError('Invalid banner target');
    }

    return {
        title: result.data.title.trim(),
        type,
        target,
        priority: Number(result.data.priority ?? 1),
        startDate,
        endDate,
        status: deriveBannerStatus(startDate, endDate, result.data.status),
    };
};

export const validateUpdateBannerDto = (body = {}) => {
    const cleaned = stripServerManagedFields(body);
    const partial = bannerEditableSchema.partial().safeParse(cleaned);
    if (!partial.success) {
        throw new ValidationError(partial.error.errors[0].message);
    }

    const data = { ...partial.data };
    if (data.title !== undefined) data.title = data.title.trim();

    if (data.type !== undefined || data.redirectType !== undefined) {
        data.type = normalizeBannerType(data.type || data.redirectType);
        if (!BANNER_TYPES.includes(data.type)) {
            throw new ValidationError('Invalid banner type');
        }
    }

    if (data.target !== undefined || data.redirectValue !== undefined) {
        data.target = normalizeBannerTarget(data.target || data.redirectValue);
        if (!BANNER_TARGETS.includes(data.target)) {
            throw new ValidationError('Invalid banner target');
        }
    }

    if (data.startDate) data.startDate = parseDate(data.startDate, 'startDate');
    if (data.endDate) data.endDate = parseDate(data.endDate, 'endDate');

    if (data.startDate && data.endDate && data.endDate.getTime() <= data.startDate.getTime()) {
        throw new ValidationError('endDate must be after startDate');
    }

    delete data.redirectType;
    delete data.redirectValue;

    return data;
};

export const validateBannerId = (id) => {
    if (!mongoose.Types.ObjectId.isValid(String(id))) {
        throw new ValidationError('Invalid banner id');
    }
    return String(id);
};

export const validateBannerStatusDto = (body = {}) => {
    const status = String(body.status || '').trim();
    if (!BANNER_STATUSES.includes(status)) {
        throw new ValidationError('Invalid banner status');
    }
    return { status };
};
