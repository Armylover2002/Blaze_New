export const DEFAULT_RESTAURANT_COMMISSION_PERCENTAGE = 15;

export const DEFAULT_RESTAURANT_COMMISSION_RATE =
  DEFAULT_RESTAURANT_COMMISSION_PERCENTAGE / 100;

/**
 * Treats unset or legacy zero values as the platform default commission.
 */
export function resolveRestaurantCommissionPercentage(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num === 0) {
    return DEFAULT_RESTAURANT_COMMISSION_PERCENTAGE;
  }
  return num;
}
