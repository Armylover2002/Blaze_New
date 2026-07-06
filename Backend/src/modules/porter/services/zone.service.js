import { PorterZone } from '../models/porterZone.model.js';
import { NotFoundError, ValidationError, ConflictError } from '../../../core/auth/errors.js';
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
import { findOverlappingZone, ZONE_OVERLAP_MESSAGE } from '../../../utils/zoneOverlap.js';

const baseFilter = { isDeleted: { $ne: true } };

const buildSort = (sortBy, sortOrder) => {
    const allowed = ['name', 'country', 'status', 'displayOrder', 'createdAt'];
    const key = allowed.includes(sortBy) ? sortBy : 'displayOrder';
    return { [key]: sortOrder };
};

export async function listZones(query = {}) {
    validateListQuery(query);
    const parsed = parseListQuery(query);
    const filter = { ...baseFilter };

    if (parsed.status) filter.status = parsed.status;
    if (parsed.country) filter.country = parsed.country;

    if (parsed.search) {
        const term = escapeRegex(parsed.search);
        filter.$or = [
            { name: { $regex: term, $options: 'i' } },
            { country: { $regex: term, $options: 'i' } },
            { zoneCode: { $regex: term, $options: 'i' } },
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

const convertToGeoJSON = (coordinates) => {
    if (!Array.isArray(coordinates) || coordinates.length < 3) return null;
    const geoCoords = coordinates.map((c) => [c.lng, c.lat]);
    
    // Close the polygon if not closed
    const first = geoCoords[0];
    const last = geoCoords[geoCoords.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
        geoCoords.push([...first]);
    }

    return {
        type: 'Polygon',
        coordinates: [geoCoords],
    };
};

export async function createZone(body, reqUser) {
    const payload = validateCreateZoneDto(body);
    const performer = await resolveActionPerformerSnapshot(reqUser);

    const existing = await PorterZone.findOne({
        ...baseFilter,
        name: { $regex: new RegExp(`^${escapeRegex(payload.name)}$`, 'i') },
        country: payload.country,
    }).select('_id').lean();

    if (existing) {
        throw new ConflictError('Zone with this name already exists in the country');
    }

    if (payload.coordinates) {
        const overlapping = await findOverlappingZone(PorterZone, payload.coordinates, {
            extraFilter: baseFilter,
        });
        if (overlapping) {
            throw new ConflictError(ZONE_OVERLAP_MESSAGE);
        }
    }

    if (payload.coordinates) {
        payload.geometry = convertToGeoJSON(payload.coordinates);
        delete payload.coordinates;
        delete payload.polygon;
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
    const doc = await PorterZone.findOne({ _id: zoneId, ...baseFilter }).lean();
    if (!doc) throw new NotFoundError('Zone not found');

    if (payload.name || payload.country) {
        const checkName = payload.name || doc.name;
        const checkCountry = payload.country || doc.country;
        const existing = await PorterZone.findOne({
            ...baseFilter,
            _id: { $ne: zoneId },
            name: { $regex: new RegExp(`^${escapeRegex(checkName)}$`, 'i') },
            country: checkCountry,
        }).select('_id').lean();

        if (existing) {
            throw new ConflictError('Zone with this name already exists in the country');
        }
    }

    if (payload.coordinates) {
        const overlapping = await findOverlappingZone(PorterZone, payload.coordinates, {
            excludeId: zoneId,
            extraFilter: baseFilter,
        });
        if (overlapping) {
            throw new ConflictError(ZONE_OVERLAP_MESSAGE);
        }
    }

    if (payload.coordinates) {
        payload.geometry = convertToGeoJSON(payload.coordinates);
        delete payload.coordinates;
        delete payload.polygon;
    }

    const performer = await resolveActionPerformerSnapshot(reqUser);
    const updated = await PorterZone.findOneAndUpdate(
        { _id: zoneId, ...baseFilter },
        { $set: { ...payload, updatedBy: performer } },
        { new: true, runValidators: true }
    ).lean();

    return mapZone(updated);
}

export async function updateZoneStatus(id, body, reqUser) {
    const zoneId = validateZoneId(id);
    const performer = await resolveActionPerformerSnapshot(reqUser);

    const updated = await PorterZone.findOneAndUpdate(
        { _id: zoneId, ...baseFilter },
        {
            $set: { status, updatedBy: performer },
            $push: { statusHistory: { status, changedBy: performer } }
        },
        { new: true, runValidators: true }
    ).lean();

    if (!updated) throw new NotFoundError('Zone not found');

    return mapZone(updated);
}

export async function deleteZone(id, reqUser) {
    const zoneId = validateZoneId(id);
    const performer = await resolveActionPerformerSnapshot(reqUser);
    const updated = await PorterZone.findOneAndUpdate(
        { _id: zoneId, ...baseFilter },
        {
            $set: {
                isDeleted: true,
                deletedAt: new Date(),
                deletedBy: performer,
                status: 'inactive'
            }
        },
        { new: true }
    ).lean();

    if (!updated) throw new NotFoundError('Zone not found');

    return { id: zoneId };
}

export async function listZoneDropdown() {
    const docs = await PorterZone.find({ ...baseFilter, status: 'active' })
        .sort({ displayOrder: 1, name: 1 })
        .select('name country unit status')
        .lean();

    return docs.map((doc) => mapZone(doc));
}
