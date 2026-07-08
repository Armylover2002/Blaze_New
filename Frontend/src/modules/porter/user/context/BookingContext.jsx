import React, { createContext, useContext, useMemo, useState, useCallback, useEffect, useRef } from "react";
import porterUserApi from "../services/userApi";
import { hasCoordinates, toCoordinatePayload } from "../utils/location";
import { usePorterHomeData } from "../hooks/usePorterHomeData";
import { computePorterCouponDiscount } from "../utils/couponCalculations";
import { mapActiveShipmentFromOrder } from "../utils/orderMapper";
import { usePorterCustomerSocket } from "../hooks/usePorterCustomerSocket";
import {
  readStoredVehicleId,
  writeStoredVehicleId,
  readStoredSelectedVehicle,
  writeStoredSelectedVehicle,
  readStoredPaymentMethod,
  writeStoredPaymentMethod,
  readStoredCoupon,
  writeStoredCoupon,
  readStoredCouponPricing,
  writeStoredCouponPricing,
  readStoredScheduledAt,
  writeStoredScheduledAt,
  readStoredActiveShipment,
  writeStoredActiveShipment,
  clearStoredBookingDraft,
  clearAllBookingStorage,
} from "../utils/bookingStorage";

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
const ACTIVE_ORDER_STORAGE_KEY = "porter_active_order_id";
const PARCEL_STORAGE_KEY = "porter_booking_parcel";

const TERMINAL_ORDER_STATUSES = new Set([
  "delivered",
  "completed",
  "cancelled_by_user",
  "cancelled_by_admin",
  "cancelled_by_driver",
  "failed",
]);

const readStoredOrderId = () => {
  try {
    return sessionStorage.getItem(ACTIVE_ORDER_STORAGE_KEY) || null;
  } catch {
    return null;
  }
};

const writeStoredOrderId = (orderId) => {
  try {
    if (orderId) sessionStorage.setItem(ACTIVE_ORDER_STORAGE_KEY, String(orderId));
    else sessionStorage.removeItem(ACTIVE_ORDER_STORAGE_KEY);
  } catch {
    // ignore
  }
};

const mapActiveOrder = mapActiveShipmentFromOrder;

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

const readStoredParcel = () => {
  try {
    const raw = sessionStorage.getItem(PARCEL_STORAGE_KEY);
    if (!raw) return DEFAULT_PARCEL;
    return JSON.parse(raw);
  } catch {
    return DEFAULT_PARCEL;
  }
};

const writeStoredParcel = (parcelData) => {
  try {
    if (parcelData) {
      sessionStorage.setItem(PARCEL_STORAGE_KEY, JSON.stringify(parcelData));
    } else {
      sessionStorage.removeItem(PARCEL_STORAGE_KEY);
    }
  } catch {
    // ignore
  }
};

export function PorterProvider({ children }) {
  const { vehicles: catalogVehicles } = usePorterHomeData();
  const [pickup, setPickupState] = useState(() => readStoredLocation(PICKUP_STORAGE_KEY));
  const [delivery, setDeliveryState] = useState(() => readStoredLocation(DELIVERY_STORAGE_KEY));
  const [parcel, setParcelState] = useState(() => readStoredParcel());
  const [vehicleId, setVehicleIdState] = useState(() => readStoredVehicleId());
  const [selectedVehicle, setSelectedVehicleState] = useState(() => readStoredSelectedVehicle());
  const [coupon, setCouponState] = useState(() => readStoredCoupon());
  const [couponPricing, setCouponPricingState] = useState(() => readStoredCouponPricing());
  const [paymentMethodId, setPaymentMethodIdState] = useState(() => readStoredPaymentMethod());
  const [scheduledAt, setScheduledAtState] = useState(() => readStoredScheduledAt());
  const [activeShipment, setActiveShipment] = useState(() => readStoredActiveShipment());
  const [routeQuote, setRouteQuote] = useState(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const quoteSeqRef = useRef(0);
  const hydrateSeqRef = useRef(0);

  const activeOrderId = activeShipment?.id;
  const isActiveOrderLive = Boolean(
    activeOrderId
    && !TERMINAL_ORDER_STATUSES.has(String(activeShipment?.status || "").toLowerCase()),
  );

  const { lastUpdate } = usePorterCustomerSocket(activeOrderId, { enabled: isActiveOrderLive });

  const refreshActiveOrder = useCallback(async ({ forceRefresh = true } = {}) => {
    const seq = ++hydrateSeqRef.current;
    try {
      const data = await porterUserApi.getActiveOrder({ forceRefresh });
      if (seq !== hydrateSeqRef.current) return null;
      const order = data?.order ?? data;
      const mapped = mapActiveOrder(order);
      if (mapped && !TERMINAL_ORDER_STATUSES.has(String(mapped.status || "").toLowerCase())) {
        writeStoredOrderId(mapped.id);
        writeStoredActiveShipment(mapped);
        setActiveShipment(mapped);
        return mapped;
      }
      return null;
    } catch {
      return null;
    }
  }, []);

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

  const setCoupon = useCallback((value) => {
    setCouponState((prev) => {
      const next = typeof value === "function" ? value(prev) : value;
      writeStoredCoupon(next);
      if (!next) {
        setCouponPricingState(null);
        writeStoredCouponPricing(null);
      }
      return next;
    });
  }, []);

  const setCouponPricing = useCallback((value) => {
    setCouponPricingState(value);
    writeStoredCouponPricing(value);
  }, []);

  const setParcel = useCallback((value) => {
    setParcelState((prev) => {
      const next = typeof value === "function" ? value(prev) : value;
      writeStoredParcel(next);
      return next;
    });
  }, []);

  const setPaymentMethodId = useCallback((value) => {
    setPaymentMethodIdState(value);
    writeStoredPaymentMethod(value);
  }, []);

  const setScheduledAt = useCallback((value) => {
    setScheduledAtState(value);
    writeStoredScheduledAt(value);
  }, []);

  const selectVehicle = useCallback((nextVehicleId, vehicleMeta = null) => {
    const id = nextVehicleId ? String(nextVehicleId) : null;
    setVehicleIdState(id);
    writeStoredVehicleId(id);
    if (vehicleMeta) {
      setSelectedVehicleState(vehicleMeta);
      writeStoredSelectedVehicle(vehicleMeta);
    }
  }, []);

  const setVehicleId = useCallback((value) => {
    setVehicleIdState((prev) => {
      const next = typeof value === "function" ? value(prev) : value;
      const id = next ? String(next) : null;
      writeStoredVehicleId(id);
      return id;
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

  const selectedVehicleQuote = useMemo(() => {
    return (routeQuote?.eligibleVehicles || []).find((v) => String(v.id) === String(vehicleId));
  }, [routeQuote, vehicleId]);

  const baseFare = useMemo(() => {
    if (selectedVehicleQuote?.pricing?.baseFare != null) {
      return selectedVehicleQuote.pricing.baseFare;
    }
    if (routeQuote?.pricing?.baseFare != null) {
      return routeQuote.pricing.baseFare;
    }
    return null;
  }, [selectedVehicleQuote, routeQuote]);

  const serviceTax = useMemo(() => {
    if (selectedVehicleQuote?.pricing?.serviceTax != null) return selectedVehicleQuote.pricing.serviceTax;
    if (routeQuote?.pricing?.serviceTax != null) return routeQuote.pricing.serviceTax;
    return 0;
  }, [selectedVehicleQuote, routeQuote]);

  const discount = useMemo(() => {
    if (coupon && baseFare != null) {
      // Coupon applies to total usually, but here we can keep couponPricing if it exists
      if (couponPricing?.discount != null) return couponPricing.discount;
      return computePorterCouponDiscount(coupon, baseFare + serviceTax);
    }
    if (selectedVehicleQuote?.pricing?.discount != null) return selectedVehicleQuote.pricing.discount;
    return routeQuote?.pricing?.discount ?? 0;
  }, [coupon, baseFare, serviceTax, couponPricing, selectedVehicleQuote, routeQuote]);

  const total = useMemo(() => {
    if (coupon && baseFare != null) {
      if (couponPricing?.total != null) return couponPricing.total;
      return Math.max(0, (baseFare + serviceTax) - computePorterCouponDiscount(coupon, baseFare + serviceTax));
    }
    if (selectedVehicleQuote?.pricing?.total != null) return selectedVehicleQuote.pricing.total;
    if (baseFare != null) return Math.max(0, (baseFare + serviceTax) - discount);
    return null;
  }, [coupon, baseFare, serviceTax, couponPricing, selectedVehicleQuote, discount]);

  const vehicle = useMemo(() => {
    if (selectedVehicle) return selectedVehicle;
    if (selectedVehicleQuote) {
      return {
        id: selectedVehicleQuote.id,
        name: selectedVehicleQuote.name,
        vehicleCode: selectedVehicleQuote.vehicleCode,
        iconUrl: selectedVehicleQuote.iconUrl,
        maxWeight: selectedVehicleQuote.maxWeight,
      };
    }
    const fromQuote = routeQuote?.vehicle;
    if (fromQuote) return fromQuote;
    return catalogVehicles.find((v) => String(v.id) === String(vehicleId)) || null;
  }, [selectedVehicle, selectedVehicleQuote, routeQuote, catalogVehicles, vehicleId]);

  const suggestedVehicleId = useMemo(() => {
    const recommendedId = routeQuote?.recommendedVehicleId;
    if (recommendedId) return String(recommendedId);
    return routeQuote?.eligibleVehicles?.[0]?.id ? String(routeQuote.eligibleVehicles[0].id) : null;
  }, [routeQuote]);

  const resolvedVehicleId = useMemo(() => (vehicleId ? String(vehicleId) : null), [vehicleId]);

  useEffect(() => {
    const recommendedId = routeQuote?.recommendedVehicleId;
    const eligibleIds = (routeQuote?.eligibleVehicles || []).map((v) => String(v.id));

    if (recommendedId && eligibleIds.length && !vehicleId) {
      const recommended = routeQuote.eligibleVehicles.find((v) => String(v.id) === String(recommendedId));
      if (recommended) {
        selectVehicle(recommendedId, {
          id: recommended.id,
          name: recommended.name,
          vehicleCode: recommended.vehicleCode,
          iconUrl: recommended.iconUrl,
          maxWeight: recommended.maxWeight,
        });
      }
    }
  }, [vehicleId, routeQuote, selectVehicle]);

  const updateParcel = useCallback((patch) => setParcel((p) => ({ ...p, ...patch })), [setParcel]);

  const totalParcelWeight = useMemo(
    () => Math.max(0, Number(parcel.weightKg || 0) * Math.max(1, Number(parcel.quantity || 1))),
    [parcel.weightKg, parcel.quantity],
  );

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
        parcelWeight: totalParcelWeight > 0 ? totalParcelWeight : undefined,
        vehicleId: vehicleId || undefined,
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
  }, [pickup, delivery, totalParcelWeight, vehicleId]);

  useEffect(() => {
    refreshRouteQuote();
  }, [refreshRouteQuote]);

  useEffect(() => {
    let cancelled = false;

    const hydrateActiveOrder = async () => {
      let hydrated = false;
      try {
        const data = await porterUserApi.getActiveOrder({ forceRefresh: true });
        if (cancelled) return;
        const order = data?.order ?? data;
        const mapped = mapActiveOrder(order);
        if (mapped && !TERMINAL_ORDER_STATUSES.has(String(mapped.status || "").toLowerCase())) {
          writeStoredOrderId(mapped.id);
          writeStoredActiveShipment(mapped);
          setActiveShipment(mapped);
          hydrated = true;
        }
      } catch {
        // fall through to stored recovery
      }

      if (hydrated || cancelled) return;

      const stored = readStoredActiveShipment();
      if (stored?.id && !TERMINAL_ORDER_STATUSES.has(String(stored.status || "").toLowerCase())) {
        setActiveShipment(stored);
        return;
      }

      const storedId = readStoredOrderId();
      if (!storedId) return;

      try {
        const data = await porterUserApi.getOrder(storedId);
        if (cancelled) return;
        const order = data?.order || data;
        const mapped = mapActiveOrder(order);
        if (mapped && !TERMINAL_ORDER_STATUSES.has(String(mapped.status || "").toLowerCase())) {
          writeStoredActiveShipment(mapped);
          setActiveShipment(mapped);
        } else {
          writeStoredOrderId(null);
          writeStoredActiveShipment(null);
          setActiveShipment(null);
        }
      } catch {
        writeStoredOrderId(null);
        writeStoredActiveShipment(null);
        setActiveShipment(null);
      }
    };

    void hydrateActiveOrder();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!lastUpdate?.orderId) return undefined;
    void refreshActiveOrder({ forceRefresh: true });
    return undefined;
  }, [lastUpdate, refreshActiveOrder]);

  useEffect(() => {
    if (!isActiveOrderLive) return undefined;
    const timer = setInterval(() => {
      void refreshActiveOrder({ forceRefresh: true });
    }, 15000);
    return () => clearInterval(timer);
  }, [isActiveOrderLive, refreshActiveOrder]);

  const setActiveShipmentPersisted = useCallback((value) => {
    setActiveShipment((prev) => {
      const next = typeof value === "function" ? value(prev) : value;
      writeStoredOrderId(next?.id || null);
      writeStoredActiveShipment(next);
      return next;
    });
  }, []);

  const applyCoupon = useCallback(async (couponMeta) => {
    if (!couponMeta?.code) throw new Error("Invalid coupon");
    if (!resolvedVehicleId) throw new Error("Please select a delivery vehicle.");
    if (!hasCoordinates(pickup) || !hasCoordinates(delivery)) {
      throw new Error("Pickup and delivery addresses are required");
    }

    const data = await porterUserApi.validateCoupon({
      couponCode: couponMeta.code,
      pickup: toCoordinatePayload(pickup),
      delivery: toCoordinatePayload(delivery),
      vehicleId: resolvedVehicleId,
      parcel,
    });

    setCouponState(couponMeta);
    writeStoredCoupon(couponMeta);
    setCouponPricing(data?.pricing || null);
    return data;
  }, [pickup, delivery, resolvedVehicleId, parcel, setCouponPricing]);

  useEffect(() => {
    if (!coupon?.code || !resolvedVehicleId || !hasCoordinates(pickup) || !hasCoordinates(delivery)) return undefined;

    let cancelled = false;
    porterUserApi.validateCoupon({
      couponCode: coupon.code,
      pickup: toCoordinatePayload(pickup),
      delivery: toCoordinatePayload(delivery),
      vehicleId: resolvedVehicleId,
      parcel,
    })
      .then((data) => {
        if (!cancelled) setCouponPricing(data?.pricing || null);
      })
      .catch(() => {
        if (!cancelled) setCouponPricing(null);
      });

    return () => { cancelled = true; };
  }, [
    coupon?.code,
    resolvedVehicleId,
    pickup?.lat,
    pickup?.lng,
    delivery?.lat,
    delivery?.lng,
    routeQuote?.route?.distanceKm,
    parcel?.weightKg,
    parcel?.quantity,
    setCouponPricing,
  ]);

  // Clears every temporary booking form field + its persisted storage, WITHOUT
  // touching the live/active shipment (so tracking still works after booking).
  // Uses the raw state setters so the persisted setters don't re-write storage.
  const clearBookingDraft = useCallback(() => {
    setPickupState(null);
    setDeliveryState(null);
    setParcelState(DEFAULT_PARCEL);
    setVehicleIdState(null);
    setSelectedVehicleState(null);
    setCouponState(null);
    setCouponPricingState(null);
    setPaymentMethodIdState("wallet");
    setScheduledAtState(null);
    setRouteQuote(null);
    clearStoredBookingDraft();
  }, []);

  // Full reset — draft AND the active shipment pointer. Used once an order
  // reaches a terminal state (rated/cancelled) so a fresh booking is blank.
  const resetBooking = useCallback(() => {
    clearBookingDraft();
    setActiveShipment(null);
    clearAllBookingStorage();
  }, [clearBookingDraft]);

  const value = useMemo(
    () => ({
      pickup, setPickup, delivery, setDelivery,
      parcel, setParcel, updateParcel,
      vehicleId, setVehicleId, selectVehicle, selectedVehicle, vehicle,
      resolvedVehicleId, suggestedVehicleId,
      coupon, setCoupon, applyCoupon, couponPricing,
      paymentMethodId, setPaymentMethodId,
      scheduledAt, setScheduledAt,
      activeShipment, setActiveShipment: setActiveShipmentPersisted, refreshActiveOrder,
      activeOrderEvent: lastUpdate,
      routeQuote, quoteLoading, refreshRouteQuote, totalParcelWeight,
      distanceKm, durationMin, distanceText, durationText,
      baseFare, serviceTax, discount, total, resetBooking, clearBookingDraft,
    }),
    [
      pickup, delivery, setPickup, setDelivery, parcel, updateParcel,
      vehicleId, setVehicleId, selectVehicle, selectedVehicle, vehicle,
      resolvedVehicleId, suggestedVehicleId, coupon, paymentMethodId,
      scheduledAt, activeShipment, routeQuote, quoteLoading, refreshRouteQuote, totalParcelWeight,
      distanceKm, durationMin, distanceText, durationText, baseFare, serviceTax, discount, total, resetBooking, clearBookingDraft,
      refreshActiveOrder, lastUpdate,
      applyCoupon, couponPricing, setActiveShipmentPersisted, setCoupon, setPaymentMethodId, setScheduledAt,
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
      vehicleId: null, setVehicleId: () => {}, selectVehicle: () => {}, selectedVehicle: null, vehicle: null,
      resolvedVehicleId: null, suggestedVehicleId: null,
      coupon: null, setCoupon: () => {}, applyCoupon: async () => null, couponPricing: null,
      paymentMethodId: "wallet", setPaymentMethodId: () => {},
      scheduledAt: null, setScheduledAt: () => {}, activeShipment: null, setActiveShipment: () => {},
      refreshActiveOrder: async () => null, activeOrderEvent: null,
      routeQuote: null, quoteLoading: false, refreshRouteQuote: async () => null, totalParcelWeight: 0,
      distanceKm: null, durationMin: null, distanceText: null, durationText: null,
      baseFare: null, serviceTax: 0, discount: 0, total: null, resetBooking: () => {}, clearBookingDraft: () => {},
    };
  }
  return ctx;
}

export default BookingContext;
