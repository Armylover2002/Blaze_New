import { useState, useEffect, useCallback, useRef } from 'react';
import porterUserApi from '../services/userApi';

const CACHE_TTL_MS = 30 * 1000;

let homeCache = {
  vehicles: [],
  banners: [],
  coupons: [],
  lastFetched: 0,
};

const hasFreshCache = () => (
  homeCache.lastFetched > 0 && Date.now() - homeCache.lastFetched < CACHE_TTL_MS
);

export function usePorterHomeData() {
  const [vehicles, setVehicles] = useState(() => (hasFreshCache() ? homeCache.vehicles : []));
  const [banners, setBanners] = useState(() => (hasFreshCache() ? homeCache.banners : []));
  const [coupons, setCoupons] = useState(() => (hasFreshCache() ? homeCache.coupons : []));
  const [isLoading, setIsLoading] = useState(() => !hasFreshCache());
  const fetchSeqRef = useRef(0);

  const load = useCallback(async (forceRefresh = false) => {
    const seq = ++fetchSeqRef.current;

    if (!forceRefresh && hasFreshCache()) {
      setVehicles(homeCache.vehicles);
      setBanners(homeCache.banners);
      setCoupons(homeCache.coupons);
      setIsLoading(false);
      return;
    }

    if (!hasFreshCache()) setIsLoading(true);

    try {
      const data = await porterUserApi.getHomeData(
        forceRefresh ? { forceRefresh: true } : {},
      );
      if (seq !== fetchSeqRef.current) return;

      const nextVehicles = Array.isArray(data?.vehicles) ? data.vehicles : [];
      const nextBanners = Array.isArray(data?.banners) ? data.banners : [];
      const nextCoupons = Array.isArray(data?.coupons) ? data.coupons : [];

      homeCache = {
        vehicles: nextVehicles,
        banners: nextBanners,
        coupons: nextCoupons,
        lastFetched: Date.now(),
      };

      setVehicles(nextVehicles);
      setBanners(nextBanners);
      setCoupons(nextCoupons);
    } catch (err) {
      if (seq !== fetchSeqRef.current) return;
      console.error('[Porter Home] Failed to load home data', err);
      setVehicles([]);
      setBanners([]);
      setCoupons([]);
    } finally {
      if (seq === fetchSeqRef.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return {
    vehicles,
    banners,
    coupons,
    isLoading,
    refresh: () => load(true),
  };
}
