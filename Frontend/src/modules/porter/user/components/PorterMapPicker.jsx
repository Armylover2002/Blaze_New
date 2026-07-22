import React, { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Navigation, Search } from "lucide-react";
import { loadGoogleMaps } from "@core/services/googleMapsLoader";
import BottomSheet from "./BottomSheet";
import { PrimaryButton } from "./ui";

const DEFAULT_CENTER = { lat: 20.5937, lng: 78.9629 };

const toPosition = (location) => {
  const lat = Number(location?.lat);
  const lng = Number(location?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
};

export default function PorterMapPicker({
  isOpen,
  onClose,
  onSelect,
  title = "Select location",
  searchPlaceholder = "Search address",
  initialLocation = null,
}) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const autocompleteRef = useRef(null);
  const searchInputRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [fetchingLocation, setFetchingLocation] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const updateMarker = useCallback((position, address = "", placeTitle = "") => {
    if (!mapRef.current || !window.google?.maps) return;

    const next = {
      lat: position.lat,
      lng: position.lng,
      address: address || `${position.lat.toFixed(5)}, ${position.lng.toFixed(5)}`,
      title: placeTitle || "Selected Location",
    };
    setSelected(next);

    if (markerRef.current) {
      markerRef.current.setPosition(position);
    } else {
      markerRef.current = new window.google.maps.Marker({
        position,
        map: mapRef.current,
        draggable: true,
        animation: window.google.maps.Animation.DROP,
      });
      markerRef.current.addListener("dragend", (event) => {
        const dragged = { lat: event.latLng.lat(), lng: event.latLng.lng() };
        setSelected((prev) => ({
          ...(prev || {}),
          lat: dragged.lat,
          lng: dragged.lng,
          title: prev?.title || "Selected Location",
          address: prev?.address || `${dragged.lat.toFixed(5)}, ${dragged.lng.toFixed(5)}`,
        }));
      });
    }

    mapRef.current.panTo(position);
  }, []);

  useEffect(() => {
    if (!isOpen) return undefined;

    let cancelled = false;
    setLoading(true);
    setError("");
    setSelected(null);
    markerRef.current = null;
    autocompleteRef.current = null;

    const initMap = async () => {
      const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        setError("Google Maps is not configured.");
        setLoading(false);
        return;
      }

      try {
        await loadGoogleMaps(apiKey);
        if (cancelled || !mapContainerRef.current) return;

        const initialPosition = toPosition(initialLocation) || DEFAULT_CENTER;
        const map = new window.google.maps.Map(mapContainerRef.current, {
          center: initialPosition,
          zoom: initialPosition === DEFAULT_CENTER ? 12 : 16,
          disableDefaultUI: true,
          zoomControl: true,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
        });
        mapRef.current = map;

        map.addListener("click", (event) => {
          updateMarker(
            { lat: event.latLng.lat(), lng: event.latLng.lng() },
            "",
            "Selected Location",
          );
        });

        if (searchInputRef.current && window.google.maps.places) {
          const autocomplete = new window.google.maps.places.Autocomplete(searchInputRef.current, {
            componentRestrictions: { country: "in" },
            fields: ["geometry", "formatted_address", "name", "place_id"],
          });
          autocomplete.addListener("place_changed", () => {
            const place = autocomplete.getPlace();
            if (!place?.geometry?.location) return;
            const position = {
              lat: place.geometry.location.lat(),
              lng: place.geometry.location.lng(),
            };
            updateMarker(position, place.formatted_address || "", place.name || "Selected Location");
            setSelected((prev) => ({
              ...(prev || {}),
              lat: position.lat,
              lng: position.lng,
              title: place.name || "Selected Location",
              address: place.formatted_address || "",
              placeId: place.place_id,
            }));
          });
          autocompleteRef.current = autocomplete;
        }

        if (toPosition(initialLocation)) {
          updateMarker(
            initialPosition,
            initialLocation.address || "",
            initialLocation.title || "Selected Location",
          );
        }

        setLoading(false);
      } catch (err) {
        console.error("[PorterMapPicker] map init failed:", err);
        setError("Failed to load Google Maps.");
        setLoading(false);
      }
    };

    initMap();

    return () => {
      cancelled = true;
      markerRef.current = null;
      mapRef.current = null;
      autocompleteRef.current = null;
    };
  }, [isOpen, initialLocation, updateMarker]);

  const handleCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported on this device.");
      return;
    }

    setFetchingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextPosition = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        updateMarker(nextPosition, "", "Current Location");

        if (window.google?.maps?.Geocoder) {
          const geocoder = new window.google.maps.Geocoder();
          geocoder.geocode({ location: nextPosition }, (results, status) => {
            if (status === "OK" && results?.[0]) {
              setSelected((prev) => ({
                ...(prev || nextPosition),
                lat: nextPosition.lat,
                lng: nextPosition.lng,
                title: "Current Location",
                address: results[0].formatted_address,
              }));
            }
          });
        }

        setFetchingLocation(false);
      },
      () => {
        setFetchingLocation(false);
        setError("Unable to access current location.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  };

  const handleConfirm = async () => {
    if (!selected) return;

    setConfirming(true);
    try {
      let address = selected.address;
      if (window.google?.maps?.Geocoder && (!address || address.includes(","))) {
        const geocoder = new window.google.maps.Geocoder();
        const result = await new Promise((resolve, reject) => {
          geocoder.geocode({ location: { lat: selected.lat, lng: selected.lng } }, (results, status) => {
            if (status === "OK" && results?.[0]) resolve(results[0]);
            else reject(status);
          });
        });
        address = result.formatted_address;
      }

      onSelect({
        title: selected.title || "Selected Location",
        address: address || selected.address,
        lat: selected.lat,
        lng: selected.lng,
        placeId: selected.placeId,
      });
      onClose();
    } catch (err) {
      onSelect({
        title: selected.title || "Selected Location",
        address: selected.address,
        lat: selected.lat,
        lng: selected.lng,
      });
      onClose();
    } finally {
      setConfirming(false);
    }
  };

  return (
    <BottomSheet open={isOpen} onClose={onClose} title={title}>
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder={searchPlaceholder}
              className="w-full rounded-2xl border border-gray-200 bg-white py-3 pl-10 pr-4 text-[14px] font-medium outline-none focus:border-[#2563EB]"
            />
          </div>
          <button
            type="button"
            onClick={handleCurrentLocation}
            disabled={fetchingLocation || loading}
            className="inline-flex shrink-0 items-center gap-2 rounded-2xl border border-gray-200 bg-white px-3 py-2 text-[12px] font-bold text-gray-700 disabled:opacity-60"
          >
            {fetchingLocation ? <Loader2 className="h-4 w-4 animate-spin" /> : <Navigation className="h-4 w-4" />}
            Current
          </button>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-gray-200">
          <div ref={mapContainerRef} className="h-[320px] w-full" />
          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-gray-50">
              <Loader2 className="h-8 w-8 animate-spin text-[#2563EB]" />
            </div>
          )}
          {!loading && error && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-red-50 px-4 text-center text-[13px] font-medium text-red-600">
              {error}
            </div>
          )}
        </div>

        <p className="text-[12px] text-gray-500">
          {selected?.address || "Tap the map, search an address, or use your current location."}
        </p>

        <PrimaryButton disabled={!selected || confirming} onClick={handleConfirm}>
          {confirming ? "Confirming..." : "Confirm location"}
        </PrimaryButton>
      </div>
    </BottomSheet>
  );
}
