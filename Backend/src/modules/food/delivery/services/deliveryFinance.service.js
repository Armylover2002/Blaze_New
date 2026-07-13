import mongoose from "mongoose";
import { FoodOrder } from "../../orders/models/order.model.js";
import { FoodDeliveryWithdrawal } from "../models/foodDeliveryWithdrawal.model.js";
import { FoodDeliveryCashDeposit } from "../models/foodDeliveryCashDeposit.model.js";
import { FoodDeliveryPartner } from "../models/deliveryPartner.model.js";
import { uploadImageBuffer } from "../../../../services/cloudinary.service.js";
import { DeliveryBonusTransaction } from "../../admin/models/deliveryBonusTransaction.model.js";
import { getDeliveryCashLimitSettings } from "../../admin/services/admin.service.js";
import { ValidationError } from "../../../../core/auth/errors.js";
import {
  createRazorpayOrder,
  fetchRazorpayPayment,
  getRazorpayKeyId,
  isRazorpayConfigured,
  verifyPaymentSignature,
} from "../../orders/helpers/razorpay.helper.js";
import { Transaction } from "../../../../core/payments/models/transaction.model.js";
import { getTransactionsByEntity } from "../../../../core/payments/transaction.service.js";
import { FoodDeliveryWallet } from "../models/deliveryWallet.model.js";
import { creditWallet } from "../../../../core/payments/wallet.service.js";
import { logger } from "../../../../utils/logger.js";
import {
  sumPorterDriverCashCollected,
  countPorterDriverDeliveries,
} from "../../../porter/orders/services/porter-driver-finance.service.js";


/**
 * Enhanced wallet fetch for delivery partners.
 * Integrates:
 * 1. Historical orders (earnings)
 * 2. Admin bonuses
 * 3. Withdrawals (pending/payout)
 * 4. Cash collected vs limit
 */
export const getDeliveryPartnerWalletEnhanced = async (deliveryPartnerId) => {
  if (
    !deliveryPartnerId ||
    !mongoose.Types.ObjectId.isValid(deliveryPartnerId)
  ) {
    throw new ValidationError("Invalid delivery partner ID");
  }

  const partnerId = new mongoose.Types.ObjectId(deliveryPartnerId);
  const partner = await FoodDeliveryPartner.findById(partnerId).lean();
  if (!partner) throw new ValidationError("Delivery partner not found");

  // 1. Self-heal completed deliveries that missed wallet credits (e.g., due to disabled queues in local dev)
  try {
    const completedOrders = await FoodOrder.find({
      "dispatch.deliveryPartnerId": partnerId,
      orderStatus: "delivered",
    }).lean();

    if (completedOrders.length > 0) {
      const orderIds = completedOrders.map(o => o._id);
      const existingTxns = await Transaction.find({
        entityType: "deliveryBoy",
        entityId: partnerId,
        category: "delivery_earning",
        orderId: { $in: orderIds }
      }).select("orderId").lean();

      const creditedOrderIds = new Set(existingTxns.map(t => String(t.orderId)));

      for (const order of completedOrders) {
        if (!creditedOrderIds.has(String(order._id))) {
          const riderEarning = Number(order.riderEarning || 0);
          const platformProfit = Number(order.platformProfit || 0);

          if (riderEarning > 0) {
            await creditWallet({
              entityType: 'deliveryBoy',
              entityId: partnerId,
              amount: riderEarning,
              description: `Order ${order.orderId || order._id} - delivery earning (self-heal)`,
              category: 'delivery_earning',
              orderId: order._id,
              metadata: { orderId: order.orderId, paymentMethod: order.payment?.method }
            });

            await FoodDeliveryWallet.updateOne(
              { deliveryPartnerId: partnerId },
              { $inc: { totalDeliveries: 1 } }
            );
            logger.info(`Self-healed credit for delivery partner ${partnerId} order ${order._id}`);
          }

          if (platformProfit > 0) {
            try {
              await creditWallet({
                entityType: 'admin',
                entityId: 'platform',
                amount: platformProfit,
                description: `Order ${order.orderId || order._id} - platform profit (self-heal)`,
                category: 'platform_fee',
                orderId: order._id,
                metadata: { orderId: order.orderId, paymentMethod: order.payment?.method, riderEarning }
              });
            } catch (err) {
              logger.error(`Self-heal platform profit failed for order ${order._id}: ${err.message}`);
            }
          }
        }
      }
    }
  } catch (err) {
    logger.error(`Self-healing delivery wallet credits failed: ${err.message}`);
  }

  // 2. In local development, auto-reject pending withdrawals to allow continuous testing of withdrawal flow
  if (process.env.NODE_ENV === 'development') {
    try {
      const pendingWithdrawalsCount = await FoodDeliveryWithdrawal.countDocuments({
        deliveryPartnerId: partnerId,
        status: 'pending'
      });
      if (pendingWithdrawalsCount > 0) {
        await FoodDeliveryWithdrawal.updateMany(
          { deliveryPartnerId: partnerId, status: 'pending' },
          { $set: { status: 'rejected', rejectionReason: 'Auto-rejected in development environment for testing' } }
        );
        logger.info(`Auto-rejected ${pendingWithdrawalsCount} pending withdrawals for partner ${partnerId} in development`);
      }
    } catch (err) {
      logger.error(`Auto-rejecting pending withdrawals failed: ${err.message}`);
    }
  }

  const [
    cashLimitSettings,
    walletDoc,
    totalBonusAgg,
    cashCollectedAgg,
    totalDepositedCashAgg,
    pendingWithdrawalsAgg,
    transactionsResult,
    totalDeliveries,
  ] = await Promise.all([
    getDeliveryCashLimitSettings(),
    FoodDeliveryWallet.findOne({ deliveryPartnerId: partnerId }).lean(),
    DeliveryBonusTransaction.aggregate([
      { $match: { deliveryPartnerId: partnerId } },
      { $group: { _id: null, total: { $sum: { $ifNull: ["$amount", 0] } } } },
    ]),
    FoodOrder.aggregate([
      {
        $match: {
          "dispatch.deliveryPartnerId": partnerId,
          orderStatus: "delivered",
          "payment.method": { $in: ["cash", "cod", "cash_on_delivery"] },
        },
      },
      {
        $group: {
          _id: null,
          cashCollected: {
            $sum: {
              $let: {
                vars: {
                  amountDue: { $ifNull: ["$payment.amountDue", 0] },
                  payableAmount: { $ifNull: ["$payableAmount", 0] },
                  totalAmount: { $ifNull: ["$totalAmount", 0] },
                  amount: { $ifNull: ["$amount", 0] },
                  total: { $ifNull: ["$total", 0] },
                  pricingTotal: { $ifNull: ["$pricing.total", 0] },
                  platformFee: { $ifNull: ["$pricing.platformFee", 0] },
                },
                in: {
                  $max: [
                    0,
                    "$$amountDue",
                    "$$payableAmount",
                    "$$totalAmount",
                    "$$amount",
                    "$$total",
                    {
                      $add: [
                        "$$pricingTotal",
                        {
                          $cond: [
                            { $gt: ["$$platformFee", 0] },
                            "$$platformFee",
                            0,
                          ],
                        },
                      ],
                    },
                  ],
                },
              },
            },
          },
        },
      },
    ]),
    FoodDeliveryCashDeposit.aggregate([
      { $match: { deliveryPartnerId: partnerId, status: "Completed" } },
      {
        $group: {
          _id: null,
          depositedCash: { $sum: { $ifNull: ["$amount", 0] } },
        },
      },
    ]),
    FoodDeliveryWithdrawal.aggregate([
      { $match: { deliveryPartnerId: partnerId, status: "pending" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
    getTransactionsByEntity("deliveryBoy", partnerId, { page: 1, limit: 50 }),
    FoodOrder.countDocuments({
      "dispatch.deliveryPartnerId": partnerId,
      orderStatus: "delivered",
    }),
  ]);

  // Fold in Porter (parcel) cash + deliveries so the SHARED pocket / cash-limit
  // screens stay accurate. Additive only — never touches Food aggregation.
  let porterCashCollected = 0;
  let porterDeliveries = 0;
  try {
    [porterCashCollected, porterDeliveries] = await Promise.all([
      sumPorterDriverCashCollected(partnerId),
      countPorterDriverDeliveries(partnerId),
    ]);
  } catch (err) {
    logger.error(`Porter cash/deliveries merge failed: ${err.message}`);
  }

  const wallet = walletDoc || {
    balance: 0,
    totalEarnings: 0,
    totalBonus: 0,
    totalSettled: 0,
  };
  const recordedBonus = Number(wallet.totalBonus || 0);
  const aggregatedBonus = Number(totalBonusAgg?.[0]?.total) || 0;
  const effectiveBonus = Math.max(recordedBonus, aggregatedBonus);
  const missingBonusBalance = Math.max(0, effectiveBonus - recordedBonus);

  const grossCashCollected =
    (Number(cashCollectedAgg?.[0]?.cashCollected) || 0) + Number(porterCashCollected || 0);
  const totalDepositedCash =
    Number(totalDepositedCashAgg?.[0]?.depositedCash) || 0;
  const cashInHand = Math.max(0, grossCashCollected - totalDepositedCash);

  const pendingWithdrawals = Number(pendingWithdrawalsAgg?.[0]?.total) || 0;
  const totalCashLimit = Number(cashLimitSettings.deliveryCashLimit) || 0;
  const deliveryWithdrawalLimit =
    Number(cashLimitSettings.deliveryWithdrawalLimit) || 100;

  const effectiveWalletBalance =
    Number(wallet.balance || 0) + missingBonusBalance;
  const pocketBalance = Math.max(
    0,
    effectiveWalletBalance - pendingWithdrawals,
  );

  const transactions = transactionsResult.transactions.map((t) => ({
    id: t._id,
    type:
      t.category === "settlement_payout"
        ? "withdrawal"
        : t.type === "credit"
          ? "payment"
          : "adjustment",
    amount: t.amount,
    status:
      t.status === "completed"
        ? "Completed"
        : t.status === "pending"
          ? "Pending"
          : "Failed",
    date: t.createdAt,
    description: t.description || "Wallet transaction",
    orderId: t.orderId,
    module: t.module,
  }));

  return {
    totalBalance: (wallet.totalEarnings || 0) + effectiveBonus,
    pocketBalance,
    cashInHand,
    totalWithdrawn: wallet.totalSettled || 0,
    pendingWithdrawals,
    totalEarned: wallet.totalEarnings || 0,
    totalBonus: effectiveBonus,
    totalCashLimit,
    availableCashLimit: Math.max(0, totalCashLimit - cashInHand),
    deliveryWithdrawalLimit,
    totalDeliveries: (Number(totalDeliveries) || 0) + Number(porterDeliveries || 0),
    subscriptionBalance: Number(wallet.subscriptionBalance || 0),
    transactions,
  };
};

/**
 * Submits a new withdrawal request for a delivery partner.
 */
export const requestDeliveryWithdrawal = async (deliveryPartnerId, payload) => {
  const { amount, bankDetails, paymentMethod = "bank_transfer" } = payload;
  if (!amount || amount < 1) throw new ValidationError("Invalid amount");

  const wallet = await getDeliveryPartnerWalletEnhanced(deliveryPartnerId);
  if (amount < wallet.deliveryWithdrawalLimit) {
    throw new ValidationError(
      `Minimum withdrawal amount is ₹${wallet.deliveryWithdrawalLimit}`,
    );
  }
  if (amount > wallet.pocketBalance) {
    throw new ValidationError("Insufficient balance for this withdrawal");
  }

  const partner = await FoodDeliveryPartner.findById(deliveryPartnerId).lean();
  if (!partner) throw new ValidationError("Delivery partner not found");

  const withdrawal = await FoodDeliveryWithdrawal.create({
    deliveryPartnerId,
    amount,
    paymentMethod,
    bankDetails: bankDetails || {
      accountNumber: partner.bankAccountNumber,
      ifscCode: partner.bankIfscCode,
      bankName: partner.bankName,
      accountHolderName: partner.bankAccountHolderName,
    },
    upiId: partner.upiId,
    upiQrCode: partner.upiQrCode,
    status: "pending",
  });

  return withdrawal;
};

/**
 * Creates a Razorpay order for cash deposit.
 */
export const createDeliveryCashDepositOrder = async (
  deliveryPartnerId,
  amountInr,
) => {
  const amount = Number(amountInr);
  if (!Number.isFinite(amount) || amount < 1) {
    throw new ValidationError("Amount must be at least ₹1");
  }

  const wallet = await getDeliveryPartnerWalletEnhanced(deliveryPartnerId);
  if (amount > wallet.cashInHand) {
    throw new ValidationError("Deposit amount cannot exceed cash in hand");
  }

  const amountPaise = Math.round(amount * 100);
  const receipt = `cash_deposit_${String(deliveryPartnerId).slice(-8)}_${Date.now()}`;

  if (!isRazorpayConfigured()) {
    return {
      razorpay: {
        key: getRazorpayKeyId() || "rzp_test_dummy",
        orderId: `order_dev_${Date.now()}`,
        amount: amountPaise,
        currency: "INR",
      },
    };
  }

  const order = await createRazorpayOrder(amountPaise, "INR", receipt);
  return {
    razorpay: {
      key: getRazorpayKeyId(),
      orderId: String(order.id),
      amount: Number(order.amount) || amountPaise,
      currency: order.currency || "INR",
    },
  };
};

/**
 * Verifies a cash deposit payment.
 */
export const verifyDeliveryCashDepositPayment = async (
  deliveryPartnerId,
  payload = {},
) => {
  const orderId = String(payload?.razorpayOrderId || "").trim();
  const paymentId = String(payload?.razorpayPaymentId || "").trim();
  const signature = String(payload?.razorpaySignature || "").trim();

  if (!orderId) throw new ValidationError("razorpayOrderId is required");
  if (!paymentId) throw new ValidationError("razorpayPaymentId is required");
  if (!signature && isRazorpayConfigured())
    throw new ValidationError("razorpaySignature is required");

  const existing = await FoodDeliveryCashDeposit.findOne({
    deliveryPartnerId,
    $or: [{ razorpayPaymentId: paymentId }, { razorpayOrderId: orderId }],
  }).lean();

  if (existing?.status === "Completed") {
    return {
      deposit: existing,
      wallet: await getDeliveryPartnerWalletEnhanced(deliveryPartnerId),
    };
  }

  const isValid = isRazorpayConfigured()
    ? verifyPaymentSignature(orderId, paymentId, signature)
    : true;

  if (!isValid) {
    throw new ValidationError("Payment verification failed");
  }

  let resolvedAmount = Number(payload?.amount);
  if (isRazorpayConfigured()) {
    const fetchedPayment = await fetchRazorpayPayment(paymentId);
    const fetchedOrderId = String(fetchedPayment?.order_id || "").trim();
    const fetchedStatus = String(fetchedPayment?.status || "").toLowerCase();
    const fetchedAmount = Number(fetchedPayment?.amount || 0) / 100;

    if (fetchedOrderId !== orderId) {
      throw new ValidationError("Payment order mismatch");
    }
    if (fetchedStatus !== "captured") {
      throw new ValidationError("Payment not captured");
    }
    if (!Number.isFinite(fetchedAmount) || fetchedAmount < 1) {
      throw new ValidationError("Invalid payment amount");
    }
    resolvedAmount = fetchedAmount;
  } else if (!Number.isFinite(resolvedAmount) || resolvedAmount < 1) {
    throw new ValidationError("amount is required");
  }

  const wallet = await getDeliveryPartnerWalletEnhanced(deliveryPartnerId);
  if (resolvedAmount > wallet.cashInHand) {
    throw new ValidationError("Deposit amount cannot exceed cash in hand");
  }

  const deposit = existing
    ? await FoodDeliveryCashDeposit.findByIdAndUpdate(
        existing._id,
        {
          $set: {
            amount: resolvedAmount,
            paymentMethod: isRazorpayConfigured() ? "razorpay" : "cash",
            status: "Completed",
            razorpayOrderId: orderId,
            razorpayPaymentId: paymentId,
          },
        },
        { new: true },
      )
    : await FoodDeliveryCashDeposit.create({
        deliveryPartnerId,
        amount: resolvedAmount,
        paymentMethod: isRazorpayConfigured() ? "razorpay" : "cash",
        status: "Completed",
        razorpayOrderId: orderId,
        razorpayPaymentId: paymentId,
      });

  return {
    deposit,
    wallet: await getDeliveryPartnerWalletEnhanced(deliveryPartnerId),
  };
};

/**
 * Submits a manual cash deposit (Admin Bank, Admin UPI, Admin QR, or Zone Hub) with an optional payment proof file.
 */
export const submitDeliveryManualDeposit = async (deliveryPartnerId, payload, file) => {
  const amount = Number(payload?.amount);
  const depositType = String(payload?.depositType || 'online').trim();

  if (!Number.isFinite(amount) || amount < 1) {
    throw new ValidationError("Amount must be at least ₹1");
  }

  const wallet = await getDeliveryPartnerWalletEnhanced(deliveryPartnerId);
  if (amount > wallet.cashInHand) {
    throw new ValidationError("Deposit amount cannot exceed cash in hand");
  }

  const validTypes = ['admin_bank', 'admin_upi', 'admin_qr', 'zone_hub', 'quick_zone_hub'];
  if (!validTypes.includes(depositType)) {
    throw new ValidationError("Invalid deposit type");
  }

  let paymentProofUrl = '';
  // Upload proof file to Cloudinary if provided
  if (file?.buffer) {
    paymentProofUrl = await uploadImageBuffer(file.buffer, 'food/delivery/deposits');
  } else if (depositType !== 'zone_hub' && depositType !== 'quick_zone_hub') {
    // If not zone hub, proof is required
    throw new ValidationError("Payment proof/receipt image is required");
  }

  const paymentMethod = depositType === 'admin_bank' ? 'bank_transfer' : depositType === 'admin_upi' || depositType === 'admin_qr' ? 'upi' : 'cash';

  let finalDepositType = depositType;
  let finalZoneId = payload?.zoneId && mongoose.Types.ObjectId.isValid(payload.zoneId) ? new mongoose.Types.ObjectId(payload.zoneId) : null;
  let finalZoneHubRestaurantId = payload?.zoneHubRestaurantId && mongoose.Types.ObjectId.isValid(payload.zoneHubRestaurantId) ? new mongoose.Types.ObjectId(payload.zoneHubRestaurantId) : null;
  let finalQuickZoneId = null;
  let finalQuickZoneHubSellerId = null;

  // Smart resolution for Zone Hubs: if designated hub is actually a Q-Commerce Seller
  if (depositType === 'zone_hub' && finalZoneHubRestaurantId) {
    const { FoodRestaurant } = await import('../../restaurant/models/restaurant.model.js');
    const isFoodRestaurant = await FoodRestaurant.exists({ _id: finalZoneHubRestaurantId });
    if (!isFoodRestaurant) {
      const { Seller } = await import('../../../quick-commerce/seller/models/seller.model.js');
      const isSeller = await Seller.exists({ _id: finalZoneHubRestaurantId });
      if (isSeller) {
        finalDepositType = 'quick_zone_hub';
        finalQuickZoneHubSellerId = finalZoneHubRestaurantId;
        finalQuickZoneId = finalZoneId;
        finalZoneHubRestaurantId = null;
        finalZoneId = null;
      }
    }
  }

  const deposit = await FoodDeliveryCashDeposit.create({
    deliveryPartnerId,
    amount,
    paymentMethod,
    depositType: finalDepositType,
    paymentProof: paymentProofUrl,
    status: 'Pending', // Awaiting approval
    zoneId: finalZoneId,
    zoneHubRestaurantId: finalZoneHubRestaurantId,
    quickZoneId: finalQuickZoneId,
    quickZoneHubSellerId: finalQuickZoneHubSellerId
  });

  return {
    deposit,
    wallet: await getDeliveryPartnerWalletEnhanced(deliveryPartnerId),
  };
};
