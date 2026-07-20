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

export {
  distanceMeters,
  hasMovedSignificantly,
} from '@core/utils/mapGeocode';

export const MIN_GEOCODE_DISTANCE_M = 20;
export const REVERSE_GEOCODE_DEBOUNCE_MS = 650;
