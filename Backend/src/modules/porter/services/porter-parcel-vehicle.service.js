import mongoose from 'mongoose';
import { PorterVehicle } from '../models/porterVehicle.model.js';
import { PorterPricing } from '../models/porterPricing.model.js';
import { ValidationError } from '../../../core/auth/errors.js';
import { calculateFareFromPricing } from '../utils/porter-pricing-calculator.util.js';

const baseFilter = { isDeleted: { $ne: true } };
const PARCEL_SERVICE = 'parcel';
const WEIGHT_INELIGIBLE_REASON = 'Not suitable for this parcel weight.';

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

export function isParcelVehicleEligible(vehicle, parcelWeight, pricing) {
    if (!vehicle || vehicle.status !== 'active') {
        return { eligible: false, reason: WEIGHT_INELIGIBLE_REASON };
    }
    if (!Array.isArray(vehicle.supportedServices) || !vehicle.supportedServices.includes(PARCEL_SERVICE)) {
        return { eligible: false, reason: WEIGHT_INELIGIBLE_REASON };
    }
    if (!pricing) {
        return { eligible: false, reason: 'Pricing not configured for this vehicle.' };
    }

    // Weight limits removed as per user request: user can select any vehicle regardless of weight.
    return { eligible: true, reason: null };
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

function mapEligibleVehicleQuote(vehicle, pricing, route) {
    const pricingBreakdown = calculateFareFromPricing(pricing, route.distanceKm);
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
    };
}

function mapIneligibleVehicle(vehicle, reason) {
    return {
        id: String(vehicle._id),
        name: vehicle.name || '',
        iconUrl: vehicle.iconUrl || '',
        maxWeight: Number(vehicle.maxWeight || 0),
        minWeight: Number(vehicle.minWeight || 0),
        reason: reason || WEIGHT_INELIGIBLE_REASON,
        eligible: false,
    };
}

function sortEligibleVehicles(eligible) {
    return [...eligible].sort((a, b) => {
        const fareDiff = Number(a.estimatedFare || 0) - Number(b.estimatedFare || 0);
        if (fareDiff !== 0) return fareDiff;
        return Number(a.maxWeight || 0) - Number(b.maxWeight || 0);
    });
}

export async function buildParcelVehicleQuotes({ parcelWeight, route }) {
    const weight = Number(parcelWeight || 0);
    if (weight <= 0) {
        return {
            eligible: [],
            ineligible: [],
            recommendedVehicleId: null,
            noVehiclesAvailable: false,
            message: null,
        };
    }

    const { vehicles, pricingMap } = await loadActiveParcelVehiclesWithPricing();
    const eligible = [];
    const ineligible = [];

    for (const vehicle of vehicles) {
        const pricing = pricingMap.get(String(vehicle._id)) || null;
        const { eligible: isEligible, reason } = isParcelVehicleEligible(vehicle, weight, pricing);
        if (isEligible) {
            eligible.push(mapEligibleVehicleQuote(vehicle, pricing, route));
        } else {
            ineligible.push(mapIneligibleVehicle(vehicle, reason));
        }
    }

    const sortedEligible = sortEligibleVehicles(eligible);
    const noVehiclesAvailable = sortedEligible.length === 0;
    return {
        eligible: sortedEligible,
        ineligible,
        recommendedVehicleId: sortedEligible[0]?.id || null,
        noVehiclesAvailable,
        message: noVehiclesAvailable
            ? 'No delivery vehicle is available for this parcel weight.'
            : null,
    };
}

export async function assertVehicleEligibleForParcelWeight(vehicleId, parcelWeight) {
    const weight = Number(parcelWeight || 0);
    if (weight <= 0) return;

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
        throw new ValidationError(reason || WEIGHT_INELIGIBLE_REASON);
    }
}
