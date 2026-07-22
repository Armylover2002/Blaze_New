import { QuickProduct } from '../models/product.model.js';
import { logger } from '../../../utils/logger.js';
import { matchProductVariant } from './variant.helpers.js';

const recalculateParentStock = async (productId) => {
  // Atomic pipeline update: recompute the parent stock as the sum of variant
  // stocks (floored at 0) directly from the current document state. This is a
  // single round-trip and is race-free (no read-modify-write), so concurrent
  // stock adjustments to the same product can't clobber each other.
  await QuickProduct.updateOne(
    { _id: productId, variants: { $exists: true, $ne: [] } },
    [
      {
        $set: {
          stock: {
            $sum: {
              $map: {
                input: { $ifNull: ['$variants', []] },
                as: 'variant',
                in: { $max: [0, { $ifNull: ['$$variant.stock', 0] }] },
              },
            },
          },
        },
      },
    ],
  );
};

const applyVariantStockDelta = async (productId, variantName, delta) => {
  const filter = { _id: productId };
  const arrayFilters = [{ 'elem.name': variantName }];

  // Prevent oversell: only decrement when the variant has enough stock.
  if (delta < 0) {
    arrayFilters[0]['elem.stock'] = { $gte: Math.abs(delta) };
  }

  const result = await QuickProduct.updateOne(
    filter,
    { $inc: { 'variants.$[elem].stock': delta } },
    { arrayFilters },
  );

  if (result.modifiedCount > 0) return true;

  const product = await QuickProduct.findById(productId).select('variants').lean();
  const variant = matchProductVariant(product, { variantName });
  if (!variant?.name || variant.name === variantName) return false;

  const retryFilters = [{ 'elem.name': variant.name }];
  if (delta < 0) {
    retryFilters[0]['elem.stock'] = { $gte: Math.abs(delta) };
  }

  const retry = await QuickProduct.updateOne(
    { _id: productId },
    { $inc: { 'variants.$[elem].stock': delta } },
    { arrayFilters: retryFilters },
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

  const parentFilter = { _id: productId };
  if (delta < 0) {
    parentFilter.stock = { $gte: Math.abs(delta) };
  }

  const result = await QuickProduct.updateOne(parentFilter, { $inc: { stock: delta } });
  if (result.modifiedCount === 0 && delta < 0) {
    logger.warn(`[QuickStock] Insufficient parent stock for product ${productId}`);
  }
};

/**
 * Runs stock adjustments grouped by productId: items for the SAME product are
 * processed sequentially (preserving inc -> parent-recalc ordering per product),
 * while DIFFERENT products are processed in parallel. This removes the previous
 * fully-sequential N+1 (one item at a time) without introducing races between
 * variants of the same product.
 */
const runGroupedStockAdjustments = async (adjustments) => {
  const groups = new Map();
  for (const adjustment of adjustments) {
    if (!adjustment?.productId) continue;
    const key = String(adjustment.productId);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(adjustment);
  }

  await Promise.all(
    Array.from(groups.values()).map(async (group) => {
      for (const { productId, delta, options } of group) {
        await adjustQuickProductStock(productId, delta, options);
      }
    }),
  );
};

export const decrementQuickOrderItemsStock = async (items = []) => {
  await runGroupedStockAdjustments(
    items.map((item) => ({
      productId: item.productId,
      delta: -Number(item.quantity || 0),
      options: {
        variantName: item.variantName || '',
        variantKey: item.variantKey || '',
        variantSku: item.variantSku || '',
      },
    })),
  );
};

export const restoreQuickOrderItemsStock = async (orderItems = []) => {
  await runGroupedStockAdjustments(
    orderItems.map((item) => ({
      productId: item.itemId || item.productId,
      delta: Number(item.quantity || 0),
      options: {
        variantName: item.variantName || item.notes || '',
        variantKey: item.variantKey || '',
        variantSku: item.variantSku || '',
      },
    })),
  );
};
