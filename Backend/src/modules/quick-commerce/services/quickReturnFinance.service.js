import mongoose from 'mongoose';
import { ValidationError, NotFoundError } from '../../../core/auth/errors.js';
import { logger } from '../../../utils/logger.js';
import { SellerReturn } from '../seller/models/sellerReturn.model.js';
import { getActiveFeeSettings } from '../admin/services/billing.service.js';
import { REFUND_STATUSES, RETURN_STATUSES } from '../utils/return.helpers.js';
import { processQuickCommerceReturnRefund } from './quickRefund.service.js';
import { appendCumulativeReturnItems } from '../utils/returnRefundCalculation.helpers.js';
import {
  LEDGER_TYPES,
  deductOrderPaymentBeforeSettlement,
  getSellerUnsettledCreditSummary,
  recordSellerLedgerEntry,
  reconcileSellerLedgerBalance,
} from './sellerLedger.service.js';

const num = (value) => Number(value || 0);

export const buildReturnRefundReference = (returnDoc) => {
  const returnId = String(returnDoc?._id || '');
  const method = String(returnDoc?.refundMethod || 'unknown').toLowerCase();
  return `QC-RET-${returnId.slice(-8).toUpperCase()}-${method}`;
};

export const appendReturnRefundAudit = (returnDoc, entry) => {
  if (!returnDoc) return returnDoc;
  if (!Array.isArray(returnDoc.refundAuditLog)) returnDoc.refundAuditLog = [];
  returnDoc.refundAuditLog.push({
    at: new Date(),
    action: entry?.action || '',
    refundStatus: entry?.refundStatus || returnDoc.refundStatus || REFUND_STATUSES.NONE,
    refundMethod: entry?.refundMethod || returnDoc.refundMethod || '',
    amount: num(entry?.amount ?? returnDoc.returnRefundAmount),
    refundTransactionId: entry?.refundTransactionId || returnDoc.refundTransactionId || '',
    refundReference: entry?.refundReference || returnDoc.refundReference || '',
    actorId: entry?.actorId && mongoose.Types.ObjectId.isValid(entry.actorId) ? entry.actorId : undefined,
    actorRole: entry?.actorRole || 'SYSTEM',
    note: entry?.note || '',
    metadata: entry?.metadata || {},
  });
  return returnDoc;
};

const resolveReturnPickupFee = async (returnDoc) => {
  const fromReturn = num(returnDoc?.returnDeliveryCommission);
  if (fromReturn > 0) return fromReturn;
  const settings = await getActiveFeeSettings();
  return Math.max(0, num(settings?.returnPickupFee) || num(settings?.returnDeliveryCommission));
};

export const applyReturnSellerFinance = async (
  returnDoc,
  { actorId = null, actorRole = 'SYSTEM', reason = 'Return seller finance adjustment' } = {},
) => {
  if (!returnDoc) throw new ValidationError('Return document is required');

  if (returnDoc?.finance?.sellerLedgerApplied) {
    return {
      alreadyApplied: true,
      finance: returnDoc.finance,
    };
  }

  const sellerId = returnDoc.sellerId;
  const orderId = String(returnDoc.orderId || '');
  const returnId = returnDoc._id;
  const refundAmount = num(returnDoc.returnRefundAmount);
  if (refundAmount < 0) {
    throw new ValidationError('Return refund amount cannot be negative');
  }
  const pickupFee = await resolveReturnPickupFee(returnDoc);

  await reconcileSellerLedgerBalance(sellerId);

  const summary = await getSellerUnsettledCreditSummary(sellerId);
  let preSettlementDeducted = 0;
  let postSettlementDebited = 0;
  let settlementMode = '';

  if (refundAmount > 0) {
    const preSettlementAttempt = Math.min(refundAmount, summary.unwithdrawnCredits);
    if (preSettlementAttempt > 0) {
      const preResult = await deductOrderPaymentBeforeSettlement({
        sellerId,
        orderId,
        returnId,
        deductAmount: preSettlementAttempt,
        actorId,
        actorRole,
        reason,
      });
      preSettlementDeducted = num(preResult.deducted);
    }

    const remaining = Math.max(0, refundAmount - preSettlementDeducted);
    if (remaining > 0) {
      const postResult = await recordSellerLedgerEntry({
        sellerId,
        type: LEDGER_TYPES.RETURN_REFUND,
        amount: -remaining,
        referenceId: `return_refund_post:${returnId}`,
        orderId,
        returnId,
        reason: `${reason} (post-settlement recovery)`,
        actorId,
        actorRole,
        status: 'Settled',
        settlementState: 'settled',
        metadata: { mode: 'post_settlement', refundAmount: remaining },
      });
      postSettlementDebited = Math.abs(num(postResult.entry?.amount));
    }

    if (preSettlementDeducted > 0 && postSettlementDebited > 0) settlementMode = 'mixed';
    else if (preSettlementDeducted > 0) settlementMode = 'pre_settlement';
    else if (postSettlementDebited > 0) settlementMode = 'post_settlement';
  }

  let pickupFeeDebited = 0;
  if (pickupFee > 0) {
    const feeResult = await recordSellerLedgerEntry({
      sellerId,
      type: LEDGER_TYPES.RETURN_PICKUP_FEE,
      amount: -pickupFee,
      referenceId: `return_pickup_fee:${returnId}`,
      orderId,
      returnId,
      reason: 'Return pickup rider fee (admin pays rider, seller debited)',
      actorId,
      actorRole,
      status: 'Settled',
      settlementState: 'settled',
      metadata: { pickupFee },
    });
    pickupFeeDebited = Math.abs(num(feeResult.entry?.amount));
  }

  const financeSnapshot = {
    sellerLedgerApplied: true,
    sellerLedgerAppliedAt: new Date(),
    settlementMode,
    preSettlementDeducted,
    postSettlementDebited,
    pickupFeeDebited,
  };

  const persisted = await SellerReturn.findOneAndUpdate(
    {
      _id: returnId,
      'finance.sellerLedgerApplied': { $ne: true },
    },
    { $set: { finance: financeSnapshot } },
    { new: true },
  );

  if (!persisted) {
    const current = await SellerReturn.findById(returnId).lean();
    return {
      alreadyApplied: true,
      finance: current?.finance || financeSnapshot,
      preSettlementDeducted,
      postSettlementDebited,
      pickupFeeDebited,
    };
  }

  returnDoc.finance = persisted.finance;

  logger.info(
    `[ReturnFinance] Applied seller finance for return ${returnId}: pre=${preSettlementDeducted}, post=${postSettlementDebited}, pickup=${pickupFeeDebited}`,
  );

  return {
    alreadyApplied: false,
    finance: returnDoc.finance,
    preSettlementDeducted,
    postSettlementDebited,
    pickupFeeDebited,
  };
};

export const executeReturnCustomerRefund = async (
  returnDoc,
  order,
  { actorId = null, actorRole = 'ADMIN', note = '', payoutDetails = {} } = {},
) => {
  if (!returnDoc) throw new ValidationError('Return document is required');
  if (!order) throw new NotFoundError('Parent order not found');

  if (returnDoc.refundStatus === REFUND_STATUSES.COMPLETED && returnDoc.refundTransactionId) {
    return {
      alreadyProcessed: true,
      processed: true,
      pending: false,
      refundResult: {
        processed: true,
        alreadyProcessed: true,
        method: returnDoc.refundMethod,
        amount: num(returnDoc.returnRefundAmount),
        refundTransactionId: returnDoc.refundTransactionId,
        refundReference: returnDoc.refundReference,
      },
    };
  }

  if (!returnDoc.refundReference) {
    returnDoc.refundReference = buildReturnRefundReference(returnDoc);
  }

  if (returnDoc.refundStatus === REFUND_STATUSES.PROCESSING) {
    const recoveryResult = await processQuickCommerceReturnRefund(returnDoc, order, { payoutDetails });
    if (recoveryResult?.alreadyProcessed && recoveryResult?.processed) {
      returnDoc.refundStatus = REFUND_STATUSES.COMPLETED;
      returnDoc.refundTransactionId = recoveryResult.refundTransactionId || returnDoc.refundTransactionId;
      returnDoc.returnStatus = RETURN_STATUSES.REFUND_COMPLETED;
      appendCumulativeReturnItems(returnDoc, order);
      appendReturnRefundAudit(returnDoc, {
        action: 'REFUND_COMPLETED',
        refundStatus: REFUND_STATUSES.COMPLETED,
        refundTransactionId: returnDoc.refundTransactionId,
        refundReference: returnDoc.refundReference,
        actorId,
        actorRole,
        note: 'Recovered wallet refund after prior processing interruption',
        metadata: { method: recoveryResult.method, amount: recoveryResult.amount },
      });
      await returnDoc.save();
      return {
        alreadyProcessed: true,
        processed: true,
        pending: false,
        refundResult: recoveryResult,
      };
    }
  }

  const lockedReturn = await SellerReturn.findOneAndUpdate(
    {
      _id: returnDoc._id,
      refundStatus: { $nin: [REFUND_STATUSES.COMPLETED, REFUND_STATUSES.PROCESSING] },
    },
    { $set: { refundStatus: REFUND_STATUSES.PROCESSING } },
    { new: true },
  );

  if (!lockedReturn) {
    const current = await SellerReturn.findById(returnDoc._id).lean();
    if (current?.refundStatus === REFUND_STATUSES.COMPLETED) {
      return {
        alreadyProcessed: true,
        processed: true,
        pending: false,
        refundResult: {
          processed: true,
          alreadyProcessed: true,
          method: current.refundMethod,
          amount: num(current.returnRefundAmount),
          refundTransactionId: current.refundTransactionId,
          refundReference: current.refundReference,
        },
      };
    }
    throw new ValidationError('Refund is already being processed for this return');
  }

  returnDoc.refundStatus = REFUND_STATUSES.PROCESSING;
  appendReturnRefundAudit(returnDoc, {
    action: 'REFUND_PROCESSING',
    refundStatus: REFUND_STATUSES.PROCESSING,
    actorId,
    actorRole,
    note: note || 'Refund processing started',
  });
  await returnDoc.save();

  const refundResult = await processQuickCommerceReturnRefund(returnDoc, order, { payoutDetails });

  if (refundResult?.pending) {
    returnDoc.refundStatus = REFUND_STATUSES.PENDING;
    returnDoc.refundTransactionId = refundResult.refundTransactionId || returnDoc.refundTransactionId;
    appendReturnRefundAudit(returnDoc, {
      action: 'REFUND_QUEUED',
      refundStatus: REFUND_STATUSES.PENDING,
      refundTransactionId: returnDoc.refundTransactionId,
      refundReference: returnDoc.refundReference,
      actorId,
      actorRole,
      note: refundResult.message || 'Refund queued for admin payout',
      metadata: { payoutDetails },
    });
    await returnDoc.save();

    return { alreadyProcessed: false, processed: false, pending: true, refundResult };
  }

  if (!refundResult?.processed) {
    returnDoc.refundStatus = REFUND_STATUSES.FAILED;
    appendReturnRefundAudit(returnDoc, {
      action: 'REFUND_FAILED',
      refundStatus: REFUND_STATUSES.FAILED,
      actorId,
      actorRole,
      note: refundResult?.message || 'Refund failed',
      metadata: { reason: refundResult?.reason || 'unknown' },
    });
    await returnDoc.save();
    return { alreadyProcessed: false, processed: false, pending: false, refundResult };
  }

  returnDoc.refundStatus = REFUND_STATUSES.COMPLETED;
  returnDoc.refundTransactionId = refundResult.refundTransactionId || returnDoc.refundTransactionId;
  returnDoc.returnStatus = RETURN_STATUSES.REFUND_COMPLETED;
  appendCumulativeReturnItems(returnDoc, order);
  appendReturnRefundAudit(returnDoc, {
    action: 'REFUND_COMPLETED',
    refundStatus: REFUND_STATUSES.COMPLETED,
    refundTransactionId: returnDoc.refundTransactionId,
    refundReference: returnDoc.refundReference,
    actorId,
    actorRole,
    note: refundResult.message || note || 'Refund completed',
    metadata: { method: refundResult.method, amount: refundResult.amount },
  });
  await returnDoc.save();

  return { alreadyProcessed: false, processed: true, pending: false, refundResult };
};

export const passReturnQualityCheckAndRefund = async ({
  returnId,
  actorId = null,
  actorRole = 'SELLER',
  notes = '',
  force = false,
}) => {
  const returnDoc = await SellerReturn.findById(returnId);
  if (!returnDoc) throw new NotFoundError('Return request not found');

  if (returnDoc.qualityCheck?.status === 'passed' && returnDoc.refundStatus === REFUND_STATUSES.COMPLETED) {
    return { alreadyProcessed: true, return: returnDoc.toObject() };
  }

  if (!force && returnDoc.returnStatus !== RETURN_STATUSES.RETURNED) {
    throw new ValidationError('Quality check refund requires return status to be returned');
  }

  returnDoc.qualityCheck = {
    ...(returnDoc.qualityCheck?.toObject?.() || returnDoc.qualityCheck || {}),
    status: 'passed',
    notes: String(notes || '').trim(),
    checkedAt: new Date(),
    checkedByRole: actorRole,
    checkedById: actorId && mongoose.Types.ObjectId.isValid(actorId) ? actorId : null,
  };
  await returnDoc.save();

  const method = String(returnDoc.refundMethod || '').toLowerCase();
  if (method !== 'wallet') {
    return {
      qualityPassed: true,
      autoRefundTriggered: false,
      message: 'Quality check passed. Manual payout required for UPI/Bank refunds.',
      return: returnDoc.toObject(),
    };
  }

  const { QuickOrder } = await import('../models/order.model.js');
  const order = await QuickOrder.findOne({
    orderId: returnDoc.orderId,
    orderType: { $in: ['quick', 'mixed'] },
  });
  if (!order) throw new NotFoundError('Parent order not found');

  const payoutDetails = {};
  const refundExecution = await executeReturnCustomerRefund(returnDoc, order, {
    actorId,
    actorRole,
    note: notes || 'Automatic wallet refund after quality pass',
    payoutDetails,
  });

  if (refundExecution.processed) {
    await applyReturnSellerFinance(returnDoc, { actorId, actorRole, reason: 'Return wallet refund finance' });
  }

  return {
    qualityPassed: true,
    autoRefundTriggered: true,
    refund: refundExecution,
    return: returnDoc.toObject(),
  };
};

export const getPendingReturnCustomerPayouts = async ({ limit = 100 } = {}) => {
  const items = await SellerReturn.find({
    refundStatus: REFUND_STATUSES.PENDING,
    refundMethod: { $in: ['upi', 'bank'] },
    returnStatus: { $ne: RETURN_STATUSES.CANCELLED },
  })
    .sort({ updatedAt: -1 })
    .limit(Math.min(500, Math.max(1, Number(limit) || 100)))
    .lean();

  return items.map((row) => ({
    returnId: String(row._id),
    orderId: row.orderId,
    sellerId: String(row.sellerId || ''),
    refundMethod: row.refundMethod,
    refundStatus: row.refundStatus,
    amount: num(row.returnRefundAmount),
    refundTransactionId: row.refundTransactionId || '',
    refundReference: row.refundReference || buildReturnRefundReference(row),
    customer: row.customer || {},
    updatedAt: row.updatedAt,
  }));
};

export const getReturnFinanceReport = async () => {
  const {
    getSellersWithNegativeBalance,
    getPendingReturnRecoveries,
    getReturnRecoverySummary,
  } = await import('./sellerLedger.service.js');

  const [negativeBalanceSellers, pendingRecoveries, recoverySummary, pendingPayouts] =
    await Promise.all([
      getSellersWithNegativeBalance(),
      getPendingReturnRecoveries(),
      getReturnRecoverySummary(),
      getPendingReturnCustomerPayouts(),
    ]);

  return {
    negativeBalanceSellers,
    pendingRecoveries,
    pendingPayouts,
    recoverySummary,
    generatedAt: new Date(),
  };
};

export const getSellerFinanceBalanceReport = async (sellerId) => {
  const { getSellerWithdrawableBalance, getSellerLedgerEntries } = await import('./sellerLedger.service.js');
  const [balance, ledger] = await Promise.all([
    getSellerWithdrawableBalance(sellerId),
    getSellerLedgerEntries({ sellerId, limit: 100 }),
  ]);
  return { balance, ledger };
};

export const confirmPendingReturnPayout = async ({
  returnId,
  actorId = null,
  actorRole = 'ADMIN',
  payoutReference = '',
  note = '',
}) => {
  const returnDoc = await SellerReturn.findById(returnId);
  if (!returnDoc) throw new NotFoundError('Return request not found');

  if (returnDoc.refundStatus === REFUND_STATUSES.COMPLETED) {
    return { alreadyProcessed: true, return: returnDoc.toObject() };
  }

  if (returnDoc.refundStatus !== REFUND_STATUSES.PENDING) {
    throw new ValidationError('Only pending UPI/Bank return refunds can be confirmed');
  }

  const { QuickOrder } = await import('../models/order.model.js');
  const order = await QuickOrder.findOne({
    orderId: returnDoc.orderId,
    orderType: { $in: ['quick', 'mixed'] },
  });
  if (!order) throw new NotFoundError('Parent order not found');

  returnDoc.refundStatus = REFUND_STATUSES.COMPLETED;
  returnDoc.returnStatus = RETURN_STATUSES.REFUND_COMPLETED;
  appendCumulativeReturnItems(returnDoc, order);
  if (payoutReference) returnDoc.refundReference = String(payoutReference).trim();
  if (!returnDoc.refundReference) returnDoc.refundReference = buildReturnRefundReference(returnDoc);

  appendReturnRefundAudit(returnDoc, {
    action: 'REFUND_PAYOUT_CONFIRMED',
    refundStatus: REFUND_STATUSES.COMPLETED,
    refundReference: returnDoc.refundReference,
    actorId,
    actorRole,
    note: note || 'Admin confirmed UPI/Bank payout',
    metadata: { payoutReference },
  });
  await returnDoc.save();

  await applyReturnSellerFinance(returnDoc, {
    actorId,
    actorRole,
    reason: 'Return refund after admin payout confirmation',
  });

  return { alreadyProcessed: false, return: returnDoc.toObject() };
};
