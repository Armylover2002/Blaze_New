import mongoose from 'mongoose';
import { QuickCart } from '../models/cart.model.js';
import { QuickProduct } from '../models/product.model.js';
import { Seller } from '../seller/models/seller.model.js';
import { calculateQuickPricing } from '../admin/services/billing.service.js';
import { isStoreCurrentlyOpen } from '../utils/timeFormat.helpers.js';
import {
  buildCartLineKey,
  matchProductVariant,
  resolveVariantLabel,
  resolveVariantStock,
  resolveVariantUnitPrice,
  stripCompositeProductId,
} from '../utils/variant.helpers.js';
import {
  assertNoSellerMismatch,
  collectSellerIdsFromProducts,
  resolveProductSellerId,
  SELLER_MISMATCH_CODE,
} from '../utils/singleSeller.helpers.js';

import { publicProductVisibilityFilter } from '../utils/productVisibility.helpers.js';

const approvedProductFilter = publicProductVisibilityFilter;

const resolveId = (req) => {
  if (req.user?.userId) return { userId: req.user.userId };
  const sessionId = String(req.headers['x-quick-session'] || req.query.sessionId || req.body.sessionId || '').trim();
  return sessionId ? { sessionId } : null;
};

const buildCartInsertDoc = (idQuery) => {
  if (!idQuery) return { items: [] };
  if (idQuery.userId) {
    return {
      userId: idQuery.userId,
      sessionId: `user:${String(idQuery.userId)}`,
      items: [],
    };
  }
  return {
    sessionId: String(idQuery.sessionId || '').trim(),
    items: [],
  };
};

const mapCart = async (idQuery) => {
  const cart = await QuickCart.findOne(idQuery).lean();
  if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) {
    return { items: [], subtotal: 0, total: 0 };
  }

  const productIds = cart.items
    .map((item) => item.productId)
    .filter((id) => mongoose.isValidObjectId(id));

  const products = await QuickProduct.find({ _id: { $in: productIds }, ...approvedProductFilter }).lean();
  const productMap = products.reduce((acc, product) => {
    acc[String(product._id)] = product;
    return acc;
  }, {});

  const items = cart.items
    .map((item) => {
      const product = productMap[String(item.productId)];
      if (!product) return null;

      const variantMeta = {
        variantName: item.variantName || '',
        variantKey: item.variantKey || '',
        variantSku: item.variantSku || '',
        price: Number(item.unitPrice || 0),
      };
      const unitPrice = resolveVariantUnitPrice(product, variantMeta);
      const mrp = Number(product.mrp || product.price || unitPrice || 0);
      const variantLabel = resolveVariantLabel(product, variantMeta);
      const lineKey = buildCartLineKey(
        product._id,
        variantMeta.variantKey,
        variantMeta.variantName,
      );

      return {
        id: lineKey,
        productId: String(product._id),
        categoryId: product.categoryId ? String(product.categoryId) : null,
        subcategoryId: product.subcategoryId ? String(product.subcategoryId) : null,
        headerId: product.headerId ? String(product.headerId) : null,
        name: product.name,
        image: product.mainImage || product.image || '',
        mainImage: product.mainImage || product.image || '',
        price: unitPrice,
        salePrice: Number(product.salePrice || 0),
        mrp,
        originalPrice: mrp,
        unit: product.unit,
        stock: resolveVariantStock(product, variantMeta),
        quantity: item.quantity,
        lineTotal: item.quantity * unitPrice,
        variantName: variantLabel,
        variantKey: variantMeta.variantKey,
        variantSku: variantMeta.variantSku,
        sellerId: product.sellerId ? String(product.sellerId) : '',
        quickStoreId: product.sellerId ? String(product.sellerId) : '',
        selectedVariant: variantLabel
          ? {
              name: variantLabel,
              sku: variantMeta.variantSku,
              _id: variantMeta.variantKey,
              price: unitPrice,
              salePrice: unitPrice,
              stock: resolveVariantStock(product, variantMeta),
            }
          : null,
        packingFee: Number(product.packingFee || 0),
      };
    })
    .filter(Boolean);

  const subtotal = items.reduce((acc, item) => acc + item.lineTotal, 0);
  const totalPackingFee = items.reduce((acc, item) => acc + (item.packingFee * item.quantity), 0);
  const { pricing } = await calculateQuickPricing({
    subtotal,
    products,
    packagingFee: totalPackingFee,
    items: items.map((item) => ({
      productId: item.productId,
      price: item.price,
      quantity: item.quantity,
      lineTotal: item.lineTotal,
    })),
  });

  return {
    items,
    subtotal,
    deliveryFee: Number(pricing?.deliveryFee || 0),
    handlingFee: Number(pricing?.platformFee || 0),
    packagingFee: Number(pricing?.packagingFee || 0),
    tax: Number(pricing?.tax || 0),
    gst: Number(pricing?.gst || 0),
    total: Number(pricing?.total || subtotal),
  };
};

export const getCart = async (req, res) => {
  const idQuery = resolveId(req);

  if (!idQuery) {
    return res.status(400).json({ success: false, message: 'sessionId or userId is required' });
  }

  const cart = await mapCart(idQuery);
  return res.json({ success: true, result: cart });
};

export const addToCart = async (req, res) => {
  const idQuery = resolveId(req);
  const productId = stripCompositeProductId(req.body.productId);
  const quantity = Number(req.body.quantity || 1);
  const variantName = String(req.body.variantName || req.body.selectedVariant?.name || '').trim();
  const variantKey = String(
    req.body.variantKey ||
      req.body.selectedVariant?._id ||
      req.body.selectedVariant?.id ||
      '',
  ).trim();
  const variantSku = String(req.body.variantSku || req.body.selectedVariant?.sku || '').trim();
  const unitPrice = Number(req.body.price || req.body.unitPrice || 0);

  if (!idQuery || !productId) {
    return res.status(400).json({ success: false, message: 'sessionId/userId and productId are required' });
  }

  const product = await QuickProduct.findOne({ _id: productId, ...approvedProductFilter }).lean();
  if (!product) {
    return res.status(404).json({ success: false, message: 'Product not found' });
  }

  // Check seller opening hours
  const sellerId = product.sellerId;
  if (sellerId && mongoose.isValidObjectId(sellerId)) {
    const seller = await Seller.findById(sellerId).lean();
    if (seller) {
      const openingHours = seller.shopInfo?.openingHours || seller.openingHours || '';
      if (!isStoreCurrentlyOpen(openingHours)) {
        return res.status(400).json({ success: false, message: 'SELLER SHOP OFF' });
      }
    }
  }

  const variantMeta = { variantName, variantKey, variantSku, price: unitPrice };
  const availableStock = resolveVariantStock(product, variantMeta);
  const resolvedUnitPrice = resolveVariantUnitPrice(product, variantMeta);

  const cart = await QuickCart.findOneAndUpdate(
    idQuery,
    { $setOnInsert: buildCartInsertDoc(idQuery) },
    { upsert: true, new: true }
  );

  const itemIndex = cart.items.findIndex(
    (item) =>
      String(item.productId) === String(productId) &&
      String(item.variantKey || item.variantName || '') ===
        String(variantKey || variantName || ''),
  );
  const currentQty = itemIndex >= 0 ? cart.items[itemIndex].quantity : 0;
  const targetQty = currentQty + Math.max(1, quantity);

  if (targetQty > availableStock) {
    return res.status(400).json({
      success: false,
      message: `Only ${availableStock} items are available in stock.`,
    });
  }

  if (itemIndex < 0 && cart.items.length > 0) {
    const existingProductIds = cart.items
      .map((item) => item.productId)
      .filter((id) => mongoose.isValidObjectId(id));
    const existingProducts = existingProductIds.length
      ? await QuickProduct.find({ _id: { $in: existingProductIds } })
          .select('sellerId')
          .lean()
      : [];
    const existingSellerIds = collectSellerIdsFromProducts(existingProducts);
    try {
      assertNoSellerMismatch(existingSellerIds, resolveProductSellerId(product));
    } catch (error) {
      return res.status(400).json({
        success: false,
        code: error.code || SELLER_MISMATCH_CODE,
        message: error.message,
      });
    }
  }

  if (itemIndex >= 0) {
    cart.items[itemIndex].quantity = targetQty;
    cart.items[itemIndex].unitPrice = resolvedUnitPrice;
  } else {
    cart.items.push({
      productId,
      quantity: Math.max(1, quantity),
      variantName,
      variantKey,
      variantSku,
      unitPrice: resolvedUnitPrice,
    });
  }

  await cart.save();

  const result = await mapCart(idQuery);
  return res.json({ success: true, result });
};

export const updateCartItem = async (req, res) => {
  const idQuery = resolveId(req);
  const productId = stripCompositeProductId(req.body.productId);
  const variantName = String(req.body.variantName || '').trim();
  const variantKey = String(req.body.variantKey || '').trim();
  const { quantity } = req.body;

  if (!idQuery || !productId) {
    return res.status(400).json({ success: false, message: 'sessionId/userId and productId are required' });
  }

  const qty = Number(quantity);
  const cart = await QuickCart.findOne(idQuery);

  if (!cart) {
    return res.status(404).json({ success: false, message: 'Cart not found' });
  }

  const itemIndex = cart.items.findIndex(
    (item) =>
      String(item.productId) === String(productId) &&
      String(item.variantKey || item.variantName || '') ===
        String(variantKey || variantName || ''),
  );
  if (itemIndex < 0) {
    return res.status(404).json({ success: false, message: 'Cart item not found' });
  }

  if (!Number.isFinite(qty) || qty <= 0) {
    cart.items.splice(itemIndex, 1);
  } else {
    const product = await QuickProduct.findOne({ _id: productId, ...approvedProductFilter }).lean();
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    const cartItem = cart.items[itemIndex];
    const variantMeta = {
      variantName: cartItem.variantName || variantName,
      variantKey: cartItem.variantKey || variantKey,
      variantSku: cartItem.variantSku || '',
      price: Number(cartItem.unitPrice || 0),
    };
    const availableStock = resolveVariantStock(product, variantMeta);
    const targetQty = Math.floor(qty);
    if (targetQty > availableStock) {
      return res.status(400).json({
        success: false,
        message: `Only ${availableStock} items are available in stock.`,
      });
    }
    cart.items[itemIndex].quantity = targetQty;
  }

  await cart.save();
  const result = await mapCart(idQuery);
  return res.json({ success: true, result });
};

export const removeCartItem = async (req, res) => {
  const idQuery = resolveId(req);
  const productId = stripCompositeProductId(req.params.productId);
  const variantKey = String(req.query.variantKey || '').trim();
  const variantName = String(req.query.variantName || '').trim();

  if (!idQuery || !productId) {
    return res.status(400).json({ success: false, message: 'sessionId/userId and productId are required' });
  }

  const cart = await QuickCart.findOne(idQuery);
  if (!cart) {
    return res.status(404).json({ success: false, message: 'Cart not found' });
  }

  cart.items = cart.items.filter(
    (item) =>
      !(
        String(item.productId) === String(productId) &&
        String(item.variantKey || item.variantName || '') ===
          String(variantKey || variantName || '')
      ),
  );
  await cart.save();

  const result = await mapCart(idQuery);
  return res.json({ success: true, result });
};

export const clearCart = async (req, res) => {
  const idQuery = resolveId(req);
  if (!idQuery) {
    return res.status(400).json({ success: false, message: 'sessionId or userId is required' });
  }

  await QuickCart.findOneAndUpdate(
    idQuery,
    {
      $set: { items: [] },
      $setOnInsert: buildCartInsertDoc(idQuery),
    },
    { upsert: true, new: true }
  );
  return res.json({
    success: true,
    result: {
      items: [],
      subtotal: 0,
      deliveryFee: 0,
      handlingFee: 0,
      tax: 0,
      gst: 0,
      total: 0,
    },
  });
};

