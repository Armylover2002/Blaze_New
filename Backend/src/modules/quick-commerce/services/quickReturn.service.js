import mongoose from 'mongoose';
import { ValidationError, NotFoundError, ForbiddenError } from '../../../core/auth/errors.js';
import { logger } from '../../../utils/logger.js';
import { QuickOrder } from '../models/order.model.js';
import { SellerOrder } from '../seller/models/sellerOrder.model.js';
import { SellerReturn } from '../seller/models/sellerReturn.model.js';
import { getActiveFeeSettings } from '../admin/services/billing.service.js';
import { resolveQuickOrderCustomer } from '../utils/customer.helpers.js';
import { emitQuickCommerceStatusUpdate } from './quickStatusRealtime.service.js';
import {
  applyReturnSellerFinance,
  buildReturnRefundReference,
  confirmPendingReturnPayout,
  executeReturnCustomerRefund,
  passReturnQualityCheckAndRefund,
} from './quickReturnFinance.service.js';
import { tryAutoAssign } from '../../food/orders/services/order-dispatch.service.js';
import { DISPATCH_DOCUMENT_TYPES } from '../utils/dispatchDocument.constants.js';
import { stampReturnOtps } from '../utils/returnPickup.helpers.js';
import {
  buildPriorReturnedQuantityMap,
  buildReturnItemsWithRefundCalculation,
  hasReturnableQuantityRemaining,
  normalizeReturnRequestItems,
} from '../utils/returnRefundCalculation.helpers.js';
import {
  ACTIVE_RETURN_STATUSES,
  DEFAULT_RETURN_WINDOW_HOURS,
  REFUND_METHODS,
  REFUND_STATUSES,
  RETURN_STATUSES,
  TERMINAL_RETURN_STATUSES,
  buildReturnItemKey,
  generateReturnOtp,
  getQuickItemsFromOrder,
  groupQuickItemsBySeller,
  isDeliveredOrder,
  isQuickCommerceOrderType,
  isWithinReturnWindow,
  buildReturnEligibilityMeta,
  resolveOrderDeliveredAt,
  serializeReturnForCustomer,
  serializeReturnForAdmin,
} from '../utils/return.helpers.js';

const buildOrderIdentityQuery = (rawOrderId) => {
  const orderId = String(rawOrderId || '').trim();
  if (!orderId) return null;
  const clauses = [{ orderId }];
  if (mongoose.isValidObjectId(orderId)) clauses.unshift({ _id: orderId });
  return { $or: clauses };
};

const buildReturnHistoryEntry = ({
  byRole = 'SYSTEM',
  byId = null,
  action = '',
  fromStatus = '',
  toStatus = '',
  note = '',
  metadata = {},
}) => ({
  at: new Date(),
  byRole,
  byId: byId && mongoose.Types.ObjectId.isValid(byId) ? byId : undefined,
  action,
  fromStatus,
  toStatus,
  note,
  metadata,
});

export const appendReturnHistory = (returnDoc, entry) => {
  if (!returnDoc) return returnDoc;
  if (!Array.isArray(returnDoc.returnHistory)) returnDoc.returnHistory = [];
  returnDoc.returnHistory.push(buildReturnHistoryEntry(entry));
  return returnDoc;
};

const loadPriorReturnedQuantityMap = async (orderId) => {
  const existingReturn = await SellerReturn.findOne({ orderId: String(orderId || '').trim() }).lean();
  if (!existingReturn) return new Map();
  return buildPriorReturnedQuantityMap([existingReturn]);
};

const resetReturnDocForNewCycle = (
  returnDoc,
  {
    userId,
    reason,
    method,
    returnItems,
    pricing,
    returnRefundAmount,
    returnDeliveryCommission,
    payoutDetails = {},
  },
) => {
  const previousStatus = returnDoc.returnStatus;
  returnDoc.returnStatus = RETURN_STATUSES.REQUESTED;
  returnDoc.returnReason = reason;
  returnDoc.returnItems = returnItems;
  returnDoc.pricing = pricing;
  returnDoc.returnRefundAmount = returnRefundAmount;
  returnDoc.returnDeliveryCommission = returnDeliveryCommission;
  returnDoc.refundMethod = method;
  returnDoc.refundStatus = REFUND_STATUSES.NONE;
  returnDoc.refundTransactionId = '';
  returnDoc.refundReference = '';
  returnDoc.returnRejectedReason = '';
  returnDoc.finance = {
    sellerLedgerApplied: false,
    sellerLedgerAppliedAt: null,
    settlementMode: '',
    preSettlementDeducted: 0,
    postSettlementDebited: 0,
    pickupFeeDebited: 0,
  };
  returnDoc.dispatch = {
    modeAtCreation: 'auto',
    status: 'unassigned',
    deliveryPartnerId: null,
    offeredTo: [],
  };
  returnDoc.deliveryState = {
    currentPhase: 'en_route_to_pickup',
    status: '',
    reachedPickupAt: null,
    pickedUpAt: null,
    reachedDropAt: null,
    completedAt: null,
  };
  returnDoc.qualityCheck = {
    status: 'pending',
    notes: '',
    checkedAt: null,
    checkedByRole: '',
    checkedById: null,
  };
  returnDoc.customerOtp = '';
  returnDoc.sellerOtp = '';
  returnDoc.pickupImages = [];
  returnDoc.pickupImageEntries = [];
  appendReturnHistory(returnDoc, {
    byRole: 'USER',
    byId: userId,
    action: 'RETURN_REOPENED',
    fromStatus: previousStatus,
    toStatus: RETURN_STATUSES.REQUESTED,
    note: reason,
    metadata: {
      refundMethod: method,
      payoutDetails: method === 'wallet' ? {} : payoutDetails,
      itemCount: returnItems.length,
      returnRefundAmount,
    },
  });
  return returnDoc;
};

const validateRefundMethodSelection = (refundMethod, { userId, payoutDetails = {} } = {}) => {
  const method = String(refundMethod || '').trim().toLowerCase();
  if (!REFUND_METHODS.has(method)) {
    throw new ValidationError('refundMethod must be one of: wallet, upi, bank');
  }

  if (method === 'wallet' && !userId) {
    throw new ValidationError('Wallet refunds require a logged-in customer account');
  }

  if (method === 'upi') {
    const upiId = String(payoutDetails?.upiId || '').trim();
    if (!upiId) throw new ValidationError('upiId is required when refundMethod is upi');
  }

  if (method === 'bank') {
    const accountHolderName = String(payoutDetails?.accountHolderName || '').trim();
    const accountNumber = String(payoutDetails?.accountNumber || '').trim();
    const ifscCode = String(payoutDetails?.ifscCode || '').trim();
    if (!accountHolderName || !accountNumber || !ifscCode) {
      throw new ValidationError('bank account details are required when refundMethod is bank');
    }
  }

  return method;
};

const loadReturnEligibleOrder = async ({ orderId, userId }) => {
  const identityQuery = buildOrderIdentityQuery(orderId);
  if (!identityQuery) throw new ValidationError('orderId is required');
  if (!userId) throw new ForbiddenError('Login is required to request a return');

  const order = await QuickOrder.findOne({
    ...identityQuery,
    orderType: { $in: ['quick', 'mixed'] },
    userId,
  }).lean();

  if (!order) throw new NotFoundError('Order not found');
  if (!isQuickCommerceOrderType(order.orderType)) {
    throw new ValidationError('Returns are only available for Quick Commerce orders');
  }
  if (!isDeliveredOrder(order)) {
    throw new ValidationError('Returns can only be requested for delivered orders');
  }

  const sellerOrders = await SellerOrder.find({
    orderId: order.orderId,
    orderType: { $in: ['quick', 'mixed'] },
  }).lean();

  const deliveredAt = resolveOrderDeliveredAt(order, sellerOrders);
  const feeSettings = await getActiveFeeSettings();
  const returnWindowHours = Number(feeSettings?.returnWindowHours) || DEFAULT_RETURN_WINDOW_HOURS;

  if (feeSettings?.returnsEnabled === false) {
    throw new ValidationError('Returns are currently disabled', 'RETURNS_DISABLED');
  }

  if (!isWithinReturnWindow(deliveredAt, returnWindowHours)) {
    const windowDays = Math.max(1, Math.round(returnWindowHours / 24));
    throw new ValidationError(
      `Return window has expired. Returns were available for ${windowDays} day${windowDays === 1 ? '' : 's'} after delivery.`,
      'RETURN_WINDOW_EXPIRED',
    );
  }

  return { order, sellerOrders, feeSettings, deliveredAt };
};

const findActiveReturnsForOrder = async (orderId) =>
  SellerReturn.find({
    orderId,
    returnStatus: { $in: Array.from(ACTIVE_RETURN_STATUSES) },
  }).lean();

export const createQuickCommerceReturnRequest = async ({
  orderId,
  userId,
  reason = '',
  refundMethod,
  items = [],
  pickupImages = [],
  payoutDetails = {},
}) => {
  const normalizedReason = String(reason || '').trim();
  if (normalizedReason.length < 3) {
    throw new ValidationError('Return reason must be at least 3 characters');
  }

  const method = validateRefundMethodSelection(refundMethod, { userId, payoutDetails });
  const { order, sellerOrders, feeSettings } = await loadReturnEligibleOrder({ orderId, userId });

  const quickItems = getQuickItemsFromOrder(order);
  if (!quickItems.length) {
    throw new ValidationError('This order has no Quick Commerce items eligible for return');
  }

  const activeReturns = await findActiveReturnsForOrder(order.orderId);
  const activeSellerIds = new Set(activeReturns.map((row) => String(row.sellerId)));

  const sellerBuckets = groupQuickItemsBySeller(quickItems);
  if (sellerBuckets.size > 1) {
    throw new ValidationError(
      'This order contains items from multiple sellers. Returns are supported for one seller per order.',
    );
  }

  const priorReturnedMap = await loadPriorReturnedQuantityMap(order.orderId);
  const normalizedItems = normalizeReturnRequestItems(items, quickItems, priorReturnedMap);

  const requestedBySeller = new Map();

  normalizedItems.forEach((requestedItem) => {
    const key = String(requestedItem?.itemId || '').trim();
    const matchedItem = quickItems.find((item) => buildReturnItemKey(item) === key);
    if (!matchedItem) {
      throw new ValidationError(`Item ${key} is not a Quick Commerce item on this order`);
    }
    const sellerId = String(matchedItem?.sourceId || '').trim();
    if (!requestedBySeller.has(sellerId)) requestedBySeller.set(sellerId, []);
    requestedBySeller.get(sellerId).push(requestedItem);
  });

  if (!requestedBySeller.size) {
    throw new ValidationError('At least one Quick Commerce item must be selected for return');
  }
  if (requestedBySeller.size > 1) {
    throw new ValidationError('Return requests can only include items from one seller per order.');
  }

  const customer = resolveQuickOrderCustomer(order);
  const returnDeliveryCommission = Number(feeSettings?.returnDeliveryCommission || 0);
  const createdReturns = [];
  let createdNew = false;

  for (const [sellerId, sellerRequestedItems] of requestedBySeller.entries()) {
    // @deprecated multi-seller loop — current policy allows exactly one seller per order/return.
    if (activeSellerIds.has(sellerId)) {
      const existing = activeReturns.find((row) => String(row.sellerId) === sellerId);
      if (existing) {
        createdReturns.push(serializeReturnForCustomer(existing));
        continue;
      }
    }

    const sellerItems = sellerBuckets.get(sellerId) || [];
    if (!sellerItems.length) {
      throw new ValidationError(`Seller ${sellerId} has no returnable items on this order`);
    }

    const existing = await SellerReturn.findOne({ sellerId, orderId: order.orderId });

    const { returnItems, pricing, returnRefundAmount } = buildReturnItemsWithRefundCalculation({
      order,
      quickItems: sellerItems,
      requestedItems: sellerRequestedItems,
      priorReturnedMap,
      existingReturnDoc: existing ? existing.toObject() : null,
    });

    if (existing && !TERMINAL_RETURN_STATUSES.has(existing.returnStatus)) {
      createdReturns.push(serializeReturnForCustomer(existing.toObject()));
      continue;
    }

    if (existing && TERMINAL_RETURN_STATUSES.has(existing.returnStatus)) {
      if (existing.returnStatus === RETURN_STATUSES.REFUND_COMPLETED) {
        if (!hasReturnableQuantityRemaining(sellerItems, priorReturnedMap)) {
          throw new ValidationError('All items on this order have already been returned and refunded');
        }
      }

      resetReturnDocForNewCycle(existing, {
        userId,
        reason: normalizedReason,
        method,
        returnItems,
        pricing,
        returnRefundAmount,
        returnDeliveryCommission,
        payoutDetails,
      });
      await existing.save();
      createdNew = true;
      createdReturns.push(serializeReturnForCustomer(existing.toObject()));
      continue;
    }

    const returnDoc = new SellerReturn({
      sellerId,
      orderId: order.orderId,
      parentOrderId: order._id,
      userId,
      customer: {
        name: customer?.name || 'Customer',
        phone: customer?.phone || '',
      },
      returnStatus: RETURN_STATUSES.REQUESTED,
      returnReason: normalizedReason,
      returnItems,
      pickupImages: Array.isArray(pickupImages) ? pickupImages.slice(0, 8) : [],
      pricing,
      returnRefundAmount,
      returnDeliveryCommission,
      refundMethod: method,
      refundStatus: REFUND_STATUSES.NONE,
      refundTransactionId: '',
      refundReference: '',
      customerOtp: '',
      sellerOtp: '',
      dispatch: {
        modeAtCreation: 'auto',
        status: 'unassigned',
        deliveryPartnerId: null,
        offeredTo: [],
      },
      qualityCheck: {
        status: 'pending',
        notes: '',
        checkedAt: null,
        checkedByRole: '',
        checkedById: null,
      },
      returnHistory: [
        buildReturnHistoryEntry({
          byRole: 'USER',
          byId: userId,
          action: 'RETURN_REQUESTED',
          fromStatus: '',
          toStatus: RETURN_STATUSES.REQUESTED,
          note: normalizedReason,
          metadata: {
            refundMethod: method,
            payoutDetails: method === 'wallet' ? {} : payoutDetails,
            itemCount: returnItems.length,
          },
        }),
      ],
    });

    await returnDoc.save();
    createdNew = true;
    createdReturns.push(serializeReturnForCustomer(returnDoc.toObject()));
  }

  try {
    const parent = await QuickOrder.findById(order._id);
    if (parent) {
      parent.returnStatus = RETURN_STATUSES.REQUESTED;
      await parent.save({ validateBeforeSave: false });
      await emitQuickCommerceStatusUpdate(parent, { source: 'return_requested' });
    }
  } catch (error) {
    logger.warn(`createQuickCommerceReturnRequest: parent mirror failed: ${error?.message || error}`);
  }

  return {
    alreadyExists: !createdNew && createdReturns.length > 0,
    returns: createdReturns,
    message: createdNew
      ? 'Return request submitted successfully'
      : 'Return request already exists for the selected seller(s)',
  };
};

export const resolveReturnEligibilityForOrder = async (order) => {
  if (!order || !isQuickCommerceOrderType(order.orderType)) {
    return buildReturnEligibilityMeta({ order: order || {}, feeSettings: {} });
  }

  const sellerOrders = await SellerOrder.find({
    orderId: order.orderId,
    orderType: { $in: ['quick', 'mixed'] },
  }).lean();
  const feeSettings = await getActiveFeeSettings();
  return buildReturnEligibilityMeta({ order, sellerOrders, feeSettings });
};

export const getQuickCommerceReturnStatus = async ({ orderId, userId }) => {
  const identityQuery = buildOrderIdentityQuery(orderId);
  if (!identityQuery) throw new ValidationError('orderId is required');
  if (!userId) throw new ForbiddenError('Login is required to view return status');

  const order = await QuickOrder.findOne({
    ...identityQuery,
    orderType: { $in: ['quick', 'mixed'] },
    userId,
  }).lean();

  if (!order) throw new NotFoundError('Order not found');

  const returns = await SellerReturn.find({ orderId: order.orderId, userId })
    .sort({ returnRequestedAt: -1 })
    .lean();

  const returnEligibility = await resolveReturnEligibilityForOrder(order);

  return {
    orderId: order.orderId,
    parentReturnStatus: order.returnStatus || '',
    returns: returns.map(serializeReturnForCustomer),
    ...returnEligibility,
    returnEligibility,
  };
};

export const cancelQuickCommerceReturnRequest = async ({
  orderId,
  userId,
  reason = '',
  // @deprecated — ignored under ONE ORDER = ONE SELLERRETURN policy; kept for backward compatibility.
  returnId = '',
  sellerId = '',
}) => {
  void returnId;
  void sellerId;

  const identityQuery = buildOrderIdentityQuery(orderId);
  if (!identityQuery) throw new ValidationError('orderId is required');
  if (!userId) throw new ForbiddenError('Login is required to cancel a return');

  const order = await QuickOrder.findOne({
    ...identityQuery,
    orderType: { $in: ['quick', 'mixed'] },
    userId,
  });

  if (!order) throw new NotFoundError('Order not found');

  const cancellableStatuses = [
    RETURN_STATUSES.REQUESTED,
    RETURN_STATUSES.APPROVED,
    RETURN_STATUSES.PICKUP_ASSIGNED,
  ];

  const filter = {
    orderId: order.orderId,
    userId,
    returnStatus: { $in: cancellableStatuses },
  };

  const activeReturns = await SellerReturn.find(filter);

  if (!activeReturns.length) {
    const cancelled = await SellerReturn.find({
      orderId: order.orderId,
      userId,
      returnStatus: RETURN_STATUSES.CANCELLED,
    }).lean();
    if (cancelled.length) {
      return {
        alreadyCancelled: true,
        returns: cancelled.map(serializeReturnForCustomer),
        message: 'Return request is already cancelled',
      };
    }
    throw new ValidationError('No cancellable return request found for this order');
  }

  const note = String(reason || 'Return cancelled by customer').trim();
  const updatedReturns = [];

  for (const returnDoc of activeReturns) {
    const previousStatus = returnDoc.returnStatus;
    returnDoc.returnStatus = RETURN_STATUSES.CANCELLED;
    returnDoc.refundStatus = REFUND_STATUSES.NONE;
    if (['unassigned', 'assigned', 'accepted'].includes(returnDoc.dispatch?.status)) {
      returnDoc.dispatch.status = 'cancelled';
      returnDoc.dispatch.deliveryPartnerId = null;
    }
    appendReturnHistory(returnDoc, {
      byRole: 'USER',
      byId: userId,
      action: 'RETURN_CANCELLED',
      fromStatus: previousStatus,
      toStatus: RETURN_STATUSES.CANCELLED,
      note,
    });
    await returnDoc.save();
    updatedReturns.push(serializeReturnForCustomer(returnDoc.toObject()));
  }

  const remainingActive = await SellerReturn.countDocuments({
    orderId: order.orderId,
    userId,
    returnStatus: { $in: [...ACTIVE_RETURN_STATUSES] },
  });

  if (remainingActive === 0) {
    order.returnStatus = RETURN_STATUSES.CANCELLED;
    await order.save({ validateBeforeSave: false });
  }
  await emitQuickCommerceStatusUpdate(order, { source: 'return_cancelled' });

  return {
    alreadyCancelled: false,
    returns: updatedReturns,
    message: 'Return request cancelled successfully',
  };
};

export const recordSellerReturnDecision = async ({
  sellerId,
  orderId,
  decision,
  reason = '',
  actorRole = 'SELLER',
  actorId = null,
}) => {
  const returnDoc = await SellerReturn.findOne({ sellerId, orderId });
  if (!returnDoc) throw new NotFoundError('Return request not found');

  if (returnDoc.returnStatus !== RETURN_STATUSES.REQUESTED) {
    return returnDoc;
  }

  const nextStatus = decision === 'approve' ? RETURN_STATUSES.APPROVED : RETURN_STATUSES.REJECTED;
  const previousStatus = returnDoc.returnStatus;

  returnDoc.returnStatus = nextStatus;
  if (decision === 'reject') {
    returnDoc.returnRejectedReason = String(reason || '').trim();
    returnDoc.refundStatus = REFUND_STATUSES.NONE;
  } else {
    returnDoc.returnRejectedReason = '';
    stampReturnOtps(returnDoc);
  }

  appendReturnHistory(returnDoc, {
    byRole: actorRole,
    byId: actorId || sellerId,
    action: decision === 'approve' ? 'RETURN_APPROVED' : 'RETURN_REJECTED',
    fromStatus: previousStatus,
    toStatus: nextStatus,
    note: String(reason || '').trim(),
  });

  await returnDoc.save();
  return returnDoc;
};

export const requestSellerReturnPickup = async ({ sellerId, orderId, actorId = null }) => {
  const returnDoc = await SellerReturn.findOne({ sellerId, orderId });
  if (!returnDoc) throw new NotFoundError('Return request not found');

  const allowedStatuses = new Set([RETURN_STATUSES.APPROVED, RETURN_STATUSES.PICKUP_ASSIGNED]);
  if (!allowedStatuses.has(returnDoc.returnStatus)) {
    throw new ValidationError('Return must be approved before requesting pickup');
  }

  if (['accepted', 'assigned'].includes(returnDoc.dispatch?.status)) {
    return {
      alreadyRequested: true,
      return: returnDoc.toObject(),
      message: 'Return pickup dispatch is already active',
    };
  }

  if (returnDoc.dispatch?.status === 'completed') {
    throw new ValidationError('Return pickup has already been completed');
  }

  const previousStatus = returnDoc.returnStatus;

  returnDoc.dispatch = {
    ...(returnDoc.dispatch?.toObject?.() || returnDoc.dispatch || {}),
    status: 'unassigned',
    deliveryPartnerId: null,
    assignedAt: null,
    acceptedAt: null,
    offeredTo: [],
  };

  appendReturnHistory(returnDoc, {
    byRole: 'SELLER',
    byId: actorId || sellerId,
    action: 'RETURN_PICKUP_REQUESTED',
    fromStatus: previousStatus,
    toStatus: RETURN_STATUSES.PICKUP_ASSIGNED,
    note: 'Seller requested return pickup dispatch',
  });

  returnDoc.returnStatus = RETURN_STATUSES.PICKUP_ASSIGNED;
  await returnDoc.save();

  const dispatchResult = await tryAutoAssign(String(returnDoc._id), {
    documentType: DISPATCH_DOCUMENT_TYPES.SELLER_RETURN,
  });

  return {
    alreadyRequested: false,
    return: returnDoc.toObject(),
    notifiedCount: dispatchResult?.notifiedCount || 0,
    message: 'Return pickup dispatch started',
  };
};

export const getReturnPickupOtpForCustomer = async ({ orderId, userId, sellerId = '' }) => {
  const identityQuery = buildOrderIdentityQuery(orderId);
  if (!identityQuery) throw new ValidationError('orderId is required');
  if (!userId) throw new ForbiddenError('Login is required');

  const order = await QuickOrder.findOne({
    ...identityQuery,
    orderType: { $in: ['quick', 'mixed'] },
    userId,
  }).select('_id orderId').lean();

  if (!order) throw new NotFoundError('Order not found');

  const filter = { orderId: order.orderId, userId };
  if (sellerId && mongoose.Types.ObjectId.isValid(sellerId)) {
    filter.sellerId = sellerId;
  }

  const returnDoc = await SellerReturn.findOne(filter).select(
    '+customerOtp customerOtpExpiresAt returnStatus sellerId',
  );

  if (!returnDoc) throw new NotFoundError('Return request not found');

  const activePickupStatuses = new Set([
    RETURN_STATUSES.APPROVED,
    RETURN_STATUSES.PICKUP_ASSIGNED,
    RETURN_STATUSES.IN_TRANSIT,
  ]);

  if (!activePickupStatuses.has(returnDoc.returnStatus)) {
    throw new ValidationError('Return pickup OTP is not active for this return');
  }

  const expiresAt = returnDoc.customerOtpExpiresAt ? new Date(returnDoc.customerOtpExpiresAt) : null;
  if (expiresAt && Date.now() > expiresAt.getTime()) {
    throw new ValidationError('Return pickup OTP has expired. Contact support or the seller.');
  }

  const otp = String(returnDoc.customerOtp || '').trim();
  if (!otp) {
    throw new ValidationError('Return pickup OTP is not configured yet');
  }

  return {
    orderId: order.orderId,
    returnId: String(returnDoc._id),
    sellerId: String(returnDoc.sellerId || ''),
    otp,
    expiresAt,
    returnStatus: returnDoc.returnStatus,
  };
};

const extractPayoutDetailsFromReturn = (returnDoc) => {
  const history = Array.isArray(returnDoc?.returnHistory) ? returnDoc.returnHistory : [];
  const requestEntry = history.find((entry) => entry?.action === 'RETURN_REQUESTED');
  return requestEntry?.metadata?.payoutDetails || {};
};

export const listQuickCommerceReturnsForAdmin = async ({
  page = 1,
  limit = 20,
  status = '',
  search = '',
  sellerId = '',
} = {}) => {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
  const filter = {};

  const normalizedStatus = String(status || '').trim();
  if (normalizedStatus) filter.returnStatus = normalizedStatus;

  if (sellerId && mongoose.Types.ObjectId.isValid(sellerId)) {
    filter.sellerId = sellerId;
  }

  const normalizedSearch = String(search || '').trim();
  if (normalizedSearch) {
    filter.$or = [
      { orderId: new RegExp(normalizedSearch, 'i') },
      { 'customer.name': new RegExp(normalizedSearch, 'i') },
      { 'customer.phone': new RegExp(normalizedSearch, 'i') },
    ];
  }

  const [items, total] = await Promise.all([
    SellerReturn.find(filter)
      .sort({ returnRequestedAt: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .lean(),
    SellerReturn.countDocuments(filter),
  ]);

  return {
    items: items.map(serializeReturnForAdmin),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      pages: Math.ceil(total / safeLimit) || 1,
    },
  };
};

export const getQuickCommerceReturnForAdmin = async (returnId) => {
  if (!returnId) throw new ValidationError('returnId is required');

  let returnDoc = null;
  if (mongoose.isValidObjectId(returnId)) {
    returnDoc = await SellerReturn.findById(returnId).lean();
  }
  if (!returnDoc) {
    returnDoc = await SellerReturn.findOne({ orderId: String(returnId).trim() })
      .sort({ returnRequestedAt: -1 })
      .lean();
  }

  if (!returnDoc) throw new NotFoundError('Return request not found');
  return serializeReturnForAdmin(returnDoc);
};

export const completeQuickCommerceReturnRefund = async ({
  returnId,
  actorId = null,
  actorRole = 'ADMIN',
  note = '',
  payoutReference = '',
} = {}) => {
  if (!returnId) throw new ValidationError('returnId is required');

  const returnDoc = await SellerReturn.findById(returnId);
  if (!returnDoc) throw new NotFoundError('Return request not found');

  if (returnDoc.returnStatus === RETURN_STATUSES.REFUND_COMPLETED) {
    return {
      alreadyProcessed: true,
      return: serializeReturnForAdmin(returnDoc.toObject()),
      message: 'Refund already completed for this return',
    };
  }

  if (returnDoc.returnStatus !== RETURN_STATUSES.RETURNED) {
    throw new ValidationError('Refund can only be processed after items are marked as returned');
  }

  if (returnDoc.refundStatus === REFUND_STATUSES.COMPLETED && returnDoc.refundTransactionId) {
    return {
      alreadyProcessed: true,
      return: serializeReturnForAdmin(returnDoc.toObject()),
      message: 'Refund already completed for this return',
    };
  }

  const order = await QuickOrder.findOne({
    orderId: returnDoc.orderId,
    orderType: { $in: ['quick', 'mixed'] },
  });

  if (!order) throw new NotFoundError('Parent order not found for return refund');

  const payoutDetails = extractPayoutDetailsFromReturn(returnDoc);
  const previousStatus = returnDoc.returnStatus;
  const previousRefundStatus = returnDoc.refundStatus;

  if (!returnDoc.refundReference) {
    returnDoc.refundReference = buildReturnRefundReference(returnDoc);
  }
  if (payoutReference) {
    returnDoc.refundReference = String(payoutReference).trim();
  }

  appendReturnHistory(returnDoc, {
    byRole: actorRole,
    byId: actorId,
    action: 'REFUND_INITIATED',
    fromStatus: previousStatus,
    toStatus: previousStatus,
    note: note || 'Return refund initiated',
    metadata: { refundMethod: returnDoc.refundMethod, refundReference: returnDoc.refundReference },
  });
  await returnDoc.save();

  const refundExecution = await executeReturnCustomerRefund(returnDoc, order, {
    actorId,
    actorRole,
    note,
    payoutDetails,
  });

  if (refundExecution.pending) {
    appendReturnHistory(returnDoc, {
      byRole: actorRole,
      byId: actorId,
      action: 'REFUND_QUEUED',
      fromStatus: previousStatus,
      toStatus: previousStatus,
      note: refundExecution.refundResult?.message || 'Refund queued for payout',
      metadata: {
        refundMethod: returnDoc.refundMethod,
        refundTransactionId: returnDoc.refundTransactionId,
        refundReference: returnDoc.refundReference,
        payoutDetails,
      },
    });
    await returnDoc.save();

    return {
      alreadyProcessed: false,
      pending: true,
      return: serializeReturnForAdmin(returnDoc.toObject()),
      message: refundExecution.refundResult?.message || 'Refund queued for manual payout',
    };
  }

  if (!refundExecution.processed) {
    appendReturnHistory(returnDoc, {
      byRole: actorRole,
      byId: actorId,
      action: 'REFUND_FAILED',
      fromStatus: previousStatus,
      toStatus: previousStatus,
      note: refundExecution.refundResult?.message || 'Refund processing failed',
      metadata: { reason: refundExecution.refundResult?.reason || 'unknown', previousRefundStatus },
    });
    await returnDoc.save();
    throw new ValidationError(refundExecution.refundResult?.message || 'Refund could not be processed');
  }

  await applyReturnSellerFinance(returnDoc, {
    actorId,
    actorRole,
    reason: note || 'Return refund seller finance',
  });

  appendReturnHistory(returnDoc, {
    byRole: actorRole,
    byId: actorId,
    action: 'REFUND_COMPLETED',
    fromStatus: previousStatus,
    toStatus: RETURN_STATUSES.REFUND_COMPLETED,
    note: refundExecution.refundResult?.message || note || 'Refund completed',
    metadata: {
      refundMethod: refundExecution.refundResult?.method,
      amount: refundExecution.refundResult?.amount,
      refundTransactionId: returnDoc.refundTransactionId,
      refundReference: returnDoc.refundReference,
      previousRefundStatus,
      finance: returnDoc.finance,
    },
  });
  await returnDoc.save();

  try {
    order.returnStatus = RETURN_STATUSES.REFUND_COMPLETED;
    await order.save({ validateBeforeSave: false });
    await emitQuickCommerceStatusUpdate(order, { source: 'return_refund_completed' });
  } catch (error) {
    logger.warn(`completeQuickCommerceReturnRefund: parent mirror failed: ${error?.message || error}`);
  }

  return {
    alreadyProcessed: false,
    pending: false,
    return: serializeReturnForAdmin(returnDoc.toObject()),
    message: refundExecution.refundResult?.message || 'Refund completed successfully',
  };
};
