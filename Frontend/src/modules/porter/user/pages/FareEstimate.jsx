import React, { useState, useEffect } from "react";
import { userAPI } from "../../../../services/api/index.js";
import { useNavigate } from "react-router-dom";
import { MapPin, Package, Calendar, Tag, CreditCard, ChevronRight, Navigation, FileText, Scale, Check } from "lucide-react";
import Screen from "../components/Screen";
import PorterRouteMap from "../components/PorterRouteMap";
import { PrimaryButton, StickyBar, FareRow, SectionLabel, inr } from "../components/ui";
import { useBooking } from "../context/BookingContext";
import {
  getPorterFindingPartnerPath,
  getPorterPromoPath,
  getPorterPaymentPath,
  getPorterSchedulePath,
} from "../utils/routes";
import { PAYMENT_METHODS } from "../constants/booking";

export default function FareEstimate() {
  const navigate = useNavigate();
  const {
    pickup,
    delivery,
    parcel,
    vehicle,
    coupon,
    paymentMethodId,
    setPaymentMethodId,
    scheduledAt,
    distanceKm,
    durationMin,
    distanceText,
    durationText,
    baseFare,
    discount,
    total,
    routeQuote,
  } = useBooking();

  const [walletBalance, setWalletBalance] = useState(null);

  useEffect(() => {
    userAPI.getWallet()
      .then((res) => {
        const w = res?.data?.data?.wallet || res?.data?.wallet || res?.wallet;
        if (w && w.balance != null) {
          setWalletBalance(w.balance);
        }
      })
      .catch((err) => console.error("Failed to fetch wallet:", err));
  }, []);

  const payment = PAYMENT_METHODS.find((p) => p.id === paymentMethodId);
  const payable = total ?? 0;
  const hasRouteCoordinates = (
    Number.isFinite(Number(pickup?.lat))
    && Number.isFinite(Number(pickup?.lng))
    && Number.isFinite(Number(delivery?.lat))
    && Number.isFinite(Number(delivery?.lng))
  );

  return (
    <Screen title="Review booking" subtitle="Check all details before payment">
      {hasRouteCoordinates && (
        <PorterRouteMap pickup={pickup} delivery={delivery} routeQuote={routeQuote} height={160} className="mb-4" />
      )}

      <div className="mb-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-start gap-2">
          <span className="mt-1 h-3 w-3 shrink-0 rounded-full bg-[#2e7d32]" />
          <div>
            <p className="text-[11px] font-bold uppercase text-gray-400">Pickup</p>
            <p className="text-[13px] font-bold text-gray-900">{pickup?.title || "Pickup"}</p>
            <p className="text-[12px] text-gray-500">{pickup?.address || "—"}</p>
          </div>
        </div>
        <div className="mb-3 ml-1.5 h-4 border-l-2 border-dashed border-gray-200" />
        <div className="flex items-start gap-2">
          <Navigation className="mt-0.5 h-4 w-4 shrink-0 text-[#FF0000]" />
          <div>
            <p className="text-[11px] font-bold uppercase text-gray-400">Delivery</p>
            <p className="text-[13px] font-bold text-gray-900">{delivery?.title}</p>
            <p className="text-[12px] text-gray-500">{delivery?.address}</p>
          </div>
        </div>
      </div>

      <SectionLabel>Parcel Details</SectionLabel>
      <div className="mb-4 rounded-2xl border border-gray-100 bg-white p-4 space-y-3">
        <div className="flex items-center gap-3">
          <FileText className="h-4 w-4 text-[#FF0000]" />
          <div>
            <p className="text-[13px] font-bold text-gray-900">{parcel.parcelName || "N/A"}</p>
            {parcel.parcelDescription && <p className="text-[12px] text-gray-500">{parcel.parcelDescription}</p>}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Scale className="h-4 w-4 text-[#FF0000]" />
          <p className="text-[13px] font-medium text-gray-900">{parcel.weightKg * parcel.quantity} kg (Total Weight)</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-lg">{vehicle?.icon}</span>
          <p className="text-[13px] font-medium text-gray-900">{vehicle?.name}</p>
        </div>
        {parcel.receiverName && (
          <div className="border-t border-gray-100 pt-2 mt-2">
            <p className="text-[12px] text-gray-600">
              Receiver: <span className="font-bold text-gray-900">{parcel.receiverName}</span> · {parcel.receiverPhone}
            </p>
          </div>
        )}
      </div>

      <div className="mb-4 space-y-2">
        <button
          type="button"
          onClick={() => navigate(getPorterSchedulePath())}
          className="flex w-full items-center justify-between rounded-2xl border border-gray-100 bg-white p-3 shadow-sm"
        >
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-[#FF0000]" />
            <span className="text-[14px] font-bold text-gray-900">
              {parcel.isScheduled && scheduledAt ? `Scheduled: ${new Date(scheduledAt).toLocaleString()}` : "Schedule Delivery"}
            </span>
          </div>
          <ChevronRight className="h-4 w-4 text-gray-400" />
        </button>
        <button
          type="button"
          onClick={() => navigate(getPorterPromoPath())}
          className="flex w-full items-center justify-between rounded-2xl border border-gray-100 bg-white p-3 shadow-sm"
        >
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-[#FF0000]" />
            <span className="text-[14px] font-bold text-gray-900">
              {coupon ? coupon.code : "Apply Promo Code"}
            </span>
          </div>
          <ChevronRight className="h-4 w-4 text-gray-400" />
        </button>
      </div>

      <SectionLabel>Payment Method</SectionLabel>
      <div className="mb-4 space-y-2">
        {PAYMENT_METHODS.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setPaymentMethodId(m.id)}
            className={`flex w-full items-center justify-between rounded-2xl border p-3 transition ${
              paymentMethodId === m.id
                ? "border-[#FF0000] bg-[#FFF1F1]"
                : "border-gray-100 bg-white"
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">{m.icon}</span>
              <div className="text-left">
                <div className="flex items-center gap-2">
                  <p className="text-[14px] font-bold text-gray-900">{m.label}</p>
                  {m.recommended && (
                    <span className="rounded-full bg-[#FF0000] px-2 py-0.5 text-[9px] font-bold text-white">Recommended</span>
                  )}
                </div>
                <p className="text-[11px] text-gray-500">
                  {m.id === "wallet" && walletBalance != null 
                    ? `Balance: ₹${walletBalance}` 
                    : m.subtitle}
                </p>
              </div>
            </div>
            {paymentMethodId === m.id && (
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#FF0000] text-white">
                <Check className="h-3 w-3" />
              </div>
            )}
          </button>
        ))}
      </div>

      <SectionLabel>Estimated Fare</SectionLabel>
      <div className="mb-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <FareRow label="Base delivery fare" value={inr(baseFare ?? 0)} />
        {(distanceText || distanceKm != null) && (
          <FareRow label="Distance" value={distanceText || `${distanceKm} km`} />
        )}
        {(durationText || durationMin != null) && (
          <FareRow label="ETA" value={durationText || `${durationMin} min`} />
        )}
        {discount > 0 && <FareRow label="Promo discount" value={`−${inr(discount)}`} accent />}
        <div className="my-2 border-t border-gray-100" />
        <FareRow label="Total Payable" value={inr(payable)} strong />
      </div>

      <StickyBar>
        <PrimaryButton onClick={() => navigate(getPorterFindingPartnerPath())}>
          Book Parcel
        </PrimaryButton>
      </StickyBar>
    </Screen>
  );
}
