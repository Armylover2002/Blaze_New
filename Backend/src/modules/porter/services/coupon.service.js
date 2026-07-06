import mongoose from 'mongoose';
import { PorterCoupon } from '../models/porterCoupon.model.js';
import { PorterZone } from '../models/porterZone.model.js';
import { PorterVehicle } from '../models/porterVehicle.model.js';
import { NotFoundError, ValidationError } from '../../../core/auth/errors.js';
import { resolveActionPerformerSnapshot } from '../../../core/utils/performer.js';
import { parseListQuery, buildDateRangeFilter, toPorterPagination, escapeRegex } from '../utils/pagination.util.js';
import { mapCoupon, buildRelationMaps, mapPublicCoupon } from '../utils/mappers.util.js';
import {
    validateCreateCouponDto,
    validateUpdateCouponDto,
    validateCouponId,
    validateCouponStatusDto,
    validateDiscountRules,
} from '../validators/coupon.validator.js';
import { validateListQuery } from '../validators/listQuery.validator.js';
import {
    resolveCouponStatusForSave,
    validateStatusTransition,
    appendStatusHistoryIfChanged,
    buildStatusHistoryEntry,
    validateCouponForRedemption,
} from '../utils/coupon-lifecycle.helpers.js';
import { bulkUpdateCouponStatuses } from './coupon-lifecycle.service.js';

export { validateCouponForRedemption, bulkUpdateCouponStatuses };

const baseFilter = { isDeleted: { $ne: true } };

const COUPON_LIST_PROJECTION = {
    code: 1,
    name: 1,
    description: 1,
    discountType: 1,
    discountValue: 1,
    maxDiscount: 1,
    minOrderValue: 1,
    maxUses: 1,
    usedCount: 1,
    perUserLimit: 1,
    validFrom: 1,
    validUntil: 1,
    firstOrderOnly: 1,
    newCustomerOnly: 1,
    autoApply: 1,
    status: 1,
    zoneIds: 1,
    vehicleIds: 1,
    campaignRevenue: 1,
    totalDiscountGiven: 1,
    createdAt: 1,
    updatedAt: 1,
};

const buildSort = (sortBy, sortOrder) => {
    const allowed = ['code', 'name', 'discountValue', 'usedCount', 'minOrderValue', 'validFrom', 'validUntil', 'createdAt'];
    const key = allowed.includes(sortBy) ? sortBy : 'createdAt';
    return { [key]: sortOrder };
};

const isAllZonesLegacy = (zones = []) => (
    !zones.length || zones.includes('All Zones')
);

const isAllVehiclesLegacy = (vehicleTypes = []) => (
    !vehicleTypes.length || vehicleTypes.includes('All')
);

const normalizeObjectIdList = (ids = []) => (
    [...new Set((ids || []).map((id) => String(id)))]
);

async function resolveZoneIds({ zoneIds, zones }) {
    if (zoneIds !== undefined) {
        if (Array.isArray(zoneIds) && zoneIds.length === 0) {
            const found = await PorterZone.find({
                ...baseFilter,
                status: 'active',
            }).select('_id').lean();
            return found.map((doc) => doc._id);
        }
        const uniqueIds = normalizeObjectIdList(zoneIds);
        if (!uniqueIds.length) {
            const found = await PorterZone.find({
                ...baseFilter,
                status: 'active',
            }).select('_id').lean();
            return found.map((doc) => doc._id);
        }

        const found = await PorterZone.find({
            _id: { $in: uniqueIds },
            ...baseFilter,
            status: 'active',
        }).select('_id').lean();

        if (found.length !== uniqueIds.length) {
            throw new ValidationError('One or more zoneIds are invalid or inactive');
        }

        return found.map((doc) => doc._id);
    }

    if (zones !== undefined) {
        if (isAllZonesLegacy(zones)) {
            const found = await PorterZone.find({
                ...baseFilter,
                status: 'active',
            }).select('_id').lean();
            return found.map((doc) => doc._id);
        }

        const names = zones.map((z) => String(z).trim()).filter(Boolean);
        const found = await PorterZone.find({
            name: { $in: names },
            ...baseFilter,
            status: 'active',
        }).select('_id name').lean();

        if (found.length !== names.length) {
            throw new ValidationError('One or more zones are invalid or inactive');
        }

        return found.map((doc) => doc._id);
    }

    return undefined;
}

async function resolveVehicleIds({ vehicleIds, vehicleTypes }) {
    console.log('[DEBUG] resolveVehicleIds called with:', { vehicleIds, vehicleTypes });
    if (vehicleIds !== undefined) {
        if (Array.isArray(vehicleIds) && vehicleIds.length === 0) {
            console.log('[DEBUG] vehicleIds is an empty array. Fetching all active vehicles...');
            const found = await PorterVehicle.find({ ...baseFilter, status: 'active' }).select('_id name').lean();
            console.log('[DEBUG] Fetched active vehicles length:', found.length);
            console.log('[DEBUG] Fetched active vehicles:', found.map(v => v.name));
            return found.map((doc) => doc._id);
        }
        const uniqueIds = normalizeObjectIdList(vehicleIds);
        console.log('[DEBUG] uniqueIds after normalization:', uniqueIds);
        if (!uniqueIds.length) {
            const found = await PorterVehicle.find({
                ...baseFilter,
                status: 'active',
            }).select('_id').lean();
            console.log('[DEBUG] Fallback fetch active vehicles length:', found.length);
            return found.map((doc) => doc._id);
        }

        const found = await PorterVehicle.find({
            _id: { $in: uniqueIds },
            ...baseFilter,
            status: 'active',
        }).select('_id').lean();

        if (found.length !== uniqueIds.length) {
            throw new ValidationError('One or more vehicleIds are invalid or inactive');
        }

        return found.map((doc) => doc._id);
    }

    if (vehicleTypes !== undefined) {
        if (isAllVehiclesLegacy(vehicleTypes)) {
            const found = await PorterVehicle.find({
                ...baseFilter,
                status: 'active',
            }).select('_id').lean();
            return found.map((doc) => doc._id);
        }

        const names = vehicleTypes.map((v) => String(v).trim()).filter(Boolean);
        const found = await PorterVehicle.find({
            $or: [
                { name: { $in: names } },
                { category: { $in: names } },
            ],
            ...baseFilter,
            status: 'active',
        }).select('_id name category').lean();

        if (!found.length) {
            throw new ValidationError('One or more vehicleTypes are invalid or inactive');
        }

        return [...new Set(found.map((doc) => String(doc._id)))].map((id) => new mongoose.Types.ObjectId(id));
    }

    return undefined;
}

async function resolveRelationsForPayload(payload) {
    const [resolvedZoneIds, resolvedVehicleIds] = await Promise.all([
        resolveZoneIds(payload),
        resolveVehicleIds(payload),
    ]);

    const next = { ...payload };
    delete next.zones;
    delete next.vehicleTypes;

    if (resolvedZoneIds !== undefined) next.zoneIds = resolvedZoneIds;
    if (resolvedVehicleIds !== undefined) next.vehicleIds = resolvedVehicleIds;

    return next;
}

async function mapCouponsWithRelations(docs = []) {
    if (!docs.length) return [];

    const zoneIdSet = new Set();
    const vehicleIdSet = new Set();

    docs.forEach((doc) => {
        (doc.zoneIds || []).forEach((id) => zoneIdSet.add(String(id)));
        (doc.vehicleIds || []).forEach((id) => vehicleIdSet.add(String(id)));
    });

    const [zones, vehicles] = await Promise.all([
        zoneIdSet.size
            ? PorterZone.find({ _id: { $in: [...zoneIdSet] } }).select('name').lean()
            : [],
        vehicleIdSet.size
            ? PorterVehicle.find({ _id: { $in: [...vehicleIdSet] } }).select('name category').lean()
            : [],
    ]);

    const { zoneMap, vehicleMap } = buildRelationMaps(zones, vehicles);
    return docs.map((doc) => mapCoupon(doc, zoneMap, vehicleMap));
}

const applyListFilters = (filter, parsed, query = {}) => {
    if (parsed.status) {
        filter.status = parsed.status;
    }
    if (parsed.discountType) filter.discountType = parsed.discountType;

    if (parsed.search) {
        const term = escapeRegex(parsed.search);
        filter.$or = [
            { code: { $regex: term, $options: 'i' } },
            { name: { $regex: term, $options: 'i' } },
            { description: { $regex: term, $options: 'i' } },
        ];
    }

    const createdRange = buildDateRangeFilter(parsed.createdFrom, parsed.createdTo);
    if (createdRange) filter.createdAt = createdRange;

    const validFrom = query.validFrom ? new Date(query.validFrom) : null;
    const validUntil = query.validUntil ? new Date(query.validUntil) : null;
    if (validFrom && !Number.isNaN(validFrom.getTime())) {
        filter.validUntil = { ...(filter.validUntil || {}), $gte: validFrom };
    }
    if (validUntil && !Number.isNaN(validUntil.getTime())) {
        const end = new Date(validUntil);
        end.setHours(23, 59, 59, 999);
        filter.validFrom = { ...(filter.validFrom || {}), $lte: end };
    }

    if (query.zoneId && mongoose.Types.ObjectId.isValid(String(query.zoneId))) {
        filter.zoneIds = new mongoose.Types.ObjectId(String(query.zoneId));
    }

    if (query.vehicleId && mongoose.Types.ObjectId.isValid(String(query.vehicleId))) {
        filter.vehicleIds = new mongoose.Types.ObjectId(String(query.vehicleId));
    }

    return filter;
};

export async function listCoupons(query = {}) {
    validateListQuery(query);
    const parsed = parseListQuery(query);
    const filter = applyListFilters({ ...baseFilter }, parsed, query);
    const sort = buildSort(parsed.sortBy, parsed.sortOrder);

    const [docs, total] = await Promise.all([
        PorterCoupon.find(filter)
            .select(COUPON_LIST_PROJECTION)
            .sort(sort)
            .skip(parsed.skip)
            .limit(parsed.limit)
            .lean(),
        PorterCoupon.countDocuments(filter),
    ]);

    const records = await mapCouponsWithRelations(docs);
    return toPorterPagination({ docs: records, total, page: parsed.page, limit: parsed.limit });
}

export async function getCouponById(id) {
    const couponId = validateCouponId(id);
    const doc = await PorterCoupon.findOne({ _id: couponId, ...baseFilter })
        .select(COUPON_LIST_PROJECTION)
        .lean();

    if (!doc) throw new NotFoundError('Coupon not found');

    const [mapped] = await mapCouponsWithRelations([doc]);
    return mapped;
}

export async function createCoupon(body, reqUser) {
    const payload = await resolveRelationsForPayload(validateCreateCouponDto(body));
    const performer = await resolveActionPerformerSnapshot(reqUser);

    const existing = await PorterCoupon.findOne({
        code: payload.code,
        isDeleted: { $ne: true },
    }).select('_id').lean();

    if (existing) throw new ValidationError('Coupon code already exists');

    const duplicateName = await PorterCoupon.findOne({
        name: payload.name,
        isDeleted: { $ne: true },
    }).select('_id').lean();
    if (duplicateName) throw new ValidationError('Coupon name already exists');

    try {
        const doc = await PorterCoupon.create({
            code: payload.code,
            name: payload.name,
            description: payload.description,
            discountType: payload.discountType,
            discountValue: payload.discountValue,
            maxDiscount: payload.maxDiscount,
            minOrderValue: payload.minOrderValue,
            maxUses: payload.maxUses,
            perUserLimit: payload.perUserLimit,
            validFrom: payload.validFrom,
            validUntil: payload.validUntil,
            firstOrderOnly: payload.firstOrderOnly,
            newCustomerOnly: payload.newCustomerOnly,
            autoApply: payload.autoApply,
            status: payload.status,
            zoneIds: payload.zoneIds || [],
            vehicleIds: payload.vehicleIds || [],
            createdBy: performer,
            updatedBy: performer,
            statusHistory: [buildStatusHistoryEntry(null, payload.status, performer)],
        });

        const [mapped] = await mapCouponsWithRelations([doc.toObject()]);
        return mapped;
    } catch (err) {
        if (err?.code === 11000) {
            throw new ValidationError('Coupon code already exists');
        }
        throw err;
    }
}

export async function updateCoupon(id, body, reqUser) {
    const couponId = validateCouponId(id);
    const payload = await resolveRelationsForPayload(validateUpdateCouponDto(body));

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

    if (payload.name && payload.name !== doc.name) {
        const duplicateName = await PorterCoupon.findOne({
            name: payload.name,
            _id: { $ne: doc._id },
            isDeleted: { $ne: true },
        }).select('_id').lean();
        if (duplicateName) throw new ValidationError('Coupon name already exists');
    }

    const performer = await resolveActionPerformerSnapshot(reqUser);
    const previousStatus = doc.status;

    const editableFields = [
        'code', 'name', 'description', 'discountType', 'discountValue',
        'maxDiscount', 'minOrderValue', 'maxUses', 'perUserLimit',
        'validFrom', 'validUntil', 'firstOrderOnly', 'newCustomerOnly',
        'autoApply', 'status', 'zoneIds', 'vehicleIds',
    ];

    editableFields.forEach((field) => {
        if (payload[field] !== undefined) {
            doc[field] = payload[field];
        }
    });

    validateDiscountRules({
        discountType: doc.discountType,
        discountValue: doc.discountValue,
        maxDiscount: doc.maxDiscount,
        minOrderValue: doc.minOrderValue,
    });

    const now = new Date();
    const mergedValidFrom = doc.validFrom;
    const mergedValidUntil = doc.validUntil;
    const lifecycleFieldsChanged = (
        payload.validFrom !== undefined
        || payload.validUntil !== undefined
        || payload.status !== undefined
    );

    if (lifecycleFieldsChanged) {
        if (payload.status === 'scheduled' || payload.status === 'expired') {
            validateStatusTransition(
                previousStatus,
                payload.status,
                mergedValidFrom,
                mergedValidUntil,
                now,
            );
        }

        const nextStatus = resolveCouponStatusForSave({
            validFrom: mergedValidFrom,
            validUntil: mergedValidUntil,
            currentStatus: previousStatus,
            requestedStatus: payload.status,
            now,
        });

        doc.status = nextStatus;
        appendStatusHistoryIfChanged(doc, previousStatus, nextStatus, performer);
    }

    doc.updatedBy = performer;

    await doc.save();

    const [mapped] = await mapCouponsWithRelations([doc.toObject()]);
    return mapped;
}

export async function updateCouponStatus(id, body, reqUser) {
    const couponId = validateCouponId(id);
    const { status: requestedStatus } = validateCouponStatusDto(body);

    const doc = await PorterCoupon.findOne({ _id: couponId, ...baseFilter });
    if (!doc) throw new NotFoundError('Coupon not found');

    const performer = await resolveActionPerformerSnapshot(reqUser);
    const previousStatus = doc.status;
    const now = new Date();

    const nextStatus = resolveCouponStatusForSave({
        validFrom: doc.validFrom,
        validUntil: doc.validUntil,
        currentStatus: previousStatus,
        requestedStatus,
        now,
    });

    if (requestedStatus === 'scheduled' || requestedStatus === 'expired') {
        validateStatusTransition(previousStatus, requestedStatus, doc.validFrom, doc.validUntil, now);
    }

    doc.status = nextStatus;
    doc.updatedBy = performer;
    appendStatusHistoryIfChanged(doc, previousStatus, nextStatus, performer);
    await doc.save();

    const [mapped] = await mapCouponsWithRelations([doc.toObject()]);
    return mapped;
}

export async function deleteCoupon(id) {
    const couponId = validateCouponId(id);
    const deleted = await PorterCoupon.findOneAndDelete({ _id: couponId, ...baseFilter }).lean();
    if (!deleted) throw new NotFoundError('Coupon not found');
    return { id: couponId };
}

export async function getCouponSummary() {
    const [summary] = await PorterCoupon.aggregate([
        { $match: baseFilter },
        {
            $group: {
                _id: null,
                total: { $sum: 1 },
                active: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
                scheduled: { $sum: { $cond: [{ $eq: ['$status', 'scheduled'] }, 1, 0] } },
                expired: { $sum: { $cond: [{ $eq: ['$status', 'expired'] }, 1, 0] } },
                inactive: { $sum: { $cond: [{ $eq: ['$status', 'inactive'] }, 1, 0] } },
                totalRedemption: { $sum: { $ifNull: ['$usedCount', 0] } },
                totalDiscountGiven: { $sum: { $ifNull: ['$totalDiscountGiven', 0] } },
                campaignRevenue: { $sum: { $ifNull: ['$campaignRevenue', 0] } },
            },
        },
    ]);

    if (!summary) {
        return {
            total: 0,
            active: 0,
            scheduled: 0,
            expired: 0,
            inactive: 0,
            totalRedemption: 0,
            totalDiscountGiven: 0,
            campaignRevenue: 0,
        };
    }

    return {
        total: summary.total,
        active: summary.active,
        scheduled: summary.scheduled,
        expired: summary.expired,
        inactive: summary.inactive,
        totalRedemption: summary.totalRedemption,
        totalDiscountGiven: summary.totalDiscountGiven,
        campaignRevenue: summary.campaignRevenue,
    };
}

const PUBLIC_COUPON_PROJECTION = {
    code: 1,
    name: 1,
    description: 1,
    discountType: 1,
    discountValue: 1,
    maxDiscount: 1,
    minOrderValue: 1,
    validFrom: 1,
    validUntil: 1,
    status: 1,
    perUserLimit: 1,
    firstOrderOnly: 1,
    newCustomerOnly: 1,
    autoApply: 1,
};

export async function listPublicCoupons(limit = 6) {
    const docs = await PorterCoupon.find({
        ...baseFilter,
        status: 'active',
    })
        .select({ ...PUBLIC_COUPON_PROJECTION, vehicleIds: 1 })
        .populate('vehicleIds', 'name')
        .sort({ createdAt: -1 })
        .limit(Number(limit) || 6)
        .lean();

    return docs.map((doc) => mapPublicCoupon(doc));
}
