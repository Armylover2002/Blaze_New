import { FoodTransaction } from '../models/foodTransaction.model.js';
import { resolveDiscountSplitByCoupon } from '../../shared/discountSplit.util.js';
import { loadActiveFeeSettings, calculateRiderEarning } from '../../shared/delivery-fee.util.js';
import { computePlatformNetProfitWithQuickFreeze } from '../utils/quickFinance.util.js';
import mongoose from 'mongoose';

export async function getRiderEarning(distanceKm) {
  const feeSettings = await loadActiveFeeSettings();
  return calculateRiderEarning(feeSettings, distanceKm);
}

/**
 * Creates an initial 'pending' transaction when an order is created.
 */
export async function createInitialTransaction(order) {
    const normalizedOrderType = ['food', 'quick', 'mixed'].includes(String(order?.orderType || ''))
        ? String(order.orderType)
        : 'food';
    const restaurantId = order?.restaurantId || null;
    
    // Split logic
    const totalCustomerPaid = order.pricing?.total || 0;
    const riderShare = order.riderEarning || 0;
    // Phase 3A: Segregated calculations for mixed orders
    let restaurantNet = 0;
    let sellerShare = 0;
    let sellerCommission = 0;

    if (order.orderType === 'mixed') {
        const foodSubtotal = (order.items || [])
            .filter(i => i.type === 'food')
            .reduce((sum, i) => sum + (Number(i.price) * Number(i.quantity)), 0);
        
        restaurantNet = foodSubtotal + (order.pricing?.packagingFee || 0);

        // Seller logic (from receivable rules)
        const quickItems = (order.items || []).filter(i => i.type === 'quick');
        // Sum commission and receivable if pre-calculated in Phase 2
        // We'll calculate it here for the ledger based on the items
        sellerCommission = quickItems.reduce((sum, i) => sum + (Number(i.commission) || 0), 0);
        sellerShare = quickItems.reduce((sum, i) => sum + (Number(i.receivable) || 0), 0);
        
        // If items don't have these (unlikely after Ph2), fallback to simple subtotal
        if (sellerShare === 0 && quickItems.length > 0) {
            sellerShare = quickItems.reduce((sum, i) => sum + (Number(i.price) * Number(i.quantity)), 0);
        }
    } else if (normalizedOrderType === 'quick') {
        restaurantNet = 0;
        sellerCommission = Number(order.pricing?.restaurantCommission || 0) || 0;
        const quickSubtotal = Number(order.pricing?.subtotal || 0) || 0;
        sellerShare = Math.max(0, quickSubtotal - sellerCommission);
    } else {
        restaurantNet = (order.pricing?.subtotal || 0) + (order.pricing?.packagingFee || 0);
        sellerShare = 0;
        sellerCommission = 0;
    }

    const restaurantDeliveryFee = Number(order.pricing?.restaurantDeliveryFee || 0) || 0;
    const totalDeliveryFee =
        Number(order.pricing?.totalDeliveryFee ?? order.pricing?.deliveryFee ?? 0) || 0;

    const restaurantCommission = Number(order.pricing?.restaurantCommission || 0) || 0;

    if (restaurantDeliveryFee > 0) {
        restaurantNet = Math.max(0, restaurantNet - restaurantDeliveryFee);
    }

    restaurantNet = Math.max(0, restaurantNet - restaurantCommission);

    const discount = Number(order.pricing?.discount || 0) || 0;
    const couponCode = order.pricing?.couponCode;
    const couponSource = order.pricing?.appliedCoupon?.source;
    let adminDiscountShare = 0;
    let restaurantDiscountShare = 0;
    let discountAdminBearPercentage = 0;
    let discountRestaurantBearPercentage = 0;

    if (discount > 0) {
        const split = await resolveDiscountSplitByCoupon({
            couponCode,
            discount,
            couponSource,
        });
        adminDiscountShare = split.adminDiscountShare;
        restaurantDiscountShare = split.restaurantDiscountShare;
        discountAdminBearPercentage = split.adminBearPercentage;
        discountRestaurantBearPercentage = split.restaurantBearPercentage;
    }

    restaurantNet = Math.max(0, restaurantNet - restaurantDiscountShare);
    const quickDeliveryFee = Number(order.pricing?.quickDeliveryFee || 0) || 0;
    const quickPlatformShare = Number(order.pricing?.quickPlatformShare || 0) || 0;
    const quickRiderBonus = Number(order.pricing?.quickRiderBonus || 0) || 0;
    const quickRiderShare =
      Number(order.pricing?.quickRiderShare ?? order.pricing?.quickRiderBonus ?? 0) || 0;
    // Missing restaurant share on old orders ⇒ 0 (BC). Never fold into restaurantShare at create.
    const quickRestaurantShare = Number(order.pricing?.quickRestaurantShare || 0) || 0;
    const quickSharePcts = {
      platform: Number(order.pricing?.quickSharePcts?.platform || 0) || 0,
      rider: Number(order.pricing?.quickSharePcts?.rider || 0) || 0,
      restaurant: Number(order.pricing?.quickSharePcts?.restaurant || 0) || 0,
    };
    const quickFinanceVersion = String(order.pricing?.quickFinanceVersion || '');
    /**
     * FINANCE FREEZE — Food Quick Charge:
     * Platform gets quickPlatformShare only (never full quickDeliveryFee).
     * Rider share rides on order.riderEarning (via quickRiderBonus).
     * Restaurant Quick Share is snapshotted here but NOT added to restaurantShare
     * until successful delivery (realizeFoodQuickRestaurantShare).
     * riderShare on the order already includes quickRiderBonus — use base rider for P&L.
     */
    const baseRiderShare = Math.max(0, (Number(riderShare) || 0) - quickRiderBonus);
    let platformNetProfit = computePlatformNetProfitWithQuickFreeze({
      deliveryFee: totalDeliveryFee,
      platformFee: order.pricing?.platformFee || 0,
      restaurantCommission,
      sellerCommission,
      quickPlatformShare,
      baseRiderShare,
      adminDiscountShare,
    });

    restaurantNet = Math.round((Number(restaurantNet) || 0) * 100) / 100;
    platformNetProfit = Math.round((Number(platformNetProfit) || 0) * 100) / 100;

    const transaction = new FoodTransaction({
        orderId: order._id,
        orderType: normalizedOrderType,

        userId: order.userId,
        restaurantId,
        deliveryPartnerId: order.dispatch?.deliveryPartnerId,
        paymentMethod: order.payment?.method || 'cash',
        status: order.payment?.status === 'paid' ? 'captured' : 'pending',
        payment: {
            method: String(order.payment?.method || 'cash'),
            status: String(order.payment?.status || 'cod_pending'),
            amountDue: Number(order.payment?.amountDue ?? order.pricing?.total ?? 0) || 0,
            razorpay: {
                orderId: String(order.payment?.razorpay?.orderId || ''),
                paymentId: String(order.payment?.razorpay?.paymentId || ''),
                signature: String(order.payment?.razorpay?.signature || ''),
            },
            qr: {
                qrId: String(order.payment?.qr?.qrId || ''),
                imageUrl: String(order.payment?.qr?.imageUrl || ''),
                paymentLinkId: String(order.payment?.qr?.paymentLinkId || ''),
                shortUrl: String(order.payment?.qr?.shortUrl || ''),
                status: String(order.payment?.qr?.status || ''),
                expiresAt: order.payment?.qr?.expiresAt || null,
            }
        },
        pricing: {
            subtotal: Number(order.pricing?.subtotal || 0) || 0,
            tax: Number(order.pricing?.tax || 0) || 0,
            packagingFee: Number(order.pricing?.packagingFee || 0) || 0,
            deliveryFee: Number(order.pricing?.deliveryFee || 0) || 0,
            totalDeliveryFee,
            userDeliveryFee: Number(order.pricing?.userDeliveryFee ?? order.pricing?.deliveryFee ?? 0) || 0,
            restaurantDeliveryFee,
            sponsoredDelivery: Boolean(order.pricing?.sponsoredDelivery),
            sponsoredKm: Number(order.pricing?.sponsoredKm || 0) || 0,
            deliveryDistanceKm:
                order.pricing?.deliveryDistanceKm == null
                    ? null
                    : Number(order.pricing.deliveryDistanceKm) || 0,
            deliverySponsorType: String(order.pricing?.deliverySponsorType || 'USER_FULL'),
            platformFee: Number(order.pricing?.platformFee || 0) || 0,
            discount: Number(order.pricing?.discount || 0) || 0,
            restaurantCommissionPercentage: Number(order.pricing?.restaurantCommissionPercentage || 0) || 0,
            restaurantCommission: Number(order.pricing?.restaurantCommission || 0) || 0,
            quickDeliveryFee,
            quickPlatformShare,
            quickRiderBonus,
            quickRiderShare,
            quickRestaurantShare,
            quickSharePcts,
            quickFinanceVersion,
            total: Number(order.pricing?.total || 0) || 0,
            currency: String(order.pricing?.currency || order.currency || 'INR'),
        },
        amounts: {
            totalCustomerPaid,
            // Food economics only at create — Quick Restaurant Share realized post-delivery.
            restaurantShare: Math.max(0, restaurantNet),
            restaurantCommission,
            sellerShare: Math.max(0, sellerShare),
            sellerCommission: Math.max(0, sellerCommission),
            riderShare,
            platformNetProfit,
            taxAmount: order.pricing?.tax || 0,
            adminDiscountShare,
            restaurantDiscountShare,
            discountAdminBearPercentage,
            discountRestaurantBearPercentage,
            quickDeliveryFee,
            quickPlatformShare,
            quickRiderBonus,
            quickRiderShare,
            quickRestaurantShare,
            quickRestaurantShareRealized: false,
            quickSharePcts,
            quickFinanceVersion,
        },
        gateway: {
            razorpayOrderId: order.payment?.razorpay?.orderId,
            qrUrl: order.payment?.qr?.imageUrl
        },
        history: [{
            kind: 'created',
            amount: totalCustomerPaid,
            note: 'Initial transaction created with order'
        }]
    });

    await transaction.save();

    // Link back to the order
    try {
        await mongoose.model('FoodOrder').updateOne(
            { _id: order._id },
            { $set: { transactionId: transaction._id } }
        );
    } catch (err) {
        // Log but don't fail transaction if the backlink fails
    }

    return transaction;
}

/**
 * Realize frozen Restaurant Quick Share into existing restaurantShare settlement
 * component after successful delivery. Idempotent — never double-credits.
 * Never writes restaurant wallet. Missing/0 share (old orders) ⇒ no-op.
 */
export async function realizeFoodQuickRestaurantShare(order) {
    const orderId = order?._id || order;
    if (!orderId) return null;

    const share =
        Math.round(
            (Number(
                order?.pricing?.quickRestaurantShare ??
                    order?.amounts?.quickRestaurantShare ??
                    0,
            ) || 0) * 100,
        ) / 100;

    if (!(share > 0)) return null;

    const updated = await FoodTransaction.findOneAndUpdate(
        {
            orderId,
            'amounts.quickRestaurantShareRealized': { $ne: true },
        },
        {
            $inc: { 'amounts.restaurantShare': share },
            $set: {
                'amounts.quickRestaurantShareRealized': true,
                'amounts.quickRestaurantShare': share,
            },
            $push: {
                history: {
                    kind: 'quick_restaurant_share_realized',
                    amount: share,
                    at: new Date(),
                    note: 'Restaurant Quick Share realized after successful delivery (settlement component only)',
                },
            },
        },
        { new: true },
    );

    return updated;
}

/**
 * Updates transaction status (captured, settled, etc) and appends to history.
 */
export async function updateTransactionStatus(orderId, kind, details = {}) {
    const query = { orderId };
    const transaction = await FoodTransaction.findOne(query);
    if (!transaction) return null;

    if (details.status) transaction.status = details.status;
    if (details.razorpayPaymentId) transaction.gateway.razorpayPaymentId = details.razorpayPaymentId;
    if (details.razorpaySignature) transaction.gateway.razorpaySignature = details.razorpaySignature;
    
    transaction.history.push({
        kind,
        amount: transaction.amounts.totalCustomerPaid,
        at: new Date(),
        note: details.note || `Transaction updated: ${kind}`,
        recordedBy: { role: details.recordedByRole || 'SYSTEM', id: details.recordedById }
    });

    await transaction.save();
    return transaction;
}

/**
 * Updates the rider in the transaction when an order is accepted.
 */
export async function updateTransactionRider(orderId, riderId) {
    const query = { orderId };
    return await FoodTransaction.findOneAndUpdate(
        query,
        { $set: { deliveryPartnerId: riderId } },
        { new: true }
    );
}

/**
 * Marks restaurant as settled in the finance record.
 */
export async function settleRestaurant(orderId, adminId) {
    return await updateTransactionStatus(orderId, 'settled', {
        status: 'captured', // Ensure it's marked as captured if it was pending cash
        note: 'Restaurant payout settled by admin',
        recordedByRole: 'ADMIN',
        recordedById: adminId
    });
}
