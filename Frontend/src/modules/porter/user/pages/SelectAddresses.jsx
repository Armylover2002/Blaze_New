import React, { useState } from "react";

import { useNavigate } from "react-router-dom";

import { MapPin, Home, Briefcase, Clock, Navigation } from "lucide-react";

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

}) {

  const isActive = activeField === field;

  const hasLocation = Boolean(location?.address) || hasCoordinates(location);



  return (

    <div

      className={`rounded-2xl border transition ${isActive ? "border-[#FF0000] bg-[#FFF1F1]" : "border-gray-100 bg-white"}`}

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

        </div>

      </button>



      {isActive && (

        <div className="space-y-2 border-t border-[#FF0000]/10 px-3 pb-3 pt-2">

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

              className="flex w-full items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-[13px] font-bold text-[#FF0000] transition active:scale-[0.99] disabled:opacity-60"

            >

              {usingCurrentLocation ? (

                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[#FF0000] border-t-transparent" />

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



export default function SelectAddresses() {

  const navigate = useNavigate();

  const { pickup, setPickup, delivery, setDelivery, routeQuote } = useBooking();

  const [activeField, setActiveField] = useState("pickup");

  const [pickupQuery, setPickupQuery] = useState("");

  const [deliveryQuery, setDeliveryQuery] = useState("");

  const [savedPlaces, setSavedPlaces] = useState([]);

  const [usingCurrentLocation, setUsingCurrentLocation] = useState(false);



  const { loading: pickupLocating, resolveCurrentLocation } = usePorterCurrentLocation({
    enabled: false,
    initialLocation: pickup,
    onResolved: setPickup,
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



  const activeQuery = activeField === "pickup" ? pickupQuery : deliveryQuery;

  const suggestions = activeQuery

    ? savedPlaces.filter(

        (s) =>

          (s.title || "").toLowerCase().includes(activeQuery.toLowerCase()) ||

          (s.address || "").toLowerCase().includes(activeQuery.toLowerCase()),

      )

    : savedPlaces;



  const selectPlace = (place) => {

    const entry = {

      title: place.title || place.label,

      address: place.address,

      ...(hasCoordinates(place) ? { lat: Number(place.lat), lng: Number(place.lng) } : {}),

      ...(place.placeId ? { placeId: place.placeId } : {}),

    };

    if (activeField === "pickup") {

      setPickup(entry);

      setPickupQuery("");

    } else {

      setDelivery(entry);

      setDeliveryQuery("");

    }

  };



  const handlePickupSelect = (location) => {
    setPickup(location);
    setPickupQuery("");
  };

  const handleDeliverySelect = (location) => {
    setDelivery(location);
    setDeliveryQuery("");
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



  const canContinue = Boolean(pickup?.address && delivery?.address);

  const hasRoute = hasCoordinates(pickup) && hasCoordinates(delivery);



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

        <PorterLiveMap location={pickup} height={280} className="mb-4" />

      )}



      <div className="mb-4 space-y-3">

        <AddressFieldCard

          field="pickup"

          activeField={activeField}

          onActivate={setActiveField}

          icon={<span className="mt-1 h-3 w-3 shrink-0 rounded-full bg-[#2e7d32]" />}

          label="Pickup location"

          location={pickup}

          locating={pickupLocating}

          query={pickupQuery}

          onQueryChange={setPickupQuery}

          onSelect={handlePickupSelect}

          onUseCurrentLocation={handleUseCurrentLocation}

          usingCurrentLocation={usingCurrentLocation}

          placeholder="Set pickup location"

        />



        <AddressFieldCard

          field="delivery"

          activeField={activeField}

          onActivate={setActiveField}

          icon={<MapPin className="mt-0.5 h-5 w-5 shrink-0 text-[#FF0000]" />}

          label="Delivery location"

          location={delivery}

          locating={false}

          query={deliveryQuery}

          onQueryChange={setDeliveryQuery}

          onSelect={handleDeliverySelect}

          placeholder="Where should we deliver?"

        />

      </div>



      <div className="mb-3">

        <button

          type="button"

          onClick={() => navigate(getPorterSavedPlacesPath())}

          className="flex items-center gap-2 text-[12px] font-bold text-[#FF0000]"

        >

          <Home className="h-4 w-4" /> Manage saved places

        </button>

      </div>



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

