import React from "react";
import { useBooking } from "../context/BookingContext";
import PorterLocationPicker from "./PorterLocationPicker";

export default function PorterDropMap({ isOpen, onClose }) {
  const { delivery, setDelivery } = useBooking();

  const handleSelect = (location) => {
    setDelivery({
      title: location.title,
      address: location.address,
      lat: location.lat,
      lng: location.lng,
      placeId: location.placeId,
    });
  };

  return (
    <PorterLocationPicker
      isOpen={isOpen}
      onClose={onClose}
      onSelect={handleSelect}
      title="Set delivery location"
      pinLabel="Deliver here"
      searchPlaceholder="Search delivery area, street, landmark"
      confirmLabel="Confirm delivery"
      initialLocation={delivery}
    />
  );
}
