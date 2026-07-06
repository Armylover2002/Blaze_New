import { z } from 'zod';

const locationSchema = z.object({
    title: z.string().optional(),
    address: z.string().min(1, 'Address is required'),
    lat: z.number(),
    lng: z.number(),
    placeId: z.string().optional(),
});

const parcelSchema = z.object({
    parcelName: z.string().optional(),
    parcelDescription: z.string().optional(),
    weightKg: z.number().min(0).optional(),
    quantity: z.number().min(1).optional(),
    instructions: z.string().optional(),
    receiverName: z.string().optional(),
    receiverPhone: z.string().optional(),
}).optional();

export const createPorterOrderSchema = z.object({
    pickup: locationSchema,
    delivery: locationSchema,
    vehicleId: z.string().min(1),
    parcel: parcelSchema,
    couponCode: z.string().optional(),
    paymentMethod: z.enum(['wallet', 'cash', 'razorpay']).default('wallet'),
    scheduledAt: z.union([z.string(), z.date()]).optional().nullable(),
});

export const cancelPorterOrderSchema = z.object({
    reason: z.string().min(1).max(500).optional(),
});

export const ratePorterOrderSchema = z.object({
    score: z.number().min(1).max(5),
    comment: z.string().max(1000).optional(),
});

export const porterOtpSchema = z.object({
    otp: z.string().min(4).max(6),
});

export const listPorterOrdersQuerySchema = z.object({
    page: z.coerce.number().optional(),
    limit: z.coerce.number().optional(),
    status: z.string().optional(),
    search: z.string().optional(),
});

export const adminAssignDriverSchema = z.object({
    driverId: z.string().min(1, 'Driver ID is required'),
});

export const adminCancelOrderSchema = z.object({
    reason: z.string().min(1).max(500),
});

export const adminForceCloseSchema = z.object({
    reason: z.string().min(1).max(500),
    markDelivered: z.boolean().optional().default(false),
});
