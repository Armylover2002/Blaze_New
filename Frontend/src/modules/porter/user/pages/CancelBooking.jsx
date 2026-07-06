import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import Screen from "../components/Screen";
import { PrimaryButton, StickyBar } from "../components/ui";
import { useBooking } from "../context/BookingContext";
import { CANCEL_REASONS } from "../constants/booking";
import porterUserApi from "../services/userApi";

export default function CancelBooking() {
  const navigate = useNavigate();
  const { resetBooking, activeShipment } = useBooking();
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const cancel = async () => {
    const orderId = activeShipment?.id;
    if (!orderId) {
      toast.error("No active order to cancel");
      return;
    }
    setSubmitting(true);
    try {
      await porterUserApi.cancelOrder(orderId, reason);
      setConfirmed(true);
      resetBooking();
      setTimeout(() => navigate("/porter", { replace: true }), 1500);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to cancel order");
    } finally {
      setSubmitting(false);
    }
  };

  if (confirmed) {
    return (
      <Screen title="Booking cancelled">
        <div className="flex flex-col items-center py-12 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
            <AlertCircle className="h-8 w-8 text-gray-500" />
          </div>
          <h2 className="text-[18px] font-extrabold text-gray-900">Shipment cancelled</h2>
          <p className="mt-2 text-[13px] text-gray-500">Refund will be credited to your wallet if payment was made.</p>
        </div>
      </Screen>
    );
  }

  return (
    <Screen title="Cancel booking" subtitle={activeShipment?.trackingId || activeShipment?.orderNumber || "Active shipment"}>
      <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <p className="text-[13px] font-semibold text-amber-800">
          Cancelling after a partner is assigned may incur a small cancellation fee on future bookings.
        </p>
      </div>

      <p className="mb-3 text-[12px] font-bold uppercase tracking-wider text-gray-400">Reason for cancellation</p>
      <div className="space-y-2">
        {CANCEL_REASONS.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setReason(r)}
            className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left text-[14px] font-medium transition ${
              reason === r ? "border-[#FF0000] bg-[#FFF1F1] font-bold" : "border-gray-100 bg-white"
            }`}
          >
            <span className={`h-4 w-4 shrink-0 rounded-full border-2 ${reason === r ? "border-[#FF0000] bg-[#FF0000]" : "border-gray-300"}`} />
            {r}
          </button>
        ))}
      </div>

      <StickyBar>
        <div className="flex gap-2">
          <PrimaryButton variant="outline" className="flex-1" onClick={() => navigate(-1)} disabled={submitting}>
            Keep booking
          </PrimaryButton>
          <PrimaryButton className="flex-1" disabled={!reason || submitting} onClick={cancel}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cancel shipment"}
          </PrimaryButton>
        </div>
      </StickyBar>
    </Screen>
  );
}
