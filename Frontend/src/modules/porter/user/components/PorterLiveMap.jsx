import React, { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { loadGoogleMaps } from "@core/services/googleMapsLoader";
import { hasCoordinates, hasMovedSignificantly } from "../utils/location";
import { blazeMarkerIcon, PICKUP_COLOR } from "./PorterMapMarker";

export default function PorterLiveMap({
  location,
  height = 280,
  className = "",
}) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const lastPanRef = useRef(null);
  const mapReadyRef = useRef(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    const init = async () => {
      const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        setError("Google Maps is not configured.");
        setLoading(false);
        return;
      }

      try {
        await loadGoogleMaps(apiKey);
        if (cancelled || !mapContainerRef.current) return;

        const center = hasCoordinates(location)
          ? { lat: Number(location.lat), lng: Number(location.lng) }
          : { lat: 20.5937, lng: 78.9629 };

        const map = new window.google.maps.Map(mapContainerRef.current, {
          center,
          zoom: hasCoordinates(location) ? 16 : 12,
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: "greedy",
          clickableIcons: false,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
        });
        mapRef.current = map;
        mapReadyRef.current = true;

        if (hasCoordinates(location)) {
          markerRef.current = new window.google.maps.Marker({
            map,
            position: center,
            title: location.title || "Location",
            icon: blazeMarkerIcon(PICKUP_COLOR),
          });
          lastPanRef.current = center;
        }

        // Ensure map tiles render correctly after container layout
        requestAnimationFrame(() => {
          window.google?.maps?.event?.trigger(map, "resize");
          if (hasCoordinates(location)) map.setCenter(center);
        });

        setLoading(false);
      } catch (err) {
        console.error("[PorterLiveMap] init failed:", err);
        if (!cancelled) {
          setError("Unable to load map.");
          setLoading(false);
        }
      }
    };

    init();

    return () => {
      cancelled = true;
      mapReadyRef.current = false;
      markerRef.current = null;
      mapRef.current = null;
      lastPanRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mapReadyRef.current || !mapRef.current || !hasCoordinates(location)) return;

    const position = { lat: Number(location.lat), lng: Number(location.lng) };

    if (markerRef.current) {
      markerRef.current.setPosition(position);
    } else {
      markerRef.current = new window.google.maps.Marker({
        map: mapRef.current,
        position,
        title: location.title || "Location",
        icon: blazeMarkerIcon(PICKUP_COLOR),
      });
    }

    if (!lastPanRef.current || hasMovedSignificantly(lastPanRef.current, position)) {
      mapRef.current.panTo(position);
      mapRef.current.setZoom(16);
      lastPanRef.current = position;
    }
  }, [location]);

  return (
    <div className={`relative w-full overflow-hidden rounded-2xl border border-gray-100 bg-white ${className}`}>
      <div ref={mapContainerRef} className="w-full" style={{ height, minHeight: height }} />
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80">
          <Loader2 className="h-6 w-6 animate-spin text-[#2563EB]" />
        </div>
      )}
      {!loading && error && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-gray-50 px-4 text-center text-[12px] font-medium text-gray-500">
          {error}
        </div>
      )}
    </div>
  );
}
