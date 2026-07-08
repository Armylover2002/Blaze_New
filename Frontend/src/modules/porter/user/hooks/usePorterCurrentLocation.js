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

function getAccuratePosition() {
  if (!navigator.geolocation) {
    return Promise.reject(new Error('Geolocation is not supported on this device.'));
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 10000, // Allow recently cached position for speed
    });
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
