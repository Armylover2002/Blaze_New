import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Tag, Check, X } from "lucide-react";
import Screen from "../components/Screen";
import { PrimaryButton, StickyBar, inr } from "../components/ui";
import { useBooking } from "../context/BookingContext";
import { DELIVERY_COUPONS } from "../utils/mock/coupons";

export default function PromoCode() {
  const navigate = useNavigate();
  const { coupon, setCoupon, baseFare, discount, total } = useBooking();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  const applyCode = (c) => {
    if (baseFare < c.minOrderValue) {
      setError(`Minimum order value is ${inr(c.minOrderValue)}`);
      return;
    }
    setCoupon(c);
    setError("");
    setCode(c.code);
  };

  const applyManual = () => {
    const found = DELIVERY_COUPONS.find((c) => c.code.toLowerCase() === code.trim().toLowerCase());
    if (!found) {
      setError("Invalid promo code");
      return;
    }
    applyCode(found);
  };

  const removeCoupon = () => {
    setCoupon(null);
    setCode("");
    setError("");
  };

  return (
    <Screen title="Promo codes" subtitle="Save on your parcel delivery">
      <div className="mb-4 flex gap-2">
        <div className="relative flex-1">
          <Tag className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={code}
            onChange={(e) => { setCode(e.target.value.toUpperCase()); setError(""); }}
            placeholder="Enter promo code"
            className="w-full rounded-2xl border border-gray-200 bg-white py-3 pl-10 pr-4 text-[14px] font-bold uppercase outline-none focus:border-[#FF0000]"
          />
        </div>
        <PrimaryButton className="w-auto shrink-0 px-6" onClick={applyManual}>
          Apply
        </PrimaryButton>
      </div>

      {error && <p className="mb-3 text-[12px] font-semibold text-[#FF0000]">{error}</p>}

      {coupon && (
        <div className="mb-4 flex items-center justify-between rounded-2xl border border-[#2e7d32]/30 bg-green-50 p-3">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-[#2e7d32]" />
            <span className="text-[13px] font-bold text-[#2e7d32]">{coupon.code} applied · Save {inr(discount)}</span>
          </div>
          <button type="button" onClick={removeCoupon} className="text-gray-500">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="space-y-2">
        {DELIVERY_COUPONS.map((c) => (
          <button
            key={c.code}
            type="button"
            onClick={() => applyCode(c)}
            className={`flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition ${
              coupon?.code === c.code ? "border-[#FF0000] bg-[#FFF1F1]" : "border-gray-100 bg-white hover:border-gray-200"
            }`}
          >
            <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-[#FFF1F1] text-[#FF0000]">
              <span className="text-[10px] font-bold">{c.badge}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-bold text-gray-900">{c.title}</p>
              <p className="text-[12px] text-gray-500">{c.description}</p>
              <p className="mt-0.5 text-[11px] font-bold text-[#FF0000]">Code: {c.code}</p>
            </div>
          </button>
        ))}
      </div>

      <StickyBar>
        <PrimaryButton onClick={() => navigate(-1)}>
          {coupon ? `Continue · ${inr(total)} total` : "Continue without promo"}
        </PrimaryButton>
      </StickyBar>
    </Screen>
  );
}
