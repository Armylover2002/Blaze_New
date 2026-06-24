export const startOfDay = (date = new Date()) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

export const normalizeCouponValidFrom = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return startOfDay(parsed);
};

export const normalizeCouponValidTill = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return startOfDay(parsed);
};

export const isQuickCouponExpired = (coupon, now = new Date()) => {
  const till = coupon?.validTill;
  if (!till) return false;
  return startOfDay(now).getTime() > startOfDay(new Date(till)).getTime();
};

export const isQuickCouponNotStarted = (coupon, now = new Date()) => {
  const from = coupon?.validFrom;
  if (!from) return false;
  return startOfDay(now).getTime() < startOfDay(new Date(from)).getTime();
};

export const isQuickCouponCurrentlyValid = (coupon, now = new Date()) => {
  if (coupon?.isActive === false) return false;
  const status = String(coupon?.status || '').trim().toLowerCase();
  if (status === 'inactive' || status === 'expired') return false;
  if (isQuickCouponNotStarted(coupon, now)) return false;
  if (isQuickCouponExpired(coupon, now)) return false;
  return true;
};

export const getQuickCouponEffectiveStatus = (coupon, now = new Date()) => {
  if (coupon?.isActive === false || String(coupon?.status || '').toLowerCase() === 'inactive') {
    return 'inactive';
  }
  if (String(coupon?.status || '').toLowerCase() === 'expired' || isQuickCouponExpired(coupon, now)) {
    return 'expired';
  }
  if (isQuickCouponNotStarted(coupon, now)) {
    return 'scheduled';
  }
  if (isQuickCouponCurrentlyValid(coupon, now)) {
    return 'active';
  }
  return 'inactive';
};

export const buildQuickCouponDateQuery = (now = new Date()) => {
  const today = startOfDay(now);
  return {
    $and: [
      {
        $or: [
          { validFrom: null },
          { validFrom: { $exists: false } },
          { validFrom: { $lte: today } },
        ],
      },
      {
        $or: [
          { validTill: null },
          { validTill: { $exists: false } },
          { validTill: { $gte: today } },
        ],
      },
    ],
  };
};

export const enrichQuickCoupon = (coupon, now = new Date()) => ({
  ...coupon,
  effectiveStatus: getQuickCouponEffectiveStatus(coupon, now),
  isEffectivelyActive: isQuickCouponCurrentlyValid(coupon, now),
});
