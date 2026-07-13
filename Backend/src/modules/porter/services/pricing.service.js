import mongoose from 'mongoose';
import { PorterPricing } from '../models/porterPricing.model.js';
import { PorterVehicle } from '../models/porterVehicle.model.js';
import { NotFoundError, ValidationError } from '../../../core/auth/errors.js';
import { resolveActionPerformerSnapshot } from '../../../core/utils/performer.js';
import { parseListQuery, buildDateRangeFilter, toPorterPagination, escapeRegex } from '../utils/pagination.util.js';
import { mapPricing, mapVehiclePricingRow } from '../utils/mappers.util.js';
import {
    validateCreatePricingDto,
    validateUpdatePricingDto,
    validatePricingId,
    validatePricingStatusDto,
    validateCommissionRules,
} from '../validators/pricing.validator.js';
import { validateListQuery } from '../validators/listQuery.validator.js';
import { validateVehicleId } from '../validators/vehicle.validator.js';
import { applySoftDelete } from '../utils/softDelete.util.js';

const baseFilter = { isDeleted: { $ne: true } };
const globalPricingFilter = { ...baseFilter };

const VEHICLE_PROJECTION = {
    category: 1,
    iconUrl: 1,
    status: 1,
    displayOrder: 1,
    vehicleCode: 1,
};

const PRICING_PROJECTION = {
    vehicleId: 1,
    zoneId: 1,
    enableDistanceCharges: 1,
    basePrice: 1,
    baseDistance: 1,
    distancePrice: 1,
    serviceTax: 1,
    commissionType: 1,
    commissionValue: 1,
    status: 1,
    description: 1,
    createdAt: 1,
    updatedAt: 1,
};

// A vehicle has a single active pricing config. If legacy data ever produced more
// than one document, prefer the zone-agnostic one, then the most recently updated.
const pickVehiclePricing = (docs = []) => {
    if (!docs.length) return null;
    const nullZone = docs.find((d) => d.zoneId === null || d.zoneId === undefined);
    if (nullZone) return nullZone;
    return [...docs].sort(
        (a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0),
    )[0];
};

const buildVehicleSort = (sortBy, sortOrder) => {
    const allowed = ['category', 'status', 'displayOrder', 'createdAt'];
    const key = allowed.includes(sortBy) ? sortBy : 'displayOrder';
    return { [key]: sortOrder };
};

async function getVehicleOrThrow(vehicleId) {
    const doc = await PorterVehicle.findOne({ _id: vehicleId, ...baseFilter })
        .select(VEHICLE_PROJECTION)
        .lean();
    if (!doc) throw new NotFoundError('Vehicle not found');
    return doc;
}

async function getPricingMapForVehicles(vehicleIds = []) {
    if (!vehicleIds.length) return new Map();

    // Match both ObjectId-typed and (legacy) string-typed vehicleId values.
    // We query the native collection so Mongoose does not cast/strip the string ids.
    const idVariants = [];
    vehicleIds.forEach((id) => {
        const str = String(id);
        idVariants.push(str);
        if (mongoose.Types.ObjectId.isValid(str)) {
            idVariants.push(new mongoose.Types.ObjectId(str));
        }
    });

    const pricingDocs = await PorterPricing.collection
        .find(
            {
                vehicleId: { $in: idVariants },
                isDeleted: { $ne: true },
            },
            { projection: PRICING_PROJECTION },
        )
        .toArray();

    const grouped = new Map();
    pricingDocs.forEach((doc) => {
        const key = String(doc.vehicleId);
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key).push(doc);
    });

    const result = new Map();
    grouped.forEach((docs, key) => {
        result.set(key, pickVehiclePricing(docs));
    });
    return result;
}

export async function listPricing(query = {}) {
    validateListQuery(query);
    const parsed = parseListQuery(query);

    const vehicleFilter = { ...baseFilter };
    if (parsed.category) vehicleFilter.category = parsed.category;

    if (parsed.search) {
        const term = escapeRegex(parsed.search);
        vehicleFilter.$or = [
            { category: { $regex: term, $options: 'i' } },
            { vehicleCode: { $regex: term, $options: 'i' } },
        ];
    }

    const dateRange = buildDateRangeFilter(parsed.createdFrom, parsed.createdTo);
    if (dateRange) vehicleFilter.createdAt = dateRange;

    const sort = buildVehicleSort(parsed.sortBy, parsed.sortOrder);

    const [vehicles, total] = await Promise.all([
        PorterVehicle.find(vehicleFilter)
            .select(VEHICLE_PROJECTION)
            .sort(sort)
            .skip(parsed.skip)
            .limit(parsed.limit)
            .lean(),
        PorterVehicle.countDocuments(vehicleFilter),
    ]);

    const pricingMap = await getPricingMapForVehicles(vehicles.map((v) => v._id));

    let records = vehicles.map((vehicle) => {
        const pricing = pricingMap.get(String(vehicle._id)) || null;
        return mapVehiclePricingRow(vehicle, pricing);
    });

    if (parsed.status) {
        records = records.filter((row) => (
            row.pricingConfigured ? row.status === parsed.status : parsed.status === 'inactive'
        ));
    }

    if (query.configured === 'true') {
        records = records.filter((row) => row.pricingConfigured);
    } else if (query.configured === 'false') {
        records = records.filter((row) => !row.pricingConfigured);
    }

    return toPorterPagination({ docs: records, total, page: parsed.page, limit: parsed.limit });
}

export async function getPricingById(id) {
    const pricingId = validatePricingId(id);
    const doc = await PorterPricing.findOne({ _id: pricingId, ...baseFilter })
        .select(PRICING_PROJECTION)
        .lean();
    if (!doc) throw new NotFoundError('Pricing not found');

    const vehicle = await getVehicleOrThrow(doc.vehicleId);
    return mapPricing(doc, vehicle);
}

export async function getPricingByVehicleId(vehicleIdRaw) {
    const vehicleId = validateVehicleId(vehicleIdRaw);
    const doc = await PorterPricing.findOne({
        vehicleId,
        ...globalPricingFilter,
    })
        .select(PRICING_PROJECTION)
        .lean();

    if (!doc) throw new NotFoundError('Pricing not found for vehicle');
    const vehicle = await getVehicleOrThrow(vehicleId);
    return mapPricing(doc, vehicle);
}

export async function createPricing(body, reqUser) {
    const payload = validateCreatePricingDto(body);
    const performer = await resolveActionPerformerSnapshot(reqUser);
    const vehicle = await getVehicleOrThrow(payload.vehicleId);

    const existing = await PorterPricing.findOne({
        vehicleId: payload.vehicleId,
        isDeleted: { $ne: true },
    }).select('_id').lean();

    if (existing) {
        throw new ValidationError('Pricing already exists for this vehicle');
    }

    const doc = await PorterPricing.create({
        vehicleId: payload.vehicleId,

        enableDistanceCharges: payload.enableDistanceCharges,
        basePrice: payload.basePrice,
        baseDistance: payload.baseDistance,
        distancePrice: payload.distancePrice,
        serviceTax: payload.serviceTax,
        commissionType: payload.commissionType,
        commissionValue: payload.commissionValue,
        status: payload.status,
        description: payload.description,
        createdBy: performer,
        updatedBy: performer,
        statusHistory: [{ status: payload.status, changedBy: performer }],
    });

    return mapPricing(doc.toObject(), vehicle);
}

export async function updatePricing(id, body, reqUser) {
    const pricingId = validatePricingId(id);
    const payload = validateUpdatePricingDto(body);
    const doc = await PorterPricing.findOne({ _id: pricingId, ...baseFilter });
    if (!doc) throw new NotFoundError('Pricing not found');

    const performer = await resolveActionPerformerSnapshot(reqUser);
    const previousStatus = doc.status;

    const editableFields = [
        'enableDistanceCharges', 'basePrice', 'baseDistance', 'distancePrice',
        'serviceTax', 'commissionType', 'commissionValue', 'status', 'description',
    ];

    editableFields.forEach((field) => {
        if (payload[field] !== undefined) {
            doc[field] = payload[field];
        }
    });

    validateCommissionRules({
        commissionType: doc.commissionType,
        commissionValue: doc.commissionValue,
    });

    doc.updatedBy = performer;

    if (payload.status && payload.status !== previousStatus) {
        doc.statusHistory.push({ status: payload.status, changedBy: performer });
    }

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

    await PorterPricing.findByIdAndDelete(pricingId);

    return { id: pricingId };
}

export async function upsertVehiclePricing(vehicleIdRaw, body, reqUser) {
    const vehicleId = validateVehicleId(vehicleIdRaw);
    await getVehicleOrThrow(vehicleId);

    const existing = await PorterPricing.findOne({
        vehicleId,
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
        isDeleted: { $ne: true },
    });
    if (!doc) throw new NotFoundError('Pricing not found for vehicle');
    return deletePricing(String(doc._id), reqUser);
}

export async function getPricingStats() {
    const [totalVehicles, configured] = await Promise.all([
        PorterVehicle.countDocuments(baseFilter),
        PorterPricing.countDocuments(globalPricingFilter),
    ]);

    const [active, inactive] = await Promise.all([
        PorterPricing.countDocuments({ ...globalPricingFilter, status: 'active' }),
        PorterPricing.countDocuments({ ...globalPricingFilter, status: 'inactive' }),
    ]);

    return {
        total: totalVehicles,
        configured,
        pending: Math.max(0, totalVehicles - configured),
        active,
        inactive,
    };
}
