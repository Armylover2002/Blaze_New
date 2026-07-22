import React, { useState } from "react";
import { Check, X } from "lucide-react";
import BottomSheet from "./BottomSheet";
import { PrimaryButton, inr } from "./ui";
import { formatApplicableVehicleEntry } from "../utils/couponCalculations";
import { useBooking } from "../context/BookingContext";
import { usePorterHomeData } from "../hooks/usePorterHomeData";

export default function CouponBottomSheet({ open, onClose }) {
  const { coupon, setCoupon, applyCoupon, baseFare, discount } = useBooking();
  const { coupons } = usePorterHomeData();
  const [error, setError] = useState("");
  const [applyingCode, setApplyingCode] = useState(null);

  const getDiscountSubtext = React.useCallback((c) => {
    const type = (c?.discountType || '').toLowerCase();
    const value = c?.discountValue || 0;
    if (type === 'percentage') return `Get ${value}% off`;
    if (type === 'flat') return `Flat ₹${value} off`;
    return '';
  }, []);

  const applyCode = async (c) => {
    if (baseFare != null && baseFare < c.minOrderValue) {
      setError(`Minimum order value is ${inr(c.minOrderValue)}`);
      return;
    }

    setApplyingCode(c.code);
    setError("");
    try {
      await applyCoupon(c);
      onClose();
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || "Could not apply this coupon";
      setError(message);
    } finally {
      setApplyingCode(null);
    }
  };

  const removeCoupon = () => {
    setCoupon(null);
    setError("");
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Promo codes" subtitle="Save on your parcel delivery">
      <div className="max-h-[60vh] overflow-y-auto pr-1">
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

        <div className="space-y-3 mt-2 pb-6">
          {coupons.map((c) => (
            <div
              key={c.code}
              className={`flex w-full flex-col gap-2 rounded-2xl border border-dashed p-4 text-left shadow-sm transition ${
                coupon?.code === c.code ? "border-[#FF0000] bg-[#FFF1F1]" : "border-gray-200 bg-white"
              }`}
            >
              <div className="flex items-center gap-4 w-full">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#FF0000]/10 text-2xl drop-shadow-sm">
                  🎉
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-bold text-gray-900 uppercase tracking-tight">{c.code}</p>
                  {c.name && <p className="text-[12px] font-medium text-gray-600 mt-0.5">{c.name}</p>}
                  <p className="mt-1 text-[11px] font-bold text-[#FF0000]">
                    {getDiscountSubtext(c)}
                  </p>
                </div>
                {coupon?.code !== c.code && (
                  <button
                    type="button"
                    onClick={() => applyCode(c)}
                    disabled={applyingCode === c.code}
                    className="shrink-0 rounded-full bg-[#FF0000] px-4 py-1.5 text-[12px] font-bold text-white shadow-sm disabled:opacity-50"
                  >
                    {applyingCode === c.code ? "Applying..." : "Apply"}
                  </button>
                )}
              </div>
              {c.minOrderValue > 0 && (
                <p className="text-[10px] text-gray-400 font-medium ml-16 -mt-2">
                  Min order: {inr(c.minOrderValue)}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </BottomSheet>
  );
}
