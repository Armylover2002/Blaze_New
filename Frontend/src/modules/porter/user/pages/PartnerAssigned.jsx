import React from "react";
import { useNavigate } from "react-router-dom";
import { Phone, Star, Copy, Navigation, Shield } from "lucide-react";
import Screen from "../components/Screen";
import MapPreview from "../components/MapPreview";
import { PrimaryButton, StickyBar, inr } from "../components/ui";
import { useBooking } from "../context/BookingContext";
import { getPorterTrackingPath, getPorterCancelPath, getPorterSosPath } from "../utils/routes";

export default function PartnerAssigned() {
  const navigate = useNavigate();
  const { activeShipment, total } = useBooking();
  const partner = activeShipment?.partner;

  if (!partner) {
    return (
      <Screen title="Partner assigned">
        <p className="text-[14px] text-gray-500">No active shipment. Start a new parcel booking.</p>
        <PrimaryButton className="mt-4" onClick={() => navigate("/porter")}>
          Send a parcel
        </PrimaryButton>
      </Screen>
    );
  }

  const copyOtp = () => {
    navigator.clipboard?.writeText(partner.pickupOtp);
  };

  return (
    <Screen
      title="Partner assigned"
      subtitle="Share pickup OTP when partner arrives"
      right={
        <button type="button" onClick={() => navigate(getPorterSosPath())} className="text-[12px] font-bold text-[#FF0000]">
          SOS
        </button>
      }
    >
      <MapPreview height={180} showRoute animateCar className="mb-4" />

      <div className="mb-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#FFF1F1] text-[20px] font-bold text-[#FF0000]">
            {partner.name.charAt(0)}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-[16px] font-extrabold text-gray-900">{partner.name}</h2>
            <div className="flex items-center gap-1 text-[12px] text-gray-500">
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
              <span className="font-bold">{partner.rating}</span>
              <span>· {partner.trips} deliveries</span>
            </div>
            <p className="text-[12px] text-gray-600">{partner.vehicle} · {partner.vehicleNumber}</p>
          </div>
          <a href={`tel:${partner.phone.replace(/\s/g, "")}`} className="flex h-10 w-10 items-center justify-center rounded-full bg-[#2e7d32] text-white">
            <Phone className="h-4 w-4" />
          </a>
        </div>
      </div>

      <div className="mb-4 rounded-2xl border-2 border-dashed border-[#FF0000]/30 bg-[#FFF1F1] p-4 text-center">
        <p className="text-[11px] font-bold uppercase tracking-wider text-[#FF0000]">Pickup OTP</p>
        <div className="mt-1 flex items-center justify-center gap-2">
          <span className="text-[32px] font-extrabold tracking-[0.3em] text-gray-900">{partner.pickupOtp}</span>
          <button type="button" onClick={copyOtp} className="flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-sm">
            <Copy className="h-4 w-4 text-gray-600" />
          </button>
        </div>
        <p className="mt-1 text-[11px] text-gray-600">Share this OTP only when handing over the parcel</p>
      </div>

      <div className="mb-4 flex items-center gap-2 rounded-2xl bg-white p-3 shadow-sm">
        <Shield className="h-4 w-4 text-[#2e7d32]" />
        <p className="text-[12px] text-gray-600">Parcel insured up to ₹5,000 · Live tracking enabled</p>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-4">
        <div className="flex items-center justify-between">
          <span className="text-[13px] text-gray-500">Delivery fare</span>
          <span className="text-[16px] font-extrabold text-gray-900">{inr(total + 12)}</span>
        </div>
        <p className="mt-1 text-[11px] text-gray-400">Partner arriving in ~{12} min</p>
      </div>

      <StickyBar>
        <div className="flex gap-2">
          <PrimaryButton variant="outline" className="flex-1" onClick={() => navigate(getPorterCancelPath())}>
            Cancel
          </PrimaryButton>
          <PrimaryButton className="flex-[2]" onClick={() => navigate(getPorterTrackingPath())}>
            <Navigation className="h-4 w-4" />
            Track parcel
          </PrimaryButton>
        </div>
      </StickyBar>
    </Screen>
  );
}
