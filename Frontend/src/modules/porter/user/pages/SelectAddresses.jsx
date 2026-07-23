import React, { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, Home, Briefcase, Clock, Navigation } from "lucide-react";
import { toast } from "sonner";
import Screen from "../components/Screen";
import PorterRouteMap from "../components/PorterRouteMap";
import PorterLiveMap from "../components/PorterLiveMap";
import PorterPlacesAutocomplete from "../components/PorterPlacesAutocomplete";
import { PrimaryButton, StickyBar } from "../components/ui";
import { useBooking } from "../context/BookingContext";
import { usePorterCurrentLocation } from "../hooks/usePorterCurrentLocation";
import { getPorterParcelDetailsPath, getPorterSavedPlacesPath } from "../utils/routes";
import { hasCoordinates } from "../utils/location";
import { userAPI } from "../../../../services/api";
import porterUserApi from "../services/userApi";

function AddressFieldCard({
  field,
  activeField,
  onActivate,
  icon,
  label,
  location,
  locating,
  query,
  onQueryChange,
  onSelect,
  onUseCurrentLocation,
  usingCurrentLocation,
  placeholder,
  serviceError,
  checking,
}) {
  const isActive = activeField === field;
  const hasLocation = Boolean(location?.address) || hasCoordinates(location);

  return (
    <div
      className={`rounded-2xl border transition ${
        serviceError
          ? "border-red-400 bg-red-50"
          : isActive
            ? "border-[#2563EB] bg-[#EFF6FF]"
            : "border-gray-100 bg-white"
      }`}
    >
      <button
        type="button"
        onClick={() => onActivate(field)}
        className="flex w-full items-start gap-3 p-3 text-left"
      >
        {icon}
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase text-gray-400">{label}</p>
          {locating && !hasLocation ? (
            <p className="text-[14px] font-bold text-gray-400">Detecting your location...</p>
          ) : hasLocation ? (
            <>
              <p className="text-[14px] font-bold text-gray-900">{location.title || "Current Location"}</p>
              <p className="truncate text-[12px] text-gray-500">{location.address || "Finding address…"}</p>
            </>
          ) : (
            <p className="text-[14px] font-bold text-gray-400">{placeholder}</p>
          )}
          {checking && <p className="mt-1 text-[11px] font-semibold text-amber-600">Checking service area…</p>}
          {serviceError && (
            <p className="mt-1 text-[11px] font-semibold text-red-600">{serviceError}</p>
          )}
        </div>
      </button>

      {isActive && (
        <div className="space-y-2 border-t border-[#2563EB]/10 px-3 pb-3 pt-2">
          <PorterPlacesAutocomplete
            value={query}
            onChange={onQueryChange}
            onSelect={onSelect}
            placeholder={`Search ${field} area, street, landmark`}
          />
          {field === "pickup" && (
            <button
              type="button"
              onClick={onUseCurrentLocation}
              disabled={usingCurrentLocation}
              className="flex w-full items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-[13px] font-bold text-[#2563EB] transition active:scale-[0.99] disabled:opacity-60"
            >
              {usingCurrentLocation ? (
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[#2563EB] border-t-transparent" />
              ) : (
                <Navigation className="h-4 w-4" />
              )}
              Use current location
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const OUTSIDE_MSG = {
  pickup: "Pickup location is outside our service area.",
  drop: "Delivery location is outside our service area.",
};

export default function SelectAddresses() {
  const navigate = useNavigate();
  const { pickup, setPickup, delivery, setDelivery, routeQuote } = useBooking();
  const [activeField, setActiveField] = useState("pickup");
  const [pickupQuery, setPickupQuery] = useState("");
  const [deliveryQuery, setDeliveryQuery] = useState("");
  const [savedPlaces, setSavedPlaces] = useState([]);
  const [usingCurrentLocation, setUsingCurrentLocation] = useState(false);
  const [pickupError, setPickupError] = useState(null);
  const [deliveryError, setDeliveryError] = useState(null);
  const [checkingPickup, setCheckingPickup] = useState(false);
  const [checkingDelivery, setCheckingDelivery] = useState(false);

  const assertServiceable = useCallback(async (location, field) => {
    if (!hasCoordinates(location)) {
      // Need coords for geo check — allow selection but continue will require coords.
      return true;
    }
    const setErr = field === "pickup" ? setPickupError : setDeliveryError;
    const setChecking = field === "pickup" ? setCheckingPickup : setCheckingDelivery;
    setChecking(true);
    setErr(null);
    try {
      const result = await porterUserApi.detectZone(location.lat, location.lng);
      const status = result?.status || result?.data?.status;
      if (status !== "IN_SERVICE") {
        const message = OUTSIDE_MSG[field];
        setErr(message);
        toast.error("NOT SERVICEABLE", {
          description: "This location is currently outside our Porter delivery service area. Please choose another address.",
        });
        return false;
      }
      setErr(null);
      return true;
    } catch (err) {
      const message = err?.response?.data?.message || OUTSIDE_MSG[field];
      setErr(message);
      toast.error("NOT SERVICEABLE", {
        description: message,
      });
      return false;
    } finally {
      setChecking(false);
    }
  }, []);

  const applyPickup = useCallback(async (location) => {
    const ok = await assertServiceable(location, "pickup");
    if (!ok) {
      setPickup(null);
      return;
    }
    setPickup(location);
    setPickupQuery("");
  }, [assertServiceable, setPickup]);

  const applyDelivery = useCallback(async (location) => {
    const ok = await assertServiceable(location, "drop");
    if (!ok) {
      setDelivery(null);
      return;
    }
    setDelivery(location);
    setDeliveryQuery("");
  }, [assertServiceable, setDelivery]);

  const { loading: pickupLocating, resolveCurrentLocation } = usePorterCurrentLocation({
    enabled: false,
    initialLocation: pickup,
    onResolved: async (location) => {
      await applyPickup(location);
    },
  });

  React.useEffect(() => {
    const fetchPlaces = async () => {
      try {
        const response = await userAPI.getAddresses();
        const data = response?.data?.data?.addresses || response?.data?.addresses || [];
        const mapped = data.map((a) => ({
          id: a._id,
          label: a.type || "Other",
          title: a.name || a.type || "Other",
          address: [a.street, a.address, a.city].filter(Boolean).join(", "),
          lat: a.latitude ?? a.lat,
          lng: a.longitude ?? a.lng,
          type: a.type === "home" ? "home" : a.type === "work" ? "work" : "other",
        }));
        setSavedPlaces(mapped);
      } catch (err) {
        console.error("Failed to fetch addresses:", err);
      }
    };
    fetchPlaces();
  }, []);

  // Re-validate stored draft locations on mount (blocks stale out-of-zone drafts).
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      if (hasCoordinates(pickup) && !cancelled) {
        const ok = await assertServiceable(pickup, "pickup");
        if (!ok && !cancelled) setPickup(null);
      }
      if (hasCoordinates(delivery) && !cancelled) {
        const ok = await assertServiceable(delivery, "drop");
        if (!ok && !cancelled) setDelivery(null);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once for draft recovery
  }, []);

  const activeQuery = activeField === "pickup" ? pickupQuery : deliveryQuery;
  const suggestions = activeQuery
    ? savedPlaces.filter(
      (s) =>
        (s.title || "").toLowerCase().includes(activeQuery.toLowerCase()) ||
        (s.address || "").toLowerCase().includes(activeQuery.toLowerCase()),
    )
    : savedPlaces;

  const selectPlace = async (place) => {
    const entry = {
      title: place.title || place.label,
      address: place.address,
      ...(hasCoordinates(place) ? { lat: Number(place.lat), lng: Number(place.lng) } : {}),
      ...(place.placeId ? { placeId: place.placeId } : {}),
    };
    if (activeField === "pickup") {
      await applyPickup(entry);
    } else {
      await applyDelivery(entry);
    }
  };

  const handleUseCurrentLocation = async () => {
    setUsingCurrentLocation(true);
    try {
      await resolveCurrentLocation({ force: true });
      setPickupQuery("");
    } catch {
      // hook handles error state
    } finally {
      setUsingCurrentLocation(false);
    }
  };

  const serviceable =
    Boolean(pickup?.address && delivery?.address)
    && !pickupError
    && !deliveryError
    && !checkingPickup
    && !checkingDelivery;

  const canContinue = serviceable && hasCoordinates(pickup) && hasCoordinates(delivery);
  const hasRoute = hasCoordinates(pickup) && hasCoordinates(delivery);

  const handleContinue = async () => {
    if (!canContinue) {
      toast.error("Selected locations are outside our service area.");
      return;
    }
    // Final dual check before leaving the page.
    const [okPickup, okDrop] = await Promise.all([
      assertServiceable(pickup, "pickup"),
      assertServiceable(delivery, "drop"),
    ]);
    if (!okPickup || !okDrop) return;
    navigate(getPorterParcelDetailsPath());
  };

  return (
    <Screen title="Pickup & delivery" subtitle="Set parcel route">
      {hasRoute ? (
        <PorterRouteMap
          pickup={pickup}
          delivery={delivery}
          routeQuote={routeQuote}
          height={280}
          className="mb-4"
        />
      ) : (
        <PorterLiveMap height={220} className="mb-4" />
      )}

      <div className="mb-4 space-y-3">
        <AddressFieldCard
          field="pickup"
          activeField={activeField}
          onActivate={setActiveField}
          icon={<MapPin className="mt-0.5 h-5 w-5 shrink-0 text-[#2e7d32]" />}
          label="Pickup"
          location={pickup}
          locating={pickupLocating}
          query={pickupQuery}
          onQueryChange={setPickupQuery}
          onSelect={applyPickup}
          onUseCurrentLocation={handleUseCurrentLocation}
          usingCurrentLocation={usingCurrentLocation}
          placeholder="Enter pickup address"
          serviceError={pickupError}
          checking={checkingPickup}
        />
        <AddressFieldCard
          field="delivery"
          activeField={activeField}
          onActivate={setActiveField}
          icon={<MapPin className="mt-0.5 h-5 w-5 shrink-0 text-[#2563EB]" />}
          label="Drop"
          location={delivery}
          locating={false}
          query={deliveryQuery}
          onQueryChange={setDeliveryQuery}
          onSelect={applyDelivery}
          usingCurrentLocation={false}
          placeholder="Enter drop address"
          serviceError={deliveryError}
          checking={checkingDelivery}
        />
      </div>

      {(pickupError || deliveryError) && (
        <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4">
          <p className="text-[14px] font-extrabold text-red-700">NOT SERVICEABLE</p>
          <p className="mt-1 text-[12px] text-red-600">
            This location is currently outside our Porter delivery service area. Please choose another address.
          </p>
        </div>
      )}

      <div className="mb-3 flex items-center justify-between">
        <p className="text-[12px] font-bold uppercase tracking-wide text-gray-400">Saved places</p>
        <button
          type="button"
          onClick={() => navigate(getPorterSavedPlacesPath())}
          className="text-[12px] font-bold text-[#2563EB]"
        >
          Manage
        </button>
      </div>

      <div className="mb-24 space-y-2">
        {suggestions.map((place) => (
          <button
            key={place.id || place.address}
            type="button"
            onClick={() => selectPlace(place)}
            className="flex w-full items-center gap-3 rounded-2xl border border-gray-100 bg-white p-3 text-left transition hover:border-gray-200"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-50">
              {place.type === "home" ? (
                <Home className="h-4 w-4 text-[#2563EB]" />
              ) : place.type === "work" ? (
                <Briefcase className="h-4 w-4 text-[#2563EB]" />
              ) : (
                <Clock className="h-4 w-4 text-gray-500" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-bold text-gray-900">{place.title || place.label}</p>
              <p className="truncate text-[12px] text-gray-500">{place.address}</p>
            </div>
          </button>
        ))}
      </div>

      <StickyBar>
        <PrimaryButton disabled={!canContinue} onClick={handleContinue}>
          Continue to parcel details
        </PrimaryButton>
      </StickyBar>
    </Screen>
  );
}
