import React from "react";
import { useBooking } from "../context/BookingContext";
import PorterLocationPicker from "./PorterLocationPicker";

export default function PorterPickupMap({ isOpen, onClose }) {
  const { pickup, setPickup } = useBooking();

  const handleSelect = (location) => {
    setPickup({
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
      title="Set pickup location"
      pinLabel="Pickup here"
      searchPlaceholder="Search pickup area, street, landmark"
      confirmLabel="Confirm pickup"
      initialLocation={pickup}
    />
  );
}
