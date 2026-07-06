import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles } from "lucide-react";
import Screen from "../components/Screen";
import PorterRouteMap from "../components/PorterRouteMap";
import VehicleCard from "../components/VehicleCard";
import { PrimaryButton, StickyBar, SectionLabel } from "../components/ui";
import { useBooking } from "../context/BookingContext";
import { getPorterFareEstimatePath } from "../utils/routes";

export default function VehicleSelection() {
  const navigate = useNavigate();
  const {
    parcel,
    pickup,
    delivery,
    vehicleId,
    setVehicleId,
    distanceKm,
    durationMin,
    routeQuote,
    quoteLoading,
    totalParcelWeight,
  } = useBooking();

  const eligibleVehicles = routeQuote?.eligibleVehicles || [];
  const ineligibleVehicles = routeQuote?.ineligibleVehicles || [];
  const recommendedId = routeQuote?.recommendedVehicleId;
  const recommended = eligibleVehicles.find((v) => String(v.id) === String(recommendedId)) || eligibleVehicles[0] || null;
  const noVehiclesAvailable = Boolean(routeQuote?.noVehiclesAvailable);

  useEffect(() => {
    if (recommendedId && eligibleVehicles.some((v) => String(v.id) === String(recommendedId))) {
      if (!vehicleId || !eligibleVehicles.some((v) => String(v.id) === String(vehicleId))) {
        setVehicleId(recommendedId);
      }
    }
  }, [recommendedId, eligibleVehicles, vehicleId, setVehicleId]);

  return (
    <Screen title="Delivery vehicle" subtitle={`${distanceKm ?? "—"} km · ~${durationMin ?? "—"} min transit`}>
      <div className="mb-4 overflow-hidden rounded-2xl border border-gray-200">
        <PorterRouteMap pickup={pickup} delivery={delivery} routeQuote={routeQuote} height={240} />
      </div>

      {recommended && !noVehiclesAvailable && (
        <div className="mb-4 flex items-center gap-2 rounded-2xl bg-[#FFF1F1] p-3">
          <Sparkles className="h-4 w-4 text-[#FF0000]" />
          <p className="text-[12px] font-semibold text-gray-800">
            Recommended for {totalParcelWeight || parcel.weightKg} kg:{" "}
            <span className="font-bold text-[#FF0000]">{recommended.name}</span>
          </p>
        </div>
      )}

      <SectionLabel>Select vehicle</SectionLabel>
      {quoteLoading && <p className="text-sm text-gray-500">Finding suitable vehicles…</p>}

      {!quoteLoading && noVehiclesAvailable && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-800">
          {routeQuote?.message || "No delivery vehicle is available for this parcel weight."}
        </div>
      )}

      <div className="space-y-2">
        {eligibleVehicles.map((v) => (
          <VehicleCard
            key={v.id}
            vehicle={v}
            fare={v.estimatedFare}
            estimatedTime={v.estimatedTime}
            selected={String(vehicleId) === String(v.id)}
            disabled={false}
            onSelect={() => setVehicleId(v.id)}
          />
        ))}

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
      </div>

      <StickyBar>
        <PrimaryButton
          disabled={!vehicleId || noVehiclesAvailable || quoteLoading}
          onClick={() => navigate(getPorterFareEstimatePath())}
        >
          Review fare estimate
        </PrimaryButton>
      </StickyBar>
    </Screen>
  );
}