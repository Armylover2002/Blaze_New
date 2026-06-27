import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Phone, Check } from "lucide-react";
import Screen from "../components/Screen";
import MapPreview from "../components/MapPreview";
import { PrimaryButton, StickyBar } from "../components/ui";
import { useBooking } from "../context/BookingContext";
import { getPorterRatePath, getPorterInvoicePath } from "../utils/routes";
import { TRACKING_STAGES } from "../utils/mock/shipments";

const STAGE_ORDER = ["to_pickup", "picked_up", "in_transit", "out_for_delivery", "delivered"];

export default function ParcelTracking() {
  const navigate = useNavigate();
  const { activeShipment, setActiveShipment } = useBooking();
  const [stage, setStage] = useState(activeShipment?.stage || "to_pickup");

  useEffect(() => {
    const idx = STAGE_ORDER.indexOf(stage);
    if (idx >= STAGE_ORDER.length - 1) return;
    const timer = setTimeout(() => {
      const next = STAGE_ORDER[idx + 1];
      setStage(next);
      setActiveShipment((prev) => (prev ? { ...prev, stage: next, status: next === "delivered" ? "delivered" : "in_transit" } : prev));
    }, 5000);
    return () => clearTimeout(timer);
  }, [stage, setActiveShipment]);

  const currentIdx = STAGE_ORDER.indexOf(stage);
  const partner = activeShipment?.partner;

  return (
    <Screen title="Track parcel" subtitle={activeShipment?.trackingId || "Live shipment tracking"}>
      <MapPreview height={200} showRoute animateCar className="mb-4" />

      {partner && (
        <div className="mb-4 flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-3 shadow-sm">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#FFF1F1] text-[16px] font-bold text-[#FF0000]">
            {partner.name.charAt(0)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-bold text-gray-900">{partner.name}</p>
            <p className="text-[11px] text-gray-500">{partner.vehicle} · {partner.vehicleNumber}</p>
          </div>
          <a href={`tel:${partner.phone?.replace(/\s/g, "")}`} className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100">
            <Phone className="h-4 w-4 text-[#FF0000]" />
          </a>
        </div>
      )}

      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <h2 className="mb-4 text-[14px] font-bold text-gray-900">Shipment progress</h2>
        <div className="space-y-0">
          {TRACKING_STAGES.map((s, i) => {
            const done = i <= currentIdx;
            const active = i === currentIdx;
            return (
              <div key={s.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <motion.div
                    animate={active ? { scale: [1, 1.1, 1] } : {}}
                    transition={{ duration: 1.5, repeat: active ? Infinity : 0 }}
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-sm ${
                      done ? "bg-[#FF0000] text-white" : "bg-gray-100 text-gray-400"
                    }`}
                  >
                    {done && i < currentIdx ? <Check className="h-4 w-4" /> : s.icon}
                  </motion.div>
                  {i < TRACKING_STAGES.length - 1 && (
                    <div className={`my-1 h-8 w-0.5 ${i < currentIdx ? "bg-[#FF0000]" : "bg-gray-200"}`} />
                  )}
                </div>
                <div className="pb-6 pt-1">
                  <p className={`text-[14px] font-bold ${active ? "text-[#FF0000]" : done ? "text-gray-900" : "text-gray-400"}`}>
                    {s.label}
                  </p>
                  {active && <p className="text-[11px] text-gray-500">Updated just now</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <StickyBar>
        {stage === "delivered" ? (
          <div className="flex gap-2">
            <PrimaryButton variant="outline" className="flex-1" onClick={() => navigate(getPorterInvoicePath("current"))}>
              View invoice
            </PrimaryButton>
            <PrimaryButton className="flex-1" onClick={() => navigate(getPorterRatePath())}>
              Rate delivery
            </PrimaryButton>
          </div>
        ) : (
          <PrimaryButton variant="outline" disabled>
            Parcel in transit…
          </PrimaryButton>
        )}
      </StickyBar>
    </Screen>
  );
}
