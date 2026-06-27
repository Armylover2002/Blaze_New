import { PorterPricing } from '../models/porterPricing.model.js';
import { PorterVehicle } from '../models/porterVehicle.model.js';
import { NotFoundError, ValidationError } from '../../../core/auth/errors.js';
import { resolveActionPerformerSnapshot } from '../../../core/utils/performer.js';
import { parseListQuery, buildDateRangeFilter, toPorterPagination, escapeRegex } from '../utils/pagination.util.js';
import { mapPricing, mapVehicle } from '../utils/mappers.util.js';
import {
    validateCreatePricingDto,
    validateUpdatePricingDto,
    validatePricingId,
    validatePricingStatusDto,
} from '../validators/pricing.validator.js';
import { validateListQuery } from '../validators/listQuery.validator.js';
import { validateVehicleId } from '../validators/vehicle.validator.js';
import { applySoftDelete } from '../utils/softDelete.util.js';

const baseFilter = { isDeleted: { $ne: true } };

const buildSort = (sortBy, sortOrder) => {
    const allowed = ['status', 'basePrice', 'commissionValue', 'createdAt', 'displayOrder'];
    const key = allowed.includes(sortBy) ? sortBy : 'createdAt';
    return { [key]: sortOrder };
};

async function getVehicleOrThrow(vehicleId) {
    const doc = await PorterVehicle.findOne({ _id: vehicleId, isDeleted: { $ne: true } }).lean();
    if (!doc) throw new NotFoundError('Vehicle not found');
    return doc;
}

export async function listPricing(query = {}) {
    validateListQuery(query);
    const parsed = parseListQuery(query);
    const filter = { ...baseFilter, zoneId: null };

    if (parsed.status) filter.status = parsed.status;

    if (parsed.search) {
        const term = escapeRegex(parsed.search);
        const vehicles = await PorterVehicle.find({
            isDeleted: { $ne: true },
            $or: [
                { name: { $regex: term, $options: 'i' } },
                { category: { $regex: term, $options: 'i' } },
            ],
        }).select('_id').lean();
        filter.vehicleId = { $in: vehicles.map((v) => v._id) };
    }

    const dateRange = buildDateRangeFilter(parsed.createdFrom, parsed.createdTo);
    if (dateRange) filter.createdAt = dateRange;

    const sort = buildSort(parsed.sortBy, parsed.sortOrder);

    const [docs, total] = await Promise.all([
        PorterPricing.find(filter)
            .sort(sort)
            .skip(parsed.skip)
            .limit(parsed.limit)
            .lean(),
        PorterPricing.countDocuments(filter),
    ]);

    const vehicleIds = [...new Set(docs.map((d) => String(d.vehicleId)))];
    const vehicles = await PorterVehicle.find({ _id: { $in: vehicleIds } })
        .select('name category status icon iconUrl minWeight maxWeight supportedServices assignedDrivers count displayOrder description')
        .lean();
    const vehicleMap = new Map(vehicles.map((v) => [String(v._id), v]));

    const records = docs.map((doc) => {
        const vehicle = vehicleMap.get(String(doc.vehicleId));
        return {
            ...mapVehicle(vehicle, doc),
            pricing: mapPricing(doc, vehicle),
        };
    });

    return toPorterPagination({ docs: records, total, page: parsed.page, limit: parsed.limit });
}

export async function getPricingById(id) {
    const pricingId = validatePricingId(id);
    const doc = await PorterPricing.findOne({ _id: pricingId, ...baseFilter }).lean();
    if (!doc) throw new NotFoundError('Pricing not found');

    const vehicle = await getVehicleOrThrow(doc.vehicleId);
    return mapPricing(doc, vehicle);
}

export async function getPricingByVehicleId(vehicleIdRaw) {
    const vehicleId = validateVehicleId(vehicleIdRaw);
    const doc = await PorterPricing.findOne({
        vehicleId,
        zoneId: null,
        ...baseFilter,
    }).lean();

    if (!doc) throw new NotFoundError('Pricing not found for vehicle');
    const vehicle = await getVehicleOrThrow(vehicleId);
    return mapPricing(doc, vehicle);
}

export async function createPricing(body, reqUser) {
    const payload = validateCreatePricingDto(body);
    const performer = await resolveActionPerformerSnapshot(reqUser);
    await getVehicleOrThrow(payload.vehicleId);

    const existing = await PorterPricing.findOne({
        vehicleId: payload.vehicleId,
        zoneId: payload.zoneId || null,
        isDeleted: { $ne: true },
    }).select('_id').lean();

    if (existing) {
        throw new ValidationError('Pricing already exists for this vehicle');
    }

    const doc = await PorterPricing.create({
        ...payload,
        createdBy: performer,
        updatedBy: performer,
        statusHistory: [{ status: payload.status, changedBy: performer }],
    });

    const vehicle = await getVehicleOrThrow(payload.vehicleId);
    return mapPricing(doc.toObject(), vehicle);
}

export async function updatePricing(id, body, reqUser) {
    const pricingId = validatePricingId(id);
    const payload = validateUpdatePricingDto(body);
    const doc = await PorterPricing.findOne({ _id: pricingId, ...baseFilter });
    if (!doc) throw new NotFoundError('Pricing not found');

    const performer = await resolveActionPerformerSnapshot(reqUser);
    Object.assign(doc, payload);
    doc.updatedBy = performer;
    await doc.save();

    const vehicle = await getVehicleOrThrow(doc.vehicleId);
    return mapPricing(doc.toObject(), vehicle);
}

export async function updatePricingStatus(id, body, reqUser) {
    const pricingId = validatePricingId(id);
    const { status } = validatePricingStatusDto(body);
    const doc = await PorterPricing.findOne({ _id: pricingId, ...baseFilter });
    if (!doc) throw new NotFoundError('Pricing not found');

    const performer = await resolveActionPerformerSnapshot(reqUser);
    doc.status = status;
    doc.updatedBy = performer;
    doc.statusHistory.push({ status, changedBy: performer });
    await doc.save();

    const vehicle = await getVehicleOrThrow(doc.vehicleId);
    return mapPricing(doc.toObject(), vehicle);
}

export async function deletePricing(id, reqUser) {
    const pricingId = validatePricingId(id);
    const doc = await PorterPricing.findOne({ _id: pricingId, ...baseFilter });
    if (!doc) throw new NotFoundError('Pricing not found');

    const performer = await resolveActionPerformerSnapshot(reqUser);
    applySoftDelete(doc, performer);
    await doc.save();

    return { id: pricingId };
}

export async function upsertVehiclePricing(vehicleIdRaw, body, reqUser) {
    const vehicleId = validateVehicleId(vehicleIdRaw);
    const existing = await PorterPricing.findOne({
        vehicleId,
        zoneId: null,
        isDeleted: { $ne: true },
    });

    if (existing) {
        return updatePricing(String(existing._id), body, reqUser);
    }
    return createPricing({ ...body, vehicleId }, reqUser);
}

export async function clearVehiclePricing(vehicleIdRaw, reqUser) {
    const vehicleId = validateVehicleId(vehicleIdRaw);
    const doc = await PorterPricing.findOne({
        vehicleId,
        zoneId: null,
        isDeleted: { $ne: true },
    });
    if (!doc) throw new NotFoundError('Pricing not found for vehicle');
    return deletePricing(String(doc._id), reqUser);
}
