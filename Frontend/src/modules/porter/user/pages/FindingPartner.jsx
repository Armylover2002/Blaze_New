import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Package, Search } from "lucide-react";
import Screen from "../components/Screen";
import MapPreview from "../components/MapPreview";
import { useBooking } from "../context/BookingContext";
import { getPorterPartnerAssignedPath } from "../utils/routes";
import { getRandomPartner } from "../utils/mock/partners";

export default function FindingPartner() {
  const navigate = useNavigate();
  const { setActiveShipment, pickup, delivery, vehicle, total } = useBooking();

  useEffect(() => {
    const timer = setTimeout(() => {
      const partner = getRandomPartner();
      setActiveShipment({
        id: "SHP-CURRENT",
        trackingId: `BLZ${Date.now().toString().slice(-8)}`,
        status: "assigned",
        stage: "to_pickup",
        partner,
        pickup,
        delivery,
        vehicle: vehicle?.name,
        total,
        createdAt: new Date().toISOString(),
      });
      navigate(getPorterPartnerAssignedPath(), { replace: true });
    }, 3200);
    return () => clearTimeout(timer);
  }, [navigate, setActiveShipment, pickup, delivery, vehicle, total]);

  return (
    <Screen title="Finding partner" subtitle="Matching you with a nearby delivery partner" bare>
      <div className="relative">
        <MapPreview height="calc(100vh - 120px)" showRoute animateCar rounded="rounded-none" />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-white via-white/95 to-transparent px-4 pb-10 pt-16">
          <motion.div
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#FFF1F1]"
          >
            <Search className="h-7 w-7 text-[#FF0000]" />
          </motion.div>
          <h2 className="text-center text-[18px] font-extrabold text-gray-900">Searching for delivery partner</h2>
          <p className="mt-1 text-center text-[13px] text-gray-500">
            Finding the best partner for your {vehicle?.name || "delivery"} shipment
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="h-2 w-2 rounded-full bg-[#FF0000]"
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
              />
            ))}
          </div>
          <div className="mt-6 flex items-center justify-center gap-2 rounded-2xl bg-gray-50 p-3">
            <Package className="h-4 w-4 text-[#FF0000]" />
            <span className="text-[12px] font-semibold text-gray-600">Your parcel details are shared securely with the partner</span>
          </div>
        </div>
      </div>
    </Screen>
  );
}
