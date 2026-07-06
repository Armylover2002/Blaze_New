import axios from 'axios';
import mongoose from 'mongoose';
import { ValidationError, NotFoundError } from '../../../core/auth/errors.js';
import { PorterPricing } from '../models/porterPricing.model.js';
import { PorterVehicle } from '../models/porterVehicle.model.js';

const MAPS_TIMEOUT_MS = 8000;
const baseFilter = { isDeleted: { $ne: true } };

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
    const key = getMapsKey();
    const origin = `${pickup.lat},${pickup.lng}`;
    const destination = `${delivery.lat},${delivery.lng}`;
    const data = await googleGet(
        `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&mode=driving&key=${key}`,
    );

    if (data.status !== 'OK' || !data.routes?.length) {
        throw new ValidationError(data.error_message || `Directions failed: ${data.status}`);
    }

    const route = data.routes[0];
    const leg = route.legs?.[0];
    if (!leg) throw new ValidationError('No route leg returned');

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
}

function calculateFareFromPricing(pricing, distanceKm) {
    if (!pricing) return null;

    const basePrice = Number(pricing.basePrice || 0);
    const baseDistance = Number(pricing.baseDistance || 0);
    const distancePrice = Number(pricing.distancePrice || 0);
    const serviceTaxPct = Number(pricing.serviceTax || 0);

    let fare = basePrice;
    if (pricing.enableDistanceCharges !== false) {
        const extraKm = Math.max(0, distanceKm - baseDistance);
        fare += extraKm * distancePrice;
    }

    const tax = (fare * serviceTaxPct) / 100;
    const total = Math.round(fare + tax);

    return {
        baseFare: Math.round(fare),
        serviceTax: Math.round(tax),
        total,
    };
}

async function resolveVehiclePricing(vehicleId) {
    if (!vehicleId) return { vehicle: null, pricing: null };

    const vehicle = await PorterVehicle.findOne({
        _id: vehicleId,
        ...baseFilter,
        status: 'active',
    }).select({ name: 1, vehicleCode: 1 }).lean();

    if (!vehicle) throw new NotFoundError('Vehicle not found');

    const pricing = await PorterPricing.findOne({
        vehicleId: new mongoose.Types.ObjectId(vehicleId),
        ...baseFilter,
        status: 'active',
    }).lean();

    return { vehicle, pricing };
}

export async function getQuotePreview({ pickup, delivery, vehicleId }) {
    const route = await getRoutePreview({ pickup, delivery });
    const { vehicle, pricing } = await resolveVehiclePricing(vehicleId);
    const fare = calculateFareFromPricing(pricing, route.distanceKm);

    return {
        route,
        vehicle: vehicle ? { id: String(vehicle._id), name: vehicle.name, vehicleCode: vehicle.vehicleCode } : null,
        fare,
    };
}
