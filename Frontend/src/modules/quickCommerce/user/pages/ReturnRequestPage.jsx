import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, Package, Check } from "lucide-react";
import { toast } from "sonner";
import { customerApi } from "../services/customerApi";
import AnimatedPage from "@food/components/user/AnimatedPage";
import { Button } from "@food/components/ui/button";
import { Textarea } from "@food/components/ui/textarea";
import ReturnWindowBanner from "../components/return/ReturnWindowBanner";
import { resolveLiveReturnEligibility } from "@/shared/utils/returnWindow";

const RETURN_REASONS = [
  "Received wrong item",
  "Item damaged or defective",
  "Quality not as expected",
  "Missing items in package",
  "Changed my mind",
  "Other",
];

const buildItemKey = (item) =>
  String(item?.productId || item?.itemId || item?._id || item?.id || "").trim();

const ReturnRequestPage = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedItems, setSelectedItems] = useState({});
  const [reason, setReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [refundMethod, setRefundMethod] = useState("wallet");
  const [payoutDetails, setPayoutDetails] = useState({
    upiId: "",
    accountHolderName: "",
    accountNumber: "",
    ifscCode: "",
  });
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await customerApi.getOrderDetails(orderId, { forceRefresh: true });
        const payload =
          res?.data?.result ||
          res?.data?.data?.order ||
          res?.data?.order ||
          res?.data?.data ||
          null;
        setOrder(payload);
      } catch (error) {
        toast.error(error?.response?.data?.message || "Failed to load order");
        navigate(`/quick/orders/${orderId}`);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [orderId, navigate]);

  const quickItems = useMemo(() => {
    const items = Array.isArray(order?.items) ? order.items : [];
    return items.filter(
      (item) => !item?.type || String(item.type).toLowerCase() === "quick",
    );
  }, [order]);

  const returnEligibility = useMemo(
    () => resolveLiveReturnEligibility(order?.returnEligibility, now),
    [order?.returnEligibility, now],
  );

  const canSubmitReturn = Boolean(returnEligibility?.canReturn);

  const toggleItem = (item) => {
    const key = buildItemKey(item);
    if (!key) return;
    setSelectedItems((prev) => {
      const next = { ...prev };
      if (next[key]) delete next[key];
      else next[key] = item;
      return next;
    });
  };

  const resolvedReason = reason === "Other" ? customReason.trim() : reason;

  const handleSubmit = async () => {
    const selected = Object.values(selectedItems);
    if (!selected.length) {
      toast.error("Select at least one item to return");
      return;
    }
    if (resolvedReason.length < 3) {
      toast.error("Please provide a return reason (min 3 characters)");
      return;
    }
    if (refundMethod === "upi") {
      if (!payoutDetails.upiId.trim()) {
        toast.error("UPI ID is required for UPI refund");
        return;
      }
      if (!/^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/.test(payoutDetails.upiId.trim())) {
        toast.error("Invalid UPI ID format");
        return;
      }
    }
    if (refundMethod === "bank") {
      if (!payoutDetails.accountHolderName.trim() || !payoutDetails.accountNumber.trim() || !payoutDetails.ifscCode.trim()) {
        toast.error("Complete bank details are required");
        return;
      }
      if (!/^[a-zA-Z\s]{2,50}$/.test(payoutDetails.accountHolderName.trim())) {
        toast.error("Account holder name must contain only letters and spaces");
        return;
      }
      if (!/^\d{9,18}$/.test(payoutDetails.accountNumber.trim())) {
        toast.error("Account number must be 9 to 18 digits");
        return;
      }
      if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(payoutDetails.ifscCode.trim().toUpperCase())) {
        toast.error("Invalid IFSC code format");
        return;
      }
    }

    if (!canSubmitReturn) {
      toast.error("Return window has expired.");
      return;
    }

    setSubmitting(true);
    try {
      await customerApi.createReturnRequest(orderId, {
        reason: resolvedReason,
        refundMethod,
        payoutDetails: refundMethod === "wallet" ? {} : payoutDetails,
        items: selected.map((item) => ({
          itemId: buildItemKey(item),
        })),
      });
      toast.success("Return request submitted");
      navigate(`/quick/orders/${orderId}`);
    } catch (error) {
      const code = error?.response?.data?.code;
      if (code === "RETURN_WINDOW_EXPIRED") {
        toast.error(error?.response?.data?.message || "Return window has expired.");
      } else {
        toast.error(error?.response?.data?.message || "Failed to submit return request");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <AnimatedPage>
        <div className="min-h-[60vh] flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-red-500" />
        </div>
      </AnimatedPage>
    );
  }

  return (
    <AnimatedPage>
      <div className="max-w-lg mx-auto px-4 py-4 pb-24 space-y-5">
        <div className="flex items-center gap-3">
          <Link to={`/quick/orders/${orderId}`} className="p-2 rounded-full hover:bg-slate-100">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Return items</h1>
            <p className="text-sm text-slate-500">Order #{order?.orderId || orderId}</p>
          </div>
        </div>

        <ReturnWindowBanner
          eligibility={returnEligibility}
          deliveredAt={returnEligibility?.deliveredAt || order?.deliveryState?.deliveredAt}
        />

        {!canSubmitReturn && (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            Return window has expired. You can no longer request a return for this order.
          </div>
        )}

        <section className={`bg-white rounded-2xl border border-slate-100 p-4 space-y-3 ${!canSubmitReturn ? "opacity-60 pointer-events-none" : ""}`}>
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Select items</p>
          <p className="text-xs text-slate-500">Full quantity will be returned for each selected item.</p>
          {quickItems.length === 0 ? (
            <p className="text-sm text-slate-500">No returnable items found on this order.</p>
          ) : (
            quickItems.map((item) => {
              const key = buildItemKey(item);
              const selected = Boolean(selectedItems[key]);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleItem(item)}
                  className={`w-full flex items-start gap-3 p-3 rounded-xl border text-left transition ${
                    selected ? "border-amber-400 bg-amber-50/50" : "border-slate-100 hover:bg-slate-50"
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-md border flex items-center justify-center mt-0.5 ${
                      selected ? "bg-amber-500 border-amber-500 text-white" : "border-slate-300"
                    }`}
                  >
                    {selected && <Check className="w-3 h-3" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900">
                      {item.name}
                      <span className="text-slate-500 font-semibold"> x{Number(item.quantity || 1)}</span>
                    </p>
                  </div>
                  <p className="text-sm font-bold text-slate-900 shrink-0">
                    ₹{Number(item.price || 0) * Number(item.quantity || 1)}
                  </p>
                </button>
              );
            })
          )}
        </section>

        <section className={`bg-white rounded-2xl border border-slate-100 p-4 space-y-3 ${!canSubmitReturn ? "opacity-60 pointer-events-none" : ""}`}>
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Reason</p>
          <div className="flex flex-wrap gap-2">
            {RETURN_REASONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReason(r)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                  reason === r
                    ? "bg-slate-900 text-white border-slate-900"
                    : "border-slate-200 text-slate-600 hover:border-slate-300"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
          {reason === "Other" && (
            <Textarea
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              placeholder="Describe the issue..."
              className="min-h-[80px]"
            />
          )}
        </section>

        <section className={`bg-white rounded-2xl border border-slate-100 p-4 space-y-3 ${!canSubmitReturn ? "opacity-60 pointer-events-none" : ""}`}>
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Refund method</p>
          <div className="grid gap-2">
            {[
              { id: "wallet", label: "Wallet", desc: "Instant credit to app wallet" },
              { id: "upi", label: "UPI", desc: "Refund to your UPI ID" },
              { id: "bank", label: "Bank", desc: "Refund to bank account" },
            ].map((method) => (
              <button
                key={method.id}
                type="button"
                onClick={() => setRefundMethod(method.id)}
                className={`rounded-xl border px-4 py-3 text-left ${
                  refundMethod === method.id
                    ? "border-amber-500 bg-amber-50"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <p className="text-sm font-bold text-slate-900">{method.label}</p>
                <p className="text-xs text-slate-500">{method.desc}</p>
              </button>
            ))}
          </div>

          {refundMethod === "upi" && (
            <input
              type="text"
              placeholder="UPI ID (e.g. name@upi)"
              value={payoutDetails.upiId}
              maxLength={100}
              onChange={(e) => setPayoutDetails((p) => ({ ...p, upiId: e.target.value.replace(/\s/g, "") }))}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
            />
          )}

          {refundMethod === "bank" && (
            <div className="space-y-2">
              <input
                type="text"
                placeholder="Account holder name"
                value={payoutDetails.accountHolderName}
                maxLength={50}
                onChange={(e) =>
                  setPayoutDetails((p) => ({ ...p, accountHolderName: e.target.value.replace(/[^a-zA-Z\s]/g, "") }))
                }
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
              />
              <input
                type="text"
                placeholder="Account number"
                value={payoutDetails.accountNumber}
                maxLength={18}
                onChange={(e) =>
                  setPayoutDetails((p) => ({ ...p, accountNumber: e.target.value.replace(/\D/g, "") }))
                }
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
              />
              <input
                type="text"
                placeholder="IFSC code"
                value={payoutDetails.ifscCode}
                maxLength={11}
                onChange={(e) => setPayoutDetails((p) => ({ ...p, ifscCode: e.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase() }))}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
              />
            </div>
          )}
        </section>

        <Button
          onClick={handleSubmit}
          disabled={submitting || quickItems.length === 0 || !canSubmitReturn}
          className="w-full h-12 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-bold"
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              <Package className="w-4 h-4 mr-2" />
              Submit return request
            </>
          )}
        </Button>
      </div>
    </AnimatedPage>
  );
};

export default ReturnRequestPage;
