import React from "react";
import { motion } from "framer-motion";
import { Package, Clock, AlertTriangle } from "lucide-react";

export default function VehicleCard({
  vehicle,
  fare,
  estimatedTime,
  selected,
  onSelect,
  disabled,
  disabledReason,
  badge,
}) {
  const maxWeight = vehicle.maxWeight ?? vehicle.maxWeightKg;
  const iconUrl = vehicle.iconUrl;
  const eta = estimatedTime ?? vehicle.estimatedTime ?? vehicle.etaMins;

  return (
    <motion.button
      type="button"
      whileTap={{ scale: disabled ? 1 : 0.98 }}
      onClick={disabled ? undefined : onSelect}
      className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-all ${
        disabled
          ? "border-gray-100 bg-gray-50 opacity-60"
          : selected
            ? "border-[#FF0000] bg-[#FFF1F1] shadow-[0_8px_24px_rgba(255,0,0,0.10)]"
            : "border-gray-100 bg-white hover:border-gray-200"
      }`}
    >
      <div className={`flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl ${selected ? "bg-white" : "bg-gray-50"}`}>
        {iconUrl ? (
          <img src={iconUrl} alt={vehicle.name} className="h-full w-full object-contain p-1" />
        ) : (
          <span className="text-2xl">{vehicle.icon || "🚚"}</span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="text-[15px] font-bold text-gray-900">{vehicle.name}</h3>
          {badge && !disabled && (
            <span className="rounded-full bg-[#FF0000] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
              {badge}
            </span>
          )}
          {maxWeight != null && Number(maxWeight) > 0 && (
            <span className="flex items-center gap-0.5 text-[11px] font-medium text-gray-500">
              <Package className="h-3 w-3" /> Supports up to {maxWeight} kg
            </span>
          )}
        </div>
        {(vehicle.weightAdvice || vehicle.description) && (
          <p className="truncate text-[12px] text-gray-500">
            {vehicle.weightAdvice || vehicle.description}
          </p>
        )}
        {disabled ? (
          <span className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold text-amber-600">
            <AlertTriangle className="h-3 w-3" />
            {disabledReason || "Vehicle unavailable"}
          </span>
        ) : eta != null ? (
          <span className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold text-[#2e7d32]">
            <Clock className="h-3 w-3" /> ETA ~{eta} min
          </span>
        ) : null}
      </div>
      <div className="text-right">
        {fare != null && <p className="text-[16px] font-extrabold text-gray-900">₹{fare}</p>}
        {vehicle.surge > 1 && !disabled && (
          <span className="text-[10px] font-bold text-amber-600">{vehicle.surge}x demand</span>
        )}
      </div>
    </motion.button>
  );
}

