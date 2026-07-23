import React, { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Download, CheckCircle2, Loader2 } from "lucide-react";
import Screen from "../components/Screen";
import { PrimaryButton, FareBreakdown, SectionLabel } from "../components/ui";
import { useBooking } from "../context/BookingContext";
import { getShipmentById } from "../utils/mock/shipments";
import { PAYMENT_METHODS } from "../utils/mock/payments";
import { usePorterOrderTracking } from "../hooks/usePorterOrderTracking";
import { mapActiveShipmentFromOrder } from "../utils/orderMapper";

export default function DeliveryInvoice() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { activeShipment, total, paymentMethodId } = useBooking();

  const { order, loading } = usePorterOrderTracking(id !== "current" ? id : null, {
    enabled: id !== "current",
  });

  const shipment = useMemo(() => {
    if (id === "current" && activeShipment) {
      return {
        trackingId: activeShipment.trackingId || activeShipment._id,
        vehicle: activeShipment.vehicle,
        pickup: activeShipment.pickup,
        delivery: activeShipment.delivery,
        partner: activeShipment.partner,
        fare: activeShipment.pricing ? activeShipment.pricing.baseFare : total,
        serviceTax: activeShipment.pricing?.serviceTax || 0,
        discount: activeShipment.pricing?.discount || 0,
        total: activeShipment.pricing?.total || total,
        paymentMethod: paymentMethodId,
        createdAt: activeShipment.createdAt || new Date().toISOString(),
        deliveredAt: new Date().toISOString(),
      };
    }
    if (order) {
      const mapped = mapActiveShipmentFromOrder(order);
      return {
        ...mapped,
        fare: mapped.pricing?.baseFare ?? mapped.pricing?.basePrice ?? mapped.total ?? 0,
        serviceTax: mapped.pricing?.serviceTax || 0,
        discount: mapped.pricing?.discount || 0,
        paymentMethod: mapped.payment?.method || mapped.paymentMethod || "Wallet",
      };
    }
    return getShipmentById(id); // fallback
  }, [id, activeShipment, total, paymentMethodId, order]);

  if (loading && !shipment) {
    return (
      <Screen title="Delivery invoice">
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-[#FF0000]" />
        </div>
      </Screen>
    );
  }

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
        <FareBreakdown
          baseFare={shipment.fare}
          serviceTax={shipment.serviceTax}
          discount={shipment.discount}
          total={shipment.total}
          baseLabel="Delivery fare"
          discountLabel="Discount"
          totalLabel="Total paid"
        />
        <p className="mt-2 text-[11px] text-gray-400">Paid via {payment?.label || shipment.paymentMethod}</p>
      </div>

      <div className="flex gap-2 print:hidden">
        <PrimaryButton variant="outline" className="flex-1" onClick={() => window.print()}>
          <Download className="h-4 w-4" />
          Download PDF
        </PrimaryButton>
      </div>

      <PrimaryButton className="mt-3 print:hidden" onClick={() => navigate("/porter")}>
        Book another parcel
      </PrimaryButton>
    </Screen>
  );
}
