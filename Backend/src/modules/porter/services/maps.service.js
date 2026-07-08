import axios from 'axios';
import mongoose from 'mongoose';
import { ValidationError, NotFoundError } from '../../../core/auth/errors.js';
import { PorterPricing } from '../models/porterPricing.model.js';
import { PorterVehicle } from '../models/porterVehicle.model.js';
import { calculateFareFromPricing } from '../utils/porter-pricing-calculator.util.js';
import { buildParcelVehicleQuotes } from './porter-parcel-vehicle.service.js';
import { assertPorterLocationsServiceable, findZoneForPoint } from '../orders/services/porter-zone-lookup.service.js';
import { logger } from '../../../utils/logger.js';

const MAPS_TIMEOUT_MS = 8000;
const baseFilter = { isDeleted: { $ne: true } };

// Straight-line → approximate on-road distance multiplier for urban routing.
const ROAD_DISTANCE_FACTOR = 1.3;
// Rough average urban driving speed (km/h) used only for fallback ETA.
const FALLBACK_AVG_SPEED_KMPH = 22;
const EARTH_RADIUS_KM = 6371;

function haversineKm(a, b) {
    const toRad = (deg) => (deg * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const h = Math.sin(dLat / 2) ** 2
        + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

// Deterministic offline estimate so pricing/coupon/quote flows keep working
// when Google Maps is unreachable (DNS/network) or the API key is missing.
function buildFallbackRoute(pickup, delivery) {
    const straightKm = haversineKm(pickup, delivery);
    const distanceKm = Math.round(straightKm * ROAD_DISTANCE_FACTOR * 100) / 100;
    const distanceMeters = Math.round(distanceKm * 1000);
    const durationMin = Math.max(1, Math.round((distanceKm / FALLBACK_AVG_SPEED_KMPH) * 60));
    return {
        distanceMeters,
        distanceKm,
        durationSeconds: durationMin * 60,
        durationMin,
        distanceText: `${distanceKm} km`,
        durationText: `${durationMin} mins`,
        polyline: '',
        bounds: null,
        estimated: true,
    };
}

const getMapsKey = () => {
    const key = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAP_API_KEY;
    if (!key) throw new ValidationError('Google Maps API key not configured on server');
    return key;
};

const mapAddressComponents = (components = []) => {
    const get = (type) => {
        const c = components.find((x) => x.types?.includes(type));
        return c ? c.long_name : '';
    };
    return {
        city: get('locality') || get('administrative_area_level_2') || get('sublocality'),
        area: get('sublocality') || get('neighborhood') || '',
        state: get('administrative_area_level_1'),
        pincode: get('postal_code'),
        country: get('country'),
    };
};

async function googleGet(url) {
    const { data } = await axios.get(url, { timeout: MAPS_TIMEOUT_MS });
    return data;
}

const PREFERRED_RESULT_TYPES = [
    'street_address',
    'premise',
    'subpremise',
    'route',
    'establishment',
    'point_of_interest',
    'neighborhood',
    'sublocality',
];

const pickBestGeocodeResult = (results = []) => {
    if (!results.length) return null;

    const rooftop = results.find((r) => r.geometry?.location_type === 'ROOFTOP');
    if (rooftop) return rooftop;

    for (const type of PREFERRED_RESULT_TYPES) {
        const match = results.find((r) => r.types?.includes(type));
        if (match) return match;
    }

    return results[0];
};

export async function reverseGeocode(lat, lng) {
    const key = getMapsKey();
    const data = await googleGet(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${key}`,
    );

    if (data.status === 'ZERO_RESULTS') throw new NotFoundError('Address not found for coordinates');
    if (data.status !== 'OK') {
        throw new ValidationError(`Maps reverse geocode failed: ${data.status}`);
    }

    const first = pickBestGeocodeResult(data.results);
    if (!first) throw new NotFoundError('Address not found for coordinates');

    const components = mapAddressComponents(first.address_components || []);
    const title = components.area || components.city || 'Current Location';

    return {
        title,
        address: first.formatted_address,
        lat: Number(lat),
        lng: Number(lng),
        placeId: first.place_id,
        ...components,
    };
}

export async function getPlaceDetails(placeId) {
    const key = getMapsKey();
    const data = await googleGet(
        `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=geometry,formatted_address,name,place_id&key=${key}`,
    );

    if (data.status !== 'OK' || !data.result) {
        throw new NotFoundError('Place not found');
    }

    const { result } = data;
    const lat = result.geometry?.location?.lat;
    const lng = result.geometry?.location?.lng;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        throw new ValidationError('Place has no coordinates');
    }

    return {
        title: result.name || 'Selected Location',
        address: result.formatted_address || result.name,
        lat,
        lng,
        placeId: result.place_id,
    };
}

export async function getRoutePreview({ pickup, delivery }) {
    await assertPorterLocationsServiceable(pickup, delivery);
    if (!pickup || !delivery
        || !Number.isFinite(Number(pickup.lat)) || !Number.isFinite(Number(pickup.lng))
        || !Number.isFinite(Number(delivery.lat)) || !Number.isFinite(Number(delivery.lng))) {
        throw new ValidationError('Pickup and delivery coordinates are required');
    }

    let key;
    try {
        key = getMapsKey();
    } catch (err) {
        // No API key configured — degrade to a straight-line estimate.
        logger.warn(`[Porter] Maps key unavailable, using fallback route estimate: ${err?.message || err}`);
        return buildFallbackRoute(pickup, delivery);
    }

    const origin = `${pickup.lat},${pickup.lng}`;
    const destination = `${delivery.lat},${delivery.lng}`;

    try {
        const data = await googleGet(
            `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&mode=driving&key=${key}`,
        );

        const leg = data.status === 'OK' ? data.routes?.[0]?.legs?.[0] : null;
        if (!leg) {
            // Maps responded but with no usable route — fall back gracefully.
            logger.warn(`[Porter] Directions returned no route (${data.status}); using fallback estimate`);
            return buildFallbackRoute(pickup, delivery);
        }

        const route = data.routes[0];
        const distanceMeters = leg.distance?.value || 0;
        const durationSeconds = leg.duration?.value || 0;
        const distanceKm = Math.round((distanceMeters / 1000) * 100) / 100;
        const durationMin = Math.max(1, Math.round(durationSeconds / 60));

        return {
            distanceMeters,
            distanceKm,
            durationSeconds,
            durationMin,
            distanceText: leg.distance?.text || `${distanceKm} km`,
            durationText: leg.duration?.text || `${durationMin} mins`,
            polyline: route.overview_polyline?.points || '',
            bounds: route.bounds || null,
        };
    } catch (err) {
        // Network/DNS/timeout (e.g. ENOTFOUND maps.googleapis.com) — never let a
        // Maps outage block booking/pricing/coupon flows; use offline estimate.
        logger.warn(`[Porter] Directions request failed (${err?.code || err?.message}); using fallback route estimate`);
        return buildFallbackRoute(pickup, delivery);
    }
}

async function resolveVehiclePricing(vehicleId) {
    if (!vehicleId) return { vehicle: null, pricing: null };

    const vehicle = await PorterVehicle.findOne({
        _id: vehicleId,
        ...baseFilter,
        status: 'active',
        supportedServices: { $in: ['parcel'] },
    }).select({ name: 1, vehicleCode: 1 }).lean();

    if (!vehicle) throw new NotFoundError('Vehicle not found');

    const pricing = await PorterPricing.findOne({
        vehicleId: new mongoose.Types.ObjectId(vehicleId),
        ...baseFilter,
        status: 'active',
    }).lean();

    return { vehicle, pricing };
}

export async function getQuotePreview({ pickup, delivery, vehicleId, parcelWeight }) {
    const route = await getRoutePreview({ pickup, delivery });
    // Zones already enforced in getRoutePreview; resolve names for UI metadata only.
    const [pickupZone, dropZone] = await Promise.all([
        findZoneForPoint(Number(pickup.lat), Number(pickup.lng)),
        findZoneForPoint(Number(delivery.lat), Number(delivery.lng)),
    ]);
    const weight = parcelWeight != null && Number(parcelWeight) > 0 ? Number(parcelWeight) : null;

    let eligibleVehicles = [];
    let ineligibleVehicles = [];
    let recommendedVehicleId = null;
    let noVehiclesAvailable = false;
    let message = null;

    const quotes = await buildParcelVehicleQuotes({ parcelWeight: weight || 0, route });
    eligibleVehicles = quotes.eligible;
    ineligibleVehicles = quotes.ineligible;
    recommendedVehicleId = quotes.recommendedVehicleId;
    noVehiclesAvailable = quotes.noVehiclesAvailable;
    message = quotes.message;

    let vehicle = null;
    let fare = null;
    let pricing = null;

    if (vehicleId) {
        const resolved = await resolveVehiclePricing(vehicleId);
        if (resolved.vehicle) {
            vehicle = {
                id: String(resolved.vehicle._id),
                name: resolved.vehicle.name,
                vehicleCode: resolved.vehicle.vehicleCode,
            };
            pricing = calculateFareFromPricing(resolved.pricing, route.distanceKm);
            fare = pricing
                ? {
                    baseFare: pricing.baseFare,
                    serviceTax: pricing.serviceTax,
                    total: pricing.total,
                }
                : null;
        }
    } else if (recommendedVehicleId && eligibleVehicles.length) {
        const recommended = eligibleVehicles.find((item) => item.id === recommendedVehicleId) || eligibleVehicles[0];
        vehicle = {
            id: recommended.id,
            name: recommended.name,
            vehicleCode: recommended.vehicleCode,
        };
        pricing = recommended.pricing || null;
        fare = pricing
            ? {
                baseFare: pricing.baseFare,
                serviceTax: pricing.serviceTax,
                total: pricing.total,
            }
            : null;
    }

    return {
        route,
        parcelWeight: weight,
        eligibleVehicles,
        ineligibleVehicles,
        recommendedVehicleId,
        noVehiclesAvailable,
        message,
        vehicle,
        fare,
        pricing,
        serviceability: {
            status: 'IN_SERVICE',
            zoneId: pickupZone?._id ? String(pickupZone._id) : null,
            pickupZone: pickupZone
                ? { id: String(pickupZone._id), name: pickupZone.name }
                : null,
            dropZone: dropZone
                ? { id: String(dropZone._id), name: dropZone.name }
                : null,
            sameZone: Boolean(pickupZone && dropZone && String(pickupZone._id) === String(dropZone._id)),
        },
    };
}
