import { PorterBanner } from '../models/porterBanner.model.js';
import { NotFoundError, ValidationError } from '../../../core/auth/errors.js';
import { resolveActionPerformerSnapshot } from '../../../core/utils/performer.js';
import { uploadImageBufferDetailed } from '../../../services/cloudinary.service.js';
import { v2 as cloudinary } from 'cloudinary';
import { parseListQuery, buildDateRangeFilter, toPorterPagination, escapeRegex } from '../utils/pagination.util.js';
import { mapBanner, mapPublicBanner } from '../utils/mappers.util.js';
import {
    validateCreateBannerDto,
    validateUpdateBannerDto,
    validateBannerId,
    validateBannerStatusDto,
    deriveBannerStatus,
    normalizeBannerType,
    normalizeBannerTarget,
} from '../validators/banner.validator.js';
import { validateListQuery } from '../validators/listQuery.validator.js';
import { applySoftDelete } from '../utils/softDelete.util.js';

const baseFilter = { isDeleted: { $ne: true } };

const BANNER_LIST_PROJECTION = {
    title: 1,
    type: 1,
    target: 1,
    image: 1,
    priority: 1,
    status: 1,
    startDate: 1,
    endDate: 1,
    displayOrder: 1,
    createdAt: 1,
    updatedAt: 1,
    // Legacy read support until documents are re-saved
    subtitle: 1,
    redirectType: 1,
    redirectValue: 1,
};

const buildSort = (sortBy, sortOrder) => {
    const allowed = ['title', 'priority', 'status', 'startDate', 'endDate', 'createdAt'];
    const key = allowed.includes(sortBy) ? sortBy : 'priority';
    return { [key]: sortOrder, priority: sortOrder };
};

async function syncExpiredBanners() {
    const now = new Date();
    await PorterBanner.updateMany(
        {
            ...baseFilter,
            endDate: { $lt: now },
            status: { $in: ['active', 'scheduled'] },
        },
        { $set: { status: 'expired' } },
    );
}

const applyListFilters = (filter, parsed, query = {}) => {
    if (parsed.status) filter.status = parsed.status;

    if (query.type && String(query.type) !== 'all') {
        filter.type = normalizeBannerType(query.type);
    }

    if (parsed.search) {
        const term = escapeRegex(parsed.search);
        filter.$or = [
            { title: { $regex: term, $options: 'i' } },
            { type: { $regex: term, $options: 'i' } },
        ];
    }

    const createdRange = buildDateRangeFilter(parsed.createdFrom, parsed.createdTo);
    if (createdRange) filter.createdAt = createdRange;

    if (query.activeOn) {
        const activeOn = new Date(query.activeOn);
        if (!Number.isNaN(activeOn.getTime())) {
            filter.startDate = { $lte: activeOn };
            filter.endDate = { $gte: activeOn };
            filter.status = { $in: ['active', 'scheduled'] };
        }
    }

    return filter;
};

export async function listBanners(query = {}) {
    validateListQuery(query);
    await syncExpiredBanners();

    const parsed = parseListQuery(query);
    const filter = applyListFilters({ ...baseFilter }, parsed, query);
    const sort = buildSort(parsed.sortBy, parsed.sortOrder);

    const [docs, total] = await Promise.all([
        PorterBanner.find(filter)
            .select(BANNER_LIST_PROJECTION)
            .sort(sort)
            .skip(parsed.skip)
            .limit(parsed.limit)
            .lean(),
        PorterBanner.countDocuments(filter),
    ]);

    const records = docs.map((doc) => mapBanner(doc));
    return toPorterPagination({ docs: records, total, page: parsed.page, limit: parsed.limit });
}

export async function getBannerById(id) {
    await syncExpiredBanners();
    const bannerId = validateBannerId(id);
    const doc = await PorterBanner.findOne({ _id: bannerId, ...baseFilter })
        .select(BANNER_LIST_PROJECTION)
        .lean();

    if (!doc) throw new NotFoundError('Banner not found');
    return mapBanner(doc);
}

async function uploadBannerImage(file) {
    if (!file?.buffer) return null;
    const uploaded = await uploadImageBufferDetailed(file.buffer, 'porter/banners');
    return {
        url: uploaded.secure_url,
        publicId: uploaded.public_id,
    };
}

export async function createBanner(body, reqUser, file = null) {
    const payload = validateCreateBannerDto(body);
    const performer = await resolveActionPerformerSnapshot(reqUser);
    const uploadedImage = await uploadBannerImage(file);

    if (!uploadedImage?.url) {
        throw new ValidationError('Banner image is required');
    }

    const duplicate = await PorterBanner.findOne({
        title: payload.title,
        isDeleted: { $ne: true },
    }).select('_id').lean();

    if (duplicate) throw new ValidationError('Banner title already exists');

    try {
        const doc = await PorterBanner.create({
            title: payload.title,
            type: payload.type,
            target: payload.target,
            priority: payload.priority,
            displayOrder: payload.priority,
            startDate: payload.startDate,
            endDate: payload.endDate,
            status: payload.status,
            image: uploadedImage,
            createdBy: performer,
            updatedBy: performer,
            statusHistory: [{ status: payload.status, changedBy: performer }],
        });

        return mapBanner(doc.toObject());
    } catch (err) {
        if (uploadedImage.publicId) {
            try { await cloudinary.uploader.destroy(uploadedImage.publicId); } catch { /* ignore */ }
        }
        throw err;
    }
}

export async function updateBanner(id, body, reqUser, file = null) {
    const bannerId = validateBannerId(id);
    const payload = validateUpdateBannerDto(body);
    const doc = await PorterBanner.findOne({ _id: bannerId, ...baseFilter });
    if (!doc) throw new NotFoundError('Banner not found');

    if (payload.title && payload.title !== doc.title) {
        const duplicate = await PorterBanner.findOne({
            title: payload.title,
            _id: { $ne: doc._id },
            isDeleted: { $ne: true },
        }).select('_id').lean();
        if (duplicate) throw new ValidationError('Banner title already exists');
    }

    const performer = await resolveActionPerformerSnapshot(reqUser);
    const uploadedImage = await uploadBannerImage(file);

    if (uploadedImage?.url) {
        if (doc.image?.publicId) {
            try { await cloudinary.uploader.destroy(doc.image.publicId); } catch { /* ignore */ }
        }
        doc.image = uploadedImage;
    }

    const editableFields = ['title', 'type', 'target', 'priority', 'startDate', 'endDate', 'status'];
    editableFields.forEach((field) => {
        if (payload[field] !== undefined) {
            doc[field] = payload[field];
        }
    });

    if (payload.priority !== undefined) {
        doc.displayOrder = payload.priority;
    }

    const startDate = payload.startDate || doc.startDate;
    const endDate = payload.endDate || doc.endDate;
    if ((payload.startDate || payload.endDate) && !payload.status) {
        doc.status = deriveBannerStatus(startDate, endDate, doc.status);
    }

    const previousStatus = doc.status;
    doc.updatedBy = performer;

    if (payload.status && payload.status !== previousStatus) {
        doc.statusHistory.push({ status: payload.status, changedBy: performer });
    }

    await doc.save();
    return mapBanner(doc.toObject());
}

export async function updateBannerStatus(id, body, reqUser) {
    const bannerId = validateBannerId(id);
    const { status } = validateBannerStatusDto(body);
    const doc = await PorterBanner.findOne({ _id: bannerId, ...baseFilter });
    if (!doc) throw new NotFoundError('Banner not found');

    const performer = await resolveActionPerformerSnapshot(reqUser);
    doc.status = status;
    doc.updatedBy = performer;
    doc.statusHistory.push({ status, changedBy: performer });
    await doc.save();

    return mapBanner(doc.toObject());
}

export async function deleteBanner(id, reqUser) {
    const bannerId = validateBannerId(id);
    const doc = await PorterBanner.findOne({ _id: bannerId, ...baseFilter });
    if (!doc) throw new NotFoundError('Banner not found');

    if (doc.image?.publicId) {
        try { await cloudinary.uploader.destroy(doc.image.publicId); } catch { /* ignore */ }
    }

    await PorterBanner.findByIdAndDelete(bannerId);
    return { id: bannerId };
}

export async function getBannerStats() {
    await syncExpiredBanners();

    const [active, inactive, scheduled, expired, total] = await Promise.all([
        PorterBanner.countDocuments({ ...baseFilter, status: 'active' }),
        PorterBanner.countDocuments({ ...baseFilter, status: 'inactive' }),
        PorterBanner.countDocuments({ ...baseFilter, status: 'scheduled' }),
        PorterBanner.countDocuments({ ...baseFilter, status: 'expired' }),
        PorterBanner.countDocuments(baseFilter),
    ]);

    return { active, inactive, scheduled, expired, total };
}

const PUBLIC_OFFER_TYPES = ['promotional', 'offer'];

export async function listPublicOfferBanners() {
    await syncExpiredBanners();

    const now = new Date();
    const docs = await PorterBanner.find({
        ...baseFilter,
        $or: [
            { target: 'porter' },
            { target: { $exists: false } },
            { target: null },
        ],
        startDate: { $lte: now },
        endDate: { $gte: now },
        status: { $in: ['active', 'scheduled'] },
    })
        .select(BANNER_LIST_PROJECTION)
        .sort({ priority: 1, displayOrder: 1, createdAt: -1 })
        .lean();

    const banners = [];
    docs.forEach((doc) => {
        if (mapBanner(doc).status !== 'active') return;
        banners.push(mapPublicBanner(doc));
    });
    return banners;
}
