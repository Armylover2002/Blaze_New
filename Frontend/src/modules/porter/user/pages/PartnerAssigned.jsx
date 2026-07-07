import React, { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Phone, Star, Copy, Navigation, Shield, Loader2, Package } from "lucide-react";
import Screen from "../components/Screen";
import PorterRouteMap from "../components/PorterRouteMap";
import { PrimaryButton, StickyBar, inr } from "../components/ui";
import { useBooking } from "../context/BookingContext";
import { getPorterTrackingPath, getPorterCancelPath, getPorterSosPath } from "../utils/routes";
import { usePorterOrderTracking } from "../hooks/usePorterOrderTracking";
import { mapPartnerFromOrder } from "../utils/orderMapper";
import { PORTER_STATUS_LABELS } from "../constants/booking";

export default function PartnerAssigned() {
  const navigate = useNavigate();
  const { activeShipment, setActiveShipment, refreshActiveOrder } = useBooking();
  const orderId = activeShipment?.id;

  const { order, loading } = usePorterOrderTracking(orderId, {
    enabled: Boolean(orderId),
    pollMs: 4000,
  });

  const mapOrder = useMemo(() => order || activeShipment, [order, activeShipment]);

  useEffect(() => {
    if (!order) return;
    setActiveShipment((prev) => ({
      ...(prev || {}),
      id: order.id,
      orderNumber: order.orderNumber,
      trackingId: order.orderNumber,
      status: order.status,
      pickup: order.pickup,
      delivery: order.delivery,
      parcel: order.parcel,
      route: order.route,
      pricing: order.pricing,
      dispatch: order.dispatch,
      deliveryState: order.deliveryState,
      partner: mapPartnerFromOrder(order),
      total: order.pricing?.total ?? prev?.total,
    }));
  }, [order, setActiveShipment]);

  useEffect(() => {
    if (!orderId) {
      void refreshActiveOrder?.();
    }
  }, [orderId, refreshActiveOrder]);

  const partner = useMemo(
    () => activeShipment?.partner || mapPartnerFromOrder(order),
    [activeShipment?.partner, order],
  );

  const pickup = mapOrder?.pickup;
  const delivery = mapOrder?.delivery;
  const routeQuote = useMemo(() => ({ route: mapOrder?.route }), [mapOrder?.route]);
  const parcel = mapOrder?.parcel;
  const parcelWeight = parcel?.weightKg != null
    ? Number(parcel.weightKg) * Math.max(1, Number(parcel?.quantity || 1))
    : null;

  const displayTotal = order?.pricing?.total ?? activeShipment?.pricing?.total ?? activeShipment?.total;
  const pickupOtp = partner?.pickupOtp || order?.deliveryState?.pickupOtp || activeShipment?.deliveryState?.pickupOtp;
  const statusLabel = PORTER_STATUS_LABELS[mapOrder?.status] || "Partner assigned";
  const etaText = mapOrder?.route?.durationText
    ? `Estimated route: ${mapOrder.route.durationText}`
    : null;

  if (!orderId && loading) {
    return (
      <Screen title="Partner assigned">
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-[#FF0000]" />
        </div>
      </Screen>
    );
  }

  if (!orderId) {
    return (
      <Screen title="Partner assigned">
        <p className="text-[14px] text-gray-500">No active shipment. Start a new parcel booking.</p>
        <PrimaryButton className="mt-4" onClick={() => navigate("/porter")}>
          Send a parcel
        </PrimaryButton>
      </Screen>
    );
  }

  const copyOtp = () => {
    if (pickupOtp) navigator.clipboard?.writeText(pickupOtp);
  };

  return (
    <Screen
      title="Partner assigned"
      subtitle={mapOrder?.orderNumber ? `#${mapOrder.orderNumber} · ${statusLabel}` : statusLabel}
      right={
        <button type="button" onClick={() => navigate(getPorterSosPath())} className="text-[12px] font-bold text-[#FF0000]">
          SOS
        </button>
      }
    >
      {pickup && delivery ? (
        <PorterRouteMap
          pickup={pickup}
          delivery={delivery}
          routeQuote={routeQuote}
          height={180}
          className="mb-4"
        />
      ) : loading ? (
        <div className="mb-4 flex h-[180px] items-center justify-center rounded-2xl border border-gray-100 bg-gray-50">
          <Loader2 className="h-6 w-6 animate-spin text-[#FF0000]" />
        </div>
      ) : null}

      {partner ? (
        <div className="mb-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            {partner.profilePhoto ? (
              <img
                src={partner.profilePhoto}
                alt={partner.name}
                className="h-14 w-14 rounded-full object-cover ring-2 ring-[#FFF1F1]"
              />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#FFF1F1] text-[20px] font-bold text-[#FF0000]">
                {partner.name.charAt(0)}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h2 className="text-[16px] font-extrabold text-gray-900">{partner.name}</h2>
              {partner.rating != null && (
                <div className="flex items-center gap-1 text-[12px] text-gray-500">
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                  <span className="font-bold">{partner.rating}</span>
                  {partner.trips != null && <span>· {partner.trips} ratings</span>}
                </div>
              )}
              <p className="text-[12px] text-gray-600">
                {[partner.vehicle, partner.vehicleNumber].filter(Boolean).join(" · ") || "Parcel delivery"}
              </p>
            </div>
            {partner.phone ? (
              <a href={`tel:${partner.phone.replace(/\s/g, "")}`} className="flex h-10 w-10 items-center justify-center rounded-full bg-[#2e7d32] text-white">
                <Phone className="h-4 w-4" />
              </a>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="mb-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <p className="text-[14px] font-bold text-gray-900">Partner assigned</p>
          <p className="mt-1 text-[12px] text-gray-500">Your delivery partner is heading to pickup.</p>
        </div>
      )}

      {parcel && (parcel.parcelName || parcelWeight) && (
        <div className="mb-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFF1F1] text-[#FF0000]">
              <Package className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Parcel</p>
              <p className="text-[14px] font-bold text-gray-900">{parcel.parcelName || "Parcel shipment"}</p>
              {parcelWeight != null && (
                <p className="text-[12px] text-gray-500">{parcelWeight} kg</p>
              )}
              {parcel.receiverName && (
                <p className="mt-1 text-[12px] text-gray-600">To: {parcel.receiverName}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {pickupOtp && (
        <div className="mb-4 rounded-2xl border-2 border-dashed border-[#FF0000]/30 bg-[#FFF1F1] p-4 text-center">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#FF0000]">Pickup OTP</p>
          <div className="mt-1 flex items-center justify-center gap-2">
            <span className="text-[32px] font-extrabold tracking-[0.3em] text-gray-900">{pickupOtp}</span>
            <button type="button" onClick={copyOtp} className="flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-sm">
              <Copy className="h-4 w-4 text-gray-600" />
            </button>
          </div>
          <p className="mt-1 text-[11px] text-gray-600">Share this OTP only when handing over the parcel</p>
        </div>
      )}

      <div className="mb-4 flex items-center gap-2 rounded-2xl bg-white p-3 shadow-sm">
        <Shield className="h-4 w-4 text-[#2e7d32]" />
        <p className="text-[12px] text-gray-600">Live tracking enabled · {statusLabel}</p>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-4">
        <div className="flex items-center justify-between">
          <span className="text-[13px] text-gray-500">Delivery fare</span>
          <span className="text-[16px] font-extrabold text-gray-900">
            {displayTotal != null ? inr(displayTotal) : "—"}
          </span>
        </div>
        {etaText && (
          <p className="mt-1 text-[11px] text-gray-400">{etaText}</p>
        )}
        {mapOrder?.route?.distanceText && (
          <p className="mt-1 text-[11px] text-gray-400">{mapOrder.route.distanceText}</p>
        )}
      </div>

      <StickyBar>
        <div className="flex gap-2">
          <PrimaryButton variant="outline" className="flex-1" onClick={() => navigate(getPorterCancelPath())}>
            Cancel
          </PrimaryButton>
          <PrimaryButton className="flex-[2]" onClick={() => navigate(getPorterTrackingPath())}>
            <Navigation className="h-4 w-4" />
            Track parcel
          </PrimaryButton>
        </div>
      </StickyBar>
    </Screen>
  );
}
