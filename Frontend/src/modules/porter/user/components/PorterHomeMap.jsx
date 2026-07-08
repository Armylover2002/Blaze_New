import React, { useEffect, useRef, useState } from "react";
import { Loader2, Navigation } from "lucide-react";
import { loadGoogleMaps } from "@core/services/googleMapsLoader";
import { useBooking } from "../context/BookingContext";
import { hasCoordinates, hasMovedSignificantly } from "../utils/location";
import { usePorterCurrentLocation } from "../hooks/usePorterCurrentLocation";
import { blazeMarkerIcon, PICKUP_COLOR, DROP_COLOR, CenterPin } from "./PorterMapMarker";

export default function PorterHomeMap({ height = 320, className = "" }) {
  const { pickup, delivery, setPickup, routeQuote } = useBooking();
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const pickupMarkerRef = useRef(null);
  const dropMarkerRef = useRef(null);
  const polylineRef = useRef(null);
  const lastPanRef = useRef(null);
  const lastFitPolylineRef = useRef(null);
  const mapReadyRef = useRef(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [fetchingLocation, setFetchingLocation] = useState(false);

  const { resolveCurrentLocation } = usePorterCurrentLocation({
    enabled: false,
    initialLocation: pickup,
    onResolved: setPickup,
  });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    const init = async () => {
      const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        setError("Map unavailable.");
        setLoading(false);
        return;
      }

      try {
        await loadGoogleMaps(apiKey);
        if (cancelled || !mapContainerRef.current) return;

        const center = hasCoordinates(pickup)
          ? { lat: Number(pickup.lat), lng: Number(pickup.lng) }
          : { lat: 20.5937, lng: 78.9629 };

        const map = new window.google.maps.Map(mapContainerRef.current, {
          center,
          zoom: hasCoordinates(pickup) ? 16 : 12,
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
        mapReadyRef.current = true;
        if (hasCoordinates(pickup)) {
          lastPanRef.current = { lat: Number(pickup.lat), lng: Number(pickup.lng) };
        }
        setLoading(false);
      } catch (err) {
        console.error("[PorterHomeMap] init failed:", err);
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
      polylineRef.current = null;
      pickupMarkerRef.current = null;
      dropMarkerRef.current = null;
      mapRef.current = null;
      lastPanRef.current = null;
      lastFitPolylineRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapReadyRef.current || !mapRef.current || !window.google?.maps) return;

    const polyline = routeQuote?.route?.polyline;
    const hasRoutePolyline = Boolean(polyline && window.google.maps.geometry?.encoding);

    if (hasCoordinates(pickup)) {
      const position = { lat: Number(pickup.lat), lng: Number(pickup.lng) };
      
      if (!hasRoutePolyline && (!lastPanRef.current || hasMovedSignificantly(lastPanRef.current, position))) {
        mapRef.current.panTo(position);
        lastPanRef.current = position;
      }

      if (hasRoutePolyline) {
        if (!pickupMarkerRef.current) {
          pickupMarkerRef.current = new window.google.maps.Marker({
            map: mapRef.current,
            position,
            title: pickup.title || "Pickup",
            icon: blazeMarkerIcon(PICKUP_COLOR),
          });
        } else {
          pickupMarkerRef.current.setPosition(position);
        }
      } else if (pickupMarkerRef.current) {
        pickupMarkerRef.current.setMap(null);
        pickupMarkerRef.current = null;
      }
    }

    if (hasCoordinates(delivery)) {
      const position = { lat: Number(delivery.lat), lng: Number(delivery.lng) };
      if (!dropMarkerRef.current) {
        dropMarkerRef.current = new window.google.maps.Marker({
          map: mapRef.current,
          position,
          title: delivery.title || "Delivery",
          icon: blazeMarkerIcon(DROP_COLOR),
        });
      } else {
        dropMarkerRef.current.setPosition(position);
      }
    } else if (dropMarkerRef.current) {
      dropMarkerRef.current.setMap(null);
      dropMarkerRef.current = null;
    }

    if (hasRoutePolyline) {
      const path = window.google.maps.geometry.encoding.decodePath(polyline);
      if (polylineRef.current) {
        polylineRef.current.setPath(path);
      } else {
        polylineRef.current = new window.google.maps.Polyline({
          map: mapRef.current,
          path,
          strokeColor: "#FF0000",
          strokeWeight: 5,
          strokeOpacity: 0.9,
        });
      }

      if (lastFitPolylineRef.current !== polyline) {
        const bounds = new window.google.maps.LatLngBounds();
        path.forEach((p) => bounds.extend(p));
        mapRef.current.fitBounds(bounds, 56);
        lastFitPolylineRef.current = polyline;
      }
    } else if (polylineRef.current) {
      polylineRef.current.setMap(null);
      polylineRef.current = null;
      lastFitPolylineRef.current = null;
    }
  }, [pickup, delivery, routeQuote?.route?.polyline, loading]);

  const handleMyLocation = async (e) => {
    if (e) e.stopPropagation();
    setFetchingLocation(true);
    try {
      const location = await resolveCurrentLocation({ force: true });
      if (location) {
        setPickup(location);
        if (mapRef.current) {
          const next = { lat: Number(location.lat), lng: Number(location.lng) };
          mapRef.current.panTo(next);
          mapRef.current.setZoom(16);
          lastPanRef.current = next;
        }
      }
    } catch {
      // hook surfaces its own error state
    } finally {
      setFetchingLocation(false);
    }
  };

  const stopMapClick = (e) => e.stopPropagation();

  return (
    <div className={`relative overflow-hidden ${className}`} onClick={stopMapClick} onKeyDown={stopMapClick} role="presentation">
      <div ref={mapContainerRef} style={{ height, width: "100%" }} />

      {!routeQuote?.route?.polyline && <CenterPin color={PICKUP_COLOR} />}

      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80">
          <Loader2 className="h-6 w-6 animate-spin text-[#FF0000]" />
        </div>
      )}
      {!loading && error && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-gray-50 text-[12px] text-gray-500">
          {error}
        </div>
      )}

      {!loading && !error && (
        <button
          type="button"
          onClick={handleMyLocation}
          disabled={fetchingLocation}
          aria-label="Use current location"
          className="absolute bottom-4 left-4 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#FF0000] shadow-lg active:scale-95 disabled:opacity-60"
        >
          {fetchingLocation ? <Loader2 className="h-5 w-5 animate-spin" /> : <Navigation className="h-5 w-5" />}
        </button>
      )}

      {routeQuote?.route?.distanceText && routeQuote?.route?.durationText && (
        <div className="absolute bottom-3 left-3 z-20 rounded-full bg-[#FF0000] px-3 py-1 text-[11px] font-bold text-white shadow-md">
          {routeQuote.route.distanceText} · {routeQuote.route.durationText}
        </div>
      )}
    </div>
  );
}
