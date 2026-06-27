export const DELIVERY_COUPONS = [
  {
    code: "BLAZE50",
    title: "First Delivery 50% Off",
    description: "50% off on your first parcel booking",
    discountType: "percentage",
    discountValue: 50,
    maxDiscount: 200,
    minOrderValue: 150,
    badge: "New User",
  },
  {
    code: "MONSOON100",
    title: "Monsoon Flat ₹100",
    description: "Flat ₹100 off on orders above ₹300",
    discountType: "flat",
    discountValue: 100,
    maxDiscount: 100,
    minOrderValue: 300,
    badge: "Seasonal",
  },
  {
    code: "WEEKEND20",
    title: "Weekend Saver 20%",
    description: "20% off on weekend parcel deliveries",
    discountType: "percentage",
    discountValue: 20,
    maxDiscount: 150,
    minOrderValue: 200,
    badge: "Weekend",
  },
  {
    code: "BIKE30",
    title: "Bike Express 30%",
    description: "30% off on bike deliveries under 5 km",
    discountType: "percentage",
    discountValue: 30,
    maxDiscount: 80,
    minOrderValue: 80,
    badge: "Express",
  },
  {
    code: "FURNITURE15",
    title: "Furniture Move 15%",
    description: "15% off on furniture & heavy goods",
    discountType: "percentage",
    discountValue: 15,
    maxDiscount: 500,
    minOrderValue: 500,
    badge: "Heavy Load",
  },
];

export function computeDiscount(coupon, baseFare) {
  if (!coupon || !baseFare) return 0;
  if (baseFare < (coupon.minOrderValue || 0)) return 0;
  let discount = 0;
  if (coupon.discountType === "percentage") {
    discount = Math.round(baseFare * (coupon.discountValue / 100));
    if (coupon.maxDiscount) discount = Math.min(discount, coupon.maxDiscount);
  } else {
    discount = coupon.discountValue;
  }
  return Math.min(discount, baseFare);
}
