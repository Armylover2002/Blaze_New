import { z } from 'zod';
import mongoose from 'mongoose';
import { ValidationError } from '../../../core/auth/errors.js';

const bannerBodySchema = z.object({
    title: z.string().min(1, 'Title required').max(120),
    subtitle: z.string().max(200).optional(),
    type: z.enum(['promotional', 'announcement', 'offer', 'seasonal', 'feature']).optional(),
    target: z.string().max(80).optional(),
    redirectType: z.enum(['promotional', 'announcement', 'offer', 'seasonal', 'feature', 'internal', 'external']).optional(),
    redirectValue: z.string().max(120).optional(),
    priority: z.coerce.number().int().min(0).optional(),
    displayOrder: z.coerce.number().int().min(0).optional(),
    image: z.string().optional(),
    linkUrl: z.string().optional(),
    link: z.string().optional(),
    startDate: z.string().min(1, 'Start date required'),
    endDate: z.string().min(1, 'End date required'),
    status: z.enum(['active', 'inactive', 'scheduled', 'expired']).optional(),
});

const parseDate = (value) => {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) {
        throw new ValidationError('Invalid date');
    }
    return d;
};

const deriveBannerStatus = (startDate, endDate, status) => {
    if (status) return status;
    const now = Date.now();
    if (endDate.getTime() < now) return 'expired';
    if (startDate.getTime() > now) return 'scheduled';
    return 'active';
};

export const validateCreateBannerDto = (body = {}) => {
    const result = bannerBodySchema.safeParse(body);
    if (!result.success) {
        throw new ValidationError(result.error.errors[0].message);
    }
    const startDate = parseDate(result.data.startDate);
    const endDate = parseDate(result.data.endDate);
    if (endDate.getTime() < startDate.getTime()) {
        throw new ValidationError('End date must be on or after start date');
    }
    return {
        title: result.data.title.trim(),
        subtitle: (result.data.subtitle || '').trim(),
        redirectType: result.data.redirectType || result.data.type || 'promotional',
        redirectValue: result.data.redirectValue || result.data.target || 'Home',
        priority: result.data.priority ?? 1,
        displayOrder: result.data.displayOrder ?? result.data.priority ?? 1,
        link: (result.data.link || result.data.linkUrl || '').trim(),
        startDate,
        endDate,
        status: deriveBannerStatus(startDate, endDate, result.data.status),
    };
};

export const validateUpdateBannerDto = (body = {}) => {
    const partial = bannerBodySchema.partial().safeParse(body);
    if (!partial.success) {
        throw new ValidationError(partial.error.errors[0].message);
    }
    const data = { ...partial.data };
    if (data.title !== undefined) data.title = data.title.trim();
    if (data.subtitle !== undefined) data.subtitle = data.subtitle.trim();
    if (data.redirectType !== undefined || data.type !== undefined) {
        data.redirectType = data.redirectType || data.type;
    }
    if (data.redirectValue !== undefined || data.target !== undefined) {
        data.redirectValue = data.redirectValue || data.target;
    }
    if (data.link !== undefined || data.linkUrl !== undefined) {
        data.link = (data.link || data.linkUrl || '').trim();
    }
    if (data.startDate) data.startDate = parseDate(data.startDate);
    if (data.endDate) data.endDate = parseDate(data.endDate);
    if (data.linkUrl !== undefined) data.linkUrl = data.linkUrl.trim();
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
    if (!['active', 'inactive', 'scheduled', 'expired'].includes(status)) {
        throw new ValidationError('Invalid banner status');
    }
    return { status };
};
