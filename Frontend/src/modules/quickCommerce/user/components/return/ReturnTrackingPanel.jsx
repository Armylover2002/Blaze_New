import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { RefreshCw, Package, ChevronRight, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import ReturnProgressTracker from "./ReturnProgressTracker";
import ReturnPickupOtpDisplay from "./ReturnPickupOtpDisplay";
import { customerApi } from "../../services/customerApi";
import { mapReturnStatusLabel, RETURN_STATUS } from "@/shared/utils/returnStatus";
import { Truck } from "lucide-react";

const ACTIVE_RETURN_STATUSES = new Set([
  RETURN_STATUS.REQUESTED,
  RETURN_STATUS.APPROVED,
  RETURN_STATUS.PICKUP_ASSIGNED,
  RETURN_STATUS.IN_TRANSIT,
  RETURN_STATUS.RETURNED,
]);

const TERMINAL_RETURN_STATUSES = new Set([
  RETURN_STATUS.REJECTED,
  RETURN_STATUS.CANCELLED,
  RETURN_STATUS.REFUND_COMPLETED,
]);

const ReturnTrackingPanel = ({ orderId, order, onRefresh }) => {
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cancellingId, setCancellingId] = useState("");

  const loadReturns = useCallback(async (silent = false) => {
    if (!orderId) return;
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await customerApi.getReturnStatus(orderId, { forceRefresh: true });
      const payload = res?.data?.result || res?.data?.data || {};
      const items = Array.isArray(payload?.returns) ? payload.returns : [];
      setReturns(items);
      onRefresh?.(items, payload);
    } catch (error) {
      if (!silent) {
        toast.error(error?.response?.data?.message || "Failed to load return status");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [orderId, onRefresh]);

  useEffect(() => {
    void loadReturns();
    const poller = window.setInterval(() => {
      if (!document.hidden) void loadReturns(true);
    }, 20000);
    return () => window.clearInterval(poller);
  }, [loadReturns]);

  const handleCancel = async (ret) => {
    if (!window.confirm("Cancel this return request?")) return;
    const cancelKey = String(ret.returnId || ret.id || "");
    setCancellingId(cancelKey);
    try {
      await customerApi.cancelReturnRequest(orderId, {
        reason: "Cancelled by customer",
      });
      toast.success("Return request cancelled");
      await loadReturns(true);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to cancel return");
    } finally {
      setCancellingId("");
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl p-6 flex items-center justify-center gap-3 text-slate-500">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm font-medium">Loading return status...</span>
      </div>
    );
  }

  const visibleReturns = returns.filter(
    (r) => ACTIVE_RETURN_STATUSES.has(r.returnStatus) || TERMINAL_RETURN_STATUSES.has(r.returnStatus),
  );
  if (!visibleReturns.length) return null;

  return (
    <div className="space-y-4">
      {visibleReturns.map((ret) => {
        const isTerminal = TERMINAL_RETURN_STATUSES.has(ret.returnStatus);
        const showLiveTracking = !isTerminal && [
          RETURN_STATUS.PICKUP_ASSIGNED,
          RETURN_STATUS.IN_TRANSIT,
        ].includes(ret.returnStatus);
        const canCancel = !isTerminal && [
          RETURN_STATUS.REQUESTED,
          RETURN_STATUS.APPROVED,
          RETURN_STATUS.PICKUP_ASSIGNED,
        ].includes(ret.returnStatus);
        const cancelKey = String(ret.returnId || ret.id || "");

        return (
          <motion.div
            key={ret.returnId || ret.id}
            className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <Package className="w-5 h-5 text-amber-600 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900 truncate">
                    {isTerminal ? "Return update" : "Return in progress"}
                  </p>
                  <p className="text-xs text-slate-500">{mapReturnStatusLabel(ret.returnStatus)}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => loadReturns(true)}
                disabled={refreshing}
                className="p-2 rounded-lg hover:bg-slate-50 text-slate-500"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <ReturnProgressTracker returnDoc={ret} />

              {Array.isArray(ret.returnItems) && ret.returnItems.length > 0 && (
                <div className="rounded-xl border border-slate-100 bg-white p-3 space-y-1.5">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Returned items</p>
                  {ret.returnItems.map((item) => {
                    const qty = Number(item.returnedQty ?? item.quantity ?? 0);
                    return (
                      <p key={item.itemId || item.name} className="text-sm font-semibold text-slate-800">
                        {item.name || item.itemId}
                        {qty > 0 ? ` x${qty} Returned` : " Returned"}
                      </p>
                    );
                  })}
                </div>
              )}

              <ReturnPickupOtpDisplay
                orderId={orderId}
                returnDoc={ret}
                sellerId={ret.sellerId}
              />

              {showLiveTracking && (
                <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                    <Truck className="w-5 h-5 text-amber-700" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-amber-900">Live return pickup</p>
                    <p className="text-xs text-amber-700 mt-1">
                      Your return pickup rider is en route. Share the pickup OTP when they arrive.
                    </p>
                    {ret.dispatch?.deliveryPartnerId && (
                      <p className="text-xs text-amber-800 font-semibold mt-2">Rider assigned</p>
                    )}
                  </div>
                </div>
              )}

              <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600 space-y-1">
                <p>
                  Refund method:{" "}
                  <span className="font-bold uppercase">{ret.refundMethod || "—"}</span>
                </p>
                <p>
                  Refund amount:{" "}
                  <span className="font-bold">₹{Number(ret.returnRefundAmount || 0).toFixed(2)}</span>
                </p>
                {ret.refundStatus && ret.refundStatus !== "none" && (
                  <p>
                    Refund status: <span className="font-bold capitalize">{ret.refundStatus}</span>
                  </p>
                )}
              </div>

              {canCancel && (
                <button
                  type="button"
                  onClick={() => handleCancel(ret)}
                  disabled={Boolean(cancellingId)}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-rose-200 text-rose-600 text-sm font-bold hover:bg-rose-50 disabled:opacity-60"
                >
                  <XCircle className="w-4 h-4" />
                  {cancellingId === cancelKey ? "Cancelling..." : "Cancel return request"}
                </button>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};

export const ReturnItemsCta = ({ orderId, hasActiveReturn, canReturn = true }) => {
  if (hasActiveReturn || !canReturn) return null;
  return (
    <Link
      to={`/quick/orders/${orderId}/return`}
      className="flex items-center gap-3 p-4 bg-white rounded-xl shadow-sm hover:bg-slate-50 transition-colors"
    >
      <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center">
        <Package className="w-5 h-5 text-amber-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900">Return items</p>
        <p className="text-sm text-gray-500">Request a return for eligible items</p>
      </div>
      <ChevronRight className="w-5 h-5 text-gray-400 shrink-0" />
    </Link>
  );
};

export default ReturnTrackingPanel;
