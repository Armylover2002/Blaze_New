import { ValidationError } from '../../../../core/auth/errors.js';

/**
 * Deprecated alternate calculator.
 * Kept only so old imports fail closed instead of trusting client item prices.
 * Live pricing must go through `calculateOrder` in `order.service.js`.
 */
export async function calculateOrderPricing() {
  throw new ValidationError(
    'Deprecated order calculator is disabled. Use calculateOrder (order.service) which resolves item prices and fees server-side.',
  );
}
