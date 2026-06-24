import { QuickProduct } from '../models/product.model.js';
import { logger } from '../../../utils/logger.js';
import { matchProductVariant } from './variant.helpers.js';

const recalculateParentStock = async (productId) => {
  const updated = await QuickProduct.findById(productId).select('variants').lean();
  if (!updated) return;
  const variants = Array.isArray(updated.variants) ? updated.variants : [];
  if (!variants.length) return;
  const totalStock = variants.reduce(
    (sum, variant) => sum + Math.max(0, Number(variant?.stock) || 0),
    0,
  );
  await QuickProduct.updateOne({ _id: productId }, { $set: { stock: totalStock } });
};

const applyVariantStockDelta = async (productId, variantName, delta) => {
  const result = await QuickProduct.updateOne(
    { _id: productId },
    { $inc: { 'variants.$[elem].stock': delta } },
    { arrayFilters: [{ 'elem.name': variantName }] },
  );

  if (result.modifiedCount > 0) return true;

  const product = await QuickProduct.findById(productId).select('variants').lean();
  const variant = matchProductVariant(product, { variantName });
  if (!variant?.name || variant.name === variantName) return false;

  const retry = await QuickProduct.updateOne(
    { _id: productId },
    { $inc: { 'variants.$[elem].stock': delta } },
    { arrayFilters: [{ 'elem.name': variant.name }] },
  );
  return retry.modifiedCount > 0;
};

export const adjustQuickProductStock = async (
  productId,
  quantity,
  { variantName = '', variantKey = '', variantSku = '' } = {},
) => {
  const delta = Number(quantity);
  if (!productId || !Number.isFinite(delta) || delta === 0) return;

  const product = await QuickProduct.findById(productId).select('variants stock').lean();
  if (!product) return;

  const variants = Array.isArray(product.variants) ? product.variants : [];

  if (variants.length > 0) {
    const variant = matchProductVariant(product, { variantName, variantKey, variantSku });
    if (!variant?.name) {
      logger.warn(
        `[QuickStock] Variant not found for product ${productId} (${variantName || variantKey || variantSku})`,
      );
      return;
    }

    const applied = await applyVariantStockDelta(productId, variant.name, delta);
    if (!applied) {
      logger.warn(
        `[QuickStock] Failed to adjust variant stock for product ${productId} (${variant.name})`,
      );
      return;
    }

    await recalculateParentStock(productId);
    return;
  }

  await QuickProduct.updateOne({ _id: productId }, { $inc: { stock: delta } });
};

export const decrementQuickOrderItemsStock = async (items = []) => {
  for (const item of items) {
    await adjustQuickProductStock(item.productId, -Number(item.quantity || 0), {
      variantName: item.variantName || '',
      variantKey: item.variantKey || '',
      variantSku: item.variantSku || '',
    });
  }
};

export const restoreQuickOrderItemsStock = async (orderItems = []) => {
  for (const item of orderItems) {
    const productId = item.itemId || item.productId;
    if (!productId) continue;
    await adjustQuickProductStock(productId, Number(item.quantity || 0), {
      variantName: item.variantName || item.notes || '',
      variantKey: item.variantKey || '',
      variantSku: item.variantSku || '',
    });
  }
};
