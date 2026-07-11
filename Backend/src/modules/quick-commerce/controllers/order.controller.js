import mongoose from 'mongoose';
import { logger } from '../../../utils/logger.js';
import { sendResponse } from '../../../utils/response.js';
import { FoodUser } from '../../../core/users/user.model.js';
import { QuickOrder } from '../models/order.model.js';
import { QuickCart } from '../models/cart.model.js';
import { QuickProduct } from '../models/product.model.js';
import { Seller } from '../seller/models/seller.model.js';
import { SellerOrder } from '../seller/models/sellerOrder.model.js';
import { getSellerCommissionSnapshot } from '../admin/services/commission.service.js';
import {
  calculateQuickPricing,
  getRiderEarning as getQuickRiderEarning,
  getActiveFeeSettings,
} from '../admin/services/billing.service.js';
import * as foodTransactionService from '../../food/orders/services/foodTransaction.service.js';
import { FoodTransaction } from '../../food/orders/models/foodTransaction.model.js';
import { emitQuickCommerceStatusUpdate } from '../services/quickStatusRealtime.service.js';
import { getSellerLocation, getOrderAddressPoint } from '../services/quickOrder.service.js';
import { roadDistanceKm } from '../../food/orders/services/order.helpers.js';
import { buildReturnEligibilityMeta } from '../utils/return.helpers.js';
import {
  buildCartLineKey,
  resolveVariantLabel,
  resolveVariantStock,
  resolveVariantUnitPrice,
  stripCompositeProductId,
} from '../utils/variant.helpers.js';
import {
  decrementQuickOrderItemsStock,
  restoreQuickOrderItemsStock,
} from '../utils/stock.helpers.js';
import { processQuickOrderRefund } from '../services/quickRefund.service.js';
import { fanOutQuickSellerOrdersForParent } from '../services/quickSellerOrderFanout.service.js';
import { deductWalletBalance, refundWalletBalance } from '../../food/user/services/userWallet.service.js';
import {
    getGlobalPaymentSettings,
    assertPaymentMethodAllowed,
} from '../../common/services/globalPaymentSettings.service.js';
import {
    createRazorpayOrder,
    fetchRazorpayPayment,
    getRazorpayKeyId,
    isRazorpayConfigured,
    verifyPaymentSignature,
} from '../../food/orders/helpers/razorpay.helper.js';
import * as orderService from '../../food/orders/services/order.service.js';
import { z } from 'zod';
import { ValidationError } from '../../../core/auth/errors.js';
import { getQuickCoupons } from '../services/content.service.js';
import {
  isQuickCouponCurrentlyValid,
  isQuickCouponExpired,
  isQuickCouponNotStarted,
} from '../utils/coupon.helpers.js';

const approvedProductFilter = {
  $or: [
    { isActive: true },
    { isActive: { $exists: false } },
    { status: 'active' },
  ],
  $and: [
    {
      $or: [
        { approvalStatus: { $exists: false } },
        { approvalStatus: 'approved' },
      ],
    },
  ],
};

const getQuickSessionIdFromRequest = (req) =>
  String(req.headers['x-quick-session'] || req.body?.sessionId || req.query?.sessionId || '').trim();

const resolveId = (req) => {
  if (req.user?.userId) return { userId: req.user.userId };
  const sessionId = getQuickSessionIdFromRequest(req);
  return sessionId ? { sessionId } : null;
};

async function resolveServerQuickDiscount({ couponCode, subtotal, items }) {
  const code = String(couponCode || '').trim().toUpperCase();
  if (!code) return { discount: 0, couponCode: null };

  const adminCoupons = await getQuickCoupons();
  let coupon = (Array.isArray(adminCoupons) ? adminCoupons : []).find(
    (entry) => String(entry?.code || '').toUpperCase() === code,
  );

  if (!coupon) {
    const sellerIdRaw = (Array.isArray(items) ? items : []).find((item) => item?.sellerId)?.sellerId;
    const sellerId = String(sellerIdRaw || '').trim();
    if (sellerId && mongoose.isValidObjectId(sellerId)) {
      const { SellerCoupon } = await import('../models/sellerCoupon.model.js');
      const sellerCoupon = await SellerCoupon.findOne({
        sellerId: new mongoose.Types.ObjectId(sellerId),
        couponCode: code,
        status: 'Approved',
        expiryDate: { $gt: new Date() },
      }).lean();
      if (sellerCoupon) {
        coupon = {
          ...sellerCoupon,
          code: sellerCoupon.couponCode,
          minOrderValue: sellerCoupon.minOrderAmount,
        };
      }
    }
  }

  if (!coupon) {
    throw new ValidationError('Coupon not found or expired');
  }
  if (!isQuickCouponCurrentlyValid(coupon)) {
    if (isQuickCouponExpired(coupon)) throw new ValidationError('This coupon has expired');
    if (isQuickCouponNotStarted(coupon)) throw new ValidationError('This coupon is not active yet');
    throw new ValidationError('This coupon is not active');
  }

  const minOrder = Number(coupon.minOrderValue || coupon.minOrder || 0);
  if (minOrder > 0 && Number(subtotal || 0) < minOrder) {
    throw new ValidationError(`Minimum order value of ₹${minOrder} required for this coupon`);
  }

  const discountType = String(coupon.discountType || 'flat').toLowerCase();
  const discountValue = Number(coupon.discountValue || coupon.discount || 0);
  const maxDiscount = Number(coupon.maxDiscount || coupon.maxDiscountValue || 0);

  let discount = 0;
  if (discountType === 'percent' || discountType === 'percentage') {
    discount = Math.round((Number(subtotal || 0) * discountValue) / 100);
    if (maxDiscount > 0) discount = Math.min(discount, maxDiscount);
  } else {
    discount = discountValue;
  }

  return {
    discount: Math.max(0, Math.min(discount, Number(subtotal || 0))),
    couponCode: String(coupon.code || code).toUpperCase(),
  };
}

/** Match orders owned by logged-in user and/or the active quick session. */
const buildOrderAccessQuery = (req) => {
  const ownershipClauses = [];
  if (req.user?.userId) ownershipClauses.push({ userId: req.user.userId });
  const sessionId = getQuickSessionIdFromRequest(req);
  if (sessionId) ownershipClauses.push({ sessionId });
  if (!ownershipClauses.length) return null;
  return ownershipClauses.length === 1 ? ownershipClauses[0] : { $or: ownershipClauses };
};

function validateOrderRatingsDto(body) {
  const schema = z.object({
    restaurantRating: z.number().min(1).max(5).optional(),
    sellerRating: z.number().min(1).max(5).optional(),
    deliveryPartnerRating: z.number().min(1).max(5).optional(),
    restaurantComment: z.string().max(500).optional(),
    sellerComment: z.string().max(500).optional(),
    deliveryPartnerComment: z.string().max(500).optional()
  });
  const result = schema.safeParse(body || {});
  if (!result.success) {
    throw new ValidationError(result.error.errors?.[0]?.message || 'Validation failed');
  }
  return result.data;
}

const getOrderPayableAmount = (order) => {
  const pricing = order?.pricing || {};
  // pricing.total already includes: subtotal + deliveryFee + platformFee + gst - discount
  // No need to add platformFee again here.
  const total = Number(pricing.total ?? order?.total ?? 0);
  return Number.isFinite(total) ? Math.max(0, total) : 0;
};

const normalizeOrderSummary = (order) => {
  const amount = getOrderPayableAmount(order);
  const paymentMethod = order?.payment?.method || order?.paymentMethod || 'cash';
  const paymentStatus = order?.payment?.status || order?.paymentStatus || '';

  return {
    id: order._id,
    _id: order._id,
    orderId: order.orderId,
    orderNumber: order.orderId,
    total: amount,
    totalAmount: amount,
    payableAmount: amount,
    amount,
    status: order.orderStatus,
    orderStatus: order.orderStatus,
    workflowStatus: order.workflowStatus || '',
    paymentMethod,
    paymentStatus,
    payment: order.payment || {},
    itemCount: Array.isArray(order.items)
      ? order.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0)
      : 0,
    createdAt: order.createdAt,
    items: Array.isArray(order.items)
      ? order.items.map((item) => ({
          itemId: item.itemId || item.productId || '',
          name: item.name,
          image: item.image,
          price: item.price,
          quantity: item.quantity,
          variantName: item.variantName || item.notes || '',
          notes: item.notes || item.variantName || '',
        }))
      : [],
    pricing: order.pricing || {},
  };
};

const normalizeDeliveryAddress = (address) => {
  if (!address || typeof address !== 'object') return null;

  const street = String(address.address || address.street || '').trim();
  const city = String(address.city || '').trim();
  const additionalDetails = String(address.landmark || address.additionalDetails || '').trim();
  const phone = String(address.phone || '').trim();
  const name = String(address.name || '').trim();
  const label = ['Home', 'Office', 'Other'].includes(address.type) ? address.type : 'Other';
  const state = String(address.state || '').trim();
  const zipCode = String(address.zipCode || address.pincode || '').trim();
  const lat = Number(address.location?.lat);
  const lng = Number(address.location?.lng);
  const formattedAddress = [street, additionalDetails, city, state, zipCode]
    .map((part) => String(part || '').trim())
    .filter((part) => part && part.toUpperCase() !== 'NA')
    .join(', ');

  return {
    label,
    name,
    street,
    additionalDetails,
    city: city || street,
    state: state || city || 'India',
    zipCode,
    phone,
    ...(formattedAddress ? { formattedAddress } : {}),
    ...(Number.isFinite(lat) && Number.isFinite(lng)
      ? {
          location: {
            type: 'Point',
            coordinates: [lng, lat],
          },
        }
      : {}),
  };
};

const buildQuickPickupPointFromSeller = (seller, sellerId) => {
  if (!seller || !sellerId) return null;
  const location = seller.location || {};
  const coordinates = Array.isArray(location.coordinates) && location.coordinates.length === 2
    ? location.coordinates
    : (Number.isFinite(Number(location.latitude)) && Number.isFinite(Number(location.longitude))
        ? [Number(location.longitude), Number(location.latitude)]
        : undefined);
  const addressText = [
    location.formattedAddress,
    location.address,
    seller.shopInfo?.address,
    seller.shopInfo?.formattedAddress,
  ]
    .map((part) => String(part || '').trim())
    .find(Boolean) || '';

  return {
    pickupType: 'quick',
    sourceId: String(sellerId),
    sourceName: String(seller.shopName || seller.name || 'Store').trim(),
    address: addressText,
    phone: String(seller.phone || '').trim(),
    ...(coordinates ? { location: { coordinates } } : {}),
  };
};

const normalizeRequestedItems = (items) => {
  if (!Array.isArray(items)) return [];

  return items
    .map((item) => {
      const productId = stripCompositeProductId(
        item?.productId || item?.itemId || item?.id || item?._id || '',
      );
      const variantName = String(
        item?.variantName || item?.selectedVariant?.name || '',
      ).trim();
      const variantKey = String(
        item?.variantKey ||
          item?.selectedVariant?._id ||
          item?.selectedVariant?.id ||
          '',
      ).trim();
      const variantSku = String(
        item?.variantSku || item?.selectedVariant?.sku || '',
      ).trim();

      return {
        productId,
        quantity: Math.max(1, Number(item?.quantity || 1)),
        variantName,
        variantKey,
        variantSku,
        price: Number(item?.price),
        lineKey: buildCartLineKey(productId, variantKey, variantName),
      };
    })
    .filter((item) => item.productId && mongoose.isValidObjectId(item.productId));
};

const buildRequestedItemMetaMap = (items = []) =>
  items.reduce((acc, item) => {
    acc[item.lineKey || item.productId] = item;
    return acc;
  }, {});

const resolveLineItemMeta = (productId, variantMeta = {}, metaMap = {}) => {
  const keys = [
    buildCartLineKey(
      productId,
      variantMeta.variantKey,
      variantMeta.variantName,
    ),
    String(productId),
  ];
  for (const key of keys) {
    if (metaMap[key]) return metaMap[key];
  }
  return variantMeta;
};

const emitQuickOrderStatusUpdate = (order, message = '') => {
  try {
    void emitQuickCommerceStatusUpdate(order, { message });
  } catch {
    // best-effort realtime update
  }
};

export const placeOrder = async (req, res) => {
  try {
    const idQuery = resolveId(req);

    if (!idQuery) {
      return res.status(400).json({ success: false, message: 'sessionId or userId is required' });
    }

    const cart = await QuickCart.findOne(idQuery).lean();
    const requestedItems = normalizeRequestedItems(req.body?.items);
    const requestedMetaMap = buildRequestedItemMetaMap(requestedItems);
    const sourceItems =
      requestedItems.length > 0
        ? requestedItems
        : (Array.isArray(cart?.items) && cart.items.length > 0
            ? cart.items.map((item) => ({
                productId: stripCompositeProductId(item.productId),
                quantity: Math.max(1, Number(item.quantity || 1)),
                variantName: String(item.variantName || '').trim(),
                variantKey: String(item.variantKey || '').trim(),
                variantSku: String(item.variantSku || '').trim(),
                price: Number(item.unitPrice || 0),
                lineKey: buildCartLineKey(
                  item.productId,
                  item.variantKey,
                  item.variantName,
                ),
              }))
            : []);

    if (sourceItems.length === 0) {
      return res.status(400).json({ success: false, message: 'Cart is empty' });
    }

    const productIds = sourceItems.map((item) => stripCompositeProductId(item.productId));
    const products = await QuickProduct.find({ _id: { $in: productIds }, ...approvedProductFilter }).lean();
    const productMap = products.reduce((acc, product) => {
      acc[String(product._id)] = product;
      return acc;
    }, {});

    let items = sourceItems
      .map((item) => {
        const productId = stripCompositeProductId(item.productId);
        const product = productMap[String(productId)];
        if (!product) return null;
        const requestedMeta = resolveLineItemMeta(productId, item, requestedMetaMap);
        const variantName = resolveVariantLabel(product, requestedMeta);
        const unitPrice = resolveVariantUnitPrice(product, requestedMeta);
        return {
          productId: product._id,
          sellerId: product.sellerId || null,
          name: product.name,
          image: product.image || product.mainImage || '',
          price: unitPrice,
          quantity: item.quantity,
          variantName,
          variantKey: requestedMeta.variantKey || '',
          variantSku: requestedMeta.variantSku || '',
        };
      })
      .filter(Boolean);

    if (items.length === 0 && requestedItems.length > 0 && sourceItems !== requestedItems) {
      const fallbackProductIds = requestedItems.map((item) => item.productId);
      const fallbackProducts = await QuickProduct.find({
        _id: { $in: fallbackProductIds },
        ...approvedProductFilter,
      }).lean();
      const fallbackProductMap = fallbackProducts.reduce((acc, product) => {
        acc[String(product._id)] = product;
        return acc;
      }, {});

      items = requestedItems
        .map((item) => {
          const product = fallbackProductMap[String(item.productId)];
          if (!product) return null;
          const variantName = resolveVariantLabel(product, item);
          const unitPrice = resolveVariantUnitPrice(product, item);
          return {
            productId: product._id,
            sellerId: product.sellerId || null,
            name: product.name,
            image: product.image || product.mainImage || '',
            price: unitPrice,
            quantity: item.quantity,
            variantName,
            variantKey: item.variantKey || '',
            variantSku: item.variantSku || '',
          };
        })
        .filter(Boolean);
    }

    if (items.length === 0) {
      logger.warn(`Quick placeOrder: No valid items found for productIds: ${JSON.stringify(productIds)} using idQuery: ${JSON.stringify(idQuery)}`);
      return res.status(400).json({ success: false, message: 'No valid items found in cart' });
    }

    const orderSellerIds = [
      ...new Set(
        items
          .map((item) => (item.sellerId ? String(item.sellerId) : ''))
          .filter(Boolean),
      ),
    ];
    if (orderSellerIds.length > 1) {
      return res.status(400).json({
        success: false,
        code: 'MULTI_SELLER_NOT_ALLOWED',
        message: 'Quick Commerce orders support only one seller per order.',
      });
    }

    // Validate stock for all items
    for (const item of items) {
      const prodIdStr = String(item.productId);
      const product = products.find((p) => String(p._id) === prodIdStr) ||
                      (typeof fallbackProducts !== 'undefined' ? fallbackProducts.find((p) => String(p._id) === prodIdStr) : null);
      if (product) {
        const availableStock = resolveVariantStock(product, item);
        if (item.quantity > availableStock) {
          const variantSuffix = item.variantName ? ` (${item.variantName})` : '';
          return res.status(400).json({
            success: false,
            message: `Only ${availableStock} items are available in stock for ${product.name}${variantSuffix}.`,
          });
        }
      }
    }

    const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const { discount, couponCode } = await resolveServerQuickDiscount({
      couponCode: req.body?.couponCode,
      subtotal,
      items,
    });
    let deliveryAddress = normalizeDeliveryAddress(req.body?.address);

    if (idQuery.userId) {
      const customerUser = await FoodUser.findById(idQuery.userId)
        .select('name phone email')
        .lean();
      if (deliveryAddress) {
        if (!deliveryAddress.name && customerUser?.name) {
          deliveryAddress.name = String(customerUser.name).trim();
        }
        if (!deliveryAddress.phone && customerUser?.phone) {
          deliveryAddress.phone = String(customerUser.phone).trim();
        }
      }
    }

    // Calculate precise distance between seller and delivery address
    const firstProduct = products[0];
    const sellerId = firstProduct?.sellerId;
    const seller = sellerId ? await Seller.findById(sellerId).select('location').lean() : null;

    let distanceKm = 0.1; // Default fallback distance if coordinates are missing
    if (seller && deliveryAddress) {
      const sellerCoords = getSellerLocation(seller);
      const deliveryCoords = getOrderAddressPoint({ deliveryAddress });
      if (sellerCoords && deliveryCoords) {
        distanceKm = await roadDistanceKm(sellerCoords.lat, sellerCoords.lng, deliveryCoords.lat, deliveryCoords.lng);
      }
    }

    const { pricing } = await calculateQuickPricing({
      subtotal,
      discount,
      products,
      distanceKm,
    });

    // Mongoose pricingSchema only has 'tax', not 'gst'. Map gst to tax so it gets saved.
    pricing.tax = pricing.gst;

    // Recalculate total with these synced values
    pricing.total = Math.max(0, subtotal + pricing.deliveryFee + pricing.platformFee + pricing.tax - discount);

    const deliveryFee = Number(pricing.deliveryFee || 0);
    const total = Number(pricing.total || 0);
    const orderNumber = `QC${Date.now().toString().slice(-8)}`;
    const paymentModeRaw = String(req.body?.paymentMode || 'COD').toUpperCase();
    const isOnlinePayment = paymentModeRaw === 'ONLINE';
    const isWalletPayment = paymentModeRaw === 'WALLET';
    const paymentMode = isOnlinePayment ? 'razorpay' : isWalletPayment ? 'wallet' : 'cash';
    const sellerPaymentMode = isOnlinePayment || isWalletPayment ? 'online' : 'cash';
    // Online orders reach sellers only after Razorpay payment is verified.
    const shouldFanOutSellerOrders = !isOnlinePayment;

    if (isWalletPayment && !idQuery.userId) {
      return res.status(400).json({
        success: false,
        message: 'Please log in to pay with wallet',
      });
    }

    const paymentSettings = await getGlobalPaymentSettings();
    const paymentCheck = assertPaymentMethodAllowed(paymentMode, paymentSettings);
    if (!paymentCheck.allowed) {
      return res.status(400).json({
        success: false,
        message: paymentCheck.message,
      });
    }

    // Calculate rider earning using actual distance
    const riderEarning = await getQuickRiderEarning(distanceKm);

    const sellerBuckets = new Map();
    // @deprecated multi-seller bucketing — validated to single seller above; kept for SellerOrder fan-out.
    items.forEach((item) => {
      const bucketSellerId = item.sellerId ? String(item.sellerId) : '';
      if (!bucketSellerId) return;
      if (!sellerBuckets.has(bucketSellerId)) sellerBuckets.set(bucketSellerId, []);
      sellerBuckets.get(bucketSellerId).push(item);
    });

    const sellerIdsForPickup = [...sellerBuckets.keys()];
    const sellersForPickup = sellerIdsForPickup.length
      ? await Seller.find({ _id: { $in: sellerIdsForPickup } })
          .select('shopName name phone location shopInfo')
          .lean()
      : [];
    const sellerPickupMap = sellersForPickup.reduce((acc, sellerDoc) => {
      acc[String(sellerDoc._id)] = sellerDoc;
      return acc;
    }, {});
    const pickupPoints = sellerIdsForPickup
      .map((bucketSellerId) => buildQuickPickupPointFromSeller(sellerPickupMap[bucketSellerId], bucketSellerId))
      .filter(Boolean);
    const sellerNameById = sellerIdsForPickup.reduce((acc, bucketSellerId) => {
      const sellerDoc = sellerPickupMap[bucketSellerId];
      acc[bucketSellerId] = String(sellerDoc?.shopName || sellerDoc?.name || 'Store').trim();
      return acc;
    }, {});

    const quickSessionId = getQuickSessionIdFromRequest(req);

    const order = await QuickOrder.create({
      orderType: 'quick',
      orderId: orderNumber,
      sessionId: quickSessionId || idQuery.sessionId || '',
      userId: idQuery.userId || null,
      items: items.map((item) => ({
        itemId: String(item.productId),
        name: item.name,
        image: item.image,
        price: item.price,
        quantity: item.quantity,
        type: 'quick',
        sourceId: String(item.sellerId || item.productId),
        sourceName: sellerNameById[String(item.sellerId || '')] || '',
        variantName: item.variantName || '',
        notes: item.variantName || '',
      })),
      pickupPoints,
      pricing: {
        ...pricing,
        subtotal,
        discount,
        couponCode: couponCode || null,
        total,
      },
      deliveryAddress,
      timeSlot: req.body?.timeSlot || 'now',
      payment: {
        method: paymentMode,
        status: isOnlinePayment ? 'created' : isWalletPayment ? 'paid' : 'cod_pending',
        amountDue: Math.max(0, total),  // total already includes platformFee
      },
      orderStatus: 'placed',
      riderEarning: riderEarning || 0,
      platformProfit: Math.max(
        0,
        deliveryFee + Number(pricing.platformFee || 0) - (riderEarning || 0),
      ), // Initial guess, will be updated with commission
      statusHistory: [
        {
          byRole: 'SYSTEM',
          from: '',
          to: 'placed',
          note: 'Quick commerce order placed',
        },
      ],
    });

    let razorpayPayload = null;

    if (paymentMode === "razorpay" && isRazorpayConfigured()) {
      const amountPaise = Math.round(total * 100);
      if (amountPaise >= 100) {
        try {
          const rzOrder = await createRazorpayOrder(amountPaise, "INR", order.orderId);
          order.payment.razorpay = {
            orderId: rzOrder.id,
            paymentId: "",
            signature: "",
          };
          order.payment.status = "created";
          razorpayPayload = {
            key: getRazorpayKeyId(),
            orderId: rzOrder.id,
            amount: rzOrder.amount,
            currency: rzOrder.currency || "INR",
          };
          await order.save();
        } catch (err) {
          logger.error(`Quick Razorpay order creation failed: ${err?.message || err}`);
        }
      }
    }

    if (isWalletPayment) {
      try {
        await deductWalletBalance(
          idQuery.userId,
          total,
          'Quick commerce order payment',
          {
            orderId: order.orderId,
            source: 'quick_order_payment',
            orderType: 'quick',
          },
        );
      } catch (walletErr) {
        await QuickOrder.deleteOne({ _id: order._id });
        return res.status(400).json({
          success: false,
          message: walletErr?.message || 'Insufficient wallet balance',
        });
      }
    }

    let stockAdjusted = false;
    try {
      if (!isOnlinePayment) {
        await decrementQuickOrderItemsStock(items);
        stockAdjusted = true;
      }
    } catch (stockErr) {
      logger.error(
        `Quick stock deduction failed for ${order.orderId}: ${stockErr?.message || stockErr}`,
      );

      if (isWalletPayment && idQuery.userId) {
        try {
          await refundWalletBalance(
            idQuery.userId,
            total,
            'Quick commerce order payment reversal',
            {
              orderId: order.orderId,
              source: 'quick_order_payment_reversal',
              orderType: 'quick',
            },
          );
        } catch (refundErr) {
          logger.error(
            `Quick wallet refund reversal failed for ${order.orderId}: ${refundErr?.message || refundErr}`,
          );
        }
      }

      await QuickOrder.deleteOne({ _id: order._id });

      return res.status(409).json({
        success: false,
        message: 'Some items are no longer available. Please refresh your cart and try again.',
      });
    }

    const sellerOrdersResults = sellerBuckets.size > 0
        ? await Promise.all(Array.from(sellerBuckets.entries()).map(async ([sellerId, sellerItems]) => {
            const sellerSubtotal = sellerItems.reduce(
              (sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0),
              0,
            );
            const allocatedDeliveryFee = Number(
              ((deliveryFee * sellerSubtotal) / Math.max(subtotal, 1)).toFixed(2),
            );

            // Calculate commission for this specific seller
            const { commissionAmount } = await getSellerCommissionSnapshot(sellerId, sellerSubtotal);
            const sellerReceivable = Math.max(
              0,
              Number((sellerSubtotal - commissionAmount).toFixed(2)),
            );

            return {
              orderType: 'quick',
              parentOrderId: order._id,
              sellerId,
              orderId: order.orderId,
              customer: {
                name: String(req.body?.address?.name || 'Customer').trim() || 'Customer',
                phone: String(req.body?.address?.phone || '').trim(),
              },
              items: sellerItems.map((item) => ({
                productId: item.productId,
                name: item.name,
                price: item.price,
                quantity: item.quantity,
                image: item.image,
                variantName: item.variantName || '',
              })),
              pricing: {
                subtotal: sellerSubtotal,
                commission: commissionAmount,
                total: sellerSubtotal + allocatedDeliveryFee,
                receivable: sellerReceivable,
              },
              status: 'pending',
              workflowStatus: 'SELLER_PENDING',
              sellerPendingExpiresAt: new Date(Date.now() + 2 * 60 * 1000),
              address: {
                address: deliveryAddress?.street || '',
                city: deliveryAddress?.city || '',
                ...(deliveryAddress?.state
                  ? { state: deliveryAddress.state }
                  : {}),
                ...(deliveryAddress?.zipCode
                  ? { zipCode: deliveryAddress.zipCode }
                  : {}),
                ...(Array.isArray(deliveryAddress?.location?.coordinates)
                  ? {
                      location: {
                        lat: deliveryAddress.location.coordinates[1],
                        lng: deliveryAddress.location.coordinates[0],
                      },
                    }
                  : {}),
              },
              payment: {
                method: sellerPaymentMode,
              },
            };
          }))
        : [];

    const totalSellerCommission = sellerOrdersResults.reduce((sum, so) => sum + (so.pricing?.commission || 0), 0);
    
    // Update the main order with the total commission
    if (totalSellerCommission > 0) {
      const platformProfit = Math.max(
        0,
        deliveryFee +
          Number(pricing.platformFee || 0) +
          totalSellerCommission -
          (riderEarning || 0),
      );
      await QuickOrder.updateOne(
        { _id: order._id },
        { 
          $set: { 
            'pricing.restaurantCommission': totalSellerCommission,
            platformProfit: platformProfit
          } 
        }
      );
      order.pricing.restaurantCommission = totalSellerCommission;
      order.platformProfit = platformProfit;
    }

    const sellerOrders = sellerOrdersResults;

    try {
      await foodTransactionService.createInitialTransaction(order);
    } catch (txnErr) {
      logger.error(
        `Quick createInitialTransaction failed for ${order.orderId}: ${txnErr?.message || txnErr}`,
      );
    }

    try {
      await QuickCart.findOneAndUpdate(idQuery, { $set: { items: [] } }, { upsert: false });
    } catch (cartErr) {
      logger.error(`Quick cart clear failed for ${order.orderId}: ${cartErr?.message || cartErr}`);
      if (stockAdjusted) {
        try {
          await restoreQuickOrderItemsStock(order.items);
        } catch (restoreErr) {
          logger.error(
            `Quick stock restore failed after cart clear failure for ${order.orderId}: ${
              restoreErr?.message || restoreErr
            }`,
          );
        }
      }
      if (isWalletPayment && idQuery.userId) {
        try {
          await refundWalletBalance(
            idQuery.userId,
            total,
            'Quick commerce order payment reversal',
            {
              orderId: order.orderId,
              source: 'quick_order_payment_reversal',
              orderType: 'quick',
            },
          );
        } catch (refundErr) {
          logger.error(
            `Quick wallet refund reversal failed for ${order.orderId}: ${refundErr?.message || refundErr}`,
          );
        }
      }
      await QuickOrder.deleteOne({ _id: order._id });
      return res.status(500).json({
        success: false,
        message: 'Failed to finalize order. Please try again.',
      });
    }

    emitQuickOrderStatusUpdate(order, 'Quick order placed successfully.');

    if (shouldFanOutSellerOrders) {
      void fanOutQuickSellerOrdersForParent(order).catch((error) => {
        logger.error(`Quick seller order fanout failed for ${order.orderId}: ${error?.message || error}`);
      });
    }

    return res.status(201).json({
      success: true,
      result: normalizeOrderSummary(order),
      razorpay: razorpayPayload,
    });
  } catch (error) {
    logger.error(`Quick placeOrder failed: ${error?.message || error}`);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to place quick order',
    });
  }
};

export const verifyPayment = async (req, res) => {
  try {
    const accessQuery = buildOrderAccessQuery(req);
    if (!accessQuery) {
      return res.status(400).json({ success: false, message: 'sessionId or userId is required' });
    }

    const rawOrderId = String(req.params.orderId || '').trim();
    if (!rawOrderId) {
      return res.status(400).json({ success: false, message: 'orderId is required' });
    }

    const razorpayPaymentId = String(
      req.body?.razorpay_payment_id || req.body?.razorpayPaymentId || '',
    ).trim();
    const razorpayOrderId = String(
      req.body?.razorpay_order_id || req.body?.razorpayOrderId || '',
    ).trim();
    const razorpaySignature = String(
      req.body?.razorpay_signature || req.body?.razorpaySignature || '',
    ).trim();

    if (!razorpayPaymentId || !razorpayOrderId || !razorpaySignature) {
      return res.status(400).json({ success: false, message: 'Invalid payment verification payload' });
    }

    const orderIdentityQuery = [{ orderId: rawOrderId }];
    if (mongoose.isValidObjectId(rawOrderId)) {
      orderIdentityQuery.unshift({ _id: rawOrderId });
    }

    const order = await QuickOrder.findOne({
      orderType: 'quick',
      $and: [
        accessQuery,
        { $or: orderIdentityQuery },
      ],
    });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    if (order.payment?.status === 'paid') {
      return res.json({ success: true, message: 'Payment already verified' });
    }

    const expectedRazorpayOrderId = String(order.payment?.razorpay?.orderId || '').trim();
    if (!expectedRazorpayOrderId || razorpayOrderId !== expectedRazorpayOrderId) {
      return res.status(400).json({ success: false, message: 'Payment order mismatch' });
    }

    const isValid = verifyPaymentSignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);
    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Invalid payment signature' });
    }

    if (isRazorpayConfigured()) {
      const fetchedPayment = await fetchRazorpayPayment(razorpayPaymentId);
      const fetchedOrderId = String(fetchedPayment?.order_id || '').trim();
      const fetchedStatus = String(fetchedPayment?.status || '').toLowerCase();
      const fetchedAmount = Number(fetchedPayment?.amount || 0);
      const expectedAmount = Math.round(Number(order.payment?.amountDue || order.pricing?.total || 0) * 100);
      if (fetchedOrderId !== expectedRazorpayOrderId) {
        return res.status(400).json({ success: false, message: 'Payment order mismatch' });
      }
      if (fetchedStatus !== 'captured') {
        return res.status(400).json({ success: false, message: 'Payment not captured' });
      }
      if (!Number.isFinite(expectedAmount) || expectedAmount < 100 || fetchedAmount !== expectedAmount) {
        return res.status(400).json({ success: false, message: 'Payment amount mismatch' });
      }
    }

    const paidOrder = await QuickOrder.findOneAndUpdate(
      {
        _id: order._id,
        'payment.status': { $ne: 'paid' },
      },
      {
        $set: {
          'payment.status': 'paid',
          'payment.razorpay.paymentId': razorpayPaymentId,
          'payment.razorpay.signature': razorpaySignature,
        },
      },
      { new: true },
    );
    if (!paidOrder) {
      const latest = await QuickOrder.findById(order._id).select('payment.status').lean();
      if (String(latest?.payment?.status || '').toLowerCase() === 'paid') {
        return res.json({ success: true, message: 'Payment already verified' });
      }
      return res.status(409).json({ success: false, message: 'Payment verification in progress. Retry once.' });
    }

    try {
      await decrementQuickOrderItemsStock(
        Array.isArray(paidOrder.items)
          ? paidOrder.items.map((item) => ({
              productId: item.itemId || item.productId,
              quantity: item.quantity,
              variantName: item.variantName || item.notes || '',
              variantKey: item.variantKey || '',
              variantSku: item.variantSku || '',
            }))
          : [],
      );
    } catch (stockErr) {
      await QuickOrder.updateOne(
        { _id: paidOrder._id, 'payment.razorpay.paymentId': razorpayPaymentId },
        {
          $set: {
            'payment.status': 'created',
            'payment.razorpay.paymentId': '',
            'payment.razorpay.signature': '',
          },
        },
      );
      throw stockErr;
    }

    try {
      const existingTxn = await FoodTransaction.findOne({ orderId: paidOrder._id }).select('_id').lean();
      if (!existingTxn) {
        await foodTransactionService.createInitialTransaction(paidOrder);
      }
      await foodTransactionService.updateTransactionStatus(paidOrder._id, 'captured', {
        status: 'captured',
        razorpayPaymentId: razorpayPaymentId,
        razorpaySignature: razorpaySignature,
        note: 'Quick commerce payment verified',
        recordedByRole: 'USER',
        recordedById: paidOrder.userId,
      });
    } catch (txnErr) {
      logger.error(
        `Quick verifyPayment transaction sync failed for ${paidOrder.orderId}: ${txnErr?.message || txnErr}`,
      );
    }

    await fanOutQuickSellerOrdersForParent(paidOrder);

    return res.json({ success: true, message: 'Payment verified successfully' });
  } catch (error) {
    logger.error(`Quick verifyPayment failed: ${error?.message || error}`);
    return res.status(500).json({ success: false, message: 'Payment verification failed' });
  }
};

export const getMyOrders = async (req, res) => {
  const accessQuery = buildOrderAccessQuery(req);

  if (!accessQuery) {
    return res.status(400).json({ success: false, message: 'sessionId or userId is required' });
  }

  const orders = await QuickOrder.find({ ...accessQuery, orderType: 'quick' }).sort({ createdAt: -1 }).lean();

  const sellerIds = [
    ...new Set(
      orders
        .map((order) =>
          String(order?.items?.find((item) => item?.type === 'quick')?.sourceId || order?.items?.[0]?.sourceId || '').trim(),
        )
        .filter((value) => mongoose.Types.ObjectId.isValid(value)),
    ),
  ];

  const sellers = sellerIds.length
    ? await Seller.find({ _id: { $in: sellerIds } }).select('_id name shopName').lean()
    : [];
  const sellerMap = sellers.reduce((acc, seller) => {
    acc[String(seller._id)] = seller;
    return acc;
  }, {});

  const mappedOrders = orders.map((order) => {
    const normalized = normalizeOrderSummary(order);
    const sellerId = String(
      order?.items?.find((item) => item?.type === 'quick')?.sourceId || order?.items?.[0]?.sourceId || '',
    ).trim();
    const seller = sellerMap[sellerId] || null;

    return {
      ...normalized,
      sellerId: seller?._id || null,
      storeName: seller?.shopName || seller?.name || '',
      seller: seller
        ? {
            _id: seller._id,
            name: seller.name || '',
            shopName: seller.shopName || seller.name || 'Store',
          }
        : null,
    };
  });

  return res.json({
    success: true,
    result: mappedOrders,
    results: mappedOrders,
  });
};

export const getOrderById = async (req, res) => {
  try {
    const accessQuery = buildOrderAccessQuery(req);

    if (!accessQuery) {
      return res.status(400).json({ success: false, message: 'sessionId or userId is required' });
    }

    const rawOrderId = String(req.params.orderId || '').trim();
    if (!rawOrderId) {
      return res.status(400).json({ success: false, message: 'orderId is required' });
    }

    const orderIdentityQuery = [{ orderId: rawOrderId }];
    if (mongoose.isValidObjectId(rawOrderId)) {
      orderIdentityQuery.unshift({ _id: rawOrderId });
    }

    const query = {
      orderType: 'quick',
      $and: [
        accessQuery,
        { $or: orderIdentityQuery },
      ],
    };

    const order = await QuickOrder.findOne(query).select('+deliveryOtp').lean();

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const sellerOrder = await SellerOrder.findOne({ orderId: order.orderId }).lean();
    const seller =
      sellerOrder?.sellerId
        ? await Seller.findById(sellerOrder.sellerId).select('_id name shopName location').lean()
        : null;

    const deliveryAddress = order.deliveryAddress || {};
    const deliveryCoords = Array.isArray(deliveryAddress.location?.coordinates)
      ? {
          lat: Number(deliveryAddress.location.coordinates[1]),
          lng: Number(deliveryAddress.location.coordinates[0]),
        }
      : null;
    const dropOtp = order.deliveryVerification?.dropOtp || {};
    const handoverOtp = String(order.deliveryOtp || '').trim();
    const feeSettings = await getActiveFeeSettings();
    const sellerOrders = sellerOrder ? [sellerOrder] : [];
    const returnEligibility = buildReturnEligibilityMeta({
      order,
      sellerOrders,
      feeSettings,
    });

    return res.json({
      success: true,
      result: {
        ...order,
        id: order._id,
        _id: order._id,
        orderNumber: order.orderId,
        orderId: order.orderId,
        returnEligibility,
        ...returnEligibility,
        address: {
          type: deliveryAddress.label || 'Other',
          name: '',
          address: deliveryAddress.street || '',
          city: deliveryAddress.city || '',
          phone: deliveryAddress.phone || '',
          ...(deliveryCoords ? { location: deliveryCoords } : {}),
        },
        seller: seller
          ? {
              _id: seller._id,
              id: seller._id,
              name: seller.shopName || seller.name || 'Store',
              shopName: seller.shopName || seller.name || 'Store',
              location: seller.location || null,
            }
          : null,
        sellerOrder: sellerOrder
          ? {
              _id: sellerOrder._id,
              status: sellerOrder.status,
              workflowStatus: sellerOrder.workflowStatus,
              address: sellerOrder.address || null,
            }
          : null,
        payment: order.payment || {},
        paymentMethod: order.payment?.method || '',
        paymentStatus: order.payment?.status || '',
        deliveryVerification: {
          ...(order.deliveryVerification || {}),
          dropOtp: {
            required: Boolean(dropOtp.required),
            verified: Boolean(dropOtp.verified),
          },
        },
        ...(dropOtp.required && !dropOtp.verified && handoverOtp
          ? { handoverOtp }
          : {}),
      },
    });
  } catch (error) {
    logger.error(`Quick getOrderById failed: ${error?.message || error}`);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to load quick order',
    });
  }
};

export const cancelOrder = async (req, res) => {
  try {
    const accessQuery = buildOrderAccessQuery(req);

    if (!accessQuery) {
      return res.status(400).json({ success: false, message: 'sessionId or userId is required' });
    }

    const rawOrderId = String(req.params.orderId || '').trim();
    if (!rawOrderId) {
      return res.status(400).json({ success: false, message: 'orderId is required' });
    }

    const orderIdentityQuery = [{ orderId: rawOrderId }];
    if (mongoose.isValidObjectId(rawOrderId)) {
      orderIdentityQuery.unshift({ _id: rawOrderId });
    }

    const query = {
      orderType: 'quick',
      $and: [
        accessQuery,
        { $or: orderIdentityQuery },
      ],
    };

    const order = await QuickOrder.findOne(query);

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const currentStatus = String(order.orderStatus || '').toLowerCase();
    const workflowStatus = String(order.workflowStatus || '').toUpperCase();
    const deliveryPhase = String(order.deliveryState?.currentPhase || '').toLowerCase();
    const terminalStatuses = new Set([
      'picked_up',
      'delivered',
      'cancelled_by_user',
      'cancelled_by_restaurant',
      'cancelled_by_admin',
    ]);
    const nonCancellableWorkflowStatuses = new Set(['OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED']);
    const nonCancellableDeliveryPhases = new Set([
      'en_route_to_delivery',
      'at_drop',
      'delivered',
      'completed',
    ]);

    if (
      terminalStatuses.has(currentStatus) ||
      nonCancellableWorkflowStatuses.has(workflowStatus) ||
      nonCancellableDeliveryPhases.has(deliveryPhase)
    ) {
      return res.status(400).json({
        success: false,
        message: currentStatus === 'delivered'
          ? 'Delivered orders cannot be cancelled'
          : 'Order can no longer be cancelled once delivery is in progress',
      });
    }

    const cancellationReason = String(req.body?.reason || 'Quick commerce order cancelled by user').trim();
    const paymentMethod = String(order.payment?.method || '').trim().toLowerCase();
    const requestedRefundTo =
      paymentMethod === 'wallet'
        ? 'wallet'
        : req.body?.refundTo === 'wallet' || req.body?.refundTo === 'gateway'
          ? req.body.refundTo
          : 'gateway';

    order.orderStatus = 'cancelled_by_user';
    order.workflowStatus = 'CANCELLED';
    order.statusHistory = Array.isArray(order.statusHistory) ? order.statusHistory : [];
    order.statusHistory.push({
      byRole: 'USER',
      from: currentStatus || '',
      to: 'cancelled_by_user',
      note: cancellationReason,
    });

    if (order.payment?.method === 'cash' && order.payment?.status !== 'paid') {
      order.payment.status = 'failed';
    }

    const refundResult = await processQuickOrderRefund(order, {
      refundTo: requestedRefundTo,
      cancelledBy: 'user',
      reason: cancellationReason,
    });

    const shouldRestoreStock =
      order.payment?.method !== 'razorpay' ||
      ['paid', 'refunded'].includes(String(order.payment?.status || '').toLowerCase());
    if (shouldRestoreStock) {
      await restoreQuickOrderItemsStock(order.items);
    }
    await order.save();

    try {
      const isOnlinePaid =
        String(order.payment?.status || '').toLowerCase() === 'paid' ||
        String(order.payment?.status || '').toLowerCase() === 'refunded';
      await foodTransactionService.updateTransactionStatus(order._id, 'cancelled_by_user', {
        status:
          order.payment?.status === 'refunded'
            ? 'refunded'
            : isOnlinePaid
              ? 'captured'
              : 'failed',
        note: cancellationReason,
        recordedByRole: 'USER',
        recordedById: order.userId,
      });
    } catch (txnErr) {
      logger.warn(
        `Quick cancelOrder transaction sync failed for ${order.orderId}: ${txnErr?.message || txnErr}`,
      );
    }

    await SellerOrder.updateMany(
      {
        orderId: order.orderId,
        status: { $nin: ['cancelled', 'delivered'] },
      },
      {
        $set: {
          status: 'cancelled',
          workflowStatus: 'CANCELLED',
          cancellationReason,
        },
      },
    );

    const cancellationMessage =
      refundResult?.message || 'Quick order cancelled successfully.';
    emitQuickOrderStatusUpdate(order, cancellationMessage);

    return res.json({
      success: true,
      message: cancellationMessage,
      refund: refundResult || null,
      result: {
        id: order._id,
        _id: order._id,
        orderId: order.orderId,
        orderNumber: order.orderId,
        status: order.orderStatus,
        payment: order.payment || {},
      },
    });
  } catch (error) {
    logger.error(`Quick cancelOrder failed: ${error?.message || error}`);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to cancel quick order',
    });
  }
};

export async function submitOrderRatingsController(req, res, next) {
  try {
    const userId = req.user?.userId;
    const orderId = req.params.orderId;
    const dto = validateOrderRatingsDto(req.body);
    const order = await orderService.submitOrderRatings(orderId, userId, dto);
    return sendResponse(res, 200, 'Ratings submitted successfully', { order });
  } catch (err) {
    next(err);
  }
};

