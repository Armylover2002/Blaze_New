import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Package, MapPin } from "lucide-react";
import Screen from "../components/Screen";
import { SectionLabel, inr } from "../components/ui";
import { getPorterShipmentDetailsPath } from "../utils/routes";
import { SHIPMENT_HISTORY } from "../utils/mock/shipments";

const TABS = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "delivered", label: "Delivered" },
  { id: "cancelled", label: "Cancelled" },
];

export default function ShipmentHistory() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("all");

  const filtered = SHIPMENT_HISTORY.filter((s) => {
    if (tab === "all") return true;
    if (tab === "active") return ["in_transit", "to_pickup", "picked_up", "out_for_delivery"].includes(s.stage);
    return s.status === tab;
  });

  return (
    <Screen title="My shipments" subtitle="Parcel delivery history" onBack={() => navigate("/porter")}>
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`shrink-0 rounded-full px-4 py-2 text-[12px] font-bold transition ${
              tab === t.id ? "bg-[#FF0000] text-white" : "bg-white text-gray-600 border border-gray-100"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <Package className="mb-3 h-12 w-12 text-gray-300" />
          <p className="text-[14px] font-bold text-gray-900">No shipments found</p>
          <p className="text-[12px] text-gray-500">Your parcel history will appear here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => navigate(getPorterShipmentDetailsPath(s.id))}
              className="w-full rounded-2xl border border-gray-100 bg-white p-4 text-left shadow-sm transition hover:border-gray-200"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[11px] font-bold text-gray-400">{s.trackingId}</span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold capitalize ${
                    s.status === "delivered"
                      ? "bg-green-50 text-[#2e7d32]"
                      : s.status === "cancelled"
                      ? "bg-gray-100 text-gray-500"
                      : "bg-amber-50 text-amber-700"
                  }`}
                >
                  {s.status.replace("_", " ")}
                </span>
              </div>
              <p className="mb-2 text-[14px] font-bold text-gray-900">{s.vehicle} · {s.weightKg} kg</p>
              <div className="mb-2 space-y-1">
                <div className="flex items-start gap-2">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#2e7d32]" />
                  <p className="truncate text-[12px] text-gray-600">{s.pickup.address}</p>
                </div>
                <div className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-[#FF0000]" />
                  <p className="truncate text-[12px] text-gray-600">{s.delivery.address}</p>
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-gray-100 pt-2">
                <span className="text-[11px] text-gray-500">{s.vehicle} · {new Date(s.createdAt).toLocaleDateString()}</span>
                <span className="text-[14px] font-extrabold text-gray-900">{inr(s.total)}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </Screen>
  );
}
