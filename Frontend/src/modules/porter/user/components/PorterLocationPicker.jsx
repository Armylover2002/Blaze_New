import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, Loader2, Navigation, Search, MapPin, X } from "lucide-react";
import { loadGoogleMaps } from "@core/services/googleMapsLoader";
import { useDebouncedMapGeocode } from "@core/hooks/useDebouncedMapGeocode";
import { PrimaryButton } from "./ui";
import { CenterPin } from "./PorterMapMarker";
import porterUserApi from "../services/userApi";
import {
  hasCoordinates,
  normalizeLocation,
  REVERSE_GEOCODE_DEBOUNCE_MS,
  MIN_GEOCODE_DISTANCE_M,
} from "../utils/location";

const DEFAULT_CENTER = { lat: 20.5937, lng: 78.9629 };

const toPosition = (location) => {
  const lat = Number(location?.lat);
  const lng = Number(location?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
};

export default function PorterLocationPicker({
  isOpen,
  onClose,
  onSelect,
  title = "Select location",
  pinLabel,
  searchPlaceholder = "Search for area, street, landmark",
  confirmLabel = "Confirm location",
  initialLocation = null,
}) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const searchInputRef = useRef(null);
  const autocompleteRef = useRef(null);
  const initialGeocodeDoneRef = useRef(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [moving, setMoving] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [fetchingLocation, setFetchingLocation] = useState(false);
  const [selected, setSelected] = useState(null);

  const reverseGeocodeCenter = useCallback(async (lat, lng, { signal } = {}) => {
    setResolving(true);
    try {
      const data = await porterUserApi.reverseGeocode(lat, lng, { signal });
      if (signal?.aborted) return;
      setSelected(normalizeLocation({ ...data, lat, lng }));
    } catch (err) {
      if (signal?.aborted || err?.code === "ERR_CANCELED") return;
      setSelected({
        title: "Selected Location",
        address: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
        lat,
        lng,
      });
    } finally {
      if (!signal?.aborted) {
        setResolving(false);
      }
    }
  }, []);

  const {
    bindMap,
    detachMap,
    cancelPending,
    forceGeocode,
    setLastGeocoded,
  } = useDebouncedMapGeocode({
    debounceMs: REVERSE_GEOCODE_DEBOUNCE_MS,
    minDistanceM: MIN_GEOCODE_DISTANCE_M,
    requireUserInteraction: true,
    onGeocode: reverseGeocodeCenter,
    onInteractingChange: setMoving,
  });

  useEffect(() => {
    if (!isOpen) return undefined;

    let cancelled = false;
    setLoading(true);
    setError("");
    setSelected(null);
    setMoving(false);
    initialGeocodeDoneRef.current = false;

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
          zoom: toPosition(initialLocation) ? 17 : 13,
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: "greedy",
          clickableIcons: false,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
          rotateControl: true,
          tilt: 0,
          keyboardShortcuts: false,
        });
        mapRef.current = map;
        bindMap(map);

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
            cancelPending();
            map.panTo(position);
            map.setZoom(17);
            setLastGeocoded(position);
            setSelected(normalizeLocation({
              title: place.name,
              address: place.formatted_address,
              lat: position.lat,
              lng: position.lng,
              placeId: place.place_id,
            }));
          });
          autocompleteRef.current = autocomplete;
        }

        setLoading(false);

        if (toPosition(initialLocation) && initialLocation.address) {
          const pos = toPosition(initialLocation);
          setLastGeocoded(pos);
          initialGeocodeDoneRef.current = true;
          setSelected(normalizeLocation(initialLocation));
        } else if (!initialGeocodeDoneRef.current) {
          initialGeocodeDoneRef.current = true;
          forceGeocode(initialPosition.lat, initialPosition.lng);
        }
      } catch (err) {
        console.error("[PorterLocationPicker] init failed:", err);
        setError("Failed to load Google Maps.");
        setLoading(false);
      }
    };

    initMap();

    return () => {
      cancelled = true;
      cancelPending();
      detachMap();
      autocompleteRef.current = null;
      mapRef.current = null;
    };
  }, [isOpen, bindMap, detachMap, cancelPending, forceGeocode, setLastGeocoded]);

  const handleCurrentLocation = () => {
    if (!navigator.geolocation || !mapRef.current) return;
    setFetchingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const next = { lat: position.coords.latitude, lng: position.coords.longitude };
        cancelPending();
        mapRef.current.panTo(next);
        mapRef.current.setZoom(17);
        forceGeocode(next.lat, next.lng);
        setFetchingLocation(false);
      },
      () => {
        setFetchingLocation(false);
        setError("Unable to access current location.");
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    );
  };

  const handleConfirm = () => {
    if (!selected || !hasCoordinates(selected)) return;
    onSelect?.({
      title: selected.title || "Selected Location",
      address: selected.address,
      lat: selected.lat,
      lng: selected.lng,
      placeId: selected.placeId,
    });
    onClose?.();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[700] flex flex-col bg-white"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Search header */}
          <div className="absolute inset-x-0 top-0 z-30 px-4 pt-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                aria-label="Back"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-gray-700 shadow-md active:scale-95"
              >
                <ChevronLeft className="h-5 w-5" strokeWidth={2.4} />
              </button>
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder={searchPlaceholder}
                  className="w-full rounded-full border border-gray-200 bg-white py-3 pl-10 pr-4 text-[14px] font-medium shadow-md outline-none focus:border-[#2563EB]"
                />
              </div>
            </div>
          </div>

          {/* Full-screen map */}
          <div className="relative flex-1">
            <div ref={mapContainerRef} className="h-full w-full" />

            {loading && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-gray-50">
                <Loader2 className="h-8 w-8 animate-spin text-[#2563EB]" />
              </div>
            )}
            {!loading && error && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-red-50 px-6 text-center text-[13px] font-medium text-red-600">
                {error}
              </div>
            )}

            {!loading && !error && <CenterPin moving={moving} label={pinLabel} />}

            {/* My location button */}
            {!loading && !error && (
              <button
                type="button"
                onClick={handleCurrentLocation}
                disabled={fetchingLocation}
                aria-label="Use current location"
                className="absolute bottom-5 right-4 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-white text-[#2563EB] shadow-lg active:scale-95 disabled:opacity-60"
              >
                {fetchingLocation ? <Loader2 className="h-5 w-5 animate-spin" /> : <Navigation className="h-5 w-5" />}
              </button>
            )}
          </div>

          {/* Bottom sheet */}
          <div className="z-30 rounded-t-3xl bg-white px-4 pb-7 pt-4 shadow-[0_-12px_40px_rgba(0,0,0,0.12)]">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-gray-200" />
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-[15px] font-bold text-gray-900">{title}</h3>
              <button
                type="button"
                onClick={onClose}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-gray-500"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-4 flex items-start gap-3 rounded-2xl border border-gray-100 bg-gray-50 p-3">
              <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-[#2563EB]" />
              <div className="min-w-0 flex-1">
                {resolving ? (
                  <div className="flex items-center gap-2 text-[13px] font-medium text-gray-400">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Locating address…
                  </div>
                ) : selected ? (
                  <>
                    <p className="truncate text-[14px] font-bold text-gray-900">{selected.title || "Selected location"}</p>
                    <p className="text-[12px] leading-snug text-gray-500">{selected.address}</p>
                  </>
                ) : (
                  <p className="text-[13px] font-medium text-gray-400">Move the map to set the location</p>
                )}
              </div>
            </div>

            <PrimaryButton disabled={!selected || resolving || !hasCoordinates(selected)} onClick={handleConfirm}>
              {confirmLabel}
            </PrimaryButton>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
