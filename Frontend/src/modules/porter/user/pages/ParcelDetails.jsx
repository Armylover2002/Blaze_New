import React from "react";
import { useNavigate } from "react-router-dom";
import { Minus, Plus, User, Phone } from "lucide-react";
import Screen from "../components/Screen";
import { PrimaryButton, StickyBar, SectionLabel } from "../components/ui";
import { useBooking } from "../context/BookingContext";
import { getPorterVehiclePath } from "../utils/routes";
import { PARCEL_SIZES } from "../utils/mock/parcelSizes";

export default function ParcelDetails() {
  const navigate = useNavigate();
  const { parcel, updateParcel } = useBooking();

  const canContinue =
    parcel.sizeId &&
    parcel.weightKg > 0 &&
    parcel.receiverName.trim() &&
    parcel.receiverPhone.trim().length >= 10;

  return (
    <Screen title="Parcel details" subtitle="Package information">
      <SectionLabel>Package size</SectionLabel>
      <div className="mb-5 grid grid-cols-2 gap-2">
        {PARCEL_SIZES.map((s) => {
          const selected = parcel.sizeId === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => updateParcel({ sizeId: s.id })}
              className={`rounded-2xl border p-3 text-left transition ${
                selected ? "border-[#FF0000] bg-[#FFF1F1]" : "border-gray-100 bg-white"
              }`}
            >
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[14px] font-bold text-gray-900">{s.label}</span>
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-100 text-[11px] font-bold">{s.icon}</span>
              </div>
              <p className="text-[11px] text-gray-500">{s.dims}</p>
              <p className="text-[10px] font-semibold text-gray-400">Up to {s.maxWeightKg} kg</p>
            </button>
          );
        })}
      </div>

      <SectionLabel>Weight & quantity</SectionLabel>
      <div className="mb-5 space-y-3 rounded-2xl border border-gray-100 bg-white p-4">
        <div className="flex items-center justify-between">
          <span className="text-[14px] font-bold text-gray-900">Weight (kg)</span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => updateParcel({ weightKg: Math.max(1, parcel.weightKg - 1) })}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="w-8 text-center text-[16px] font-extrabold">{parcel.weightKg}</span>
            <button
              type="button"
              onClick={() => updateParcel({ weightKg: parcel.weightKg + 1 })}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-[#FFF1F1] text-[#FF0000]"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-gray-100 pt-3">
          <span className="text-[14px] font-bold text-gray-900">Quantity</span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => updateParcel({ quantity: Math.max(1, parcel.quantity - 1) })}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="w-8 text-center text-[16px] font-extrabold">{parcel.quantity}</span>
            <button
              type="button"
              onClick={() => updateParcel({ quantity: parcel.quantity + 1 })}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-[#FFF1F1] text-[#FF0000]"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <SectionLabel>Receiver details</SectionLabel>
      <div className="mb-4 space-y-3">
        <div className="relative">
          <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={parcel.receiverName}
            onChange={(e) => updateParcel({ receiverName: e.target.value })}
            placeholder="Receiver name"
            className="w-full rounded-2xl border border-gray-200 bg-white py-3 pl-10 pr-4 text-[14px] font-medium outline-none focus:border-[#FF0000]"
          />
        </div>
        <div className="relative">
          <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={parcel.receiverPhone}
            onChange={(e) => updateParcel({ receiverPhone: e.target.value.replace(/\D/g, "").slice(0, 10) })}
            placeholder="Receiver phone number"
            inputMode="numeric"
            className="w-full rounded-2xl border border-gray-200 bg-white py-3 pl-10 pr-4 text-[14px] font-medium outline-none focus:border-[#FF0000]"
          />
        </div>
        <textarea
          value={parcel.instructions}
          onChange={(e) => updateParcel({ instructions: e.target.value })}
          placeholder="Delivery instructions (optional)"
          rows={3}
          className="w-full resize-none rounded-2xl border border-gray-200 bg-white p-3 text-[14px] font-medium outline-none focus:border-[#FF0000]"
        />
      </div>

      <StickyBar>
        <PrimaryButton disabled={!canContinue} onClick={() => navigate(getPorterVehiclePath())}>
          Choose delivery vehicle
        </PrimaryButton>
      </StickyBar>
    </Screen>
  );
}
