import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  CalendarClock, MapPin, Navigation, Package, X, Loader2, Clock3,
} from "lucide-react";
import { toast } from "sonner";
import Screen from "../components/Screen";
import { PrimaryButton, StickyBar, inr } from "../components/ui";
import { useBooking } from "../context/BookingContext";
import {
  getPorterFindingPartnerPath,
  getPorterHomePath,
  getPorterPartnerAssignedPath,
  getPorterSchedulePath,
} from "../utils/routes";
import { PORTER_ACTIVE_ORDER_POLL_MS } from "../constants/booking";
import {
  getAdaptiveSearchPollDelayMs,
  isScheduledOrderStatus,
  shouldStopActiveOrderPolling,
} from "../utils/activeOrderSync";
import { resolveActiveRouteForStatus } from "../utils/orderMapper";

const ACCEPTED_STATUSES = ["assigned", "partner_accepted", "en_route_pickup", "at_pickup"];
const POST_PICKUP_STATUSES = ["picked_up", "in_transit", "at_drop", "delivered", "completed"];
const CANCELLED_STATUSES = ["cancelled_by_user", "cancelled_by_admin", "cancelled_by_driver", "failed"];

function pad2(n) {
  return String(Math.max(0, n)).padStart(2, "0");
}

function splitCountdown(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return { hours, minutes, seconds, total };
}

function formatLocalDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-IN", {
      weekday: "short", day: "numeric", month: "short", year: "numeric",
    });
  } catch {
    return "—";
  }
}

function formatLocalTime(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleTimeString("en-IN", {
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

export default function ScheduleWaiting() {
  const navigate = useNavigate();
  const {
    activeShipment,
    resetBooking,
    activeOrderEvent,
    refreshActiveOrder,
  } = useBooking();

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const userCancelRef = React.useRef(false);
  const pollInFlightRef = React.useRef(false);
  const waitStartedAtRef = React.useRef(Date.now());

  const orderId = activeShipment?.id || null;
  const status = String(activeShipment?.status || "").toLowerCase();
  const scheduledAt = activeShipment?.scheduledAt || null;
  const scheduledMs = scheduledAt ? new Date(scheduledAt).getTime() : NaN;

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const countdown = useMemo(() => {
    if (!Number.isFinite(scheduledMs)) return splitCountdown(0);
    return splitCountdown(scheduledMs - now);
  }, [scheduledMs, now]);

  // Poll while scheduled; slower cadence than active search. Stops on status advance.
  useEffect(() => {
    let cancelled = false;
    let timer;
    waitStartedAtRef.current = Date.now();

    const scheduleNext = (delayMs) => {
      if (cancelled) return;
      const delay = delayMs ?? Math.max(
        PORTER_ACTIVE_ORDER_POLL_MS.scheduled,
        getAdaptiveSearchPollDelayMs(Date.now() - waitStartedAtRef.current),
      );
      timer = setTimeout(tick, delay);
    };

    const tick = async () => {
      if (cancelled || userCancelRef.current) return;
      if (pollInFlightRef.current) {
        scheduleNext();
        return;
      }

      pollInFlightRef.current = true;
      try {
        const mapped = await refreshActiveOrder({ forceRefresh: true });
        if (cancelled) {
          scheduleNext();
          return;
        }

        if (!mapped) {
          scheduleNext();
          return;
        }

        const s = String(mapped.status || "").toLowerCase();
        if (s === "searching_partner" || s === "created") {
          navigate(getPorterFindingPartnerPath(), { replace: true });
          return;
        }
        if (ACCEPTED_STATUSES.includes(s)) {
          navigate(getPorterPartnerAssignedPath(), { replace: true });
          return;
        }
        if (POST_PICKUP_STATUSES.includes(s)) {
          navigate(resolveActiveRouteForStatus(s), { replace: true });
          return;
        }
        if (CANCELLED_STATUSES.includes(s)) {
          toast.error(
            s === "cancelled_by_admin"
              ? "This booking was cancelled by support."
              : "This scheduled booking was cancelled.",
          );
          resetBooking();
          navigate(getPorterHomePath(), { replace: true });
          return;
        }
        if (!isScheduledOrderStatus(s) || shouldStopActiveOrderPolling(s)) {
          return;
        }

        scheduleNext();
      } catch {
        scheduleNext();
      } finally {
        pollInFlightRef.current = false;
      }
    };

    tick();
    return () => {
      cancelled = true;
      pollInFlightRef.current = false;
      if (timer) clearTimeout(timer);
    };
  }, [navigate, refreshActiveOrder, resetBooking]);

  // Countdown hit zero → soft hand-off (backend/poller still owns real dispatch).
  useEffect(() => {
    if (userCancelRef.current) return;
    if (!Number.isFinite(scheduledMs)) return;
    if (scheduledMs - now > 0) return;
    if (status && status !== "scheduled") return;
    navigate(getPorterFindingPartnerPath(), { replace: true });
  }, [scheduledMs, now, status, navigate]);

  useEffect(() => {
    if (userCancelRef.current) return undefined;
    if (!status) return undefined;
    if (status === "searching_partner") {
      navigate(getPorterFindingPartnerPath(), { replace: true });
    } else if (ACCEPTED_STATUSES.includes(status)) {
      navigate(getPorterPartnerAssignedPath(), { replace: true });
    } else if (POST_PICKUP_STATUSES.includes(status)) {
      navigate(resolveActiveRouteForStatus(status), { replace: true });
    }
    return undefined;
  }, [status, navigate]);

  useEffect(() => {
    if (!activeOrderEvent || userCancelRef.current) return undefined;
    const evtOrderId = activeOrderEvent.orderId;
    if (orderId && evtOrderId && String(evtOrderId) !== String(orderId)) return undefined;
    const evtStatus = String(activeOrderEvent.status || "").toLowerCase();
    const isCancelled = activeOrderEvent.cancelled === true || CANCELLED_STATUSES.includes(evtStatus);

    if (isCancelled) {
      setConfirmOpen(false);
      toast.error(
        evtStatus === "cancelled_by_admin"
          ? "This booking was cancelled by support."
          : "This scheduled booking was cancelled.",
      );
      resetBooking();
      navigate(getPorterHomePath(), { replace: true });
      return undefined;
    }

    if (evtStatus === "searching_partner" || evtStatus === "created") {
      navigate(getPorterFindingPartnerPath(), { replace: true });
      return undefined;
    }
    if (ACCEPTED_STATUSES.includes(evtStatus)) {
      navigate(getPorterPartnerAssignedPath(), { replace: true });
      return undefined;
    }
    if (POST_PICKUP_STATUSES.includes(evtStatus)) {
      navigate(resolveActiveRouteForStatus(evtStatus), { replace: true });
    }
    return undefined;
  }, [activeOrderEvent, orderId, navigate, resetBooking]);

  const handleCancel = async () => {
    if (!orderId || cancelling) return;
    setCancelling(true);
    try {
      userCancelRef.current = true;
      await porterUserApi.cancelOrder(orderId, "Cancelled scheduled booking");
      toast.success("Scheduled booking cancelled");
      resetBooking();
      navigate(getPorterHomePath(), { replace: true });
    } catch (err) {
      userCancelRef.current = false;
      toast.error(err?.response?.data?.message || err?.message || "Failed to cancel");
    } finally {
      setCancelling(false);
      setConfirmOpen(false);
    }
  };

  const handleReschedule = () => {
    navigate(`${getPorterSchedulePath()}?mode=reschedule`);
  };

  if (!activeShipment?.id) {
    return (
      <Screen title="Scheduled delivery" subtitle="Waiting for pickup time">
        <div className="flex flex-col items-center py-16 text-center">
          <Loader2 className="mb-3 h-8 w-8 animate-spin text-[#2563EB]" />
          <p className="text-sm text-gray-500">Loading your scheduled order…</p>
        </div>
      </Screen>
    );
  }

  return (
    <Screen 
      title="Scheduled Successfully" 
      subtitle="Waiting for scheduled time" 
      onBack={() => navigate(getPorterHomePath(), { replace: true })}
      bare
    >
      <div className="min-h-[calc(100vh-56px)] bg-gradient-to-b from-[#FFF5F5] via-white to-white px-4 pb-28 pt-6">
        <div className="mx-auto mb-4 flex w-fit items-center gap-2 rounded-full bg-[#2563EB] px-4 py-1.5 text-[12px] font-extrabold uppercase tracking-wide text-white shadow-sm">
          <CalendarClock className="h-3.5 w-3.5" />
          Scheduled
        </div>

        <div className="rounded-3xl border border-red-100 bg-white p-5 shadow-sm">
          <p className="text-center text-[12px] font-bold uppercase tracking-wide text-gray-400">Starts in</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {[
              { label: "Hours", value: pad2(countdown.hours) },
              { label: "Minutes", value: pad2(countdown.minutes) },
              { label: "Seconds", value: pad2(countdown.seconds) },
            ].map((cell) => (
              <div key={cell.label} className="rounded-2xl bg-[#EFF6FF] px-2 py-3 text-center">
                <p className="text-[28px] font-black tabular-nums text-[#2563EB]">{cell.value}</p>
                <p className="mt-0.5 text-[11px] font-bold uppercase text-gray-500">{cell.label}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-center gap-4 text-[13px] font-semibold text-gray-700">
            <span className="inline-flex items-center gap-1.5">
              <CalendarClock className="h-4 w-4 text-[#2563EB]" />
              {formatLocalDate(scheduledAt)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock3 className="h-4 w-4 text-[#2563EB]" />
              {formatLocalTime(scheduledAt)}
            </span>
          </div>
          <p className="mt-3 text-center text-[12px] text-gray-500">
            Order #{activeShipment.orderNumber || activeShipment.trackingId || "—"}
          </p>
        </div>

        <div className="mt-4 space-y-3 rounded-3xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="flex gap-3">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase text-gray-400">Pickup</p>
              <p className="truncate text-[13px] font-semibold text-gray-900">
                {activeShipment.pickup?.title && activeShipment.pickup.title !== activeShipment.pickup.address ? (
                  <>
                    {activeShipment.pickup.title}
                    <span className="block text-[11px] font-medium text-gray-500 truncate">
                      {activeShipment.pickup.address}
                    </span>
                  </>
                ) : (
                  activeShipment.pickup?.address || activeShipment.pickup?.title || "—"
                )}
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <Navigation className="mt-0.5 h-4 w-4 shrink-0 text-[#2563EB]" />
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase text-gray-400">Drop</p>
              <p className="truncate text-[13px] font-semibold text-gray-900">
                {activeShipment.delivery?.title && activeShipment.delivery.title !== activeShipment.delivery.address ? (
                  <>
                    {activeShipment.delivery.title}
                    <span className="block text-[11px] font-medium text-gray-500 truncate">
                      {activeShipment.delivery.address}
                    </span>
                  </>
                ) : (
                  activeShipment.delivery?.address || activeShipment.delivery?.title || "—"
                )}
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <Package className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase text-gray-400">Parcel</p>
              <p className="text-[13px] font-semibold text-gray-900">
                {(activeShipment.parcel?.weightKg || "—")} kg × {activeShipment.parcel?.quantity || 1}
                {activeShipment.parcel?.parcelName ? ` · ${activeShipment.parcel.parcelName}` : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between border-t border-gray-50 pt-3 text-[13px]">
            <span className="font-bold text-gray-900">{activeShipment.vehicleName || activeShipment.vehicle || "Vehicle"}</span>
            <span className="font-extrabold text-gray-900">{inr(activeShipment.total ?? activeShipment.pricing?.total ?? 0)}</span>
          </div>
          <p className="text-[12px] capitalize text-gray-500">
            Payment: {activeShipment.payment?.method || "—"} · {activeShipment.payment?.status || "—"}
          </p>
        </div>

        <StickyBar>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              className="flex-1 rounded-2xl border border-gray-200 bg-white py-3.5 text-[14px] font-bold text-gray-800"
            >
              Cancel
            </button>
            <PrimaryButton className="flex-1" onClick={handleReschedule}>
              Reschedule
            </PrimaryButton>
          </div>
        </StickyBar>
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
              className="fixed inset-x-0 bottom-0 z-[121] mx-auto w-full max-w-lg rounded-t-[2rem] bg-white p-6 pb-8"
            >
              <div className="mb-1 flex items-start justify-between">
                <h3 className="text-[18px] font-extrabold text-gray-900">Cancel scheduled delivery?</h3>
                <button type="button" onClick={() => !cancelling && setConfirmOpen(false)} className="p-1 text-gray-400">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <p className="mt-1 text-[13px] text-gray-500">
                Dispatch has not started yet. Any eligible payment will be refunded automatically.
              </p>
              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  disabled={cancelling}
                  onClick={() => setConfirmOpen(false)}
                  className="flex-1 rounded-2xl border border-gray-200 py-3.5 text-[14px] font-bold"
                >
                  Keep schedule
                </button>
                <button
                  type="button"
                  disabled={cancelling}
                  onClick={handleCancel}
                  className="flex-1 rounded-2xl bg-[#2563EB] py-3.5 text-[14px] font-bold text-white disabled:opacity-60"
                >
                  {cancelling ? "Cancelling…" : "Cancel booking"}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </Screen>
  );
}
