import React, { useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Calendar, Clock, Package, MapPin, Navigation, Loader2, CreditCard, Ruler,
} from "lucide-react";
import { toast } from "sonner";
import Screen from "../components/Screen";
import { PrimaryButton, StickyBar, inr } from "../components/ui";
import { useBooking } from "../context/BookingContext";
import porterUserApi from "../services/userApi";
import { mapActiveShipmentFromOrder } from "../utils/orderMapper";
import {
  getPorterFareEstimatePath,
  getPorterScheduledWaitingPath,
  getPorterAddressPath,
  getPorterParcelDetailsPath,
  getPorterVehiclePath,
} from "../utils/routes";
import { PAYMENT_METHODS } from "../constants/booking";
import { hasCoordinates } from "../utils/location";
import { getPorterClientTimezone } from "../utils/timezone";

const MIN_LEAD_MS = 5 * 60 * 1000;
const MAX_LEAD_MS = 30 * 24 * 60 * 60 * 1000;

const TIME_SLOTS = (() => {
  const slots = [];
  for (let h = 8; h <= 21; h += 1) {
    for (const m of [0, 30]) {
      if (h === 21 && m === 30) continue;
      const ampm = h >= 12 ? "PM" : "AM";
      const h12 = h % 12 || 12;
      slots.push(`${String(h12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${ampm}`);
    }
  }
  return slots;
})();

/** Local calendar YYYY-MM-DD (avoids UTC shift from toISOString). */
function toLocalDateKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addLocalDays(dateKey, days) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return toLocalDateKey(dt);
}

function parseSlotToDate(dateStr, timeStr) {
  let h = 0, m = 0;
  if (timeStr?.includes("M")) { // fallback for old AM/PM format
    const [t, ampm] = String(timeStr).split(" ");
    let [hh, mm] = (t || "0:0").split(":").map(Number);
    if (ampm === "PM" && hh !== 12) hh += 12;
    if (ampm === "AM" && hh === 12) hh = 0;
    h = hh;
    m = mm;
  } else {
    [h, m] = String(timeStr || "00:00").split(":").map(Number);
  }
  const [y, mo, d] = String(dateStr).split("-").map(Number);
  return new Date(y, mo - 1, d, h || 0, m || 0, 0, 0);
}

function formatDisplayDate(dateKey) {
  try {
    const [y, m, d] = dateKey.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-IN", {
      weekday: "short", day: "numeric", month: "short", year: "numeric",
    });
  } catch {
    return dateKey;
  }
}

function maxScheduleDateKey() {
  return toLocalDateKey(new Date(Date.now() + MAX_LEAD_MS));
}

export default function SchedulePickup() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isReschedule = searchParams.get("mode") === "reschedule";
  const customDateRef = useRef(null);

  const {
    scheduledAt,
    scheduleMeta,
    applyScheduleSelection,
    parcel,
    updateParcel,
    pickup,
    delivery,
    vehicle,
    total,
    distanceKm,
    distanceText,
    paymentMethodId,
    activeShipment,
    setActiveShipment,
  } = useBooking();

  const todayKey = toLocalDateKey();
  const tomorrowKey = addLocalDays(todayKey, 1);
  const maxDateKey = maxScheduleDateKey();

  const [date, setDate] = useState(() => {
    if (scheduleMeta?.date) return scheduleMeta.date;
    const src = scheduledAt || activeShipment?.scheduledAt;
    if (src) return toLocalDateKey(new Date(src));
    return todayKey;
  });
  
  const [time, setTime] = useState(() => {
    if (scheduleMeta?.time) {
      if (scheduleMeta.time.includes("M")) {
        const [t, ampm] = scheduleMeta.time.split(" ");
        let [h, m] = t.split(":").map(Number);
        if (ampm === "PM" && h !== 12) h += 12;
        if (ampm === "AM" && h === 12) h = 0;
        return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      }
      return scheduleMeta.time;
    }
    const src = scheduledAt || activeShipment?.scheduledAt;
    if (src) {
      const d = new Date(src);
      return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    }
    const now = new Date(Date.now() + MIN_LEAD_MS + 60000); // default to a valid future time
    return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  });
  const [saving, setSaving] = useState(false);

  // Reschedule must stay in scheduled mode.
  React.useEffect(() => {
    if (isReschedule && !parcel.isScheduled) {
      updateParcel({ isScheduled: true });
    }
  }, [isReschedule, parcel.isScheduled, updateParcel]);

  const paymentLabel = useMemo(() => {
    const m = PAYMENT_METHODS.find((p) => p.id === paymentMethodId);
    return m?.label || paymentMethodId || "—";
  }, [paymentMethodId]);

  const summaryPickupTitle = pickup?.title || activeShipment?.pickup?.title;
  const summaryPickupAddress = pickup?.address || activeShipment?.pickup?.address;
  const summaryDropTitle = delivery?.title || activeShipment?.delivery?.title;
  const summaryDropAddress = delivery?.address || activeShipment?.delivery?.address;
  
  const summaryWeight = Number(parcel?.weightKg || activeShipment?.parcel?.weightKg || 0)
    * Number(parcel?.quantity || activeShipment?.parcel?.quantity || 1);
  const summaryParcelName = parcel?.parcelName || activeShipment?.parcel?.parcelName || "";
  const summaryVehicle = vehicle?.category || activeShipment?.vehicleCategory || activeShipment?.vehicle;
  const summaryFare = total ?? activeShipment?.total ?? activeShipment?.pricing?.total;
  const summaryDistance = distanceText
    || (distanceKm != null ? `${Number(distanceKm).toFixed(1)} km` : null)
    || activeShipment?.route?.distanceText
    || null;

  const validateBookingBasics = () => {
    if (!isReschedule) {
      if (!hasCoordinates(pickup) && !pickup?.address) {
        toast.error("Please select a pickup location first");
        navigate(getPorterAddressPath());
        return false;
      }
      if (!hasCoordinates(delivery) && !delivery?.address) {
        toast.error("Please select a drop location first");
        navigate(getPorterAddressPath());
        return false;
      }
      if (!parcel?.weightKg && !parcel?.parcelName) {
        toast.error("Please add parcel details first");
        navigate(getPorterParcelDetailsPath());
        return false;
      }
      if (!vehicle?.id && !vehicle?.category) {
        toast.error("Please select a vehicle first");
        navigate(getPorterVehiclePath());
        return false;
      }
    }
    return true;
  };

  const validateTime = () => {
    if (!date || !time) return false;
    const dt = parseSlotToDate(date, time);
    const lead = dt.getTime() - Date.now();
    if (Number.isNaN(dt.getTime())) {
      toast.error("Invalid schedule date/time");
      return false;
    }
    if (lead < MIN_LEAD_MS) {
      toast.error("Schedule time must be at least 5 minutes from now");
      return false;
    }
    if (lead > MAX_LEAD_MS) {
      toast.error("Schedule time cannot be more than 30 days ahead");
      return false;
    }
    return dt;
  };

  const confirm = async () => {
    if (saving) return;

    if (isReschedule) {
      if (!activeShipment?.id) {
        toast.error("No scheduled order to update");
        return;
      }
      const dt = validateTime();
      if (!dt) return;
      
      setSaving(true);
      try {
        const result = await porterUserApi.rescheduleOrder(
          activeShipment.id,
          dt.toISOString(),
          getPorterClientTimezone(),
        );
        const order = result?.order || result;
        const mapped = mapActiveShipmentFromOrder(order);
        if (mapped) setActiveShipment(mapped);
        applyScheduleSelection({
          isScheduled: true,
          scheduledAt: dt.toISOString(),
          meta: {
            date,
            time,
            timezone: getPorterClientTimezone(),
          },
        });
        toast.success("Pickup rescheduled");
        navigate(getPorterScheduledWaitingPath(), { replace: true });
      } catch (err) {
        toast.error(err?.response?.data?.message || err?.message || "Failed to reschedule");
      } finally {
        setSaving(false);
      }
      return;
    }

    if (!validateBookingBasics()) return;

    if (parcel.isScheduled) {
      const dt = validateTime();
      if (!dt) return;

      applyScheduleSelection({
        isScheduled: true,
        scheduledAt: dt.toISOString(),
        meta: {
          date,
          time,
          timezone: getPorterClientTimezone(),
        },
      });
      toast.success("Schedule saved");
      navigate(getPorterFareEstimatePath(), { replace: true });
      return;
    }

    // Immediate booking — clear any previous schedule draft.
    applyScheduleSelection({ isScheduled: false, scheduledAt: null, meta: null });
    navigate(getPorterFareEstimatePath(), { replace: true });
  };

  const onToggleScheduled = () => {
    const next = !parcel.isScheduled;
    updateParcel({ isScheduled: next });
    if (!next) {
      applyScheduleSelection({ isScheduled: false, scheduledAt: null, meta: null });
    }
  };

  const onCustomDateChange = (e) => {
    const next = e.target.value;
    if (!next) return;
    if (next < todayKey) {
      toast.error("Cannot select a past date");
      return;
    }
    if (next > maxDateKey) {
      toast.error("Schedule cannot be more than 30 days ahead");
      return;
    }
    setDate(next);
  };

  const isCustomDate = date !== todayKey && date !== tomorrowKey;

  return (
    <Screen
      title={isReschedule ? "Reschedule Delivery" : "Schedule Delivery"}
      subtitle={isReschedule ? "Pick a new pickup date & time" : "When should we collect your parcel?"}
    >
      {!isReschedule && (
        <div className="mb-4 flex items-center justify-between rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <div>
            <h3 className="text-[15px] font-bold text-gray-900">Schedule Delivery</h3>
            <p className="text-[12px] text-gray-500">Plan your pickup for later</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={parcel.isScheduled}
            onClick={onToggleScheduled}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              parcel.isScheduled ? "bg-[#FF0000]" : "bg-gray-200"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                parcel.isScheduled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
      )}

      {(parcel.isScheduled || isReschedule) && (
        <>
          <div className="mb-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-[#FF0000]" />
              <span className="text-[14px] font-bold text-gray-900">Delivery Date</span>
            </div>
            <div className="mb-3 grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setDate(todayKey)}
                className={`rounded-xl py-2 text-[12px] font-bold transition border ${
                  date === todayKey ? "border-[#FF0000] bg-[#FFF1F1] text-[#FF0000]" : "border-gray-200 bg-white text-gray-600"
                }`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setDate(tomorrowKey)}
                className={`rounded-xl py-2 text-[12px] font-bold transition border ${
                  date === tomorrowKey ? "border-[#FF0000] bg-[#FFF1F1] text-[#FF0000]" : "border-gray-200 bg-white text-gray-600"
                }`}
              >
                Tomorrow
              </button>
              <button
                type="button"
                onClick={() => customDateRef.current?.showPicker?.() || customDateRef.current?.click()}
                className={`rounded-xl py-2 text-[12px] font-bold transition border ${
                  isCustomDate ? "border-[#FF0000] bg-[#FFF1F1] text-[#FF0000]" : "border-gray-200 bg-white text-gray-600"
                }`}
              >
                Custom
              </button>
            </div>
            <input
              ref={customDateRef}
              type="date"
              value={date}
              min={todayKey}
              max={maxDateKey}
              onChange={onCustomDateChange}
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
            />
            <p className="text-center text-[13px] font-semibold text-gray-800">
              {formatDisplayDate(date)}
            </p>
            <p className="mt-1 text-center text-[11px] text-gray-400">
              Up to {formatDisplayDate(maxDateKey)}
            </p>
          </div>

          <div className="mb-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <Clock className="h-4 w-4 text-[#FF0000]" />
              <span className="text-[14px] font-bold text-gray-900">Delivery Time</span>
            </div>
            <input 
              type="time" 
              value={time} 
              onChange={(e) => setTime(e.target.value)} 
              className="w-full rounded-xl border border-gray-200 bg-white p-3 text-center text-[16px] font-bold text-gray-900 outline-none focus:border-[#FF0000] focus:ring-1 focus:ring-[#FF0000]"
            />
            <p className="mt-2 text-center text-[11px] text-gray-400">local time · min 5 minutes ahead</p>
          </div>
        </>
      )}

      {!parcel.isScheduled && !isReschedule && (
        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-[#FF0000]/20 bg-[#FFF1F1] p-4">
          <Clock className="mt-0.5 h-5 w-5 text-[#FF0000]" />
          <div>
            <h4 className="text-[14px] font-bold text-gray-900">Immediate Booking</h4>
            <p className="mt-1 text-[12px] text-gray-600">
              Your delivery partner will arrive for pickup as soon as possible, usually within 15-30 minutes.
            </p>
          </div>
        </div>
      )}

      <div className="mb-6 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <h4 className="mb-3 border-b border-gray-100 pb-2 text-[14px] font-bold text-gray-900">Booking Summary</h4>
        <div className="space-y-3">
          <div className="flex gap-3">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#2e7d32]" />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">Pickup</p>
              <p className="truncate text-[13px] font-medium text-gray-900">{summaryPickupTitle || "Not selected"}</p>
              {summaryPickupAddress && <p className="truncate text-[11px] text-gray-500">{summaryPickupAddress}</p>}
            </div>
          </div>
          <div className="flex gap-3">
            <Navigation className="mt-0.5 h-4 w-4 shrink-0 text-[#FF0000]" />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">Drop</p>
              <p className="truncate text-[13px] font-medium text-gray-900">{summaryDropTitle || "Not selected"}</p>
              {summaryDropAddress && <p className="truncate text-[11px] text-gray-500">{summaryDropAddress}</p>}
            </div>
          </div>
          <div className="flex gap-3">
            <Package className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">Parcel</p>
              <p className="truncate text-[13px] font-medium text-gray-900">
                {summaryParcelName ? `${summaryParcelName} · ` : ""}
                {summaryWeight > 0 ? `${summaryWeight} kg` : "Not set"}
              </p>
            </div>
          </div>
          {(summaryDistance || summaryVehicle) && (
            <div className="flex gap-3">
              <Ruler className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">Route / Vehicle</p>
                <p className="truncate text-[13px] font-medium text-gray-900">
                  {[summaryVehicle, summaryDistance].filter(Boolean).join(" · ") || "—"}
                </p>
              </div>
            </div>
          )}
          <div className="flex gap-3">
            <CreditCard className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">Payment</p>
              <p className="truncate text-[13px] font-medium text-gray-900">{paymentLabel}</p>
            </div>
          </div>
          <div className="flex items-center justify-between border-t border-gray-100 pt-2">
            <div className="flex items-center gap-2">
              <span className="text-xl">{vehicle?.icon}</span>
              <span className="text-[13px] font-bold text-gray-900">{summaryVehicle || "Vehicle"}</span>
            </div>
            <span className="text-[14px] font-extrabold text-gray-900">
              {summaryFare != null ? inr(summaryFare) : "—"}
            </span>
          </div>
        </div>
      </div>

      <StickyBar>
        <PrimaryButton
          type="button"
          onClick={confirm}
          disabled={saving || ((parcel.isScheduled || isReschedule) && (!date || !time))}
        >
          {saving ? (
            <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Saving…</span>
          ) : isReschedule
            ? "Confirm Reschedule"
            : parcel.isScheduled
              ? "Confirm Schedule"
              : "Continue with Immediate Booking"}
        </PrimaryButton>
      </StickyBar>
    </Screen>
  );
}
