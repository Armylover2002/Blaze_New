import React from "react";
import { useNavigate } from "react-router-dom";
import { Check } from "lucide-react";
import Screen from "../components/Screen";
import { PrimaryButton, StickyBar } from "../components/ui";
import { useBooking } from "../context/BookingContext";
import { PAYMENT_METHODS } from "../constants/booking";

export default function PaymentSelection() {
  const navigate = useNavigate();
  const { paymentMethodId, setPaymentMethodId } = useBooking();

  return (
    <Screen title="Payment method" subtitle="How would you like to pay?">
      <div className="space-y-2">
        {PAYMENT_METHODS.map((m) => {
          const selected = paymentMethodId === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => setPaymentMethodId(m.id)}
              className={`flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition ${
                selected
                  ? "border-[#FF0000] bg-[#FFF1F1] shadow-[0_8px_24px_rgba(255,0,0,0.10)]"
                  : "border-gray-100 bg-white hover:border-gray-200"
              }`}
            >
              <span className="text-2xl">{m.icon}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-[15px] font-bold text-gray-900">{m.label}</p>
                  {m.recommended && (
                    <span className="rounded-full bg-[#FF0000] px-2 py-0.5 text-[9px] font-bold text-white">Recommended</span>
                  )}
                </div>
                <p className="text-[12px] text-gray-500">{m.subtitle}</p>
              </div>
              {selected && (
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#FF0000] text-white">
                  <Check className="h-3.5 w-3.5" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      <p className="mt-4 text-[11px] text-gray-400">
        Payment is collected at booking confirmation. Cash on delivery is charged at pickup handover.
      </p>

      <StickyBar>
        <PrimaryButton onClick={() => navigate(-1)}>Confirm payment method</PrimaryButton>
      </StickyBar>
    </Screen>
  );
}
