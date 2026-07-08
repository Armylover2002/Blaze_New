export function computePorterCouponDiscount(coupon, baseFare) {
  if (!coupon || baseFare == null || baseFare <= 0) return 0;

  const minOrder = Number(coupon.minOrderValue || 0);
  if (baseFare < minOrder) return 0;

  const type = String(coupon.discountType || "").toLowerCase();
  const value = Number(coupon.discountValue || 0);
  let discount = 0;

  if (type === "percentage") {
    discount = Math.round((baseFare * value) / 100);
    const maxDiscount = Number(coupon.maxDiscount || 0);
    if (maxDiscount > 0) discount = Math.min(discount, maxDiscount);
  } else {
    discount = value;
  }

  return Math.min(Math.max(0, discount), baseFare);
}
