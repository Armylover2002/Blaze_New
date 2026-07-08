import React, { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Screen from "../components/Screen";
import PorterRouteMap from "../components/PorterRouteMap";
import VehicleCard from "../components/VehicleCard";
import { PrimaryButton, StickyBar } from "../components/ui";
import { useBooking } from "../context/BookingContext";
import { getPorterFareEstimatePath } from "../utils/routes";

function VehicleSection({ title, subtitle, children }) {
  if (!children) return null;
  return (
    <div className="mb-5">
      <div className="mb-2">
        <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500">{title}</p>
        {subtitle && <p className="text-[12px] text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function advisoryBadgeFor(v, isRecommended) {
  if (isRecommended) return "Recommended";
  if (v.advisoryBadge) return v.advisoryBadge;
  return null;
}

export default function VehicleSelection() {
  const navigate = useNavigate();
  const {
    parcel,
    pickup,
    delivery,
    vehicleId,
    selectVehicle,
    distanceKm,
    durationMin,
    routeQuote,
    quoteLoading,
    totalParcelWeight,
  } = useBooking();

  // All bookable vehicles — weight never hides options.
  const vehicles = useMemo(() => {
    const eligible = routeQuote?.eligibleVehicles || [];
    // Legacy clients may still receive weight-"ineligible"; treat them as selectable
    // when they have fare data; otherwise only show pricing/config failures as disabled.
    return eligible;
  }, [routeQuote]);

  const recommendedId = routeQuote?.recommendedVehicleId;
  const weightLabel = totalParcelWeight || parcel.weightKg || 0;
  const noVehiclesAvailable = Boolean(routeQuote?.noVehiclesAvailable) || (!quoteLoading && vehicles.length === 0);

  const recommendedVehicle = useMemo(
    () => vehicles.find((v) => String(v.id) === String(recommendedId)) || vehicles[0] || null,
    [vehicles, recommendedId],
  );

  const otherVehicles = useMemo(
    () => vehicles.filter((v) => String(v.id) !== String(recommendedVehicle?.id)),
    [vehicles, recommendedVehicle],
  );

  useEffect(() => {
    if (!recommendedVehicle?.id) return;
    if (!vehicleId || !vehicles.some((v) => String(v.id) === String(vehicleId))) {
      selectVehicle(recommendedVehicle.id, {
        id: recommendedVehicle.id,
        name: recommendedVehicle.name,
        vehicleCode: recommendedVehicle.vehicleCode,
        iconUrl: recommendedVehicle.iconUrl,
        maxWeight: recommendedVehicle.maxWeight,
      });
    }
  }, [recommendedVehicle, vehicles, vehicleId, selectVehicle]);

  const handleSelect = (v) => {
    selectVehicle(v.id, {
      id: v.id,
      name: v.name,
      vehicleCode: v.vehicleCode,
      iconUrl: v.iconUrl,
      maxWeight: v.maxWeight,
    });
  };

  return (
    <Screen title="Delivery vehicle" subtitle={`${distanceKm ?? "—"} km · ~${durationMin ?? "—"} min transit`}>
      <div className="mb-4 overflow-hidden rounded-2xl border border-gray-200">
        <PorterRouteMap pickup={pickup} delivery={delivery} routeQuote={routeQuote} height={240} />
      </div>

      <div className="mb-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
        <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500">Parcel weight</p>
        <p className="mt-1 text-[22px] font-extrabold text-gray-900">{weightLabel} kg</p>
        <p className="mt-1 text-[12px] text-gray-600">
          Any vehicle can be booked. Capacity labels are advisory only.
        </p>
      </div>

      {quoteLoading && <p className="text-sm text-gray-500">Loading vehicles…</p>}

      {!quoteLoading && noVehiclesAvailable && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-800">
          {routeQuote?.message || "No delivery vehicles are currently available."}
        </div>
      )}

      {!quoteLoading && !noVehiclesAvailable && (
        <>
          <VehicleSection
            title="Recommended"
            subtitle={recommendedVehicle ? `Suggested for ${weightLabel} kg (you can choose any)` : null}
          >
            {recommendedVehicle && (
              <VehicleCard
                vehicle={recommendedVehicle}
                fare={recommendedVehicle.estimatedFare}
                estimatedTime={recommendedVehicle.estimatedTime}
                selected={String(vehicleId) === String(recommendedVehicle.id)}
                badge={advisoryBadgeFor(recommendedVehicle, true)}
                onSelect={() => handleSelect(recommendedVehicle)}
              />
            )}
          </VehicleSection>

          <VehicleSection title="All vehicles" subtitle="Select any vehicle — weight is informational">
            {otherVehicles.map((v) => (
              <VehicleCard
                key={v.id}
                vehicle={v}
                fare={v.estimatedFare}
                estimatedTime={v.estimatedTime}
                selected={String(vehicleId) === String(v.id)}
                badge={advisoryBadgeFor(v, false)}
                onSelect={() => handleSelect(v)}
              />
            ))}
          </VehicleSection>
        </>
      )}

      <StickyBar>
        <PrimaryButton
          disabled={!vehicleId || noVehiclesAvailable || quoteLoading}
          onClick={() => {
            if (!vehicleId) return;
            navigate(getPorterFareEstimatePath());
          }}
        >
          Review fare estimate
        </PrimaryButton>
      </StickyBar>
    </Screen>
  );
}
