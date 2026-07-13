import { getRoadDistanceKm, getRoadDistancesFromOrigin } from '../../../services/roadDistance.service.js';

const toFinite = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

export const getDistance = async (req, res) => {
  try {
    const originLat = toFinite(req.query.originLat ?? req.query.lat1);
    const originLng = toFinite(req.query.originLng ?? req.query.lng1);
    const destLat = toFinite(req.query.destLat ?? req.query.lat2);
    const destLng = toFinite(req.query.destLng ?? req.query.lng2);

    if ([originLat, originLng, destLat, destLng].some((v) => v === null)) {
      return res.status(400).json({
        success: false,
        message: 'originLat, originLng, destLat, and destLng are required',
      });
    }

    const result = await getRoadDistanceKm(
      { lat: originLat, lng: originLng },
      { lat: destLat, lng: destLng },
    );

    return res.json({
      success: true,
      data: {
        distanceKm: result.distanceKm,
        distanceMeters: result.distanceMeters,
        durationMin: result.durationMin,
        estimated: Boolean(result.estimated),
      },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err?.message || 'Failed to calculate distance',
    });
  }
};

export const getDistancesBatch = async (req, res) => {
  try {
    const originLat = toFinite(req.body?.originLat ?? req.body?.origin?.lat);
    const originLng = toFinite(req.body?.originLng ?? req.body?.origin?.lng);
    const destinations = Array.isArray(req.body?.destinations) ? req.body.destinations : [];

    if (originLat === null || originLng === null) {
      return res.status(400).json({
        success: false,
        message: 'originLat and originLng are required',
      });
    }

    if (!destinations.length) {
      return res.json({ success: true, data: { distances: [] } });
    }

    const normalized = destinations.slice(0, 25).map((dest) => ({
      lat: toFinite(dest?.lat),
      lng: toFinite(dest?.lng),
    }));

    if (normalized.some((dest) => dest.lat === null || dest.lng === null)) {
      return res.status(400).json({
        success: false,
        message: 'Each destination must include valid lat and lng',
      });
    }

    const results = await getRoadDistancesFromOrigin(
      { lat: originLat, lng: originLng },
      normalized,
    );

    return res.json({
      success: true,
      data: {
        distances: results.map((item) => ({
          distanceKm: item.distanceKm,
          distanceMeters: item.distanceMeters,
          durationMin: item.durationMin,
          estimated: Boolean(item.estimated),
        })),
      },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err?.message || 'Failed to calculate distances',
    });
  }
};
