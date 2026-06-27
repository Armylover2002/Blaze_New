import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles } from "lucide-react";
import Screen from "../components/Screen";
import MapPreview from "../components/MapPreview";
import VehicleCard from "../components/VehicleCard";
import { PrimaryButton, StickyBar, SectionLabel } from "../components/ui";
import { useBooking } from "../context/BookingContext";
import { getPorterFareEstimatePath } from "../utils/routes";
import { DELIVERY_VEHICLES, estimateDeliveryCost, recommendVehicle } from "../utils/mock/vehicles";

export default function VehicleSelection() {
  const navigate = useNavigate();
  const { parcel, vehicleId, setVehicleId, distanceKm, durationMin } = useBooking();
  const recommended = recommendVehicle(parcel.weightKg * parcel.quantity);

  useEffect(() => {
    if (!vehicleId || DELIVERY_VEHICLES.find((v) => v.id === vehicleId)?.maxWeightKg < parcel.weightKg * parcel.quantity) {
      setVehicleId(recommended.id);
    }
  }, [parcel.weightKg, parcel.quantity, recommended.id, setVehicleId, vehicleId]);

  const totalWeight = parcel.weightKg * parcel.quantity;

  return (
    <Screen title="Delivery vehicle" subtitle={`${distanceKm} km · ~${durationMin} min transit`}>
      <MapPreview height={160} showRoute animateCar className="mb-4" />

      <div className="mb-4 flex items-center gap-2 rounded-2xl bg-[#FFF1F1] p-3">
        <Sparkles className="h-4 w-4 text-[#FF0000]" />
        <p className="text-[12px] font-semibold text-gray-800">
          Recommended for {totalWeight} kg: <span className="font-bold text-[#FF0000]">{recommended.name}</span>
        </p>
      </div>

      <SectionLabel>Select vehicle</SectionLabel>
      <div className="space-y-2">
        {DELIVERY_VEHICLES.filter(v => totalWeight >= v.minWeightKg && totalWeight <= v.maxWeightKg).map((v) => {
          const fare = estimateDeliveryCost(v.id, distanceKm, durationMin);
          return (
            <VehicleCard
              key={v.id}
              vehicle={v}
              fare={fare}
              selected={vehicleId === v.id}
              disabled={false}
              onSelect={() => setVehicleId(v.id)}
            />
          );
        })}
      </div>

      <StickyBar>
        <PrimaryButton onClick={() => navigate(getPorterFareEstimatePath())}>
          Review fare estimate
        </PrimaryButton>
      </StickyBar>
    </Screen>
  );
}
