import { useCallback, useEffect, useRef, useState } from 'react';
import porterUserApi from '../services/userApi';
import { hasCoordinates, normalizeLocation } from '../utils/location';

const GEO_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 15000,
  maximumAge: 0,
};

const ACCURACY_WATCH_MS = 8000;
const GOOD_ACCURACY_M = 80;

/** Prefer a fresh, accurate GPS fix; fall back to a single getCurrentPosition. */
function getAccuratePosition() {
  if (!navigator.geolocation) {
    return Promise.reject(new Error('Geolocation is not supported on this device.'));
  }

  return new Promise((resolve, reject) => {
    let best = null;
    let settled = false;

    const finish = (position) => {
      if (settled) return;
      settled = true;
      if (watchId != null) navigator.geolocation.clearWatch(watchId);
      clearTimeout(timer);
      resolve(position);
    };

    const fail = (error) => {
      if (settled) return;
      settled = true;
      if (watchId != null) navigator.geolocation.clearWatch(watchId);
      clearTimeout(timer);
      if (best) resolve(best);
      else reject(error);
    };

    let watchId = null;

    watchId = navigator.geolocation.watchPosition(
      (position) => {
        if (!best || position.coords.accuracy < best.coords.accuracy) {
          best = position;
        }
        if (position.coords.accuracy <= GOOD_ACCURACY_M) {
          finish(position);
        }
      },
      () => {
        // watch errors are non-fatal; try getCurrentPosition below
      },
      GEO_OPTIONS,
    );

    const timer = setTimeout(() => {
      if (best) {
        finish(best);
        return;
      }

      navigator.geolocation.getCurrentPosition(finish, fail, GEO_OPTIONS);
    }, ACCURACY_WATCH_MS);
  });
}

export function usePorterCurrentLocation({ enabled = false, initialLocation = null, onResolved } = {}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const resolvedRef = useRef(false);
  const onResolvedRef = useRef(onResolved);
  const initialLocationRef = useRef(initialLocation);

  onResolvedRef.current = onResolved;
  initialLocationRef.current = initialLocation;

  const resolveCurrentLocation = useCallback(async (options = {}) => {
    const force = options?.force === true;

    if (force) {
      resolvedRef.current = false;
    } else if (resolvedRef.current || hasCoordinates(initialLocationRef.current)) {
      return initialLocationRef.current;
    }

    if (!navigator.geolocation) {
      const message = 'Geolocation is not supported on this device.';
      setError(message);
      throw new Error(message);
    }

    setLoading(true);
    setError('');

    try {
      const position = await getAccuratePosition();
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;

      const optimistic = normalizeLocation({
        title: "Current Location",
        address: "Finding address…",
        lat,
        lng,
      });
      onResolvedRef.current?.(optimistic);

      const data = await porterUserApi.reverseGeocode(lat, lng);
      const location = normalizeLocation({
        ...data,
        title: 'Current Location',
        lat: data?.lat ?? lat,
        lng: data?.lng ?? lng,
      });

      resolvedRef.current = true;
      onResolvedRef.current?.(location);
      return location;
    } catch (err) {
      const message = err?.message?.includes('denied')
        ? 'Location permission denied.'
        : 'Unable to access current location.';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled || resolvedRef.current || hasCoordinates(initialLocationRef.current)) return undefined;
    resolveCurrentLocation().catch(() => {});
    return undefined;
  }, [enabled, resolveCurrentLocation]);

  return { loading, error, resolveCurrentLocation };
}
