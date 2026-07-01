import React, { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { loadGoogleMaps } from "@core/services/googleMapsLoader";
import { hasCoordinates } from "../utils/location";
import { blazeMarkerIcon, PICKUP_COLOR, DROP_COLOR } from "./PorterMapMarker";

export default function PorterRouteMap({
  pickup,
  delivery,
  routeQuote = null,
  height = 180,
  className = "",
}) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const polylineRef = useRef(null);
  const pickupMarkerRef = useRef(null);
  const dropMarkerRef = useRef(null);
  const directionsRendererRef = useRef(null);
  const lastFitPolylineRef = useRef(null);
  const mapReadyRef = useRef(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const previewText = routeQuote?.route?.distanceText && routeQuote?.route?.durationText
    ? `${routeQuote.route.distanceText} · ${routeQuote.route.durationText}`
    : "";

  useEffect(() => {
    if (!hasCoordinates(pickup) || !hasCoordinates(delivery)) {
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    setError("");

    const initMap = async () => {
      const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        setError("Route preview unavailable.");
        setLoading(false);
        return;
      }

      try {
        await loadGoogleMaps(apiKey);
        if (cancelled || !mapContainerRef.current) return;

        const origin = { lat: Number(pickup.lat), lng: Number(pickup.lng) };
        const map = new window.google.maps.Map(mapContainerRef.current, {
          center: origin,
          zoom: 13,
          disableDefaultUI: true,
          zoomControl: true,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
        });
        mapRef.current = map;
        mapReadyRef.current = true;
        setLoading(false);
      } catch (err) {
        console.error("[PorterRouteMap] init failed:", err);
        if (!cancelled) {
          setError("Unable to load route preview.");
          setLoading(false);
        }
      }
    };

    initMap();

    return () => {
      cancelled = true;
      mapReadyRef.current = false;
      directionsRendererRef.current = null;
      polylineRef.current = null;
      pickupMarkerRef.current = null;
      dropMarkerRef.current = null;
      mapRef.current = null;
      lastFitPolylineRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapReadyRef.current || !mapRef.current || !hasCoordinates(pickup) || !hasCoordinates(delivery)) {
      return undefined;
    }

    const origin = { lat: Number(pickup.lat), lng: Number(pickup.lng) };
    const destination = { lat: Number(delivery.lat), lng: Number(delivery.lng) };

    if (!pickupMarkerRef.current) {
      pickupMarkerRef.current = new window.google.maps.Marker({
        map: mapRef.current,
        position: origin,
        title: pickup.title || "Pickup",
        icon: blazeMarkerIcon(PICKUP_COLOR),
      });
    } else {
      pickupMarkerRef.current.setPosition(origin);
    }

    if (!dropMarkerRef.current) {
      dropMarkerRef.current = new window.google.maps.Marker({
        map: mapRef.current,
        position: destination,
        title: delivery.title || "Delivery",
        icon: blazeMarkerIcon(DROP_COLOR),
      });
    } else {
      dropMarkerRef.current.setPosition(destination);
    }

    const encodedPolyline = routeQuote?.route?.polyline;
    if (encodedPolyline && window.google.maps.geometry?.encoding) {
      if (directionsRendererRef.current) {
        directionsRendererRef.current.setMap(null);
        directionsRendererRef.current = null;
      }

      const path = window.google.maps.geometry.encoding.decodePath(encodedPolyline);
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

      if (lastFitPolylineRef.current !== encodedPolyline) {
        const bounds = new window.google.maps.LatLngBounds();
        path.forEach((p) => bounds.extend(p));
        mapRef.current.fitBounds(bounds, 32);
        lastFitPolylineRef.current = encodedPolyline;
      }
      setError("");
      return undefined;
    }

    if (polylineRef.current) {
      polylineRef.current.setMap(null);
      polylineRef.current = null;
      lastFitPolylineRef.current = null;
    }

    if (!directionsRendererRef.current) {
      const directionsService = new window.google.maps.DirectionsService();
      const directionsRenderer = new window.google.maps.DirectionsRenderer({
        map: mapRef.current,
        suppressMarkers: true,
        preserveViewport: true,
        polylineOptions: {
          strokeColor: "#FF0000",
          strokeWeight: 5,
          strokeOpacity: 0.9,
        },
      });
      directionsRendererRef.current = directionsRenderer;

      directionsService.route(
        {
          origin,
          destination,
          travelMode: window.google.maps.TravelMode.DRIVING,
        },
        (result, status) => {
          if (status === "OK" && result) {
            directionsRenderer.setDirections(result);
            setError("");
            return;
          }
          setError("Unable to preview route.");
        },
      );
    }

    return undefined;
  }, [pickup?.lat, pickup?.lng, delivery?.lat, delivery?.lng, routeQuote?.route?.polyline]);

  if (!hasCoordinates(pickup) || !hasCoordinates(delivery)) {
    return null;
  }

  return (
    <div className={`relative overflow-hidden rounded-2xl border border-gray-100 bg-white ${className}`}>
      <div ref={mapContainerRef} style={{ height, width: "100%" }} />
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80">
          <Loader2 className="h-6 w-6 animate-spin text-[#FF0000]" />
        </div>
      )}
      {!loading && error && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-gray-50 px-4 text-center text-[12px] font-medium text-gray-500">
          {error}
        </div>
      )}
      <div className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-gray-600 shadow-sm">
        Route preview
      </div>
      {previewText && !error && (
        <div className="absolute bottom-3 left-3 rounded-full bg-[#FF0000] px-3 py-1 text-[11px] font-bold text-white shadow-sm">
          {previewText}
        </div>
      )}
    </div>
  );
}
