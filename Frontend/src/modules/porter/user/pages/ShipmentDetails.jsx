import React, { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { MapPin, Phone, Star, FileText, Loader2, CalendarClock } from "lucide-react";
import Screen from "../components/Screen";
import { PrimaryButton, FareRow, SectionLabel, inr } from "../components/ui";
import { useBooking } from "../context/BookingContext";
import { getPorterInvoicePath, getPorterTrackingPath, getPorterScheduledWaitingPath } from "../utils/routes";
import { usePorterOrderTracking } from "../hooks/usePorterOrderTracking";
import { mapActiveShipmentFromOrder } from "../utils/orderMapper";

function fmt(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-IN", {
      day: "numeric", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

export default function ShipmentDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { setActiveShipment } = useBooking();
  
  // Stop polling if the order is already in a terminal state
  const [isTerminal, setIsTerminal] = React.useState(false);
  const { order, loading } = usePorterOrderTracking(id, { 
    pollMs: 5000,
    enabled: !isTerminal
  });

  React.useEffect(() => {
    if (order?.status) {
      const status = String(order.status).toLowerCase();
      if (['delivered', 'completed', 'cancelled_by_user', 'cancelled_by_admin', 'cancelled_by_driver', 'failed'].includes(status)) {
        setIsTerminal(true);
      }
    }
  }, [order?.status]);
  const shipment = useMemo(() => mapActiveShipmentFromOrder(order), [order]);

  if (loading && !shipment) {
    return (
      <Screen title="Shipment details">
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-[#2563EB]" />
        </div>
      </Screen>
    );
  }

  if (!shipment) {
    return (
      <Screen title="Shipment details">
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <FileText className="mb-3 h-12 w-12 text-gray-300" />
          <p className="text-[16px] font-bold text-gray-900">Shipment not found</p>
          <p className="mt-1 text-[13px] text-gray-500">We couldn't find the details for this shipment.</p>
          <PrimaryButton className="mt-6 w-full" onClick={() => navigate("/porter/shipments")}>
            Back to shipments
          </PrimaryButton>
        </div>
      </Screen>
    );
  }

  const isActive = ["in_transit", "to_pickup", "picked_up", "out_for_delivery", "assigned", "searching_partner"].includes(shipment.stage || shipment.status);

  return (
    <Screen title="Shipment details" subtitle={`#${shipment.trackingId || id}`}>
      <div className="mb-4 flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm">
        <div>
          <p className="text-[11px] font-bold uppercase text-gray-400">Status</p>
          <p className="text-[16px] font-extrabold capitalize text-gray-900">{(shipment.status || "Unknown").replace(/_/g, " ")}</p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-[11px] font-bold capitalize ${
            shipment.status === "delivered" || shipment.status === "completed" ? "bg-green-50 text-[#2e7d32]" : "bg-amber-50 text-amber-700"
          }`}
        >
          {(shipment.stage || shipment.status || "Pending").replace(/_/g, " ")}
        </span>
      </div>

      <SectionLabel>Route</SectionLabel>
      <div className="mb-4 rounded-2xl border border-gray-100 bg-white p-4">
        <div className="mb-3 flex items-start gap-2">
          <span className="mt-1 h-3 w-3 shrink-0 rounded-full bg-[#2e7d32]" />
          <div>
            <p className="text-[13px] font-bold text-gray-900">{shipment.pickup?.title || "Pickup"}</p>
            <p className="text-[12px] text-gray-500">{shipment.pickup?.address || "Address not provided"}</p>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#2563EB]" />
          <div>
            <p className="text-[13px] font-bold text-gray-900">{shipment.delivery?.title || "Dropoff"}</p>
            <p className="text-[12px] text-gray-500">{shipment.delivery?.address || "Address not provided"}</p>
          </div>
        </div>
      </div>

      <SectionLabel>Parcel info</SectionLabel>
      <div className="mb-4 rounded-2xl border border-gray-100 bg-white p-4 text-[13px]">
        <p><span className="text-gray-500">Parcel:</span> <span className="font-bold">{shipment.parcel?.weightKg || "--"} kg × {shipment.parcel?.quantity || 1}</span></p>
        <p className="mt-1"><span className="text-gray-500">Vehicle:</span> <span className="font-bold">{shipment.vehicle || "Any"}</span></p>
      </div>

      {(shipment.scheduledAt || shipment.schedule) && (
        <>
          <SectionLabel>Schedule</SectionLabel>
          <div className="mb-4 rounded-2xl border border-amber-100 bg-amber-50/40 p-4 text-[13px]">
            <div className="mb-2 flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-amber-700" />
              <span className="font-extrabold text-amber-800">
                {shipment.status === "scheduled" ? "Waiting for scheduled time" : "Was scheduled"}
              </span>
            </div>
            <p><span className="text-gray-500">Scheduled:</span> <span className="font-bold">{fmt(shipment.scheduledAt)}</span></p>
            <p className="mt-1"><span className="text-gray-500">Created:</span> <span className="font-bold">{fmt(shipment.createdAt)}</span></p>
            <p className="mt-1"><span className="text-gray-500">Activated:</span> <span className="font-bold">{fmt(shipment.schedule?.activatedAt)}</span></p>
            <p className="mt-1"><span className="text-gray-500">Dispatch started:</span> <span className="font-bold">{fmt(shipment.dispatch?.scheduledDispatchedAt || shipment.schedule?.activatedAt)}</span></p>
            <p className="mt-1"><span className="text-gray-500">Driver assigned:</span> <span className="font-bold">{fmt(shipment.dispatch?.assignedAt || shipment.dispatch?.acceptedAt)}</span></p>
          </div>
        </>
      )}

      {shipment.partner && (
        <>
          <SectionLabel>Delivery partner</SectionLabel>
          <div className="mb-4 flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-4">
            {shipment.partner.profilePhoto ? (
              <img src={shipment.partner.profilePhoto} alt={shipment.partner.name} className="h-12 w-12 rounded-full object-cover ring-2 ring-[#EFF6FF]" />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#EFF6FF] text-[18px] font-bold text-[#2563EB]">
                {shipment.partner.name?.charAt(0) || "P"}
              </div>
            )}
            <div className="flex-1">
              <p className="text-[14px] font-bold text-gray-900">{shipment.partner.name}</p>
              <p className="text-[12px] text-gray-500">{shipment.partner.vehicleNumber || "Vehicle assigned"}</p>
              {shipment.rating?.score && (
                <div className="mt-0.5 flex items-center gap-1 text-[11px]">
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                  <span className="font-bold">Rated {shipment.rating.score}/5</span>
                </div>
              )}
            </div>
            {shipment.partner.phone && (
              <a href={`tel:${shipment.partner.phone.replace(/\s/g, "")}`} className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100">
                <Phone className="h-4 w-4 text-[#2563EB]" />
              </a>
            )}
          </div>
        </>
      )}

      {shipment.rating?.score && (
        <>
          <SectionLabel>Rating & Feedback</SectionLabel>
          <div className="mb-4 rounded-2xl border border-gray-100 bg-white p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="flex">
                {[1,2,3,4,5].map(n => (
                  <Star key={n} className={`h-4 w-4 ${n <= shipment.rating.score ? "fill-amber-400 text-amber-400" : "text-gray-200"}`} />
                ))}
              </div>
              <span className="text-[14px] font-bold">{shipment.rating.score}/5</span>
            </div>
            {shipment.rating.tags?.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {shipment.rating.tags.map(tag => (
                  <span key={tag} className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-600">{tag}</span>
                ))}
              </div>
            )}
            {shipment.rating.comment && (
              <p className="text-[12px] text-gray-600 italic">"{shipment.rating.comment}"</p>
            )}
          </div>
        </>
      )}

      <SectionLabel>Payment</SectionLabel>
      <div className="mb-4 rounded-2xl border border-gray-100 bg-white p-4">
        <FareRow label="Delivery fare" value={inr(shipment.pricing?.baseFare || 0)} />
        {(shipment.pricing?.serviceTax || 0) > 0 && (
          <FareRow label="Service Tax / GST" value={inr(shipment.pricing?.serviceTax)} />
        )}
        {(shipment.pricing?.discount || 0) > 0 && <FareRow label="Discount" value={`−${inr(shipment.pricing?.discount)}`} accent />}
        <div className="my-2 border-t border-gray-100" />
        <FareRow label="Total paid" value={inr(shipment.total || 0)} strong />
        <p className="mt-1 text-[11px] capitalize text-gray-400">Paid via {shipment.payment?.method || shipment.pricing?.paymentMethod || "online"}</p>
      </div>

      <div className="flex gap-2">
        {shipment.status === "scheduled" && (
          <PrimaryButton className="flex-1" onClick={() => navigate(getPorterScheduledWaitingPath())}>
            View schedule
          </PrimaryButton>
        )}
        {isActive && shipment.status !== "scheduled" && (
          <PrimaryButton className="flex-1" onClick={() => navigate(getPorterTrackingPath())}>
            Track parcel
          </PrimaryButton>
        )}
        {(shipment.status === "delivered" || shipment.status === "completed") && (
          <PrimaryButton variant="outline" className="flex-1" onClick={() => navigate(getPorterInvoicePath(shipment.id))}>
            <FileText className="h-4 w-4" />
            Invoice
          </PrimaryButton>
        )}
        {(shipment.status === "delivered" || shipment.status === "completed") && !shipment.rating && (
          <PrimaryButton 
            className="flex-1" 
            onClick={() => {
              setActiveShipment(shipment);
              navigate("/porter/rate");
            }}
          >
            <Star className="h-4 w-4" />
            Rate
          </PrimaryButton>
        )}
      </div>
    </Screen>
  );
}
