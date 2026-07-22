import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, X } from "lucide-react";
import Screen from "../components/Screen";
import BottomSheet from "../components/BottomSheet";
import { PrimaryButton, inr } from "../components/ui";
import { useBooking } from "../context/BookingContext";
import { usePorterHomeData } from "../hooks/usePorterHomeData";

export default function PromoCode() {
  const navigate = useNavigate();
  const { coupon, setCoupon, applyCoupon, baseFare, discount } = useBooking();
  const { coupons } = usePorterHomeData();
  const [error, setError] = useState("");
  const [selectedCoupon, setSelectedCoupon] = useState(null);
  const [applying, setApplying] = useState(false);

  const getDiscountText = React.useCallback((c) => {
    const type = (c?.discountType || '').toLowerCase();
    const value = c?.discountValue || 0;
    if (type === 'percentage') return `${value}% OFF`;
    if (type === 'flat') return `FLAT ₹${value} OFF`;
    return '';
  }, []);

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

    setApplying(true);
    setError("");
    try {
      await applyCoupon(c);
      setSelectedCoupon(null);
      navigate(-1);
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || "Could not apply this coupon";
      setError(message);
    } finally {
      setApplying(false);
    }
  };

  const removeCoupon = () => {
    setCoupon(null);
    setError("");
  };

  return (
    <Screen title="Promo codes" subtitle="Save on your parcel delivery">
      {error && <p className="mb-3 text-[12px] font-semibold text-[#2563EB]">{error}</p>}

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

      <div className="space-y-3 mt-2">
        {coupons.map((c) => (
          <button
            key={c.code}
            type="button"
            onClick={() => setSelectedCoupon(c)}
            className={`flex w-full items-center gap-4 rounded-2xl border border-dashed p-4 text-left shadow-sm transition ${
              coupon?.code === c.code ? "border-[#2563EB] bg-[#EFF6FF]" : "border-gray-200 bg-white hover:border-[#2563EB]/50"
            }`}
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#2563EB]/10 text-2xl drop-shadow-sm">
              🎉
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-bold text-gray-900 uppercase tracking-tight">{c.code}</p>
              {c.name && <p className="text-[12px] font-medium text-gray-600 mt-0.5">{c.name}</p>}
              <p className="mt-1 text-[11px] font-bold text-[#2563EB]">
                {getDiscountSubtext(c)}
              </p>
            </div>
          </button>
        ))}
      </div>

      <BottomSheet
        open={!!selectedCoupon}
        onClose={() => !applying && setSelectedCoupon(null)}
        title="Coupon Details"
      >
        {selectedCoupon && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-dashed border-[#2563EB]/30 bg-[#EFF6FF] p-5 text-center relative overflow-hidden">
              <div className="absolute top-1/2 -left-3 h-6 w-6 -translate-y-1/2 rounded-full bg-white"></div>
              <div className="absolute top-1/2 -right-3 h-6 w-6 -translate-y-1/2 rounded-full bg-white"></div>
              <div className="text-3xl mb-2">🎉</div>
              <h3 className="text-xl font-black text-gray-900 uppercase tracking-widest">{selectedCoupon.code}</h3>
              <p className="text-[14px] font-bold text-[#2563EB] mt-1">
                {getDiscountText(selectedCoupon)}
              </p>
            </div>
            <div className="rounded-2xl bg-gray-50 p-4 space-y-3">
              {selectedCoupon.name && (
                <div>
                  <p className="text-[12px] font-bold text-gray-500 uppercase tracking-wider mb-1">Offer Title</p>
                  <p className="text-[14px] font-medium text-gray-900">{selectedCoupon.name}</p>
                </div>
              )}
              {selectedCoupon.description && (
                <div>
                  <p className="text-[12px] font-bold text-gray-500 uppercase tracking-wider mb-1">Description</p>
                  <p className="text-[14px] font-medium text-gray-900">{selectedCoupon.description}</p>
                </div>
              )}
              {selectedCoupon.applicableVehicles && selectedCoupon.applicableVehicles.length > 0 && (
                <div>
                  <p className="text-[12px] font-bold text-gray-500 uppercase tracking-wider mb-1">Valid On</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {selectedCoupon.applicableVehicles.map(v => (
                      <span key={v} className="inline-block px-2 py-0.5 text-[11px] font-bold text-gray-700 bg-gray-200 rounded-md border border-gray-300">{v}</span>
                    ))}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                {Number(selectedCoupon.minOrderValue) > 0 && (
                  <div>
                    <p className="text-[12px] font-bold text-gray-500 uppercase tracking-wider mb-1">Min Order</p>
                    <p className="text-[14px] font-medium text-gray-900">{inr(selectedCoupon.minOrderValue)}</p>
                  </div>
                )}
                {String(selectedCoupon.discountType).toLowerCase() === 'percentage' && Number(selectedCoupon.maxDiscount) > 0 && (
                  <div>
                    <p className="text-[12px] font-bold text-gray-500 uppercase tracking-wider mb-1">Max Discount</p>
                    <p className="text-[14px] font-medium text-gray-900">{inr(selectedCoupon.maxDiscount)}</p>
                  </div>
                )}
                {selectedCoupon.perUserLimit > 1 && (
                  <div>
                    <p className="text-[12px] font-bold text-gray-500 uppercase tracking-wider mb-1">Usage Limit</p>
                    <p className="text-[14px] font-medium text-gray-900">{selectedCoupon.perUserLimit} per user</p>
                  </div>
                )}
                {selectedCoupon.validFrom && (
                  <div>
                    <p className="text-[12px] font-bold text-gray-500 uppercase tracking-wider mb-1">Valid From</p>
                    <p className="text-[14px] font-medium text-gray-900">{new Date(selectedCoupon.validFrom).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                  </div>
                )}
              </div>

              {(selectedCoupon.firstOrderOnly || selectedCoupon.newCustomerOnly || selectedCoupon.autoApply) && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {selectedCoupon.firstOrderOnly && (
                    <span className="inline-block px-2 py-1 text-[11px] font-bold text-[#2e7d32] bg-green-50 rounded-md border border-[#2e7d32]/20">First Order Only</span>
                  )}
                  {selectedCoupon.newCustomerOnly && (
                    <span className="inline-block px-2 py-1 text-[11px] font-bold text-[#2e7d32] bg-green-50 rounded-md border border-[#2e7d32]/20">New Customer Only</span>
                  )}
                  {selectedCoupon.autoApply && (
                    <span className="inline-block px-2 py-1 text-[11px] font-bold text-[#1976d2] bg-blue-50 rounded-md border border-[#1976d2]/20">Auto Apply</span>
                  )}
                </div>
              )}

              {selectedCoupon.validUntil && (
                <div className="pt-2 border-t border-dashed border-gray-200 mt-2">
                  <p className="text-[12px] font-bold text-gray-500 uppercase tracking-wider mb-1">Expires On</p>
                  <p className="text-[14px] font-medium text-gray-900">{new Date(selectedCoupon.validUntil).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              )}
            </div>
            
            <div className="mt-4 pt-2">
               <PrimaryButton 
                  onClick={() => applyCode(selectedCoupon)}
                  disabled={applying}
                  className="w-full"
               >
                  {applying ? "Applying..." : "Apply Coupon"}
               </PrimaryButton>
            </div>
          </div>
        )}
      </BottomSheet>

    </Screen>
  );
}
