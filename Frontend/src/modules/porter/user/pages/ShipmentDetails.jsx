import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { MapPin, Phone, Star, FileText } from "lucide-react";
import Screen from "../components/Screen";
import { PrimaryButton, FareRow, SectionLabel, inr } from "../components/ui";
import { getShipmentById } from "../utils/mock/shipments";
import { getPorterInvoicePath, getPorterTrackingPath } from "../utils/routes";

export default function ShipmentDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const shipment = getShipmentById(id);

  if (!shipment) {
    return (
      <Screen title="Shipment details">
        <p className="text-[14px] text-gray-500">Shipment not found.</p>
        <PrimaryButton className="mt-4" onClick={() => navigate("/porter/shipments")}>
          Back to shipments
        </PrimaryButton>
      </Screen>
    );
  }

  const isActive = ["in_transit", "to_pickup", "picked_up", "out_for_delivery"].includes(shipment.stage);

  return (
    <Screen title="Shipment details" subtitle={shipment.trackingId}>
      <div className="mb-4 flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm">
        <div>
          <p className="text-[11px] font-bold uppercase text-gray-400">Status</p>
          <p className="text-[16px] font-extrabold capitalize text-gray-900">{shipment.status.replace("_", " ")}</p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-[11px] font-bold ${
            shipment.status === "delivered" ? "bg-green-50 text-[#2e7d32]" : "bg-amber-50 text-amber-700"
          }`}
        >
          {shipment.stage.replace(/_/g, " ")}
        </span>
      </div>

      <SectionLabel>Route</SectionLabel>
      <div className="mb-4 rounded-2xl border border-gray-100 bg-white p-4">
        <div className="mb-3 flex items-start gap-2">
          <span className="mt-1 h-3 w-3 shrink-0 rounded-full bg-[#2e7d32]" />
          <div>
            <p className="text-[13px] font-bold text-gray-900">{shipment.pickup.title}</p>
            <p className="text-[12px] text-gray-500">{shipment.pickup.address}</p>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#FF0000]" />
          <div>
            <p className="text-[13px] font-bold text-gray-900">{shipment.delivery.title}</p>
            <p className="text-[12px] text-gray-500">{shipment.delivery.address}</p>
          </div>
        </div>
      </div>

      <SectionLabel>Parcel info</SectionLabel>
      <div className="mb-4 rounded-2xl border border-gray-100 bg-white p-4 text-[13px]">
        <p><span className="text-gray-500">Parcel:</span> <span className="font-bold">{shipment.weightKg} kg × {shipment.quantity}</span></p>
        <p className="mt-1"><span className="text-gray-500">Vehicle:</span> <span className="font-bold">{shipment.vehicle}</span></p>
      </div>

      {shipment.partner && (
        <>
          <SectionLabel>Delivery partner</SectionLabel>
          <div className="mb-4 flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#FFF1F1] text-[18px] font-bold text-[#FF0000]">
              {shipment.partner.name.charAt(0)}
            </div>
            <div className="flex-1">
              <p className="text-[14px] font-bold text-gray-900">{shipment.partner.name}</p>
              <p className="text-[12px] text-gray-500">{shipment.partner.vehicleNumber}</p>
              {shipment.rating && (
                <div className="mt-0.5 flex items-center gap-1 text-[11px]">
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                  <span className="font-bold">You rated {shipment.rating}/5</span>
                </div>
              )}
            </div>
            <a href={`tel:${shipment.partner.phone.replace(/\s/g, "")}`} className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100">
              <Phone className="h-4 w-4 text-[#FF0000]" />
            </a>
          </div>
        </>
      )}

      <SectionLabel>Payment</SectionLabel>
      <div className="mb-4 rounded-2xl border border-gray-100 bg-white p-4">
        <FareRow label="Delivery fare" value={inr(shipment.fare)} />
        {shipment.discount > 0 && <FareRow label="Discount" value={`−${inr(shipment.discount)}`} accent />}
        <div className="my-2 border-t border-gray-100" />
        <FareRow label="Total paid" value={inr(shipment.total)} strong />
        <p className="mt-1 text-[11px] capitalize text-gray-400">Paid via {shipment.paymentMethod}</p>
      </div>

      <div className="flex gap-2">
        {isActive && (
          <PrimaryButton className="flex-1" onClick={() => navigate(getPorterTrackingPath())}>
            Track parcel
          </PrimaryButton>
        )}
        {shipment.status === "delivered" && (
          <PrimaryButton variant="outline" className="flex-1" onClick={() => navigate(getPorterInvoicePath(shipment.id))}>
            <FileText className="h-4 w-4" />
            Invoice
          </PrimaryButton>
        )}
      </div>
    </Screen>
  );
}
