import mongoose from 'mongoose';
import crypto from 'crypto';
import { PorterVehicle } from '../../models/porterVehicle.model.js';
import { hydrateDriverVehiclesFromCatalog } from './porter-order-dispatch.service.js';

const DISPATCH_ELIGIBLE_STATUSES = new Set(['active', 'approved']);

export function isDriverVehicleDispatchEligible(vehicle) {
    if (!vehicle) return false;
    const status = String(vehicle.status || '').toLowerCase();
    return DISPATCH_ELIGIBLE_STATUSES.has(status);
}

export function mapVehicleStatusLabel(status) {
    const s = String(status || '').toLowerCase();
    if (s === 'active' || s === 'approved') return 'Approved';
    if (s === 'pending' || s === 'draft') return 'Pending Verification';
    if (s === 'rejected') return 'Rejected';
    if (s === 'inactive') return 'Inactive';
    return 'Unknown';
}

export function mapDriverVehicleForClient(vehicle, catalog = null) {
    if (!vehicle) return null;
    const cat = catalog || {};
    const status = String(vehicle.status || 'pending').toLowerCase();
    const supportedServices = Array.isArray(vehicle.supportedServices) && vehicle.supportedServices.length
        ? vehicle.supportedServices
        : (cat.supportedServices || []);
    const displayName =
        vehicle.vehicleName ||
        cat.category ||
        cat.name ||
        vehicle.category ||
        vehicle.vehicleCode ||
        'Vehicle';
    // Prefer admin catalog icon (type icon). Do not use uploaded vehiclePhoto docs as the card icon.
    const iconUrl =
        cat.iconUrl ||
        cat.icon ||
        vehicle.iconUrl ||
        null;

    return {
        id: String(vehicle.id || vehicle._id || ''),
        vehicleId: String(vehicle.id || vehicle._id || ''),
        porterVehicleId: vehicle.porterVehicleId ? String(vehicle.porterVehicleId) : null,
        vehicleName: displayName,
        vehicleCode: vehicle.vehicleCode || vehicle.vehicleType || cat.vehicleCode || '',
        vehicleNumber: vehicle.vehicleNumber || '',
        registrationNumber: vehicle.vehicleNumber || vehicle.registrationNumber || '',
        model: vehicle.model || '',
        supportedServices,
        status,
        verificationStatus: mapVehicleStatusLabel(status),
        isDefault: Boolean(vehicle.isDefault),
        isDispatchEligible: isDriverVehicleDispatchEligible({ ...vehicle, status }),
        iconUrl,
        master: {
            name: displayName,
            category: cat.category || vehicle.category || '',
            image: iconUrl,
            iconUrl,
            supportedServices,
            vehicleCode: vehicle.vehicleCode || cat.vehicleCode || '',
        },
    };
}

export async function mapDriverVehiclesForClient(partner) {
    const hydrated = await hydrateDriverVehiclesFromCatalog(partner);
    return hydrated.map((v) => mapDriverVehicleForClient(v));
}

export function getApprovedDriverVehicles(vehicles = []) {
    return (Array.isArray(vehicles) ? vehicles : []).filter((v) => isDriverVehicleDispatchEligible(v));
}

export async function getDeliveryPartnerVehiclePayload(partner) {
    const vehicles = await mapDriverVehiclesForClient(partner);
    const activeVehicleId = resolveActiveVehicleId(partner, vehicles);
    return { vehicles, driverVehicles: vehicles, activeVehicleId };
}

export function normalizeDriverVehiclesInput(rawVehicles = []) {
    if (!Array.isArray(rawVehicles)) return [];

    return rawVehicles.map((v, idx) => {
        const porterVehicleId = v.porterVehicleId || v.vehicleId || v.id;
        const id = v.id || v._id || `dv-${crypto.randomBytes(4).toString('hex')}-${idx}`;
        let supportedServices = Array.isArray(v.supportedServices) ? [...v.supportedServices] : [];

        if (!supportedServices.length && v.service) {
            supportedServices = [v.service];
        }

        let status = v.status ? String(v.status).toLowerCase() : 'pending';
        if (status === 'draft') status = 'pending';

        return {
            id: String(id),
            porterVehicleId: porterVehicleId && mongoose.Types.ObjectId.isValid(String(porterVehicleId))
                ? new mongoose.Types.ObjectId(porterVehicleId)
                : null,
            vehicleName: v.vehicleName || v.name || '',
            vehicleNumber: v.vehicleNumber || v.registrationNumber || v.number || '',
            vehicleCode: v.vehicleCode || v.vehicleType || v.type || '',
            model: v.model || '',
            supportedServices,
            status,
            isDefault: Boolean(v.isDefault) || idx === 0,
        };
    });
}

export async function enrichDriverVehiclesFromSignupPayload(payload) {
    let raw = payload?.vehicles || payload?.driverVehicles;
    if (typeof raw === 'string') {
        try { raw = JSON.parse(raw); } catch { raw = []; }
    }
    if (!Array.isArray(raw) || !raw.length) return [];

    const normalized = normalizeDriverVehiclesInput(raw);
    const catalogIds = normalized
        .map((v) => v.porterVehicleId)
        .filter(Boolean);

    const catalog = catalogIds.length
        ? await PorterVehicle.find({ _id: { $in: catalogIds }, isDeleted: { $ne: true } })
            .select({ category: 1, vehicleCode: 1, supportedServices: 1, iconUrl: 1, icon: 1 })
            .lean()
        : [];

    const catalogMap = new Map(catalog.map((c) => [String(c._id), c]));

    return normalized.map((v) => {
        const cat = v.porterVehicleId ? catalogMap.get(String(v.porterVehicleId)) : null;
        return {
            ...v,
            vehicleName: v.vehicleName || cat?.category || cat?.name || v.vehicleName,
            vehicleCode: v.vehicleCode || cat?.vehicleCode || v.vehicleCode,
            supportedServices: v.supportedServices?.length
                ? v.supportedServices
                : (cat?.supportedServices || []),
        };
    });
}

export async function getDriverVehiclesForPartner(partner) {
    if (!partner) return [];
    const payload = await getDeliveryPartnerVehiclePayload(partner);
    return payload.vehicles;
}

export function resolveActiveVehicleId(partner, vehicles = []) {
    if (!vehicles.length) return null;
    const activeId = partner?.activeVehicleId ? String(partner.activeVehicleId) : null;
    if (activeId && vehicles.some((v) => v.id === activeId || v.vehicleId === activeId)) {
        return activeId;
    }
    const defaultVeh = vehicles.find((v) => v.isDefault) || vehicles[0];
    return defaultVeh?.id || defaultVeh?.vehicleId || null;
}

export async function activateDriverVehiclesOnPartnerApproval(partner) {
    if (!partner?.driverVehicles?.length) return partner;
    let changed = false;
    partner.driverVehicles.forEach((v) => {
        const status = String(v.status || '').toLowerCase();
        if (status !== 'rejected' && status !== 'inactive' && status !== 'active') {
            v.status = 'active';
            changed = true;
        }
    });
    if (changed) await partner.save();
    return partner;
}
