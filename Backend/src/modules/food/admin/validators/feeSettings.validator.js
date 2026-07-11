import { z } from 'zod';
import { ValidationError } from '../../../../core/auth/errors.js';

const rangeSchema = z.object({
    min: z.number().min(0),
    max: z.number().min(0),
    fee: z.number().min(0),
    deliveryBoyPerKm: z.number().min(0).optional().default(0),
    deliveryBoyBasePay: z.number().min(0).optional().default(0)
});

const sponsorRuleSchema = z.object({
    minOrderAmount: z.number().min(0),
    maxOrderAmount: z.number().min(0).nullable().optional(),
    maxDistanceKm: z.number().min(0),
    sponsorType: z.enum(['USER_FULL', 'RESTAURANT_FULL', 'SPLIT']),
    sponsoredKm: z.number().min(0).nullable().optional()
});

const deliveryDistanceSlabSchema = z.object({
    fromKm: z.number().min(0),
    toKm: z.number().min(0),
    deliveryFee: z.number().min(0)
});

const feeSettingsUpsertSchema = z.object({
    deliveryFee: z.number().min(0).nullable().optional(),
    baseDistanceKm: z.number().min(0).nullable().optional(),
    baseDeliveryFee: z.number().min(0).nullable().optional(),
    perKmCharge: z.number().min(0).nullable().optional(),
    deliveryFeeRanges: z.array(rangeSchema).optional(),
    sponsorRules: z.array(sponsorRuleSchema).optional(),
    deliveryDistanceSlabs: z.array(deliveryDistanceSlabSchema).optional(),
    platformFee: z.number().min(0).nullable().optional(),
    gstRate: z.number().min(0).max(100).nullable().optional(),
    mixedOrderDistanceLimit: z.number().min(0).nullable().optional(),
    mixedOrderAngleLimit: z.number().min(0).nullable().optional(),
    isActive: z.boolean().optional()
});

export const validateFeeSettingsUpsertDto = (body) => {
    const normalized = {
        deliveryFee:
            body?.deliveryFee === null
                ? null
                : body?.deliveryFee !== undefined
                    ? Number(body.deliveryFee)
                    : undefined,
        baseDistanceKm:
            body?.baseDistanceKm === null
                ? null
                : body?.baseDistanceKm !== undefined
                    ? Number(body.baseDistanceKm)
                    : undefined,
        baseDeliveryFee:
            body?.baseDeliveryFee === null
                ? null
                : body?.baseDeliveryFee !== undefined
                    ? Number(body.baseDeliveryFee)
                    : undefined,
        perKmCharge:
            body?.perKmCharge === null
                ? null
                : body?.perKmCharge !== undefined
                    ? Number(body.perKmCharge)
                    : undefined,
        deliveryFeeRanges: Array.isArray(body?.deliveryFeeRanges)
            ? body.deliveryFeeRanges.map((r) => ({
                min: Number(r?.min),
                max: Number(r?.max),
                fee: Number(r?.fee),
                deliveryBoyPerKm: Number(r?.deliveryBoyPerKm || 0),
                deliveryBoyBasePay: Number(r?.deliveryBoyBasePay || 0)
            }))
            : undefined,
        sponsorRules: Array.isArray(body?.sponsorRules)
            ? body.sponsorRules.map((rule) => ({
                minOrderAmount: Number(rule?.minOrderAmount),
                maxOrderAmount:
                    rule?.maxOrderAmount === null || rule?.maxOrderAmount === undefined || rule?.maxOrderAmount === ''
                        ? null
                        : Number(rule.maxOrderAmount),
                maxDistanceKm: Number(rule?.maxDistanceKm),
                sponsorType: String(rule?.sponsorType || '').trim().toUpperCase(),
                sponsoredKm:
                    rule?.sponsoredKm === null || rule?.sponsoredKm === undefined || rule?.sponsoredKm === ''
                        ? null
                        : Number(rule.sponsoredKm)
            }))
            : undefined,
        deliveryDistanceSlabs: Array.isArray(body?.deliveryDistanceSlabs)
            ? body.deliveryDistanceSlabs.map((slab) => ({
                fromKm: Number(slab?.fromKm),
                toKm: Number(slab?.toKm),
                deliveryFee: Number(slab?.deliveryFee)
            }))
            : undefined,
        platformFee:
            body?.platformFee === null ? null : body?.platformFee !== undefined ? Number(body.platformFee) : undefined,
        gstRate:
            body?.gstRate === null ? null : body?.gstRate !== undefined ? Number(body.gstRate) : undefined,
        mixedOrderDistanceLimit:
            body?.mixedOrderDistanceLimit === null ? null : body?.mixedOrderDistanceLimit !== undefined ? Number(body.mixedOrderDistanceLimit) : undefined,
        mixedOrderAngleLimit:
            body?.mixedOrderAngleLimit === null ? null : body?.mixedOrderAngleLimit !== undefined ? Number(body.mixedOrderAngleLimit) : undefined,
        isActive: body?.isActive !== undefined ? Boolean(body.isActive) : undefined
    };

    const result = feeSettingsUpsertSchema.safeParse(normalized);
    if (!result.success) {
        throw new ValidationError(result.error.errors[0].message);
    }

    const ranges = Array.isArray(result.data.deliveryFeeRanges) ? result.data.deliveryFeeRanges : undefined;
    if (ranges) {
        const sorted = [...ranges].sort((a, b) => a.min - b.min);
        for (const r of sorted) {
            if (r.min >= r.max) {
                throw new ValidationError('Each range must have min less than max');
            }
        }
        for (let i = 1; i < sorted.length; i++) {
            const prev = sorted[i - 1];
            const cur = sorted[i];
            if (cur.min < prev.max) {
                throw new ValidationError('Delivery fee ranges must not overlap');
            }
        }
        result.data.deliveryFeeRanges = sorted;
    }

    const slabs = Array.isArray(result.data.deliveryDistanceSlabs) ? result.data.deliveryDistanceSlabs : undefined;
    if (slabs) {
        for (const slab of slabs) {
            if (slab.toKm < slab.fromKm) {
                throw new ValidationError('To KM must be greater than or equal to From KM');
            }
        }
    }

    const sponsorRules = Array.isArray(result.data.sponsorRules) ? result.data.sponsorRules : undefined;
    if (sponsorRules) {
        for (const rule of sponsorRules) {
            if (
                rule.maxOrderAmount != null &&
                Number.isFinite(rule.maxOrderAmount) &&
                rule.maxOrderAmount < rule.minOrderAmount
            ) {
                throw new ValidationError('Maximum order amount must be greater than or equal to minimum order amount');
            }
            if (rule.sponsorType === 'SPLIT') {
                const sponsoredKm = Number(rule.sponsoredKm);
                if (!Number.isFinite(sponsoredKm) || sponsoredKm < 0) {
                    throw new ValidationError('Sponsored KM is required for split rules');
                }
            }
            if (rule.sponsorType !== 'SPLIT') {
                rule.sponsoredKm = null;
            }
        }
    }

    return result.data;
};
