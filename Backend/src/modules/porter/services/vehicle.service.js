import { PorterVehicle } from '../models/porterVehicle.model.js';
import { PorterPricing } from '../models/porterPricing.model.js';
import { NotFoundError, ValidationError, ConflictError } from '../../../core/auth/errors.js';
import { resolveActionPerformerSnapshot } from '../../../core/utils/performer.js';
import { uploadBufferDetailed } from '../../../services/cloudinary.service.js';
import { v2 as cloudinary } from 'cloudinary';
import { parseListQuery, buildDateRangeFilter, toPorterPagination, escapeRegex } from '../utils/pagination.util.js';
import { mapVehicle, mapPublicVehicle } from '../utils/mappers.util.js';
import {
    validateCreateVehicleDto,
    validateUpdateVehicleDto,
    validateVehicleId,
    validateVehicleStatusDto,
} from '../validators/vehicle.validator.js';
import { validateListQuery } from '../validators/listQuery.validator.js';
import { applySoftDelete } from '../utils/softDelete.util.js';
import { generateVehicleCode } from '../utils/vehicleCode.util.js';

const baseFilter = { isDeleted: { $ne: true } };

const buildSort = (sortBy, sortOrder) => {
    const allowed = ['category', 'status', 'displayOrder', 'vehicleCode', 'minWeight', 'maxWeight', 'createdAt', 'updatedAt'];
    const key = allowed.includes(sortBy) ? sortBy : 'displayOrder';
    return { [key]: sortOrder };
};



export async function listVehicles(query = {}) {
    validateListQuery(query);
    const parsed = parseListQuery(query);
    const filter = { ...baseFilter };

    if (parsed.status) filter.status = parsed.status;
    if (parsed.category) filter.category = parsed.category;

    if (query.supportedServices) {
        const svcs = typeof query.supportedServices === 'string' ? query.supportedServices.split(',') : query.supportedServices;
        if (Array.isArray(svcs) && svcs.length > 0) {
            filter.supportedServices = { $in: svcs };
        }
    }

    if (parsed.search) {
        const term = escapeRegex(parsed.search);
        filter.$or = [
            { category: { $regex: term, $options: 'i' } },
            { vehicleCode: { $regex: term, $options: 'i' } },
            { description: { $regex: term, $options: 'i' } },
        ];
    }

    const dateRange = buildDateRangeFilter(parsed.createdFrom, parsed.createdTo);
    if (dateRange) filter.createdAt = dateRange;

    const sort = buildSort(parsed.sortBy, parsed.sortOrder);

    const [docs, total] = await Promise.all([
        PorterVehicle.find(filter)
            .sort(sort)
            .skip(parsed.skip)
            .limit(parsed.limit)
            .lean(),
        PorterVehicle.countDocuments(filter),
    ]);

    const records = docs.map((doc) => mapVehicle(doc));

    return toPorterPagination({ docs: records, total, page: parsed.page, limit: parsed.limit });
}

export async function getVehicleById(id) {
    const vehicleId = validateVehicleId(id);
    const doc = await PorterVehicle.findOne({ _id: vehicleId, ...baseFilter }).lean();
    if (!doc) throw new NotFoundError('Vehicle not found');

    return mapVehicle(doc);
}

export async function createVehicle(body, reqUser, file = null) {
    const payload = validateCreateVehicleDto(body);
    const performer = await resolveActionPerformerSnapshot(reqUser);

    const duplicate = await PorterVehicle.findOne({ 
        category: payload.category,
        isDeleted: { $ne: true }
    }).lean();
    if (duplicate) {
        throw new ConflictError(`Vehicle category already exists.`);
    }

    if (file?.buffer) {
        const uploaded = await uploadBufferDetailed(file.buffer, {
            folder: 'porter/vehicles',
            resourceType: file.mimetype?.includes('svg') ? 'image' : 'image',
        });
        payload.iconUrl = uploaded.secure_url;
        payload.iconPublicId = uploaded.public_id;
    }

    const maxOrderVehicle = await PorterVehicle.findOne({}, 'displayOrder').sort({ displayOrder: -1 }).lean();
    const displayOrder = (maxOrderVehicle?.displayOrder || 0) + 1;

    const doc = await PorterVehicle.create({
        ...payload,
        vehicleCode: await generateVehicleCode(),
        displayOrder,
        createdBy: performer,
        updatedBy: performer,
        statusHistory: [{ status: payload.status, changedBy: performer }],
    });

    return mapVehicle(doc.toObject());
}

export async function updateVehicle(id, body, reqUser, file = null) {
    const vehicleId = validateVehicleId(id);
    const payload = validateUpdateVehicleDto(body);
    const doc = await PorterVehicle.findOne({ _id: vehicleId, ...baseFilter });
    if (!doc) throw new NotFoundError('Vehicle not found');

    if (payload.category !== undefined) {
        const checkCategory = payload.category;
        const duplicate = await PorterVehicle.findOne({ 
            category: checkCategory,
            isDeleted: { $ne: true },
            _id: { $ne: vehicleId }
        }).lean();
        if (duplicate) {
            throw new ConflictError(`Vehicle category already exists.`);
        }
    }

    const performer = await resolveActionPerformerSnapshot(reqUser);

    if (file?.buffer) {
        if (doc.iconPublicId) {
            try { await cloudinary.uploader.destroy(doc.iconPublicId); } catch { /* ignore */ }
        }
        const uploaded = await uploadBufferDetailed(file.buffer, { folder: 'porter/vehicles', resourceType: 'image' });
        payload.iconUrl = uploaded.secure_url;
        payload.iconPublicId = uploaded.public_id;
    }

    Object.assign(doc, payload);
    doc.updatedBy = performer;
    await doc.save();

    return mapVehicle(doc.toObject());
}

export async function updateVehicleStatus(id, body, reqUser) {
    const vehicleId = validateVehicleId(id);
    const { status } = validateVehicleStatusDto(body);
    const doc = await PorterVehicle.findOne({ _id: vehicleId, ...baseFilter });
    if (!doc) throw new NotFoundError('Vehicle not found');

    const performer = await resolveActionPerformerSnapshot(reqUser);
    doc.status = status;
    doc.updatedBy = performer;
    doc.statusHistory.push({ status, changedBy: performer });
    await doc.save();

    return mapVehicle(doc.toObject());
}

export async function deleteVehicle(id, reqUser) {
    const vehicleId = validateVehicleId(id);
    const doc = await PorterVehicle.findOne({ _id: vehicleId, ...baseFilter });
    if (!doc) throw new NotFoundError('Vehicle not found');

    const performer = await resolveActionPerformerSnapshot(reqUser);

    if (doc.iconPublicId) {
        try { await cloudinary.uploader.destroy(doc.iconPublicId); } catch { /* ignore */ }
    }

    applySoftDelete(doc, performer);
    await doc.save();

    const deletedAt = new Date();
    await PorterPricing.updateMany(
        { vehicleId: doc._id, isDeleted: { $ne: true } },
        { $set: { isDeleted: true, deletedAt, deletedBy: performer, updatedBy: performer } },
    );

    return { id: vehicleId };
}

export async function listVehicleDropdown() {
    const docs = await PorterVehicle.find({ ...baseFilter, status: 'active' })
        .sort({ displayOrder: 1, category: 1 })
        .lean();

    return docs.map((doc) => mapVehicle(doc));
}

const PUBLIC_VEHICLE_PROJECTION = {
    category: 1,
    iconUrl: 1,
    maxWeight: 1,
    description: 1,
    displayOrder: 1,
    supportedServices: 1,
};

async function listPublicVehiclesByService(service) {
    const docs = await PorterVehicle.find({
        ...baseFilter,
        status: 'active',
        supportedServices: { $in: [service] },
    })
        .select(PUBLIC_VEHICLE_PROJECTION)
        .sort({ displayOrder: 1, category: 1 })
        .lean();

    return docs.map((doc) => mapPublicVehicle(doc));
}

export async function listPublicParcelVehicles() {
    return listPublicVehiclesByService('parcel');
}

/**
 * Delivery partner signup catalog.
 * Returns all active admin-managed vehicles so newly added vehicles appear immediately.
 * (Admin controls availability via Active/Inactive; no service-type filter here.)
 */
export async function listPublicFoodVehicles() {
    const docs = await PorterVehicle.find({
        ...baseFilter,
        status: 'active',
    })
        .select(PUBLIC_VEHICLE_PROJECTION)
        .sort({ displayOrder: 1, category: 1 })
        .lean();

    return docs.map((doc) => mapPublicVehicle(doc));
}

export async function uploadVehicleIcon(id, file, reqUser) {
    if (!file?.buffer) throw new ValidationError('Icon file is required');
    return updateVehicle(id, {}, reqUser, file);
}
