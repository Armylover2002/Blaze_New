import React from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, Package, Calendar, Tag, CreditCard, ChevronRight } from "lucide-react";
import Screen from "../components/Screen";
import { PrimaryButton, StickyBar, FareRow, SectionLabel, inr } from "../components/ui";
import { useBooking } from "../context/BookingContext";
import {
  getPorterFindingPartnerPath,
  getPorterPromoPath,
  getPorterPaymentPath,
  getPorterSchedulePath,
} from "../utils/routes";
import { PAYMENT_METHODS } from "../utils/mock/payments";

export default function FareEstimate() {
  const navigate = useNavigate();
  const {
    pickup,
    delivery,
    parcel,
    vehicle,
    coupon,
    paymentMethodId,
    scheduledAt,
    distanceKm,
    durationMin,
    baseFare,
    discount,
    total,
  } = useBooking();

  const payment = PAYMENT_METHODS.find((p) => p.id === paymentMethodId);
  const platformFee = 12;
  const payable = total + platformFee;

  return (
    <Screen title="Confirm booking" subtitle="Review delivery details & fare">
      <div className="mb-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-start gap-2">
          <span className="mt-1 h-3 w-3 shrink-0 rounded-full bg-[#2e7d32]" />
          <div>
            <p className="text-[11px] font-bold uppercase text-gray-400">Pickup</p>
            <p className="text-[13px] font-bold text-gray-900">{pickup.title}</p>
            <p className="text-[12px] text-gray-500">{pickup.address}</p>
          </div>
        </div>
        <div className="mb-3 ml-1.5 h-4 border-l-2 border-dashed border-gray-200" />
        <div className="flex items-start gap-2">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#FF0000]" />
          <div>
            <p className="text-[11px] font-bold uppercase text-gray-400">Delivery</p>
            <p className="text-[13px] font-bold text-gray-900">{delivery?.title}</p>
            <p className="text-[12px] text-gray-500">{delivery?.address}</p>
          </div>
        </div>
      </div>

      <SectionLabel>Parcel summary</SectionLabel>
      <div className="mb-4 rounded-2xl border border-gray-100 bg-white p-4">
        <div className="flex items-center gap-2 text-[13px]">
          <Package className="h-4 w-4 text-[#FF0000]" />
          <span className="font-bold text-gray-900">Parcel</span>
          <span className="text-gray-400">·</span>
          <span className="text-gray-600">{parcel.weightKg} kg × {parcel.quantity}</span>
        </div>
        <p className="mt-1 text-[12px] text-gray-500">
          {vehicle?.name} · {distanceKm} km · ~{durationMin} min
        </p>
        {parcel.receiverName && (
          <p className="mt-2 text-[12px] text-gray-600">
            Receiver: {parcel.receiverName} · {parcel.receiverPhone}
          </p>
        )}
      </div>

      <SectionLabel>Fare breakdown</SectionLabel>
      <div className="mb-4 rounded-2xl border border-gray-100 bg-white p-4">
        <FareRow label="Base delivery fare" value={inr(baseFare)} />
        <FareRow label="Handling & platform fee" value={inr(platformFee)} />
        {discount > 0 && <FareRow label="Promo discount" value={`−${inr(discount)}`} accent />}
        <div className="my-2 border-t border-gray-100" />
        <FareRow label="Total payable" value={inr(payable)} strong />
      </div>

      <div className="mb-4 space-y-2">
        <button
          type="button"
          onClick={() => navigate(getPorterPromoPath())}
          className="flex w-full items-center justify-between rounded-2xl border border-gray-100 bg-white p-3"
        >
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-[#FF0000]" />
            <span className="text-[14px] font-bold text-gray-900">
              {coupon ? coupon.code : "Apply promo code"}
            </span>
          </div>
          <ChevronRight className="h-4 w-4 text-gray-400" />
        </button>
        <button
          type="button"
          onClick={() => navigate(getPorterPaymentPath())}
          className="flex w-full items-center justify-between rounded-2xl border border-gray-100 bg-white p-3"
        >
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-[#FF0000]" />
            <span className="text-[14px] font-bold text-gray-900">{payment?.label || "Payment method"}</span>
          </div>
          <ChevronRight className="h-4 w-4 text-gray-400" />
        </button>
        <button
          type="button"
          onClick={() => navigate(getPorterSchedulePath())}
          className="flex w-full items-center justify-between rounded-2xl border border-gray-100 bg-white p-3"
        >
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-[#FF0000]" />
            <span className="text-[14px] font-bold text-gray-900">
              {scheduledAt ? new Date(scheduledAt).toLocaleString() : "Schedule pickup (optional)"}
            </span>
          </div>
          <ChevronRight className="h-4 w-4 text-gray-400" />
        </button>
      </div>

      <StickyBar>
        <PrimaryButton onClick={() => navigate(getPorterFindingPartnerPath())}>
          Confirm & find delivery partner
        </PrimaryButton>
      </StickyBar>
    </Screen>
  );
}
