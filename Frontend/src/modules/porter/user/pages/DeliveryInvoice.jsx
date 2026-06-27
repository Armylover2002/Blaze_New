import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Download, Share2, CheckCircle2 } from "lucide-react";
import Screen from "../components/Screen";
import { PrimaryButton, FareRow, SectionLabel, inr } from "../components/ui";
import { useBooking } from "../context/BookingContext";
import { getShipmentById } from "../utils/mock/shipments";
import { PAYMENT_METHODS } from "../utils/mock/payments";

export default function DeliveryInvoice() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { activeShipment, total, paymentMethodId } = useBooking();

  const shipment = id === "current" && activeShipment
    ? {
        trackingId: activeShipment.trackingId,
        vehicle: activeShipment.vehicle,
        pickup: activeShipment.pickup,
        delivery: activeShipment.delivery,
        partner: activeShipment.partner,
        fare: total,
        discount: 0,
        total: total + 12,
        paymentMethod: paymentMethodId,
        createdAt: activeShipment.createdAt || new Date().toISOString(),
        deliveredAt: new Date().toISOString(),
      }
    : getShipmentById(id);

  if (!shipment) {
    return (
      <Screen title="Delivery invoice">
        <p className="text-[14px] text-gray-500">Invoice not found.</p>
        <PrimaryButton className="mt-4" onClick={() => navigate("/porter/shipments")}>
          Back to shipments
        </PrimaryButton>
      </Screen>
    );
  }

  const payment = PAYMENT_METHODS.find((p) => p.id === shipment.paymentMethod);

  return (
    <Screen title="Delivery invoice" subtitle={shipment.trackingId}>
      <div className="mb-4 flex flex-col items-center rounded-2xl bg-white p-6 shadow-sm">
        <CheckCircle2 className="mb-2 h-12 w-12 text-[#2e7d32]" />
        <h2 className="text-[18px] font-extrabold text-gray-900">Delivery completed</h2>
        <p className="text-[12px] text-gray-500">
          {new Date(shipment.deliveredAt || shipment.createdAt).toLocaleString()}
        </p>
      </div>

      <SectionLabel>Shipment details</SectionLabel>
      <div className="mb-4 rounded-2xl border border-gray-100 bg-white p-4 text-[13px]">
        <p><span className="text-gray-500">Tracking ID:</span> <span className="font-bold">{shipment.trackingId}</span></p>
        <p className="mt-1"><span className="text-gray-500">Vehicle:</span> <span className="font-bold">{shipment.vehicle}</span></p>
        {shipment.partner && (
          <p className="mt-1"><span className="text-gray-500">Partner:</span> <span className="font-bold">{shipment.partner.name}</span></p>
        )}
      </div>

      <SectionLabel>Route</SectionLabel>
      <div className="mb-4 rounded-2xl border border-gray-100 bg-white p-4 text-[12px]">
        <p className="font-bold text-gray-900">{shipment.pickup?.title}</p>
        <p className="text-gray-500">{shipment.pickup?.address}</p>
        <div className="my-2 border-l-2 border-dashed border-gray-200 pl-3">
          <p className="font-bold text-gray-900">{shipment.delivery?.title}</p>
          <p className="text-gray-500">{shipment.delivery?.address}</p>
        </div>
      </div>

      <SectionLabel>Payment summary</SectionLabel>
      <div className="mb-4 rounded-2xl border border-gray-100 bg-white p-4">
        <FareRow label="Delivery fare" value={inr(shipment.fare)} />
        <FareRow label="Platform fee" value={inr(12)} />
        {(shipment.discount || 0) > 0 && <FareRow label="Discount" value={`−${inr(shipment.discount)}`} accent />}
        <div className="my-2 border-t border-gray-100" />
        <FareRow label="Total paid" value={inr(shipment.total)} strong />
        <p className="mt-2 text-[11px] text-gray-400">Paid via {payment?.label || shipment.paymentMethod}</p>
      </div>

      <div className="flex gap-2">
        <PrimaryButton variant="outline" className="flex-1">
          <Download className="h-4 w-4" />
          Download PDF
        </PrimaryButton>
        <PrimaryButton variant="outline" className="flex-1">
          <Share2 className="h-4 w-4" />
          Share
        </PrimaryButton>
      </div>

      <PrimaryButton className="mt-3" onClick={() => navigate("/porter")}>
        Book another parcel
      </PrimaryButton>
    </Screen>
  );
}
