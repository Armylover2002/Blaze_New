import React, { createContext, useContext, useMemo, useState, useCallback, useEffect, useRef } from "react";
import { estimateDeliveryCost, getVehicleById } from "../utils/mock/vehicles";
import { computeDiscount } from "../utils/mock/coupons";
import porterUserApi from "../services/userApi";
import { hasCoordinates, toCoordinatePayload } from "../utils/location";

const BookingContext = createContext(null);

const DEFAULT_PARCEL = {
  parcelName: "",
  parcelDescription: "",
  weightKg: 0,
  quantity: 1,
  instructions: "",
  receiverName: "",
  receiverPhone: "",
  isScheduled: false,
};

const PICKUP_STORAGE_KEY = "porter_booking_pickup";
const DELIVERY_STORAGE_KEY = "porter_booking_delivery";

const readStoredLocation = (key) => {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return hasCoordinates(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const writeStoredLocation = (key, location) => {
  try {
    if (location && hasCoordinates(location)) {
      sessionStorage.setItem(key, JSON.stringify(location));
    } else {
      sessionStorage.removeItem(key);
    }
  } catch {
    // ignore storage errors
  }
};

export function PorterProvider({ children }) {
  const [pickup, setPickupState] = useState(() => readStoredLocation(PICKUP_STORAGE_KEY));
  const [delivery, setDeliveryState] = useState(() => readStoredLocation(DELIVERY_STORAGE_KEY));
  const [parcel, setParcel] = useState(DEFAULT_PARCEL);
  const [vehicleId, setVehicleId] = useState("auto");
  const [coupon, setCoupon] = useState(null);
  const [paymentMethodId, setPaymentMethodId] = useState("wallet");
  const [scheduledAt, setScheduledAt] = useState(null);
  const [activeShipment, setActiveShipment] = useState(null);
  const [routeQuote, setRouteQuote] = useState(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const quoteSeqRef = useRef(0);

  const setPickup = useCallback((value) => {
    setPickupState((prev) => {
      const next = typeof value === "function" ? value(prev) : value;
      writeStoredLocation(PICKUP_STORAGE_KEY, next);
      return next;
    });
  }, []);

  const setDelivery = useCallback((value) => {
    setDeliveryState((prev) => {
      const next = typeof value === "function" ? value(prev) : value;
      writeStoredLocation(DELIVERY_STORAGE_KEY, next);
      return next;
    });
  }, []);

  const distanceKm = useMemo(
    () => routeQuote?.route?.distanceKm ?? delivery?.distanceKm ?? null,
    [routeQuote, delivery],
  );
  const durationMin = useMemo(
    () => routeQuote?.route?.durationMin ?? null,
    [routeQuote],
  );
  const distanceText = routeQuote?.route?.distanceText ?? null;
  const durationText = routeQuote?.route?.durationText ?? null;

  const baseFare = useMemo(() => {
    if (routeQuote?.fare?.total != null) return routeQuote.fare.total;
    if (distanceKm != null && durationMin != null) {
      return estimateDeliveryCost(vehicleId, distanceKm, durationMin);
    }
    return null;
  }, [routeQuote, vehicleId, distanceKm, durationMin]);

  const discount = useMemo(
    () => (baseFare != null ? computeDiscount(coupon, baseFare) : 0),
    [coupon, baseFare],
  );
  const total = baseFare != null ? Math.max(0, baseFare - discount) : null;
  const vehicle = getVehicleById(vehicleId);
  const updateParcel = useCallback((patch) => setParcel((p) => ({ ...p, ...patch })), []);

  const refreshRouteQuote = useCallback(async () => {
    if (!hasCoordinates(pickup) || !hasCoordinates(delivery)) {
      setRouteQuote(null);
      return null;
    }

    const seq = ++quoteSeqRef.current;
    setQuoteLoading(true);
    try {
      const data = await porterUserApi.getQuotePreview({
        pickup: toCoordinatePayload(pickup),
        delivery: toCoordinatePayload(delivery),
        vehicleId: /^[a-f\d]{24}$/i.test(String(vehicleId)) ? vehicleId : undefined,
      });
      if (seq !== quoteSeqRef.current) return null;
      setRouteQuote(data);
      return data;
    } catch (err) {
      if (seq !== quoteSeqRef.current) return null;
      console.error("[Porter] route quote failed:", err);
      setRouteQuote(null);
      return null;
    } finally {
      if (seq === quoteSeqRef.current) setQuoteLoading(false);
    }
  }, [pickup, delivery, vehicleId]);

  useEffect(() => {
    refreshRouteQuote();
  }, [refreshRouteQuote]);

  const resetBooking = useCallback(() => {
    setDelivery(null);
    writeStoredLocation(DELIVERY_STORAGE_KEY, null);
    setParcel(DEFAULT_PARCEL);
    setCoupon(null);
    setScheduledAt(null);
    setActiveShipment(null);
    setVehicleId("auto");
    setRouteQuote(null);
  }, []);

  const value = useMemo(
    () => ({
      pickup, setPickup, delivery, setDelivery,
      parcel, setParcel, updateParcel, vehicleId, setVehicleId, vehicle,
      coupon, setCoupon, paymentMethodId, setPaymentMethodId,
      scheduledAt, setScheduledAt, activeShipment, setActiveShipment,
      routeQuote, quoteLoading, refreshRouteQuote,
      distanceKm, durationMin, distanceText, durationText,
      baseFare, discount, total, resetBooking,
    }),
    [
      pickup, delivery, setPickup, setDelivery, parcel, updateParcel, vehicleId, vehicle, coupon, paymentMethodId,
      scheduledAt, activeShipment, routeQuote, quoteLoading, refreshRouteQuote,
      distanceKm, durationMin, distanceText, durationText, baseFare, discount, total, resetBooking,
    ],
  );

  return <BookingContext.Provider value={value}>{children}</BookingContext.Provider>;
}

export function useBooking() {
  const ctx = useContext(BookingContext);
  if (!ctx) {
    return {
      pickup: null, setPickup: () => {}, delivery: null, setDelivery: () => {},
      parcel: DEFAULT_PARCEL, setParcel: () => {}, updateParcel: () => {},
      vehicleId: "auto", setVehicleId: () => {}, vehicle: getVehicleById("auto"),
      coupon: null, setCoupon: () => {}, paymentMethodId: "wallet", setPaymentMethodId: () => {},
      scheduledAt: null, setScheduledAt: () => {}, activeShipment: null, setActiveShipment: () => {},
      routeQuote: null, quoteLoading: false, refreshRouteQuote: async () => null,
      distanceKm: null, durationMin: null, distanceText: null, durationText: null,
      baseFare: null, discount: 0, total: null, resetBooking: () => {},
    };
  }
  return ctx;
}

export default BookingContext;
