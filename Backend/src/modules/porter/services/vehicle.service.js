import { PorterVehicle } from '../models/porterVehicle.model.js';
import { PorterPricing } from '../models/porterPricing.model.js';
import { NotFoundError, ValidationError } from '../../../core/auth/errors.js';
import { resolveActionPerformerSnapshot } from '../../../core/utils/performer.js';
import { uploadBufferDetailed } from '../../../services/cloudinary.service.js';
import { v2 as cloudinary } from 'cloudinary';
import { parseListQuery, buildDateRangeFilter, toPorterPagination, escapeRegex } from '../utils/pagination.util.js';
import { mapVehicle } from '../utils/mappers.util.js';
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
    const allowed = ['name', 'category', 'status', 'displayOrder', 'vehicleCode', 'minWeight', 'maxWeight', 'createdAt'];
    const key = allowed.includes(sortBy) ? sortBy : 'displayOrder';
    return { [key]: sortOrder };
};

async function attachPricingMap(vehicleDocs = []) {
    const ids = vehicleDocs.map((v) => v._id);
    if (!ids.length) return new Map();

    const pricingDocs = await PorterPricing.find({
        vehicleId: { $in: ids },
        isDeleted: { $ne: true },
        zoneId: null,
    }).lean();

    return new Map(pricingDocs.map((p) => [String(p.vehicleId), p]));
}

export async function listVehicles(query = {}) {
    validateListQuery(query);
    const parsed = parseListQuery(query);
    const filter = { ...baseFilter };

    if (parsed.status) filter.status = parsed.status;
    if (parsed.category) filter.category = parsed.category;

    if (parsed.search) {
        const term = escapeRegex(parsed.search);
        filter.$or = [
            { name: { $regex: term, $options: 'i' } },
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

    const pricing = await attachPricingMap(docs);
    const records = docs.map((doc) => mapVehicle(doc, pricing.get(String(doc._id)) || null));

    return toPorterPagination({ docs: records, total, page: parsed.page, limit: parsed.limit });
}

export async function getVehicleById(id) {
    const vehicleId = validateVehicleId(id);
    const doc = await PorterVehicle.findOne({ _id: vehicleId, ...baseFilter }).lean();
    if (!doc) throw new NotFoundError('Vehicle not found');

    const pricing = await PorterPricing.findOne({
        vehicleId: doc._id,
        zoneId: null,
        isDeleted: { $ne: true },
    }).lean();

    return mapVehicle(doc, pricing);
}

export async function createVehicle(body, reqUser, file = null) {
    const payload = validateCreateVehicleDto(body);
    const performer = await resolveActionPerformerSnapshot(reqUser);

    if (file?.buffer) {
        const uploaded = await uploadBufferDetailed(file.buffer, {
            folder: 'porter/vehicles',
            resourceType: file.mimetype?.includes('svg') ? 'image' : 'image',
        });
        payload.iconUrl = uploaded.secure_url;
        payload.iconPublicId = uploaded.public_id;
    } else if (payload.iconUrl?.startsWith('data:')) {
        // keep data URL in icon field for lucide-less custom svg
        payload.icon = payload.iconUrl;
        payload.iconUrl = '';
    }

    const doc = await PorterVehicle.create({
        ...payload,
        vehicleCode: await generateVehicleCode(),
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

    const performer = await resolveActionPerformerSnapshot(reqUser);

    if (file?.buffer) {
        if (doc.iconPublicId) {
            try { await cloudinary.uploader.destroy(doc.iconPublicId); } catch { /* ignore */ }
        }
        const uploaded = await uploadBufferDetailed(file.buffer, { folder: 'porter/vehicles', resourceType: 'image' });
        payload.iconUrl = uploaded.secure_url;
        payload.iconPublicId = uploaded.public_id;
    } else if (payload.iconUrl?.startsWith('data:')) {
        payload.icon = payload.iconUrl;
        payload.iconUrl = '';
    }

    Object.assign(doc, payload);
    doc.updatedBy = performer;
    await doc.save();

    const pricing = await PorterPricing.findOne({
        vehicleId: doc._id,
        zoneId: null,
        isDeleted: { $ne: true },
    }).lean();

    return mapVehicle(doc.toObject(), pricing);
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

    const pricing = await PorterPricing.findOne({
        vehicleId: doc._id,
        zoneId: null,
        isDeleted: { $ne: true },
    }).lean();

    return mapVehicle(doc.toObject(), pricing);
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
        .sort({ displayOrder: 1, name: 1 })
        .select('name category status icon iconUrl')
        .lean();

    const pricingMap = await attachPricingMap(docs);
    return docs.map((doc) => mapVehicle(doc, pricingMap.get(String(doc._id)) || null));
}

export async function uploadVehicleIcon(id, file, reqUser) {
    if (!file?.buffer) throw new ValidationError('Icon file is required');
    return updateVehicle(id, {}, reqUser, file);
}
