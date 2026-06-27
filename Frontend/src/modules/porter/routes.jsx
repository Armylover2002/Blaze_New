// Porter (parcel logistics) module router (mounted at /porter/*). Frontend-only,
// mirrors the Quick Commerce module router pattern: provider + UserLayout + lazy pages.
import { Routes, Route, Navigate } from "react-router-dom";
import { Suspense, lazy } from "react";
import Loader from "@food/components/Loader";
import UserLayout from "./user/UserLayout";
import { PorterProvider } from "./user/context/BookingContext";
import Home from "./user/pages/Home";

const SelectAddresses = lazy(() => import("./user/pages/SelectAddresses"));
const ParcelDetails = lazy(() => import("./user/pages/ParcelDetails"));
const VehicleSelection = lazy(() => import("./user/pages/VehicleSelection"));
const FareEstimate = lazy(() => import("./user/pages/FareEstimate"));
const FindingPartner = lazy(() => import("./user/pages/FindingPartner"));
const PartnerAssigned = lazy(() => import("./user/pages/PartnerAssigned"));
const ParcelTracking = lazy(() => import("./user/pages/ParcelTracking"));
const ShipmentDetails = lazy(() => import("./user/pages/ShipmentDetails"));
const ShipmentHistory = lazy(() => import("./user/pages/ShipmentHistory"));
const SavedPlaces = lazy(() => import("./user/pages/SavedPlaces"));
const PromoCode = lazy(() => import("./user/pages/PromoCode"));
const PaymentSelection = lazy(() => import("./user/pages/PaymentSelection"));
const RateDelivery = lazy(() => import("./user/pages/RateDelivery"));
const CancelBooking = lazy(() => import("./user/pages/CancelBooking"));
const SchedulePickup = lazy(() => import("./user/pages/SchedulePickup"));
const SOS = lazy(() => import("./user/pages/SOS"));
const EmergencyContacts = lazy(() => import("./user/pages/EmergencyContacts"));
const DeliveryInvoice = lazy(() => import("./user/pages/DeliveryInvoice"));

function PorterInnerRoutes() {
  return (
    <Suspense fallback={<Loader />}>
      <Routes>
        <Route element={<UserLayout />}>
          <Route index element={<Home />} />
          <Route path="home" element={<Home />} />
          <Route path="address" element={<SelectAddresses />} />
          <Route path="parcel-details" element={<ParcelDetails />} />
          <Route path="vehicle" element={<VehicleSelection />} />
          <Route path="fare-estimate" element={<FareEstimate />} />
          <Route path="finding-partner" element={<FindingPartner />} />
          <Route path="partner-assigned" element={<PartnerAssigned />} />
          <Route path="tracking" element={<ParcelTracking />} />
          <Route path="shipment/:id" element={<ShipmentDetails />} />
          <Route path="shipments" element={<ShipmentHistory />} />
          <Route path="saved-places" element={<SavedPlaces />} />
          <Route path="promo" element={<PromoCode />} />
          <Route path="payment" element={<PaymentSelection />} />
          <Route path="rate" element={<RateDelivery />} />
          <Route path="cancel" element={<CancelBooking />} />
          <Route path="schedule" element={<SchedulePickup />} />
          <Route path="sos" element={<SOS />} />
          <Route path="emergency-contacts" element={<EmergencyContacts />} />
          <Route path="invoice/:id" element={<DeliveryInvoice />} />
        </Route>
        <Route path="*" element={<Navigate to="/porter" replace />} />
      </Routes>
    </Suspense>
  );
}

export default function PorterRoutes() {
  return (
    <PorterProvider>
      <PorterInnerRoutes />
    </PorterProvider>
  );
}
