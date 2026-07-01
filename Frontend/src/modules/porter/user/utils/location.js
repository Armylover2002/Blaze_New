export const hasCoordinates = (location) => (
  Number.isFinite(Number(location?.lat)) && Number.isFinite(Number(location?.lng))
);

export const normalizeLocation = (data = {}) => ({
  title: data.title || data.name || 'Selected Location',
  address: data.address || data.formattedAddress || '',
  lat: Number(data.lat ?? data.latitude),
  lng: Number(data.lng ?? data.longitude),
  placeId: data.placeId || data.place_id || undefined,
});

export const isLocationComplete = (location) => (
  Boolean(location?.address) && hasCoordinates(location)
);

export const toCoordinatePayload = (location) => ({
  lat: Number(location.lat),
  lng: Number(location.lng),
});

/** Haversine distance in meters between two lat/lng points. */
export const distanceMeters = (a, b) => {
  const lat1 = Number(a?.lat);
  const lng1 = Number(a?.lng);
  const lat2 = Number(b?.lat);
  const lng2 = Number(b?.lng);
  if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) return Infinity;

  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * sinLng * sinLng;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
};

export const MIN_GEOCODE_DISTANCE_M = 20;
export const REVERSE_GEOCODE_DEBOUNCE_MS = 650;

export const hasMovedSignificantly = (prev, next, thresholdM = MIN_GEOCODE_DISTANCE_M) => (
  distanceMeters(prev, next) >= thresholdM
);
