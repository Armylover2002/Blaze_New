import React, { useState } from "react";
import { Home, Briefcase, MapPin, Plus, Trash2 } from "lucide-react";
import Screen from "../components/Screen";
import BottomSheet from "../components/BottomSheet";
import { PrimaryButton, SectionLabel } from "../components/ui";
import { SAVED_PLACES } from "../utils/mock/places";

const TYPE_ICONS = {
  home: Home,
  work: Briefcase,
  other: MapPin,
};

export default function SavedPlaces() {
  const [places, setPlaces] = useState(SAVED_PLACES);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [form, setForm] = useState({ label: "", title: "", address: "", type: "other" });

  const addPlace = () => {
    if (!form.label.trim() || !form.address.trim()) return;
    setPlaces((prev) => [
      ...prev,
      { id: `sp${Date.now()}`, label: form.label, title: form.title || form.label, address: form.address, type: form.type },
    ]);
    setForm({ label: "", title: "", address: "", type: "other" });
    setSheetOpen(false);
  };

  const removePlace = (id) => setPlaces((prev) => prev.filter((p) => p.id !== id));

  return (
    <Screen
      title="Saved places"
      subtitle="Quick access for pickup & delivery"
      right={
        <button type="button" onClick={() => setSheetOpen(true)} className="flex h-9 w-9 items-center justify-center rounded-full bg-[#FFF1F1] text-[#FF0000]">
          <Plus className="h-5 w-5" />
        </button>
      }
    >
      <SectionLabel>Saved addresses</SectionLabel>
      <div className="space-y-2">
        {places.map((place) => {
          const Icon = TYPE_ICONS[place.type] || MapPin;
          return (
            <div key={place.id} className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gray-50">
                <Icon className="h-5 w-5 text-[#FF0000]" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-bold text-gray-900">{place.label}</p>
                <p className="truncate text-[12px] text-gray-500">{place.address}</p>
              </div>
              <button type="button" onClick={() => removePlace(place.id)} className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-50 text-gray-400 hover:text-[#FF0000]">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>

      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Add saved place">
        <div className="space-y-3">
          <input
            value={form.label}
            onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
            placeholder="Label (e.g. Home, Office)"
            className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-[14px] font-medium outline-none focus:border-[#FF0000]"
          />
          <input
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="Place name (optional)"
            className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-[14px] font-medium outline-none focus:border-[#FF0000]"
          />
          <textarea
            value={form.address}
            onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            placeholder="Full address"
            rows={3}
            className="w-full resize-none rounded-2xl border border-gray-200 p-3 text-[14px] font-medium outline-none focus:border-[#FF0000]"
          />
          <div className="flex gap-2">
            {["home", "work", "other"].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setForm((f) => ({ ...f, type: t }))}
                className={`flex-1 rounded-xl py-2 text-[12px] font-bold capitalize ${
                  form.type === t ? "bg-[#FF0000] text-white" : "bg-gray-100 text-gray-600"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <PrimaryButton onClick={addPlace}>Save place</PrimaryButton>
        </div>
      </BottomSheet>
    </Screen>
  );
}
