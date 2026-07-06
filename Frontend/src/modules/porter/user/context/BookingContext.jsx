import React, { createContext, useContext, useMemo, useState, useCallback, useEffect, useRef } from "react";
import porterUserApi from "../services/userApi";
import { hasCoordinates, toCoordinatePayload } from "../utils/location";
import { usePorterHomeData } from "../hooks/usePorterHomeData";

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

const mapActiveOrder = (order) => {
  if (!order?.id) return null;
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    trackingId: order.orderNumber,
    status: order.status,
    pickup: order.pickup,
    delivery: order.delivery,
    parcel: order.parcel,
    vehicleId: order.vehicleId,
    route: order.route,
    pricing: order.pricing,
    payment: order.payment,
    dispatch: order.dispatch,
    deliveryState: order.deliveryState,
    vehicleName: order.vehicleName,
    total: order.pricing?.total,
    scheduledAt: order.scheduledAt,
  };
};

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
  const [vehicleId, setVehicleId] = useState(null);
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

  const setParcel = useCallback((value) => {
    setParcelState((prev) => {
      const next = typeof value === "function" ? value(prev) : value;
      writeStoredParcel(next);
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

  const selectedVehicleQuote = useMemo(() => {
    return (routeQuote?.eligibleVehicles || []).find((v) => String(v.id) === String(vehicleId));
  }, [routeQuote, vehicleId]);

  const baseFare = useMemo(() => {
    if (selectedVehicleQuote?.estimatedFare != null) return selectedVehicleQuote.estimatedFare;
    if (routeQuote?.fare?.total != null) return routeQuote.fare.total;
    if (routeQuote?.pricing?.total != null) return routeQuote.pricing.total;
    return null;
  }, [selectedVehicleQuote, routeQuote]);

  const discount = useMemo(() => {
    if (selectedVehicleQuote?.pricing?.discount != null) return selectedVehicleQuote.pricing.discount;
    return routeQuote?.pricing?.discount ?? 0;
  }, [selectedVehicleQuote, routeQuote]);

  const total = useMemo(() => {
    if (selectedVehicleQuote?.pricing?.total != null) return selectedVehicleQuote.pricing.total;
    if (baseFare != null) return Math.max(0, baseFare - discount);
    return null;
  }, [selectedVehicleQuote, baseFare, discount]);

  const vehicle = useMemo(() => {
    if (selectedVehicleQuote) {
      return {
        id: selectedVehicleQuote.id,
        name: selectedVehicleQuote.name,
        vehicleCode: selectedVehicleQuote.vehicleCode,
        iconUrl: selectedVehicleQuote.iconUrl,
      };
    }
    const fromQuote = routeQuote?.vehicle;
    if (fromQuote) return fromQuote;
    return catalogVehicles.find((v) => String(v.id) === String(vehicleId)) || null;
  }, [selectedVehicleQuote, routeQuote, catalogVehicles, vehicleId]);

  useEffect(() => {
    const recommendedId = routeQuote?.recommendedVehicleId;
    const eligibleIds = (routeQuote?.eligibleVehicles || []).map((v) => String(v.id));

    if (recommendedId && eligibleIds.length) {
      if (!vehicleId || !eligibleIds.includes(String(vehicleId))) {
        setVehicleId(recommendedId);
      }
      return;
    }

    if (!vehicleId && catalogVehicles.length) {
      setVehicleId(catalogVehicles[0].id);
    }
  }, [vehicleId, catalogVehicles, routeQuote]);
  const updateParcel = useCallback((patch) => setParcel((p) => ({ ...p, ...patch })), []);

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
  }, [pickup, delivery, totalParcelWeight]);

  useEffect(() => {
    refreshRouteQuote();
  }, [refreshRouteQuote]);

  useEffect(() => {
    let cancelled = false;
    porterUserApi.getActiveOrder()
      .then((data) => {
        if (cancelled) return;
        const order = data?.order || data;
        const mapped = mapActiveOrder(order);
        if (mapped) {
          writeStoredOrderId(mapped.id);
          setActiveShipment(mapped);
        }
      })
      .catch(() => {
        const storedId = readStoredOrderId();
        if (!storedId || cancelled) return;
        porterUserApi.getOrder(storedId)
          .then((data) => {
            if (cancelled) return;
            const order = data?.order || data;
            const mapped = mapActiveOrder(order);
            if (mapped) setActiveShipment(mapped);
          })
          .catch(() => writeStoredOrderId(null));
      });
    return () => { cancelled = true; };
  }, []);

  const setActiveShipmentPersisted = useCallback((value) => {
    setActiveShipment((prev) => {
      const next = typeof value === "function" ? value(prev) : value;
      writeStoredOrderId(next?.id || null);
      return next;
    });
  }, []);

  const resetBooking = useCallback(() => {
    setDelivery(null);
    writeStoredLocation(DELIVERY_STORAGE_KEY, null);
    setParcel(DEFAULT_PARCEL);
    setCoupon(null);
    setScheduledAt(null);
    setActiveShipment(null);
    writeStoredOrderId(null);
    setVehicleId(null);
    setRouteQuote(null);
  }, []);

  const value = useMemo(
    () => ({
      pickup, setPickup, delivery, setDelivery,
      parcel, setParcel, updateParcel, vehicleId, setVehicleId, vehicle,
      coupon, setCoupon, paymentMethodId, setPaymentMethodId,
      scheduledAt, setScheduledAt, activeShipment, setActiveShipment: setActiveShipmentPersisted,
      routeQuote, quoteLoading, refreshRouteQuote, totalParcelWeight,
      distanceKm, durationMin, distanceText, durationText,
      baseFare, discount, total, resetBooking,
    }),
    [
      pickup, delivery, setPickup, setDelivery, parcel, updateParcel, vehicleId, vehicle, coupon, paymentMethodId,
      scheduledAt, activeShipment, routeQuote, quoteLoading, refreshRouteQuote, totalParcelWeight,
      distanceKm, durationMin, distanceText, durationText, baseFare, discount, total, resetBooking,
      setActiveShipmentPersisted,
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
      vehicleId: null, setVehicleId: () => {}, vehicle: null,
      coupon: null, setCoupon: () => {}, paymentMethodId: "wallet", setPaymentMethodId: () => {},
      scheduledAt: null, setScheduledAt: () => {}, activeShipment: null, setActiveShipment: () => {},
      routeQuote: null, quoteLoading: false, refreshRouteQuote: async () => null, totalParcelWeight: 0,
      distanceKm: null, durationMin: null, distanceText: null, durationText: null,
      baseFare: null, discount: 0, total: null, resetBooking: () => {},
    };
  }
  return ctx;
}

export default BookingContext;
