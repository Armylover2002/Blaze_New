import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, Search, Home, Briefcase, Clock } from "lucide-react";
import Screen from "../components/Screen";
import MapPreview from "../components/MapPreview";
import { PrimaryButton, StickyBar } from "../components/ui";
import { useBooking } from "../context/BookingContext";
import { getPorterParcelDetailsPath, getPorterSavedPlacesPath } from "../utils/routes";
import { SAVED_PLACES, RECENT_PLACES, SEARCH_SUGGESTIONS } from "../utils/mock/places";

export default function SelectAddresses() {
  const navigate = useNavigate();
  const { pickup, setPickup, delivery, setDelivery } = useBooking();
  const [activeField, setActiveField] = useState("delivery");
  const [query, setQuery] = useState("");

  const suggestions = query
    ? SEARCH_SUGGESTIONS.filter(
        (s) =>
          s.title.toLowerCase().includes(query.toLowerCase()) ||
          s.address.toLowerCase().includes(query.toLowerCase()),
      )
    : [...SAVED_PLACES, ...RECENT_PLACES];

  const selectPlace = (place) => {
    const entry = {
      title: place.title || place.label,
      address: place.address,
      distanceKm: place.distanceKm ?? 8.2,
    };
    if (activeField === "pickup") setPickup(entry);
    else setDelivery(entry);
    setQuery("");
  };

  const canContinue = pickup?.address && delivery?.address;

  return (
    <Screen title="Pickup & delivery" subtitle="Set parcel route">
      <MapPreview height={180} showRoute className="mb-4" />

      <div className="mb-4 space-y-3">
        <button
          type="button"
          onClick={() => setActiveField("pickup")}
          className={`flex w-full items-start gap-3 rounded-2xl border p-3 text-left transition ${activeField === "pickup" ? "border-[#FF0000] bg-[#FFF1F1]" : "border-gray-100 bg-white"}`}
        >
          <span className="mt-1 h-3 w-3 shrink-0 rounded-full bg-[#2e7d32]" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase text-gray-400">Pickup location</p>
            <p className="text-[14px] font-bold text-gray-900">{pickup.title}</p>
            <p className="truncate text-[12px] text-gray-500">{pickup.address}</p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setActiveField("delivery")}
          className={`flex w-full items-start gap-3 rounded-2xl border p-3 text-left transition ${activeField === "delivery" ? "border-[#FF0000] bg-[#FFF1F1]" : "border-gray-100 bg-white"}`}
        >
          <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-[#FF0000]" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase text-gray-400">Delivery location</p>
            {delivery ? (
              <>
                <p className="text-[14px] font-bold text-gray-900">{delivery.title}</p>
                <p className="truncate text-[12px] text-gray-500">{delivery.address}</p>
              </>
            ) : (
              <p className="text-[14px] font-bold text-gray-400">Where should we deliver?</p>
            )}
          </div>
        </button>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${activeField} address`}
          className="w-full rounded-2xl border border-gray-200 bg-white py-3 pl-10 pr-4 text-[14px] font-medium outline-none focus:border-[#FF0000]"
        />
      </div>

      <button
        type="button"
        onClick={() => navigate(getPorterSavedPlacesPath())}
        className="mb-3 flex items-center gap-2 text-[12px] font-bold text-[#FF0000]"
      >
        <Home className="h-4 w-4" /> Manage saved places
      </button>

      <div className="space-y-2">
        {suggestions.map((place) => (
          <button
            key={place.id}
            type="button"
            onClick={() => selectPlace(place)}
            className="flex w-full items-center gap-3 rounded-2xl border border-gray-100 bg-white p-3 text-left transition hover:border-gray-200"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-50">
              {place.type === "home" ? (
                <Home className="h-4 w-4 text-[#FF0000]" />
              ) : place.type === "work" ? (
                <Briefcase className="h-4 w-4 text-[#FF0000]" />
              ) : (
                <Clock className="h-4 w-4 text-gray-500" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-bold text-gray-900">{place.title || place.label}</p>
              <p className="truncate text-[12px] text-gray-500">{place.address}</p>
            </div>
            {place.distanceKm != null && (
              <span className="text-[11px] font-semibold text-gray-400">{place.distanceKm} km</span>
            )}
          </button>
        ))}
      </div>

      <StickyBar>
        <PrimaryButton disabled={!canContinue} onClick={() => navigate(getPorterParcelDetailsPath())}>
          Continue to parcel details
        </PrimaryButton>
      </StickyBar>
    </Screen>
  );
}
