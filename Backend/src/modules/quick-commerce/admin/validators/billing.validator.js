import { z } from 'zod';
import { ValidationError } from '../../../../core/auth/errors.js';

const toggleBoolSchema = z.object({
  status: z.boolean().optional(),
});

export const validateOptionalStatusDto = (body) => {
  const result = toggleBoolSchema.safeParse(body || {});
  if (!result.success) {
    throw new ValidationError(result.error.errors[0].message);
  }
  return result.data;
};



const rangeSchema = z.object({
  min: z.number().min(0),
  max: z.number().min(0),
  fee: z.number().min(0),
  deliveryBoyPerKm: z.number().min(0).optional().default(0),
  deliveryBoyBasePay: z.number().min(0).optional().default(0)
});

const feeSettingsUpsertSchema = z.object({
  deliveryFeeRanges: z.array(rangeSchema).optional(),
  returnWindowHours: z.number().int().min(1).max(720).nullable().optional(),
  returnsEnabled: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export const validateFeeSettingsUpsertDto = (body) => {
  const normalized = {
    deliveryFeeRanges: Array.isArray(body?.deliveryFeeRanges)
      ? body.deliveryFeeRanges.map((r) => ({
          min: Number(r?.min),
          max: Number(r?.max),
          fee: Number(r?.fee),
          deliveryBoyPerKm: Number(r?.deliveryBoyPerKm || 0),
          deliveryBoyBasePay: Number(r?.deliveryBoyBasePay || 0)
        }))
      : undefined,
    returnWindowHours:
      body?.returnWindowHours === null
        ? null
        : body?.returnWindowHours !== undefined
          ? Number(body.returnWindowHours)
          : undefined,
    returnsEnabled:
      body?.returnsEnabled !== undefined ? Boolean(body.returnsEnabled) : undefined,
    isActive: body?.isActive !== undefined ? Boolean(body.isActive) : undefined,
  };

  const result = feeSettingsUpsertSchema.safeParse(normalized);
  if (!result.success) {
    throw new ValidationError(result.error.errors[0].message);
  }

  const ranges = Array.isArray(result.data.deliveryFeeRanges)
    ? result.data.deliveryFeeRanges
    : undefined;
  if (ranges) {
    const sorted = [...ranges].sort((a, b) => a.min - b.min);
    for (const r of sorted) {
      if (r.min >= r.max) {
        throw new ValidationError('Each range must have min less than max');
      }
    }
    for (let i = 1; i < sorted.length; i += 1) {
      const prev = sorted[i - 1];
      const cur = sorted[i];
      if (cur.min < prev.max) {
        throw new ValidationError('Delivery fee ranges must not overlap');
      }
    }
    result.data.deliveryFeeRanges = sorted;
  }

  return result.data;
};
