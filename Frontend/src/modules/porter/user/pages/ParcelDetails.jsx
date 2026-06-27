import React from "react";
import { useNavigate } from "react-router-dom";
import { User, Phone, Package, Scale, FileText, AlignLeft } from "lucide-react";
import Screen from "../components/Screen";
import { PrimaryButton, StickyBar, SectionLabel } from "../components/ui";
import { useBooking } from "../context/BookingContext";
import { getPorterVehiclePath } from "../utils/routes";

export default function ParcelDetails() {
  const navigate = useNavigate();
  const { parcel, updateParcel } = useBooking();

  const canContinue =
    parcel.weightKg > 0 &&
    parcel.receiverName.trim() &&
    parcel.receiverPhone.trim().length >= 10;

  return (
    <Screen title="Parcel details" subtitle="Package information">
      <SectionLabel>Package Info</SectionLabel>
      <div className="mb-4 space-y-3">
        <div className="relative">
          <Package className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={parcel.parcelName}
            onChange={(e) => updateParcel({ parcelName: e.target.value })}
            placeholder="Parcel Name (e.g., Office Docs)"
            className="w-full rounded-2xl border border-gray-200 bg-white py-3 pl-10 pr-4 text-[14px] font-medium outline-none focus:border-[#FF0000]"
          />
        </div>
        <div className="relative">
          <AlignLeft className="absolute left-3 top-4 h-4 w-4 text-gray-400" />
          <textarea
            value={parcel.parcelDescription}
            onChange={(e) => updateParcel({ parcelDescription: e.target.value })}
            placeholder="Description (optional)"
            rows={2}
            className="w-full resize-none rounded-2xl border border-gray-200 bg-white p-3 pl-10 text-[14px] font-medium outline-none focus:border-[#FF0000]"
          />
        </div>
      </div>

      <SectionLabel>Weight & Quantity</SectionLabel>
      <div className="mb-4 space-y-3">
        <div className="relative">
          <Scale className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="number"
            value={parcel.weightKg || ""}
            onChange={(e) => updateParcel({ weightKg: Math.max(0, Number(e.target.value)) })}
            placeholder="Approx Weight (in KG) *"
            className="w-full rounded-2xl border border-gray-200 bg-white py-3 pl-10 pr-4 text-[14px] font-medium outline-none focus:border-[#FF0000]"
          />
        </div>
        <div className="relative">
          <FileText className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="number"
            value={parcel.quantity || ""}
            onChange={(e) => updateParcel({ quantity: Math.max(1, Number(e.target.value)) })}
            placeholder="Number of Packages"
            className="w-full rounded-2xl border border-gray-200 bg-white py-3 pl-10 pr-4 text-[14px] font-medium outline-none focus:border-[#FF0000]"
          />
        </div>
      </div>

      <SectionLabel>Receiver details</SectionLabel>
      <div className="mb-4 space-y-3">
        <div className="relative">
          <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={parcel.receiverName}
            onChange={(e) => updateParcel({ receiverName: e.target.value })}
            placeholder="Receiver name *"
            className="w-full rounded-2xl border border-gray-200 bg-white py-3 pl-10 pr-4 text-[14px] font-medium outline-none focus:border-[#FF0000]"
          />
        </div>
        <div className="relative">
          <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={parcel.receiverPhone}
            onChange={(e) => updateParcel({ receiverPhone: e.target.value.replace(/\D/g, "").slice(0, 10) })}
            placeholder="Receiver mobile number *"
            inputMode="numeric"
            className="w-full rounded-2xl border border-gray-200 bg-white py-3 pl-10 pr-4 text-[14px] font-medium outline-none focus:border-[#FF0000]"
          />
        </div>
        <textarea
          value={parcel.instructions}
          onChange={(e) => updateParcel({ instructions: e.target.value })}
          placeholder="Special Instructions (optional)"
          rows={2}
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
