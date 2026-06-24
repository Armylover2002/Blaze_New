const order = {
  payment: {
    method: "razorpay",
    status: "created"
  }
};

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

const confirmed = true;
const isQuickOrder = true;

const showRefundDestinationChoice = (() => {
  if (!order) return false;
  if (isQuickOrder) return isQuickOrderOnlinePayment(order, confirmed);
  const method = String(order?.payment?.method || order?.paymentMethod || "").trim().toLowerCase();
  return isRefundablePrepaidOrder(order) && ["razorpay", "razorpay_qr", "online"].includes(method);
})();

console.log("showRefundDestinationChoice:", showRefundDestinationChoice);
