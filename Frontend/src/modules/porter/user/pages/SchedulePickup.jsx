import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Calendar, Clock, Package, MapPin, CheckCircle, Navigation } from "lucide-react";
import Screen from "../components/Screen";
import { PrimaryButton, StickyBar } from "../components/ui";
import { useBooking } from "../context/BookingContext";
import { inr } from "../components/ui";

const TIME_SLOTS = [
  "09:00 AM", "10:00 AM", "11:00 AM", "12:00 PM",
  "02:00 PM", "03:00 PM", "04:00 PM", "05:00 PM", "06:00 PM",
];

export default function SchedulePickup() {
  const navigate = useNavigate();
  const { scheduledAt, setScheduledAt, parcel, updateParcel, pickup, delivery, vehicle, total } = useBooking();
  const [date, setDate] = useState(() => {
    const d = scheduledAt ? new Date(scheduledAt) : new Date();
    return d.toISOString().slice(0, 10);
  });
  const [time, setTime] = useState(() => {
    if (scheduledAt) {
      const d = new Date(scheduledAt);
      const h = d.getHours();
      const m = d.getMinutes();
      const ampm = h >= 12 ? "PM" : "AM";
      const h12 = h % 12 || 12;
      return `${String(h12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${ampm}`;
    }
    return "10:00 AM";
  });

  const confirm = () => {
    if (parcel.isScheduled) {
      const [timePart, ampm] = time.split(" ");
      let [h, m] = timePart.split(":").map(Number);
      if (ampm === "PM" && h !== 12) h += 12;
      if (ampm === "AM" && h === 12) h = 0;
      const dt = new Date(date);
      dt.setHours(h, m, 0, 0);
      setScheduledAt(dt.toISOString());
    } else {
      setScheduledAt(null);
    }
    navigate(-1);
  };

  const isToday = (d) => new Date().toISOString().slice(0, 10) === d;
  const isTomorrow = (d) => {
    const tmrw = new Date();
    tmrw.setDate(tmrw.getDate() + 1);
    return tmrw.toISOString().slice(0, 10) === d;
  };

  return (
    <Screen title="Schedule Delivery" subtitle="When should we collect your parcel?">
      <div className="mb-4 flex items-center justify-between rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <div>
          <h3 className="text-[15px] font-bold text-gray-900">Schedule Delivery</h3>
          <p className="text-[12px] text-gray-500">Plan your pickup for later</p>
        </div>
        <button
          type="button"
          onClick={() => updateParcel({ isScheduled: !parcel.isScheduled })}
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

      {parcel.isScheduled && (
        <>
          <div className="mb-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-[#FF0000]" />
                <span className="text-[14px] font-bold text-gray-900">Delivery Date</span>
              </div>
            </div>
            <div className="mb-3 grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setDate(new Date().toISOString().slice(0, 10))}
                className={`rounded-xl py-2 text-[12px] font-bold transition border ${
                  isToday(date) ? "border-[#FF0000] bg-[#FFF1F1] text-[#FF0000]" : "border-gray-200 bg-white text-gray-600"
                }`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => {
                  const tmrw = new Date();
                  tmrw.setDate(tmrw.getDate() + 1);
                  setDate(tmrw.toISOString().slice(0, 10));
                }}
                className={`rounded-xl py-2 text-[12px] font-bold transition border ${
                  isTomorrow(date) ? "border-[#FF0000] bg-[#FFF1F1] text-[#FF0000]" : "border-gray-200 bg-white text-gray-600"
                }`}
              >
                Tomorrow
              </button>
              <div className="relative">
                <input
                  type="date"
                  value={date}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setDate(e.target.value)}
                  className="absolute inset-0 h-full w-full opacity-0 cursor-pointer"
                />
                <button
                  type="button"
                  className={`w-full rounded-xl py-2 text-[12px] font-bold transition border ${
                    !isToday(date) && !isTomorrow(date) ? "border-[#FF0000] bg-[#FFF1F1] text-[#FF0000]" : "border-gray-200 bg-white text-gray-600"
                  }`}
                >
                  Custom
                </button>
              </div>
            </div>
            {(!isToday(date) && !isTomorrow(date)) && (
              <p className="text-[12px] font-medium text-gray-700 text-center">{new Date(date).toDateString()}</p>
            )}
          </div>

          <div className="mb-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <Clock className="h-4 w-4 text-[#FF0000]" />
              <span className="text-[14px] font-bold text-gray-900">Delivery Time</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {TIME_SLOTS.map((slot) => (
                <button
                  key={slot}
                  type="button"
                  onClick={() => setTime(slot)}
                  className={`rounded-xl py-2 text-[12px] font-bold transition border ${
                    time === slot ? "border-[#FF0000] bg-[#FFF1F1] text-[#FF0000]" : "border-gray-200 bg-white text-gray-600"
                  }`}
                >
                  {slot}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {!parcel.isScheduled && (
        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-[#FF0000]/20 bg-[#FFF1F1] p-4">
          <Clock className="mt-0.5 h-5 w-5 text-[#FF0000]" />
          <div>
            <h4 className="text-[14px] font-bold text-gray-900">Immediate Booking</h4>
            <p className="text-[12px] text-gray-600 mt-1">Your delivery partner will arrive for pickup as soon as possible, usually within 15-30 minutes.</p>
          </div>
        </div>
      )}

      {/* Booking Summary */}
      <div className="mb-6 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <h4 className="text-[14px] font-bold text-gray-900 border-b border-gray-100 pb-2 mb-3">Booking Summary</h4>
        <div className="space-y-3">
          <div className="flex gap-3">
            <MapPin className="h-4 w-4 text-[#2e7d32] shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-gray-500 uppercase tracking-wide font-bold">Pickup</p>
              <p className="text-[13px] font-medium text-gray-900 truncate">{pickup?.title || "Not selected"}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Navigation className="h-4 w-4 text-[#FF0000] shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-gray-500 uppercase tracking-wide font-bold">Drop</p>
              <p className="text-[13px] font-medium text-gray-900 truncate">{delivery?.title || "Not selected"}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Package className="h-4 w-4 text-gray-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-gray-500 uppercase tracking-wide font-bold">Parcel</p>
              <p className="text-[13px] font-medium text-gray-900 truncate">Weight: {parcel.weightKg * parcel.quantity} kg</p>
            </div>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <div className="flex items-center gap-2">
              <span className="text-xl">{vehicle?.icon}</span>
              <span className="text-[13px] font-bold text-gray-900">{vehicle?.name || "Auto"}</span>
            </div>
            <span className="text-[14px] font-extrabold text-gray-900">{inr(total)}</span>
          </div>
        </div>
      </div>

      <StickyBar>
        <PrimaryButton onClick={confirm}>
          {parcel.isScheduled ? "Confirm Schedule" : "Continue with Immediate Booking"}
        </PrimaryButton>
      </StickyBar>
    </Screen>
  );
}
