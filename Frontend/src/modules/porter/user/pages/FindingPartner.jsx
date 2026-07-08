import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Package, Search, X } from "lucide-react";
import { toast } from "sonner";
import Screen from "../components/Screen";
import MapPreview from "../components/MapPreview";
import { useBooking } from "../context/BookingContext";
import { getPorterHomePath, getPorterPartnerAssignedPath } from "../utils/routes";
import porterUserApi from "../services/userApi";
import { toCoordinatePayload } from "../utils/location";
import { mapActiveShipmentFromOrder, resolveActiveRouteForStatus } from "../utils/orderMapper";
import {
  initRazorpayPayment,
  isFlutterWebView,
  handleFlutterRazorpayPayment,
} from "@food/utils/razorpay";

// Statuses where the customer is still waiting for a partner — cancel is allowed.
// NOTE: `scheduled` uses /porter/scheduled — do NOT treat it as searching here.
const SEARCHING_STATUSES = ["created", "searching_partner", "dispatching"];
// Once a partner accepts, the customer is routed to the Partner Assigned screen.
const ACCEPTED_STATUSES = ["assigned", "partner_accepted", "en_route_pickup", "at_pickup"];
const POST_PICKUP_STATUSES = ["picked_up", "in_transit", "at_drop", "delivered", "completed"];
const CANCELLED_STATUSES = ["cancelled_by_user", "cancelled_by_admin", "cancelled_by_driver", "failed"];

export default function FindingPartner() {
  const navigate = useNavigate();
  const {
    setActiveShipment,
    clearBookingDraft,
    resetBooking,
    activeShipment,
    activeOrderEvent,
    pickup,
    delivery,
    vehicle,
    total,
    parcel,
    resolvedVehicleId,
    coupon,
    paymentMethodId,
    scheduledAt,
  } = useBooking();
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const userCancelRef = useRef(false);

  const orderId = activeShipment?.id || null;
  const status = String(activeShipment?.status || "").toLowerCase();
  const canCancel = useMemo(
    () => Boolean(orderId) && SEARCHING_STATUSES.includes(status),
    [orderId, status],
  );

  useEffect(() => {
    let pollTimer;
    let cancelled = false;

    const pollStatus = async () => {
      if (cancelled) return;
      try {
        const active = await porterUserApi.getActiveOrder({ forceRefresh: true });
        const current = active?.order ?? active;
        if (!current) return;

        const mapped = mapActiveShipmentFromOrder(current);
        if (!mapped) return;

        setActiveShipment(mapped);

        if (["assigned", "partner_accepted", "en_route_pickup", "at_pickup"].includes(current.status)) {
          navigate(getPorterPartnerAssignedPath(), { replace: true });
          return;
        }

        if (["picked_up", "in_transit", "at_drop", "delivered"].includes(current.status)) {
          navigate(resolveActiveRouteForStatus(current.status), { replace: true });
          return;
        }

        pollTimer = setTimeout(pollStatus, 2500);
      } catch {
        pollTimer = setTimeout(pollStatus, 3000);
      }
    };

    pollStatus();

    return () => {
      cancelled = true;
      if (pollTimer) clearTimeout(pollTimer);
    };
  }, [
    navigate,
    setActiveShipment,
    clearBookingDraft,
    pickup,
    delivery,
    vehicle,
    total,
    parcel,
    resolvedVehicleId,
    coupon,
    paymentMethodId,
    scheduledAt,
  ]);

  // Real-time forward transitions: as soon as the order advances (socket or
  // poll updates activeShipment.status), route the customer to the right screen
  // and make the cancel affordance disappear.
  useEffect(() => {
    if (userCancelRef.current) return undefined;
    if (!status) return undefined;
    if (status === "scheduled") {
      navigate("/porter/scheduled", { replace: true });
    } else if (ACCEPTED_STATUSES.includes(status)) {
      setConfirmOpen(false);
      navigate(getPorterPartnerAssignedPath(), { replace: true });
    } else if (POST_PICKUP_STATUSES.includes(status)) {
      setConfirmOpen(false);
      navigate(resolveActiveRouteForStatus(status), { replace: true });
    }
    return undefined;
  }, [status, navigate]);

  // Handle admin cancellation (and any externally-triggered cancel) delivered
  // over the socket. Terminal orders don't refresh into activeShipment, so we
  // react to the raw socket event instead.
  useEffect(() => {
    if (!activeOrderEvent || userCancelRef.current) return undefined;
    const evtOrderId = activeOrderEvent.orderId;
    if (orderId && evtOrderId && String(evtOrderId) !== String(orderId)) return undefined;
    const evtStatus = String(activeOrderEvent.status || "").toLowerCase();
    const isCancelled = activeOrderEvent.cancelled === true || CANCELLED_STATUSES.includes(evtStatus);
    if (!isCancelled) return undefined;

    setConfirmOpen(false);
    const message = evtStatus === "cancelled_by_admin"
      ? "This booking was cancelled by support."
      : evtStatus === "cancelled_by_driver"
        ? "This booking was cancelled by the delivery partner."
        : "This booking was cancelled.";
    toast.error(message);
    resetBooking();
    navigate(getPorterHomePath(), { replace: true });
    return undefined;
  }, [activeOrderEvent, orderId, navigate, resetBooking]);

  const handleConfirmCancel = async () => {
    if (cancelling) return;

    const currentStatus = String(activeShipment?.status || "").toLowerCase();
    // A partner may have accepted while the confirmation sheet was open.
    if (!SEARCHING_STATUSES.includes(currentStatus)) {
      setConfirmOpen(false);
      if (ACCEPTED_STATUSES.includes(currentStatus)) {
        toast.error("Your delivery partner has already accepted the order. Booking can no longer be cancelled.");
        navigate(getPorterPartnerAssignedPath(), { replace: true });
      } else if (POST_PICKUP_STATUSES.includes(currentStatus)) {
        navigate(resolveActiveRouteForStatus(currentStatus), { replace: true });
      }
      return;
    }

    if (!orderId) {
      setConfirmOpen(false);
      return;
    }

    setCancelling(true);
    userCancelRef.current = true;
    try {
      await porterUserApi.cancelOrder(orderId, "Cancelled by customer while searching for a partner");
      setConfirmOpen(false);
      resetBooking();
      toast.success("Booking cancelled. Any eligible refund has been initiated.");
      navigate(getPorterHomePath(), { replace: true });
    } catch (err) {
      userCancelRef.current = false;
      const message = String(err?.response?.data?.message || err?.message || "");
      const lower = message.toLowerCase();
      if (lower.includes("cannot be cancelled") || lower.includes("after pickup") || lower.includes("already")) {
        // Lost the race — a partner accepted just before the request landed.
        setConfirmOpen(false);
        toast.error("Your delivery partner has already accepted the order. Booking can no longer be cancelled.");
        navigate(getPorterPartnerAssignedPath(), { replace: true });
      } else {
        toast.error(message || "Failed to cancel booking");
      }
    } finally {
      setCancelling(false);
    }
  };

  return (
    <Screen title="Finding partner" subtitle="Matching you with a nearby delivery partner" bare>
      <div className="relative">
        <MapPreview height="calc(100vh - 120px)" showRoute animateCar rounded="rounded-none" />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-white via-white/95 to-transparent px-4 pb-10 pt-16">
          <motion.div
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#FFF1F1]"
          >
            <Search className="h-7 w-7 text-[#FF0000]" />
          </motion.div>
          <h2 className="text-center text-[18px] font-extrabold text-gray-900">
            {submitting ? "Confirming your booking…" : "Searching for delivery partner"}
          </h2>
          <p className="mt-1 text-center text-[13px] text-gray-500">
            Finding the best partner for your {vehicle?.name || "delivery"} shipment
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="h-2 w-2 rounded-full bg-[#FF0000]"
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
              />
            ))}
          </div>
          <div className="mt-6 flex items-center justify-center gap-2 rounded-2xl bg-gray-50 p-3">
            <Package className="h-4 w-4 text-[#FF0000]" />
            <span className="text-[12px] font-semibold text-gray-600">Your parcel details are shared securely with the partner</span>
          </div>

          {canCancel && (
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              disabled={cancelling}
              className="mt-4 w-full rounded-2xl border border-gray-200 bg-white py-3.5 text-[14px] font-bold text-gray-800 shadow-sm active:scale-[0.99] transition-transform disabled:opacity-60"
            >
              Cancel Booking
            </button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {confirmOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !cancelling && setConfirmOpen(false)}
              className="fixed inset-0 z-[120] bg-black/50"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed inset-x-0 bottom-0 z-[121] mx-auto w-full max-w-lg rounded-t-[2rem] bg-white p-6 pb-8 shadow-[0_-20px_60px_rgba(0,0,0,0.25)]"
            >
              <div className="mb-1 flex items-start justify-between">
                <h3 className="text-[18px] font-extrabold text-gray-900">Cancel this parcel delivery?</h3>
                <button
                  type="button"
                  onClick={() => !cancelling && setConfirmOpen(false)}
                  className="rounded-full p-1 text-gray-400 hover:bg-gray-100"
                  disabled={cancelling}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <p className="mt-1 text-[13px] leading-relaxed text-gray-500">
                Your delivery partner is still being searched. Do you really want to cancel this booking?
              </p>
              {(paymentMethodId === "wallet" || paymentMethodId === "razorpay") && (
                <p className="mt-3 rounded-xl bg-gray-50 px-3 py-2 text-[12px] font-semibold text-gray-600">
                  Any amount paid will be refunded automatically.
                </p>
              )}

              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => setConfirmOpen(false)}
                  disabled={cancelling}
                  className="flex-1 rounded-2xl border border-gray-200 bg-white py-3.5 text-[14px] font-bold text-gray-800 active:scale-[0.99] transition-transform disabled:opacity-60"
                >
                  Keep Searching
                </button>
                <button
                  type="button"
                  onClick={handleConfirmCancel}
                  disabled={cancelling}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#FF0000] py-3.5 text-[14px] font-bold text-white active:scale-[0.99] transition-transform disabled:opacity-70"
                >
                  {cancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cancel Booking"}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </Screen>
  );
}
