import React, { useState, useEffect, useMemo, useRef, useCallback } from "react"
import { useParams, Link, useSearchParams, useLocation } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import { generateOrderInvoice } from "../../../utils/printOrderInvoice"
import { toast } from "sonner"
import {
  ArrowLeft,
  Share2,
  RefreshCw,
  Download,
  Phone,
  User,
  ChevronRight,
  MapPin,
  Home as HomeIcon,
  MessageSquare,
  X,
  Check,
  Shield,
  Receipt,
  CircleSlash,
  Loader2,
  Star
} from "lucide-react"
import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"
import AnimatedPage from "@food/components/user/AnimatedPage"
import { Card, CardContent } from "@food/components/ui/card"
import { Button } from "@food/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@food/components/ui/dialog"
import { Textarea } from "@food/components/ui/textarea"
import { useOptionalOrders } from "@food/context/OrdersContext"
import { useProfile } from "@food/context/ProfileContext"
import { useAuth } from "@core/context/AuthContext"
import { useLocation as useUserLocation } from "@food/hooks/useLocation"
import DeliveryTrackingMap from "@food/components/user/DeliveryTrackingMap"
import { isFoodQuickOrder, formatQuickEtaWindow } from "@food/utils/quickDelivery"
import { orderAPI, restaurantAPI } from "@food/api"
import { useCompanyName } from "@food/hooks/useCompanyName"
import { useUserNotifications } from "@food/hooks/useUserNotifications"
import { customerApi } from "../../../../quickCommerce/user/services/customerApi"
import DeliveryOtpDisplay from "../../../../quickCommerce/user/components/DeliveryOtpDisplay"
import ReturnTrackingPanel, { ReturnItemsCta } from "../../../../quickCommerce/user/components/return/ReturnTrackingPanel"
import ReturnWindowBanner from "../../../../quickCommerce/user/components/return/ReturnWindowBanner"
import { resolveLiveReturnEligibility } from "@/shared/utils/returnWindow"
import PharmacyMetaLines from "../../../../quickCommerce/user/components/pharmacy/PharmacyMetaLines"
import { RETURN_STATUS } from "@/shared/utils/returnStatus"
import circleIcon from "@food/assets/circleicon.png"
import { RESTAURANT_PIN_SVG, CUSTOMER_PIN_SVG, RIDER_BIKE_SVG } from "@food/constants/mapIcons"

// ─── Fallback SVGs ────────────────────────────────────────────────────────────
const DEFAULT_CUSTOMER_PIN = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="#10B981"><path d="M12 2C8.13 2 5 5.13 5 9c0 4.17 4.42 9.92 6.24 12.11.4.48 1.08.48 1.52 0C14.58 18.92 19 13.17 19 9c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5 14.5 7.62 14.5 9 13.38 11.5 12 11.5z"/><circle cx="12" cy="9" r="3" fill="#FFFFFF"/></svg>`;
const SAFE_CUSTOMER_PIN = typeof CUSTOMER_PIN_SVG !== 'undefined' ? CUSTOMER_PIN_SVG : DEFAULT_CUSTOMER_PIN;
const DEFAULT_RESTAURANT_PIN = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="#FF0000"><path d="M12 2C8.13 2 5 5.13 5 9c0 4.17 4.42 9.92 6.24 12.11.4.48 1.08.48 1.52 0C14.58 18.92 19 13.17 19 9c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5 14.5 7.62 14.5 9 13.38 11.5 12 11.5z"/><circle cx="12" cy="9" r="3" fill="#FFFFFF"/></svg>`;
const SAFE_RESTAURANT_PIN = typeof RESTAURANT_PIN_SVG !== 'undefined' ? RESTAURANT_PIN_SVG : DEFAULT_RESTAURANT_PIN;

// ─── Debug helpers (no-ops in production, tree-shake friendly) ────────────────
const debugLog = (...args) => console.log('[OrderTracking]', ...args)
const debugWarn = (...args) => console.warn('[OrderTracking]', ...args)
const debugError = (...args) => console.error('[OrderTracking]', ...args)
const INVOICE_BRAND_NAME = "Appzeto"

// ─── Stable animated checkmark ───────────────────────────────────────────────
// Extracted outside component to prevent recreation on parent re-renders
const CHECKMARK_CIRCLE_ANIM = { pathLength: 1, opacity: 1 }
const CHECKMARK_CIRCLE_INIT = { pathLength: 0, opacity: 0 }
const CHECKMARK_PATH_INIT = { pathLength: 0, opacity: 0 }
const CHECKMARK_PATH_ANIM = { pathLength: 1, opacity: 1 }

const AnimatedCheckmark = React.memo(function AnimatedCheckmark({ delay = 0 }) {
  return (
    <motion.svg width="80" height="80" viewBox="0 0 80 80" initial="hidden" animate="visible" className="mx-auto">
      <motion.circle cx="40" cy="40" r="36" fill="none" stroke="#22c55e" strokeWidth="4"
        initial={CHECKMARK_CIRCLE_INIT} animate={CHECKMARK_CIRCLE_ANIM}
        transition={{ duration: 0.5, delay, ease: "easeOut" }} />
      <motion.path d="M24 40 L35 51 L56 30" fill="none" stroke="#22c55e" strokeWidth="4"
        strokeLinecap="round" strokeLinejoin="round"
        initial={CHECKMARK_PATH_INIT} animate={CHECKMARK_PATH_ANIM}
        transition={{ duration: 0.4, delay: delay + 0.4, ease: "easeOut" }} />
    </motion.svg>
  )
})

// ─── DeliveryMap ─────────────────────────────────────────────────────────────
const DeliveryMap = React.memo(function DeliveryMap({
  orderId, order, isVisible, fallbackCustomerCoords = null,
  userLiveCoords = null, userLocationAccuracy = null, onEtaUpdate = null
}) {
  const toPointFromGeoJSON = useCallback((coords) => {
    if (!Array.isArray(coords) || coords.length < 2) return null;
    const lng = Number(coords[0]);
    const lat = Number(coords[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  }, []);

  const restaurantCoords = useMemo(() => {
    let coords = null;
    if (order?.restaurantLocation?.coordinates?.length >= 2) coords = order.restaurantLocation.coordinates;
    else if (order?.restaurantId?.location?.coordinates?.length >= 2) coords = order.restaurantId.location.coordinates;
    else if (order?.restaurantId?.location?.latitude && order?.restaurantId?.location?.longitude)
      coords = [order.restaurantId.location.longitude, order.restaurantId.location.latitude];

    const fromCoords = toPointFromGeoJSON(coords);
    if (fromCoords) return fromCoords;

    const lat = Number(order?.restaurantId?.location?.latitude || order?.restaurant?.location?.latitude);
    const lng = Number(order?.restaurantId?.location?.longitude || order?.restaurant?.location?.longitude);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  }, [
    order?.restaurantLocation?.coordinates,
    order?.restaurantId?.location,
    order?.restaurant?.location,
    toPointFromGeoJSON,
  ]);

  const customerCoords = useMemo(() => {
    const coords = order?.address?.coordinates || order?.address?.location?.coordinates;
    const fromCoords = toPointFromGeoJSON(coords);
    if (fromCoords) return fromCoords;
    if (fallbackCustomerCoords && Number.isFinite(fallbackCustomerCoords.lat) && Number.isFinite(fallbackCustomerCoords.lng))
      return fallbackCustomerCoords;
    return null;
  }, [order?.address?.coordinates, order?.address?.location?.coordinates, fallbackCustomerCoords, toPointFromGeoJSON]);

  const deliveryBoyData = useMemo(() => order?.deliveryPartner ? {
    name: order.deliveryPartner.name || 'Delivery Partner',
    avatar: order.deliveryPartner.avatar || null
  } : null, [order?.deliveryPartner]);

  const orderTrackingIdsList = useMemo(() => (
    [order?.orderId, order?.mongoId, order?._id, orderId, order?.id].filter(Boolean)
  ), [order?.orderId, order?.mongoId, order?._id, orderId, order?.id]);

  if (!isVisible || !orderId || !order || !restaurantCoords || !customerCoords) {
    return <div className="relative min-h-[450px] bg-gradient-to-b from-gray-100 to-gray-200" style={{ height: '450px' }} />;
  }

  return (
    <div className="relative w-full min-h-[450px] overflow-visible" style={{ height: '450px' }}>
      <DeliveryTrackingMap
        orderId={orderId}
        orderTrackingIds={orderTrackingIdsList}
        restaurantCoords={restaurantCoords}
        customerCoords={customerCoords}
        userLiveCoords={userLiveCoords}
        userLocationAccuracy={userLocationAccuracy}
        deliveryBoyData={deliveryBoyData}
        order={order}
        onEtaUpdate={onEtaUpdate}
      />
    </div>
  );
});

// ─── SectionItem ─────────────────────────────────────────────────────────────
// Extracted stable tap animation object to prevent recreation
const SECTION_TAP = { scale: 0.99 };
const SectionItem = React.memo(function SectionItem({
  icon: Icon, iconNode, title, subtitle, onClick, showArrow = true, rightContent
}) {
  return (
    <motion.button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors text-left border-b border-dashed border-gray-200 last:border-0"
      whileTap={SECTION_TAP}
    >
      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
        {iconNode ? (
          <div className="w-6 h-6 flex-shrink-0 flex items-center justify-center [&_svg]:w-full [&_svg]:h-full [&_svg]:block">
            {iconNode}
          </div>
        ) : (
          <Icon className="w-5 h-5 text-gray-600 flex-shrink-0" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 truncate">{title}</p>
        {subtitle && <p className="text-sm text-gray-500 truncate">{subtitle}</p>}
      </div>
      {rightContent || (showArrow && <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />)}
    </motion.button>
  );
});

// ─── Pure utility functions (module-level, never recreated) ──────────────────
function getRestaurantCoordsFromOrder(apiOrder, fallback = null) {
  if (apiOrder?.restaurantId?.location?.coordinates?.length >= 2)
    return apiOrder.restaurantId.location.coordinates;
  if (apiOrder?.restaurantId?.location?.latitude && apiOrder?.restaurantId?.location?.longitude)
    return [apiOrder.restaurantId.location.longitude, apiOrder.restaurantId.location.latitude];
  if (apiOrder?.restaurant?.location?.coordinates?.length >= 2)
    return apiOrder.restaurant.location.coordinates;
  return fallback || null;
}

function getRestaurantAddressFromOrder(apiOrder, previousOrder = null, explicitRestaurantAddress = null) {
  if (explicitRestaurantAddress?.trim()) return explicitRestaurantAddress.trim();
  const location = apiOrder?.restaurantId?.location || apiOrder?.restaurant?.location || {};
  if (location?.formattedAddress?.trim()) return location.formattedAddress.trim();
  if (location?.address?.trim()) return location.address.trim();
  if (location?.addressLine1?.trim()) return location.addressLine1.trim();
  const parts = [location?.street, location?.area, location?.city, location?.state, location?.zipCode]
    .map((v) => String(v ?? '').trim()).filter(Boolean);
  if (parts.length > 0) return parts.join(', ');
  return previousOrder?.restaurantAddress || apiOrder?.restaurantAddress || apiOrder?.restaurant?.address || 'Restaurant location';
}

function getCustomerCoordsFromApiOrder(apiOrder, previousOrder = null) {
  const addr = apiOrder?.address || apiOrder?.deliveryAddress || {};
  if (Array.isArray(addr?.location?.coordinates) && addr.location.coordinates.length >= 2) return addr.location.coordinates;
  if (Array.isArray(addr?.coordinates) && addr.coordinates.length >= 2) return addr.coordinates;
  const lat = Number(addr?.location?.lat ?? addr?.location?.latitude);
  const lng = Number(addr?.location?.lng ?? addr?.location?.longitude);
  if (Number.isFinite(lat) && Number.isFinite(lng)) return [lng, lat];
  const prev = previousOrder?.address?.coordinates || previousOrder?.address?.location?.coordinates;
  if (Array.isArray(prev) && prev.length >= 2) return prev;
  return null;
}

function buildAddressFromPickupPoint(point) {
  const raw = [point?.address, point?.formattedAddress, point?.location?.address, point?.location?.formattedAddress]
    .map((v) => String(v || '').trim()).find(Boolean);
  if (raw) return raw;
  const coords = point?.location?.coordinates;
  if (Array.isArray(coords) && coords.length >= 2) {
    const lng = Number(coords[0]), lat = Number(coords[1]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }
  return "";
}

function buildPickupSources(apiOrder, previousOrder = null, restaurantAddress = "") {
  const pickupPoints = Array.isArray(apiOrder?.pickupPoints) ? apiOrder.pickupPoints : [];
  const previousSources = Array.isArray(previousOrder?.pickupSources) ? previousOrder.pickupSources : [];
  const normalized = pickupPoints
    .map((point, index) => {
      const pickupType = point?.pickupType === "quick" ? "quick" : "food";
      const fallbackAddress = pickupType === "food" ? (restaurantAddress || previousOrder?.restaurantAddress || "") : "";
      return {
        id: point?.legId || `${pickupType}:${point?.sourceId || index}`,
        pickupType,
        label: pickupType === "quick" ? "Store" : "Restaurant",
        name: String(point?.sourceName || (pickupType === "quick" ? "Seller Store" : apiOrder?.restaurantName || previousOrder?.restaurant || "Restaurant")).trim(),
        address: buildAddressFromPickupPoint(point) || fallbackAddress || "Address not available",
        phone: pickupType === "food"
          ? String(apiOrder?.restaurantPhone || apiOrder?.restaurantId?.phone || apiOrder?.restaurant?.phone || previousOrder?.restaurantPhone || '').trim()
          : String(point?.phone || point?.contactPhone || '').trim(),
      };
    })
    .filter((source) => source.name || source.address);

  if (normalized.length > 0) return normalized;
  if (previousSources.length > 0) return previousSources;
  return [{
    id: "food:primary", pickupType: "food", label: "Restaurant",
    name: String(apiOrder?.restaurantName || previousOrder?.restaurant || "Restaurant").trim(),
    address: restaurantAddress || previousOrder?.restaurantAddress || "Restaurant location",
    phone: String(apiOrder?.restaurantPhone || apiOrder?.restaurantId?.phone || apiOrder?.restaurant?.phone || previousOrder?.restaurantPhone || '').trim(),
  }];
}

function getPartnerDisplayAvatar(avatar, name = "Delivery Partner") {
  const trimmed = String(avatar || '').trim();
  if (trimmed) return trimmed;
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=eff6ff&color=1d4ed8&size=128`;
}

function formatPartnerRating(rating) {
  const n = Number(rating);
  return Number.isFinite(n) && n > 0 ? n.toFixed(1) : "";
}

const formatInvoiceCurrency = (value) => `Rs. ${Number(value || 0).toFixed(2)}`;
const formatInvoiceDateTime = (value) => {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true });
};

function normalizeDeliveryPartner(partnerRef, fallbackName = "Delivery Partner") {
  if (!partnerRef) return null;
  if (typeof partnerRef === "string")
    return { id: partnerRef, name: fallbackName, phone: "", avatar: "", rating: null, totalRatings: 0 };
  const name = String(partnerRef?.name || partnerRef?.fullName || partnerRef?.displayName || fallbackName).trim() || fallbackName;
  return {
    id: partnerRef?._id || partnerRef?.id || "",
    name,
    phone: String(partnerRef?.phone || partnerRef?.phoneNumber || "").trim(),
    avatar: String(partnerRef?.avatar || partnerRef?.profilePicture || partnerRef?.profileImage || "").trim(),
    rating: Number.isFinite(Number(partnerRef?.rating)) ? Number(partnerRef.rating) : null,
    totalRatings: Number(partnerRef?.totalRatings || 0),
  };
}

function buildTrackingDeliveryPartners(apiOrder, previousOrder = null) {
  const previousPartners = Array.isArray(previousOrder?.deliveryPartners) ? previousOrder.deliveryPartners : [];
  const legs = Array.isArray(apiOrder?.dispatchPlan?.legs) ? apiOrder.dispatchPlan.legs : [];
  const seen = new Set();

  const normalizedLegPartners = legs.map((leg, index) => {
    const deliveryPartner = normalizeDeliveryPartner(
      leg?.deliveryPartnerId,
      leg?.pickupType === "quick" ? "Store Rider" : "Restaurant Rider",
    );
    if (!deliveryPartner?.id && !deliveryPartner?.name) return null;
    const key = String(leg?.legId || deliveryPartner?.id || `${leg?.pickupType || "delivery"}:${leg?.sourceId || index}`);
    if (seen.has(key)) return null;
    seen.add(key);
    const pickupType = leg?.pickupType === "quick" ? "quick" : "food";
    return {
      id: deliveryPartner?.id || key, legId: leg?.legId || key, pickupType,
      sourceId: leg?.sourceId || null, sourceName: String(leg?.sourceName || '').trim(),
      label: pickupType === "quick" ? "Store pickup" : "Restaurant pickup",
      statusText: pickupType === "quick" ? "Handling the store pickup for your express order" : "Handling the restaurant pickup for your express order",
      name: deliveryPartner.name, phone: deliveryPartner.phone, avatar: deliveryPartner.avatar,
      rating: deliveryPartner.rating, totalRatings: deliveryPartner.totalRatings,
    };
  }).filter(Boolean);

  if (normalizedLegPartners.length > 0) return normalizedLegPartners;

  const singlePartner = normalizeDeliveryPartner(
    apiOrder?.deliveryPartnerId || apiOrder?.dispatch?.deliveryPartnerId, "Delivery Partner",
  );
  if (singlePartner) {
    return [{
      id: singlePartner.id || "primary-delivery-partner", legId: null, pickupType: "food",
      sourceId: null, sourceName: "", label: "Delivery partner",
      statusText: "Your delivery partner is arriving",
      name: singlePartner.name, phone: singlePartner.phone, avatar: singlePartner.avatar,
      rating: singlePartner.rating, totalRatings: singlePartner.totalRatings,
    }];
  }
  return previousPartners;
}

function transformOrderForTracking(apiOrder, previousOrder = null, explicitRestaurantCoords = null, explicitRestaurantAddress = null) {
  const restaurantCoords = explicitRestaurantCoords || getRestaurantCoordsFromOrder(apiOrder, previousOrder?.restaurantLocation?.coordinates);
  const restaurantAddress = getRestaurantAddressFromOrder(apiOrder, previousOrder, explicitRestaurantAddress);
  const addr = apiOrder?.address || apiOrder?.deliveryAddress || {};
  const customerCoordsResolved = getCustomerCoordsFromApiOrder(apiOrder, previousOrder);
  const pickupSources = buildPickupSources(apiOrder, previousOrder, restaurantAddress);
  const deliveryPartners = buildTrackingDeliveryPartners(apiOrder, previousOrder);
  const primaryDeliveryPartner = deliveryPartners[0] || null;

  return {
    id: apiOrder?.orderId || apiOrder?._id,
    mongoId: apiOrder?._id || null,
    orderId: apiOrder?.orderId || apiOrder?._id,
    restaurant: apiOrder?.restaurantName || previousOrder?.restaurant || (apiOrder?.orderType === 'quick' || /^QC/i.test(apiOrder?.orderId || apiOrder?._id) ? 'Store' : 'Restaurant'),
    orderType: apiOrder?.orderType || previousOrder?.orderType || 'food',
    restaurantPhone: apiOrder?.restaurantPhone || apiOrder?.restaurantId?.phone || apiOrder?.restaurantId?.ownerPhone || apiOrder?.restaurant?.phone || apiOrder?.restaurant?.ownerPhone || previousOrder?.restaurantPhone || '',
    restaurantAddress, restaurantId: apiOrder?.restaurantId || previousOrder?.restaurantId || null,
    userId: apiOrder?.userId || previousOrder?.userId || null,
    userName: apiOrder?.userName || apiOrder?.userId?.name || apiOrder?.userId?.fullName || previousOrder?.userName || '',
    userPhone: apiOrder?.userPhone || apiOrder?.userId?.phone || previousOrder?.userPhone || '',
    address: {
      street: addr?.street || previousOrder?.address?.street || '',
      city: addr?.city || previousOrder?.address?.city || '',
      state: addr?.state || previousOrder?.address?.state || '',
      zipCode: addr?.zipCode || previousOrder?.address?.zipCode || '',
      additionalDetails: addr?.additionalDetails || previousOrder?.address?.additionalDetails || '',
      formattedAddress: addr?.formattedAddress ||
        (addr?.street && addr?.city
          ? `${addr.street}${addr.additionalDetails ? `, ${addr.additionalDetails}` : ''}, ${addr.city}${addr.state ? `, ${addr.state}` : ''}${addr.zipCode ? ` ${addr.zipCode}` : ''}`
          : previousOrder?.address?.formattedAddress || addr?.city || ''),
      coordinates: customerCoordsResolved || addr?.location?.coordinates || previousOrder?.address?.coordinates || null,
    },
    restaurantLocation: { coordinates: restaurantCoords },
    pickupSources,
    items: apiOrder?.items?.map(item => ({
      name: item.name,
      variantName: item.variantName || item.notes || '',
      quantity: item.quantity,
      price: item.price,
      image: item.image || item.mainImage || null,
      pharmacyDetails: item.pharmacyDetails || null,
      variants: Array.isArray(item.variants) ? item.variants : [],
    })) || previousOrder?.items || [],
    total: apiOrder?.pricing?.total || previousOrder?.total || 0,
    status: apiOrder?.orderStatus || apiOrder?.status || previousOrder?.status || 'pending',
    deliveryPartner: primaryDeliveryPartner || previousOrder?.deliveryPartner || null,
    deliveryPartners,
    deliveryPartnerId: primaryDeliveryPartner?.id || apiOrder?.deliveryPartnerId?._id || apiOrder?.deliveryPartnerId || apiOrder?.dispatch?.deliveryPartnerId?._id || apiOrder?.dispatch?.deliveryPartnerId || apiOrder?.assignmentInfo?.deliveryPartnerId || null,
    dispatch: apiOrder?.dispatch || previousOrder?.dispatch || null,
    assignmentInfo: apiOrder?.assignmentInfo || previousOrder?.assignmentInfo || null,
    tracking: apiOrder?.tracking || previousOrder?.tracking || {},
    deliveryState: apiOrder?.deliveryState || previousOrder?.deliveryState || null,
    createdAt: apiOrder?.createdAt || previousOrder?.createdAt || null,
    totalAmount: apiOrder?.pricing?.total || apiOrder?.totalAmount || previousOrder?.totalAmount || 0,
    deliveryFee: apiOrder?.pricing?.deliveryFee || apiOrder?.deliveryFee || previousOrder?.deliveryFee || 0,
    quickDeliveryFee: apiOrder?.pricing?.quickDeliveryFee ?? previousOrder?.quickDeliveryFee ?? 0,
    deliveryMode: apiOrder?.deliveryMode || previousOrder?.deliveryMode || "basic",
    etaPromise: apiOrder?.etaPromise || previousOrder?.etaPromise || null,
    sla: apiOrder?.sla || previousOrder?.sla || null,
    gst: apiOrder?.pricing?.tax || apiOrder?.pricing?.gst || apiOrder?.gst || apiOrder?.tax || previousOrder?.gst || 0,
    packagingFee: apiOrder?.pricing?.packagingFee || apiOrder?.packagingFee || 0,
    platformFee: apiOrder?.pricing?.platformFee || apiOrder?.platformFee || 0,
    discount: apiOrder?.pricing?.discount || apiOrder?.discount || 0,
    subtotal: apiOrder?.pricing?.subtotal || apiOrder?.subtotal || 0,
    paymentMethod: apiOrder?.paymentMethod || apiOrder?.payment?.method || previousOrder?.paymentMethod || null,
    paymentStatus: apiOrder?.paymentStatus || apiOrder?.payment?.status || previousOrder?.paymentStatus || null,
    payment: apiOrder?.payment || previousOrder?.payment || null,
    ratings: (() => {
      const apiRatings = apiOrder?.ratings;
      if (apiRatings?.seller) {
        return {
          ...apiRatings,
          restaurant: apiRatings.seller,
        };
      }
      return apiRatings || previousOrder?.ratings || null;
    })(),
    deliveryVerification: (() => {
      const prevDV = previousOrder?.deliveryVerification || null;
      const apiDV = apiOrder?.deliveryVerification || null;
      const handoverOtp = apiOrder?.handoverOtp || null;
      if (!prevDV && !apiDV && !handoverOtp) return null;
      const prevDropOtp = prevDV?.dropOtp || null;
      const apiDropOtp = apiDV?.dropOtp || null;
      const merged = { ...(prevDV || {}), ...(apiDV || {}) };
      const finalCode = handoverOtp || prevDropOtp?.code || apiDropOtp?.code;
      if (finalCode || prevDropOtp?.required || apiDropOtp?.required) {
        merged.dropOtp = { ...(prevDropOtp || {}), ...(apiDropOtp || {}), code: finalCode };
      }
      return merged;
    })(),
    deliveredAt:
      apiOrder?.deliveryState?.deliveredAt ||
      apiOrder?.deliveredAt ||
      previousOrder?.deliveredAt ||
      null,
    returnEligibility:
      apiOrder?.returnEligibility ||
      (apiOrder?.returnWindowHours != null
        ? {
            canReturn: apiOrder.canReturn,
            returnsEnabled: apiOrder.returnsEnabled,
            returnWindowHours: apiOrder.returnWindowHours,
            returnExpiryAt: apiOrder.returnExpiryAt,
            deliveredAt: apiOrder.deliveredAt,
            remainingSeconds: apiOrder.remainingSeconds,
            remainingHours: apiOrder.remainingHours,
            returnWindowExpired: apiOrder.returnWindowExpired,
          }
        : previousOrder?.returnEligibility || null),
  };
}

// ─── Status mapping (module-level, pure) ─────────────────────────────────────
function mapBackendOrderStatusToUi(raw) {
  const s = String(raw || "").toLowerCase();
  if (!s || s === "pending" || s === "created") return "placed";
  if (s === "placed") return "placed";
  if (s === "scheduled") return "scheduled";
  if (s === "confirmed" || s === "accepted") return "confirmed";
  if (s === "preparing" || s === "processed") return "preparing";
  if (s === "ready" || s === "ready_for_pickup" || s === "reached_pickup" || s === "order_confirmed") return "ready";
  if (s === "picked_up" || s === "out_for_delivery" || s === "en_route_to_delivery") return "on_way";
  if (s === "reached_drop" || s === "at_drop" || s === "at_delivery") return "at_drop";
  if (s === "delivered" || s === "completed") return "delivered";
  if (s.includes("cancelled") || s === "cancelled") return "cancelled";
  return "placed";
}

function mapOrderToTrackingUiStatus(orderLike) {
  if (!orderLike) return "placed";
  const statusRaw = orderLike.status || orderLike.orderStatus;
  const phase = orderLike.deliveryState?.currentPhase;
  if (isFoodOrderCancelledStatus(statusRaw)) return "cancelled";
  if (statusRaw === "delivered" || statusRaw === "completed") return "delivered";
  const isRiderAccepted = orderLike.dispatch?.status === "accepted" || orderLike.assignmentInfo?.status === "accepted" || orderLike.deliveryPartner?.status === "accepted";
  if (phase === "reached_drop" || phase === "at_drop" || statusRaw === "at_drop") return "at_drop";
  if (phase === "en_route_to_delivery" || statusRaw === "picked_up" || statusRaw === "out_for_delivery") return "on_way";
  if (phase === "at_pickup" && orderLike.deliveryPartnerId && isRiderAccepted) return "at_pickup";
  if (phase === "en_route_to_pickup" && orderLike.deliveryPartnerId && isRiderAccepted) return "assigned";
  return mapBackendOrderStatusToUi(statusRaw);
}

function isFoodOrderCancelledStatus(statusRaw) {
  const s = String(statusRaw || "").toLowerCase();
  return s === "cancelled" || s.includes("cancelled");
}

function normalizeLookupId(value) {
  if (value == null) return "";
  const raw = String(value).trim();
  if (!raw || raw === "undefined" || raw === "null") return "";
  return raw;
}

function extractOrderDetailsPayload(response) {
  if (response?.data?.success && response?.data?.result && typeof response.data.result === "object") return response.data.result;
  if (response?.data?.success && response?.data?.data?.order) return response.data.data.order;
  if (response?.data?.order && typeof response.data.order === "object") return response.data.order;
  if (response?.data?.data && typeof response.data.data === "object" && !Array.isArray(response.data.data))
    return response.data.data.order || response.data.data;
  // For quick commerce, if response.data is the order itself
  if (response?.data && typeof response.data === "object" && !Array.isArray(response.data) && !response.data.success) {
    return response.data;
  }
  return null;
}

function normalizeQuickWorkflowStatus(rawStatus) {
  const status = String(rawStatus || "").trim().toUpperCase();
  if (!status) return null;
  if (status === "CREATED" || status === "PENDING") return "created";
  if (status === "CONFIRMED" || status === "ACCEPTED") return "confirmed";
  if (status === "PACKING" || status === "PREPARING" || status === "PROCESSING") return "preparing";
  if (status === "READY" || status === "READY_FOR_PICKUP") return "ready_for_pickup";
  if (status === "OUT_FOR_DELIVERY" || status === "PICKED_UP") return "out_for_delivery";
  if (status === "DELIVERED" || status === "COMPLETED") return "delivered";
  if (status.includes("CANCEL")) return "cancelled";
  return status.toLowerCase();
}

function isRefundablePrepaidOrder(order) {
  if (!order) return false;
  const method = String(order?.payment?.method || order?.paymentMethod || "").trim().toLowerCase();
  const status = String(order?.payment?.status || order?.paymentStatus || "").trim().toLowerCase();

  if (["cash", "cod"].includes(method)) return false;

  const hasRazorpayPaymentId = Boolean(order?.payment?.razorpay?.paymentId);
  const hasRazorpayOrderId = Boolean(order?.payment?.razorpay?.orderId);
  const isPaid = ["paid", "refunded"].includes(status);
  const isOnlineMethod = ["razorpay", "razorpay_qr", "online", "upi", "card"].includes(method);

  if (isPaid && (isOnlineMethod || hasRazorpayPaymentId || hasRazorpayOrderId)) return true;
  if (hasRazorpayPaymentId && !["failed", "cancelled"].includes(status)) return true;

  return false;
}

function isQuickOrderOnlinePayment(order, confirmedCheckout = false) {
  if (!order) return false;
  const method = String(order?.payment?.method || order?.paymentMethod || "").trim().toLowerCase();
  if (["cash", "cod"].includes(method)) return false;
  if (confirmedCheckout) return true;
  if (isRefundablePrepaidOrder(order)) return true;
  if (Boolean(order?.payment?.razorpay?.paymentId || order?.payment?.razorpay?.orderId)) return true;
  if (["razorpay", "razorpay_qr", "online", "upi", "card"].includes(method)) return true;
  return false;
}

function normalizeQuickOrderForTracking(rawOrder) {
  if (!rawOrder || typeof rawOrder !== "object") return rawOrder;
  const seller = rawOrder.seller || rawOrder.store || rawOrder.storeId || rawOrder.sellerId || {};
  const sellerCoords = Array.isArray(seller?.location?.coordinates)
    ? seller.location.coordinates
    : Number.isFinite(Number(seller?.location?.lng)) && Number.isFinite(Number(seller?.location?.lat))
      ? [Number(seller.location.lng), Number(seller.location.lat)] : null;
  const sellerName = String(rawOrder.storeName || rawOrder.sellerName || seller?.name || seller?.storeName || "Store").trim();
  const sellerAddress = String(seller?.location?.formattedAddress || seller?.location?.address || seller?.address || rawOrder.restaurantAddress || "").trim();
  const address = rawOrder.address || rawOrder.deliveryAddress || {};
  const addressCoords = Array.isArray(address?.location?.coordinates) ? address.location.coordinates
    : Number.isFinite(Number(address?.location?.lng)) && Number.isFinite(Number(address?.location?.lat))
      ? [Number(address.location.lng), Number(address.location.lat)] : null;
  const deliveryPartner = rawOrder.deliveryPartnerId || rawOrder.deliveryPartner || rawOrder.deliveryBoy || rawOrder.rider || null;
  return {
    ...rawOrder, orderType: "quick",
    restaurantName: rawOrder.restaurantName || sellerName,
    restaurantPhone: rawOrder.restaurantPhone || seller?.phone || seller?.phoneNumber || "",
    restaurantId: rawOrder.restaurantId || seller || null,
    restaurantAddress: rawOrder.restaurantAddress || sellerAddress,
    status: rawOrder.status || rawOrder.orderStatus || normalizeQuickWorkflowStatus(rawOrder.workflowStatus) || "created",
    orderStatus: rawOrder.orderStatus || normalizeQuickWorkflowStatus(rawOrder.workflowStatus) || rawOrder.status || "created",
    address: {
      ...address, street: address?.street || address?.address || "",
      formattedAddress: address?.formattedAddress || address?.address || [address?.street, address?.city, address?.state, address?.zipCode].filter(Boolean).join(", "),
      location: addressCoords && !address?.location?.coordinates ? { ...(address.location || {}), coordinates: addressCoords } : address.location,
    },
    pickupPoints: Array.isArray(rawOrder.pickupPoints) && rawOrder.pickupPoints.length > 0
      ? rawOrder.pickupPoints
      : [{
        pickupType: "quick",
        sourceId: seller?._id || seller?.id || rawOrder.sellerId || rawOrder.storeId || "quick-store",
        sourceName: sellerName, phone: seller?.phone || seller?.phoneNumber || "",
        address: sellerAddress,
        location: sellerCoords ? { coordinates: sellerCoords, formattedAddress: sellerAddress, address: sellerAddress } : undefined,
      }],
    deliveryPartnerId: rawOrder.deliveryPartnerId || deliveryPartner || null,
    paymentMethod: rawOrder.paymentMethod || rawOrder.payment?.method || "",
    paymentStatus: rawOrder.paymentStatus || rawOrder.payment?.status || "",
    payment: rawOrder.payment || {},
  };
}

// ─── Stable STATUS CONFIG (module-level, never recreated) ────────────────────
const STATUS_CONFIG_TEMPLATE = {
  scheduled: { title: "Order Scheduled", color: "bg-blue-600", iconType: 'food' },
  placed: { title: "Order Placed", color: "bg-red-600", iconType: 'food' },
  confirmed: { title: "Order Confirmed", color: "bg-red-600", iconType: 'food' },
  preparing: { title: null /* dynamic */, color: "bg-red-600", iconType: 'food' },
  assigned: { title: "Rider is arriving", color: "bg-red-600", iconType: 'rider' },
  at_pickup: { title: null /* dynamic */, color: "bg-red-600", iconType: 'rider' },
  ready: { title: "Handover in progress", color: "bg-red-600", iconType: 'rider' },
  on_way: { title: "Out for delivery", color: "bg-red-600", iconType: 'rider' },
  at_drop: { title: "Arrived at location", subtitle: "Please come to the door", color: "bg-red-600", iconType: 'rider' },
  delivered: { title: "Order delivered", color: "bg-red-600", iconType: 'delivered' },
  cancelled: { title: "Order cancelled", subtitle: "This order has been cancelled", color: "bg-red-600", iconType: 'cancelled' },
};

// ─── Stable motion props (module-level) ──────────────────────────────────────
const MOTION_FADE = { initial: { opacity: 0 }, animate: { opacity: 1 } };
const MOTION_SLIDE_UP = (delay) => ({ initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { delay } });
const RIDER_SVG_STYLE = { width: "100%", height: "100%" };

// ─── localStorage helpers (lazy init, debounced write) ───────────────────────
function loadShownRatings() {
  try {
    const stored = localStorage.getItem('shownRatingForOrders');
    return stored ? new Set(JSON.parse(stored)) : new Set();
  } catch { return new Set(); }
}

let _saveRatingsTimer = null;
function saveShownRatings(set) {
  if (_saveRatingsTimer) clearTimeout(_saveRatingsTimer);
  _saveRatingsTimer = setTimeout(() => {
    try { localStorage.setItem('shownRatingForOrders', JSON.stringify(Array.from(set))); } catch { }
  }, 500);
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function OrderTracking() {
  const companyName = useCompanyName();
  const { orderId } = useParams();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const confirmed = searchParams.get("confirmed") === "true";
  const prefetchedOrder = location.state?.prefetchedOrder || location.state?.order || null;
  const isQuickOrder =
    String(location.state?.orderType || "").toLowerCase() === "quick" ||
    String(location.pathname || "").startsWith("/quick/orders/") ||
    /^QC/i.test(String(orderId || ""));
  const backPath = isQuickOrder ? "/quick" : "/food/user";

  const ordersContext = useOptionalOrders();
  const getOrderById = ordersContext?.getOrderById || (() => null);
  const { userProfile, getDefaultAddress } = useProfile();
  const profile = userProfile;
  const { isAuthenticated, user: authUser } = useAuth();
  const { location: userLiveLocation } = useUserLocation();
  const { isConnected: isSocketConnected } = useUserNotifications();

  // ── Core order state ────────────────────────────────────────────────────────
  const [order, setOrder] = useState(() =>
    prefetchedOrder
      ? transformOrderForTracking(isQuickOrder ? normalizeQuickOrderForTracking(prefetchedOrder) : prefetchedOrder)
      : null
  );
  const isQuickCommerceOrder = useMemo(() => {
    const orderType = String(
      order?.orderType || prefetchedOrder?.orderType || location.state?.orderType || "",
    ).toLowerCase();
    return isQuickOrder || orderType === "quick" || orderType === "mixed";
  }, [isQuickOrder, order?.orderType, prefetchedOrder?.orderType, location.state?.orderType]);
  const [loading, setLoading] = useState(() => !prefetchedOrder);
  const [initialLoadDone, setInitialLoadDone] = useState(() => Boolean(prefetchedOrder));
  const [error, setError] = useState(null);
  const orderRef = useRef(order);
  orderRef.current = order;

  // ── UI state ────────────────────────────────────────────────────────────────
  const [showConfirmation, setShowConfirmation] = useState(confirmed);
  const [orderStatus, setOrderStatus] = useState(() =>
    prefetchedOrder ? mapOrderToTrackingUiStatus(isQuickOrder ? normalizeQuickOrderForTracking(prefetchedOrder) : prefetchedOrder) : 'placed'
  );
  const [estimatedTime, setEstimatedTime] = useState(29);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancellationNotice, setCancellationNotice] = useState(null);
  const [showOrderDetails, setShowOrderDetails] = useState(false);
  const [cancellationReason, setCancellationReason] = useState("");
  const [refundDestination, setRefundDestination] = useState("gateway");
  const [isCancelling, setIsCancelling] = useState(false);
  const [isInstructionsModalOpen, setIsInstructionsModalOpen] = useState(false);
  const [deliveryInstructions, setDeliveryInstructions] = useState("");
  const [activeReturnCount, setActiveReturnCount] = useState(0);
  const handleReturnRefresh = useCallback((items, meta) => {
    const active = (items || []).filter((r) =>
      [
        RETURN_STATUS.REQUESTED,
        RETURN_STATUS.APPROVED,
        RETURN_STATUS.PICKUP_ASSIGNED,
        RETURN_STATUS.IN_TRANSIT,
        RETURN_STATUS.RETURNED,
      ].includes(r.returnStatus),
    );
    setActiveReturnCount(active.length);
    const nextEligibility = meta?.returnEligibility || meta;
    if (nextEligibility?.returnWindowHours != null || nextEligibility?.returnExpiryAt) {
      setOrder((prev) =>
        prev
          ? {
              ...prev,
              returnEligibility: {
                ...(prev.returnEligibility || {}),
                ...nextEligibility,
              },
            }
          : prev,
      );
    }
  }, []);
  const [isUpdatingInstructions, setIsUpdatingInstructions] = useState(false);
  const [resolvedLookupId, setResolvedLookupId] = useState("");
  const [timerNow, setTimerNow] = useState(Date.now);

  // ── Rating state (grouped) ──────────────────────────────────────────────────
  const [ratingModal, setRatingModal] = useState({ open: false, order: null });
  const [selectedRestaurantRating, setSelectedRestaurantRating] = useState(null);
  const [selectedDeliveryRating, setSelectedDeliveryRating] = useState(null);
  const [restaurantFeedbackText, setRestaurantFeedbackText] = useState("");
  const [deliveryFeedbackText, setDeliveryFeedbackText] = useState("");
  const [submittingRating, setSubmittingRating] = useState(false);
  // Use ref for tracking shown ratings to avoid localStorage read on every render
  const shownRatingForOrdersRef = useRef(null);
  if (shownRatingForOrdersRef.current === null) shownRatingForOrdersRef.current = loadShownRatings();

  // ── Socket OTP ──────────────────────────────────────────────────────────────
  const [socketDropOtpCode, setSocketDropOtpCode] = useState(null);

  // ── Refs (stable across renders) ────────────────────────────────────────────
  const lastRealtimeRefreshRef = useRef(0);
  const confirmationShownAtRef = useRef(confirmed ? Date.now() : 0);
  const trackingOrderIdsRef = useRef(new Set());
  const terminalPollStopRef = useRef(false);
  const lookupIdsRef = useRef([]);
  const pollRef = useRef(null);
  const initialPollGenerationRef = useRef(0);

  // ── Derived values ───────────────────────────────────────────────────────────
  const defaultAddress = getDefaultAddress();

  // Keep lookupIds ref up to date without triggering re-renders
  useEffect(() => {
    const ids = [resolvedLookupId, orderId, order?.orderId, order?.mongoId, order?._id, order?.id]
      .map(normalizeLookupId).filter(Boolean);
    lookupIdsRef.current = Array.from(new Set(ids));
  }, [orderId, resolvedLookupId, order?.orderId, order?.mongoId, order?._id, order?.id]);

  // Keep tracking IDs set up to date
  useEffect(() => {
    const s = trackingOrderIdsRef.current;
    s.add(String(orderId));
    if (order?.orderId) s.add(String(order.orderId));
    if (order?.mongoId) s.add(String(order.mongoId));
    if (order?.id) s.add(String(order.id));
  }, [orderId, order?.orderId, order?.mongoId, order?.id]);

  // Stable API ops - kept in ref so polling closure always uses latest without re-creating interval
  const stableOpsRef = useRef({
    resolveOrderFromList: async () => null,
    fetchOrderDetailsWithFallback: async () => {
      throw new Error("Order fetch not ready");
    },
  });

  useEffect(() => {
    stableOpsRef.current = {
      resolveOrderFromList: async (rawLookupId) => {
        const needle = normalizeLookupId(rawLookupId);
        if (!needle || isQuickOrder) return null;
        const maxPages = 3, limit = 50;
        for (let page = 1; page <= maxPages; page++) {
          const listResponse = await orderAPI.getOrders({ page, limit });
          let orders = [];
          if (listResponse?.data?.success && listResponse?.data?.data?.orders) orders = listResponse.data.data.orders || [];
          else if (listResponse?.data?.orders) orders = listResponse.data.orders || [];
          else if (Array.isArray(listResponse?.data?.data?.data)) orders = listResponse.data.data.data || [];
          else if (Array.isArray(listResponse?.data?.data)) orders = listResponse.data.data || [];
          const matched = (orders || []).find((o) =>
            [o?._id, o?.id, o?.orderId, o?.mongoId].map(normalizeLookupId).includes(needle)
          );
          if (matched) return matched;
          const totalPages = Number(listResponse?.data?.data?.pagination?.pages) || Number(listResponse?.data?.data?.totalPages) || 1;
          if (page >= totalPages) break;
        }
        return null;
      },
      fetchOrderDetailsWithFallback: async (options = {}) => {
        const ids = lookupIdsRef.current;
        if (ids.length === 0) throw new Error("Order id required");
        let lastError = null;
        for (const id of ids) {
          try {
            return isQuickOrder
              ? await customerApi.getOrderDetails(id, options)
              : await orderAPI.getOrderDetails(id, options);
          } catch (err) {
            lastError = err;
            if (err?.response?.status === 400 || err?.response?.status === 404) continue;
            throw err;
          }
        }
        throw lastError || new Error("Failed to fetch order details");
      },
    };
  }, [isQuickOrder]);

  const resolveOrderFromList = useCallback((id) => stableOpsRef.current.resolveOrderFromList(id), []);
  const fetchOrderDetailsWithFallback = useCallback((opts) => stableOpsRef.current.fetchOrderDetailsWithFallback(opts), []);

  // ── Memoized derived values ──────────────────────────────────────────────────
  const fallbackCustomerCoords = useMemo(() => {
    const orderCoords = order?.address?.coordinates || order?.address?.location?.coordinates;
    if (Array.isArray(orderCoords) && orderCoords.length >= 2) {
      const [lng, lat] = [Number(orderCoords[0]), Number(orderCoords[1])];
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    }
    const defaultCoords = defaultAddress?.location?.coordinates;
    if (Array.isArray(defaultCoords) && defaultCoords.length >= 2) {
      const [lng, lat] = [Number(defaultCoords[0]), Number(defaultCoords[1])];
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    }
    const liveLat = Number(userLiveLocation?.latitude), liveLng = Number(userLiveLocation?.longitude);
    if (Number.isFinite(liveLat) && Number.isFinite(liveLng)) return { lat: liveLat, lng: liveLng };
    return null;
  }, [order?.address?.coordinates, order?.address?.location?.coordinates, defaultAddress?.location?.coordinates, userLiveLocation?.latitude, userLiveLocation?.longitude]);

  const userLiveCoords = useMemo(() => {
    const lat = Number(userLiveLocation?.latitude), lng = Number(userLiveLocation?.longitude);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  }, [userLiveLocation?.latitude, userLiveLocation?.longitude]);

  const isAdminAccepted = useMemo(() => (
    ["confirmed", "preparing", "ready", "ready_for_pickup", "picked_up"].includes(order?.status)
  ), [order?.status]);

  const showRefundDestinationChoice = useMemo(() => {
    if (!order) return false;
    const method = String(order?.payment?.method || order?.paymentMethod || "").trim().toLowerCase();
    if (method === "wallet") return false;
    if (isQuickOrder) return isQuickOrderOnlinePayment(order, confirmed);
    return isRefundablePrepaidOrder(order) && ["razorpay", "razorpay_qr", "online"].includes(method);
  }, [isQuickOrder, order, confirmed]);

  const canUseWalletRefund = useMemo(() => Boolean(
    isAuthenticated ||
    authUser?._id ||
    authUser?.id ||
    authUser?.userId ||
    order?.userId,
  ), [isAuthenticated, authUser, order?.userId]);

  const acceptedAtMs = useMemo(() => {
    const ts = order?.tracking?.confirmed?.timestamp || order?.tracking?.preparing?.timestamp || order?.updatedAt || order?.createdAt;
    const parsed = ts ? new Date(ts).getTime() : NaN;
    return Number.isFinite(parsed) ? parsed : null;
  }, [order?.tracking?.confirmed?.timestamp, order?.tracking?.preparing?.timestamp, order?.updatedAt, order?.createdAt]);

  const editWindowRemainingMs = useMemo(() => {
    if (!isAdminAccepted || !acceptedAtMs) return 0;
    return Math.max(0, 60000 - (timerNow - acceptedAtMs));
  }, [isAdminAccepted, acceptedAtMs, timerNow]);

  const isEditWindowOpen = editWindowRemainingMs > 0;

  const editWindowText = useMemo(() => {
    const total = Math.ceil(editWindowRemainingMs / 1000);
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
  }, [editWindowRemainingMs]);

  const pickupSources = useMemo(() => (
    Array.isArray(order?.pickupSources) ? order.pickupSources.filter((s) => s?.name || s?.address) : []
  ), [order?.pickupSources]);

  const customerDeliveryOtp = useMemo(() => {
    const rawDropOtp = order?.deliveryVerification?.dropOtp;
    const primitiveDropOtp = typeof rawDropOtp === "string" || typeof rawDropOtp === "number" ? rawDropOtp : null;
    const code = order?.deliveryVerification?.dropOtp?.code ?? order?.handoverOtp ?? order?.deliveryOtp ?? primitiveDropOtp ?? socketDropOtpCode;
    return code ? String(code) : null;
  }, [order?.deliveryVerification?.dropOtp?.code, order?.deliveryVerification?.dropOtp, order?.handoverOtp, order?.deliveryOtp, socketDropOtpCode]);

  const isFoodQuick = isFoodQuickOrder(order);
  const quickPromiseLabel = formatQuickEtaWindow(order?.etaPromise);

  // Build status config dynamically only when relevant values change
  const currentStatus = useMemo(() => {
    const template = STATUS_CONFIG_TEMPLATE[orderStatus] || STATUS_CONFIG_TEMPLATE.placed;
    const arriveBy =
      isFoodQuick && quickPromiseLabel
        ? `Quick promise ${quickPromiseLabel}`
        : typeof estimatedTime === "number"
          ? `Arriving in ${estimatedTime} mins`
          : null;
    switch (orderStatus) {
      case 'scheduled': return { ...template, subtitle: isQuickOrder ? "Your order is scheduled. Please wait for the store to respond." : "Your order is scheduled. Please wait for the restaurant to respond." };
      case 'placed': return { ...template, subtitle: isQuickOrder ? "Waiting for store to accept" : (isFoodQuick ? "Quick order waiting for restaurant" : "Waiting for restaurant to accept") };
      case 'confirmed': return { ...template, subtitle: isQuickOrder ? "Store has accepted your order" : (isFoodQuick ? "Quick order accepted — kitchen prioritized" : "Restaurant has accepted your order") };
      case 'preparing': return { ...template, title: isQuickOrder ? "Items are being packed" : (isFoodQuick ? "Quick prep in progress" : "Food is being prepared"), subtitle: arriveBy || (isQuickOrder ? "Packing your items" : "Cooking your meal") };
      case 'assigned': return { ...template, subtitle: isQuickOrder ? "A delivery partner is arriving at the store" : (isFoodQuick ? "Priority rider heading to restaurant" : "A delivery partner is arriving at the restaurant") };
      case 'at_pickup': return { ...template, title: isQuickOrder ? "Rider at store" : "Rider at restaurant", subtitle: "Rider is waiting for your order" };
      case 'ready': return { ...template, subtitle: "Rider is picking up your order" };
      case 'on_way': return { ...template, subtitle: arriveBy || "Rider is out for delivery" };
      case 'delivered': return { ...template, subtitle: isQuickOrder ? "Enjoy your purchase!" : (order?.sla?.breached && Number(order?.sla?.compensationAmount) > 0 ? `Delivered · SLA credit ₹${Math.round(Number(order.sla.compensationAmount))}` : "Enjoy your meal!") };
      default: return template;
    }
  }, [orderStatus, isQuickOrder, isFoodQuick, quickPromiseLabel, estimatedTime, order?.sla]);

  const isDeliveredOrder = useMemo(() => (
    orderStatus === "delivered" || order?.status === "delivered" || Boolean(order?.deliveredAt)
  ), [orderStatus, order?.status, order?.deliveredAt]);

  const liveReturnEligibility = useMemo(
    () => resolveLiveReturnEligibility(order?.returnEligibility, timerNow),
    [order?.returnEligibility, timerNow],
  );

  const canRequestReturn = Boolean(liveReturnEligibility?.canReturn);

  const visibleDeliveryPartners = useMemo(() => (
    Array.isArray(order?.deliveryPartners) ? order.deliveryPartners.filter(Boolean) : []
  ), [order?.deliveryPartners]);

  const hasMultipleDeliveryPartners = visibleDeliveryPartners.length > 1;

  const hasActiveDeliveryTracking = useMemo(() => (
    visibleDeliveryPartners.length > 0 ||
    Boolean(order?.deliveryPartnerId) ||
    Boolean(order?.deliveryState?.currentLocation) ||
    ['assigned', 'at_pickup', 'ready', 'on_way', 'at_drop', 'delivered'].includes(orderStatus)
  ), [visibleDeliveryPartners.length, order?.deliveryPartnerId, order?.deliveryState?.currentLocation, orderStatus]);

  const previewPickupSource = pickupSources[0] || null;
  const previewPickupLabel = useMemo(() => (
    previewPickupSource?.pickupType === 'quick' ? 'Store' : order?.orderType === 'mixed' ? 'Pickup point' : 'Restaurant'
  ), [previewPickupSource?.pickupType, order?.orderType]);

  const previewPickupAddress = previewPickupSource?.address || order?.restaurantAddress || 'Preparing pickup location';
  const previewDropAddress = useMemo(() => (
    order?.address?.formattedAddress ||
    [order?.address?.street, order?.address?.additionalDetails, order?.address?.city, order?.address?.state, order?.address?.zipCode].filter(Boolean).join(', ') ||
    'Preparing delivery address'
  ), [order?.address]);

  const deliveryAddressSubtitle = useMemo(() => {
    if (order?.address?.formattedAddress && order.address.formattedAddress !== "Select location")
      return order.address.formattedAddress;
    if (order?.address) {
      const parts = [order.address.street, order.address.additionalDetails, order.address.city, order.address.state, order.address.zipCode].filter(Boolean);
      if (parts.length > 0) return parts.join(', ');
    }
    if (defaultAddress?.formattedAddress && defaultAddress.formattedAddress !== "Select location")
      return defaultAddress.formattedAddress;
    if (defaultAddress) {
      const parts = [defaultAddress.street, defaultAddress.additionalDetails, defaultAddress.city, defaultAddress.state, defaultAddress.zipCode].filter(Boolean);
      if (parts.length > 0) return parts.join(', ');
    }
    return 'Add delivery address';
  }, [order?.address, defaultAddress]);

  const customerPinNode = useMemo(() => (
    <div dangerouslySetInnerHTML={{ __html: SAFE_CUSTOMER_PIN }} className="w-6 h-6 [&_svg]:w-full [&_svg]:h-full [&_svg]:block" />
  ), []);

  // ── Effects ──────────────────────────────────────────────────────────────────

  // Sync prefetched order
  useEffect(() => {
    if (!prefetchedOrder) return;
    const normalized = isQuickOrder ? normalizeQuickOrderForTracking(prefetchedOrder) : prefetchedOrder;
    setOrder((prev) => transformOrderForTracking(normalized, prev));
    setOrderStatus(mapOrderToTrackingUiStatus(normalized));
    setError(null);
    setLoading(false);
  }, [isQuickOrder, prefetchedOrder]);

  // Sync orderStatus from order state
  useEffect(() => {
    if (!order) return;
    setOrderStatus(mapOrderToTrackingUiStatus(order));
  }, [order?.status, order?.deliveryState?.currentPhase, order?.deliveryState?.status]);

  // Stop polling when terminal
  useEffect(() => {
    if (!order) return;
    const ui = mapOrderToTrackingUiStatus(order);
    terminalPollStopRef.current = ui === 'delivered' || ui === 'cancelled';
  }, [order]);

  // Clear OTP on terminal status
  useEffect(() => {
    if (!order) return;
    const status = mapOrderToTrackingUiStatus(order);
    if (status !== 'delivered' && status !== 'cancelled') return;
    setSocketDropOtpCode(null);
    setOrder((prev) => {
      if (!prev?.deliveryVerification?.dropOtp?.code) return prev;
      return { ...prev, deliveryVerification: { ...prev.deliveryVerification, dropOtp: { ...prev.deliveryVerification.dropOtp, code: null } } };
    });
  }, [orderStatus]);

  // Socket OTP event
  useEffect(() => {
    const handle = (event) => {
      const detail = event?.detail || {};
      const otp = detail?.otp != null ? String(detail.otp) : null;
      if (!otp) return;
      const evtOrderId = detail?.orderId != null ? String(detail.orderId) : null;
      const evtOrderMongoId = detail?.orderMongoId != null ? String(detail.orderMongoId) : null;
      const currentIds = [String(orderId), order?.orderId, order?.mongoId, order?._id].filter(Boolean).map(String);
      const matches = (evtOrderId && currentIds.includes(evtOrderId)) || (evtOrderMongoId && currentIds.includes(evtOrderMongoId));
      if (!matches) return;
      setSocketDropOtpCode(otp);
      setOrder((prev) => {
        if (!prev) return prev;
        const prevDV = prev.deliveryVerification || {};
        const prevDropOtp = prevDV.dropOtp || {};
        if (prevDropOtp.code === otp) return prev;
        return { ...prev, deliveryVerification: { ...prevDV, dropOtp: { ...prevDropOtp, required: true, verified: false, code: otp } } };
      });
    };
    window.addEventListener('deliveryDropOtp', handle);
    return () => window.removeEventListener('deliveryDropOtp', handle);
  }, [orderId, order?.orderId, order?.mongoId, order?._id]);

  // Order status socket event
  useEffect(() => {
    const handle = (event) => {
      const payload = event?.detail || {};
      const { message, status, estimatedDeliveryTime, orderId: evtOrderId, orderMongoId, orderStatus: evtOrderStatus } = payload;
      const evtKeys = [evtOrderId, orderMongoId, payload?._id].filter(Boolean).map(String);
      const idMatches = evtKeys.length === 0 || evtKeys.some((k) => String(k) === String(orderId)) || evtKeys.some((k) => trackingOrderIdsRef.current.has(k));
      const resolvedStatus = evtOrderStatus || status;
      const next = mapOrderToTrackingUiStatus({ status: resolvedStatus, orderStatus: resolvedStatus, deliveryState: payload.deliveryState });
      if (idMatches) {
        setOrderStatus(next);
        const now = Date.now();
        if (now - lastRealtimeRefreshRef.current > 1500 && !isRefreshing) {
          lastRealtimeRefreshRef.current = now;
          handleRefresh();
        }
      }
      if (message) {
        const isCancelled = String(resolvedStatus || '').toLowerCase().includes('cancel');
        if (isCancelled && idMatches) {
          setCancellationNotice({
            title: isQuickOrder ? 'Order Cancelled' : 'Order Update',
            message,
          });
        } else {
          toast.success(message, { id: `order-status-${orderId}`, duration: 4000, description: estimatedDeliveryTime ? `Estimated delivery in ${Math.round(estimatedDeliveryTime / 60)} minutes` : undefined });
        }
        if (navigator.vibrate) navigator.vibrate([100]);
      }
    };
    window.addEventListener('orderStatusNotification', handle);
    return () => window.removeEventListener('orderStatusNotification', handle);
  }, [orderId, isQuickOrder]);

  // Edit window countdown
  useEffect(() => {
    if (!isEditWindowOpen) return;
    const interval = setInterval(() => setTimerNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [isEditWindowOpen]);

  // Return window countdown for delivered Quick Commerce orders
  useEffect(() => {
    if (!isQuickCommerceOrder || !isDeliveredOrder) return undefined;
    const interval = setInterval(() => setTimerNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [isQuickCommerceOrder, isDeliveredOrder]);

  // Estimated time countdown
  useEffect(() => {
    const timer = setInterval(() => setEstimatedTime((prev) => Math.max(0, prev - 1)), 60000);
    return () => clearInterval(timer);
  }, []);

  // Confirmation splash
  useEffect(() => {
    if (!confirmed) return;
    confirmationShownAtRef.current = Date.now();
    setShowConfirmation(true);
  }, [confirmed, orderId]);

  useEffect(() => {
    if (!showConfirmation) return;
    const elapsed = Date.now() - confirmationShownAtRef.current;
    const minMs = 250, maxMs = 700;
    const hasData = Boolean(order) || Boolean(error) || !loading;
    const remaining = hasData ? Math.max(0, minMs - elapsed) : Math.max(0, maxMs - elapsed);
    const t = setTimeout(() => setShowConfirmation(false), remaining);
    return () => clearTimeout(t);
  }, [showConfirmation, order, error, loading]);

  // Auto rating popup
  useEffect(() => {
    if (orderStatus !== 'delivered' || !order || ratingModal.open) return;
    const orderIdToRate = order.orderId || order.mongoId || order._id || orderId;
    if (!orderIdToRate) return;
    const idStr = String(orderIdToRate);
    if (shownRatingForOrdersRef.current.has(idStr)) return;
    const sellerRating = order.ratings?.seller || order.ratings?.restaurant;
    const hasRestaurantRating = Number.isFinite(Number(sellerRating?.rating));
    const hasDeliveryPartner = !!order.deliveryPartnerId;
    const hasDeliveryRating = Number.isFinite(Number(order.ratings?.deliveryPartner?.rating));
    const hasRating = hasRestaurantRating && (!hasDeliveryPartner || hasDeliveryRating);
    if (hasRating) return;
    shownRatingForOrdersRef.current = new Set(shownRatingForOrdersRef.current);
    shownRatingForOrdersRef.current.add(idStr);
    saveShownRatings(shownRatingForOrdersRef.current);
    const t = setTimeout(() => {
      setRatingModal({ open: true, order });
      setSelectedRestaurantRating(null);
      setSelectedDeliveryRating(null);
      setRestaurantFeedbackText("");
      setDeliveryFeedbackText("");
    }, 1500);
    return () => clearTimeout(t);
  }, [orderStatus, order, ratingModal.open, orderId]);

  // ── Main polling effect ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!orderId) return;
    const pollGeneration = ++initialPollGenerationRef.current;
    let isSubscribed = true;
    let requestInProgress = false;

    setLoading(true);
    setInitialLoadDone(Boolean(prefetchedOrder));
    setError(null);

    const poll = async (isInitial = false) => {
      if (!isSubscribed || requestInProgress) return;
      if (terminalPollStopRef.current && !isInitial) return;

      // Ensure lookup ids exist before any API call (avoids race with ref-sync effect).
      const syncIds = [resolvedLookupId, orderId]
        .map(normalizeLookupId)
        .filter(Boolean);
      if (syncIds.length) {
        lookupIdsRef.current = Array.from(new Set([...lookupIdsRef.current, ...syncIds]));
      }

      if (isInitial) {
        const rawContext = isQuickOrder ? null : getOrderById(orderId);
        if (rawContext) {
          setOrder(transformOrderForTracking(rawContext));
          setError(null);
          setInitialLoadDone(true);
          setLoading(false);
        }
      }

      requestInProgress = true;
      try {
        let finalOrderData = null;
        let response = null;

        const loadDetail = async (force = false) => {
          const res = await fetchOrderDetailsWithFallback({ force });
          return { res, payload: extractOrderDetailsPayload(res) };
        };

        if (isInitial && !isQuickOrder) {
          let detail = await loadDetail(true);
          response = detail.res;
          finalOrderData = detail.payload;
          if (!finalOrderData) {
            detail = await loadDetail(true);
            response = detail.res;
            finalOrderData = detail.payload;
          }
          if (!finalOrderData) {
            finalOrderData = await resolveOrderFromList(orderId);
          }
        } else {
          const detail = await loadDetail(isInitial);
          response = detail.res;
          finalOrderData = detail.payload;
        }

        if (!isSubscribed || pollGeneration !== initialPollGenerationRef.current) return;

        if (!finalOrderData && isInitial) {
          finalOrderData = await resolveOrderFromList(orderId);
        }

        if (finalOrderData) {
          setOrder((prev) => {
            const transformed = transformOrderForTracking(
              isQuickOrder ? normalizeQuickOrderForTracking(finalOrderData) : finalOrderData, prev
            );
            const ui = mapOrderToTrackingUiStatus(transformed);
            terminalPollStopRef.current = ui === 'delivered' || ui === 'cancelled';
            return transformed;
          });
          setError(null);
          setInitialLoadDone(true);
          setLoading(false);
          return;
        }

        if (isInitial && !orderRef.current) {
          setError(response?.data?.message || 'Order not found');
        }
      } catch (err) {
        if (!isSubscribed || pollGeneration !== initialPollGenerationRef.current) return;
        if (isInitial && !orderRef.current) {
          try {
            const matched = await resolveOrderFromList(orderId);
            if (matched && isSubscribed && pollGeneration === initialPollGenerationRef.current) {
              setOrder((prev) => transformOrderForTracking(matched, prev));
              setError(null);
              setInitialLoadDone(true);
              setLoading(false);
              return;
            }
          } catch { /* fall through */ }
          setError(err.response?.data?.message || 'Failed to fetch order details');
        }
      } finally {
        requestInProgress = false;
        if (
          isInitial &&
          isSubscribed &&
          pollGeneration === initialPollGenerationRef.current
        ) {
          setInitialLoadDone(true);
          if (!orderRef.current) {
            setLoading(false);
          }
        }
      }
    };

    pollRef.current = poll;
    terminalPollStopRef.current = false;
    poll(true);
    return () => { isSubscribed = false; };
  }, [getOrderById, isQuickOrder, orderId, fetchOrderDetailsWithFallback, resolveOrderFromList, resolvedLookupId, prefetchedOrder]);

  // Poll interval (separate so socket reconnect doesn't restart fetching logic)
  useEffect(() => {
    if (!orderId) return;
    const pollInterval = (isSocketConnected || window.orderSocketConnected) ? 12000 : 5000;
    const interval = setInterval(() => {
      if (terminalPollStopRef.current || document.hidden) return;
      pollRef.current?.(false);
    }, pollInterval);
    return () => clearInterval(interval);
  }, [orderId, isSocketConnected]);

  // ── Stable callbacks ─────────────────────────────────────────────────────────
  const handleEtaUpdate = useCallback((newEta) => setEstimatedTime(newEta), []);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const response = await stableOpsRef.current.fetchOrderDetailsWithFallback({ force: true });
      const apiOrder = extractOrderDetailsPayload(response);
      if (!apiOrder) return;
      const normalizedOrder = isQuickOrder ? normalizeQuickOrderForTracking(apiOrder) : apiOrder;
      let restaurantCoords = null, restaurantAddress = null;
      if (normalizedOrder.restaurantId?.location?.coordinates?.length >= 2)
        restaurantCoords = normalizedOrder.restaurantId.location.coordinates;
      else if (normalizedOrder.restaurantId?.location?.latitude && normalizedOrder.restaurantId?.location?.longitude)
        restaurantCoords = [normalizedOrder.restaurantId.location.longitude, normalizedOrder.restaurantId.location.latitude];
      else if (normalizedOrder.restaurant?.location?.coordinates)
        restaurantCoords = normalizedOrder.restaurant.location.coordinates;
      else if (!isQuickOrder && typeof normalizedOrder.restaurantId === 'string') {
        try {
          const r = await restaurantAPI.getRestaurantById(normalizedOrder.restaurantId);
          if (r?.data?.success && r.data.data?.restaurant?.location?.coordinates?.length >= 2) {
            restaurantCoords = r.data.data.restaurant.location.coordinates;
            restaurantAddress = r.data.data.restaurant?.location?.formattedAddress || r.data.data.restaurant?.location?.address || null;
          }
        } catch (err) { debugError('Error fetching restaurant details:', err); }
      }
      setOrder((prev) => transformOrderForTracking(normalizedOrder, prev, restaurantCoords, restaurantAddress));
      setOrderStatus(mapOrderToTrackingUiStatus(normalizedOrder));
    } catch (err) {
      debugError('Error refreshing order:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, [isQuickOrder]);

  // Phone call helpers — stable, no order dependency needed for the factory
  const makeCall = useCallback((phone) => {
    const clean = String(phone || '').replace(/[^\d+]/g, '');
    if (!clean || clean.length < 5) { toast.error('Phone number not available'); return; }
    try {
      const link = document.createElement('a');
      link.href = `tel:${clean}`;
      link.setAttribute('target', '_self');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch { window.location.assign(`tel:${clean}`); }
  }, []);

  const handleCallRestaurant = useCallback((e) => {
    e?.stopPropagation?.();
    const raw = order?.restaurantPhone || order?.restaurantId?.phone || order?.restaurantId?.ownerPhone || order?.restaurantId?.contact?.phone || order?.restaurant?.phone || '';
    if (!raw || String(raw).replace(/[^\d+]/g, '').length < 5) {
      toast.error(`${isQuickOrder ? 'Store' : 'Restaurant'} phone number not available`);
      return;
    }
    makeCall(raw);
  }, [order?.restaurantPhone, order?.restaurantId, order?.restaurant, isQuickOrder, makeCall]);

  const handleCallPickupSource = useCallback((phone, e) => {
    e?.stopPropagation?.();
    makeCall(phone);
  }, [makeCall]);

  const handleCallRider = useCallback((phone, e) => {
    e?.stopPropagation?.();
    makeCall(phone || order?.deliveryPartner?.phone || '');
  }, [order?.deliveryPartner?.phone, makeCall]);

  const handleCancelOrder = useCallback(() => {
    if (!order) return;
    if (isAdminAccepted && !isEditWindowOpen) { toast.error('Cancellation window ended.'); return; }
    if (order.status === 'cancelled') { toast.error('Order is already cancelled'); return; }
    if (order.status === 'delivered') { toast.error('Cannot cancel a delivered order'); return; }
    const preferredRefund = order?.payment?.refund?.requestedMethod === "wallet" ? "wallet" : "gateway";
    setRefundDestination(canUseWalletRefund ? preferredRefund : "gateway");
    setShowCancelDialog(true);
  }, [order, isAdminAccepted, isEditWindowOpen, canUseWalletRefund]);

  const handleConfirmCancel = useCallback(async () => {
    if (!cancellationReason.trim()) { toast.error('Please provide a reason for cancellation'); return; }
    if (showRefundDestinationChoice && refundDestination === "wallet" && !canUseWalletRefund) {
      toast.error('Please log in to receive refund in your wallet');
      return;
    }
    setIsCancelling(true);
    try {
      const cancelId = lookupIdsRef.current[0] || normalizeLookupId(orderId);
      const cancelPayload = {
        reason: cancellationReason.trim(),
        ...(showRefundDestinationChoice ? { refundTo: refundDestination } : {}),
      };
      const response = isQuickOrder
        ? await customerApi.cancelOrder(cancelId, cancelPayload)
        : await orderAPI.cancelOrder(cancelId, cancelPayload);
      if (response.data?.success) {
        const paymentMethod = order?.payment?.method || order?.paymentMethod;
        const successMessage = response.data?.message || (paymentMethod === 'cash' || paymentMethod === 'cod'
          ? 'Order cancelled successfully. No refund required as payment was not made.'
          : `Order cancelled successfully. Refund will be sent to ${refundDestination === "wallet" ? "your wallet" : "your original payment method"}.`);
        setCancellationNotice({
          title: 'Order Cancelled',
          message: successMessage,
        });
        setShowCancelDialog(false);
        setCancellationReason("");
        setRefundDestination("gateway");
        setOrderStatus('cancelled');
        const orderResponse = await stableOpsRef.current.fetchOrderDetailsWithFallback({ force: true });
        const refreshedOrder = extractOrderDetailsPayload(orderResponse);
        if (refreshedOrder) {
          setOrder((prev) => transformOrderForTracking(
            isQuickOrder ? normalizeQuickOrderForTracking(refreshedOrder) : refreshedOrder,
            prev,
          ));
        }
      } else {
        toast.error(response.data?.message || 'Failed to cancel order');
      }
    } catch (error) {
      debugError('Error cancelling order:', error);
      toast.error(error.response?.data?.message || 'Failed to cancel order');
    } finally {
      setIsCancelling(false);
    }
  }, [cancellationReason, orderId, isQuickOrder, showRefundDestinationChoice, canUseWalletRefund, refundDestination, order?.payment?.method, order?.paymentMethod]);

  const handleUpdateInstructions = useCallback(async () => {
    if (isQuickOrder || typeof orderAPI.updateOrderInstructions !== "function") {
      toast.error("Delivery instructions update is not available for this order yet");
      return;
    }
    setIsUpdatingInstructions(true);
    try {
      const response = await orderAPI.updateOrderInstructions(resolvedLookupId || orderId, deliveryInstructions);
      if (response.data?.success) {
        toast.success("Delivery instructions updated");
        setIsInstructionsModalOpen(false);
        const updated = response.data.data?.order;
        if (updated) setOrder((prev) => transformOrderForTracking(updated, prev));
        else setOrder((prev) => ({ ...prev, note: deliveryInstructions }));
      } else {
        toast.error(response.data?.message || "Failed to update instructions");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update instructions");
    } finally {
      setIsUpdatingInstructions(false);
    }
  }, [isQuickOrder, resolvedLookupId, orderId, deliveryInstructions]);

  const handleShare = useCallback(async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: `Track my order from ${order?.restaurant || companyName}`, text: `Hey! Track my order from ${order?.restaurant || companyName} with ID #${order?.orderId || order?.id}.`, url: window.location.href });
      } else {
        await navigator.clipboard.writeText(window.location.href);
        toast.success("Tracking link copied to clipboard!");
      }
    } catch (error) {
      if (error.name !== 'AbortError') toast.error("Failed to share link");
    }
  }, [order?.restaurant, order?.orderId, order?.id, companyName]);

  const handleCloseRating = useCallback(() => {
    setRatingModal({ open: false, order: null });
    setSelectedRestaurantRating(null);
    setSelectedDeliveryRating(null);
    setRestaurantFeedbackText("");
    setDeliveryFeedbackText("");
  }, []);

  const handleSubmitRating = useCallback(async () => {
    const hasDeliveryPartner = !!order?.deliveryPartnerId;
    if (!order || selectedRestaurantRating === null || (hasDeliveryPartner && selectedDeliveryRating === null)) {
      toast.error("Please select all required ratings first"); return;
    }
    setSubmittingRating(true);
    try {
      const targetId = order.mongoId || order._id || orderId;
      const response = isQuickOrder 
        ? await customerApi.submitOrderRatings(targetId, {
            sellerRating: selectedRestaurantRating,
            deliveryPartnerRating: hasDeliveryPartner ? selectedDeliveryRating : undefined,
            sellerComment: restaurantFeedbackText || undefined,
            deliveryPartnerComment: hasDeliveryPartner ? (deliveryFeedbackText || undefined) : undefined,
          })
        : await orderAPI.submitOrderRatings(targetId, {
            restaurantRating: selectedRestaurantRating,
            deliveryPartnerRating: hasDeliveryPartner ? selectedDeliveryRating : undefined,
            restaurantComment: restaurantFeedbackText || undefined,
            deliveryPartnerComment: hasDeliveryPartner ? (deliveryFeedbackText || undefined) : undefined,
          });
      const updatedOrderData = response?.data?.data?.order || response?.data?.order || null;
      if (updatedOrderData) setOrder((prev) => transformOrderForTracking(updatedOrderData, prev));
      else setOrder((prev) => ({
        ...prev,
        ratings: {
          ...prev.ratings,
          restaurant: { rating: selectedRestaurantRating, comment: restaurantFeedbackText },
          seller: { rating: selectedRestaurantRating, comment: restaurantFeedbackText },
          deliveryPartner: hasDeliveryPartner ? { rating: selectedDeliveryRating, comment: deliveryFeedbackText } : undefined,
        },
      }));
      toast.success("Thanks for rating your order!");
      handleCloseRating();
    } catch (error) {
      debugError("Error submitting ratings:", error);
      toast.error(error?.response?.data?.message || "Failed to submit ratings.");
    } finally {
      setSubmittingRating(false);
    }
  }, [order, orderId, selectedRestaurantRating, selectedDeliveryRating, restaurantFeedbackText, deliveryFeedbackText, handleCloseRating]);

  const handleDownloadInvoice = useCallback(async () => {
    if (!order) { toast.error("Order details are not ready yet"); return; }
    try {
      await generateOrderInvoice(order);
      toast.success("Invoice downloaded");
    } catch (error) {
      debugError("Error generating invoice PDF:", error);
      toast.error("Failed to download invoice");
    }
  }, [order, orderStatus, profile?.name, profile?.phone, companyName]);

  // ── Instruction modal opener ─────────────────────────────────────────────────
  const openInstructionsModal = useCallback(() => {
    setDeliveryInstructions(order?.note || "");
    setIsInstructionsModalOpen(true);
  }, [order?.note]);

  // ── Early returns (after all hooks) ─────────────────────────────────────────
  const showLoadingShell = loading || (!order && !initialLoadDone);
  if (showLoadingShell) {
    return (
      <AnimatedPage className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-lg mx-auto text-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-gray-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading order details...</p>
        </div>
      </AnimatedPage>
    );
  }

  if (!order) {
    return (
      <AnimatedPage className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-lg mx-auto text-center py-20">
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold mb-4">Order Not Found</h1>
          <p className="text-gray-600 mb-6">{error || "The order you're looking for doesn't exist."}</p>
          <Link to={backPath}><Button>Back to Orders</Button></Link>
        </div>
      </AnimatedPage>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-[#0a0a0a]">
      {/* Confirmation Modal */}
      <AnimatePresence>
        {showConfirmation && (
          <motion.div {...MOTION_FADE} className="fixed inset-0 z-50 bg-white dark:bg-[#1a1a1a] flex flex-col items-center justify-center">
            <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.2, type: "spring" }} className="text-center px-8">
              <AnimatedCheckmark delay={0.3} />
              <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 }} className="text-2xl font-bold text-gray-900 mt-6">Order Confirmed!</motion.h1>
              <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.1 }} className="text-gray-600 mt-2">Your order has been placed successfully</motion.p>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5 }} className="mt-8">
                <div className="w-8 h-8 border-2 border-[#FF0000] border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-sm text-gray-500 mt-3">Loading order details...</p>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Green / Red Header */}
      <motion.div className={`${currentStatus.color} text-white sticky top-0 z-40`} {...MOTION_FADE}>
        <div className="flex items-center justify-between px-4 py-3">
          <Link to={backPath}>
            <motion.button className="w-10 h-10 flex items-center justify-center" whileTap={{ scale: 0.9 }}>
              <ArrowLeft className="w-6 h-6" />
            </motion.button>
          </Link>
          <h2 className="font-semibold text-lg">{order.restaurant}</h2>
          <motion.button className="w-10 h-10 flex items-center justify-center cursor-pointer" whileTap={{ scale: 0.9 }} onClick={handleShare}>
            <Share2 className="w-5 h-5" />
          </motion.button>
        </div>

        {!['at_pickup', 'ready', 'on_way', 'at_drop', 'delivered'].includes(orderStatus) && (
          <div className="px-4 pb-4 text-center">
            {isFoodQuick && (
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                Quick Delivery
                {quickPromiseLabel ? <span className="font-semibold normal-case tracking-normal">· {quickPromiseLabel}</span> : null}
              </div>
            )}
            {order?.sla?.breached && Number(order?.sla?.compensationAmount) > 0 && (
              <div className="mb-2 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                SLA compensation ₹{Math.round(Number(order.sla.compensationAmount))} credited to your wallet
              </div>
            )}
            <motion.h1 className="text-2xl font-bold mb-3" key={currentStatus.title} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
              {currentStatus.title}
            </motion.h1>
            <motion.div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-full px-4 py-2" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.2 }}>
              <span className="text-sm">{currentStatus.subtitle}</span>
              {orderStatus === 'preparing' && (<><span className="w-1 h-1 rounded-full bg-white" /><span className="text-sm text-red-200">On time</span></>)}
              <motion.button onClick={handleRefresh} className="ml-1" animate={{ rotate: isRefreshing ? 360 : 0 }} transition={{ duration: 0.5 }}>
                <RefreshCw className="w-4 h-4" />
              </motion.button>
            </motion.div>
          </div>
        )}
      </motion.div>

      {/* Map */}
      {!isDeliveredOrder && orderStatus !== 'cancelled' && (
        <>
          <DeliveryMap
            orderId={orderId} order={order} isVisible={order !== null}
            fallbackCustomerCoords={fallbackCustomerCoords}
            userLiveCoords={userLiveCoords}
            userLocationAccuracy={userLiveLocation?.accuracy ?? null}
            onEtaUpdate={handleEtaUpdate}
          />
          {!hasActiveDeliveryTracking && (
            <motion.div className="mx-4 mt-4 rounded-3xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-lime-50 p-5 shadow-sm" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-600">Live tracking</p>
                  <h3 className="mt-2 text-lg font-bold text-gray-900">{orderStatus === 'scheduled' ? 'Order Scheduled' : 'Waiting for delivery partner assignment'}</h3>
                  <p className="mt-1 text-sm text-gray-600">
                    {orderStatus === 'scheduled'
                      ? `The ${isQuickOrder ? 'store' : 'restaurant'} will receive your order 15 minutes before the scheduled time.`
                      : 'The route map is ready. Live rider movement will appear here as soon as a rider accepts the trip.'}
                  </p>
                </div>
                <div className="rounded-2xl bg-emerald-100 px-3 py-2 text-xs font-semibold text-emerald-700">{currentStatus.title}</div>
              </div>
              <div className="mt-5 rounded-2xl border border-white/70 bg-white/90 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex flex-col items-center pt-1">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-[#FF0000]"><MapPin className="h-5 w-5" /></div>
                    <div className="my-2 h-10 w-px border-l-2 border-dashed border-emerald-200" />
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><HomeIcon className="h-5 w-5" /></div>
                  </div>
                  <div className="min-w-0 flex-1 space-y-5">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400">{previewPickupLabel}</p>
                      <p className="mt-1 font-semibold text-gray-900">{previewPickupSource?.name || order?.restaurant || 'Pickup location'}</p>
                      <p className="mt-1 text-sm text-gray-500">{previewPickupAddress}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400">Delivery address</p>
                      <p className="mt-1 font-semibold text-gray-900">Customer location</p>
                      <p className="mt-1 text-sm text-gray-500">{previewDropAddress}</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </>
      )}

      {/* Scrollable content */}
      <div className="max-w-4xl mx-auto px-4 md:px-6 lg:px-8 py-4 md:py-6 space-y-4 md:space-y-6 pb-24 md:pb-32">

        {customerDeliveryOtp && orderStatus !== 'delivered' && orderStatus !== 'cancelled' && (
          <motion.div className="bg-blue-50 rounded-xl p-4 shadow-sm border border-blue-100" {...MOTION_SLIDE_UP(0.28)}>
            <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Delivery OTP</p>
            <p className="text-2xl font-bold text-blue-900 mt-1 tracking-widest">{customerDeliveryOtp}</p>
            <p className="text-xs text-blue-700 mt-1">Share this 4-digit OTP with your delivery partner at drop-off.</p>
          </motion.div>
        )}

        {isQuickOrder && !customerDeliveryOtp && orderStatus !== 'delivered' && orderStatus !== 'cancelled' && (
          <motion.div {...MOTION_SLIDE_UP(0.28)}>
            <DeliveryOtpDisplay orderId={order?.orderId || order?.mongoId || orderId} />
          </motion.div>
        )}

        {/* Status Card */}
        <motion.div className="bg-white rounded-xl p-4 shadow-sm" {...MOTION_SLIDE_UP(0.3)}>
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0 shadow-sm border border-gray-100 ${currentStatus.iconType === 'rider' ? 'bg-blue-50' :
              currentStatus.iconType === 'cancelled' ? 'bg-red-50' :
                currentStatus.iconType === 'delivered' ? 'bg-green-50' : 'bg-red-50'
              }`}>
              {currentStatus.iconType === 'rider' ? (
                <div dangerouslySetInnerHTML={{ __html: RIDER_BIKE_SVG.replace(/width="\d+"/, 'width="100%"').replace(/height="\d+"/, 'height="100%"') }} style={RIDER_SVG_STYLE} />
              ) : currentStatus.iconType === 'cancelled' ? (
                <div className="w-full h-full flex items-center justify-center p-2 text-red-500"><X className="w-full h-full" /></div>
              ) : currentStatus.iconType === 'delivered' ? (
                <div className="w-full h-full flex items-center justify-center p-2 text-green-500"><Check className="w-full h-full" /></div>
              ) : (
                <img src={circleIcon} alt={currentStatus.title} className="w-10 h-10 object-contain" />
              )}
            </div>
            <div className="flex-1">
              <p className="font-semibold text-gray-900 leading-tight">{currentStatus.title}</p>
              <p className="text-sm text-gray-500 mt-1 leading-snug">{currentStatus.subtitle}</p>
            </div>
          </div>
        </motion.div>

        {/* Delivery Partners */}
        {visibleDeliveryPartners.length > 0 && (
          <motion.div className="bg-white rounded-xl shadow-sm overflow-hidden" {...MOTION_SLIDE_UP(0.55)}>
            <div className="px-4 pt-4 pb-2 border-b border-dashed border-gray-200">
              <p className="font-semibold text-gray-900">{hasMultipleDeliveryPartners ? 'Express delivery partners' : 'Delivery partner'}</p>
              <p className="text-sm text-gray-500 mt-1">{hasMultipleDeliveryPartners ? 'Each pickup in your express order can have its own rider.' : 'Your delivery partner is handling this order.'}</p>
            </div>
            {visibleDeliveryPartners.map((partner, index) => (
              <div key={partner?.legId || partner?.id || index} className={`flex items-center gap-3 p-4 ${index !== visibleDeliveryPartners.length - 1 ? 'border-b border-dashed border-gray-200' : ''}`}>
                <div className="w-12 h-12 rounded-full bg-blue-50 overflow-hidden flex items-center justify-center flex-shrink-0 border border-blue-100 p-1">
                  <img src={getPartnerDisplayAvatar(partner?.avatar, partner?.name)} alt={partner?.name || 'Rider'} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = getPartnerDisplayAvatar("", partner?.name || "Rider"); }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900 truncate">{partner?.name || 'Delivery Partner'}</p>
                    {hasMultipleDeliveryPartners && <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">{partner?.label || 'Pickup rider'}</span>}
                  </div>
                  <p className="text-sm text-gray-500 truncate">{partner?.sourceName ? `${partner.label} for ${partner.sourceName}` : partner?.statusText || 'Your delivery partner is arriving'}</p>
                  {formatPartnerRating(partner?.rating) ? (
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-amber-600">
                      <span className="font-semibold">★ {formatPartnerRating(partner?.rating)}</span>
                      <span className="text-gray-400">{Number(partner?.totalRatings || 0) > 0 ? `(${Number(partner?.totalRatings)} ratings)` : '(New rider)'}</span>
                    </div>
                  ) : <div className="mt-1 text-xs text-gray-400">Rating not available yet</div>}
                </div>
                <motion.button className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center" onClick={(e) => handleCallRider(partner?.phone, e)} whileTap={{ scale: 0.9 }}>
                  <Phone className="w-5 h-5 text-blue-600" />
                </motion.button>
              </div>
            ))}
            {order?.note && !isDeliveredOrder && (
              <div className="bg-blue-50/50 p-3 mx-4 mb-4 rounded-lg flex items-start gap-2 border border-blue-100">
                <MessageSquare className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-0.5">Instruction for Rider</p>
                  <p className="text-xs text-gray-700 leading-relaxed font-medium">"{order.note}"</p>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {!isDeliveredOrder && (
          <motion.button className="w-full bg-white rounded-xl p-4 shadow-sm flex items-center gap-3" {...MOTION_SLIDE_UP(0.6)} whileTap={{ scale: 0.99 }}>
            <Shield className="w-6 h-6 text-gray-600" />
            <span className="flex-1 text-left font-medium text-gray-900">Learn about delivery partner safety</span>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </motion.button>
        )}

        {!isDeliveredOrder && (
          <motion.div className="bg-yellow-50 rounded-xl p-4 text-center" {...MOTION_SLIDE_UP(0.65)}>
            <p className="text-yellow-800 font-medium">All your delivery details in one place 🚀</p>
          </motion.div>
        )}

        {/* Contact & Address */}
        <motion.div className="bg-white rounded-xl shadow-sm overflow-hidden" {...MOTION_SLIDE_UP(0.7)}>
          <SectionItem
            icon={User}
            title={order?.userName || order?.userId?.fullName || order?.userId?.name || profile?.fullName || profile?.name || 'Customer'}
            subtitle={order?.userPhone || order?.userId?.phone || order?.address?.phone || order?.deliveryAddress?.phone || profile?.phone || defaultAddress?.phone || 'Phone number not available'}
            showArrow={false}
          />
          <SectionItem iconNode={customerPinNode} title="Delivery at Location" subtitle={deliveryAddressSubtitle} showArrow={false} />
          {!isDeliveredOrder && (
            <SectionItem
              icon={MessageSquare}
              title={order?.note ? "Edit delivery instructions" : "Add delivery instructions"}
              subtitle={order?.note ? order.note.substring(0, 35) + (order.note.length > 35 ? "..." : "") : ""}
              onClick={openInstructionsModal}
            />
          )}
        </motion.div>

        {/* Pickup Sources */}
        <motion.div className="bg-white rounded-xl shadow-sm overflow-hidden" {...MOTION_SLIDE_UP(0.75)}>
          <div className="p-4 border-b border-dashed border-gray-200">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400">
                  {order?.orderType === 'mixed' ? 'Pickup Points' : (isQuickOrder ? 'Store' : 'Restaurant')}
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  {order?.orderType === 'mixed' ? 'Restaurant and store details for this mixed order' : 'Pickup details for your order'}
                </p>
              </div>
              {pickupSources.length === 1 && (
                <motion.button className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center" onClick={handleCallRestaurant} whileTap={{ scale: 0.9 }}>
                  <Phone className="w-5 h-5 text-[#FF0000]" />
                </motion.button>
              )}
            </div>

            <div className="mt-4 space-y-3">
              {pickupSources.map((source, index) => {
                const isQuick = source.pickupType === 'quick';
                const badgeClasses = isQuick ? 'bg-sky-50 text-sky-700 border-sky-200' : 'bg-red-50 text-red-700 border-red-200';
                return (
                  <div key={source.id || `${source.pickupType}-${index}`} className="rounded-2xl border border-gray-100 bg-gray-50/80 p-4">
                    <div className="flex items-start gap-3">
                      <div className={`inline-flex h-12 w-12 items-center justify-center rounded-full ${isQuick ? 'bg-sky-100' : 'bg-red-100'} flex-shrink-0`}>
                        <div dangerouslySetInnerHTML={{ __html: SAFE_RESTAURANT_PIN }} className="w-7 h-7 [&_svg]:w-full [&_svg]:h-full [&_svg]:block" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${badgeClasses}`}>
                          {pickupSources.length > 1 ? `${source.label} ${index + 1}` : source.label}
                        </span>
                        <p className="mt-2 font-semibold text-gray-900">{source.name}</p>
                        <p className="mt-1 text-sm text-gray-500">{source.address || 'Address not available'}</p>
                      </div>
                      {source.phone ? (
                        <motion.button className={`w-10 h-10 rounded-full flex items-center justify-center ${isQuick ? 'bg-sky-50' : 'bg-red-50'}`} onClick={(e) => handleCallPickupSource(source.phone, e)} whileTap={{ scale: 0.9 }}>
                          <Phone className={`w-5 h-5 ${isQuick ? 'text-sky-600' : 'text-[#FF0000]'}`} />
                        </motion.button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Order Items */}
          <div className="p-4 border-b border-dashed border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => setShowOrderDetails(true)}>
            <div className="flex items-start gap-3">
              <Receipt className="w-5 h-5 text-gray-500 mt-0.5" />
              <div className="flex-1">
                <div className="mt-2 space-y-1">
                  {order?.items?.map((item, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm text-gray-600">
                      <span className="w-4 h-4 rounded border border-green-600 flex items-center justify-center">
                        <span className="w-2 h-2 rounded-full bg-green-600" />
                      </span>
                      <div className="min-w-0">
                        <span className="block truncate">
                          {item.quantity} x {item.name}{item.variantName ? ` (${item.variantName})` : ""}
                        </span>
                        {item?.pharmacyDetails && (
                          <PharmacyMetaLines
                            product={item}
                            showManufacturer
                            showGeneric
                            showStrengthDosage
                            showPack
                            className="mt-0.5"
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </div>
          </div>
        </motion.div>

        {isQuickCommerceOrder && isDeliveredOrder && orderStatus !== 'cancelled' && (
          <motion.div {...MOTION_SLIDE_UP(0.76)} className="space-y-4">
            <ReturnWindowBanner
              eligibility={liveReturnEligibility}
              deliveredAt={
                liveReturnEligibility?.deliveredAt ||
                order?.deliveryState?.deliveredAt ||
                order?.deliveredAt
              }
            />
            <ReturnTrackingPanel
              orderId={order?.orderId || order?.mongoId || orderId}
              order={order}
              onRefresh={handleReturnRefresh}
            />
            <ReturnItemsCta
              orderId={order?.orderId || order?.mongoId || orderId}
              hasActiveReturn={activeReturnCount > 0}
              canReturn={canRequestReturn}
            />
            {liveReturnEligibility?.returnWindowExpired && activeReturnCount === 0 && (
              <p className="text-center text-sm text-slate-500 px-4">
                Return window has expired.
              </p>
            )}
          </motion.div>
        )}

        {isDeliveredOrder && (
          <motion.div className="bg-white rounded-xl shadow-sm overflow-hidden" {...MOTION_SLIDE_UP(0.78)}>
            <SectionItem
              icon={Star}
              title={order?.ratings ? "View your ratings" : "Rate your experience"}
              subtitle={order?.ratings ? "You've already rated this order" : "Tell us how your experience was with the store and delivery partner"}
              onClick={() => {
                    // Always open, pre-fill if already rated
                    setRatingModal({ open: true, order: order });
                    // If already rated, pre-fill the values
                    if (order?.ratings) {
                      const sellerRating = order.ratings.seller || order.ratings.restaurant;
                      setSelectedRestaurantRating(sellerRating?.rating || null);
                      setSelectedDeliveryRating(order.ratings.deliveryPartner?.rating || null);
                      setRestaurantFeedbackText(sellerRating?.comment || "");
                      setDeliveryFeedbackText(order.ratings.deliveryPartner?.comment || "");
                    } else {
                      // Reset if not rated
                      setSelectedRestaurantRating(null);
                      setSelectedDeliveryRating(null);
                      setRestaurantFeedbackText("");
                      setDeliveryFeedbackText("");
                    }
                  }}
            />
          </motion.div>
        )}

        {!isAdminAccepted && !isDeliveredOrder && orderStatus !== 'cancelled' && (
          <motion.div className="bg-white rounded-xl shadow-sm overflow-hidden" {...MOTION_SLIDE_UP(0.8)}>
            <SectionItem icon={CircleSlash} title="Cancel order" subtitle="" onClick={handleCancelOrder} />
          </motion.div>
        )}

        <motion.div className="bg-white rounded-xl shadow-sm overflow-hidden" {...MOTION_SLIDE_UP(0.82)}>
          <SectionItem icon={Download} title="Download invoice" subtitle="Get a dynamic PDF invoice for this order" onClick={handleDownloadInvoice} />
        </motion.div>
      </div>

      {/* Cancel Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent className="sm:max-w-xl w-[95%] max-w-[600px]">
          <DialogHeader><DialogTitle className="text-xl font-bold text-gray-900">Cancel Order</DialogTitle></DialogHeader>
          <div className="space-y-5 py-6 px-2">
            {showRefundDestinationChoice && (
              <div className="space-y-3 rounded-2xl border border-red-200 bg-red-50/60 p-4">
                <div>
                  <p className="text-sm font-semibold text-gray-900">Refund method</p>
                  <p className="text-xs text-gray-600">
                    Choose where you want your refund after cancellation.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    { value: "wallet", label: "Wallet", desc: "Amount will be added to your app wallet." },
                    { value: "gateway", label: "Original payment method", desc: "Refund back to Razorpay / UPI / card." },
                  ].map(({ value, label, desc }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setRefundDestination(value)}
                      disabled={isCancelling}
                      className={`rounded-xl border px-4 py-3 text-left transition ${refundDestination === value ? "border-red-500 bg-white text-red-900 shadow-sm" : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"} ${isCancelling ? "cursor-not-allowed opacity-60" : ""}`}>
                      <p className="text-sm font-semibold">{label}</p>
                      <p className="mt-1 text-xs text-gray-500">{desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div>
              <p className="text-sm font-semibold text-gray-900 mb-2">Cancellation reason</p>
              <Textarea value={cancellationReason} onChange={(e) => setCancellationReason(e.target.value)} placeholder="e.g., Changed my mind, Wrong address, etc." className="w-full min-h-[100px] resize-none border-2 border-gray-300 rounded-lg px-4 py-3 text-sm focus:border-red-500 focus:ring-2 focus:ring-red-200 focus:outline-none transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed disabled:border-gray-200" disabled={isCancelling} />
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => { setShowCancelDialog(false); setCancellationReason(""); setRefundDestination("gateway"); }} disabled={isCancelling} className="flex-1">Cancel</Button>
              <Button onClick={handleConfirmCancel} disabled={isCancelling || !cancellationReason.trim()} className="flex-1 bg-red-600 hover:bg-red-700 text-white">
                {isCancelling ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Cancelling...</> : 'Confirm Cancellation'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cancellation notice popup */}
      <Dialog open={Boolean(cancellationNotice)} onOpenChange={(open) => { if (!open) setCancellationNotice(null); }}>
        <DialogContent className="sm:max-w-md w-[95%]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-gray-900">{cancellationNotice?.title || 'Order Cancelled'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm leading-relaxed text-gray-600">{cancellationNotice?.message}</p>
            <Button onClick={() => setCancellationNotice(null)} className="w-full bg-red-600 hover:bg-red-700 text-white">
              OK
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Order Details Dialog */}
      <Dialog open={showOrderDetails} onOpenChange={setShowOrderDetails}>
        <DialogContent className="max-w-[calc(100vw-32px)] sm:max-w-md bg-white rounded-2xl p-0 overflow-hidden border-none outline-none">
          <DialogHeader className="p-6 pb-4 border-b border-gray-100 pr-12">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-xl font-bold text-gray-900">Order Details</DialogTitle>
            </div>
          </DialogHeader>
          <div className="p-6 pt-4 space-y-6 max-h-[70vh] overflow-y-auto">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-4 mt-2">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Date & Time</p>
                  <p className="text-sm font-medium text-gray-900">{order?.createdAt ? new Date(order.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : 'N/A'}</p>
                </div>
                <div className="h-8 w-px bg-gray-100" />
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Status</p>
                  <span className="text-sm font-bold text-green-600 uppercase">{String(order?.status || orderStatus || "placed").replace(/_/g, " ")}</span>
                </div>
              </div>
            </div>
            {order?.note && (
              <div className="bg-red-50/50 rounded-xl p-4 border border-red-100 flex gap-3">
                <MessageSquare className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-red-600 font-bold uppercase tracking-wider mb-1">Delivery Instructions</p>
                  <p className="text-sm text-gray-800 leading-relaxed font-medium capitalize">{order.note}</p>
                </div>
              </div>
            )}
            <div>
              <p className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">Order Items</p>
              <div className="space-y-4">
                {order?.items?.map((item, index) => (
                  <div key={index} className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="w-5 h-5 rounded border border-green-600 flex items-center justify-center mt-0.5 shrink-0">
                        <div className="w-2.5 h-2.5 rounded-full bg-green-600" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900 leading-tight">{item.name}</p>
                        {item.variantName && <p className="text-sm text-gray-500 mt-0.5">{item.variantName}</p>}
                        {item?.pharmacyDetails && (
                          <PharmacyMetaLines
                            product={item}
                            showManufacturer
                            showGeneric
                            showStrengthDosage
                            showPack
                            className="mt-1"
                          />
                        )}
                        <p className="text-sm text-gray-500 mt-0.5">Quantity: {item.quantity}</p>
                      </div>
                    </div>
                    <p className="font-semibold text-gray-900">₹{((item?.price || 0) * (item?.quantity || 0)).toFixed(2)}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 space-y-3">
              <p className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-1">Bill Summary</p>
              {[
                ["Item Total", order?.pricing?.subtotal || order?.subtotal],
                Number(order?.pricing?.packagingFee || order?.packagingFee) > 0 && ["Packaging Charges", order?.pricing?.packagingFee || order?.packagingFee],
                Number(order?.pricing?.platformFee || order?.platformFee) > 0 && ["Platform Fee", order?.pricing?.platformFee || order?.platformFee],
                ["Delivery Fee", order?.pricing?.deliveryFee || order?.deliveryFee],
                ["Taxes & Charges (GST)", order?.pricing?.tax || order?.pricing?.gst || order?.gst],
              ].filter(Boolean).map(([label, val]) => (
                <div key={label} className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">{label}</span>
                  <span className="text-gray-900 font-medium">₹{Number(val || 0).toFixed(2)}</span>
                </div>
              ))}
              {Number(order?.pricing?.discount || order?.discount) > 0 && (
                <div className="flex justify-between items-center text-sm text-green-600 font-medium">
                  <span>Discount Applied</span>
                  <span>-₹{Number(order?.pricing?.discount || order?.discount).toFixed(2)}</span>
                </div>
              )}
              <div className="pt-2 border-t border-gray-200 flex justify-between items-center">
                <span className="text-base font-bold text-gray-900">Total Amount</span>
                <span className="text-lg font-bold text-gray-900">₹{Number(order?.totalAmount || 0).toFixed(2)}</span>
              </div>
            </div>
            {order?.paymentMethod && (
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2 text-gray-600">
                  <Shield className="w-4 h-4" />
                  <span className="text-sm font-medium">Payment Method</span>
                </div>
                <span className="text-sm font-bold text-gray-900 uppercase tracking-wide">{order.paymentMethod}</span>
              </div>
            )}
          </div>
          <div className="p-6 border-t border-gray-100">
            <Button onClick={() => setShowOrderDetails(false)} className="w-full bg-gray-900 text-white font-bold h-12 rounded-xl">Okay</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delivery Instructions Dialog */}
      <Dialog open={isInstructionsModalOpen} onOpenChange={setIsInstructionsModalOpen}>
        <DialogContent className="sm:max-w-md w-[95vw] rounded-3xl p-6 border-0 shadow-2xl bg-white max-h-[90vh] overflow-y-auto z-[200]">
          <DialogHeader className="mb-2">
            <DialogTitle className="text-xl font-bold bg-gradient-to-r from-red-600 to-red-400 bg-clip-text text-transparent">Delivery Instructions</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-500">Add instructions for the delivery partner to help them find your address or know where to leave your order.</p>
            <Textarea value={deliveryInstructions} onChange={(e) => setDeliveryInstructions(e.target.value)} placeholder="E.g. Ring the doorbell, leave at the front desk..." className="min-h-[120px] resize-none border-gray-200 focus:ring-red-500 rounded-xl bg-gray-50 text-base" />
            <Button onClick={handleUpdateInstructions} disabled={isUpdatingInstructions} className="w-full bg-gradient-to-r from-red-500 to-amber-500 hover:from-red-600 hover:to-amber-600 text-white font-bold h-12 rounded-xl border-none">
              {isUpdatingInstructions ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Save Instructions"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rating Modal */}
      <AnimatePresence>
        {ratingModal.open && ratingModal.order && (
          <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="w-full max-w-sm rounded-2xl bg-white shadow-2xl overflow-hidden">
              <div className="bg-gradient-to-r from-red-600 to-red-500 px-5 py-4">
                <div className="flex items-center justify-between mb-1">
                  <h2 className="text-lg font-bold text-white flex items-center gap-2"><Star className="w-4 h-4 fill-white" />Rate Your Experience</h2>
                  <button type="button" onClick={handleCloseRating} className="text-white/80 hover:text-white transition-colors p-1 rounded-full hover:bg-white/20"><X className="w-4 h-4" /></button>
                </div>
                <p className="text-xs text-white/90">{ratingModal.order.restaurant}</p>
              </div>
              <div className="px-5 py-4 space-y-4">
                {[
                  { key: 'restaurant', label: isQuickOrder ? 'Store rating' : 'Restaurant rating', rating: selectedRestaurantRating, setRating: setSelectedRestaurantRating, text: restaurantFeedbackText, setText: setRestaurantFeedbackText, placeholder: "Tell us what you liked (optional)", show: true },
                  { key: 'delivery', label: 'Delivery partner rating', rating: selectedDeliveryRating, setRating: setSelectedDeliveryRating, text: deliveryFeedbackText, setText: setDeliveryFeedbackText, placeholder: "How was the delivery? (optional)", show: !!order?.deliveryPartnerId },
                ].filter((s) => s.show).map((section, sIdx) => (
                  <div key={section.key} className={sIdx > 0 ? "pt-3 border-t border-gray-100" : ""}>
                    <p className="text-xs font-semibold text-gray-900 mb-2">{section.label} (out of 5)</p>
                    <div className="flex items-center justify-center gap-1 mb-2">
                      {[1, 2, 3, 4, 5].map((num) => (
                        <button key={`${section.key}-${num}`} type="button" onClick={() => section.setRating(num)} className="p-1 transition-transform hover:scale-125 active:scale-95">
                          <Star className={`w-8 h-8 transition-all ${(section.rating || 0) >= num ? "text-yellow-400 fill-yellow-400 drop-shadow-lg" : "text-gray-200 hover:text-yellow-200"}`} />
                        </button>
                      ))}
                    </div>
                    <Textarea rows={1} value={section.text} onChange={(e) => section.setText(e.target.value)} className="w-full rounded-lg border-2 border-gray-100 px-3 py-1.5 text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none transition-all" placeholder={section.placeholder} />
                  </div>
                ))}
                <Button type="button" disabled={submittingRating || selectedRestaurantRating === null || (!!order?.deliveryPartnerId && selectedDeliveryRating === null)} onClick={handleSubmitRating} className="w-full rounded-lg bg-gradient-to-r from-red-600 to-red-500 text-white text-sm font-bold h-10 hover:from-red-700 hover:to-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-red-500/20 flex items-center justify-center gap-2">
                  {submittingRating ? <><Loader2 className="w-4 h-4 animate-spin" />Submitting...</> : <><Check className="w-4 h-4" />Submit Ratings</>}
                </Button>
                {selectedRestaurantRating === null && <p className="text-[9px] text-center text-gray-400">Please select a rating to enable submission</p>}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
