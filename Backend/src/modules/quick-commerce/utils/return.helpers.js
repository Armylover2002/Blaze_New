import mongoose from 'mongoose';
import crypto from 'crypto';

export const RETURN_STATUSES = {
  REQUESTED: 'return_requested',
  APPROVED: 'return_approved',
  REJECTED: 'return_rejected',
  PICKUP_ASSIGNED: 'return_pickup_assigned',
  IN_TRANSIT: 'return_in_transit',
  RETURNED: 'returned',
  REFUND_COMPLETED: 'refund_completed',
  CANCELLED: 'return_cancelled',
};

export const TERMINAL_RETURN_STATUSES = new Set([
  RETURN_STATUSES.REJECTED,
  RETURN_STATUSES.REFUND_COMPLETED,
  RETURN_STATUSES.CANCELLED,
]);

export const ACTIVE_RETURN_STATUSES = new Set([
  RETURN_STATUSES.REQUESTED,
  RETURN_STATUSES.APPROVED,
  RETURN_STATUSES.PICKUP_ASSIGNED,
  RETURN_STATUSES.IN_TRANSIT,
  RETURN_STATUSES.RETURNED,
]);

export const REFUND_METHODS = new Set(['wallet', 'upi', 'bank']);

export const REFUND_STATUSES = {
  NONE: 'none',
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
};

export const RETURN_HISTORY_ROLES = new Set([
  'USER',
  'SELLER',
  'ADMIN',
  'DELIVERY_PARTNER',
  'SYSTEM',
]);

export const DEFAULT_RETURN_WINDOW_HOURS = 72;

export const generateReturnOtp = () => String(crypto.randomInt(1000, 9999));

export const normalizeRefundMethod = (value) => String(value || '').trim().toLowerCase();

export const isQuickCommerceOrderType = (orderType) => ['quick', 'mixed'].includes(String(orderType || '').toLowerCase());

export const isDeliveredOrder = (order) => {
  const status = String(order?.orderStatus || '').toLowerCase();
  const workflow = String(order?.workflowStatus || '').toUpperCase();
  return status === 'delivered' || workflow === 'DELIVERED';
};

export const resolveOrderDeliveredAt = (order, sellerOrders = []) => {
  const fromDeliveryState = order?.deliveryState?.deliveredAt;
  if (fromDeliveryState) return new Date(fromDeliveryState);

  const sellerDelivered = (sellerOrders || [])
    .map((leg) => leg?.deliveredAt)
    .filter(Boolean)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
  if (sellerDelivered) return new Date(sellerDelivered);

  if (isDeliveredOrder(order) && order?.updatedAt) {
    return new Date(order.updatedAt);
  }

  return null;
};

export const isWithinReturnWindow = (deliveredAt, windowHours = DEFAULT_RETURN_WINDOW_HOURS) => {
  if (!deliveredAt) return false;
  const hours = Number(windowHours);
  const safeHours = Number.isFinite(hours) && hours > 0 ? hours : DEFAULT_RETURN_WINDOW_HOURS;
  const deadline = new Date(deliveredAt).getTime() + safeHours * 60 * 60 * 1000;
  return Date.now() <= deadline;
};

export const computeReturnExpiryAt = (deliveredAt, windowHours = DEFAULT_RETURN_WINDOW_HOURS) => {
  if (!deliveredAt) return null;
  const hours = Number(windowHours);
  const safeHours = Number.isFinite(hours) && hours > 0 ? hours : DEFAULT_RETURN_WINDOW_HOURS;
  return new Date(new Date(deliveredAt).getTime() + safeHours * 60 * 60 * 1000);
};

export const buildReturnEligibilityMeta = ({
  order,
  sellerOrders = [],
  feeSettings = {},
  now = Date.now(),
}) => {
  const returnsEnabled = feeSettings?.returnsEnabled !== false;
  const returnWindowHours = Number(feeSettings?.returnWindowHours) || DEFAULT_RETURN_WINDOW_HOURS;
  const isQc = isQuickCommerceOrderType(order?.orderType);
  const delivered = isDeliveredOrder(order);
  const quickItems = getQuickItemsFromOrder(order);
  const deliveredAt = resolveOrderDeliveredAt(order, sellerOrders);
  const returnExpiryAt = computeReturnExpiryAt(deliveredAt, returnWindowHours);
  const expiryMs = returnExpiryAt ? returnExpiryAt.getTime() : 0;
  const remainingSeconds =
    deliveredAt && returnExpiryAt ? Math.max(0, Math.floor((expiryMs - now) / 1000)) : 0;
  const returnWindowExpired = Boolean(deliveredAt && remainingSeconds <= 0);
  const canReturn = Boolean(
    returnsEnabled &&
      isQc &&
      delivered &&
      quickItems.length > 0 &&
      deliveredAt &&
      !returnWindowExpired,
  );

  return {
    canReturn,
    returnsEnabled,
    returnWindowHours,
    returnExpiryAt: returnExpiryAt ? returnExpiryAt.toISOString() : null,
    deliveredAt: deliveredAt ? new Date(deliveredAt).toISOString() : null,
    remainingSeconds,
    remainingHours: Math.floor(remainingSeconds / 3600),
    returnWindowExpired,
  };
};

export const getQuickItemsFromOrder = (order) =>
  (Array.isArray(order?.items) ? order.items : []).filter((item) => String(item?.type || '').toLowerCase() === 'quick');

export const groupQuickItemsBySeller = (quickItems = []) => {
  // @deprecated for current policy — ONE ORDER = ONE SELLER. Kept for backward-compatible reads.
  const buckets = new Map();
  quickItems.forEach((item) => {
    const sellerId = String(item?.sourceId || '').trim();
    if (!sellerId || !mongoose.Types.ObjectId.isValid(sellerId)) return;
    if (!buckets.has(sellerId)) buckets.set(sellerId, []);
    buckets.get(sellerId).push(item);
  });
  return buckets;
};

export const buildReturnItemKey = (item) =>
  String(item?.itemId || item?.productId || item?.name || '').trim();

const normalizeReturnItemForResponse = (item = {}) => {
  const returnedQty = Number(item.returnedQty ?? item.quantity ?? 0);
  const unitPrice = Number(item.unitPrice ?? item.price ?? 0);
  const orderedQty = Number(item.orderedQty ?? item.quantity ?? returnedQty);
  return {
    itemId: item.itemId || '',
    productId: item.productId || item.itemId || '',
    variantId: item.variantId || '',
    name: item.name || '',
    quantity: returnedQty,
    returnedQty,
    orderedQty,
    remainingQty: Number(item.remainingQty ?? Math.max(0, orderedQty - returnedQty)),
    price: unitPrice,
    unitPrice,
    discountShare: Number(item.discountShare || 0),
    couponShare: Number(item.couponShare || 0),
    taxShare: Number(item.taxShare || 0),
    refundAmount: Number(
      item.refundAmount ?? roundMoney(unitPrice * returnedQty),
    ),
  };
};

const roundMoney = (value) => Math.round((Number(value) || 0) * 100) / 100;

const normalizeReturnPricingForResponse = (returnDoc = {}) => {
  const pricing = returnDoc?.pricing || {};
  const returnItems = Array.isArray(returnDoc?.returnItems) ? returnDoc.returnItems : [];
  const itemRefundSubtotal = roundMoney(
    returnItems.reduce((sum, item) => sum + Number(item.refundAmount ?? 0), 0),
  );
  const fallbackSubtotal = roundMoney(
    returnItems.reduce(
      (sum, item) => sum + Number(item.unitPrice ?? item.price ?? 0) * Number(item.returnedQty ?? item.quantity ?? 0),
      0,
    ),
  );

  const orderCouponTotal = Number(
    pricing.orderCouponTotal ?? returnDoc?.refundPricing?.orderCouponTotal ?? 0,
  );
  const orderTaxTotal = Number(
    pricing.orderTaxTotal ?? returnDoc?.refundPricing?.orderTaxTotal ?? 0,
  );
  const orderPaidTotal = Number(
    pricing.orderPaidTotal ?? returnDoc?.refundPricing?.orderPaidTotal ?? 0,
  );

  return {
    subtotal: Number(pricing.subtotal ?? fallbackSubtotal),
    couponShare: Number(pricing.couponShare || 0),
    taxShare: Number(pricing.taxShare || 0),
    discountShare: Number(pricing.discountShare || 0),
    deliveryFeeRefunded: Number(pricing.deliveryFeeRefunded || 0),
    platformFeeRefunded: Number(pricing.platformFeeRefunded || 0),
    finalRefundAmount: Number(
      pricing.finalRefundAmount ?? returnDoc?.returnRefundAmount ?? itemRefundSubtotal,
    ),
    pickupFee: Number(returnDoc?.returnDeliveryCommission || 0),
    orderCouponTotal,
    orderTaxTotal,
    orderPaidTotal,
    totalRefundedAmount: Number(pricing.totalRefundedAmount || 0),
    totalCouponRefunded: Number(pricing.totalCouponRefunded || 0),
    totalTaxRefunded: Number(pricing.totalTaxRefunded || 0),
    remainingCouponAmount: Number(pricing.remainingCouponAmount ?? Math.max(0, orderCouponTotal - Number(pricing.totalCouponRefunded || 0))),
    remainingTaxAmount: Number(pricing.remainingTaxAmount ?? Math.max(0, orderTaxTotal - Number(pricing.totalTaxRefunded || 0))),
    remainingRefundableAmount: Number(
      pricing.remainingRefundableAmount ?? Math.max(0, orderPaidTotal - Number(pricing.totalRefundedAmount || 0)),
    ),
  };
};

export const serializeReturnTimeline = (returnDoc) =>
  (Array.isArray(returnDoc?.returnHistory) ? returnDoc.returnHistory : [])
    .slice()
    .sort((a, b) => new Date(a?.at || 0).getTime() - new Date(b?.at || 0).getTime())
    .map((entry) => ({
      at: entry?.at || null,
      byRole: entry?.byRole || 'SYSTEM',
      byId: entry?.byId ? String(entry.byId) : null,
      action: entry?.action || '',
      fromStatus: entry?.fromStatus || '',
      toStatus: entry?.toStatus || '',
      note: entry?.note || '',
      metadata: entry?.metadata || {},
    }));

export const serializeReturnForCustomer = (returnDoc) => ({
  id: String(returnDoc?._id || ''),
  returnId: String(returnDoc?._id || ''),
  orderId: returnDoc?.orderId || '',
  sellerId: returnDoc?.sellerId ? String(returnDoc.sellerId) : '',
  returnStatus: returnDoc?.returnStatus || '',
  refundMethod: returnDoc?.refundMethod || '',
  refundStatus: returnDoc?.refundStatus || REFUND_STATUSES.NONE,
  returnReason: returnDoc?.returnReason || '',
  returnRejectedReason: returnDoc?.returnRejectedReason || '',
  returnRequestedAt: returnDoc?.returnRequestedAt || returnDoc?.createdAt || null,
  returnItems: Array.isArray(returnDoc?.returnItems)
    ? returnDoc.returnItems.map(normalizeReturnItemForResponse)
    : [],
  returnRefundAmount: Number(returnDoc?.returnRefundAmount || 0),
  returnDeliveryCommission: Number(returnDoc?.returnDeliveryCommission || 0),
  refundPricing: normalizeReturnPricingForResponse(returnDoc),
  pickupImages: Array.isArray(returnDoc?.pickupImages) ? returnDoc.pickupImages : [],
  dispatch: returnDoc?.dispatch
    ? {
        status: returnDoc.dispatch.status || 'unassigned',
        deliveryPartnerId: returnDoc.dispatch.deliveryPartnerId
          ? String(returnDoc.dispatch.deliveryPartnerId)
          : null,
      }
    : {},
  deliveryState: returnDoc?.deliveryState || {},
  qualityCheck: returnDoc?.qualityCheck || { status: 'pending' },
  timeline: serializeReturnTimeline(returnDoc),
  refundTransactionId: returnDoc?.refundTransactionId || '',
  refundReference: returnDoc?.refundReference || '',
  refundAuditLog: Array.isArray(returnDoc?.refundAuditLog) ? returnDoc.refundAuditLog : [],
  finance: returnDoc?.finance || {},
  updatedAt: returnDoc?.updatedAt || null,
});

export const serializeReturnForSeller = (returnDoc) => {
  const base = serializeReturnForCustomer(returnDoc);
  const timeline = (base.timeline || []).map((entry) => {
    if (!entry?.metadata?.payoutDetails) return entry;
    const { payoutDetails, ...restMetadata } = entry.metadata;
    return { ...entry, metadata: restMetadata };
  });

  return {
    ...base,
    timeline,
    customer: returnDoc?.customer || { name: 'Customer', phone: '' },
    sellerOtp: returnDoc?.sellerOtp || '',
    sellerInspectionImages: Array.isArray(returnDoc?.sellerInspectionImages)
      ? returnDoc.sellerInspectionImages
      : [],
    dispatch: returnDoc?.dispatch || {},
  };
};

export const serializeReturnForAdmin = (returnDoc) => ({
  ...serializeReturnForSeller(returnDoc),
  customerOtp: returnDoc?.customerOtp || '',
  parentOrderId: returnDoc?.parentOrderId ? String(returnDoc.parentOrderId) : '',
  userId: returnDoc?.userId ? String(returnDoc.userId) : '',
  pricing: normalizeReturnPricingForResponse(returnDoc),
  cumulativeReturnItems: Array.isArray(returnDoc?.cumulativeReturnItems)
    ? returnDoc.cumulativeReturnItems
    : [],
  returnDeliveryCommission: Number(returnDoc?.returnDeliveryCommission || 0),
  createdAt: returnDoc?.createdAt || null,
});
