import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Package } from "lucide-react";
import Screen from "../components/Screen";
import { inr } from "../components/ui";
import { getPorterShipmentDetailsPath } from "../utils/routes";
import porterUserApi from "../services/userApi";

const TABS = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "delivered", label: "Delivered" },
  { id: "cancelled", label: "Cancelled" },
];

const ACTIVE_STATUSES = new Set([
  "searching_partner", "assigned", "partner_accepted", "en_route_pickup",
  "at_pickup", "picked_up", "in_transit", "at_drop",
]);

export default function ShipmentHistory() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("all");
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    porterUserApi.listOrders({ limit: 50 })
      .then((data) => {
        if (cancelled) return;
        setOrders(data?.records || data?.docs || []);
      })
      .catch(() => setOrders([]))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const filtered = orders.filter((s) => {
    if (tab === "all") return true;
    if (tab === "active") return ACTIVE_STATUSES.has(s.status);
    if (tab === "delivered") return ["delivered", "completed"].includes(s.status);
    if (tab === "cancelled") return String(s.status || "").startsWith("cancelled");
    return true;
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

      {loading ? (
        <p className="text-center text-sm text-gray-500 py-12">Loading shipments…</p>
      ) : filtered.length === 0 ? (
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
              className="w-full rounded-2xl border border-gray-100 bg-white p-4 text-left shadow-sm"
            >
              <div className="flex items-center justify-between gap-2 mb-3 border-b border-gray-50 pb-3">
                <p className="text-[13px] font-bold text-gray-900">#{s.orderNumber}</p>
                <span className={`text-[11px] font-bold uppercase ${["delivered", "completed"].includes(s.status) ? "text-green-600" : "text-[#FF0000]"}`}>{String(s.status || "").replace(/_/g, " ")}</span>
              </div>
              <div className="relative pl-5 mb-3">
                 <div className="absolute left-1.5 top-1.5 bottom-1.5 w-[1px] bg-gray-200"></div>
                 <div className="relative mb-3">
                    <div className="absolute -left-[18.5px] top-1.5 h-2 w-2 rounded-full border-2 border-green-600 bg-white"></div>
                    <p className="text-[12px] text-gray-700 font-medium line-clamp-1">{s.pickup?.address || "Pickup address"}</p>
                 </div>
                 <div className="relative">
                    <div className="absolute -left-[18.5px] top-1.5 h-2 w-2 rounded-full border-2 border-[#FF0000] bg-white"></div>
                    <p className="text-[12px] text-gray-700 font-medium line-clamp-1">{s.delivery?.address || "Delivery address"}</p>
                 </div>
              </div>
              <p className="text-[14px] font-bold text-gray-900">{inr(s.pricing?.total ?? 0)}</p>
            </button>
          ))}
        </div>
      )}
    </Screen>
  );
}
