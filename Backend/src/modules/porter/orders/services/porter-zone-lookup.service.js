import { PorterZone } from '../../models/porterZone.model.js';

const baseFilter = { isDeleted: { $ne: true }, status: 'active' };

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
    }).select({ _id: 1, name: 1, zoneCode: 1 }).lean();

    return zone;
}
