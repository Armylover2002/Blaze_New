import mongoose from 'mongoose';
import { PorterVehicle } from '../models/porterVehicle.model.js';
import { PorterPricing } from '../models/porterPricing.model.js';
import { ValidationError } from '../../../core/auth/errors.js';
import { calculateFareFromPricing } from '../utils/porter-pricing-calculator.util.js';

const baseFilter = { isDeleted: { $ne: true } };
const PARCEL_SERVICE = 'parcel';

const vehicleListProjection = {
    name: 1,
    vehicleCode: 1,
    iconUrl: 1,
    description: 1,
    minWeight: 1,
    maxWeight: 1,
    supportedServices: 1,
    status: 1,
    displayOrder: 1,
};

export function computeParcelWeight(parcel = {}) {
    const weightKg = Number(parcel?.weightKg || 0);
    const quantity = Math.max(1, Number(parcel?.quantity || 1));
    if (weightKg <= 0) return 0;
    return Math.round(weightKg * quantity * 100) / 100;
}

/**
 * Booking eligibility — weight is NEVER a hard block.
 * Only active parcel vehicles with pricing can be quoted.
 */
export function isParcelVehicleEligible(vehicle, _parcelWeight, pricing) {
    if (!vehicle || vehicle.status !== 'active') {
        return { eligible: false, reason: 'Vehicle is not available.' };
    }
    if (!Array.isArray(vehicle.supportedServices) || !vehicle.supportedServices.includes(PARCEL_SERVICE)) {
        return { eligible: false, reason: 'Vehicle does not support parcel delivery.' };
    }
    if (!pricing) {
        return { eligible: false, reason: 'Pricing not configured for this vehicle.' };
    }
    return { eligible: true, reason: null };
}

/** Advisory badges only — never used to block selection. */
export function getParcelVehicleWeightAdvice(vehicle, parcelWeight) {
    const weight = Number(parcelWeight || 0);
    const maxW = Number(vehicle?.maxWeight || 0);
    const minW = Number(vehicle?.minWeight || 0);

    if (weight <= 0) {
        return maxW > 0 ? { badge: null, label: `Supports up to ${maxW}kg` } : { badge: null, label: null };
    }
    if (maxW > 0 && weight > maxW) {
        return { badge: 'Heavy parcel', label: `Rated up to ${maxW}kg` };
    }
    if (minW > 0 && weight < minW) {
        return { badge: null, label: `Typically from ${minW}kg` };
    }
    if (maxW > 0) {
        return { badge: null, label: `Supports up to ${maxW}kg` };
    }
    return { badge: null, label: null };
}

export async function loadActiveParcelVehiclesWithPricing() {
    const vehicles = await PorterVehicle.find({
        ...baseFilter,
        status: 'active',
        supportedServices: { $in: [PARCEL_SERVICE] },
    })
        .select(vehicleListProjection)
        .sort({ displayOrder: 1, name: 1 })
        .lean();

    if (!vehicles.length) {
        return { vehicles: [], pricingMap: new Map() };
    }

    const vehicleIds = vehicles.map((vehicle) => vehicle._id);
    const pricingDocs = await PorterPricing.find({
        vehicleId: { $in: vehicleIds },
        ...baseFilter,
        status: 'active',
    }).lean();

    const pricingMap = new Map(pricingDocs.map((pricing) => [String(pricing.vehicleId), pricing]));
    return { vehicles, pricingMap };
}

function mapEligibleVehicleQuote(vehicle, pricing, route, parcelWeight) {
    const pricingBreakdown = calculateFareFromPricing(pricing, route.distanceKm);
    const advice = getParcelVehicleWeightAdvice(vehicle, parcelWeight);
    return {
        id: String(vehicle._id),
        name: vehicle.name || '',
        vehicleCode: vehicle.vehicleCode || '',
        iconUrl: vehicle.iconUrl || '',
        description: vehicle.description || '',
        maxWeight: Number(vehicle.maxWeight || 0),
        minWeight: Number(vehicle.minWeight || 0),
        estimatedFare: pricingBreakdown?.total ?? null,
        estimatedTime: route.durationMin,
        pricing: pricingBreakdown,
        eligible: true,
        weightAdvice: advice.label,
        advisoryBadge: advice.badge,
    };
}

function sortEligibleVehicles(eligible, parcelWeight) {
    const weight = Number(parcelWeight || 0);
    return [...eligible].sort((a, b) => {
        // Prefer vehicles whose weight band covers the parcel (advisory ranking only).
        if (weight > 0) {
            const aFits = (a.minWeight || 0) <= weight && (a.maxWeight <= 0 || weight <= a.maxWeight);
            const bFits = (b.minWeight || 0) <= weight && (b.maxWeight <= 0 || weight <= b.maxWeight);
            if (aFits !== bFits) return aFits ? -1 : 1;
        }
        const fareDiff = Number(a.estimatedFare || 0) - Number(b.estimatedFare || 0);
        if (fareDiff !== 0) return fareDiff;
        return Number(a.maxWeight || 0) - Number(b.maxWeight || 0);
    });
}

/**
 * Quote ALL active parcel vehicles with pricing.
 * Weight never empties the list — users can always pick any vehicle.
 * `ineligible` kept for backward compatibility (no pricing / inactive only).
 */
export async function buildParcelVehicleQuotes({ parcelWeight, route }) {
    const weight = Number(parcelWeight || 0);
    const { vehicles, pricingMap } = await loadActiveParcelVehiclesWithPricing();
    const eligible = [];
    const ineligible = [];

    for (const vehicle of vehicles) {
        const pricing = pricingMap.get(String(vehicle._id)) || null;
        const { eligible: isEligible, reason } = isParcelVehicleEligible(vehicle, weight, pricing);
        if (isEligible) {
            eligible.push(mapEligibleVehicleQuote(vehicle, pricing, route, weight));
        } else {
            // Unbookable config issue only — surface as advisory disabled in older clients.
            ineligible.push({
                id: String(vehicle._id),
                name: vehicle.name || '',
                iconUrl: vehicle.iconUrl || '',
                maxWeight: Number(vehicle.maxWeight || 0),
                minWeight: Number(vehicle.minWeight || 0),
                reason: reason || 'Vehicle unavailable',
                eligible: false,
            });
        }
    }

    const sortedEligible = sortEligibleVehicles(eligible, weight);
    const noVehiclesAvailable = sortedEligible.length === 0;
    return {
        eligible: sortedEligible,
        // Weight-based ineligible list is intentionally empty for booking UX.
        // Keep only true config failures for older clients that still read this field.
        ineligible,
        recommendedVehicleId: sortedEligible[0]?.id || null,
        noVehiclesAvailable,
        message: noVehiclesAvailable
            ? 'No delivery vehicles are currently available.'
            : null,
    };
}

/**
 * Ensures vehicle exists, is parcel-capable, and has pricing.
 * Does NOT reject based on parcel weight.
 */
export async function assertVehicleEligibleForParcelWeight(vehicleId, parcelWeight) {
    const weight = Number(parcelWeight || 0);
    const oid = new mongoose.Types.ObjectId(vehicleId);
    const [vehicle, pricing] = await Promise.all([
        PorterVehicle.findOne({
            _id: oid,
            ...baseFilter,
            status: 'active',
            supportedServices: { $in: [PARCEL_SERVICE] },
        }).select(vehicleListProjection).lean(),
        PorterPricing.findOne({
            vehicleId: oid,
            ...baseFilter,
            status: 'active',
        }).lean(),
    ]);

    if (!vehicle) {
        throw new ValidationError('Vehicle not found or not available for parcel');
    }

    const { eligible, reason } = isParcelVehicleEligible(vehicle, weight, pricing);
    if (!eligible) {
        throw new ValidationError(reason || 'Vehicle is not available for booking');
    }
}
