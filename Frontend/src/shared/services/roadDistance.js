import apiClient from '@/services/api/axios.js';
import { calculateDistance as haversineFallbackKm } from '@/modules/Food/utils/common.js';

const CACHE_TTL_MS = 30 * 60 * 1000;
const CACHE_MAX_SIZE = 500;

/** @type {Map<string, { value: number, expiresAt: number }>} */
const cache = new Map();

const roundCoord = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return 'x';
  return n.toFixed(4);
};

const cacheKey = (lat1, lng1, lat2, lng2) =>
  `${roundCoord(lat1)}_${roundCoord(lng1)}_${roundCoord(lat2)}_${roundCoord(lng2)}`;

const readCache = (key) => {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.value;
};

const writeCache = (key, value) => {
  if (cache.size >= CACHE_MAX_SIZE) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
};

const fallbackDistanceKm = (lat1, lng1, lat2, lng2) => {
  const straight = haversineFallbackKm(lat1, lng1, lat2, lng2);
  if (!Number.isFinite(straight)) return null;
  return Math.round(straight * 1.3 * 100) / 100;
};

/**
 * Road/travel distance in km via backend Google Distance Matrix proxy.
 */
export async function getRoadDistanceKm(lat1, lng1, lat2, lng2) {
  const aLat = Number(lat1);
  const aLng = Number(lng1);
  const bLat = Number(lat2);
  const bLng = Number(lng2);

  if (![aLat, aLng, bLat, bLng].every(Number.isFinite)) return null;

  const key = cacheKey(aLat, aLng, bLat, bLng);
  const cached = readCache(key);
  if (cached != null) return cached;

  try {
    const response = await apiClient.get('/common/maps/distance', {
      params: {
        originLat: aLat,
        originLng: aLng,
        destLat: bLat,
        destLng: bLng,
      },
    });
    const distanceKm = Number(response?.data?.data?.distanceKm);
    if (Number.isFinite(distanceKm)) {
      writeCache(key, distanceKm);
      return distanceKm;
    }
  } catch {
    // Fall through to local estimate when routing service is unavailable.
  }

  const fallback = fallbackDistanceKm(aLat, aLng, bLat, bLng);
  if (fallback != null) writeCache(key, fallback);
  return fallback;
}

/**
 * Batch road distances from one origin to many destinations (max 25).
 */
export async function getRoadDistancesFromOrigin(originLat, originLng, destinations = []) {
  const lat = Number(originLat);
  const lng = Number(originLng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !destinations.length) {
    return destinations.map(() => null);
  }

  const normalized = destinations.map((dest) => ({
    lat: Number(dest?.lat),
    lng: Number(dest?.lng),
  }));

  const results = normalized.map((dest, index) => {
    if (!Number.isFinite(dest.lat) || !Number.isFinite(dest.lng)) return null;
    const key = cacheKey(lat, lng, dest.lat, dest.lng);
    const cached = readCache(key);
    if (cached != null) return cached;

    const uncachedIndex = normalized
      .slice(0, index)
      .filter((item, i) => {
        if (!Number.isFinite(item.lat) || !Number.isFinite(item.lng)) return false;
        return readCache(cacheKey(lat, lng, item.lat, item.lng)) == null;
      }).length;

    return { dest, uncachedIndex, key, pending: true };
  });

  const uncached = results
    .map((item, index) => (item?.pending ? { index, ...item } : null))
    .filter(Boolean);

  if (uncached.length) {
    try {
      const response = await apiClient.post('/common/maps/distance/batch', {
        originLat: lat,
        originLng: lng,
        destinations: uncached.map((item) => ({ lat: item.dest.lat, lng: item.dest.lng })),
      });
      const distances = response?.data?.data?.distances || [];
      uncached.forEach((item, i) => {
        const distanceKm = Number(distances[i]?.distanceKm);
        const value = Number.isFinite(distanceKm)
          ? distanceKm
          : fallbackDistanceKm(lat, lng, item.dest.lat, item.dest.lng);
        if (value != null) {
          writeCache(item.key, value);
          results[item.index] = value;
        }
      });
    } catch {
      uncached.forEach((item) => {
        const fallback = fallbackDistanceKm(lat, lng, item.dest.lat, item.dest.lng);
        if (fallback != null) {
          writeCache(item.key, fallback);
          results[item.index] = fallback;
        }
      });
    }
  }

  return results.map((item, index) => {
    if (typeof item === 'number') return item;
    const dest = normalized[index];
    if (!Number.isFinite(dest.lat) || !Number.isFinite(dest.lng)) return null;
    return fallbackDistanceKm(lat, lng, dest.lat, dest.lng);
  });
}
