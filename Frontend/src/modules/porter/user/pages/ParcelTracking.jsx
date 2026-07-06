import React, { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Phone, Check, Loader2 } from "lucide-react";
import Screen from "../components/Screen";
import PorterRouteMap from "../components/PorterRouteMap";
import { PrimaryButton, StickyBar } from "../components/ui";
import { useBooking } from "../context/BookingContext";
import { getPorterRatePath, getPorterInvoicePath } from "../utils/routes";
import { TRACKING_STAGES, resolveTrackingStage } from "../constants/booking";
import { usePorterOrderTracking } from "../hooks/usePorterOrderTracking";

export default function ParcelTracking() {
  const navigate = useNavigate();
  const { activeShipment, setActiveShipment } = useBooking();
  const orderId = activeShipment?.id;

  const { order, loading } = usePorterOrderTracking(orderId, {
    enabled: Boolean(orderId),
    pollMs: 5000,
  });

  useEffect(() => {
    if (!order) return;
    setActiveShipment((prev) => ({
      ...(prev || {}),
      id: order.id,
      orderNumber: order.orderNumber,
      trackingId: order.orderNumber,
      status: order.status,
      stage: resolveTrackingStage(order.status),
      pickup: order.pickup,
      delivery: order.delivery,
      total: order.pricing?.total,
    }));
  }, [order, setActiveShipment]);

  const stage = resolveTrackingStage(order?.status || activeShipment?.status);
  const currentIdx = TRACKING_STAGES.findIndex((s) => s.id === stage);

  const pickupOtp = order?.deliveryState?.pickupOtp;
  const dropOtp = order?.deliveryState?.dropOtp;

  const mapOrder = useMemo(() => order || activeShipment, [order, activeShipment]);

  if (!orderId) {
    return (
      <Screen title="Track parcel" subtitle="No active shipment">
        <p className="text-center text-sm text-gray-500 py-12">No active parcel to track.</p>
        <PrimaryButton onClick={() => navigate("/porter")}>Go home</PrimaryButton>
      </Screen>
    );
  }

  return (
    <Screen title="Track parcel" subtitle={order?.orderNumber || activeShipment?.trackingId || "Live shipment"}>
      {loading && !order ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-[#FF0000]" /></div>
      ) : (
        <>
          {mapOrder?.pickup && mapOrder?.delivery && (
            <PorterRouteMap
              pickup={mapOrder.pickup}
              delivery={mapOrder.delivery}
              routeQuote={{ route: order?.route }}
              height={200}
              className="mb-4"
            />
          )}

          {(pickupOtp || dropOtp) && (
            <div className="mb-4 rounded-2xl border border-[#FF0000]/20 bg-[#FFF1F1] p-4">
              {pickupOtp && ["at_pickup", "partner_accepted", "en_route_pickup", "assigned"].includes(order?.status) && (
                <p className="text-[13px] font-bold text-gray-900">Pickup OTP: <span className="text-[#FF0000]">{pickupOtp}</span></p>
              )}
              {dropOtp && ["at_drop", "in_transit", "picked_up"].includes(order?.status) && (
                <p className="text-[13px] font-bold text-gray-900 mt-1">Delivery OTP: <span className="text-[#FF0000]">{dropOtp}</span></p>
              )}
            </div>
          )}

          <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <h2 className="mb-4 text-[14px] font-bold text-gray-900">Shipment progress</h2>
            <div className="space-y-0">
              {TRACKING_STAGES.map((s, i) => {
                const done = i <= currentIdx;
                const active = i === currentIdx;
                return (
                  <div key={s.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm ${
                        done ? "bg-[#FF0000] text-white" : "bg-gray-100 text-gray-400"
                      }`}>
                        {done && i < currentIdx ? <Check className="h-4 w-4" /> : i + 1}
                      </div>
                      {i < TRACKING_STAGES.length - 1 && (
                        <div className={`my-1 h-8 w-0.5 ${i < currentIdx ? "bg-[#FF0000]" : "bg-gray-200"}`} />
                      )}
                    </div>
                    <div className="pb-6 pt-1">
                      <p className={`text-[14px] font-bold ${active ? "text-[#FF0000]" : done ? "text-gray-900" : "text-gray-400"}`}>
                        {s.label}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <StickyBar>
            {["delivered", "completed"].includes(order?.status) ? (
              <div className="flex gap-2">
                <PrimaryButton variant="outline" className="flex-1" onClick={() => navigate(getPorterInvoicePath(orderId))}>
                  View invoice
                </PrimaryButton>
                <PrimaryButton className="flex-1" onClick={() => navigate(getPorterRatePath())}>
                  Rate delivery
                </PrimaryButton>
              </div>
            ) : (
              <a href="tel:+911234567890" className="flex w-full items-center justify-center gap-2 rounded-2xl border border-gray-200 py-3 text-[14px] font-bold text-gray-700">
                <Phone className="h-4 w-4" /> Need help?
              </a>
            )}
          </StickyBar>
        </>
      )}
    </Screen>
  );
}
