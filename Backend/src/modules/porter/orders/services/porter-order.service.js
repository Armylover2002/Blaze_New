import mongoose from 'mongoose';
import { createRazorpayOrder, getRazorpayKeyId, verifyPaymentSignature } from '../../../food/orders/helpers/razorpay.helper.js';
import { PorterOrder } from '../models/porterOrder.model.js';
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
import { schedulePorterOrderDispatch } from './porter-scheduled-dispatch.service.js';
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
        vehicleName: pricingResult.vehicle.name,
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
    const isScheduled = scheduledDate && scheduledDate.getTime() > Date.now() + 60_000;

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

        await schedulePorterOrderDispatch(order._id, scheduledDate);
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

    const [docs, total] = await Promise.all([
        PorterOrder.find(filter)
            .sort({ createdAt: -1 })
            .skip(parsed.skip)
            .limit(parsed.limit)
            .populate('userId', 'name phone email')
            .populate('dispatch.deliveryPartnerId', PORTER_DRIVER_POPULATE_SELECT)
            .lean(),
        PorterOrder.countDocuments(filter),
    ]);

    return toPorterPagination({ docs, total, page: parsed.page, limit: parsed.limit });
}export async function verifyPorterPayment(userId, dto) {
    const order = await PorterOrder.findOne({
        _id: new mongoose.Types.ObjectId(dto.orderId),
        userId: new mongoose.Types.ObjectId(userId),
    });
    
    if (!order) throw new NotFoundError('Order not found');
    if (order.payment.status === PORTER_PAYMENT_STATUS.PAID) return { order };

    const valid = verifyPaymentSignature(
        dto.razorpayOrderId,
        dto.razorpayPaymentId,
        dto.razorpaySignature,
    );
    if (!valid) throw new ValidationError('Payment verification failed');

    order.payment.status = PORTER_PAYMENT_STATUS.PAID;
    order.payment.paidAt = new Date();
    order.payment.razorpay = order.payment.razorpay || {};
    order.payment.razorpay.paymentId = dto.razorpayPaymentId;
    order.payment.razorpay.signature = dto.razorpaySignature;
    order.payment.razorpayPaymentId = dto.razorpayPaymentId;
    order.markModified('payment');

    if (order.status === PORTER_ORDER_STATUS.CREATED) {
        const isScheduled = order.scheduledAt && order.scheduledAt.getTime() > Date.now() + 60_000;
        
        if (isScheduled) {
            order.status = PORTER_ORDER_STATUS.SCHEDULED;
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

            await schedulePorterOrderDispatch(order._id, order.scheduledAt);
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
