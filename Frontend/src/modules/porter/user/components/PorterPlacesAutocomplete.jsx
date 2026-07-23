import React, { useEffect, useRef } from "react";
import { Search } from "lucide-react";
import { loadGoogleMaps } from "@core/services/googleMapsLoader";
import { normalizeLocation } from "../utils/location";

export default function PorterPlacesAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = "Search address",
  className = "",
}) {
  const inputRef = useRef(null);
  const autocompleteRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
      if (!apiKey || !inputRef.current) return;

      try {
        await loadGoogleMaps(apiKey);
        if (cancelled || !inputRef.current || !window.google?.maps?.places) return;

        const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
          componentRestrictions: { country: "in" },
          fields: ["geometry", "formatted_address", "name", "place_id"],
        });

        autocomplete.addListener("place_changed", () => {
          const place = autocomplete.getPlace();
          if (!place?.geometry?.location) return;
          const location = normalizeLocation({
            title: place.name,
            address: place.formatted_address,
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng(),
            placeId: place.place_id,
          });
          onSelect?.(location);
          onChange?.("");
          if (inputRef.current) inputRef.current.value = "";
        });

        autocompleteRef.current = autocomplete;
      } catch (err) {
        console.error("[PorterPlacesAutocomplete] init failed:", err);
      }
    };

    init();

    return () => {
      cancelled = true;
      autocompleteRef.current = null;
    };
  }, [onSelect, onChange]);

  return (
    <div className={`relative ${className}`}>
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-gray-200 bg-white py-3 pl-10 pr-4 text-[14px] font-medium outline-none focus:border-[#2563EB]"
      />
    </div>
  );
}
