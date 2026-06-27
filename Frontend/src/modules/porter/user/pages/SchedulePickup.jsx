import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Calendar, Clock } from "lucide-react";
import Screen from "../components/Screen";
import { PrimaryButton, StickyBar } from "../components/ui";
import { useBooking } from "../context/BookingContext";

const TIME_SLOTS = [
  "09:00 AM", "10:00 AM", "11:00 AM", "12:00 PM",
  "02:00 PM", "03:00 PM", "04:00 PM", "05:00 PM", "06:00 PM",
];

export default function SchedulePickup() {
  const navigate = useNavigate();
  const { scheduledAt, setScheduledAt } = useBooking();
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
    const [timePart, ampm] = time.split(" ");
    let [h, m] = timePart.split(":").map(Number);
    if (ampm === "PM" && h !== 12) h += 12;
    if (ampm === "AM" && h === 12) h = 0;
    const dt = new Date(date);
    dt.setHours(h, m, 0, 0);
    setScheduledAt(dt.toISOString());
    navigate(-1);
  };

  const clear = () => {
    setScheduledAt(null);
    navigate(-1);
  };

  return (
    <Screen title="Schedule pickup" subtitle="Choose date & time for parcel collection">
      <div className="mb-4 rounded-2xl border border-gray-100 bg-white p-4">
        <div className="mb-3 flex items-center gap-2">
          <Calendar className="h-4 w-4 text-[#FF0000]" />
          <span className="text-[14px] font-bold text-gray-900">Pickup date</span>
        </div>
        <input
          type="date"
          value={date}
          min={new Date().toISOString().slice(0, 10)}
          onChange={(e) => setDate(e.target.value)}
          className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-[14px] font-medium outline-none focus:border-[#FF0000]"
        />
      </div>

      <div className="mb-4 rounded-2xl border border-gray-100 bg-white p-4">
        <div className="mb-3 flex items-center gap-2">
          <Clock className="h-4 w-4 text-[#FF0000]" />
          <span className="text-[14px] font-bold text-gray-900">Pickup time slot</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {TIME_SLOTS.map((slot) => (
            <button
              key={slot}
              type="button"
              onClick={() => setTime(slot)}
              className={`rounded-xl py-2 text-[12px] font-bold transition ${
                time === slot ? "bg-[#FF0000] text-white" : "bg-gray-100 text-gray-600"
              }`}
            >
              {slot}
            </button>
          ))}
        </div>
      </div>

      <p className="text-[11px] text-gray-400">
        Partner will arrive within ±15 minutes of scheduled time. Same-day slots subject to availability.
      </p>

      <StickyBar>
        <div className="flex gap-2">
          <PrimaryButton variant="outline" className="flex-1" onClick={clear}>
            Pick up now
          </PrimaryButton>
          <PrimaryButton className="flex-1" onClick={confirm}>
            Confirm schedule
          </PrimaryButton>
        </div>
      </StickyBar>
    </Screen>
  );
}
