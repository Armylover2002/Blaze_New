import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useBooking } from "../context/BookingContext";
import { resolveActiveRouteForStatus } from "../utils/orderMapper";

const TERMINAL_STATUSES = new Set([
  "delivered",
  "completed",
  "cancelled_by_user",
  "cancelled_by_admin",
  "cancelled_by_driver",
  "failed",
]);

const DRAFT_PATH_PREFIXES = [
  "/porter/address",
  "/porter/parcel-details",
  "/porter/vehicle",
  "/porter/fare-estimate",
  "/porter/promo",
  "/porter/payment",
  "/porter/schedule",
];

const ACTIVE_FLOW_PREFIXES = [
  "/porter/finding-partner",
  "/porter/scheduled",
  "/porter/partner-assigned",
  "/porter/tracking",
  "/porter/cancel",
  "/porter/sos",
];

export default function PorterBookingGuard({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { activeShipment } = useBooking();

  useEffect(() => {
    if (!activeShipment?.id) return;
    const status = String(activeShipment.status || "").toLowerCase();
    if (TERMINAL_STATUSES.has(status)) {
      const path = location.pathname;
      const isActiveFlow = ACTIVE_FLOW_PREFIXES.some((prefix) => path.startsWith(prefix));
      if (isActiveFlow) {
        navigate(`/porter/shipment/${activeShipment.id}`, { replace: true });
      }
      return;
    }

    const path = location.pathname;
    const target = resolveActiveRouteForStatus(status);
    const isDraftPath = DRAFT_PATH_PREFIXES.some((prefix) => path.startsWith(prefix));
    const isHome = path === "/porter" || path === "/porter/home";
    const isActiveFlow = ACTIVE_FLOW_PREFIXES.some((prefix) => path.startsWith(prefix));

    if (isDraftPath || isHome) {
      // Allow schedule picker while rescheduling an already-scheduled order.
      if (path.startsWith("/porter/schedule") && status === "scheduled") {
        return;
      }
      navigate(target, { replace: true });
      return;
    }

    if (isActiveFlow && path !== target) {
      // Allow viewing tracking page during partner-assigned phases
      if (path === "/porter/tracking" && target === "/porter/partner-assigned") {
        return;
      }
      navigate(target, { replace: true });
    }
  }, [activeShipment, location.pathname, navigate]);

  return children;
}
