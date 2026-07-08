import { PorterZone } from '../../models/porterZone.model.js';
import { ValidationError } from '../../../../core/auth/errors.js';

const baseFilter = { isDeleted: { $ne: true }, status: 'active' };

const MSG = Object.freeze({
    PICKUP: 'Pickup location is outside our service area.',
    DROP: 'Delivery location is outside our service area.',
    BOTH: 'Selected locations are outside our service area.',
});

export async function findZoneForPoint(lat, lng) {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    const point = {
        type: 'Point',
        coordinates: [lng, lat],
    };

    const zone = await PorterZone.findOne({
        ...baseFilter,
        geometry: {
            $geoIntersects: {
                $geometry: point,
            },
        },
    })
        .select({ _id: 1, name: 1, zoneCode: 1 })
        .sort({ displayOrder: 1 })
        .lean();

    return zone;
}

/**
 * Detect whether a single lat/lng is inside an active Porter zone.
 * Used by customer address selection (Food-style public detect).
 */
export async function detectPorterZoneForPoint(lat, lng) {
    const zone = await findZoneForPoint(Number(lat), Number(lng));
    if (!zone) {
        return { status: 'OUT_OF_SERVICE', zoneId: null, zone: null };
    }
    return {
        status: 'IN_SERVICE',
        zoneId: String(zone._id),
        zone: { id: String(zone._id), name: zone.name, zoneCode: zone.zoneCode },
    };
}

/**
 * Hard serviceability gate for Porter booking.
 *
 * Rules:
 * - Pickup MUST be inside an ACTIVE porter zone
 * - Drop MUST be inside an ACTIVE porter zone
 * - Inter-zone (different active zones) is ALLOWED
 * - Soft/optional zoneId is no longer accepted for order/quote pricing
 */
export async function assertPorterLocationsServiceable(pickup, delivery) {
    const pLat = Number(pickup?.lat);
    const pLng = Number(pickup?.lng);
    const dLat = Number(delivery?.lat);
    const dLng = Number(delivery?.lng);

    if (!Number.isFinite(pLat) || !Number.isFinite(pLng)) {
        throw new ValidationError(MSG.PICKUP);
    }
    if (!Number.isFinite(dLat) || !Number.isFinite(dLng)) {
        throw new ValidationError(MSG.DROP);
    }

    const [pickupZone, dropZone] = await Promise.all([
        findZoneForPoint(pLat, pLng),
        findZoneForPoint(dLat, dLng),
    ]);

    if (!pickupZone && !dropZone) {
        throw new ValidationError(MSG.BOTH);
    }
    if (!pickupZone) {
        throw new ValidationError(MSG.PICKUP);
    }
    if (!dropZone) {
        throw new ValidationError(MSG.DROP);
    }

    return {
        pickupZone,
        dropZone,
        zoneId: pickupZone._id,
        sameZone: String(pickupZone._id) === String(dropZone._id),
    };
}

export { MSG as PORTER_ZONE_SERVICEABILITY_MESSAGES };
