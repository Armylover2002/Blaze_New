import { useSyncExternalStore } from "react";
import { MOCK_VEHICLES } from "./mockData";

export const DEFAULT_VEHICLE_PRICING = {
  enableDistanceCharges: true,
  basePrice: 0,
  baseDistance: 2,
  distancePrice: 10,
  serviceTax: 5,
  commissionType: "Percentage",
  commissionValue: 10,
  description: "",
  status: "active",
  pricingConfigured: false,
};

function initVehicle(v) {
  const hasPricing = v.basePrice != null && Number(v.basePrice) > 0;
  return {
    ...DEFAULT_VEHICLE_PRICING,
    ...v,
    pricingConfigured: hasPricing,
  };
}

let vehicles = MOCK_VEHICLES.map(initVehicle);
const listeners = new Set();

function emit() {
  listeners.forEach((fn) => fn());
}

export function getVehicles() {
  return vehicles;
}

export function subscribeVehicles(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setVehicles(updater) {
  vehicles = typeof updater === "function" ? updater(vehicles) : updater;
  emit();
}

export function updateVehicle(id, patch) {
  setVehicles((prev) => prev.map((v) => (v.id === id ? { ...v, ...patch } : v)));
}

export function isPricingConfigured(vehicle) {
  return vehicle?.pricingConfigured === true;
}

export function saveVehiclePricing(id, payload) {
  updateVehicle(id, { ...payload, pricingConfigured: true });
}

export function clearVehiclePricing(id) {
  updateVehicle(id, { ...DEFAULT_VEHICLE_PRICING, pricingConfigured: false });
}

/** Single source of truth for Porter vehicle data — shared by Vehicles & Pricing pages. */
export function usePorterVehicles() {
  const list = useSyncExternalStore(subscribeVehicles, getVehicles, getVehicles);
  return [list, setVehicles];
}
