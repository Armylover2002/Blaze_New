import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { customerApi } from "../services/customerApi";
import { useAuth } from "@core/context/AuthContext";
import { userAPI } from "@food/api";
import { getCachedUserAddresses } from "@food/utils/userSessionCache";

const LocationContext = createContext(undefined);
// v2 key to force one-time refresh from Google Maps for users
// who previously only had the default/static location cached.
const STORAGE_KEY = "location_v2";

const normalizeAddressLabel = (label = "") => {
  const normalized = String(label || "").trim().toLowerCase();
  if (normalized === "home") return "Home";
  if (normalized === "office" || normalized === "work") return "Office";
  return "Other";
};

const mapSharedAddress = (addr = {}, idx = 0, profile = {}) => {
  const geoCoords = Array.isArray(addr?.location?.coordinates)
    ? addr.location.coordinates
    : null;
  const geoLat =
    typeof geoCoords?.[1] === "number" && Number.isFinite(geoCoords[1])
      ? geoCoords[1]
      : null;
  const geoLng =
    typeof geoCoords?.[0] === "number" && Number.isFinite(geoCoords[0])
      ? geoCoords[0]
      : null;

  const location =
    addr?.location &&
    typeof addr.location.lat === "number" &&
    typeof addr.location.lng === "number" &&
    Number.isFinite(addr.location.lat) &&
    Number.isFinite(addr.location.lng)
      ? { lat: addr.location.lat, lng: addr.location.lng }
      : geoLat !== null && geoLng !== null
        ? { lat: geoLat, lng: geoLng }
        : null;

  const addressText =
    addr.formattedAddress ||
    addr.address ||
    addr.fullAddress ||
    [
      addr.label,
      addr.additionalDetails,
      addr.street,
      addr.landmark,
      addr.city,
      addr.state,
      addr.zipCode || addr.pincode,
    ]
      .filter(Boolean)
      .join(", ") ||
    "";

  return {
    id: addr._id ?? addr.id ?? String(idx),
    label: normalizeAddressLabel(addr.label),
    address: addressText,
    location,
    placeId: typeof addr?.placeId === "string" ? addr.placeId : null,
    phone: profile?.phone ?? addr?.phone ?? "",
    name: profile?.name ?? addr?.name ?? addr?.fullName ?? "",
    isCurrent: addr.isDefault === true || idx === 0,
    isDefault: addr.isDefault === true,
  };
};

export const LocationProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  // Default location (used until we can resolve a better one)
  const [currentLocation, setCurrentLocation] = useState({
    name: "214, Rajshri Palace Colony, Pipliyahana, Indore, Madhya Pradesh 452018, India",
    time: "12-15 mins",
    city: "Indore",
    state: "Madhya Pradesh",
    pincode: "452018",
    latitude: 22.711140989838025,
    longitude: 75.9001552518043,
  });

  // Address list for drawer UI – will be hydrated from profile API.
  const [savedAddresses, setSavedAddresses] = useState([]);

  const [isFetchingLocation, setIsFetchingLocation] = useState(false);
  const [locationError, setLocationError] = useState(null);

  // Update the current location.
  // By default this does NOT change saved addresses; only explicit
  // address actions should touch the saved list.
  const updateLocation = (
    newLoc,
    { persist = true, updateSavedHome = false } = {},
  ) => {
    setCurrentLocation(newLoc);

    if (updateSavedHome) {
      setSavedAddresses((prev) =>
        prev.map((addr) =>
          addr.label === "Home" ? { ...addr, address: newLoc.name } : addr,
        ),
      );
    }

    if (persist && typeof window !== "undefined") {
      try {
        const payload = {
          address: newLoc.name,
          city: newLoc.city,
          state: newLoc.state,
          pincode: newLoc.pincode,
          latitude: newLoc.latitude,
          longitude: newLoc.longitude,
          // Internal app properties
          time: newLoc.time,
        };
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      } catch {
        // ignore storage errors
      }
    }
  };

  const addAddress = (newAddress) => {
    setSavedAddresses((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        label: newAddress.label || "Other",
        address: newAddress.address,
        phone: newAddress.phone || "N/A",
        isCurrent: false,
      },
    ]);
  };

  // Resolve location once using browser geolocation + Google Maps Geocoding.
  // Must be called directly from a user gesture (click/tap) for the browser to show the permission prompt.
  const fetchAndCacheLocation = () =>
    new Promise((resolve) => {
      if (
        typeof window === "undefined" ||
        !("navigator" in window) ||
        !navigator.geolocation
      ) {
        resolve({
          ok: false,
          error: "Geolocation is not supported on this device",
        });
        return;
      }

      setIsFetchingLocation(true);
      setLocationError(null);

      // Call getCurrentPosition immediately - must run in same synchronous stack as user click
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const fallbackFromCoords = (latitude, longitude) => ({
            name: `Lat ${Number(latitude).toFixed(5)}, Lng ${Number(longitude).toFixed(5)}`,
            time: "12-15 mins",
            city: currentLocation?.city || "Indore",
            state: currentLocation?.state || "Madhya Pradesh",
            pincode: currentLocation?.pincode || "452018",
            latitude,
            longitude,
          });

          try {
            const { latitude, longitude } = position.coords;

            // Always succeed with coordinates (needed for delivery fee calculation),
            // even if reverse geocoding fails (key missing / quota / restrictions).
            let liveLocation = fallbackFromCoords(latitude, longitude);

            try {
              const response = await customerApi.reverseGeocode(latitude, longitude);
              const geo = response?.data?.data;
              if (geo?.formattedAddress) {
                liveLocation = {
                  name: geo.formattedAddress,
                  time: "12-15 mins",
                  city: geo.city || liveLocation.city,
                  state: geo.state || liveLocation.state,
                  pincode: geo.pincode || liveLocation.pincode,
                  latitude,
                  longitude,
                };
              }
            } catch (geocodeErr) {
              console.warn("Reverse geocode failed, using coordinates only:", geocodeErr?.message);
            }

            updateLocation(liveLocation, {
              persist: true,
              updateSavedHome: false,
            });
            resolve({ ok: true, location: liveLocation });
          } catch (err) {
            // Coordinates were obtained, but reverse geocoding failed.
            // Still treat this as success so downstream pricing can use lat/lng.
            const { latitude, longitude } = position.coords;
            const loc = fallbackFromCoords(latitude, longitude);
            updateLocation(loc, { persist: true, updateSavedHome: false });
            resolve({
              ok: true,
              location: loc,
              warning: err?.message || "Unable to fetch address",
            });
          } finally {
            setIsFetchingLocation(false);
          }
        },
        (error) => {
          const message = error.message || "Location permission denied";
          setLocationError(message);
          setIsFetchingLocation(false);
          resolve({ ok: false, error: message });
        },
        {
          enableHighAccuracy: true,
          timeout: 20000,
          maximumAge: 0,
        },
      );
    });

  const refreshAddresses = useCallback(async (forceRefresh = false) => {
    if (!isAuthenticated) {
      setSavedAddresses([]);
      return [];
    }

    const userId = user?._id?.toString() || user?.userId || user?.id || null;

    if (!forceRefresh) {
      const sessionCached = getCachedUserAddresses();
      if (sessionCached?.length) {
        const normalized = sessionCached.map((addr, idx) =>
          mapSharedAddress(addr, idx, user || {}),
        );
        setSavedAddresses(normalized);
        return normalized;
      }
    }

    try {
      if (forceRefresh) {
        userAPI.getAddresses.invalidateCache?.();
      }
      const addressesResponse = await userAPI.getAddresses();
      const sharedAddresses =
        addressesResponse?.data?.data?.addresses ||
        addressesResponse?.data?.addresses ||
        [];
      const normalizedShared = Array.isArray(sharedAddresses)
        ? sharedAddresses.map((addr, idx) => mapSharedAddress(addr, idx, user))
        : [];

      setSavedAddresses(normalizedShared);
      return normalizedShared;
    } catch {
      try {
        const { data } = await customerApi.getProfile();
        const profile = data?.result ?? data?.data ?? data;
        const raw = Array.isArray(profile?.addresses) ? profile.addresses : [];
        const normalizedProfile = raw.map((addr, idx) =>
          mapSharedAddress(addr, idx, profile || user || {}),
        );
        setSavedAddresses(normalizedProfile);
        return normalizedProfile;
      } catch {
        try {
          const rawStored = localStorage.getItem("userAddresses");
          const parsedStored = rawStored ? JSON.parse(rawStored) : [];
          const normalizedStored = Array.isArray(parsedStored)
            ? parsedStored.map((addr, idx) => mapSharedAddress(addr, idx, user || {}))
            : [];
          setSavedAddresses(normalizedStored);
          return normalizedStored;
        } catch {
          setSavedAddresses([]);
          return [];
        }
      }
    }
  }, [isAuthenticated, user?._id, user?.userId, user?.id]);

  // On mount: hydrate saved addresses from profile (only when customer is logged in)
  useEffect(() => {
    refreshAddresses();
  }, [refreshAddresses]);

  // On mount: only restore from cache. Do NOT auto-fetch – browsers block the
  // location prompt unless it's triggered by a user gesture (e.g. tap).
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const addressName = parsed.address || parsed.name;
        if (parsed && addressName) {
          updateLocation(
            {
              name: addressName,
              time: parsed.time || "12-15 mins",
              city: parsed.city,
              state: parsed.state,
              pincode: parsed.pincode,
              latitude: parsed.latitude,
              longitude: parsed.longitude,
            },
            { persist: false, updateSavedHome: false },
          );
        }
      } else {
        // If no location is stored, persist the default one immediately
        updateLocation(currentLocation, {
          persist: true,
          updateSavedHome: false,
        });
      }
    } catch {
      // ignore parse errors
    }
    // Live fetch happens only when user taps location pill or "Use current location"
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Listen to geolocation permission status changes
  useEffect(() => {
    if (typeof window === "undefined" || !navigator.permissions || !navigator.permissions.query) return;

    let active = true;
    let permStatusObj = null;
    let permListener = null;

    navigator.permissions.query({ name: 'geolocation' }).then((status) => {
      if (!active) return;
      permStatusObj = status;
      permListener = () => {
        if (status.state === 'granted') {
          fetchAndCacheLocation().then((res) => {
            if (res && res.ok && res.location) {
              // Notify other hooks
              const mappedLoc = {
                latitude: res.location.latitude,
                longitude: res.location.longitude,
                city: res.location.city,
                state: res.location.state,
                pincode: res.location.pincode,
                address: res.location.name,
                formattedAddress: res.location.name
              };
              window.dispatchEvent(new CustomEvent("userLocationUpdated", { detail: { location: mappedLoc } }));
            }
          }).catch(() => {});
        }
      };

      status.addEventListener('change', permListener);
      status.onchange = permListener;
    }).catch(() => {});

    return () => {
      active = false;
      if (permStatusObj && permListener) {
        permStatusObj.removeEventListener('change', permListener);
        permStatusObj.onchange = null;
      }
    };
  }, []);

  // Sync with external updates
  useEffect(() => {
    if (typeof window === "undefined") return;

    const applyExternalLocationUpdate = (event) => {
      try {
        const nextLocation = event?.detail?.location || JSON.parse(localStorage.getItem("userLocation") || "null");
        if (nextLocation && typeof nextLocation === "object") {
          updateLocation(
            {
              name: nextLocation.formattedAddress || nextLocation.address || `Lat ${Number(nextLocation.latitude).toFixed(5)}, Lng ${Number(nextLocation.longitude).toFixed(5)}`,
              time: "12-15 mins",
              city: nextLocation.city || "Indore",
              state: nextLocation.state || "Madhya Pradesh",
              pincode: nextLocation.pincode || "452018",
              latitude: nextLocation.latitude,
              longitude: nextLocation.longitude,
            },
            { persist: true, updateSavedHome: false }
          );
        }
      } catch (err) {
        console.warn("Failed to apply external location update in LocationContext:", err);
      }
    };

    window.addEventListener("userLocationUpdated", applyExternalLocationUpdate);
    return () => {
      window.removeEventListener("userLocationUpdated", applyExternalLocationUpdate);
    };
  }, []);

  return (
    <LocationContext.Provider
      value={{
        currentLocation,
        savedAddresses,
        updateLocation,
        addAddress,
        refreshAddresses,
        isFetchingLocation,
        locationError,
        refreshLocation: fetchAndCacheLocation,
      }}>
      {children}
    </LocationContext.Provider>
  );
};

export const useLocation = () => {
  const context = useContext(LocationContext);
  if (context === undefined) {
    throw new Error("useLocation must be used within a LocationProvider");
  }
  return context;
};
