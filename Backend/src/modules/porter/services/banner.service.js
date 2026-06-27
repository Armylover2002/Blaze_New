import { PorterBanner } from '../models/porterBanner.model.js';
import { NotFoundError, ValidationError } from '../../../core/auth/errors.js';
import { resolveActionPerformerSnapshot } from '../../../core/utils/performer.js';
import { uploadImageBufferDetailed } from '../../../services/cloudinary.service.js';
import { v2 as cloudinary } from 'cloudinary';
import { parseListQuery, buildDateRangeFilter, toPorterPagination, escapeRegex } from '../utils/pagination.util.js';
import { mapBanner } from '../utils/mappers.util.js';
import {
    validateCreateBannerDto,
    validateUpdateBannerDto,
    validateBannerId,
    validateBannerStatusDto,
} from '../validators/banner.validator.js';
import { validateListQuery } from '../validators/listQuery.validator.js';
import { applySoftDelete } from '../utils/softDelete.util.js';

const baseFilter = { isDeleted: { $ne: true } };

const buildSort = (sortBy, sortOrder) => {
    const allowed = ['title', 'priority', 'displayOrder', 'status', 'startDate', 'endDate', 'createdAt'];
    const key = allowed.includes(sortBy) ? sortBy : 'priority';
    return { [key]: sortOrder };
};

export async function listBanners(query = {}) {
    validateListQuery(query);
    const parsed = parseListQuery(query);
    const filter = { ...baseFilter };

    if (parsed.status) filter.status = parsed.status;

    if (parsed.search) {
        const term = escapeRegex(parsed.search);
        filter.$or = [
            { title: { $regex: term, $options: 'i' } },
            { subtitle: { $regex: term, $options: 'i' } },
            { redirectValue: { $regex: term, $options: 'i' } },
            { redirectType: { $regex: term, $options: 'i' } },
            { link: { $regex: term, $options: 'i' } },
        ];
    }

    const dateRange = buildDateRangeFilter(parsed.createdFrom, parsed.createdTo);
    if (dateRange) filter.createdAt = dateRange;

    const sort = buildSort(parsed.sortBy, parsed.sortOrder);

    const [docs, total] = await Promise.all([
        PorterBanner.find(filter)
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
    const bannerId = validateBannerId(id);
    const doc = await PorterBanner.findOne({ _id: bannerId, ...baseFilter }).lean();
    if (!doc) throw new NotFoundError('Banner not found');
    return mapBanner(doc);
}

async function applyBannerImage(payload, file) {
    if (!file?.buffer) {
        if (payload.image) {
            return { image: { url: payload.image, publicId: null } };
        }
        return null;
    }

    const uploaded = await uploadImageBufferDetailed(file.buffer, 'porter/banners');
    return {
        image: {
            url: uploaded.secure_url,
            publicId: uploaded.public_id,
        },
    };
}

export async function createBanner(body, reqUser, file = null) {
    const payload = validateCreateBannerDto(body);
    const performer = await resolveActionPerformerSnapshot(reqUser);
    const imagePayload = await applyBannerImage(payload, file);

    if (!imagePayload?.image?.url && !payload.image) {
        throw new ValidationError('Banner image is required');
    }

    const doc = await PorterBanner.create({
        title: payload.title,
        subtitle: payload.subtitle,
        redirectType: payload.redirectType,
        redirectValue: payload.redirectValue,
        link: payload.link,
        priority: payload.priority,
        displayOrder: payload.displayOrder,
        startDate: payload.startDate,
        endDate: payload.endDate,
        status: payload.status,
        image: imagePayload?.image || { url: payload.image, publicId: null },
        createdBy: performer,
        updatedBy: performer,
        statusHistory: [{ status: payload.status, changedBy: performer }],
    });

    return mapBanner(doc.toObject());
}

export async function updateBanner(id, body, reqUser, file = null) {
    const bannerId = validateBannerId(id);
    const payload = validateUpdateBannerDto(body);
    const doc = await PorterBanner.findOne({ _id: bannerId, ...baseFilter });
    if (!doc) throw new NotFoundError('Banner not found');

    const performer = await resolveActionPerformerSnapshot(reqUser);
    const imagePayload = await applyBannerImage(payload, file);

    if (imagePayload?.image?.url) {
        if (doc.image?.publicId) {
            try { await cloudinary.uploader.destroy(doc.image.publicId); } catch { /* ignore */ }
        }
        doc.image = imagePayload.image;
    } else if (payload.image) {
        doc.image = { url: payload.image, publicId: doc.image?.publicId || null };
    }

    if (payload.title !== undefined) doc.title = payload.title;
    if (payload.subtitle !== undefined) doc.subtitle = payload.subtitle;
    if (payload.redirectType !== undefined) doc.redirectType = payload.redirectType;
    if (payload.redirectValue !== undefined) doc.redirectValue = payload.redirectValue;
    if (payload.link !== undefined) doc.link = payload.link;
    if (payload.priority !== undefined) doc.priority = payload.priority;
    if (payload.displayOrder !== undefined) doc.displayOrder = payload.displayOrder;
    if (payload.startDate !== undefined) doc.startDate = payload.startDate;
    if (payload.endDate !== undefined) doc.endDate = payload.endDate;
    if (payload.status !== undefined) doc.status = payload.status;

    doc.updatedBy = performer;
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

    const performer = await resolveActionPerformerSnapshot(reqUser);
    applySoftDelete(doc, performer);
    await doc.save();

    return { id: bannerId };
}

export async function getBannerStats() {
    const [active, inactive, scheduled, expired] = await Promise.all([
        PorterBanner.countDocuments({ ...baseFilter, status: 'active' }),
        PorterBanner.countDocuments({ ...baseFilter, status: 'inactive' }),
        PorterBanner.countDocuments({ ...baseFilter, status: 'scheduled' }),
        PorterBanner.countDocuments({ ...baseFilter, status: 'expired' }),
    ]);
    return { active, inactive, scheduled, expired };
}
