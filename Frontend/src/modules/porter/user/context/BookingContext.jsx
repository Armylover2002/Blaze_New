import React, { createContext, useContext, useMemo, useState, useCallback } from "react";
import { estimateDeliveryCost, getVehicleById } from "../utils/mock/vehicles";
import { computeDiscount } from "../utils/mock/coupons";

const BookingContext = createContext(null);

const DEFAULT_PICKUP = {
  title: "Current Location",
  address: "B-204, Green Residency, Sector 18, Noida",
};

const DEFAULT_PARCEL = {
  sizeId: "medium",
  weightKg: 20,
  quantity: 1,
  instructions: "",
  receiverName: "",
  receiverPhone: "",
};

export function PorterProvider({ children }) {
  const [pickup, setPickup] = useState(DEFAULT_PICKUP);
  const [delivery, setDelivery] = useState(null);
  const [parcel, setParcel] = useState(DEFAULT_PARCEL);
  const [vehicleId, setVehicleId] = useState("auto");
  const [coupon, setCoupon] = useState(null);
  const [paymentMethodId, setPaymentMethodId] = useState("wallet");
  const [scheduledAt, setScheduledAt] = useState(null);
  const [activeShipment, setActiveShipment] = useState(null);

  const distanceKm = useMemo(() => delivery?.distanceKm ?? 8.2, [delivery]);
  const durationMin = useMemo(() => Math.max(10, Math.round(distanceKm * 3)), [distanceKm]);
  const baseFare = useMemo(() => estimateDeliveryCost(vehicleId, distanceKm, durationMin), [vehicleId, distanceKm, durationMin]);
  const discount = useMemo(() => computeDiscount(coupon, baseFare), [coupon, baseFare]);
  const total = Math.max(0, baseFare - discount);
  const vehicle = getVehicleById(vehicleId);
  const updateParcel = useCallback((patch) => setParcel((p) => ({ ...p, ...patch })), []);

  const resetBooking = useCallback(() => {
    setDelivery(null);
    setParcel(DEFAULT_PARCEL);
    setCoupon(null);
    setScheduledAt(null);
    setActiveShipment(null);
    setVehicleId("auto");
  }, []);

  const value = useMemo(
    () => ({
      pickup, setPickup, delivery, setDelivery,
      parcel, setParcel, updateParcel, vehicleId, setVehicleId, vehicle,
      coupon, setCoupon, paymentMethodId, setPaymentMethodId,
      scheduledAt, setScheduledAt, activeShipment, setActiveShipment,
      distanceKm, durationMin, baseFare, discount, total, resetBooking,
    }),
    [pickup, delivery, parcel, updateParcel, vehicleId, vehicle, coupon, paymentMethodId, scheduledAt, activeShipment, distanceKm, durationMin, baseFare, discount, total, resetBooking],
  );

  return <BookingContext.Provider value={value}>{children}</BookingContext.Provider>;
}

export function useBooking() {
  const ctx = useContext(BookingContext);
  if (!ctx) {
    return {
      pickup: DEFAULT_PICKUP, setPickup: () => {}, delivery: null, setDelivery: () => {},
      parcel: DEFAULT_PARCEL, setParcel: () => {}, updateParcel: () => {},
      vehicleId: "auto", setVehicleId: () => {}, vehicle: getVehicleById("auto"),
      coupon: null, setCoupon: () => {}, paymentMethodId: "wallet", setPaymentMethodId: () => {},
      scheduledAt: null, setScheduledAt: () => {}, activeShipment: null, setActiveShipment: () => {},
      distanceKm: 8.2, durationMin: 26, baseFare: estimateDeliveryCost("auto"), discount: 0,
      total: estimateDeliveryCost("auto"), resetBooking: () => {},
    };
  }
  return ctx;
}

export default BookingContext;
