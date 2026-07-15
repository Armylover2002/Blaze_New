import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { ActionSlider } from '@/modules/DeliveryV2/components/ui/ActionSlider';
import { useDeliveryStore } from '@/modules/DeliveryV2/store/useDeliveryStore';
import { getHaversineDistance } from '@/modules/DeliveryV2/utils/geo';
import { normalizePickupPoints, isMixedOrder, isReturnPickupTrip, getReturnPickupStopLabels, formatDeliveryAddressText } from '@/modules/DeliveryV2/utils/orderRouting';
import { RenderNewOrder } from './renderers/NewOrderRenderers';

/**
 * NewOrderModal - Ported to Original 1:1 Theme with Slider Accept.
 * Matches the Zomato/Swiggy style Green Header + White Card.
 */
export const NewOrderModal = ({ order, onAccept, onReject, onMinimize }) => {
  const { riderLocation } = useDeliveryStore();
  const isFoodQuick =
    order?.isFoodQuickDelivery === true ||
    String(order?.deliveryMode || '').toLowerCase() === 'quick';
  const offerWindowSec = Math.max(
    15,
    Number(order?.offerTimeoutSec || (isFoodQuick ? 45 : 30)) || (isFoodQuick ? 45 : 30),
  );
  const [timeLeft, setTimeLeft] = useState(offerWindowSec);
  const pickupPoints = normalizePickupPoints(order);
  const primaryPickup = pickupPoints[0] || null;
  const mixedOrder = isMixedOrder(order);

  useEffect(() => {
    setTimeLeft(offerWindowSec);
  }, [order?.orderMongoId, order?.orderId, offerWindowSec]);

  useEffect(() => {
    const timer = setInterval(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearInterval(timer);
  }, [order?.orderMongoId, order?.orderId]);

  useEffect(() => {
    if (timeLeft <= 0) {
      onReject();
    }
  }, [timeLeft, onReject]);

  const { distanceKm, etaMins } = useMemo(() => {
    if (!order) return { distanceKm: null, etaMins: null };

    const rawEta = order.estimatedTime || order.duration || order.eta || order.route?.durationMin;

    // Prefer rider→pickup distance. Never treat trip route length as the offer "KM"
    // (Porter persists route.distanceKm for pricing; it can be 0 / unrelated to the rider).
    const pickupCandidates = [
      order.pickupDistanceKm,
      // Only treat top-level distanceKm as pickup when it is not clearly the route total.
      order.distanceKm,
    ];
    let resolvedKm = null;
    for (const candidate of pickupCandidates) {
      const n = Number(candidate);
      if (Number.isFinite(n) && n > 0) {
        resolvedKm = n;
        break;
      }
    }

    // Local haversine: rider → parcel pickup (or restaurant)
    const rest = primaryPickup?.location || order.restaurantLocation || order.pickupLocation || order.pickup || order.restaurantId?.location || {};
    const resLat = parseFloat(
      order.restaurant_lat ?? order.restaurantLat ?? rest.latitude ?? rest.lat,
    );
    const resLng = parseFloat(
      order.restaurant_lng ?? order.restaurantLng ?? rest.longitude ?? rest.lng,
    );

    if (riderLocation && Number.isFinite(resLat) && Number.isFinite(resLng)) {
      const distM = getHaversineDistance(
        Number(riderLocation.lat),
        Number(riderLocation.lng),
        resLat,
        resLng,
      );
      if (Number.isFinite(distM) && distM >= 0) {
        const km = distM / 1000;
        // Prefer live GPS when server distance is missing / zero.
        if (resolvedKm == null || resolvedKm <= 0 || Math.abs(km - resolvedKm) > 0.01) {
          resolvedKm = km;
        }
        const mins = Math.ceil(distM / 416) + (order.prepTime || 5);
        return {
          distanceKm: Number(resolvedKm).toFixed(1),
          etaMins: rawEta && Number(rawEta) > 0 ? Math.ceil(Number(rawEta)) : mins,
        };
      }
    }

    if (resolvedKm != null && resolvedKm > 0) {
      return {
        distanceKm: Number(resolvedKm).toFixed(1),
        etaMins: rawEta && Number(rawEta) > 0
          ? Math.ceil(Number(rawEta))
          : Math.ceil((resolvedKm * 1000) / 416) + 5,
      };
    }

    return { distanceKm: '??', etaMins: order.prepTime || 15 };
  }, [order, primaryPickup, riderLocation]);

  if (!order) return null;

  const isReturnPickup = isReturnPickupTrip(order);
  const returnLabels = getReturnPickupStopLabels();
  const dropPoint = order?.dropPoint || null;
  const earnings = order.earnings || order.riderEarning || order.tripEarning || order.walletEarning || 0;
  const isQuickOrder = String(order?.orderType || order?.serviceType || order?.type || '').trim().toLowerCase() === 'quick';
  const restaurantName =
    order?.dispatchLeg?.sourceName ||
    (isQuickOrder
      ? order?.storeName || order?.sellerName || order?.seller?.shopName || order?.seller?.name || 'Seller store'
      : order?.restaurantName || order?.restaurant_name || order?.restaurantId?.restaurantName || order?.restaurantId?.name || 'Restaurant');
  const restaurantAddress =
    (isQuickOrder
      ? order?.storeAddress || order?.sellerAddress || order?.seller?.location?.address || order?.seller?.location?.formattedAddress
      : order?.restaurantAddress || order?.restaurant_address || order?.restaurantId?.location?.address) ||
    'Address not available';
  const deliveryAddress = order?.deliveryAddress || {};

  const geoCoords =
    Array.isArray(deliveryAddress?.location?.coordinates) &&
      deliveryAddress.location.coordinates.length >= 2
      ? {
        lng: deliveryAddress.location.coordinates[0],
        lat: deliveryAddress.location.coordinates[1],
      }
      : null;

  const customerLocation = order.customerLocation || order.deliveryLocation || geoCoords || null;

  const customerAddress =
    formatDeliveryAddressText(deliveryAddress, order.customerAddress || order.customer_address || '') ||
    'Location not available';

  const mapsLink =
    customerLocation?.lat != null && customerLocation?.lng != null
      ? `https://www.google.com/maps?q=${encodeURIComponent(
        `${customerLocation.lat},${customerLocation.lng}`,
      )}`
      : null;

  const pickupStops = pickupPoints.length
    ? pickupPoints
    : [
      {
        id: order?.dispatchLeg?.legId || 'food:primary',
        pickupType: order?.dispatchLeg?.pickupType === 'quick' || isQuickOrder ? 'quick' : 'food',
        sourceName: order?.dispatchLeg?.sourceName || restaurantName,
        address: order?.dispatchLeg?.address || restaurantAddress,
      },
    ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[300] bg-black/60 flex items-end justify-center p-0"
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        className="w-full max-w-lg bg-white rounded-t-[3rem] overflow-hidden shadow-[0_-20px_60px_rgba(0,0,0,0.5)] flex flex-col pt-2"
      >
        {/* Handle / Minimize */}
        <div className="w-full flex justify-center pb-1 pt-1 bg-white relative z-10 rounded-t-[2rem] -mb-[2px]">
          <button onClick={onMinimize} className="p-1 hover:bg-gray-100 active:scale-95 transition-all rounded-full flex flex-col items-center">
            <ChevronDown className="w-5 h-5 text-gray-400 stroke-[3px]" />
          </button>
        </div>

        <RenderNewOrder 
          order={order} 
          distanceKm={distanceKm} 
          etaMins={etaMins} 
          timeLeft={timeLeft} 
        />

        {/* Action Area (Shared Shell Bottom) */}
        <div className="p-5 pb-8 space-y-4">
          <ActionSlider
            label="Slide to Accept"
            onConfirm={() => onAccept(order)}
            color="bg-black"
            successLabel="Order Accepted ✓"
            timeProgress={(timeLeft / offerWindowSec) * 100}
          />

          <button
            onClick={onReject}
            className="w-full text-gray-400 font-bold text-[9px] uppercase tracking-widest hover:text-red-500 transition-colors py-1 active:scale-95"
          >
            Pass this task
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};
