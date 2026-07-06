import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Package, Search } from "lucide-react";
import { toast } from "sonner";
import Screen from "../components/Screen";
import MapPreview from "../components/MapPreview";
import { useBooking } from "../context/BookingContext";
import { getPorterPartnerAssignedPath } from "../utils/routes";
import porterUserApi from "../services/userApi";
import { toCoordinatePayload } from "../utils/location";
import {
  initRazorpayPayment,
  isFlutterWebView,
  handleFlutterRazorpayPayment,
} from "@food/utils/razorpay";

export default function FindingPartner() {
  const navigate = useNavigate();
  const {
    setActiveShipment,
    pickup,
    delivery,
    vehicle,
    total,
    parcel,
    vehicleId,
    coupon,
    paymentMethodId,
    scheduledAt,
  } = useBooking();
  const [submitting, setSubmitting] = useState(false);
  const submittedRef = useRef(false);

  useEffect(() => {
    if (submittedRef.current) return;
    submittedRef.current = true;

    let pollTimer;
    let cancelled = false;

    const placeOrder = async () => {
      setSubmitting(true);
      try {
        const result = await porterUserApi.createOrder({
          pickup,
          delivery,
          vehicleId,
          parcel,
          couponCode: coupon?.code,
          paymentMethod: paymentMethodId,
          scheduledAt: scheduledAt || undefined,
        });

        const order = result?.order || result;
        if (!order?.id && !order?._id) throw new Error("Order creation failed");

        if (order.payment?.method === "razorpay" && order.payment?.status === "pending") {
          const rzpData = order.payment.razorpay;
          const rzpOptions = {
            key: rzpData.key,
            amount: rzpData.amount,
            currency: rzpData.currency || "INR",
            order_id: rzpData.orderId,
            name: "Blaze Porter",
            description: "Porter Order Payment",
          };

          let paymentResult;
          if (isFlutterWebView()) {
            paymentResult = await handleFlutterRazorpayPayment(rzpOptions);
          } else {
            paymentResult = await new Promise((resolve, reject) => {
              initRazorpayPayment({
                ...rzpOptions,
                handler: resolve,
                onError: reject,
                onClose: () => reject(new Error("Payment cancelled")),
              });
            });
          }

          await porterUserApi.verifyPayment({
            orderId: order.id || order._id,
            razorpayOrderId: paymentResult.razorpay_order_id,
            razorpayPaymentId: paymentResult.razorpay_payment_id,
            razorpaySignature: paymentResult.razorpay_signature,
          });
        }

        const pollStatus = async () => {
          if (cancelled) return;
          try {
            const active = await porterUserApi.getActiveOrder({ forceRefresh: true });
            const current = active?.order || active;
            if (!current) return;

            setActiveShipment({
              id: current.id,
              orderNumber: current.orderNumber,
              trackingId: current.orderNumber,
              status: current.status,
              stage: current.deliveryState?.currentPhase || current.status,
              pickup: current.pickup,
              delivery: current.delivery,
              vehicle: current.vehicleName || vehicle?.name,
              total: current.pricing?.total ?? total,
              createdAt: current.createdAt,
            });

            if (["assigned", "partner_accepted", "en_route_pickup", "at_pickup"].includes(current.status)) {
              navigate(getPorterPartnerAssignedPath(), { replace: true });
              return;
            }

            pollTimer = setTimeout(pollStatus, 2500);
          } catch {
            pollTimer = setTimeout(pollStatus, 3000);
          }
        };

        setActiveShipment({
          id: order.id,
          orderNumber: order.orderNumber,
          trackingId: order.orderNumber,
          status: order.status,
          stage: "searching_partner",
          pickup,
          delivery,
          vehicle: vehicle?.name,
          total: order.pricing?.total ?? total,
          createdAt: order.createdAt || new Date().toISOString(),
        });

        pollTimer = setTimeout(pollStatus, 2000);
      } catch (err) {
        submittedRef.current = false;
        toast.error(err?.response?.data?.message || err?.message || "Failed to create order");
        navigate(-1);
      } finally {
        setSubmitting(false);
      }
    };

    placeOrder();

    return () => {
      cancelled = true;
      if (pollTimer) clearTimeout(pollTimer);
    };
  }, [
    navigate,
    setActiveShipment,
    pickup,
    delivery,
    vehicle,
    total,
    parcel,
    vehicleId,
    coupon,
    paymentMethodId,
    scheduledAt,
  ]);

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
          <h2 className="text-center text-[18px] font-extrabold text-gray-900">
            {submitting ? "Confirming your booking…" : "Searching for delivery partner"}
          </h2>
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
