import { useMemo } from 'react';
import { useDeliveryStore } from '@/modules/DeliveryV2/store/useDeliveryStore';
import { calculateDistance } from '@/modules/DeliveryV2/hooks/proximity.utils';
import {
  normalizeLocationPoint,
  getPrimaryPickupLocation,
  getReturnDropLocation,
  isReturnPickupTrip,
} from '@/modules/DeliveryV2/utils/orderRouting';

/**
 * useProximityCheck - Professional hook for dynamic range monitoring.
 * Ensures rider can only advance based on Admin-defined ranges.
 *
 * @returns {Object} { distanceToTarget, isWithinRange, actionLimit }
 */
export const useProximityCheck = () => {
  const riderLocation = useDeliveryStore((state) => state.riderLocation);
  const activeOrder = useDeliveryStore((state) => state.activeOrder);
  const tripStatus = useDeliveryStore((state) => state.tripStatus);
  const settings = useDeliveryStore((state) => state.settings);

  // Determine current target based on trip state
  const targetLocation = useMemo(() => {
    if (!activeOrder) return null;

    if (['PICKING_UP', 'REACHED_PICKUP'].includes(tripStatus)) {
      return (
        normalizeLocationPoint(activeOrder.restaurantLocation) ||
        normalizeLocationPoint(activeOrder.pickupLocation) ||
        normalizeLocationPoint(activeOrder.pickup) ||
        getPrimaryPickupLocation(activeOrder) ||
        normalizeLocationPoint(activeOrder.restaurant_location)
      );
    }

    if (['PICKED_UP', 'REACHED_DROP'].includes(tripStatus)) {
      if (isReturnPickupTrip(activeOrder)) {
        return getReturnDropLocation(activeOrder) || normalizeLocationPoint(activeOrder.dropPoint);
      }
      return (
        normalizeLocationPoint(activeOrder.customerLocation) ||
        normalizeLocationPoint(activeOrder.dropLocation) ||
        normalizeLocationPoint(activeOrder.delivery) ||
        normalizeLocationPoint(activeOrder.customer_location)
      );
    }

    return null;
  }, [activeOrder, tripStatus]);

  // Determine current range limit from admin settings
  const actionLimit = useMemo(() => {
    if (tripStatus === 'PICKING_UP') return settings.pickupRangeLimit || 500;
    if (tripStatus === 'PICKED_UP') return settings.deliveryRangeLimit || 500;
    return 500;
  }, [tripStatus, settings]);

  // Calculate real-time distance
  const distanceToTarget = useMemo(() => {
    const rider = normalizeLocationPoint(riderLocation);
    if (!rider || !targetLocation) return Infinity;

    return calculateDistance(
      rider.lat,
      rider.lng,
      targetLocation.lat,
      targetLocation.lng,
    );
  }, [riderLocation, targetLocation]);

  // Dev mode bypass
  const isDevMode = import.meta.env.VITE_APP_MODE === 'developer' ||
                    import.meta.env.VITE_ENABLE_RANGE_BYPASS === 'true' ||
                    import.meta.env.DEV;

  const isWithinRange = isDevMode ? true : (distanceToTarget <= actionLimit);

  return {
    distanceToTarget,
    isWithinRange,
    actionLimit,
  };
};
