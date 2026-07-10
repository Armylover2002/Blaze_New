export const DEFAULT_RESTAURANT_COMMISSION_PERCENTAGE = 15;

export function resolveRestaurantCommissionPercentage(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num === 0) {
    return DEFAULT_RESTAURANT_COMMISSION_PERCENTAGE;
  }
  return num;
}

export function isCustomRestaurantCommission(value) {
  return resolveRestaurantCommissionPercentage(value) !== DEFAULT_RESTAURANT_COMMISSION_PERCENTAGE;
}
