import mongoose from 'mongoose';
import {
    createRazorpayOrder,
    fetchRazorpayPayment,
    getRazorpayKeyId,
    isRazorpayConfigured,
    verifyPaymentSignature,
} from '../../../food/orders/helpers/razorpay.helper.js';
import { PorterOrder } from '../models/porterOrder.model.js';
import { FoodOrder } from '../../../food/orders/models/order.model.js';
import { PorterCoupon } from '../../models/porterCoupon.model.js';
import { FoodDeliveryPartner } from '../../../food/delivery/models/deliveryPartner.model.js';
import { NotFoundError, ValidationError, ConflictError } from '../../../../core/auth/errors.js';
import {
    PORTER_ORDER_STATUS,
    PORTER_DISPATCH_STATUS,
    PORTER_DELIVERY_PHASE,
    PORTER_PAYMENT_STATUS,
    PORTER_TERMINAL_STATUSES,
    PORTER_ACTIVE_STATUSES,
} from '../constants/porterOrderStatus.constants.js';
import {
    generateOrderNumber,
    generateOtp,
    appendStatusHistory,
    logPorterOrderAction,
    mapPorterOrderForUser,
    mapPorterOrderForDriver,
    isTerminalPorterStatus,
    PORTER_DRIVER_POPULATE_SELECT,
} from '../utils/porterOrder.helpers.js';
import { calculatePorterOrderPricing } from './porter-order-pricing.service.js';
import { chargePorterOrderWallet, applyPorterRefund } from './porter-order-payment.service.js';
import { startPorterDispatch, emitPorterOrderStatus, emitPorterOrderCancelled } from './porter-order-dispatch.service.js';
import {
    schedulePorterOrderDispatch,
    isFuturePorterSchedule,
    parseAndValidatePorterScheduledAt,
    removePorterScheduledJobs,
    activateScheduledPorterOrder,
    normalizePorterTimezone,
} from './porter-scheduled-dispatch.service.js';
import { settlePorterOrderEarningsAtomic } from './porter-wallet-atomic.service.js';
import { parseListQuery, toPorterPagination } from '../../utils/pagination.util.js';

const baseFilter = { isDeleted: { $ne: true } };

export async function validatePorterCouponForUser(userId, dto) {
    const result = await calculatePorterOrderPricing({
        pickup: dto.pickup,
        delivery: dto.delivery,
        vehicleId: dto.vehicleId,
        couponCode: dto.couponCode,
        userId,
        parcel: dto.parcel,
    });

    return {
        coupon: result.coupon,
        pricing: result.pricing,
    };
}

export async function createPorterOrder(userId, dto, performer = null) {
    const pricingResult = await calculatePorterOrderPricing({
        pickup: dto.pickup,
        delivery: dto.delivery,
        vehicleId: dto.vehicleId,
        couponCode: dto.couponCode,
        userId,
        parcel: dto.parcel,
    });

    const activeExisting = await PorterOrder.findOne({
        userId: new mongoose.Types.ObjectId(userId),
        status: { $in: [...PORTER_ACTIVE_STATUSES] },
        isDeleted: { $ne: true },
    }).select({ _id: 1 }).lean();

    if (activeExisting) {
        throw new ConflictError('You already have an active Porter order');
    }

    const orderNumber = generateOrderNumber();
    const paymentMethod = dto.paymentMethod || 'wallet';

    const order = new PorterOrder({
        orderNumber,
        userId: new mongoose.Types.ObjectId(userId),
        status: PORTER_ORDER_STATUS.CREATED,
        pickup: dto.pickup,
        delivery: dto.delivery,
        parcel: dto.parcel || {},
        vehicleId: pricingResult.vehicle.id,
        vehicleName: pricingResult.vehicle.category,
        zoneId: pricingResult.zoneId ? new mongoose.Types.ObjectId(pricingResult.zoneId) : null,
        route: {
            distanceKm: pricingResult.route.distanceKm,
            durationMin: pricingResult.route.durationMin,
            distanceText: pricingResult.route.distanceText,
            durationText: pricingResult.route.durationText,
            polyline: pricingResult.route.polyline,
        },
        pricing: pricingResult.pricing,
        couponId: pricingResult.coupon?.id ? new mongoose.Types.ObjectId(pricingResult.coupon.id) : null,
        couponCode: pricingResult.coupon?.code || null,
        payment: { method: paymentMethod, status: PORTER_PAYMENT_STATUS.PENDING },
        dispatch: { status: PORTER_DISPATCH_STATUS.UNASSIGNED, rejectedPartnerIds: [] },
        deliveryState: {
            pickupOtp: generateOtp(4),
        },
        scheduledAt: dto.scheduledAt || null,
        schedule: dto.timezone
            ? { timezone: normalizePorterTimezone(dto.timezone) || 'Asia/Kolkata', status: 'none' }
            : undefined,
        createdBy: performer,
    });

    appendStatusHistory(order, PORTER_ORDER_STATUS.CREATED, performer, 'Order created');
    await order.save();

    if (paymentMethod === 'razorpay') {
        const amountPaise = Math.round(pricingResult.pricing.total * 100);
        const rzOrder = await createRazorpayOrder(amountPaise, "INR", order._id.toString());
        order.payment.razorpay = {
            orderId: rzOrder.id,
            amount: rzOrder.amount,
            currency: rzOrder.currency,
            key: await getRazorpayKeyId(),
        };
        order.payment.status = PORTER_PAYMENT_STATUS.PENDING;
        order.markModified('payment');
    } else {
        const paymentResult = await chargePorterOrderWallet({
            userId,
            orderId: order._id,
            orderNumber,
            amount: pricingResult.pricing.total,
            paymentMethod,
        });

        order.payment.status = paymentResult.status;
        order.payment.paidAt = paymentResult.paidAt;
        order.markModified('payment');
    }

    const scheduledDate = dto.scheduledAt ? new Date(dto.scheduledAt) : null;
    if (scheduledDate && Number.isNaN(scheduledDate.getTime())) {
        throw new ValidationError('Invalid scheduledAt');
    }
    // Soft gate: near-future times fall through to instant; far-future must pass window.
    if (scheduledDate && scheduledDate.getTime() > Date.now() + 60_000) {
        parseAndValidatePorterScheduledAt(scheduledDate);
    }
    const isScheduled = isFuturePorterSchedule(scheduledDate);

    if (scheduledDate) {
        order.scheduledAt = scheduledDate;
    }

    if (paymentMethod === 'razorpay') {
        await order.save();
        return mapPorterOrderForUser(order);
    }

    if (isScheduled) {
        order.scheduledAt = scheduledDate;
        order.status = PORTER_ORDER_STATUS.SCHEDULED;
        order.schedule = order.schedule || {};
        if (dto.timezone) {
            order.schedule.timezone = normalizePorterTimezone(dto.timezone) || 'Asia/Kolkata';
        } else if (!order.schedule.timezone) {
            order.schedule.timezone = 'Asia/Kolkata';
        }
        order.schedule.status = 'scheduled';
        order.schedule.scheduledUpdatedAt = new Date();
        order.schedule.lastUpdatedAt = new Date();
        order.markModified('schedule');
        appendStatusHistory(order, PORTER_ORDER_STATUS.SCHEDULED, performer, 'Scheduled for later dispatch');
        await order.save();

        if (pricingResult.coupon?.id) {
            await PorterCoupon.updateOne(
                { _id: pricingResult.coupon.id },
                { $inc: { usedCount: 1 } },
            );
        }

        await logPorterOrderAction({
            orderId: order._id,
            orderNumber,
            action: 'order_scheduled',
            toStatus: order.status,
            performedBy: performer,
            metadata: { scheduledAt: scheduledDate.toISOString() },
        });

        await schedulePorterOrderDispatch(order._id, scheduledDate, {
            timezone: normalizePorterTimezone(dto.timezone || order.schedule?.timezone) || 'Asia/Kolkata',
        });
        try {
            const { notifyPorterOrderScheduled } = await import('./porter-notification.service.js');
            void notifyPorterOrderScheduled(order);
        } catch {
            // non-blocking
        }
        return mapPorterOrderForUser(order);
    }

    order.status = PORTER_ORDER_STATUS.SEARCHING_PARTNER;
    appendStatusHistory(order, PORTER_ORDER_STATUS.SEARCHING_PARTNER, performer, 'Searching for partner');
    await order.save();

    if (pricingResult.coupon?.id) {
        await PorterCoupon.updateOne(
            { _id: pricingResult.coupon.id },
            { $inc: { usedCount: 1 } },
        );
    }

    await logPorterOrderAction({
        orderId: order._id,
        orderNumber,
        action: 'order_created',
        toStatus: order.status,
        performedBy: performer,
    });

    startPorterDispatch(order._id).catch(() => {});

    return mapPorterOrderForUser(order);
}

export async function getPorterOrderForUser(userId, orderId) {
    const order = await PorterOrder.findOne({
        _id: orderId,
        userId: new mongoose.Types.ObjectId(userId),
        ...baseFilter,
    })
        .populate('dispatch.deliveryPartnerId', PORTER_DRIVER_POPULATE_SELECT)
        .lean();

    if (!order) throw new NotFoundError('Order not found');
    return mapPorterOrderForUser(order);
}

export async function getActivePorterOrderForUser(userId) {
    const order = await PorterOrder.findOne({
        userId: new mongoose.Types.ObjectId(userId),
        status: { $in: [...PORTER_ACTIVE_STATUSES] },
        ...baseFilter,
    })
        .sort({ createdAt: -1 })
        .populate('dispatch.deliveryPartnerId', PORTER_DRIVER_POPULATE_SELECT)
        .lean();

    return order ? mapPorterOrderForUser(order) : null;
}

export async function listPorterOrdersForUser(userId, query = {}) {
    const parsed = parseListQuery(query);
    const filter = {
        userId: new mongoose.Types.ObjectId(userId),
        ...baseFilter,
    };
    if (parsed.status) filter.status = parsed.status;

    const [docs, total] = await Promise.all([
        PorterOrder.find(filter)
            .sort({ createdAt: -1 })
            .skip(parsed.skip)
            .limit(parsed.limit)
            .lean(),
        PorterOrder.countDocuments(filter),
    ]);

    return toPorterPagination({
        docs: docs.map(mapPorterOrderForUser),
        total,
        page: parsed.page,
        limit: parsed.limit,
    });
}

export async function cancelPorterOrderByUser(userId, orderId, reason, performer = null) {
    const order = await PorterOrder.findOne({
        _id: orderId,
        userId: new mongoose.Types.ObjectId(userId),
        ...baseFilter,
    });

    if (!order) throw new NotFoundError('Order not found');
    if (isTerminalPorterStatus(order.status)) {
        throw new ValidationError('Order cannot be cancelled');
    }

    const nonCancellableStatuses = [
        PORTER_ORDER_STATUS.PICKED_UP,
        PORTER_ORDER_STATUS.IN_TRANSIT,
        PORTER_ORDER_STATUS.AT_DROP,
        PORTER_ORDER_STATUS.DELIVERED,
    ];
    if (nonCancellableStatuses.includes(order.status)) {
        throw new ValidationError('Order cannot be cancelled after pickup');
    }

    const fromStatus = order.status;

    const refunded = await PorterOrder.findOneAndUpdate(
        {
            _id: orderId,
            userId: new mongoose.Types.ObjectId(userId),
            ...baseFilter,
            status: { $nin: [...PORTER_TERMINAL_STATUSES, ...nonCancellableStatuses] },
            'payment.status': { $ne: PORTER_PAYMENT_STATUS.REFUNDED },
        },
        {
            $set: {
                status: PORTER_ORDER_STATUS.CANCELLED_BY_USER,
                'dispatch.status': PORTER_DISPATCH_STATUS.CANCELLED,
                'schedule.status': 'cancelled',
                'schedule.lastUpdatedAt': new Date(),
                cancellation: { reason, cancelledBy: 'user', cancelledAt: new Date() },
            },
        },
        { new: true },
    );

    if (!refunded) {
        const existing = await PorterOrder.findOne({ _id: orderId, userId: new mongoose.Types.ObjectId(userId) });
        if (!existing) throw new NotFoundError('Order not found');
        if (isTerminalPorterStatus(existing.status)) throw new ValidationError('Order cannot be cancelled');
        const nonCancellable = new Set([
            PORTER_ORDER_STATUS.PICKED_UP,
            PORTER_ORDER_STATUS.IN_TRANSIT,
            PORTER_ORDER_STATUS.AT_DROP,
            PORTER_ORDER_STATUS.DELIVERED,
        ]);
        if (nonCancellable.has(existing.status)) {
            throw new ValidationError('Order cannot be cancelled after pickup');
        }
        throw new ValidationError('Order cannot be cancelled');
    }

    appendStatusHistory(refunded, refunded.status, performer, reason);
    await refunded.save();

    // Drop delayed BullMQ jobs so cancelled schedules don't activate later.
    void removePorterScheduledJobs(refunded._id, refunded);

    const refundResult = await applyPorterRefund(refunded, reason);

    await emitPorterOrderCancelled(refunded, userId, refunded.dispatch?.deliveryPartnerId);
    await emitPorterOrderStatus(refunded, userId, refunded.dispatch?.deliveryPartnerId);
    const { notifyPorterOrderStatusChange, notifyPorterRefund } = await import('./porter-notification.service.js');
    void notifyPorterOrderStatusChange(refunded);
    if (refundResult?.status === 'processed') void notifyPorterRefund(refunded, refundResult);
    await logPorterOrderAction({
        orderId: refunded._id,
        orderNumber: refunded.orderNumber,
        action: 'cancelled_by_user',
        fromStatus,
        toStatus: refunded.status,
        metadata: { reason },
        performedBy: performer,
    });

    return mapPorterOrderForUser(refunded);
}

export async function ratePorterOrder(userId, orderId, { score, comment, tags }) {
    const order = await PorterOrder.findOne({
        _id: orderId,
        userId: new mongoose.Types.ObjectId(userId),
        status: { $in: [PORTER_ORDER_STATUS.DELIVERED, PORTER_ORDER_STATUS.COMPLETED] },
        ...baseFilter,
    });

    if (!order) throw new NotFoundError('Order not found or not eligible for rating');
    if (order.rating?.score) throw new ValidationError('Order already rated');

    order.rating = { score, comment: comment || '', tags: tags || [] };

    await order.save();

    if (order.dispatch?.deliveryPartnerId) {
        const partnerId = order.dispatch.deliveryPartnerId;
        const partner = await FoodDeliveryPartner.findById(partnerId);
        if (partner) {
            const currentTotal = partner.totalRatings || 0;
            const currentRating = partner.rating || 0;
            const newTotal = currentTotal + 1;
            const newRating = ((currentRating * currentTotal) + score) / newTotal;
            partner.totalRatings = newTotal;
            partner.rating = newRating;
            await partner.save();
        }
    }

    return mapPorterOrderForUser(order);
}

/**
 * Customer/admin-facing reschedule — only while still in `scheduled` (pre-dispatch).
 */
export async function reschedulePorterOrder(userId, orderId, scheduledAtRaw, performer = null, timezone = null) {
    const when = parseAndValidatePorterScheduledAt(scheduledAtRaw);

    const order = await PorterOrder.findOne({
        _id: orderId,
        ...(userId ? { userId: new mongoose.Types.ObjectId(userId) } : {}),
        status: PORTER_ORDER_STATUS.SCHEDULED,
        ...baseFilter,
    });

    if (!order) {
        throw new ValidationError('Only scheduled orders can be rescheduled before dispatch');
    }

    const previous = order.scheduledAt;
    order.scheduledAt = when;
    order.schedule = order.schedule || {};
    if (timezone) {
        order.schedule.timezone = normalizePorterTimezone(timezone) || 'Asia/Kolkata';
    } else if (!order.schedule.timezone) {
        order.schedule.timezone = 'Asia/Kolkata';
    } else {
        order.schedule.timezone = normalizePorterTimezone(order.schedule.timezone) || order.schedule.timezone;
    }
    order.schedule.status = 'scheduled';
    order.schedule.scheduledUpdatedAt = new Date();
    order.schedule.lastUpdatedAt = new Date();
    order.schedule.reminderSentAt = undefined;
    order.schedule.reminderScheduledAt = undefined;
    order.markModified('schedule');
    appendStatusHistory(order, order.status, performer, `Rescheduled to ${when.toISOString()}`);
    await order.save();

    await schedulePorterOrderDispatch(order._id, when, {
        timezone: normalizePorterTimezone(timezone || order.schedule?.timezone) || 'Asia/Kolkata',
    });

    await logPorterOrderAction({
        orderId: order._id,
        orderNumber: order.orderNumber,
        action: 'order_rescheduled',
        toStatus: order.status,
        performedBy: performer,
        metadata: {
            previousScheduledAt: previous?.toISOString?.() || previous,
            scheduledAt: when.toISOString(),
        },
    });

    await emitPorterOrderStatus(order, order.userId, null);

    try {
        const { notifyPorterOrderRescheduled } = await import('./porter-notification.service.js');
        void notifyPorterOrderRescheduled(order, previous);
    } catch {
        // non-blocking
    }

    return mapPorterOrderForUser(order);
}

export async function adminReschedulePorterOrder(orderId, scheduledAtRaw, performer = null, timezone = null) {
    return reschedulePorterOrder(null, orderId, scheduledAtRaw, performer, timezone);
}

export async function adminStartScheduledPorterDispatch(orderId, performer = null) {
    const order = await PorterOrder.findOne({ _id: orderId, ...baseFilter });
    if (!order) throw new NotFoundError('Order not found');
    if (order.status !== PORTER_ORDER_STATUS.SCHEDULED) {
        throw new ValidationError('Order is not waiting on a schedule');
    }
    const activated = await activateScheduledPorterOrder(orderId, performer, {
        reason: 'Manual dispatch started by admin',
        allowEarly: true,
    });
    if (!activated) throw new ConflictError('Order could not be activated');

    await logPorterOrderAction({
        orderId: activated._id,
        orderNumber: activated.orderNumber,
        action: 'manual_scheduled_dispatch',
        fromStatus: PORTER_ORDER_STATUS.SCHEDULED,
        toStatus: activated.status,
        performedBy: performer,
    });

    return mapPorterOrderForUser(activated);
}

// --- Admin ---

export async function listPorterOrdersAdmin(query = {}) {
    const parsed = parseListQuery(query);
    const filter = { ...baseFilter };
    if (parsed.status) filter.status = parsed.status;
    if (parsed.search) {
        filter.$or = [
            { orderNumber: { $regex: parsed.search, $options: 'i' } },
        ];
    }

    const scheduleFilter = String(query.scheduleFilter || '').toLowerCase();
    if (scheduleFilter === 'scheduled' || scheduleFilter === 'pending_schedule') {
        filter.status = PORTER_ORDER_STATUS.SCHEDULED;
    } else if (scheduleFilter === 'today' || scheduleFilter === 'scheduled_today') {
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        const end = new Date();
        end.setHours(23, 59, 59, 999);
        filter.status = PORTER_ORDER_STATUS.SCHEDULED;
        filter.scheduledAt = { $gte: start, $lte: end };
    } else if (scheduleFilter === 'tomorrow') {
        const start = new Date();
        start.setDate(start.getDate() + 1);
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setHours(23, 59, 59, 999);
        filter.status = PORTER_ORDER_STATUS.SCHEDULED;
        filter.scheduledAt = { $gte: start, $lte: end };
    } else if (scheduleFilter === 'week' || scheduleFilter === 'this_week') {
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setDate(end.getDate() + 7);
        filter.status = PORTER_ORDER_STATUS.SCHEDULED;
        filter.scheduledAt = { $gte: start, $lte: end };
    }
    if (query.scheduledFrom || query.scheduledTo) {
        filter.scheduledAt = filter.scheduledAt || {};
        if (query.scheduledFrom) filter.scheduledAt.$gte = new Date(query.scheduledFrom);
        if (query.scheduledTo) {
            const to = new Date(query.scheduledTo);
            if (!String(query.scheduledTo).includes('T')) to.setHours(23, 59, 59, 999);
            filter.scheduledAt.$lte = to;
        }
        if (!filter.status) filter.status = PORTER_ORDER_STATUS.SCHEDULED;
    }

    const [docs, total, statusGroups] = await Promise.all([
        PorterOrder.find(filter)
            .sort({ createdAt: -1 })
            .skip(parsed.skip)
            .limit(parsed.limit)
            .populate('userId', 'name phone email')
            .populate('dispatch.deliveryPartnerId', PORTER_DRIVER_POPULATE_SELECT)
            .lean(),
        PorterOrder.countDocuments(filter),
        PorterOrder.aggregate([
            { $match: { ...baseFilter } },
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ])
    ]);

    const tabCounts = { all: 0 };
    statusGroups.forEach(g => {
        tabCounts[g._id] = g.count;
        tabCounts.all += g.count;
    });

    const result = toPorterPagination({ docs, total, page: parsed.page, limit: parsed.limit });
    result.tabCounts = tabCounts;
    return result;
}

export async function verifyPorterPayment(userId, dto) {
    const order = await PorterOrder.findOne({
        _id: new mongoose.Types.ObjectId(dto.orderId),
        userId: new mongoose.Types.ObjectId(userId),
    });
    
    if (!order) throw new NotFoundError('Order not found');
    if (order.payment.status === PORTER_PAYMENT_STATUS.PAID) return { order };

    const expectedRazorpayOrderId = String(order.payment?.razorpay?.orderId || '').trim();
    const providedRazorpayOrderId = String(dto.razorpayOrderId || '').trim();
    if (!expectedRazorpayOrderId || providedRazorpayOrderId !== expectedRazorpayOrderId) {
        throw new ValidationError('Payment order mismatch');
    }

    const valid = verifyPaymentSignature(
        expectedRazorpayOrderId,
        dto.razorpayPaymentId,
        dto.razorpaySignature,
    );
    if (!valid) throw new ValidationError('Payment verification failed');

    const paymentId = String(dto.razorpayPaymentId || '').trim();
    const [porterExisting, foodExisting] = await Promise.all([
        PorterOrder.findOne({
            $or: [
                { 'payment.razorpay.paymentId': paymentId },
                { 'payment.razorpayPaymentId': paymentId },
            ],
            _id: { $ne: order._id },
        })
            .select('_id orderNumber')
            .lean(),
        FoodOrder.findOne({
            'payment.razorpay.paymentId': paymentId,
        })
            .select('_id orderId')
            .lean(),
    ]);
    if (porterExisting || foodExisting) {
        throw new ValidationError('Razorpay payment already consumed');
    }

    if (isRazorpayConfigured()) {
        const fetchedPayment = await fetchRazorpayPayment(dto.razorpayPaymentId);
        const fetchedOrderId = String(fetchedPayment?.order_id || '').trim();
        const fetchedStatus = String(fetchedPayment?.status || '').toLowerCase();
        const fetchedAmountPaise = Number(fetchedPayment?.amount || 0);
        const expectedAmountPaise = Math.round(Number(order.pricing?.total || 0) * 100);

        if (fetchedOrderId !== expectedRazorpayOrderId) {
            throw new ValidationError('Payment order mismatch');
        }
        if (fetchedStatus !== 'captured') {
            throw new ValidationError('Payment not captured');
        }
        if (!Number.isFinite(expectedAmountPaise) || expectedAmountPaise < 100) {
            throw new ValidationError('Invalid order payment amount');
        }
        if (fetchedAmountPaise !== expectedAmountPaise) {
            throw new ValidationError('Payment amount mismatch');
        }
    }

    order.payment.status = PORTER_PAYMENT_STATUS.PAID;
    order.payment.paidAt = new Date();
    order.payment.razorpay = order.payment.razorpay || {};
    order.payment.razorpay.paymentId = dto.razorpayPaymentId;
    order.payment.razorpay.signature = dto.razorpaySignature;
    order.payment.razorpayPaymentId = dto.razorpayPaymentId;
    order.markModified('payment');

    if (order.status === PORTER_ORDER_STATUS.CREATED) {
        const isScheduled = isFuturePorterSchedule(order.scheduledAt)
            && (() => {
                try {
                    parseAndValidatePorterScheduledAt(order.scheduledAt);
                    return true;
                } catch {
                    return false;
                }
            })();
        
        if (isScheduled) {
            order.status = PORTER_ORDER_STATUS.SCHEDULED;
            order.schedule = order.schedule || {};
            order.schedule.status = 'scheduled';
            if (!order.schedule.timezone) {
                order.schedule.timezone = 'Asia/Kolkata';
            } else {
                order.schedule.timezone = normalizePorterTimezone(order.schedule.timezone) || 'Asia/Kolkata';
            }
            order.schedule.scheduledUpdatedAt = new Date();
            order.schedule.lastUpdatedAt = new Date();
            order.markModified('schedule');
            appendStatusHistory(order, PORTER_ORDER_STATUS.SCHEDULED, null, 'Scheduled for later dispatch after payment');
            await order.save();

            if (order.couponId) {
                await mongoose.model('PorterCoupon').updateOne(
                    { _id: order.couponId },
                    { $inc: { usedCount: 1 } }
                );
            }

            await logPorterOrderAction({
                orderId: order._id,
                orderNumber: order.orderNumber,
                action: 'order_scheduled',
                toStatus: order.status,
                performedBy: null,
                metadata: { scheduledAt: order.scheduledAt.toISOString() },
            });

            await schedulePorterOrderDispatch(order._id, order.scheduledAt, {
                timezone: normalizePorterTimezone(order.schedule?.timezone) || 'Asia/Kolkata',
            });
            try {
                const { notifyPorterOrderScheduled } = await import('./porter-notification.service.js');
                void notifyPorterOrderScheduled(order);
            } catch {
                // non-blocking
            }
        } else {
            order.status = PORTER_ORDER_STATUS.SEARCHING_PARTNER;
            appendStatusHistory(order, PORTER_ORDER_STATUS.SEARCHING_PARTNER, null, 'Searching for partner after payment');
            await order.save();

            if (order.couponId) {
                await mongoose.model('PorterCoupon').updateOne(
                    { _id: order.couponId },
                    { $inc: { usedCount: 1 } }
                );
            }

            await logPorterOrderAction({
                orderId: order._id,
                orderNumber: order.orderNumber,
                action: 'order_created',
                toStatus: order.status,
                performedBy: null,
            });

            startPorterDispatch(order._id).catch(() => {});
        }
    } else {
        appendStatusHistory(order, order.status, null, 'Payment verified');
        await order.save();
    }

    return { order };
}
export async function getPorterOrderAdmin(orderId) {
    const order = await PorterOrder.findOne({ _id: orderId, ...baseFilter })
        .populate('userId', 'name phone email')
        .populate('dispatch.deliveryPartnerId', PORTER_DRIVER_POPULATE_SELECT)
        .lean();
    if (!order) throw new NotFoundError('Order not found');
    return order;
}

export async function settlePorterOrderEarnings(order) {
    return settlePorterOrderEarningsAtomic(order);
}
