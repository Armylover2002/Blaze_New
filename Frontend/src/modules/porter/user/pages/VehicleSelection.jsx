import React, { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles } from "lucide-react";
import Screen from "../components/Screen";
import PorterRouteMap from "../components/PorterRouteMap";
import VehicleCard from "../components/VehicleCard";
import { PrimaryButton, StickyBar, SectionLabel } from "../components/ui";
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

  const eligibleVehicles = routeQuote?.eligibleVehicles || [];
  const ineligibleVehicles = routeQuote?.ineligibleVehicles || [];
  const recommendedId = routeQuote?.recommendedVehicleId;
  const weightLabel = totalParcelWeight || parcel.weightKg || 0;
  const noVehiclesAvailable = Boolean(routeQuote?.noVehiclesAvailable);

  const recommendedVehicle = useMemo(
    () => eligibleVehicles.find((v) => String(v.id) === String(recommendedId)) || eligibleVehicles[0] || null,
    [eligibleVehicles, recommendedId],
  );

  const otherEligible = useMemo(
    () => eligibleVehicles.filter((v) => String(v.id) !== String(recommendedVehicle?.id)),
    [eligibleVehicles, recommendedVehicle],
  );

  useEffect(() => {
    if (!recommendedVehicle?.id) return;
    if (!vehicleId || !eligibleVehicles.some((v) => String(v.id) === String(vehicleId))) {
      selectVehicle(recommendedVehicle.id, {
        id: recommendedVehicle.id,
        name: recommendedVehicle.name,
        vehicleCode: recommendedVehicle.vehicleCode,
        iconUrl: recommendedVehicle.iconUrl,
        maxWeight: recommendedVehicle.maxWeight,
      });
    }
  }, [recommendedVehicle, eligibleVehicles, vehicleId, selectVehicle]);

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
          Select any available vehicle for your delivery.
        </p>
      </div>

      {quoteLoading && <p className="text-sm text-gray-500">Finding suitable vehicles…</p>}

      {!quoteLoading && noVehiclesAvailable && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-800">
          {routeQuote?.message || "No delivery vehicle is available for this parcel weight."}
        </div>
      )}

      {!quoteLoading && !noVehiclesAvailable && (
        <>
          <VehicleSection
            title="Recommended"
            subtitle={recommendedVehicle ? `Best match for ${weightLabel} kg` : null}
          >
            {recommendedVehicle && (
              <VehicleCard
                vehicle={recommendedVehicle}
                fare={recommendedVehicle.estimatedFare}
                estimatedTime={recommendedVehicle.estimatedTime}
                selected={String(vehicleId) === String(recommendedVehicle.id)}
                badge="Recommended"
                onSelect={() => handleSelect(recommendedVehicle)}
              />
            )}
          </VehicleSection>

          <VehicleSection title="Available" subtitle="Other suitable vehicles for your parcel">
            {otherEligible.map((v) => (
              <VehicleCard
                key={v.id}
                vehicle={v}
                fare={v.estimatedFare}
                estimatedTime={v.estimatedTime}
                selected={String(vehicleId) === String(v.id)}
                onSelect={() => handleSelect(v)}
              />
            ))}
          </VehicleSection>

          {ineligibleVehicles.length > 0 && (
            <VehicleSection title="Not suitable" subtitle="These vehicles cannot carry this parcel weight">
              {ineligibleVehicles.map((v) => (
                <VehicleCard
                  key={v.id}
                  vehicle={v}
                  fare={null}
                  estimatedTime={null}
                  selected={false}
                  disabled
                  disabledReason={v.reason}
                  onSelect={() => {}}
                />
              ))}
            </VehicleSection>
          )}
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
