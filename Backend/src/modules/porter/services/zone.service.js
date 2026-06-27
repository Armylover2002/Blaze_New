import { PorterZone } from '../models/porterZone.model.js';
import { NotFoundError, ValidationError } from '../../../core/auth/errors.js';
import { resolveActionPerformerSnapshot } from '../../../core/utils/performer.js';
import { parseListQuery, buildDateRangeFilter, toPorterPagination, escapeRegex } from '../utils/pagination.util.js';
import { mapZone } from '../utils/mappers.util.js';
import {
    validateCreateZoneDto,
    validateUpdateZoneDto,
    validateZoneId,
    validateZoneStatusDto,
} from '../validators/zone.validator.js';
import { validateListQuery } from '../validators/listQuery.validator.js';
import { applySoftDelete } from '../utils/softDelete.util.js';

const baseFilter = { isDeleted: { $ne: true } };

const buildSort = (sortBy, sortOrder) => {
    const allowed = ['name', 'city', 'pincode', 'status', 'coverageKm', 'displayOrder', 'createdAt'];
    const key = allowed.includes(sortBy) ? sortBy : 'displayOrder';
    return { [key]: sortOrder };
};

export async function listZones(query = {}) {
    validateListQuery(query);
    const parsed = parseListQuery(query);
    const filter = { ...baseFilter };

    if (parsed.status) filter.status = parsed.status;
    if (parsed.city) filter.city = parsed.city;

    if (parsed.search) {
        const term = escapeRegex(parsed.search);
        filter.$or = [
            { name: { $regex: term, $options: 'i' } },
            { city: { $regex: term, $options: 'i' } },
            { pincode: { $regex: term, $options: 'i' } },
        ];
    }

    const dateRange = buildDateRangeFilter(parsed.createdFrom, parsed.createdTo);
    if (dateRange) filter.createdAt = dateRange;

    const sort = buildSort(parsed.sortBy, parsed.sortOrder);

    const [docs, total] = await Promise.all([
        PorterZone.find(filter)
            .sort(sort)
            .skip(parsed.skip)
            .limit(parsed.limit)
            .lean(),
        PorterZone.countDocuments(filter),
    ]);

    const records = docs.map((doc) => mapZone(doc));
    return toPorterPagination({ docs: records, total, page: parsed.page, limit: parsed.limit });
}

export async function getZoneById(id) {
    const zoneId = validateZoneId(id);
    const doc = await PorterZone.findOne({ _id: zoneId, ...baseFilter }).lean();
    if (!doc) throw new NotFoundError('Zone not found');
    return mapZone(doc);
}

export async function createZone(body, reqUser) {
    const payload = validateCreateZoneDto(body);
    const performer = await resolveActionPerformerSnapshot(reqUser);

    const existing = await PorterZone.findOne({
        ...baseFilter,
        name: { $regex: new RegExp(`^${escapeRegex(payload.name)}$`, 'i') },
        city: payload.city,
    }).select('_id').lean();

    if (existing) {
        throw new ValidationError('Zone with this name already exists in the city');
    }

    const doc = await PorterZone.create({
        ...payload,
        createdBy: performer,
        updatedBy: performer,
        statusHistory: [{ status: payload.status, changedBy: performer }],
    });

    return mapZone(doc.toObject());
}

export async function updateZone(id, body, reqUser) {
    const zoneId = validateZoneId(id);
    const payload = validateUpdateZoneDto(body);
    const doc = await PorterZone.findOne({ _id: zoneId, ...baseFilter });
    if (!doc) throw new NotFoundError('Zone not found');

    const performer = await resolveActionPerformerSnapshot(reqUser);
    Object.assign(doc, payload);
    doc.updatedBy = performer;
    await doc.save();

    return mapZone(doc.toObject());
}

export async function updateZoneStatus(id, body, reqUser) {
    const zoneId = validateZoneId(id);
    const { status } = validateZoneStatusDto(body);
    const doc = await PorterZone.findOne({ _id: zoneId, ...baseFilter });
    if (!doc) throw new NotFoundError('Zone not found');

    const performer = await resolveActionPerformerSnapshot(reqUser);
    doc.status = status;
    doc.updatedBy = performer;
    doc.statusHistory.push({ status, changedBy: performer });
    await doc.save();

    return mapZone(doc.toObject());
}

export async function deleteZone(id, reqUser) {
    const zoneId = validateZoneId(id);
    const doc = await PorterZone.findOne({ _id: zoneId, ...baseFilter });
    if (!doc) throw new NotFoundError('Zone not found');

    const performer = await resolveActionPerformerSnapshot(reqUser);
    applySoftDelete(doc, performer);
    await doc.save();

    return { id: zoneId };
}

export async function listZoneDropdown() {
    const docs = await PorterZone.find({ ...baseFilter, status: 'active' })
        .sort({ displayOrder: 1, name: 1 })
        .select('name city pincode status')
        .lean();

    return docs.map((doc) => mapZone(doc));
}
