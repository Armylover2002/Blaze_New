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
import { resolveActiveRouteForStatus } from "../utils/orderMapper";
import { PORTER_SEARCHING_STATUSES } from "../constants/booking";
import {
  getAdaptiveSearchPollDelayMs,
  shouldStopActiveOrderPolling,
  isSearchingPartnerStatus,
} from "../utils/activeOrderSync";

// NOTE: `scheduled` uses /porter/scheduled — do NOT treat it as searching here.
const SEARCHING_STATUSES = PORTER_SEARCHING_STATUSES;
// Once a partner accepts, the customer is routed to the Partner Assigned screen.
const ACCEPTED_STATUSES = ["assigned", "partner_accepted", "en_route_pickup", "at_pickup"];
const POST_PICKUP_STATUSES = ["picked_up", "in_transit", "at_drop", "delivered", "completed"];
const CANCELLED_STATUSES = ["cancelled_by_user", "cancelled_by_admin", "cancelled_by_driver", "failed"];

export default function FindingPartner() {
  const navigate = useNavigate();
  const {
    setActiveShipment,
    refreshActiveOrder,
    resetBooking,
    activeShipment,
    activeOrderEvent,
    vehicle,
    paymentMethodId,
  } = useBooking();
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const userCancelRef = useRef(false);
  const pollInFlightRef = useRef(false);
  const searchStartedAtRef = useRef(Date.now());

  const orderId = activeShipment?.id || null;
  const status = String(activeShipment?.status || "").toLowerCase();
  const canCancel = useMemo(
    () => Boolean(orderId) && SEARCHING_STATUSES.includes(status),
    [orderId, status],
  );

  useEffect(() => {
    let pollTimer;
    let cancelled = false;
    searchStartedAtRef.current = Date.now();

    const scheduleNextPoll = (delayMs) => {
      if (cancelled) return;
      const delay = delayMs ?? getAdaptiveSearchPollDelayMs(Date.now() - searchStartedAtRef.current);
      pollTimer = setTimeout(pollStatus, delay);
    };

    const pollStatus = async () => {
      if (cancelled) return;
      if (pollInFlightRef.current) {
        scheduleNextPoll();
        return;
      }

      pollInFlightRef.current = true;
      try {
        const mapped = await refreshActiveOrder({ forceRefresh: true });
        if (cancelled) return;

        if (!mapped) {
          scheduleNextPoll();
          return;
        }

        const nextStatus = String(mapped.status || "").toLowerCase();

        if (shouldStopActiveOrderPolling(nextStatus)) {
          if (ACCEPTED_STATUSES.includes(nextStatus)) {
            navigate(getPorterPartnerAssignedPath(), { replace: true });
          } else if (POST_PICKUP_STATUSES.includes(nextStatus)) {
            navigate(resolveActiveRouteForStatus(nextStatus), { replace: true });
          }
          return;
        }

        if (!isSearchingPartnerStatus(nextStatus)) {
          scheduleNextPoll();
          return;
        }

        scheduleNextPoll();
      } catch {
        scheduleNextPoll();
      } finally {
        pollInFlightRef.current = false;
      }
    };

    pollStatus();

    return () => {
      cancelled = true;
      pollInFlightRef.current = false;
      if (pollTimer) clearTimeout(pollTimer);
    };
  }, [navigate, refreshActiveOrder]);

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

  // Driver released the order — customer is sent back to partner search (not a terminal cancel).
  useEffect(() => {
    if (!activeOrderEvent || userCancelRef.current) return undefined;
    if (activeOrderEvent.redispatch && isSearchingPartnerStatus(activeOrderEvent.status)) {
      toast.info("Your delivery partner cancelled. Finding a new partner...");
    }
    return undefined;
  }, [activeOrderEvent]);

  // Handle admin cancellation (and any externally-triggered cancel) delivered
  // over the socket. Terminal orders don't refresh into activeShipment, so we
  // react to the raw socket event instead.
  useEffect(() => {
    if (!activeOrderEvent || userCancelRef.current) return undefined;
    const evtOrderId = activeOrderEvent.orderId;
    if (orderId && evtOrderId && String(evtOrderId) !== String(orderId)) return undefined;
    const evtStatus = String(activeOrderEvent.status || "").toLowerCase();
    const isRedispatch = activeOrderEvent.redispatch === true
      || isSearchingPartnerStatus(evtStatus);
    const isCancelled = !isRedispatch && (
      activeOrderEvent.cancelled === true || CANCELLED_STATUSES.includes(evtStatus)
    );
    if (!isCancelled) return undefined;

    setConfirmOpen(false);
    let message = evtStatus === "cancelled_by_admin"
      ? "This booking was cancelled by support."
      : evtStatus === "cancelled_by_driver"
        ? "This booking was cancelled by the delivery partner."
        : "This booking was cancelled.";

    const refund = activeOrderEvent.refund;
    const refundAmount = Number(refund?.amount || 0);
    if (refundAmount > 0 && refund?.status === "processed") {
      message += String(refund?.method || "").toLowerCase() === "razorpay"
        ? ` ₹${refundAmount} will be refunded to your online payment method.`
        : ` ₹${refundAmount} has been credited to your wallet.`;
    }
    if (activeOrderEvent.couponConsumed && activeOrderEvent.couponCode) {
      message += ` Coupon ${activeOrderEvent.couponCode} cannot be reused.`;
    }

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
      const paidOnline = paymentMethodId === "razorpay";
      toast.success(
        paidOnline
          ? "Booking cancelled. Online payment refund will be processed to your original payment method."
          : "Booking cancelled. Any eligible refund has been initiated.",
      );
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
            className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#EFF6FF]"
          >
            <Search className="h-7 w-7 text-[#2563EB]" />
          </motion.div>
          <h2 className="text-center text-[18px] font-extrabold text-gray-900">
            {submitting ? "Confirming your booking…" : "Searching for delivery partner"}
          </h2>
          <p className="mt-1 text-center text-[13px] text-gray-500">
            Finding the best partner for your {vehicle?.category || "delivery"} shipment
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="h-2 w-2 rounded-full bg-[#2563EB]"
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
              />
            ))}
          </div>
          <div className="mt-6 flex items-center justify-center gap-2 rounded-2xl bg-gray-50 p-3">
            <Package className="h-4 w-4 text-[#2563EB]" />
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
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#2563EB] py-3.5 text-[14px] font-bold text-white active:scale-[0.99] transition-transform disabled:opacity-70"
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
