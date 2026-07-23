import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Phone, MapPin, AlertTriangle } from "lucide-react";
import Screen from "../components/Screen";
import { PrimaryButton } from "../components/ui";
import { getPorterEmergencyPath } from "../utils/routes";
import { SOS_OPTIONS } from "../utils/mock/payments";

export default function SOS() {
  const navigate = useNavigate();
  const [alertSent, setAlertSent] = useState(false);

  const handleAction = (option) => {
    if (option.action === "tel:100" || option.action === "tel:108") {
      window.location.href = option.action;
      return;
    }
    if (option.action === "share" || option.action === "alert") {
      setAlertSent(true);
      return;
    }
    if (option.action === "report") {
      navigate(getPorterEmergencyPath());
    }
  };

  return (
    <Screen title="Safety & SOS" subtitle="Emergency assistance for your shipment">
      <div className="mb-4 flex items-center gap-3 rounded-2xl bg-[#EFF6FF] p-4">
        <Shield className="h-8 w-8 shrink-0 text-[#2563EB]" />
        <div>
          <p className="text-[14px] font-bold text-gray-900">Your safety matters</p>
          <p className="text-[12px] text-gray-600">Use SOS only in genuine emergencies during parcel pickup or delivery.</p>
        </div>
      </div>

      {alertSent && (
        <div className="mb-4 rounded-2xl border border-[#2e7d32]/30 bg-green-50 p-3 text-[13px] font-semibold text-[#2e7d32]">
          Alert sent to your emergency contacts with live location.
        </div>
      )}

      <div className="mb-4 space-y-2">
        {SOS_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => handleAction(opt)}
            className={`flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition ${
              opt.id === "call_police" || opt.id === "call_ambulance"
                ? "border-[#2563EB]/30 bg-[#EFF6FF] hover:bg-[#DBEAFE]"
                : "border-gray-100 bg-white hover:border-gray-200"
            }`}
          >
            <span className="text-2xl">{opt.icon}</span>
            <span className="text-[15px] font-bold text-gray-900">{opt.label}</span>
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => navigate(getPorterEmergencyPath())}
        className="mb-4 flex w-full items-center justify-between rounded-2xl border border-gray-100 bg-white p-4"
      >
        <div className="flex items-center gap-2">
          <Phone className="h-4 w-4 text-[#2563EB]" />
          <span className="text-[14px] font-bold text-gray-900">Manage emergency contacts</span>
        </div>
        <MapPin className="h-4 w-4 text-gray-400" />
      </button>

      <div className="flex items-start gap-2 rounded-2xl bg-amber-50 p-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <p className="text-[11px] text-amber-800">
          Misuse of SOS may result in account suspension. Blaze shares your trip details with authorities when SOS is triggered.
        </p>
      </div>

      <PrimaryButton variant="outline" className="mt-4" onClick={() => navigate(-1)}>
        Back to shipment
      </PrimaryButton>
    </Screen>
  );
}
