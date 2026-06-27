import React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Package, MapPin, ChevronRight, Bell, Shield, Clock, Search } from "lucide-react";
import MapPreview from "../components/MapPreview";
import PorterBottomNav from "../components/layout/BottomNav";
import { PrimaryButton, SectionLabel, inr } from "../components/ui";
import { useBooking } from "../context/BookingContext";
import {
  getPorterAddressPath,
  getPorterShipmentDetailsPath,
  getPorterNotificationsPath,
  getPorterSosPath,
} from "../utils/routes";
import { DELIVERY_VEHICLES } from "../utils/mock/vehicles";
import { OFFERS } from "../utils/mock/payments";
import { SHIPMENT_HISTORY } from "../utils/mock/shipments";

export default function Home({ embedded = false }) {
  const navigate = useNavigate();
  const { pickup } = useBooking();
  const recentShipments = SHIPMENT_HISTORY.slice(0, 3);
  const featuredVehicles = DELIVERY_VEHICLES.slice(0, 4);

  return (
    <div className={`min-h-screen bg-[#FAF7F2] dark:bg-[#0a0a0a] ${embedded ? "pb-24" : "pb-28"}`}>
      <header className="sticky top-0 z-40 bg-white/90 dark:bg-[#1a1a1a]/90 backdrop-blur-md border-b border-gray-100 dark:border-white/10">
        <div className="px-4 py-3">
          <div className="flex w-full items-center relative">
            <Search className="absolute left-3 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search..."
              className="w-full rounded-full bg-gray-100 dark:bg-[#2a2a2a] py-2 pl-9 pr-4 text-[13px] text-gray-900 dark:text-white outline-none border border-transparent focus:border-gray-200 dark:focus:border-white/10 transition-colors"
            />
          </div>
        </div>
      </header>

      <main className="px-4 py-4 space-y-5">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="overflow-hidden rounded-2xl bg-white shadow-sm">
          <MapPreview height={160} showRoute pin />
          <div className="p-4">
            <div className="mb-3 flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#2e7d32]" />
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Pickup</p>
                <p className="truncate text-[14px] font-bold text-gray-900">{pickup.title}</p>
                <p className="truncate text-[12px] text-gray-500">{pickup.address}</p>
              </div>
            </div>
            <PrimaryButton onClick={() => navigate(getPorterAddressPath())}>
              <Package className="h-4 w-4" />
              Send a parcel
            </PrimaryButton>
          </div>
        </motion.div>

        <section>
          <SectionLabel>Delivery vehicles</SectionLabel>
          <div className="grid grid-cols-2 gap-3">
            {featuredVehicles.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => navigate(getPorterAddressPath())}
                className="rounded-2xl border border-gray-100 bg-white p-3 text-left shadow-sm transition hover:border-[#FF0000]/30"
              >
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-xl">{v.icon}</span>
                  <div>
                    <p className="text-[13px] font-bold text-gray-900">{v.name}</p>
                    <p className="text-[10px] text-gray-500">Up to {v.maxWeightKg} kg</p>
                  </div>
                </div>
                <p className="text-[11px] text-gray-500 line-clamp-2">{v.tagline}</p>
              </button>
            ))}
          </div>
        </section>

        <section>
          <SectionLabel>Offers for you</SectionLabel>
          <div className="space-y-2">
            {OFFERS.map((o) => (
              <div key={o.id} className="flex items-center gap-3 rounded-2xl border border-[#FF0000]/10 bg-[#FFF1F1] p-3">
                <span className="text-2xl">{o.icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-bold text-gray-900">{o.title}</p>
                  <p className="text-[11px] text-gray-600">{o.subtitle}</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-[#FF0000]" />
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <SectionLabel className="mb-0">Recent shipments</SectionLabel>
            <button type="button" onClick={() => navigate("/porter/shipments")} className="text-[12px] font-bold text-[#FF0000]">
              View all
            </button>
          </div>
          <div className="space-y-2">
            {recentShipments.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => navigate(getPorterShipmentDetailsPath(s.id))}
                className="flex w-full items-center gap-3 rounded-2xl border border-gray-100 bg-white p-3 text-left shadow-sm transition hover:border-gray-200"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-50">
                  <Package className="h-5 w-5 text-[#FF0000]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-bold text-gray-900">{s.delivery.title} · {s.trackingId}</p>
                  <p className="truncate text-[11px] text-gray-500">{s.vehicle} · {s.weightKg} kg</p>
                </div>
                <div className="text-right">
                  <p className="text-[13px] font-bold text-gray-900">{inr(s.total)}</p>
                  <p className={`text-[10px] font-bold capitalize ${s.status === "delivered" ? "text-[#2e7d32]" : s.status === "cancelled" ? "text-gray-400" : "text-amber-600"}`}>
                    {s.status.replace("_", " ")}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </section>

        <div className="flex items-center gap-2 rounded-2xl bg-white p-3 text-[11px] text-gray-500 shadow-sm">
          <Clock className="h-4 w-4 shrink-0 text-[#FF0000]" />
          Same-day pickup available across Noida · Live parcel tracking included
        </div>
      </main>

      {embedded && (
        <div className="md:hidden">
          <PorterBottomNav />
        </div>
      )}
    </div>
  );
}
