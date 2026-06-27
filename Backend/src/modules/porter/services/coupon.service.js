import { PorterCoupon } from '../models/porterCoupon.model.js';
import { NotFoundError, ValidationError } from '../../../core/auth/errors.js';
import { resolveActionPerformerSnapshot } from '../../../core/utils/performer.js';
import { parseListQuery, buildDateRangeFilter, toPorterPagination, escapeRegex } from '../utils/pagination.util.js';
import { mapCoupon } from '../utils/mappers.util.js';
import {
    validateCreateCouponDto,
    validateUpdateCouponDto,
    validateCouponId,
    validateCouponStatusDto,
} from '../validators/coupon.validator.js';
import { validateListQuery } from '../validators/listQuery.validator.js';
import { applySoftDelete } from '../utils/softDelete.util.js';

const baseFilter = { isDeleted: { $ne: true } };

const buildSort = (sortBy, sortOrder) => {
    const allowed = ['code', 'name', 'discountValue', 'usedCount', 'minOrderValue', 'validFrom', 'validUntil', 'createdAt'];
    const key = allowed.includes(sortBy) ? sortBy : 'createdAt';
    return { [key]: sortOrder };
};

export async function listCoupons(query = {}) {
    validateListQuery(query);
    const parsed = parseListQuery(query);
    const filter = { ...baseFilter };

    if (parsed.status) filter.status = parsed.status;
    if (parsed.discountType) filter.discountType = parsed.discountType;

    if (parsed.search) {
        const term = escapeRegex(parsed.search);
        filter.$or = [
            { code: { $regex: term, $options: 'i' } },
            { name: { $regex: term, $options: 'i' } },
            { description: { $regex: term, $options: 'i' } },
        ];
    }

    const dateRange = buildDateRangeFilter(parsed.createdFrom, parsed.createdTo);
    if (dateRange) filter.createdAt = dateRange;

    const sort = buildSort(parsed.sortBy, parsed.sortOrder);

    const [docs, total] = await Promise.all([
        PorterCoupon.find(filter)
            .sort(sort)
            .skip(parsed.skip)
            .limit(parsed.limit)
            .lean(),
        PorterCoupon.countDocuments(filter),
    ]);

    const records = docs.map((doc) => mapCoupon(doc));
    return toPorterPagination({ docs: records, total, page: parsed.page, limit: parsed.limit });
}

export async function getCouponById(id) {
    const couponId = validateCouponId(id);
    const doc = await PorterCoupon.findOne({ _id: couponId, ...baseFilter }).lean();
    if (!doc) throw new NotFoundError('Coupon not found');
    return mapCoupon(doc);
}

export async function createCoupon(body, reqUser) {
    const payload = validateCreateCouponDto(body);
    const performer = await resolveActionPerformerSnapshot(reqUser);

    const existing = await PorterCoupon.findOne({
        code: payload.code,
        isDeleted: { $ne: true },
    }).select('_id').lean();
    if (existing) throw new ValidationError('Coupon code already exists');

    const doc = await PorterCoupon.create({
        ...payload,
        createdBy: performer,
        updatedBy: performer,
        statusHistory: [{ status: payload.status, changedBy: performer }],
    });

    return mapCoupon(doc.toObject());
}

export async function updateCoupon(id, body, reqUser) {
    const couponId = validateCouponId(id);
    const payload = validateUpdateCouponDto(body);
    const doc = await PorterCoupon.findOne({ _id: couponId, ...baseFilter });
    if (!doc) throw new NotFoundError('Coupon not found');

    if (payload.code && payload.code !== doc.code) {
        const duplicate = await PorterCoupon.findOne({
            code: payload.code,
            _id: { $ne: doc._id },
            isDeleted: { $ne: true },
        }).select('_id').lean();
        if (duplicate) throw new ValidationError('Coupon code already exists');
    }

    const performer = await resolveActionPerformerSnapshot(reqUser);
    Object.assign(doc, payload);
    doc.updatedBy = performer;
    await doc.save();

    return mapCoupon(doc.toObject());
}

export async function updateCouponStatus(id, body, reqUser) {
    const couponId = validateCouponId(id);
    const { status } = validateCouponStatusDto(body);
    const doc = await PorterCoupon.findOne({ _id: couponId, ...baseFilter });
    if (!doc) throw new NotFoundError('Coupon not found');

    const performer = await resolveActionPerformerSnapshot(reqUser);
    doc.status = status;
    doc.active = status === 'active';
    doc.updatedBy = performer;
    doc.statusHistory.push({ status, changedBy: performer });
    await doc.save();

    return mapCoupon(doc.toObject());
}

export async function deleteCoupon(id, reqUser) {
    const couponId = validateCouponId(id);
    const doc = await PorterCoupon.findOne({ _id: couponId, ...baseFilter });
    if (!doc) throw new NotFoundError('Coupon not found');

    const performer = await resolveActionPerformerSnapshot(reqUser);
    applySoftDelete(doc, performer);
    await doc.save();

    return { id: couponId };
}

export async function getCouponSummary() {
    const [active, scheduled, expired, inactive, total] = await Promise.all([
        PorterCoupon.countDocuments({ ...baseFilter, status: 'active' }),
        PorterCoupon.countDocuments({ ...baseFilter, status: 'scheduled' }),
        PorterCoupon.countDocuments({ ...baseFilter, status: 'expired' }),
        PorterCoupon.countDocuments({ ...baseFilter, status: 'inactive' }),
        PorterCoupon.countDocuments(baseFilter),
    ]);

    return { active, scheduled, expired, inactive, total };
}
