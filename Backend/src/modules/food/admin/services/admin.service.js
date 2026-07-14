import mongoose from 'mongoose';
import { ValidationError, ConflictError } from '../../../../core/auth/errors.js';
import { assertNoZoneOverlap } from '../../../../utils/zoneOverlap.js';
import { FoodRestaurant } from '../../restaurant/models/restaurant.model.js';
import { DEFAULT_RESTAURANT_COMMISSION_RATE } from '../../constants/commission.constants.js';
import { validateRestaurantPhoneUniqueness, normalizeRestaurantPhone } from '../../restaurant/services/restaurant.service.js';
import { FoodRestaurantWallet } from '../../restaurant/models/restaurantWallet.model.js';
import { FoodDeliveryPartner } from '../../delivery/models/deliveryPartner.model.js';
import { DeliverySupportTicket } from '../../delivery/models/supportTicket.model.js';
import { FoodZone } from '../models/zone.model.js';
import { FoodCategory } from '../models/category.model.js';
import { FoodItem } from '../models/food.model.js';
import { FoodOffer } from '../models/offer.model.js';
import { FoodOfferUsage } from '../models/offerUsage.model.js';
import {
    COUPON_OWNER_TYPES,
    claimCouponCodeReservation,
    releaseCouponCodeReservation
} from '../../shared/couponCodeRegistry.util.js';
import { DeliveryBonusTransaction } from '../models/deliveryBonusTransaction.model.js';
import { DeliveryBonusAuditLog } from '../models/deliveryBonusAuditLog.model.js';
import { DeliveryBonusIdempotency } from '../models/deliveryBonusIdempotency.model.js';
import { buildBonusRequestHash } from '../utils/bonusRequestHash.js';
import { ensureDeliveryBonusIdempotencyIndexes } from '../database/bonusIndexManager.js';
import { FoodEarningAddon } from '../models/earningAddon.model.js';
import { FoodEarningAddonHistory } from '../models/earningAddonHistory.model.js';
import { FoodDeliveryCommissionRule } from '../models/deliveryCommissionRule.model.js';
import { FoodFeeSettings } from '../models/feeSettings.model.js';
import { FeedbackExperience } from '../models/feedbackExperience.model.js';
import { FoodUser } from '../../../../core/users/user.model.js';
import { FoodAdmin } from '../../../../core/admin/admin.model.js';
import { FoodRefreshToken } from '../../../../core/refreshTokens/refreshToken.model.js';
import { FoodDeliveryCashLimit } from '../models/deliveryCashLimit.model.js';
import { FoodDeliveryEmergencyHelp } from '../models/deliveryEmergencyHelp.model.js';
import { FoodReferralSettings } from '../models/referralSettings.model.js';
import { FoodReferralLog } from '../models/referralLog.model.js';
import { FoodSafetyEmergencyReport } from '../models/safetyEmergencyReport.model.js';
import { FoodAddon } from '../../restaurant/models/foodAddon.model.js';
import { FoodSupportTicket } from '../../user/models/supportTicket.model.js';
import { FoodRestaurantSupportTicket } from '../../restaurant/models/supportTicket.model.js';
import { FoodOrder } from '../../orders/models/order.model.js';
import { FoodTransaction } from '../../orders/models/foodTransaction.model.js';
import { buildOrderIdentityFilter } from '../../orders/services/order.helpers.js';
import { FoodRestaurantWithdrawal } from '../../restaurant/models/foodRestaurantWithdrawal.model.js';
import { applyPendingOpenDaysUpdate, discardPendingOpenDaysUpdate, syncOutletTimingsFromOpenDays } from '../../restaurant/services/outletTimings.service.js';
// import { applyPendingOpenDaysUpdate, discardPendingOpenDaysUpdate } from '../../restaurant/services/outletTimings.service.js';
import {
    buildApplyPendingProfileChangesUpdate,
    buildDiscardPendingProfileChangesUpdate,
} from '../../shared/pendingProfileChanges.js';
import {
    creditWallet,
    debitWallet
} from '../../../../core/payments/wallet.service.js';
import {
    getBalance,
    getTransactionsByEntity
} from '../../../../core/payments/transaction.service.js';
import { FoodDeliveryWithdrawal } from '../../delivery/models/foodDeliveryWithdrawal.model.js';
import { FoodDeliveryWallet } from '../../delivery/models/deliveryWallet.model.js';
import { FoodDeliveryCashDeposit } from '../../delivery/models/foodDeliveryCashDeposit.model.js';
import { initiateRazorpayRefund } from '../../orders/helpers/razorpay.helper.js';
import { refundWalletBalance } from '../../user/services/userWallet.service.js';
import * as foodTransactionService from '../../orders/services/foodTransaction.service.js';
import { getDeliveryPartnerWalletEnhanced } from '../../delivery/services/deliveryFinance.service.js';
import {
    backfillLegacyCategoryWorkflow,
    categoryAllowsFoodType,
    ensureUniqueCategoryName,
    normalizeCategoryFoodTypeScope,
    serializeCategoryForResponse
} from '../../shared/categoryWorkflow.js';
import {
    extractRawFoodVariants,
    getFoodDisplayPrice,
    hasFoodVariants,
    normalizeFoodVariantsInput,
    serializeFoodVariants
} from './foodVariant.service.js';
import { notifyCategoryStatusChange } from './categoryStatusNotification.service.js';
import { getCache, setCache } from '../../../../utils/cacheManager.js';
import {
    buildDashboardStatsCacheKey,
    DASHBOARD_STATS_CACHE_TTL_MS,
    invalidateDashboardStatsCache
} from '../utils/dashboardStatsCache.js';
import { sendNotificationToOwner } from '../../../../core/notifications/firebase.service.js';
import { resolveActionPerformerSnapshot } from '../../../../core/utils/performer.js';

const parseBooleanLike = (value, fieldName) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (['true', '1', 'yes', 'y', 'on', 'active'].includes(normalized)) return true;
        if (['false', '0', 'no', 'n', 'off', 'inactive'].includes(normalized)) return false;
    }
    throw new ValidationError(`${fieldName} must be a boolean`);
};

const toFiniteNumber = (value) => {
    if (value === null || value === undefined || value === '') return null;
    const num = typeof value === 'number' ? value : Number(String(value).trim());
    return Number.isFinite(num) ? num : null;
};

// Escapes user input before embedding it in a MongoDB $regex to prevent regex
// injection / ReDoS-style slowdowns from special characters like ( ) * + ? etc.
const escapeRegex = (value) => String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizeRestaurantTime = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return '';

    const toHHMM = (hour, minute) => {
        const h = Number(hour);
        const m = Number(minute);
        if (!Number.isFinite(h) || !Number.isFinite(m)) return '';
        if (h < 0 || h > 23 || m < 0 || m > 59) return '';
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    };

    const hhmm = raw.match(/^(\d{1,2}):(\d{2})$/);
    if (hhmm) return toHHMM(hhmm[1], hhmm[2]);

    const ampm = raw.match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])$/);
    if (ampm) {
        let hour = Number(ampm[1]);
        const minute = Number(ampm[2]);
        const period = ampm[3].toUpperCase();
        if (!Number.isFinite(hour) || !Number.isFinite(minute)) return '';
        if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return '';
        if (period === 'AM') hour = hour === 12 ? 0 : hour;
        if (period === 'PM') hour = hour === 12 ? 12 : hour + 12;
        return toHHMM(hour, minute);
    }

    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
        return toHHMM(parsed.getHours(), parsed.getMinutes());
    }

    return '';
};

const isPointInPolygon = (lat, lng, polygon) => {
    if (!Array.isArray(polygon) || polygon.length < 3) return false;
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].longitude;
        const yi = polygon[i].latitude;
        const xj = polygon[j].longitude;
        const yj = polygon[j].latitude;
        const intersect =
            yi > lat !== yj > lat &&
            lng < ((xj - xi) * (lat - yi)) / (yj - yi + 0.0) + xi;
        if (intersect) inside = !inside;
    }
    return inside;
};

const detectZoneFromPartner = (partner, zones) => {
    let detectedZone = null;
    if (partner.lastLat && partner.lastLng) {
        const match = zones.find(z => isPointInPolygon(partner.lastLat, partner.lastLng, z.coordinates));
        if (match) detectedZone = match.zoneName || match.name;
    }

    if (!detectedZone) {
        const city = (partner.city || '').trim().toLowerCase();
        const state = (partner.state || '').trim().toLowerCase();
        const address = (partner.address || '').trim().toLowerCase();
        const locStr = `${city} ${state} ${address}`;

        const match = zones.find(z => {
            const zName = (z.name || '').toLowerCase();
            const zZoneName = (z.zoneName || '').toLowerCase();
            const zLoc = (z.serviceLocation || '').toLowerCase();

            if (city && (zName === city || zZoneName === city || zLoc === city)) return true;
            if (zName && locStr.includes(zName)) return true;
            if (zZoneName && locStr.includes(zZoneName)) return true;
            if (zLoc && locStr.includes(zLoc)) return true;
            return false;
        });

        if (match) detectedZone = match.zoneName || match.name;
    }
    return detectedZone;
};

const partnerMatchesZone = (partner, zone) => {
    if (!partner || !zone) return false;
    const detected = detectZoneFromPartner(partner, [zone]);
    if (!detected) return false;
    const detectedKey = String(detected).trim().toLowerCase();
    return [zone.zoneName, zone.name, zone.serviceLocation]
        .filter(Boolean)
        .some((label) => String(label).trim().toLowerCase() === detectedKey);
};

async function getZoneDeliveryPartnerStats(zoneId, zoneDoc) {
    if (!zoneId || !zoneDoc) return { approved: 0, pending: 0 };

    const zoneObjectId = new mongoose.Types.ObjectId(zoneId);
    const orderPartnerIds = await FoodOrder.distinct('dispatch.deliveryPartnerId', {
        zoneId: zoneObjectId,
        orderType: 'food',
        'dispatch.deliveryPartnerId': { $ne: null },
    });

    const [approvedFromOrders, partners] = await Promise.all([
        orderPartnerIds.length
            ? FoodDeliveryPartner.countDocuments({ _id: { $in: orderPartnerIds }, status: 'approved' })
            : Promise.resolve(0),
        FoodDeliveryPartner.find({ status: { $in: ['approved', 'pending'] } })
            .select('status lastLat lastLng city state address')
            .lean(),
    ]);

    const orderPartnerIdSet = new Set(orderPartnerIds.map((id) => String(id)));
    let approvedByLocation = 0;
    let pending = 0;

    for (const partner of partners) {
        if (!partnerMatchesZone(partner, zoneDoc)) continue;
        if (partner.status === 'pending') {
            pending += 1;
        } else if (partner.status === 'approved' && !orderPartnerIdSet.has(String(partner._id))) {
            approvedByLocation += 1;
        }
    }

    return {
        approved: Number(approvedFromOrders) + approvedByLocation,
        pending,
    };
};

const timeToMinutes = (value) => {
    const normalized = normalizeRestaurantTime(value);
    if (!normalized) return null;
    const [h, m] = normalized.split(':').map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
    return h * 60 + m;
};

const validateOpeningClosingTimes = (openingTime, closingTime) => {
    const open = timeToMinutes(openingTime);
    const close = timeToMinutes(closingTime);
    if (open === null || close === null) return;
    if (open === close) {
        throw new ValidationError('Opening time and closing time cannot be same');
    }
    if (close < open) {
        throw new ValidationError('Closing time cannot be less than opening time');
    }
};

export async function getRestaurantComplaints(query = {}) {
    const limit = Math.min(Math.max(parseInt(query.limit, 10) || 50, 1), 500);
    const page = Math.max(parseInt(query.page, 10) || 1, 1);
    const skip = (page - 1) * limit;

    const filter = { type: 'order' };
    if (query.status && query.status !== 'all') filter.status = query.status;
    if (query.complaintType && query.complaintType !== 'all') filter.issueType = query.complaintType;
    if (query.restaurantId && mongoose.Types.ObjectId.isValid(query.restaurantId)) {
        filter.restaurantId = new mongoose.Types.ObjectId(query.restaurantId);
    }
    if (query.search) {
        const searchRegex = { $regex: query.search, $options: 'i' };
        const restaurantIds = await FoodRestaurant.find({ restaurantName: searchRegex }).select('_id').lean();
        const userIds = await FoodUser.find({ name: searchRegex }).select('_id').lean();
        const orderIds = await FoodOrder.find({ orderId: searchRegex, orderType: 'food' }).select('_id').lean();

        filter.$or = [
            { restaurantId: { $in: restaurantIds.map(r => r._id) } },
            { userId: { $in: userIds.map(u => u._id) } },
            { orderId: { $in: orderIds.map(o => o._id) } },
            { description: searchRegex },
            { issueType: searchRegex }
        ];
    }
    const fromDate = query.fromDate || query.startDate;
    const toDate = query.toDate || query.endDate;
    if (fromDate && toDate) {
        filter.createdAt = { $gte: new Date(fromDate), $lte: new Date(toDate) };
    }

    const [complaints, total] = await Promise.all([
        FoodSupportTicket.find(filter)
            .populate('userId', 'name phone profileImage')
            .populate('restaurantId', 'restaurantName profileImage area city')
            .populate('orderId', 'orderId orderStatus pricing createdAt')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        FoodSupportTicket.countDocuments(filter)
    ]);

    return { complaints, total, page, limit };
}

export async function globalSearch(query = '') {
    const term = String(query).trim();
    if (!term) return [];
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = { $regex: escaped, $options: 'i' };

    const [orders, users, restaurants, items, categories, addons] = await Promise.all([
        FoodOrder.find({
            orderType: 'food',
            $or: [{ orderId: regex }, { orderStatus: regex }]
        })
            .limit(5)
            .select('orderId orderStatus createdAt')
            .lean(),
        FoodUser.find({
            $or: [{ name: regex }, { email: regex }, { phone: regex }],
            role: 'USER'
        })
            .limit(5)
            .select('name email phone')
            .lean(),
        FoodRestaurant.find({
            $or: [{ restaurantName: regex }, { ownerName: regex }, { city: regex }]
        })
            .limit(5)
            .select('restaurantName city area status')
            .lean(),
        FoodItem.find({
            $or: [{ name: regex }, { description: regex }]
        })
            .limit(5)
            .select('name description price')
            .lean(),
        FoodCategory.find({ name: regex })
            .limit(3)
            .select('name image')
            .lean(),
        FoodAddon.find({ name: regex })
            .limit(3)
            .select('name price')
            .lean()
    ]);

    const results = [];

    orders.forEach(o => results.push({
        id: o._id,
        type: 'Order',
        title: `#${o.orderId}`,
        description: `Status: ${o.orderStatus}`,
        path: `/admin/food/orders/all?orderId=${o._id}`
    }));

    users.forEach(u => results.push({
        id: u._id,
        type: 'User',
        title: u.name || 'Unnamed',
        description: `${u.email || u.phone || ''}`,
        path: `/admin/food/customers?userId=${u._id}`
    }));

    restaurants.forEach(r => results.push({
        id: r._id,
        type: 'Restaurant',
        title: r.restaurantName,
        description: `${r.area || ''}, ${r.city || ''} (${r.status})`,
        path: `/admin/food/restaurants?restaurantId=${r._id}`
    }));

    items.forEach(i => results.push({
        id: i._id,
        type: 'Product',
        title: i.name,
        description: `Price: ₹${i.price}`,
        path: `/admin/food/foods?productId=${i._id}`
    }));

    categories.forEach(c => results.push({
        id: c._id,
        type: 'Category',
        title: c.name,
        description: 'Menu Category',
        path: `/admin/food/categories`
    }));

    addons.forEach(a => results.push({
        id: a._id,
        type: 'Addon',
        title: a.name,
        description: `Price: ₹${a.price}`,
        path: `/admin/food/addons`
    }));

    return results;
}

export async function updateRestaurantComplaint(id, updateData) {
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        throw new ValidationError('Invalid complaint ID');
    }
    const update = {};
    if (updateData.status) update.status = updateData.status;
    if (updateData.adminResponse !== undefined) update.adminResponse = updateData.adminResponse;

    const updated = await FoodSupportTicket.findByIdAndUpdate(
        id,
        { $set: update },
        { new: true }
    ).lean();

    if (!updated) throw new ValidationError('Complaint not found');
    return updated;
}

export async function getRestaurants(query) {
    const limit = Math.min(Math.max(parseInt(query.limit, 10) || 100, 1), 1000);
    const page = Math.max(parseInt(query.page, 10) || 1, 1);
    const skip = (page - 1) * limit;
    const status = query.status;
    const filter = {};
    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
        filter.status = status;
    }
    const [restaurants, total] = await Promise.all([
        FoodRestaurant.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .select('restaurantId restaurantName location area city profileImage coverImages menuImages status ownerName ownerPhone zoneId commissionPercentage isListed productCount pureVegRestaurant createdAt updatedAt showWithoutMenu')
            .populate('zoneId', 'name zoneName')
            .lean(),
        FoodRestaurant.countDocuments(filter)
    ]);
    return { restaurants, total, page, limit };
}

const CANCELLED_ORDER_STATUSES = ['cancelled_by_user', 'cancelled_by_restaurant', 'cancelled_by_admin'];
const PENDING_ORDER_STATUSES = ['placed', 'created'];
const PROCESSING_ORDER_STATUSES = ['confirmed', 'preparing', 'ready_for_pickup', 'picked_up'];
// Fallback commission rate applied to a delivered order's subtotal when the order
// has no stored restaurantCommission (e.g. legacy orders created before commission tracking).

const getDateRangeByPeriod = (periodRaw) => {
    const period = String(periodRaw || 'overall').trim().toLowerCase();
    if (!period || period === 'overall' || period === 'all') return null;

    const now = new Date();
    const start = new Date(now);
    const end = new Date(now);

    if (period === 'today') {
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        return { start, end };
    }

    if (period === 'week') {
        start.setHours(0, 0, 0, 0);
        start.setDate(start.getDate() - start.getDay());
        end.setTime(start.getTime());
        end.setDate(start.getDate() + 6);
        end.setHours(23, 59, 59, 999);
        return { start, end };
    }

    if (period === 'month') {
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        return { start: monthStart, end: monthEnd };
    }

    if (period === 'year') {
        const yearStart = new Date(now.getFullYear(), 0, 1);
        const yearEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
        return { start: yearStart, end: yearEnd };
    }

    return null;
};

const formatMonthShort = (year, monthIndex) =>
    new Date(year, monthIndex, 1).toLocaleString('en-IN', { month: 'short' });

// Builds a period-aware trend configuration for the dashboard chart so the
// trajectory series matches the selected filter:
//   today  -> hourly buckets
//   week   -> daily buckets (the selected week)
//   month  -> daily buckets (the selected month)
//   year   -> monthly buckets (current year)
//   overall-> rolling last 12 months
// The bucket `label` is always returned in the response `month` field to keep
// the existing frontend chart contract unchanged.
const getDashboardTrendConfig = (periodRaw, periodRange, now = new Date()) => {
    const period = String(periodRaw || 'overall').trim().toLowerCase();

    if (period === 'today' && periodRange) {
        const buckets = [];
        for (let h = 0; h < 24; h += 1) {
            buckets.push({ key: `${h}`, label: `${String(h).padStart(2, '0')}:00` });
        }
        return {
            groupId: { hour: { $hour: '$createdAt' } },
            keyOf: (id) => `${id?.hour}`,
            buckets,
            extraMatch: null,
        };
    }

    if ((period === 'week' || period === 'month') && periodRange) {
        const buckets = [];
        const cursor = new Date(periodRange.start);
        const end = new Date(periodRange.end);
        while (cursor <= end) {
            buckets.push({
                key: `${cursor.getFullYear()}-${cursor.getMonth() + 1}-${cursor.getDate()}`,
                label: cursor.toLocaleString('en-IN', { day: '2-digit', month: 'short' }),
            });
            cursor.setDate(cursor.getDate() + 1);
        }
        return {
            groupId: {
                year: { $year: '$createdAt' },
                month: { $month: '$createdAt' },
                day: { $dayOfMonth: '$createdAt' },
            },
            keyOf: (id) => `${id?.year}-${id?.month}-${id?.day}`,
            buckets,
            extraMatch: null,
        };
    }

    if (period === 'year' && periodRange) {
        const buckets = [];
        for (let m = 0; m < 12; m += 1) {
            buckets.push({ key: `${now.getFullYear()}-${m + 1}`, label: formatMonthShort(now.getFullYear(), m) });
        }
        return {
            groupId: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
            keyOf: (id) => `${id?.year}-${id?.month}`,
            buckets,
            extraMatch: null,
        };
    }

    // overall (default) -> rolling last 12 months
    const buckets = [];
    for (let i = 11; i >= 0; i -= 1) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        buckets.push({ key: `${d.getFullYear()}-${d.getMonth() + 1}`, label: formatMonthShort(d.getFullYear(), d.getMonth()) });
    }
    return {
        groupId: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
        keyOf: (id) => `${id?.year}-${id?.month}`,
        buckets,
        extraMatch: {
            createdAt: {
                $gte: new Date(now.getFullYear(), now.getMonth() - 11, 1),
                $lte: new Date(),
            },
        },
    };
};

export async function getDashboardStats(query = {}) {
    const cacheKey = buildDashboardStatsCacheKey(query);
    const cached = getCache(cacheKey);
    if (cached) return cached;

    const periodRange = getDateRangeByPeriod(query.period);
    const zoneId = query.zoneId && mongoose.Types.ObjectId.isValid(query.zoneId)
        ? new mongoose.Types.ObjectId(query.zoneId)
        : null;

    const orderMatch = {
        orderType: 'food',
        $or: [
            { "payment.method": { $in: ["cash", "wallet"] } },
            { "payment.status": { $in: ["paid", "authorized", "captured", "settled", "refunded"] } },
        ],
    };
    if (periodRange) {
        orderMatch.createdAt = { $gte: periodRange.start, $lte: periodRange.end };
    }
    if (zoneId) {
        orderMatch.zoneId = zoneId;
    }

    const restaurantMatch = {};
    if (zoneId) {
        restaurantMatch.zoneId = zoneId;
    }

    const zoneRestaurantIds = zoneId
        ? await FoodRestaurant.find({ zoneId }).distinct('_id')
        : null;
    const zoneDoc = zoneId
        ? await FoodZone.findById(zoneId).select('zoneName name serviceLocation coordinates').lean()
        : null;
    const zoneScopedRestaurantMatch = zoneId
        ? { restaurantId: { $in: zoneRestaurantIds || [] } }
        : {};

    const trendConfig = getDashboardTrendConfig(query.period, periodRange);
    const zoneDeliveryStatsPromise = zoneId && zoneDoc
        ? getZoneDeliveryPartnerStats(zoneId, zoneDoc)
        : null;

    const [
        orderTotalsAgg,
        monthlyAgg,
        restaurantsTotal,
        restaurantsPending,
        deliveryTotal,
        deliveryPending,
        foodsTotal,
        addonsTotal,
        customersTotal,
        recentPendingRestaurants,
        recentPendingDelivery,
        recentPendingOrders,
        recentDeliveredOrders,
        recentCancelledOrders,
        recentCustomers
    ] = await Promise.all([
        FoodOrder.aggregate([
            { $match: orderMatch },
            {
                $group: {
                    _id: null,
                    totalOrders: { $sum: 1 },
                    delivered: { $sum: { $cond: [{ $eq: ['$orderStatus', 'delivered'] }, 1, 0] } },
                    cancelled: {
                        $sum: {
                            $cond: [
                                {
                                    $and: [
                                        { $in: ['$orderStatus', CANCELLED_ORDER_STATUSES] },
                                        { $ne: ['$payment.status', 'refunded'] }
                                    ]
                                },
                                1,
                                0
                            ]
                        }
                    },
                    refunded: {
                        $sum: {
                            $cond: [{ $eq: ['$payment.status', 'refunded'] }, 1, 0]
                        }
                    },
                    pendingOnly: {
                        $sum: {
                            $cond: [{ $in: ['$orderStatus', PENDING_ORDER_STATUSES] }, 1, 0]
                        }
                    },
                    processing: {
                        $sum: {
                            $cond: [{ $in: ['$orderStatus', PROCESSING_ORDER_STATUSES] }, 1, 0]
                        }
                    },
                    revenueTotal: {
                        $sum: {
                            $cond: [{ $eq: ['$orderStatus', 'delivered'] }, { $ifNull: ['$pricing.total', 0] }, 0]
                        }
                    },
                    commissionTotal: {
                        $sum: {
                            $cond: [
                                { $eq: ['$orderStatus', 'delivered'] },
                                {
                                    $cond: [
                                        { $gt: [{ $ifNull: ['$pricing.restaurantCommission', 0] }, 0] },
                                        '$pricing.restaurantCommission',
                                        { $multiply: [{ $ifNull: ['$pricing.subtotal', 0] }, DEFAULT_RESTAURANT_COMMISSION_RATE] }
                                    ]
                                },
                                0
                            ]
                        }
                    },
                    platformFeeTotal: {
                        $sum: {
                            $cond: [
                                { $in: ['$orderStatus', [...CANCELLED_ORDER_STATUSES, 'refunded']] },
                                0,
                                { $ifNull: ['$pricing.platformFee', 0] }
                            ]
                        }
                    },
                    deliveryFeeTotal: {
                        $sum: {
                            $cond: [
                                { $in: ['$orderStatus', [...CANCELLED_ORDER_STATUSES, 'refunded']] },
                                0,
                                { $ifNull: ['$pricing.deliveryFee', 0] }
                            ]
                        }
                    },
                    gstTotal: {
                        $sum: {
                            $cond: [{ $eq: ['$orderStatus', 'delivered'] }, { $ifNull: ['$pricing.tax', 0] }, 0]
                        }
                    },
                    adminNetProfit: {
                        $sum: {
                            $cond: [{ $eq: ['$orderStatus', 'delivered'] }, { $ifNull: ['$platformProfit', 0] }, 0]
                        }
                    }
                }
            }
        ]),
        FoodOrder.aggregate([
            {
                $match: {
                    ...orderMatch,
                    ...(trendConfig.extraMatch || {})
                }
            },
            {
                $group: {
                    _id: trendConfig.groupId,
                    orders: { $sum: 1 },
                    revenue: {
                        $sum: {
                            $cond: [{ $eq: ['$orderStatus', 'delivered'] }, { $ifNull: ['$pricing.total', 0] }, 0]
                        }
                    },
                    commission: {
                        $sum: {
                            $cond: [
                                { $eq: ['$orderStatus', 'delivered'] },
                                {
                                    $cond: [
                                        { $gt: [{ $ifNull: ['$pricing.restaurantCommission', 0] }, 0] },
                                        '$pricing.restaurantCommission',
                                        { $multiply: [{ $ifNull: ['$pricing.subtotal', 0] }, DEFAULT_RESTAURANT_COMMISSION_RATE] }
                                    ]
                                },
                                0
                            ]
                        }
                    }
                }
            }
        ]),
        FoodRestaurant.countDocuments({ ...restaurantMatch, status: 'approved' }),
        FoodRestaurant.countDocuments({ ...restaurantMatch, status: 'pending' }),
        zoneDeliveryStatsPromise
            ? zoneDeliveryStatsPromise.then((stats) => stats.approved)
            : FoodDeliveryPartner.countDocuments({ status: 'approved' }),
        zoneDeliveryStatsPromise
            ? zoneDeliveryStatsPromise.then((stats) => stats.pending)
            : FoodDeliveryPartner.countDocuments({ status: 'pending' }),
        FoodItem.countDocuments({ approvalStatus: 'approved', ...zoneScopedRestaurantMatch }),
        FoodAddon.countDocuments({ approvalStatus: 'approved', isDeleted: { $ne: true }, ...zoneScopedRestaurantMatch }),
        zoneId
            ? FoodOrder.distinct('userId', { ...orderMatch, userId: { $ne: null } }).then((ids) => ids.length)
            : FoodUser.countDocuments({}),
        FoodRestaurant.find({ ...restaurantMatch, status: 'pending' }).sort({ createdAt: -1 }).limit(5).select('restaurantName createdAt').lean(),
        zoneId && zoneDoc
            ? FoodDeliveryPartner.find({ status: 'pending' })
                .sort({ createdAt: -1 })
                .limit(25)
                .select('name createdAt lastLat lastLng city state address')
                .lean()
                .then((list) => list.filter((partner) => partnerMatchesZone(partner, zoneDoc)).slice(0, 5))
            : FoodDeliveryPartner.find({ status: 'pending' }).sort({ createdAt: -1 }).limit(5).select('name createdAt').lean(),
        FoodOrder.find({
            ...orderMatch,
            orderStatus: { $in: [...PENDING_ORDER_STATUSES, ...PROCESSING_ORDER_STATUSES] },
        }).sort({ createdAt: -1 }).limit(5).select('orderId createdAt').lean(),
        FoodOrder.find({ ...orderMatch, orderStatus: 'delivered' }).sort({ updatedAt: -1 }).limit(5).select('orderId updatedAt').lean(),
        FoodOrder.find({
            ...orderMatch,
            orderStatus: { $in: CANCELLED_ORDER_STATUSES },
        }).sort({ updatedAt: -1 }).limit(5).select('orderId updatedAt').lean(),
        zoneId
            ? FoodOrder.aggregate([
                { $match: { ...orderMatch, userId: { $ne: null } } },
                { $sort: { createdAt: -1 } },
                {
                    $group: {
                        _id: '$userId',
                        createdAt: { $first: '$createdAt' }
                    }
                },
                { $sort: { createdAt: -1 } },
                { $limit: 5 },
                {
                    $lookup: {
                        from: 'users',
                        localField: '_id',
                        foreignField: '_id',
                        as: 'user'
                    }
                },
                { $unwind: '$user' },
                {
                    $project: {
                        _id: '$user._id',
                        name: '$user.name',
                        createdAt: 1
                    }
                }
            ])
            : FoodUser.find({}).sort({ createdAt: -1 }).limit(5).select('name createdAt').lean()
    ]);

    const liveSignals = [];

    (recentPendingRestaurants || []).forEach(r => {
        liveSignals.push({
            type: 'restaurant',
            title: 'New Restaurant Request',
            detail: `${r.restaurantName} is waiting for approval`,
            time: formatTimeAgo(r.createdAt),
            timestamp: r.createdAt
        });
    });

    (recentPendingDelivery || []).forEach(d => {
        liveSignals.push({
            type: 'delivery',
            title: 'New Delivery Partner',
            detail: `${d.name} requested to join`,
            time: formatTimeAgo(d.createdAt),
            timestamp: d.createdAt
        });
    });

    (recentPendingOrders || []).forEach(o => {
        liveSignals.push({
            type: 'order_pending',
            title: 'New Order Received',
            detail: `Order #${o.orderId} is pending`,
            time: formatTimeAgo(o.createdAt),
            timestamp: o.createdAt
        });
    });

    (recentDeliveredOrders || []).forEach(o => {
        liveSignals.push({
            type: 'order_delivered',
            title: 'Order Delivered',
            detail: `Order #${o.orderId} was successful`,
            time: formatTimeAgo(o.updatedAt),
            timestamp: o.updatedAt
        });
    });

    (recentCancelledOrders || []).forEach(o => {
        liveSignals.push({
            type: 'order_cancelled',
            title: 'Order Cancelled',
            detail: `Order #${o.orderId} was cancelled`,
            time: formatTimeAgo(o.updatedAt),
            timestamp: o.updatedAt
        });
    });

    (recentCustomers || []).forEach(c => {
        liveSignals.push({
            type: 'customer',
            title: 'New Customer',
            detail: `${c.name} just registered`,
            time: formatTimeAgo(c.createdAt),
            timestamp: c.createdAt
        });
    });

    // Sort by timestamp and take top 15
    liveSignals.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const finalLiveSignals = liveSignals.slice(0, 15);

    const totals = orderTotalsAgg?.[0] || {};

    const monthlyMap = new Map(
        (monthlyAgg || []).map((row) => [trendConfig.keyOf(row._id), row])
    );

    const monthlyData = trendConfig.buckets.map((bucket) => {
        const row = monthlyMap.get(bucket.key);
        return {
            month: bucket.label,
            orders: Number(row?.orders || 0),
            revenue: Number(row?.revenue || 0),
            commission: Number(row?.commission || 0)
        };
    });

    const result = {
        orders: {
            total: Number(totals.totalOrders || 0),
            byStatus: {
                delivered: Number(totals.delivered || 0),
                cancelled: Number(totals.cancelled || 0),
                refunded: Number(totals.refunded || 0),
                pending: Number(totals.pendingOnly || 0),
                processing: Number(totals.processing || 0)
            }
        },
        revenue: { total: Number(totals.revenueTotal || 0) },
        commission: { total: Number(totals.commissionTotal || 0) },
        platformFee: { total: Number(totals.platformFeeTotal || 0) },
        deliveryFee: { total: Number(totals.deliveryFeeTotal || 0) },
        gst: { total: Number(totals.gstTotal || 0) },
        totalAdminEarnings: Number(totals.adminNetProfit || 0),
        deliveryProfit: Number(totals.adminNetProfit || 0) - Number(totals.platformFeeTotal || 0),
        restaurants: {
            total: Number(restaurantsTotal || 0),
            pendingRequests: Number(restaurantsPending || 0)
        },
        deliveryBoys: {
            total: Number(deliveryTotal || 0),
            pendingRequests: Number(deliveryPending || 0)
        },
        foods: { total: Number(foodsTotal || 0) },
        addons: { total: Number(addonsTotal || 0) },
        customers: { total: Number(customersTotal || 0) },
        orderStats: {
            pending: Number(totals.pendingOnly || 0),
            processing: Number(totals.processing || 0),
            completed: Number(totals.delivered || 0)
        },
        monthlyData,
        liveSignals: finalLiveSignals
    };

    setCache(cacheKey, result, DASHBOARD_STATS_CACHE_TTL_MS);
    return result;
}

function formatTimeAgo(date) {
    if (!date) return '';
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + ' years ago';
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + ' months ago';
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + ' days ago';
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + ' hours ago';
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + ' minutes ago';
    return Math.floor(seconds) + ' seconds ago';
}


const mapTransactionReportRow = (tx) => {
    const order = tx.orderId || {};
    const pricing = { ...(tx.pricing || {}), ...(order.pricing || {}) };
    const subtotal = Number(pricing.subtotal || 0) || 0;
    const packagingFee = Number(pricing.packagingFee || 0) || 0;
    const deliveryFee = Number(pricing.deliveryFee || 0) || 0;
    const tax = Number(pricing.tax || 0) || 0;
    const discount = Number(pricing.discount || 0) || 0;
    const total = Number(pricing.total || 0) || 0;
    const { totalDiscount, couponDiscount, itemDiscount, referralDiscount } = resolveTransactionDiscounts(pricing);

    const platformFeeDerived = Math.max(
        0,
        total - subtotal - packagingFee - deliveryFee - tax + discount
    );
    const platformFee =
        pricing.platformFee !== undefined && pricing.platformFee !== null
            ? Number(pricing.platformFee || 0) || 0
            : platformFeeDerived;

    return {
        id: tx._id,
        orderId: tx.orderReadableId || order.orderId || 'N/A',
        restaurant: tx.restaurantId?.restaurantName || 'N/A',
        customerName: tx.userId?.name || 'Guest',
        totalItemAmount: subtotal,
        itemDiscount,
        couponDiscount,
        referralDiscount,
        discountedAmount: Math.max(0, subtotal - totalDiscount),
        vatTax: tx.amounts?.taxAmount || pricing.tax || 0,
        deliveryCharge: pricing.deliveryFee || 0,
        platformFee,
        orderAmount: tx.amounts?.totalCustomerPaid || pricing.total || 0,
        status: tx.status
    };
};

const buildTransactionReportSummaryPipeline = () => ([
    {
        $lookup: {
            from: 'food_orders',
            localField: 'orderId',
            foreignField: '_id',
            as: 'order'
        }
    },
    { $unwind: { path: '$order', preserveNullAndEmptyArrays: true } },
    {
        $group: {
            _id: null,
            completedTransaction: {
                $sum: {
                    $cond: [
                        {
                            $or: [
                                { $in: ['$status', ['captured', 'settled']] },
                                { $eq: ['$order.orderStatus', 'delivered'] }
                            ]
                        },
                        { $ifNull: ['$amounts.totalCustomerPaid', 0] },
                        0
                    ]
                }
            },
            refundedTransaction: {
                $sum: {
                    $cond: [
                        {
                            $or: [
                                { $eq: ['$status', 'refunded'] },
                                { $eq: ['$order.orderStatus', 'cancelled_by_admin'] }
                            ]
                        },
                        { $ifNull: ['$amounts.totalCustomerPaid', 0] },
                        0
                    ]
                }
            },
            adminEarning: {
                $sum: {
                    $cond: [
                        {
                            $or: [
                                { $in: ['$status', ['captured', 'settled']] },
                                { $eq: ['$order.orderStatus', 'delivered'] }
                            ]
                        },
                        { $ifNull: ['$amounts.platformNetProfit', 0] },
                        0
                    ]
                }
            },
            restaurantEarning: {
                $sum: {
                    $cond: [
                        {
                            $or: [
                                { $in: ['$status', ['captured', 'settled']] },
                                { $eq: ['$order.orderStatus', 'delivered'] }
                            ]
                        },
                        { $ifNull: ['$amounts.restaurantShare', 0] },
                        0
                    ]
                }
            },
            deliverymanEarning: {
                $sum: {
                    $cond: [
                        {
                            $or: [
                                { $in: ['$status', ['captured', 'settled']] },
                                { $eq: ['$order.orderStatus', 'delivered'] }
                            ]
                        },
                        { $ifNull: ['$amounts.riderShare', 0] },
                        0
                    ]
                }
            }
        }
    }
]);

export async function getTransactionReport(query = {}) {
    const { fromDate, toDate, zone, restaurant, search } = query;
    const limit = Math.min(Math.max(parseInt(query.limit, 10) || 50, 1), 500);
    const page = Math.max(parseInt(query.page, 10) || 1, 1);
    const skip = (page - 1) * limit;
    const match = { orderType: 'food' };

    if (fromDate && toDate) {
        match.createdAt = { $gte: new Date(fromDate), $lte: new Date(toDate) };
    }

    if (search) {
        const searchRegex = new RegExp(String(search).trim(), "i");
        const matchingOrders = await FoodOrder.find({ orderId: { $regex: searchRegex }, orderType: 'food' })
            .select('_id')
            .lean();

        match.$or = [
            { orderReadableId: { $regex: searchRegex } },
            { orderId: { $in: matchingOrders.map((order) => order._id) } }
        ];
    }

    if (zone || restaurant) {
        const restFilter = {};
        if (zone) restFilter.zoneId = zone;
        if (restaurant && restaurant !== 'All restaurants') {
            const restDoc = await mongoose.model('FoodRestaurant').findOne({ restaurantName: restaurant }).lean();
            if (restDoc) restFilter._id = restDoc._id;
        }

        if (Object.keys(restFilter).length > 0) {
            const restaurantsList = await mongoose.model('FoodRestaurant').find(restFilter).select('_id').lean();
            const restaurantIds = restaurantsList.map(r => r._id);
            match.restaurantId = { $in: restaurantIds };
        }
    }

    const [total, transactionRows, summaryRows] = await Promise.all([
        FoodTransaction.countDocuments(match),
        FoodTransaction.find(match)
            .populate('orderId')
            .populate('userId', 'name')
            .populate('restaurantId', 'restaurantName')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        FoodTransaction.aggregate([
            { $match: match },
            ...buildTransactionReportSummaryPipeline()
        ])
    ]);

    const summaryDoc = summaryRows?.[0] || {};
    const summary = {
        completedTransaction: Number(summaryDoc.completedTransaction || 0),
        refundedTransaction: Number(summaryDoc.refundedTransaction || 0),
        adminEarning: Number(summaryDoc.adminEarning || 0),
        restaurantEarning: Number(summaryDoc.restaurantEarning || 0),
        deliverymanEarning: Number(summaryDoc.deliverymanEarning || 0),
    };

    return {
        transactions: transactionRows.map(mapTransactionReportRow),
        summary,
        pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit) || 1
        }
    };
}

const resolveTransactionDiscounts = (pricing = {}) => {
    const totalDiscount = Math.max(0, Number(pricing.discount || 0) || 0);
    const couponFromApplied = Math.max(0, Number(pricing.appliedCoupon?.discount || 0) || 0);
    const referralDiscount = Math.max(0, Number(pricing.referralDiscount || 0) || 0);
    const hasCouponCode = Boolean(pricing.couponCode || pricing.appliedCoupon?.code);

    let couponDiscount = 0;
    if (couponFromApplied > 0) {
        couponDiscount = Math.min(totalDiscount, couponFromApplied);
    } else if (hasCouponCode && totalDiscount > 0) {
        couponDiscount = Math.max(0, totalDiscount - referralDiscount);
    }

    const itemDiscount = Math.max(0, totalDiscount - couponDiscount - referralDiscount);
    return { totalDiscount, couponDiscount, itemDiscount, referralDiscount };
};

export async function getRestaurantReport(query = {}) {
    const parseTimeRange = (timeLabel) => {
        const now = new Date();
        const start = new Date(now);
        const end = new Date(now);

        const value = String(timeLabel || '').trim().toLowerCase();
        if (!value || value === 'all time') return null;

        if (value === 'today') {
            start.setHours(0, 0, 0, 0);
            end.setHours(23, 59, 59, 999);
            return { $gte: start, $lte: end };
        }

        if (value === 'this week') {
            const day = start.getDay(); // 0=Sun
            const diffToMonday = day === 0 ? 6 : day - 1;
            start.setDate(start.getDate() - diffToMonday);
            start.setHours(0, 0, 0, 0);
            end.setHours(23, 59, 59, 999);
            return { $gte: start, $lte: end };
        }

        if (value === 'this month') {
            start.setDate(1);
            start.setHours(0, 0, 0, 0);
            end.setHours(23, 59, 59, 999);
            return { $gte: start, $lte: end };
        }

        if (value === 'this year') {
            start.setMonth(0, 1);
            start.setHours(0, 0, 0, 0);
            end.setHours(23, 59, 59, 999);
            return { $gte: start, $lte: end };
        }

        return null;
    };

    const formatCurrency = (value) => `\u20B9${Number(value || 0).toFixed(2)}`;

    const limit = Math.min(Math.max(parseInt(query.limit, 10) || 1000, 1), 5000);
    const page = Math.max(parseInt(query.page, 10) || 1, 1);
    const skip = (page - 1) * limit;

    const restaurantFilter = {};
    const allFilter = String(query.all || '').trim().toLowerCase();
    if (allFilter === 'active') {
        restaurantFilter.status = 'approved';
    } else if (allFilter === 'inactive') {
        restaurantFilter.status = { $ne: 'approved' };
    }

    const zoneRaw = String(query.zone || '').trim();
    if (zoneRaw) {
        if (mongoose.Types.ObjectId.isValid(zoneRaw)) {
            restaurantFilter.zoneId = new mongoose.Types.ObjectId(zoneRaw);
        } else {
            const matchedZone = await FoodZone.findOne({
                $or: [{ name: zoneRaw }, { zoneName: zoneRaw }]
            })
                .select('_id')
                .lean();
            if (matchedZone?._id) {
                restaurantFilter.zoneId = matchedZone._id;
            } else {
                return { restaurants: [], total: 0, page, limit };
            }
        }
    }

    const searchRaw = String(query.search || '').trim();
    if (searchRaw) {
        const escaped = searchRaw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        restaurantFilter.$or = [
            { restaurantName: { $regex: escaped, $options: 'i' } },
            { ownerName: { $regex: escaped, $options: 'i' } },
            { ownerPhone: { $regex: escaped, $options: 'i' } },
            { city: { $regex: escaped, $options: 'i' } },
            { area: { $regex: escaped, $options: 'i' } }
        ];
    }

    const [restaurantDocs, total] = await Promise.all([
        FoodRestaurant.find(restaurantFilter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .select('restaurantName profileImage rating totalRatings status zoneId')
            .populate('zoneId', 'name zoneName')
            .lean(),
        FoodRestaurant.countDocuments(restaurantFilter)
    ]);

    const restaurantIds = restaurantDocs.map((r) => r._id).filter(Boolean);
    if (!restaurantIds.length) {
        return { restaurants: [], total, page, limit };
    }

    const orderCreatedAtFilter = parseTimeRange(query.time);
    const orderMatch = {
        orderType: 'food',
        restaurantId: { $in: restaurantIds },
        $or: [
            { "payment.method": { $in: ["cash", "wallet"] } },
            { "payment.status": { $in: ["paid", "authorized", "captured", "settled", "refunded"] } },
        ],
    };
    if (orderCreatedAtFilter) {
        orderMatch.createdAt = orderCreatedAtFilter;
    }

    const [foodsAgg, ordersAgg] = await Promise.all([
        FoodItem.aggregate([
            {
                $match: {
                    restaurantId: { $in: restaurantIds },
                    approvalStatus: 'approved'
                }
            },
            {
                $group: {
                    _id: '$restaurantId',
                    totalFood: { $sum: 1 }
                }
            }
        ]),
        FoodOrder.aggregate([
            { $match: orderMatch },
            {
                $group: {
                    _id: '$restaurantId',
                    totalOrder: { $sum: 1 },
                    totalOrderAmount: { $sum: { $ifNull: ['$pricing.total', 0] } },
                    totalDiscountGiven: { $sum: { $ifNull: ['$pricing.discount', 0] } },
                    totalVATTAX: { $sum: { $ifNull: ['$pricing.tax', 0] } },
                    totalAdminCommissionFromPlatformProfit: { $sum: { $ifNull: ['$platformProfit', 0] } },
                    totalAdminCommissionFromPlatformFee: { $sum: { $ifNull: ['$pricing.platformFee', 0] } }
                }
            }
        ])
    ]);

    const foodMap = new Map(foodsAgg.map((x) => [String(x._id), Number(x.totalFood || 0)]));
    const orderMap = new Map(
        ordersAgg.map((x) => [
            String(x._id),
            {
                totalOrder: Number(x.totalOrder || 0),
                totalOrderAmount: Number(x.totalOrderAmount || 0),
                totalDiscountGiven: Number(x.totalDiscountGiven || 0),
                totalVATTAX: Number(x.totalVATTAX || 0),
                totalAdminCommission:
                    Number(x.totalAdminCommissionFromPlatformProfit || 0) > 0
                        ? Number(x.totalAdminCommissionFromPlatformProfit || 0)
                        : Number(x.totalAdminCommissionFromPlatformFee || 0)
            }
        ])
    );

    const restaurants = restaurantDocs.map((restaurant, index) => {
        const key = String(restaurant._id);
        const counts = orderMap.get(key) || {
            totalOrder: 0,
            totalOrderAmount: 0,
            totalDiscountGiven: 0,
            totalVATTAX: 0,
            totalAdminCommission: 0
        };

        return {
            _id: restaurant._id,
            sl: skip + index + 1,
            icon: restaurant.profileImage || '',
            restaurantName: restaurant.restaurantName || '',
            totalFood: foodMap.get(key) || 0,
            totalOrder: counts.totalOrder,
            totalOrderAmount: formatCurrency(counts.totalOrderAmount),
            totalDiscountGiven: formatCurrency(counts.totalDiscountGiven),
            totalAdminCommission: formatCurrency(counts.totalAdminCommission),
            totalVATTAX: formatCurrency(counts.totalVATTAX),
            averageRatings: Number(restaurant.rating || 0),
            reviews: Number(restaurant.totalRatings || 0),
            status: restaurant.status || 'pending',
            zoneName: restaurant.zoneId?.name || restaurant.zoneId?.zoneName || ''
        };
    });

    return { restaurants, total, page, limit };
}

export async function getTaxReport(query = {}) {
    const { fromDate, toDate, search } = query;
    const match = {
        orderType: 'food',
        orderStatus: 'delivered' // Typically tax is reported on delivered/completed orders
    };

    if (fromDate && toDate) {
        match.createdAt = { $gte: new Date(fromDate), $lte: new Date(toDate) };
    }

    if (search) {
        // Search by order ID if provided
        match.orderId = { $regex: search, $options: 'i' };
    }

    // Aggregate tax by income source (Restaurants, Delivery, Platform)
    // For now, we'll group by Restaurant as the primary income source
    const taxData = await FoodOrder.aggregate([
        { $match: match },
        {
            $group: {
                _id: '$restaurantId',
                totalIncome: { $sum: { $ifNull: ['$pricing.total', 0] } },
                totalTax: { $sum: { $ifNull: ['$pricing.tax', 0] } },
                orderCount: { $sum: 1 }
            }
        },
        {
            $lookup: {
                from: 'food_restaurants',
                localField: '_id',
                foreignField: '_id',
                as: 'restaurant'
            }
        },
        { $unwind: { path: '$restaurant', preserveNullAndEmptyArrays: true } },
        {
            $project: {
                incomeSource: { $ifNull: ['$restaurant.restaurantName', 'Unknown Restaurant'] },
                totalIncome: 1,
                totalTax: 1,
                orderCount: 1
            }
        },
        { $sort: { totalTax: -1 } }
    ]);

    const stats = {
        totalIncome: 0,
        totalTax: 0
    };

    const reports = taxData.map((item, index) => {
        stats.totalIncome += item.totalIncome;
        stats.totalTax += item.totalTax;
        return {
            sl: index + 1,
            id: item._id,
            incomeSource: item.incomeSource,
            totalIncome: `\u20B9${item.totalIncome.toFixed(2)}`,
            totalTax: `\u20B9${item.totalTax.toFixed(2)}`,
            orderCount: item.orderCount
        };
    });

    return {
        reports,
        stats: {
            totalIncome: `\u20B9${stats.totalIncome.toFixed(2)}`,
            totalTax: `\u20B9${stats.totalTax.toFixed(2)}`
        }
    };
}

export async function getTaxReportDetail(restaurantId, query = {}) {
    if (!restaurantId || !mongoose.Types.ObjectId.isValid(restaurantId)) {
        throw new ValidationError('Invalid restaurant ID');
    }

    const { fromDate, toDate } = query;
    const match = {
        orderType: 'food',
        restaurantId: new mongoose.Types.ObjectId(restaurantId),
        orderStatus: 'delivered'
    };

    if (fromDate && toDate) {
        match.createdAt = { $gte: new Date(fromDate), $lte: new Date(toDate) };
    }

    const orders = await FoodOrder.find(match)
        .select('orderId pricing createdAt orderStatus')
        .sort({ createdAt: -1 })
        .lean();

    const restaurant = await FoodRestaurant.findById(restaurantId).select('restaurantName').lean();

    return {
        restaurantName: restaurant?.restaurantName || 'Unknown Restaurant',
        orders: orders.map(o => ({
            id: o._id,
            orderId: o.orderId,
            totalAmount: `\u20B9${(o.pricing?.total || 0).toFixed(2)}`,
            taxAmount: `\u20B9${(o.pricing?.tax || 0).toFixed(2)}`,
            date: o.createdAt
        }))
    };
}

// ----- Customers / Users (admin) -----
const FOOD_CUSTOMER_ORDER_TYPES = ['food', 'mixed'];

const sanitizeProfileImageUrl = (s) => {
    if (!s) return '';
    const str = String(s).trim();
    return str.replace(/^`+|`+$/g, '').trim();
};

const mapCustomerListItem = (u, stats = { totalOrder: 0, totalOrderAmount: 0 }) => ({
    id: u._id,
    _id: u._id,
    name: u.name || 'Unnamed',
    email: u.email || '',
    phone: u.phone || '',
    profileImage: sanitizeProfileImageUrl(u.profileImage || ''),
    countryCode: u.countryCode || '+91',
    status: u.isActive !== false,
    isActive: u.isActive !== false,
    isCodAllowed: u.isCodAllowed !== false,
    isVerified: u.isVerified === true,
    totalOrder: Number(stats.totalOrder || 0),
    totalOrderAmount: Number(stats.totalOrderAmount || 0),
    joiningDate: u.createdAt,
    createdAt: u.createdAt
});

function buildCustomerListFilter(query = {}) {
    const filter = { role: 'USER' };

    if (query.status) {
        if (String(query.status) === 'active') filter.isActive = true;
        if (String(query.status) === 'inactive') filter.isActive = false;
    }

    if (query.joiningDate && String(query.joiningDate).trim()) {
        const d = new Date(String(query.joiningDate));
        if (!Number.isNaN(d.getTime())) {
            const start = new Date(d);
            start.setHours(0, 0, 0, 0);
            const end = new Date(d);
            end.setHours(23, 59, 59, 999);
            filter.createdAt = { $gte: start, $lte: end };
        }
    }

    if (query.search && String(query.search).trim()) {
        const raw = String(query.search).trim().slice(0, 80);
        const term = escapeRegex(raw);
        filter.$or = [
            { name: { $regex: term, $options: 'i' } },
            { email: { $regex: term, $options: 'i' } },
            { phone: { $regex: term, $options: 'i' } }
        ];
    }

    return filter;
}

function parseDayBounds(dateStr) {
    const d = new Date(String(dateStr));
    if (Number.isNaN(d.getTime())) return null;
    const start = new Date(d);
    start.setHours(0, 0, 0, 0);
    const end = new Date(d);
    end.setHours(23, 59, 59, 999);
    return { start, end };
}

export async function getCustomers(query = {}) {
    const limit = Math.min(Math.max(parseInt(query.limit, 10) || 50, 1), 1000);
    const page = Math.max(parseInt(query.page, 10) || 1, 1);
    const skip = (page - 1) * limit;

    const filter = buildCustomerListFilter(query);

    if (query.orderDate && String(query.orderDate).trim()) {
        const bounds = parseDayBounds(String(query.orderDate).trim());
        if (bounds) {
            const orderUserIds = await FoodOrder.distinct('userId', {
                userId: { $exists: true, $ne: null },
                orderType: { $in: FOOD_CUSTOMER_ORDER_TYPES },
                createdAt: { $gte: bounds.start, $lte: bounds.end }
            });
            const validIds = orderUserIds.filter((id) => mongoose.Types.ObjectId.isValid(id));
            filter._id = { $in: validIds };
        }
    }

    const sortBy = String(query.sortBy || '').trim();
    const needsOrderSort = sortBy === 'orders-asc' || sortBy === 'orders-desc';

    let customers = [];
    let total = 0;

    if (needsOrderSort) {
        const orderSortDir = sortBy === 'orders-asc' ? 1 : -1;

        // Aggregate orders first (one scan/group), then rank filtered users, paginate, then lookup page customers.
        const orderMatch = {
            userId: { $exists: true, $ne: null },
            orderType: { $in: FOOD_CUSTOMER_ORDER_TYPES }
        };
        if (filter._id?.$in) {
            orderMatch.userId = { $in: filter._id.$in };
        }

        const [orderStats, matchingUsers] = await Promise.all([
            FoodOrder.aggregate([
                { $match: orderMatch },
                {
                    $group: {
                        _id: '$userId',
                        totalOrder: { $sum: 1 },
                        totalOrderAmount: { $sum: { $ifNull: ['$pricing.total', 0] } }
                    }
                }
            ]),
            FoodUser.find(filter).select('_id createdAt').lean()
        ]);

        const orderStatsMap = new Map(
            orderStats.map((x) => [
                String(x._id),
                {
                    totalOrder: Number(x.totalOrder || 0),
                    totalOrderAmount: Number(x.totalOrderAmount || 0)
                }
            ])
        );

        const ranked = matchingUsers
            .map((u) => {
                const stats = orderStatsMap.get(String(u._id)) || { totalOrder: 0, totalOrderAmount: 0 };
                return {
                    _id: u._id,
                    createdAt: u.createdAt,
                    totalOrder: stats.totalOrder,
                    totalOrderAmount: stats.totalOrderAmount
                };
            })
            .sort((a, b) => {
                if (a.totalOrder !== b.totalOrder) {
                    return orderSortDir === 1
                        ? a.totalOrder - b.totalOrder
                        : b.totalOrder - a.totalOrder;
                }
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            });

        total = ranked.length;
        const pageRows = ranked.slice(skip, skip + limit);
        const pageIds = pageRows.map((r) => r._id);

        const docs = pageIds.length
            ? await FoodUser.find({ _id: { $in: pageIds } })
                .select('name email phone countryCode isVerified isActive isCodAllowed createdAt profileImage')
                .lean()
            : [];

        const docMap = new Map(docs.map((d) => [String(d._id), d]));
        customers = pageRows
            .map((row) => {
                const u = docMap.get(String(row._id));
                if (!u) return null;
                return mapCustomerListItem(u, {
                    totalOrder: row.totalOrder,
                    totalOrderAmount: row.totalOrderAmount
                });
            })
            .filter(Boolean);
    } else {
        const sort = {};
        if (sortBy === 'name-asc') sort.name = 1;
        else if (sortBy === 'name-desc') sort.name = -1;
        else sort.createdAt = -1;

        const [docs, count] = await Promise.all([
            FoodUser.find(filter)
                .sort(sort)
                .skip(skip)
                .limit(limit)
                .select('name email phone countryCode isVerified isActive isCodAllowed createdAt profileImage')
                .lean(),
            FoodUser.countDocuments(filter)
        ]);
        total = count;

        const userIds = docs.map((u) => u._id).filter(Boolean);
        const orderStats = userIds.length > 0
            ? await FoodOrder.aggregate([
                {
                    $match: {
                        userId: { $in: userIds },
                        orderType: { $in: FOOD_CUSTOMER_ORDER_TYPES }
                    }
                },
                {
                    $group: {
                        _id: '$userId',
                        totalOrder: { $sum: 1 },
                        totalOrderAmount: { $sum: { $ifNull: ['$pricing.total', 0] } }
                    }
                }
            ])
            : [];

        const orderStatsMap = new Map(
            orderStats.map((x) => [
                String(x._id),
                {
                    totalOrder: Number(x.totalOrder || 0),
                    totalOrderAmount: Number(x.totalOrderAmount || 0)
                }
            ])
        );

        customers = docs.map((u) =>
            mapCustomerListItem(u, orderStatsMap.get(String(u._id)) || { totalOrder: 0, totalOrderAmount: 0 })
        );
    }

    const chooseFirst = parseInt(query.chooseFirst, 10);
    if (Number.isFinite(chooseFirst) && chooseFirst > 0) {
        customers = customers.slice(0, chooseFirst);
    }

    return { customers, total, page, limit };
}

export async function getCustomerById(id) {
    if (!id || !mongoose.Types.ObjectId.isValid(id)) return null;

    const customerObjectId = new mongoose.Types.ObjectId(id);
    const u = await FoodUser.findById(id).select('-__v').lean();
    if (!u) return null;

    const [orderStats, recentOrders] = await Promise.all([
        FoodOrder.aggregate([
            {
                $match: {
                    userId: customerObjectId,
                    orderType: { $in: FOOD_CUSTOMER_ORDER_TYPES },
                }
            },
            {
                $group: {
                    _id: '$userId',
                    totalOrders: { $sum: 1 },
                    totalOrderAmount: { $sum: { $ifNull: ['$pricing.total', 0] } }
                }
            }
        ]),
        FoodOrder.find({
            userId: customerObjectId,
            orderType: { $in: FOOD_CUSTOMER_ORDER_TYPES }
        })
            .sort({ createdAt: -1 })
            .limit(10)
            .select('orderId orderStatus pricing.total createdAt payment.method')
            .lean()
    ]);

    const stats = orderStats?.[0] || {};
    return {
        id: u._id,
        _id: u._id,
        name: u.name || 'Unnamed',
        email: u.email || '',
        phone: u.phone || '',
        profileImage: sanitizeProfileImageUrl(u.profileImage || ''),
        countryCode: u.countryCode || '+91',
        status: u.isActive !== false,
        isActive: u.isActive !== false,
        isCodAllowed: u.isCodAllowed !== false,
        isVerified: u.isVerified === true,
        phoneVerified: u.isVerified === true,
        gender: u.gender || '',
        dateOfBirth: u.dateOfBirth || null,
        addresses: Array.isArray(u.addresses) ? u.addresses : [],
        totalOrders: Number(stats.totalOrders || 0),
        totalOrder: Number(stats.totalOrders || 0),
        totalOrderAmount: Number(stats.totalOrderAmount || 0),
        joiningDate: u.createdAt,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
        recentOrders: (recentOrders || []).map((o) => ({
            orderId: o.orderId,
            orderStatus: o.orderStatus,
            pricing: { total: o.pricing?.total ?? 0 },
            createdAt: o.createdAt,
            payment: { method: o.payment?.method || null }
        }))
    };
}

export async function updateCustomerStatus(id, isActive) {
    if (!id || !mongoose.Types.ObjectId.isValid(id)) return null;

    const updateFields = { isActive: Boolean(isActive) };

    if (Boolean(isActive)) {
        updateFields.isDeleted = false;
        updateFields.isBlocked = false;
        updateFields.accountStatus = 'active';
    }

    const updatedDoc = await FoodUser.findOneAndUpdate(
        { _id: id, role: 'USER' },
        { $set: updateFields },
        { new: true }
    );
    if (!updatedDoc) return null;
    const updated = updatedDoc.toObject();
    if (updated.isActive === false) {
        await FoodRefreshToken.deleteMany({ userId: updated._id });
    }
    // Same sanitized list shape as getCustomers / COD toggle (no fcmTokens / raw dump).
    return mapCustomerListItem(updated);
}

export async function updateCustomerCodAccess(id, isCodAllowed) {
    if (!id || !mongoose.Types.ObjectId.isValid(id)) return null;

    const updatedDoc = await FoodUser.findOneAndUpdate(
        { _id: id, role: 'USER' },
        { $set: { isCodAllowed: Boolean(isCodAllowed) } },
        { new: true }
    );
    if (!updatedDoc) return null;
    // Return the same sanitized list shape used by getCustomers (no fcmTokens / raw dump).
    return mapCustomerListItem(updatedDoc.toObject());
}

export async function bulkUpdateCustomersCodAccess(ids = [], isCodAllowed) {
    const normalizedIds = Array.from(
        new Set(
            (Array.isArray(ids) ? ids : [])
                .map((id) => String(id || '').trim())
                .filter((id) => mongoose.Types.ObjectId.isValid(id))
        )
    );

    if (!normalizedIds.length) {
        return { matched: 0, modified: 0 };
    }

    const objectIds = normalizedIds.map((id) => new mongoose.Types.ObjectId(id));

    const result = await FoodUser.updateMany(
        { _id: { $in: objectIds }, role: 'USER' },
        { $set: { isCodAllowed: Boolean(isCodAllowed) } }
    );

    return {
        matched: Number(result.matchedCount || 0),
        modified: Number(result.modifiedCount || 0),
    };
}

const mapUserTicket = (t) => {
    if (!t) return null;
    const user =
        t.userId && typeof t.userId === 'object' && t.userId !== null
            ? {
                _id: t.userId._id,
                name: t.userId.name || '',
                phone: t.userId.phone || '',
                email: t.userId.email || ''
            }
            : null;
    const userId =
        t.userId && typeof t.userId === 'object' && t.userId !== null ? String(t.userId._id) : String(t.userId);

    let restaurantDoc = null;
    if (t.restaurantId && typeof t.restaurantId === 'object' && t.restaurantId !== null) {
        restaurantDoc = t.restaurantId;
    } else if (t.orderId && typeof t.orderId === 'object' && t.orderId !== null) {
        const rid = t.orderId.restaurantId;
        if (rid && typeof rid === 'object' && rid !== null) {
            restaurantDoc = rid;
        }
    }

    const restaurant =
        restaurantDoc && typeof restaurantDoc === 'object'
            ? {
                _id: restaurantDoc._id,
                name: restaurantDoc.restaurantName || '',
                city: restaurantDoc.city || '',
                area: restaurantDoc.area || ''
            }
            : null;

    const restaurantId =
        restaurant && restaurant._id
            ? String(restaurant._id)
            : t.restaurantId
                ? String(t.restaurantId)
                : t.orderId && typeof t.orderId === 'object' && t.orderId !== null && t.orderId.restaurantId
                    ? String(t.orderId.restaurantId)
                    : null;

    const restaurantName = restaurant ? restaurant.name : '';

    return {
        _id: t._id,
        source: 'user',
        userId,
        type: t.type,
        orderId: t.orderId || null,
        restaurantId,
        issueType: t.issueType,
        description: t.description,
        status: t.status,
        adminResponse: t.adminResponse,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        user,
        restaurant,
        restaurantName
    };
};

const mapRestaurantTicket = (t) => {
    if (!t) return null;
    const restaurant =
        t.restaurantId && typeof t.restaurantId === 'object'
            ? {
                _id: t.restaurantId._id,
                name: t.restaurantId.restaurantName || '',
                city: t.restaurantId.city || '',
                area: t.restaurantId.area || ''
            }
            : null;
    const restaurantId =
        restaurant && restaurant._id ? String(restaurant._id) : t.restaurantId ? String(t.restaurantId) : null;
    return {
        _id: t._id,
        source: 'restaurant',
        userId: null,
        type: 'restaurant-support',
        category: t.category || 'other',
        orderId: null,
        orderRef: t.orderRef || '',
        restaurantId,
        issueType: t.issueType,
        subject: t.subject || '',
        description: t.description,
        priority: t.priority || 'medium',
        status: t.status,
        adminResponse: t.adminResponse,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        user: null,
        restaurant,
        restaurantName: restaurant ? restaurant.name : ''
    };
};

const populateUserTicketQuery = (q) =>
    q
        .populate('userId', 'name phone email')
        .populate('restaurantId', 'restaurantName city area')
        .populate({
            path: 'orderId',
            select: 'restaurantId',
            populate: { path: 'restaurantId', select: 'restaurantName city area' }
        });

export async function getSupportTickets(query = {}) {
    const limit = Math.min(Math.max(parseInt(query.limit, 10) || 50, 1), 1000);
    const page = Math.max(parseInt(query.page, 10) || 1, 1);
    const skip = (page - 1) * limit;
    const source = String(query.source || 'all').toLowerCase();
    const search = String(query.search || '').trim();

    const userFilter = {};
    const restaurantFilter = {};
    if (query.status && ['open', 'in-progress', 'resolved'].includes(String(query.status))) {
        userFilter.status = String(query.status);
        restaurantFilter.status = String(query.status);
    }
    if (query.type && ['order', 'restaurant', 'other'].includes(String(query.type))) {
        userFilter.type = String(query.type);
    }
    if (query.category && ['orders', 'payments', 'menu', 'restaurant', 'technical', 'other'].includes(String(query.category))) {
        restaurantFilter.category = String(query.category);
    }

    if (query.fromDate) {
        const from = new Date(query.fromDate);
        if (!Number.isNaN(from.getTime())) {
            userFilter.createdAt = { ...(userFilter.createdAt || {}), $gte: from };
            restaurantFilter.createdAt = { ...(restaurantFilter.createdAt || {}), $gte: from };
        }
    }
    if (query.toDate) {
        const to = new Date(query.toDate);
        if (!Number.isNaN(to.getTime())) {
            to.setHours(23, 59, 59, 999);
            userFilter.createdAt = { ...(userFilter.createdAt || {}), $lte: to };
            restaurantFilter.createdAt = { ...(restaurantFilter.createdAt || {}), $lte: to };
        }
    }

    const userSearchOr = [];
    const restaurantSearchOr = [];
    if (search) {
        const searchRegex = new RegExp(escapeRegex(search), 'i');
        userSearchOr.push(
            { issueType: searchRegex },
            { description: searchRegex }
        );
        restaurantSearchOr.push(
            { issueType: searchRegex },
            { subject: searchRegex },
            { description: searchRegex },
            { orderRef: searchRegex }
        );
        const [restaurantIds, userIds, orderIds] = await Promise.all([
            FoodRestaurant.find({ restaurantName: searchRegex }).select('_id').lean(),
            FoodUser.find({ name: searchRegex }).select('_id').lean(),
            FoodOrder.find({ orderId: searchRegex, orderType: 'food' }).select('_id').lean()
        ]);
        if (restaurantIds.length) {
            const ids = restaurantIds.map((r) => r._id);
            userSearchOr.push({ restaurantId: { $in: ids } });
            restaurantSearchOr.push({ restaurantId: { $in: ids } });
        }
        if (userIds.length) {
            userSearchOr.push({ userId: { $in: userIds.map((u) => u._id) } });
        }
        if (orderIds.length) {
            userSearchOr.push({ orderId: { $in: orderIds.map((o) => o._id) } });
        }
    }
    if (userSearchOr.length) userFilter.$or = userSearchOr;
    if (restaurantSearchOr.length) restaurantFilter.$or = restaurantSearchOr;

    const shouldFetchUser = source === 'all' || source === 'user';
    const shouldFetchRestaurant = source === 'all' || source === 'restaurant';

    // Status breakdown must honor the same filters as the list (including status).
    const countForStatus = (Model, baseFilter, status) => {
        if (baseFilter.status && baseFilter.status !== status) return Promise.resolve(0);
        return Model.countDocuments({ ...baseFilter, status });
    };

    const countPromises = [];
    if (shouldFetchUser) {
        countPromises.push(
            FoodSupportTicket.countDocuments(userFilter),
            countForStatus(FoodSupportTicket, userFilter, 'open'),
            countForStatus(FoodSupportTicket, userFilter, 'in-progress'),
            countForStatus(FoodSupportTicket, userFilter, 'resolved')
        );
    } else {
        countPromises.push(Promise.resolve(0), Promise.resolve(0), Promise.resolve(0), Promise.resolve(0));
    }
    if (shouldFetchRestaurant) {
        countPromises.push(
            FoodRestaurantSupportTicket.countDocuments(restaurantFilter),
            countForStatus(FoodRestaurantSupportTicket, restaurantFilter, 'open'),
            countForStatus(FoodRestaurantSupportTicket, restaurantFilter, 'in-progress'),
            countForStatus(FoodRestaurantSupportTicket, restaurantFilter, 'resolved')
        );
    } else {
        countPromises.push(Promise.resolve(0), Promise.resolve(0), Promise.resolve(0), Promise.resolve(0));
    }

    const [
        userTotalFiltered,
        userOpen,
        userInProgress,
        userResolved,
        restaurantTotalFiltered,
        restaurantOpen,
        restaurantInProgress,
        restaurantResolved
    ] = await Promise.all(countPromises);

    const counts = {
        total: Number(userTotalFiltered || 0) + Number(restaurantTotalFiltered || 0),
        open: Number(userOpen || 0) + Number(restaurantOpen || 0),
        inProgress: Number(userInProgress || 0) + Number(restaurantInProgress || 0),
        resolved: Number(userResolved || 0) + Number(restaurantResolved || 0)
    };

    let tickets = [];
    let total = 0;

    if (source === 'user') {
        const [userList] = await Promise.all([
            populateUserTicketQuery(
                FoodSupportTicket.find(userFilter).sort({ createdAt: -1 }).skip(skip).limit(limit)
            ).lean()
        ]);
        tickets = userList.map(mapUserTicket).filter(Boolean);
        total = userTotalFiltered;
    } else if (source === 'restaurant') {
        const restaurantList = await FoodRestaurantSupportTicket.find(restaurantFilter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('restaurantId', 'restaurantName city area')
            .lean();
        tickets = restaurantList.map(mapRestaurantTicket).filter(Boolean);
        total = restaurantTotalFiltered;
    } else {
        const [aggResult] = await FoodSupportTicket.aggregate([
            { $match: userFilter },
            { $project: { _id: 1, createdAt: 1, source: { $literal: 'user' } } },
            {
                $unionWith: {
                    coll: 'food_restaurant_support_tickets',
                    pipeline: [
                        { $match: restaurantFilter },
                        { $project: { _id: 1, createdAt: 1, source: { $literal: 'restaurant' } } }
                    ]
                }
            },
            { $sort: { createdAt: -1 } },
            {
                $facet: {
                    metadata: [{ $count: 'total' }],
                    data: [{ $skip: skip }, { $limit: limit }]
                }
            }
        ]);

        total = Number(aggResult?.metadata?.[0]?.total || 0);
        const pageRows = aggResult?.data || [];
        const userIds = pageRows.filter((r) => r.source === 'user').map((r) => r._id);
        const restaurantIds = pageRows.filter((r) => r.source === 'restaurant').map((r) => r._id);

        const [userDocs, restaurantDocs] = await Promise.all([
            userIds.length
                ? populateUserTicketQuery(FoodSupportTicket.find({ _id: { $in: userIds } })).lean()
                : Promise.resolve([]),
            restaurantIds.length
                ? FoodRestaurantSupportTicket.find({ _id: { $in: restaurantIds } })
                    .populate('restaurantId', 'restaurantName city area')
                    .lean()
                : Promise.resolve([])
        ]);

        const userMap = new Map(userDocs.map((d) => [String(d._id), d]));
        const restaurantMap = new Map(restaurantDocs.map((d) => [String(d._id), d]));

        tickets = pageRows
            .map((row) => {
                if (row.source === 'user') return mapUserTicket(userMap.get(String(row._id)));
                return mapRestaurantTicket(restaurantMap.get(String(row._id)));
            })
            .filter(Boolean);
    }

    return { tickets, total, page, limit, counts };
}

export async function updateSupportTicket(id, body = {}) {
    if (!id || !mongoose.Types.ObjectId.isValid(id)) return null;
    const preferredSource = String(body.source || 'user').toLowerCase() === 'restaurant' ? 'restaurant' : 'user';
    const set = {};

    if (body.status && ['open', 'in-progress', 'resolved'].includes(String(body.status))) {
        set.status = String(body.status);
    }

    if (typeof body.adminResponse === 'string') {
        const trimmed = body.adminResponse.trim();
        if (!trimmed) {
            if (!set.status) return { error: 'empty_response' };
        } else {
            if (trimmed.length > 5000) {
                throw new ValidationError('adminResponse must be at most 5000 characters');
            }
            set.adminResponse = trimmed;
        }
    }

    if (!Object.keys(set).length) return { error: 'empty_patch' };

    const historyEntry = {
        status: set.status,
        adminResponse: set.adminResponse,
        adminId: body.adminId && mongoose.Types.ObjectId.isValid(body.adminId) ? body.adminId : null,
        adminName: typeof body.adminName === 'string' ? body.adminName.slice(0, 120) : '',
        at: new Date()
    };

    if (set.adminResponse !== undefined) {
        set.respondedAt = historyEntry.at;
    }

    const updateOps = {
        $set: set,
        $push: { responseHistory: historyEntry }
    };

    const preferredModel = preferredSource === 'restaurant' ? FoodRestaurantSupportTicket : FoodSupportTicket;
    const fallbackModel = preferredSource === 'restaurant' ? FoodSupportTicket : FoodRestaurantSupportTicket;
    const fallbackSource = preferredSource === 'restaurant' ? 'user' : 'restaurant';

    let ticket = await preferredModel.findByIdAndUpdate(id, updateOps, { new: true }).lean();
    let resolvedSource = preferredSource;

    if (!ticket) {
        ticket = await fallbackModel.findByIdAndUpdate(id, updateOps, { new: true }).lean();
        resolvedSource = fallbackSource;
    }

    if (!ticket) return null;

    if (set.adminResponse !== undefined || set.status !== undefined) {
        try {
            if (resolvedSource === 'user' && ticket.userId) {
                const statusLabel = set.status || ticket.status || 'updated';
                const bodyText = set.adminResponse
                    ? String(set.adminResponse).slice(0, 200)
                    : `Your support ticket status is now ${statusLabel}.`;
                await sendNotificationToOwner({
                    ownerType: 'USER',
                    ownerId: ticket.userId,
                    payload: {
                        title: 'Support ticket update',
                        body: bodyText,
                        data: {
                            type: 'support_ticket',
                            ticketId: String(ticket._id),
                            status: String(statusLabel)
                        }
                    }
                });
            }
        } catch (err) {
            console.warn('Support ticket notification failed:', err?.message || err);
        }
    }

    // Return the same mapped shape as the listing API
    let mappedTicket = null;
    if (resolvedSource === 'user') {
        const populated = await populateUserTicketQuery(FoodSupportTicket.findById(ticket._id)).lean();
        mappedTicket = mapUserTicket(populated);
    } else {
        const populated = await FoodRestaurantSupportTicket.findById(ticket._id)
            .populate('restaurantId', 'restaurantName city area')
            .lean();
        mappedTicket = mapRestaurantTicket(populated);
    }

    return { ticket: mappedTicket, source: resolvedSource };
}

// ----- Delivery Boy Commission Rule (admin) -----
export async function getDeliveryCommissionRules() {
    const list = await FoodDeliveryCommissionRule.find({}).sort({ createdAt: -1 }).lean();
    const commissions = list.map((r, index) => ({
        _id: r._id,
        sl: index + 1,
        name: r.name || '',
        minDistance: r.minDistance,
        maxDistance: r.maxDistance ?? null,
        commissionPerKm: r.commissionPerKm,
        basePayout: r.basePayout,
        status: r.status !== false
    }));
    return { commissions };
}

function validateCommissionRuleSet(rules) {
    const active = (rules || []).filter((r) => r && r.status !== false);
    if (!active.length) {
        throw new ValidationError('A base slab with minDistance = 0 is required');
    }
    const baseRules = active.filter((r) => Number(r.minDistance || 0) === 0);
    if (baseRules.length !== 1) {
        throw new ValidationError('A base slab with minDistance = 0 is required');
    }
    const sorted = [...active].sort((a, b) => Number(a.minDistance || 0) - Number(b.minDistance || 0));
    for (let i = 0; i < sorted.length; i += 1) {
        const current = sorted[i];
        const min = Number(current.minDistance || 0);
        const max = current.maxDistance == null ? null : Number(current.maxDistance);
        if (max != null && max <= min) {
            throw new ValidationError('maxDistance must be greater than minDistance');
        }
        if (i > 0) {
            const prev = sorted[i - 1];
            const prevMin = Number(prev.minDistance || 0);
            const prevMax = prev.maxDistance == null ? null : Number(prev.maxDistance);
            const effectivePrevMax = prevMax == null ? Infinity : prevMax;
            if (min < effectivePrevMax) {
                throw new ValidationError('Distance slabs must not overlap');
            }
            if (min === prevMin) {
                throw new ValidationError('Distance slabs must not share the same minDistance');
            }
        }
    }
}

export async function createDeliveryCommissionRule(body) {
    const existing = await FoodDeliveryCommissionRule.find({}).lean();
    const candidate = [
        ...existing,
        {
            minDistance: body.minDistance,
            maxDistance: body.maxDistance ?? null,
            commissionPerKm: body.commissionPerKm,
            basePayout: body.basePayout,
            status: body.status ?? true
        }
    ];
    validateCommissionRuleSet(candidate);
    const created = await FoodDeliveryCommissionRule.create({
        name: body.name || '',
        minDistance: body.minDistance,
        maxDistance: body.maxDistance ?? null,
        commissionPerKm: body.commissionPerKm,
        basePayout: body.basePayout,
        status: body.status ?? true
    });
    return created.toObject();
}

export async function updateDeliveryCommissionRule(id, body) {
    if (!id || !mongoose.Types.ObjectId.isValid(id)) return null;
    const existing = await FoodDeliveryCommissionRule.find({}).lean();
    const candidate = existing.map((r) =>
        String(r._id) === String(id)
            ? {
                ...r,
                minDistance: body.minDistance,
                maxDistance: body.maxDistance ?? null,
                commissionPerKm: body.commissionPerKm,
                basePayout: body.basePayout,
                status: r.status !== false
            }
            : r
    );
    validateCommissionRuleSet(candidate);
    const updated = await FoodDeliveryCommissionRule.findByIdAndUpdate(
        id,
        {
            $set: {
                name: body.name || '',
                minDistance: body.minDistance,
                maxDistance: body.maxDistance ?? null,
                commissionPerKm: body.commissionPerKm,
                basePayout: body.basePayout
            }
        },
        { new: true }
    ).lean();
    return updated;
}

export async function deleteDeliveryCommissionRule(id) {
    if (!id || !mongoose.Types.ObjectId.isValid(id)) return null;
    const deleted = await FoodDeliveryCommissionRule.findByIdAndDelete(id).lean();
    return deleted ? { id } : null;
}

export async function toggleDeliveryCommissionRuleStatus(id, status) {
    if (!id || !mongoose.Types.ObjectId.isValid(id)) return null;
    const updated = await FoodDeliveryCommissionRule.findByIdAndUpdate(
        id,
        { $set: { status: Boolean(status) } },
        { new: true }
    ).lean();
    return updated;
}

// ----- Fee Settings (admin) -----
export async function getFeeSettings() {
    const doc = await FoodFeeSettings.findOne({ isActive: { $ne: false } }).sort({ createdAt: -1 }).lean();
    return { feeSettings: doc || null };
}

export async function upsertFeeSettings(body) {
    const existing = await FoodFeeSettings.findOne({ isActive: { $ne: false } }).sort({ createdAt: -1 });
    if (existing) {
        const $set = {};
        const $unset = {};

        if (body.deliveryFee === null) {
            $unset.deliveryFee = 1;
            $unset.baseDeliveryFee = 1;
        } else if (body.deliveryFee !== undefined) {
            $set.deliveryFee = body.deliveryFee;
            $set.baseDeliveryFee = body.deliveryFee;
        }

        if (body.baseDistanceKm === null) $unset.baseDistanceKm = 1;
        else if (body.baseDistanceKm !== undefined) $set.baseDistanceKm = body.baseDistanceKm;

        if (body.baseDeliveryFee === null) {
            $unset.baseDeliveryFee = 1;
            $unset.deliveryFee = 1;
        } else if (body.baseDeliveryFee !== undefined) {
            $set.baseDeliveryFee = body.baseDeliveryFee;
            $set.deliveryFee = body.baseDeliveryFee;
        }

        if (body.perKmCharge === null) $unset.perKmCharge = 1;
        else if (body.perKmCharge !== undefined) $set.perKmCharge = body.perKmCharge;

        if (body.deliveryFeeRanges !== undefined) $set.deliveryFeeRanges = body.deliveryFeeRanges;

        if (body.sponsorRules !== undefined) $set.sponsorRules = body.sponsorRules;
        if (body.deliveryDistanceSlabs !== undefined) $set.deliveryDistanceSlabs = body.deliveryDistanceSlabs;

        if (body.platformFee === null) $unset.platformFee = 1;
        else if (body.platformFee !== undefined) $set.platformFee = body.platformFee;

        if (body.gstRate === null) $unset.gstRate = 1;
        else if (body.gstRate !== undefined) $set.gstRate = body.gstRate;
        if (body.mixedOrderDistanceLimit !== undefined) $set.mixedOrderDistanceLimit = body.mixedOrderDistanceLimit;
        if (body.mixedOrderAngleLimit !== undefined) $set.mixedOrderAngleLimit = body.mixedOrderAngleLimit;

        if (body.isActive !== undefined) $set.isActive = body.isActive;

        const update = {};
        if (Object.keys($set).length) update.$set = $set;
        if (Object.keys($unset).length) update.$unset = $unset;
        if (!Object.keys(update).length) return existing.toObject();

        const updated = await FoodFeeSettings.findByIdAndUpdate(existing._id, update, { new: true }).lean();
        return updated;
    }

    const payload = {
        deliveryFeeRanges: body.deliveryFeeRanges ?? [],
        isActive: body.isActive !== false
    };
    if (body.deliveryFee !== undefined && body.deliveryFee !== null) {
        payload.deliveryFee = body.deliveryFee;
        payload.baseDeliveryFee = body.deliveryFee;
    }
    if (body.baseDistanceKm !== undefined && body.baseDistanceKm !== null) payload.baseDistanceKm = body.baseDistanceKm;
    if (body.baseDeliveryFee !== undefined && body.baseDeliveryFee !== null) {
        payload.baseDeliveryFee = body.baseDeliveryFee;
        payload.deliveryFee = body.baseDeliveryFee;
    }
    if (body.perKmCharge !== undefined && body.perKmCharge !== null) payload.perKmCharge = body.perKmCharge;
    if (body.sponsorRules !== undefined) payload.sponsorRules = body.sponsorRules ?? [];
    if (body.deliveryDistanceSlabs !== undefined) payload.deliveryDistanceSlabs = body.deliveryDistanceSlabs ?? [];
    if (body.platformFee !== undefined && body.platformFee !== null) payload.platformFee = body.platformFee;
    if (body.gstRate !== undefined && body.gstRate !== null) payload.gstRate = body.gstRate;
    if (body.mixedOrderDistanceLimit !== undefined) payload.mixedOrderDistanceLimit = body.mixedOrderDistanceLimit;
    if (body.mixedOrderAngleLimit !== undefined) payload.mixedOrderAngleLimit = body.mixedOrderAngleLimit;

    const created = await FoodFeeSettings.create(payload);
    return created.toObject();
}

// ----- Referral Settings (admin) -----
export async function getReferralSettings({ includeInactive = false } = {}) {
    const filter = includeInactive ? {} : { isActive: true };
    const doc = await FoodReferralSettings.findOne(filter).sort({ createdAt: -1 }).lean();
    return { referralSettings: doc || null };
}

const normalizeReferralSection = (incoming, fallback = {}) => {
    const pick = (key) => {
        if (incoming && Object.prototype.hasOwnProperty.call(incoming, key) && incoming[key] !== undefined) {
            return Math.max(0, Number(incoming[key]) || 0);
        }
        return Math.max(0, Number(fallback[key]) || 0);
    };
    return {
        referrerReward: pick('referrerReward'),
        refereeReward: pick('refereeReward'),
        limit: pick('limit')
    };
};

export async function upsertReferralSettings(body = {}) {
    // Always target the latest settings doc (including inactive) so deactivate
    // does not orphan the config and force a new document on the next save.
    const existing = await FoodReferralSettings.findOne({}).sort({ createdAt: -1 });
    const existingObj = existing?.toObject?.() || existing || {};
    const wasActive = existingObj.isActive !== false;

    // Merge only provided sections/fields so a partial PUT cannot zero other roles.
    const formattedData = {
        user: normalizeReferralSection(body.user, existingObj.user),
        delivery: normalizeReferralSection(body.delivery, existingObj.delivery),
        restaurant: normalizeReferralSection(body.restaurant, existingObj.restaurant),
        isActive: body.isActive !== undefined ? Boolean(body.isActive) : (existingObj.isActive !== false)
    };

    let saved;
    if (existing) {
        saved = await FoodReferralSettings.findByIdAndUpdate(
            existing._id,
            { $set: formattedData },
            { new: true }
        ).lean();
    } else {
        saved = (await FoodReferralSettings.create(formattedData)).toObject();
    }

    // Deactivating the program must cancel open restaurant payouts, not only block new invites.
    if (wasActive && formattedData.isActive === false) {
        await FoodReferralLog.updateMany(
            { role: 'RESTAURANT', status: 'pending' },
            { $set: { status: 'rejected', reason: 'program_inactive' } }
        );
    }

    return saved;
}

// ----- Safety / Emergency Reports (admin) -----
export async function getSafetyEmergencyReports(query = {}) {
    const limit = Math.min(Math.max(parseInt(query.limit, 10) || 10, 1), 100);
    const page = Math.max(parseInt(query.page, 10) || 1, 1);
    const skip = (page - 1) * limit;

    const filter = {};
    if (query.status && ['unread', 'read', 'urgent', 'resolved'].includes(String(query.status))) {
        filter.status = String(query.status);
    }
    if (query.priority && ['low', 'medium', 'high', 'critical'].includes(String(query.priority))) {
        filter.priority = String(query.priority);
    }
    if (query.search && String(query.search).trim()) {
        const raw = String(query.search).trim().slice(0, 120);
        const term = raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        filter.$or = [
            { userName: { $regex: term, $options: 'i' } },
            { userEmail: { $regex: term, $options: 'i' } },
            { message: { $regex: term, $options: 'i' } }
        ];
    }

    const [list, total] = await Promise.all([
        FoodSafetyEmergencyReport.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        FoodSafetyEmergencyReport.countDocuments(filter)
    ]);

    return {
        safetyEmergencies: list || [],
        pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 }
    };
}

export async function updateSafetyEmergencyStatus(id, status) {
    if (!id || !mongoose.Types.ObjectId.isValid(id)) throw new ValidationError('Invalid report id');
    const next = String(status);
    if (!['unread', 'read', 'urgent', 'resolved'].includes(next)) throw new ValidationError('Invalid status');
    const updated = await FoodSafetyEmergencyReport.findByIdAndUpdate(
        id,
        { $set: { status: next } },
        { new: true }
    ).lean();
    return updated;
}

export async function updateSafetyEmergencyPriority(id, priority) {
    if (!id || !mongoose.Types.ObjectId.isValid(id)) throw new ValidationError('Invalid report id');
    const next = String(priority);
    if (!['low', 'medium', 'high', 'critical'].includes(next)) throw new ValidationError('Invalid priority');
    const updated = await FoodSafetyEmergencyReport.findByIdAndUpdate(
        id,
        { $set: { priority: next } },
        { new: true }
    ).lean();
    return updated;
}

export async function deleteSafetyEmergencyReport(id) {
    if (!id || !mongoose.Types.ObjectId.isValid(id)) throw new ValidationError('Invalid report id');
    const deleted = await FoodSafetyEmergencyReport.findByIdAndDelete(id).lean();
    return deleted;
}

export async function getContactMessages(query = {}) {
    const limit = Math.min(Math.max(parseInt(query.limit, 10) || 10, 1), 100);
    const page = Math.max(parseInt(query.page, 10) || 1, 1);
    const skip = (page - 1) * limit;

    // Fix old records with 'User' instead of 'FoodUser' for population to work
    await FeedbackExperience.updateMany({ userModel: 'User' }, { $set: { userModel: 'FoodUser' } });

    const filter = {};
    if (query.rating && !isNaN(query.rating)) {
        filter.rating = parseInt(query.rating);
    }

    if (query.search && String(query.search).trim()) {
        const term = String(query.search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const searchRegex = new RegExp(term, 'i');

        const [users, restaurants, partners] = await Promise.all([
            FoodUser.find({
                $or: [{ name: searchRegex }, { email: searchRegex }, { phone: searchRegex }]
            }).select('_id').lean(),
            FoodRestaurant.find({
                $or: [{ restaurantName: searchRegex }, { ownerEmail: searchRegex }, { ownerPhone: searchRegex }]
            }).select('_id').lean(),
            FoodDeliveryPartner.find({
                $or: [{ name: searchRegex }, { email: searchRegex }, { phone: searchRegex }]
            }).select('_id').lean()
        ]);

        filter.$or = [
            { comment: searchRegex },
            { userId: { $in: [...users.map(u => u._id), ...restaurants.map(r => r._id), ...partners.map(p => p._id)] } }
        ];
    }

    const [list, total] = await Promise.all([
        FeedbackExperience.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('userId')
            .lean(),
        FeedbackExperience.countDocuments(filter)
    ]);

    const reviews = list.map((doc) => {
        const user = (doc.userId && typeof doc.userId === 'object') ? doc.userId : {};
        return {
            _id: doc._id,
            customer: {
                name: user.name || user.restaurantName || 'Unknown',
                email: user.email || user.ownerEmail || 'N/A',
                phone: user.phone || user.ownerPhone || 'N/A'
            },
            comment: doc.comment || '',
            rating: doc.rating || 0,
            submittedAt: doc.createdAt,
            module: doc.module
        };
    });

    return {
        reviews,
        pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit) || 1
        }
    };
}

// ----- Delivery Cash Limit (admin) -----
export async function getDeliveryCashLimitSettings() {
    const doc = await FoodDeliveryCashLimit.findOne({ isActive: true }).sort({ createdAt: -1 }).lean();
    const settings = doc || { deliveryCashLimit: 0, deliveryWithdrawalLimit: 100, isActive: true };
    return {
        deliveryCashLimit: Number(settings.deliveryCashLimit) || 0,
        deliveryWithdrawalLimit: Number(settings.deliveryWithdrawalLimit) || 100
    };
}

export async function upsertDeliveryCashLimitSettings(body = {}) {
    const existing = await FoodDeliveryCashLimit.findOne({ isActive: true }).sort({ createdAt: -1 });
    const nextCashLimit = body.deliveryCashLimit;
    const nextWithdrawalLimit = body.deliveryWithdrawalLimit;

    if (existing) {
        if (nextCashLimit !== undefined) existing.deliveryCashLimit = Math.max(0, Number(nextCashLimit) || 0);
        if (nextWithdrawalLimit !== undefined) existing.deliveryWithdrawalLimit = Math.max(0, Number(nextWithdrawalLimit) || 0);
        await existing.save();
        return {
            deliveryCashLimit: existing.deliveryCashLimit,
            deliveryWithdrawalLimit: existing.deliveryWithdrawalLimit
        };
    }

    const created = await FoodDeliveryCashLimit.create({
        deliveryCashLimit: nextCashLimit !== undefined ? Math.max(0, Number(nextCashLimit) || 0) : 0,
        deliveryWithdrawalLimit: nextWithdrawalLimit !== undefined ? Math.max(0, Number(nextWithdrawalLimit) || 0) : 100,
        isActive: true
    });

    return {
        deliveryCashLimit: created.deliveryCashLimit,
        deliveryWithdrawalLimit: created.deliveryWithdrawalLimit
    };
}

// ----- Delivery Emergency Help (admin) -----
export async function getDeliveryEmergencyHelp() {
    const doc = await FoodDeliveryEmergencyHelp.findOne({ isActive: true }).sort({ createdAt: -1 }).lean();
    const data = doc || {
        medicalEmergency: '',
        accidentHelpline: '',
        contactPolice: '',
        insurance: '',
        isActive: true
    };
    return {
        medicalEmergency: data.medicalEmergency || '',
        accidentHelpline: data.accidentHelpline || '',
        contactPolice: data.contactPolice || '',
        insurance: data.insurance || ''
    };
}

export async function upsertDeliveryEmergencyHelp(body = {}) {
    const existing = await FoodDeliveryEmergencyHelp.findOne({ isActive: true }).sort({ createdAt: -1 });
    if (existing) {
        if (body.medicalEmergency !== undefined) existing.medicalEmergency = String(body.medicalEmergency || '').trim();
        if (body.accidentHelpline !== undefined) existing.accidentHelpline = String(body.accidentHelpline || '').trim();
        if (body.contactPolice !== undefined) existing.contactPolice = String(body.contactPolice || '').trim();
        if (body.insurance !== undefined) existing.insurance = String(body.insurance || '').trim();
        await existing.save();
        return {
            medicalEmergency: existing.medicalEmergency || '',
            accidentHelpline: existing.accidentHelpline || '',
            contactPolice: existing.contactPolice || '',
            insurance: existing.insurance || ''
        };
    }
    const created = await FoodDeliveryEmergencyHelp.create({
        medicalEmergency: String(body.medicalEmergency || '').trim(),
        accidentHelpline: String(body.accidentHelpline || '').trim(),
        contactPolice: String(body.contactPolice || '').trim(),
        insurance: String(body.insurance || '').trim(),
        isActive: true
    });
    return {
        medicalEmergency: created.medicalEmergency || '',
        accidentHelpline: created.accidentHelpline || '',
        contactPolice: created.contactPolice || '',
        insurance: created.insurance || ''
    };
}

export async function getRestaurantReviews(query = {}) {
    const limit = Math.min(Math.max(parseInt(query.limit, 10) || 50, 1), 1000);
    const page = Math.max(parseInt(query.page, 10) || 1, 1);
    const skip = (page - 1) * limit;

    const filter = {
        'ratings.restaurant.rating': { $exists: true, $ne: null },
        orderType: 'food'
    };

    if (query.search && String(query.search).trim()) {
        const term = String(query.search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const searchRegex = new RegExp(term, 'i');

        const restaurants = await FoodRestaurant.find({
            $or: [{ restaurantName: searchRegex }]
        }).select('_id').lean();

        const customers = await FoodUser.find({
            $or: [{ name: searchRegex }, { email: searchRegex }]
        }).select('_id').lean();

        filter.$or = [
            { orderId: searchRegex },
            { 'ratings.restaurant.comment': searchRegex },
            { restaurantId: { $in: restaurants.map(r => r._id) } },
            { userId: { $in: customers.map(c => c._id) } }
        ];
    }

    const [docs, total] = await Promise.all([
        FoodOrder.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('userId', 'name email phone')
            .populate('restaurantId', 'restaurantName')
            .select('orderId userId restaurantId ratings.restaurant createdAt')
            .lean(),
        FoodOrder.countDocuments(filter)
    ]);

    const reviews = docs.map((doc, index) => ({
        sl: skip + index + 1,
        orderId: doc.orderId,
        restaurant: doc.restaurantId?.restaurantName || 'Unknown',
        restaurantId: doc.restaurantId?._id || 'N/A',
        customer: doc.userId?.name || 'Unknown',
        customerId: doc.userId?._id || 'N/A',
        review: doc.ratings?.restaurant?.comment || '',
        rating: doc.ratings?.restaurant?.rating || 0,
        submittedAt: doc.createdAt
    }));

    return { reviews, total, page, limit };
}

export async function getRestaurantById(id) {
    if (!id || !mongoose.Types.ObjectId.isValid(id)) return null;
    return FoodRestaurant.findById(id)
        .select('-__v')
        .populate('zoneId', 'name zoneName serviceLocation isActive')
        .lean();
}

export async function getRestaurantAnalytics(restaurantId) {
    if (!restaurantId || !mongoose.Types.ObjectId.isValid(restaurantId)) return null;
    const rId = new mongoose.Types.ObjectId(restaurantId);

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const monthStart = new Date(currentYear, currentMonth, 1);
    const nextMonthStart = new Date(currentYear, currentMonth + 1, 1);
    const yearStart = new Date(currentYear, 0, 1);
    const nextYearStart = new Date(currentYear + 1, 0, 1);

    const [restaurant, orderStats, txStats] = await Promise.all([
        FoodRestaurant.findById(rId).lean(),
        FoodOrder.aggregate([
            { $match: { restaurantId: rId, orderType: 'food' } },
            {
                $facet: {
                    counts: [
                        {
                            $group: {
                                _id: null,
                                totalOrders: { $sum: 1 },
                                completedOrders: {
                                    $sum: { $cond: [{ $eq: ['$orderStatus', 'delivered'] }, 1, 0] }
                                },
                                cancelledOrders: {
                                    $sum: {
                                        $cond: [
                                            {
                                                $in: [
                                                    '$orderStatus',
                                                    ['cancelled_by_user', 'cancelled_by_restaurant', 'cancelled_by_admin']
                                                ]
                                            },
                                            1,
                                            0
                                        ]
                                    }
                                },
                                monthlyOrders: {
                                    $sum: {
                                        $cond: [
                                            {
                                                $and: [
                                                    { $gte: ['$createdAt', monthStart] },
                                                    { $lt: ['$createdAt', nextMonthStart] }
                                                ]
                                            },
                                            1,
                                            0
                                        ]
                                    }
                                },
                                yearlyOrders: {
                                    $sum: {
                                        $cond: [
                                            {
                                                $and: [
                                                    { $gte: ['$createdAt', yearStart] },
                                                    { $lt: ['$createdAt', nextYearStart] }
                                                ]
                                            },
                                            1,
                                            0
                                        ]
                                    }
                                }
                            }
                        }
                    ],
                    customers: [
                        { $group: { _id: '$userId', orderCount: { $sum: 1 } } },
                        {
                            $group: {
                                _id: null,
                                totalCustomers: { $sum: 1 },
                                repeatCustomers: {
                                    $sum: { $cond: [{ $gt: ['$orderCount', 1] }, 1, 0] }
                                }
                            }
                        }
                    ]
                }
            }
        ]),
        FoodTransaction.aggregate([
            { $match: { restaurantId: rId } },
            {
                $lookup: {
                    from: 'food_orders',
                    localField: 'orderId',
                    foreignField: '_id',
                    as: 'order'
                }
            },
            { $unwind: { path: '$order', preserveNullAndEmptyArrays: true } },
            {
                $addFields: {
                    effectiveDate: { $ifNull: ['$createdAt', '$order.createdAt'] },
                    isCompleted: {
                        $cond: [
                            { $ne: [{ $ifNull: ['$order.orderStatus', null] }, null] },
                            { $eq: ['$order.orderStatus', 'delivered'] },
                            { $in: ['$status', ['captured', 'authorized', 'settled']] }
                        ]
                    }
                }
            },
            { $match: { isCompleted: true } },
            {
                $facet: {
                    lifetime: [
                        {
                            $group: {
                                _id: null,
                                completedTxCount: { $sum: 1 },
                                totalRevenue: {
                                    $sum: {
                                        $ifNull: [
                                            '$amounts.totalCustomerPaid',
                                            { $ifNull: ['$pricing.total', { $ifNull: ['$order.pricing.total', 0] }] }
                                        ]
                                    }
                                },
                                restaurantEarning: { $sum: { $ifNull: ['$amounts.restaurantShare', 0] } },
                                subtotal: {
                                    $sum: {
                                        $ifNull: ['$pricing.subtotal', { $ifNull: ['$order.pricing.subtotal', 0] }]
                                    }
                                },
                                tax: {
                                    $sum: {
                                        $ifNull: [
                                            '$pricing.tax',
                                            { $ifNull: ['$amounts.taxAmount', { $ifNull: ['$order.pricing.tax', 0] }] }
                                        ]
                                    }
                                },
                                packagingFee: {
                                    $sum: {
                                        $ifNull: ['$pricing.packagingFee', { $ifNull: ['$order.pricing.packagingFee', 0] }]
                                    }
                                },
                                deliveryFee: {
                                    $sum: {
                                        $ifNull: ['$pricing.deliveryFee', { $ifNull: ['$order.pricing.deliveryFee', 0] }]
                                    }
                                },
                                platformFee: {
                                    $sum: {
                                        $ifNull: ['$pricing.platformFee', { $ifNull: ['$order.pricing.platformFee', 0] }]
                                    }
                                },
                                discount: {
                                    $sum: {
                                        $ifNull: ['$pricing.discount', { $ifNull: ['$order.pricing.discount', 0] }]
                                    }
                                },
                                riderShare: { $sum: { $ifNull: ['$amounts.riderShare', 0] } },
                                platformNetProfit: { $sum: { $ifNull: ['$amounts.platformNetProfit', 0] } }
                            }
                        }
                    ],
                    monthly: [
                        {
                            $match: {
                                effectiveDate: { $gte: monthStart, $lt: nextMonthStart }
                            }
                        },
                        {
                            $group: {
                                _id: null,
                                monthlyProfit: { $sum: { $ifNull: ['$amounts.restaurantShare', 0] } }
                            }
                        }
                    ],
                    yearly: [
                        {
                            $match: {
                                effectiveDate: { $gte: yearStart, $lt: nextYearStart }
                            }
                        },
                        {
                            $group: {
                                _id: null,
                                yearlyProfit: { $sum: { $ifNull: ['$amounts.restaurantShare', 0] } }
                            }
                        }
                    ]
                }
            }
        ])
    ]);

    if (!restaurant) return null;

    const orderFacet = orderStats?.[0] || {};
    const orderCounts = orderFacet.counts?.[0] || {};
    const customerStats = orderFacet.customers?.[0] || {};

    const txFacet = txStats?.[0] || {};
    const lifetimeTx = txFacet.lifetime?.[0] || {};
    const monthlyTx = txFacet.monthly?.[0] || {};
    const yearlyTx = txFacet.yearly?.[0] || {};

    const totalOrdersCount = Number(orderCounts.totalOrders || 0);
    const completedOrders = Number(orderCounts.completedOrders || 0);
    const cancelledOrders = Number(orderCounts.cancelledOrders || 0);
    const monthlyOrders = Number(orderCounts.monthlyOrders || 0);
    const yearlyOrders = Number(orderCounts.yearlyOrders || 0);
    const totalCustomers = Number(customerStats.totalCustomers || 0);
    const repeatCustomers = Number(customerStats.repeatCustomers || 0);

    const completedTxCount = Number(lifetimeTx.completedTxCount || 0);
    const totalRevenue = Number(lifetimeTx.totalRevenue || 0);
    const restaurantEarning = Number(lifetimeTx.restaurantEarning || 0);
    const restaurantProfit = restaurantEarning;
    const monthlyProfit = Number(monthlyTx.monthlyProfit || 0);
    const yearlyProfit = Number(yearlyTx.yearlyProfit || 0);

    const joinDate = new Date(restaurant.createdAt || now);
    const monthsSinceJoin = Math.max(
        1,
        (currentYear - joinDate.getFullYear()) * 12 + (currentMonth - joinDate.getMonth()) + 1
    );
    const yearsSinceJoin = Math.max(1, currentYear - joinDate.getFullYear() + 1);
    const averageMonthlyProfit = restaurantProfit / monthsSinceJoin;
    const averageYearlyProfit = restaurantProfit / yearsSinceJoin;
    const avgOrderValue = completedTxCount > 0 ? totalRevenue / completedTxCount : 0;

    const analytics = {
        totalOrders: totalOrdersCount,
        cancelledOrders,
        completedOrders,
        averageRating: Number(restaurant.rating || 0),
        totalRatings: Number(restaurant.totalRatings || 0),
        monthlyProfit,
        yearlyProfit,
        averageOrderValue: avgOrderValue,
        totalRevenue,
        restaurantEarning,
        restaurantProfit,
        monthlyOrders,
        yearlyOrders,
        averageMonthlyProfit,
        averageYearlyProfit,
        status: restaurant.status === 'approved' ? 'active' : 'inactive',
        joinDate: restaurant.createdAt,
        totalCustomers,
        repeatCustomers,
        cancellationRate: totalOrdersCount > 0 ? (cancelledOrders / totalOrdersCount) * 100 : 0,
        completionRate: totalOrdersCount > 0 ? (completedOrders / totalOrdersCount) * 100 : 0
    };

    const paymentSummary = {
        subtotal: Number(lifetimeTx.subtotal || 0),
        tax: Number(lifetimeTx.tax || 0),
        packagingFee: Number(lifetimeTx.packagingFee || 0),
        deliveryFee: Number(lifetimeTx.deliveryFee || 0),
        platformFee: Number(lifetimeTx.platformFee || 0),
        discount: Number(lifetimeTx.discount || 0),
        total: totalRevenue,
        currency: 'INR',
        restaurantShare: restaurantEarning,
        riderShare: Number(lifetimeTx.riderShare || 0),
        platformNetProfit: Number(lifetimeTx.platformNetProfit || 0),
    };

    return { restaurant, analytics, paymentSummary };
}

const FOOD_ORDER_ID_REGEX = /^FOD-[A-HJ-NP-Z2-9]{6}$/i;

function isValidFoodOrderIdFormat(value) {
    const raw = String(value || '').trim();
    if (!raw) return false;
    if (FOOD_ORDER_ID_REGEX.test(raw)) return true;
    return mongoose.Types.ObjectId.isValid(raw) && String(new mongoose.Types.ObjectId(raw)) === raw;
}

function looksLikeOrderIdSearch(value) {
    const raw = String(value || '').trim();
    if (!raw) return false;
    if (/^FOD-/i.test(raw)) return true;
    if (/^[a-f0-9]{24}$/i.test(raw)) return true;
    return false;
}

function buildSingleOrderPosAnalytics(order, restaurant, tx) {
    const now = new Date();
    const orderDate = new Date(order.createdAt || now);
    const isCompleted = order.orderStatus === 'delivered';
    const isCancelled = CANCELLED_ORDER_STATUSES.includes(order.orderStatus);
    const restaurantEarning = Number(tx?.amounts?.restaurantShare || 0);
    const totalRevenue = Number(
        tx?.amounts?.totalCustomerPaid
        ?? tx?.pricing?.total
        ?? order.pricing?.total
        ?? 0
    );
    const isCurrentMonth = orderDate.getMonth() === now.getMonth()
        && orderDate.getFullYear() === now.getFullYear();
    const isCurrentYear = orderDate.getFullYear() === now.getFullYear();
    const completedProfit = isCompleted ? restaurantEarning : 0;

    const analytics = {
        totalOrders: 1,
        cancelledOrders: isCancelled ? 1 : 0,
        completedOrders: isCompleted ? 1 : 0,
        averageRating: Number(restaurant?.rating || 0),
        totalRatings: Number(restaurant?.totalRatings || 0),
        monthlyProfit: isCurrentMonth ? completedProfit : 0,
        yearlyProfit: isCurrentYear ? completedProfit : 0,
        averageOrderValue: isCompleted ? totalRevenue : 0,
        totalRevenue: isCompleted ? totalRevenue : 0,
        restaurantEarning: isCompleted ? restaurantEarning : 0,
        restaurantProfit: isCompleted ? restaurantEarning : 0,
        monthlyOrders: isCurrentMonth ? 1 : 0,
        yearlyOrders: isCurrentYear ? 1 : 0,
        averageMonthlyProfit: isCurrentMonth ? completedProfit : 0,
        averageYearlyProfit: isCurrentYear ? completedProfit : 0,
        status: restaurant?.status === 'approved' ? 'active' : 'inactive',
        joinDate: restaurant?.createdAt || orderDate,
        totalCustomers: 1,
        repeatCustomers: 0,
        cancellationRate: isCancelled ? 100 : 0,
        completionRate: isCompleted ? 100 : 0,
        searchType: 'order',
        orderId: order.orderId,
        orderStatus: order.orderStatus,
        orderCreatedAt: order.createdAt,
    };

    const paymentSummary = {
        subtotal: Number(tx?.pricing?.subtotal ?? order.pricing?.subtotal ?? 0),
        tax: Number(tx?.pricing?.tax ?? tx?.amounts?.taxAmount ?? order.pricing?.tax ?? 0),
        packagingFee: Number(tx?.pricing?.packagingFee ?? order.pricing?.packagingFee ?? 0),
        deliveryFee: Number(tx?.pricing?.deliveryFee ?? order.pricing?.deliveryFee ?? 0),
        platformFee: Number(tx?.pricing?.platformFee ?? order.pricing?.platformFee ?? 0),
        discount: Number(tx?.pricing?.discount ?? order.pricing?.discount ?? 0),
        total: totalRevenue,
        currency: 'INR',
        restaurantShare: restaurantEarning,
        riderShare: Number(tx?.amounts?.riderShare || 0),
        platformNetProfit: Number(tx?.amounts?.platformNetProfit || 0),
    };

    return {
        restaurant,
        analytics,
        paymentSummary,
        order: {
            _id: order._id,
            orderId: order.orderId,
            orderStatus: order.orderStatus,
            createdAt: order.createdAt,
        },
    };
}

export async function searchPosOrders(query = '') {
    const term = String(query || '').trim();
    if (!term || !looksLikeOrderIdSearch(term)) return [];

    const escaped = escapeRegex(term);
    const filter = { orderType: 'food' };

    if (/^[a-f0-9]{24}$/i.test(term)) {
        filter.$or = [
            { orderId: { $regex: escaped, $options: 'i' } },
            { _id: new mongoose.Types.ObjectId(term) },
        ];
    } else {
        filter.orderId = { $regex: escaped, $options: 'i' };
    }

    const orders = await FoodOrder.find(filter)
        .select('orderId orderStatus createdAt restaurantId')
        .populate('restaurantId', 'restaurantName restaurantId status')
        .sort({ createdAt: -1 })
        .limit(10)
        .lean();

    return orders.map((order) => ({
        _id: order._id,
        orderId: order.orderId,
        orderStatus: order.orderStatus,
        createdAt: order.createdAt,
        restaurantId: order.restaurantId?._id || order.restaurantId || null,
        restaurantName: order.restaurantId?.restaurantName || '',
        restaurantCode: order.restaurantId?.restaurantId || '',
    }));
}

export async function getOrderPosAnalytics(orderIdParam) {
    const raw = String(orderIdParam || '').trim();
    if (!raw) {
        return { error: 'invalid', message: 'Order ID is required' };
    }
    if (!isValidFoodOrderIdFormat(raw)) {
        return { error: 'invalid', message: 'Invalid order ID format' };
    }

    const identityFilter = buildOrderIdentityFilter(raw);
    if (!identityFilter) {
        return { error: 'invalid', message: 'Invalid order ID format' };
    }

    const order = await FoodOrder.findOne({ ...identityFilter, orderType: 'food' }).lean();
    if (!order) {
        return { error: 'not_found', message: 'Order not found' };
    }

    const restaurant = await FoodRestaurant.findById(order.restaurantId).lean();
    if (!restaurant) {
        return { error: 'not_found', message: 'Restaurant not found for this order' };
    }

    const tx = await FoodTransaction.findOne({ orderId: order._id }).lean();
    return buildSingleOrderPosAnalytics(order, restaurant, tx);
}

export async function getRestaurantMenuById(id) {
    if (!id || !mongoose.Types.ObjectId.isValid(id)) return null;
    const doc = await FoodRestaurant.findById(id).select('menu').lean();
    if (!doc) return null;
    return doc.menu || { sections: [] };
}

export async function updateRestaurantMenuById(id, menu) {
    if (!id || !mongoose.Types.ObjectId.isValid(id)) return null;
    const doc = await FoodRestaurant.findById(id);
    if (!doc) return null;
    const sections = Array.isArray(menu?.sections) ? menu.sections : [];
    doc.menu = { sections };
    await doc.save();
    return doc.menu || { sections: [] };
}

export async function getPendingRestaurants() {
    const restaurants = await FoodRestaurant.find({
        $or: [
            { status: { $in: ['pending', 'rejected'] } },
            // Already-approved restaurants with staged changes awaiting review.
            { 'pendingOpenDays.hasPendingUpdate': true },
            { 'pendingProfileChanges.hasPendingUpdate': true },
        ]
    })
        .populate('zoneId', 'name zoneName serviceLocation')
        .sort({ createdAt: -1 })
        .lean();
    return restaurants.map((r, i) => ({
        ...r,
        sl: i + 1,
        zone: r.zoneId?.serviceLocation || r.zoneId?.zoneName || r.zoneId?.name || null,
        // Flags so the admin UI can treat approved-but-pending review items correctly.
        hasPendingOpenDaysUpdate: Boolean(r.pendingOpenDays?.hasPendingUpdate),
        hasPendingProfileUpdate: Boolean(r.pendingProfileChanges?.hasPendingUpdate),
    }));
}

export async function updateRestaurantById(id, body = {}) {
    if (!id || !mongoose.Types.ObjectId.isValid(id)) return null;
    const doc = await FoodRestaurant.findById(id);
    if (!doc) return null;

    const toStr = (v) => (v != null ? String(v).trim() : '');
    const toFinite = (v) => {
        const n = Number(v);
        return Number.isFinite(n) ? n : undefined;
    };

    if (body.ownerPhone !== undefined || body.primaryContactNumber !== undefined) {
        await validateRestaurantPhoneUniqueness({
            ownerPhone: body.ownerPhone,
            primaryContactNumber: body.primaryContactNumber,
            restaurantId: doc._id,
            currentRestaurant: doc,
        });
    }

    if (body.name !== undefined || body.restaurantName !== undefined) {
        const name = toStr(body.name !== undefined ? body.name : body.restaurantName);
        if (!name) throw new ValidationError('Restaurant name cannot be empty');
        doc.restaurantName = name;
    }

    if (body.ownerName !== undefined) doc.ownerName = toStr(body.ownerName);
    if (body.ownerEmail !== undefined) doc.ownerEmail = toStr(body.ownerEmail).toLowerCase();
    if (body.ownerPhone !== undefined) {
        const { digits, last10 } = normalizeRestaurantPhone(body.ownerPhone);
        doc.ownerPhone = digits;
        doc.ownerPhoneDigits = digits;
        doc.ownerPhoneLast10 = last10 || undefined;
    }
    if (body.primaryContactNumber !== undefined) {
        const { digits, last10 } = normalizeRestaurantPhone(body.primaryContactNumber);
        doc.primaryContactNumber = digits;
        doc.primaryContactNumberDigits = digits;
        doc.primaryContactNumberLast10 = last10 || undefined;
    }

    if (body.pureVegRestaurant !== undefined) {
        doc.pureVegRestaurant = parseBooleanLike(body.pureVegRestaurant, 'pureVegRestaurant');
    }

    if (body.isAcceptingOrders !== undefined) {
        doc.isAcceptingOrders = parseBooleanLike(body.isAcceptingOrders, 'isAcceptingOrders');
    }

    if (body.cuisines !== undefined) {
        if (Array.isArray(body.cuisines)) {
            doc.cuisines = body.cuisines
                .map((c) => toStr(c))
                .filter(Boolean)
                .slice(0, 50);
        } else if (typeof body.cuisines === 'string') {
            doc.cuisines = body.cuisines
                .split(',')
                .map((c) => toStr(c))
                .filter(Boolean)
                .slice(0, 50);
        } else {
            throw new ValidationError('cuisines must be an array or comma-separated string');
        }
    }

    if (body.openingTime !== undefined) doc.openingTime = normalizeRestaurantTime(body.openingTime) || '';
    if (body.closingTime !== undefined) doc.closingTime = normalizeRestaurantTime(body.closingTime) || '';
    validateOpeningClosingTimes(doc.openingTime, doc.closingTime);
    if (body.openDays !== undefined && Array.isArray(body.openDays)) {
        doc.openDays = body.openDays.map(d => toStr(d)).filter(Boolean);
    }
    if (body.offer !== undefined) doc.offer = toStr(body.offer);

    if (body.estimatedDeliveryTime !== undefined) {
        doc.estimatedDeliveryTime = toStr(body.estimatedDeliveryTime);
    }
    if (body.estimatedDeliveryTimeMinutes !== undefined) {
        const minutes = toFiniteNumber(body.estimatedDeliveryTimeMinutes);
        if (minutes === null) {
            doc.estimatedDeliveryTimeMinutes = undefined;
        } else if (minutes < 0) {
            throw new ValidationError('estimatedDeliveryTimeMinutes must be >= 0');
        } else {
            doc.estimatedDeliveryTimeMinutes = Math.round(minutes);
        }
    }

    // Business & Docs
    if (body.panNumber !== undefined) doc.panNumber = toStr(body.panNumber);
    if (body.nameOnPan !== undefined) doc.nameOnPan = toStr(body.nameOnPan);
    if (body.gstRegistered !== undefined) doc.gstRegistered = parseBooleanLike(body.gstRegistered, 'gstRegistered');
    if (body.gstNumber !== undefined) doc.gstNumber = toStr(body.gstNumber);
    if (body.gstLegalName !== undefined) doc.gstLegalName = toStr(body.gstLegalName);
    if (body.gstAddress !== undefined) doc.gstAddress = toStr(body.gstAddress);
    if (body.fssaiNumber !== undefined) doc.fssaiNumber = toStr(body.fssaiNumber);
    if (body.fssaiExpiry !== undefined) doc.fssaiExpiry = body.fssaiExpiry ? new Date(body.fssaiExpiry) : undefined;

    // Bank Details
    if (body.accountNumber !== undefined) doc.accountNumber = toStr(body.accountNumber);
    if (body.ifscCode !== undefined) doc.ifscCode = toStr(body.ifscCode);
    if (body.accountHolderName !== undefined) doc.accountHolderName = toStr(body.accountHolderName);
    if (body.accountType !== undefined) doc.accountType = toStr(body.accountType);

    // Featured Info
    if (body.featuredDish !== undefined) doc.featuredDish = toStr(body.featuredDish);
    if (body.featuredPrice !== undefined) doc.featuredPrice = toFinite(body.featuredPrice);

    // Images
    const getUrl = (v) => (v && typeof v === 'object' ? (v.url || v.secure_url) : v);
    if (body.profileImage !== undefined) doc.profileImage = toStr(getUrl(body.profileImage)) || undefined;
    if (body.panImage !== undefined) doc.panImage = toStr(getUrl(body.panImage)) || undefined;
    if (body.gstImage !== undefined) doc.gstImage = toStr(getUrl(body.gstImage)) || undefined;
    if (body.fssaiImage !== undefined) doc.fssaiImage = toStr(getUrl(body.fssaiImage)) || undefined;

    if (body.menuImages !== undefined) {
        if (Array.isArray(body.menuImages)) {
            doc.menuImages = body.menuImages.map(m => toStr(getUrl(m))).filter(Boolean);
        } else {
            doc.menuImages = [toStr(getUrl(body.menuImages))].filter(Boolean);
        }
    }

    if (body.commissionPercentage !== undefined) {
        const commission = toFinite(body.commissionPercentage);
        if (commission !== undefined) {
            if (commission < 0 || commission > 100) {
                throw new ValidationError('Commission percentage must be between 0 and 100');
            }
            doc.commissionPercentage = commission;
        }
    }

    await doc.save();
    return FoodRestaurant.findById(id).select('-__v').populate('zoneId', 'name zoneName serviceLocation isActive').lean();
}

export async function updateRestaurantStatus(id, body = {}) {
    if (!id || !mongoose.Types.ObjectId.isValid(id)) return null;
    const raw = body.status !== undefined ? body.status : body.isActive;
    const isActive = parseBooleanLike(raw, 'status');
    const status = isActive ? 'approved' : 'rejected';

    const updated = await FoodRestaurant.findByIdAndUpdate(
        id,
        {
            $set: {
                status,
                approvedAt: isActive ? new Date() : undefined,
                rejectedAt: isActive ? undefined : new Date(),
                rejectionReason: isActive ? undefined : 'Disabled by admin'
            }
        },
        { new: true, runValidators: false }
    ).lean();
    if (updated) invalidateDashboardStatsCache();
    return updated;
}

export async function toggleRestaurantListing(id, isListed) {
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        throw new ValidationError('Invalid restaurant ID');
    }
    const { FoodRestaurant } = await import('../../restaurant/models/restaurant.model.js');
    const { FoodItem } = await import('../../admin/models/food.model.js');
    const restaurant = await FoodRestaurant.findById(id);
    if (!restaurant) {
        throw new ValidationError('Restaurant not found');
    }

    if (isListed && !restaurant.showWithoutMenu) {
        const itemCount = await FoodItem.countDocuments({ restaurantId: id });
        if (itemCount <= 0) {
            throw new ValidationError('Cannot make visible. Restaurant has no menu items. Enable "Show w/o menu" first.');
        }
    }

    restaurant.isListed = Boolean(isListed);
    await restaurant.save();
    return restaurant.toObject();
}

export async function toggleShowWithoutMenu(id, showWithoutMenu) {
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        throw new ValidationError('Invalid restaurant ID');
    }
    const { FoodRestaurant } = await import('../../restaurant/models/restaurant.model.js');
    const restaurant = await FoodRestaurant.findById(id);
    if (!restaurant) {
        throw new ValidationError('Restaurant not found');
    }

    restaurant.showWithoutMenu = Boolean(showWithoutMenu);
    
    // Auto turn off visibility if turning off showWithoutMenu and productCount is 0
    if (!restaurant.showWithoutMenu) {
        const { FoodItem } = await import('../../admin/models/food.model.js');
        const itemCount = await FoodItem.countDocuments({ restaurantId: id });
        if (itemCount <= 0) {
            restaurant.isListed = false;
        }
    }
    
    await restaurant.save();
    return restaurant.toObject();
}

export async function updateRestaurantLocation(id, body = {}) {
    if (!id || !mongoose.Types.ObjectId.isValid(id)) return null;
    const doc = await FoodRestaurant.findById(id);
    if (!doc) return null;

    const source = (body.location && typeof body.location === 'object') ? body.location : body;
    const toStr = (v) => (v != null ? String(v).trim() : '');

    const coordinates = Array.isArray(source.coordinates) ? source.coordinates : [];
    const lngFromCoordinates = toFiniteNumber(coordinates[0]);
    const latFromCoordinates = toFiniteNumber(coordinates[1]);
    const latitude = toFiniteNumber(source.latitude ?? latFromCoordinates);
    const longitude = toFiniteNumber(source.longitude ?? lngFromCoordinates);

    const addressLine1 = toStr(source.addressLine1 || source.formattedAddress || source.address);
    const addressLine2 = toStr(source.addressLine2);
    const area = toStr(source.area);
    const city = toStr(source.city);
    const state = toStr(source.state);
    const pincode = toStr(source.pincode || source.zipCode || source.postalCode);
    const landmark = toStr(source.landmark);
    const formattedAddress = toStr(source.formattedAddress || source.address || addressLine1);

    if (!doc.location || typeof doc.location !== 'object') {
        doc.location = { type: 'Point' };
    }
    doc.location.type = 'Point';
    if (latitude !== null && longitude !== null) {
        doc.location.latitude = latitude;
        doc.location.longitude = longitude;
        doc.location.coordinates = [longitude, latitude];
    }
    doc.location.formattedAddress = formattedAddress;
    doc.location.address = toStr(source.address || formattedAddress);
    doc.location.addressLine1 = addressLine1;
    doc.location.addressLine2 = addressLine2;
    doc.location.area = area;
    doc.location.city = city;
    doc.location.state = state;
    doc.location.pincode = pincode;
    doc.location.landmark = landmark;

    // Keep flat fields in sync for legacy readers.
    doc.addressLine1 = addressLine1;
    doc.addressLine2 = addressLine2;
    doc.area = area;
    doc.city = city;
    doc.state = state;
    doc.pincode = pincode;
    doc.landmark = landmark;

    if (body.zoneId !== undefined) {
        const zoneId = String(body.zoneId || '').trim();
        if (!zoneId) {
            doc.zoneId = undefined;
        } else if (!mongoose.Types.ObjectId.isValid(zoneId)) {
            throw new ValidationError('Invalid zoneId');
        } else {
            doc.zoneId = new mongoose.Types.ObjectId(zoneId);
        }
    }

    await doc.save();
    return FoodRestaurant.findById(id).select('-__v').populate('zoneId', 'name zoneName serviceLocation isActive').lean();
}

// ----- Categories -----
export async function getCategories(query) {
    const limit = Math.min(Math.max(parseInt(query.limit, 10) || 100, 1), 1000);
    const page = Math.max(parseInt(query.page, 10) || 1, 1);
    const skip = (page - 1) * limit;

    const filter = {};
    if (query.search && String(query.search).trim()) {
        const term = escapeRegex(String(query.search).trim().slice(0, 80));
        filter.$or = [{ name: { $regex: term, $options: 'i' } }];
    }
    // Optional zone filter for admin list.
    // - zoneId=global => only global categories (zoneId missing)
    // - zoneId=<ObjectId> => only categories bound to that zone
    if (query.zoneId && String(query.zoneId).trim()) {
        const zid = String(query.zoneId).trim();
        if (zid === 'global') {
            filter.$or = [...(filter.$or || []), { zoneId: { $exists: false } }, { zoneId: null }];
        } else if (mongoose.Types.ObjectId.isValid(zid)) {
            filter.zoneId = new mongoose.Types.ObjectId(zid);
        }
    }
    if (query.approvalStatus) {
        const approvalStatus = String(query.approvalStatus);
        if (approvalStatus === 'pending') {
            filter.$and = [...(filter.$and || []), {
                $or: [
                    { approvalStatus: 'pending' },
                    { approvalStatus: { $exists: false }, isApproved: false }
                ]
            }];
        } else {
            filter.approvalStatus = approvalStatus;
        }
    } else if (query.isApproved !== undefined) {
        if (query.isApproved === true) {
            filter.$and = [...(filter.$and || []), {
                $or: [
                    { approvalStatus: 'approved' },
                    { approvalStatus: { $exists: false }, isApproved: { $ne: false } }
                ]
            }];
        } else {
            filter.$and = [...(filter.$and || []), {
                $or: [
                    { approvalStatus: 'pending' },
                    { approvalStatus: { $exists: false }, isApproved: false }
                ]
            }];
        }
    }

    const [list, total] = await Promise.all([
        FoodCategory.find(filter)
            .populate('zoneId', 'name zoneName')
            .sort({ sortOrder: 1, createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        FoodCategory.countDocuments(filter)
    ]);

    // Read-only: normalize legacy records in-memory for the response, but do NOT write on a GET.
    const statsById = await backfillLegacyCategoryWorkflow(list, { persist: false });
    const restaurantIds = Array.from(
        new Set(
            list
                .flatMap((category) => [category?.restaurantId, category?.createdByRestaurantId])
                .map((value) => (value ? String(value) : ''))
                .filter(Boolean)
        )
    );
    const restaurants = restaurantIds.length
        ? await FoodRestaurant.find({ _id: { $in: restaurantIds } })
            .select('restaurantName ownerName ownerPhone')
            .lean()
        : [];
    const restaurantMap = new Map(restaurants.map((restaurant) => [String(restaurant._id), restaurant]));

    const hydratedList = list.map((category) => ({
        ...category,
        restaurantId: category?.restaurantId ? restaurantMap.get(String(category.restaurantId)) || category.restaurantId : category.restaurantId,
        createdByRestaurantId: category?.createdByRestaurantId ? restaurantMap.get(String(category.createdByRestaurantId)) || category.createdByRestaurantId : category.createdByRestaurantId
    }));
    const categories = hydratedList.map((category) => serializeCategoryForResponse(category, { includeCounts: true, statsById }));

    return { categories, total, page, limit };
}

export async function createCategory(body) {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) throw new ValidationError('Category name is required');
    const foodTypeScope = normalizeCategoryFoodTypeScope(body.foodTypeScope, '');
    if (!foodTypeScope) {
        throw new ValidationError('Category diet type must be Veg or Non-Veg');
    }
    const zoneId =
        body.zoneId && String(body.zoneId).trim()
            ? (() => {
                const zid = String(body.zoneId).trim();
                if (zid === 'global') return undefined;
                if (!mongoose.Types.ObjectId.isValid(zid)) throw new ValidationError('Invalid zoneId');
                return new mongoose.Types.ObjectId(zid);
            })()
            : undefined;

    await ensureUniqueCategoryName(name, { restaurantId: null, zoneId });

    const doc = new FoodCategory({
        name,
        image: typeof body.image === 'string' ? body.image.trim() : '',
        type: typeof body.type === 'string' ? body.type.trim() : '',
        foodTypeScope,
        zoneId,
        isActive: body.isActive !== false,
        sortOrder: Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 0,
        // Admin-created categories are globally available immediately.
        approvalStatus: 'approved',
        isApproved: true,
        approvedAt: new Date(),
        rejectionReason: '',
        restaurantId: undefined,
        createdByRestaurantId: undefined
    });
    await doc.save();
    return doc.toObject();
}

export async function approveCategory(id) {
    if (!id || !mongoose.Types.ObjectId.isValid(id)) return null;
    const doc = await FoodCategory.findById(id);
    if (!doc) return null;

    if (!doc.createdByRestaurantId && doc.restaurantId) {
        doc.createdByRestaurantId = doc.restaurantId;
    }
    doc.approvalStatus = 'approved';
    doc.isApproved = true;
    doc.approvedAt = new Date();
    doc.rejectedAt = undefined;
    doc.rejectionReason = '';
    await doc.save();
    return doc.toObject();
}

export async function rejectCategory(id, reason) {
    if (!id || !mongoose.Types.ObjectId.isValid(id)) return null;
    const doc = await FoodCategory.findById(id);
    if (!doc) return null;
    if (!doc.restaurantId && !doc.createdByRestaurantId) {
        throw new ValidationError('Only restaurant-created categories can be rejected');
    }

    if (!doc.createdByRestaurantId && doc.restaurantId) {
        doc.createdByRestaurantId = doc.restaurantId;
    }
    doc.approvalStatus = 'rejected';
    doc.isApproved = false;
    doc.rejectionReason = String(reason || '').trim();
    doc.rejectedAt = new Date();
    doc.approvedAt = undefined;
    await doc.save();
    return doc.toObject();
}

export async function makeCategoryGlobal(id) {
    if (!id || !mongoose.Types.ObjectId.isValid(id)) return null;
    const doc = await FoodCategory.findById(id);
    if (!doc) return null;

    if (!doc.restaurantId && !doc.createdByRestaurantId) {
        return doc.toObject();
    }
    if (String(doc.approvalStatus || '') !== 'approved' && doc.isApproved !== true) {
        throw new ValidationError('Only approved categories can be made global');
    }

    doc.createdByRestaurantId = doc.createdByRestaurantId || doc.restaurantId;
    doc.restaurantId = undefined;
    doc.zoneId = undefined;
    doc.approvalStatus = 'approved';
    doc.isApproved = true;
    doc.rejectionReason = '';
    doc.globalizedAt = new Date();
    doc.approvedAt = doc.approvedAt || new Date();

    await ensureUniqueCategoryName(doc.name, {
        restaurantId: null,
        zoneId: undefined,
        excludeCategoryId: doc._id
    });

    await doc.save();
    return doc.toObject();
}

export async function updateCategory(id, body) {
    if (!id || !mongoose.Types.ObjectId.isValid(id)) return null;
    const doc = await FoodCategory.findById(id);
    if (!doc) return null;

    const previousIsActive = doc.isActive !== false;

    const nextFoodTypeScope = body.foodTypeScope !== undefined
        ? normalizeCategoryFoodTypeScope(body.foodTypeScope, doc.foodTypeScope || 'Veg')
        : normalizeCategoryFoodTypeScope(doc.foodTypeScope, 'Veg');

    if (body.foodTypeScope !== undefined && !nextFoodTypeScope) {
        throw new ValidationError('Category diet type must be Veg or Non-Veg');
    }

    if (body.foodTypeScope !== undefined) {
        const incompatibleFoods = await FoodItem.countDocuments({
            categoryId: doc._id,
            foodType: nextFoodTypeScope === 'Veg' ? 'Non-Veg' : 'Veg'
        });
        if (incompatibleFoods > 0) {
            throw new ValidationError(`This category already has ${incompatibleFoods} food item(s) outside the selected diet scope`);
        }
    }

    if (body.name !== undefined) doc.name = String(body.name || '').trim();
    if (body.image !== undefined) doc.image = String(body.image || '').trim();
    if (body.type !== undefined) doc.type = String(body.type || '').trim();
    if (body.foodTypeScope !== undefined) doc.foodTypeScope = nextFoodTypeScope;
    if (!doc.restaurantId && doc.createdByRestaurantId) {
        doc.zoneId = undefined;
    } else if (body.zoneId !== undefined) {
        const raw = String(body.zoneId || '').trim();
        if (!raw || raw === 'global') {
            doc.zoneId = undefined;
        } else {
            if (!mongoose.Types.ObjectId.isValid(raw)) throw new ValidationError('Invalid zoneId');
            doc.zoneId = new mongoose.Types.ObjectId(raw);
        }
    }
    if (body.isActive !== undefined) doc.isActive = body.isActive !== false;
    if (body.sortOrder !== undefined) doc.sortOrder = Number(body.sortOrder) || 0;
    if (!doc.createdByRestaurantId && doc.restaurantId) {
        doc.createdByRestaurantId = doc.restaurantId;
    }

    await ensureUniqueCategoryName(doc.name, {
        restaurantId: doc.restaurantId || null,
        zoneId: doc.zoneId || null,
        excludeCategoryId: doc._id
    });

    await doc.save();

    const nextIsActive = doc.isActive !== false;
    if (previousIsActive !== nextIsActive) {
        await notifyCategoryStatusChange(doc, { isActive: nextIsActive });
    }

    return doc.toObject();
}

export async function deleteCategory(id) {
    if (!id || !mongoose.Types.ObjectId.isValid(id)) return null;
    const inUse = await FoodItem.countDocuments({ categoryId: id });
    if (inUse > 0) {
        throw new ValidationError('Cannot delete category while it has items');
    }
    const deleted = await FoodCategory.findByIdAndDelete(id).lean();
    return deleted ? { id } : null;
}

export async function toggleCategoryStatus(id) {
    if (!id || !mongoose.Types.ObjectId.isValid(id)) return null;
    const doc = await FoodCategory.findById(id);
    if (!doc) return null;
    const previousIsActive = doc.isActive !== false;
    doc.isActive = !doc.isActive;
    if (!doc.createdByRestaurantId && doc.restaurantId) {
        doc.createdByRestaurantId = doc.restaurantId;
    }
    await doc.save();

    const nextIsActive = doc.isActive !== false;
    if (previousIsActive !== nextIsActive) {
        await notifyCategoryStatusChange(doc, { isActive: nextIsActive });
    }

    return doc.toObject();
}

// ----- Restaurant Add-ons approval (admin) -----
export async function getRestaurantAddonsAdmin(query = {}) {
    const limit = Math.min(Math.max(parseInt(query.limit, 10) || 50, 1), 200);
    const page = Math.max(parseInt(query.page, 10) || 1, 1);
    const skip = (page - 1) * limit;

    const filter = { isDeleted: { $ne: true } };

    const approvalStatus = String(query.approvalStatus || '').trim();
    if (approvalStatus && ['pending', 'approved', 'rejected'].includes(approvalStatus)) {
        filter.approvalStatus = approvalStatus;
    }

    if (query.restaurantId && mongoose.Types.ObjectId.isValid(String(query.restaurantId))) {
        filter.restaurantId = new mongoose.Types.ObjectId(String(query.restaurantId));
    }

    if (query.search && String(query.search).trim()) {
        const raw = String(query.search).trim().slice(0, 80);
        const term = raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const matchingRestaurantIds = await FoodRestaurant.find({
            restaurantName: { $regex: term, $options: 'i' }
        })
            .select('_id')
            .lean();

        filter.$or = [
            { 'draft.name': { $regex: term, $options: 'i' } },
            { restaurantId: { $in: matchingRestaurantIds.map((restaurant) => restaurant._id) } }
        ];
    }

    const [list, total] = await Promise.all([
        FoodAddon.find(filter)
            .sort({ requestedAt: -1, createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('restaurantId', 'restaurantName ownerName ownerPhone')
            .lean(),
        FoodAddon.countDocuments(filter)
    ]);

    const addons = list.map((a) => ({
        id: a._id,
        _id: a._id,
        restaurantId: a.restaurantId?._id ? String(a.restaurantId._id) : String(a.restaurantId),
        restaurant: a.restaurantId?._id
            ? {
                _id: a.restaurantId._id,
                name: a.restaurantId.restaurantName || '',
                ownerName: a.restaurantId.ownerName || '',
                ownerPhone: a.restaurantId.ownerPhone || ''
            }
            : null,
        approvalStatus: a.approvalStatus || 'pending',
        rejectionReason: a.rejectionReason || '',
        requestedAt: a.requestedAt,
        approvedAt: a.approvedAt,
        rejectedAt: a.rejectedAt,
        isAvailable: a.isAvailable !== false,
        draft: a.draft || null,
        published: a.published || null,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt
    }));

    return { addons, total, page, limit };
}

export async function updateRestaurantAddonAdmin(addonId, body) {
    if (!addonId || !mongoose.Types.ObjectId.isValid(String(addonId))) return null;
    const _id = new mongoose.Types.ObjectId(String(addonId));

    const addon = await FoodAddon.findOne({ _id, isDeleted: { $ne: true } });
    if (!addon) return null;

    const updatePayload = {};
    if (body.name !== undefined) updatePayload.name = String(body.name || '').trim();
    if (body.description !== undefined) updatePayload.description = String(body.description || '').trim();
    if (body.price !== undefined) {
        const p = Number(body.price);
        if (!Number.isFinite(p) || p < 0) throw new ValidationError('Price must be a valid positive number');
        updatePayload.price = p;
    }
    if (body.image !== undefined) updatePayload.image = String(body.image || '').trim();
    if (body.images !== undefined && Array.isArray(body.images)) {
        updatePayload.images = body.images.map(img => typeof img === 'string' ? img : img?.url).filter(Boolean);
    } else if (updatePayload.image) {
        updatePayload.images = [updatePayload.image];
    }
    if (body.foodType !== undefined) {
        updatePayload.foodType = body.foodType === 'Non-Veg' ? 'Non-Veg' : 'Veg';
    }

    // Update draft fields
    if (addon.draft) {
        Object.assign(addon.draft, updatePayload);
    } else {
        addon.draft = updatePayload;
    }

    // If already approved, update published state as well
    if (addon.approvalStatus === 'approved') {
        if (addon.published) {
            Object.assign(addon.published, updatePayload);
        } else {
            addon.published = updatePayload;
        }
    }

    if (body.isAvailable !== undefined) {
        addon.isAvailable = body.isAvailable === true;
    }

    await addon.save();
    return addon.toObject();
}

export async function approveRestaurantAddon(addonId, performer = null) {
    if (!addonId || !mongoose.Types.ObjectId.isValid(String(addonId))) return null;
    const _id = new mongoose.Types.ObjectId(String(addonId));

    // Use update pipeline to copy draft -> published atomically.
    const updated = await FoodAddon.findOneAndUpdate(
        { _id, isDeleted: { $ne: true } },
        [
            {
                $set: {
                    published: '$draft',
                    approvalStatus: 'approved',
                    approvedAt: '$$NOW',
                    rejectedAt: null,
                    rejectionReason: '',
                    approvedBy: performer
                }
            }
        ],
        { new: true }
    ).lean();

    if (updated?.restaurantId) {
        try {
            const { notifyOwnersSafely } = await import('../../../../core/notifications/firebase.service.js');
            await notifyOwnersSafely(
                [{ ownerType: 'RESTAURANT', ownerId: updated.restaurantId }],
                {
                    title: 'Addon Approved! ✅',
                    body: `Your addon "${updated.published?.name || 'New Addon'}" has been approved and is now live.`,
                    image: 'https://i.ibb.co/3m2Yh7r/Appzeto-Brand-Image.png',
                    data: {
                        type: 'addon_approved',
                        addonId: String(updated._id),
                        restaurantId: String(updated.restaurantId)
                    }
                }
            );
        } catch (e) {
            console.error('Failed to send addon approval notification:', e);
        }
    }

    return updated || null;
}

export async function rejectRestaurantAddon(addonId, reason, performer = null) {
    if (!addonId || !mongoose.Types.ObjectId.isValid(String(addonId))) return null;
    const _id = new mongoose.Types.ObjectId(String(addonId));
    const rejectionReason = String(reason || '').trim();
    if (!rejectionReason) {
        throw new ValidationError('Rejection reason is required');
    }
    const updated = await FoodAddon.findOneAndUpdate(
        { _id, isDeleted: { $ne: true } },
        {
            $set: {
                approvalStatus: 'rejected',
                rejectionReason,
                rejectedAt: new Date(),
                approvedAt: null,
                rejectedBy: performer
            }
        },
        { new: true }
    ).lean();

    if (updated?.restaurantId) {
        try {
            const { notifyOwnersSafely } = await import('../../../../core/notifications/firebase.service.js');
            await notifyOwnersSafely(
                [{ ownerType: 'RESTAURANT', ownerId: updated.restaurantId }],
                {
                    title: 'Addon Rejected ❌',
                    body: `Your addon request for "${updated.draft?.name || 'New Addon'}" was rejected. Reason: ${rejectionReason}`,
                    image: 'https://i.ibb.co/3m2Yh7r/Appzeto-Brand-Image.png',
                    data: {
                        type: 'addon_rejected',
                        addonId: String(updated._id),
                        restaurantId: String(updated.restaurantId),
                        reason: rejectionReason
                    }
                }
            );
        } catch (e) {
            console.error('Failed to send addon rejection notification:', e);
        }
    }

    return updated || null;
}

// ----- Foods (separate collection) -----
export async function getFoods(query) {
    const limit = Math.min(Math.max(parseInt(query.limit, 10) || 100, 1), 1000);
    const page = Math.max(parseInt(query.page, 10) || 1, 1);
    const skip = (page - 1) * limit;
    const filter = {};

    if (query.restaurantId && mongoose.Types.ObjectId.isValid(query.restaurantId)) {
        filter.restaurantId = query.restaurantId;
    }
    if (query.search && String(query.search).trim()) {
        const term = String(query.search).trim();
        filter.$or = [
            { name: { $regex: term, $options: 'i' } },
            { categoryName: { $regex: term, $options: 'i' } }
        ];
    }
    if (query.approvalStatus && ['pending', 'approved', 'rejected'].includes(String(query.approvalStatus))) {
        filter.approvalStatus = String(query.approvalStatus);
    }

    const [list, total] = await Promise.all([
        FoodItem.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        FoodItem.countDocuments(filter)
    ]);

    const restaurantIds = Array.from(new Set(list.map((f) => String(f.restaurantId)).filter(Boolean)));
    const restaurants = restaurantIds.length
        ? await FoodRestaurant.find({ _id: { $in: restaurantIds } }).select('restaurantName').lean()
        : [];
    const restaurantMap = new Map(restaurants.map((r) => [String(r._id), r.restaurantName]));

    const foods = list.map((f) => ({
        id: f._id,
        _id: f._id,
        restaurantId: f.restaurantId,
        restaurantName: restaurantMap.get(String(f.restaurantId)) || 'Unknown Restaurant',
        categoryId: f.categoryId || null,
        categoryName: f.categoryName || '',
        name: f.name,
        description: f.description || '',
        price: getFoodDisplayPrice(f),
        variants: serializeFoodVariants(f.variants),
        variations: serializeFoodVariants(f.variants),
        image: f.image || '',
        foodType: f.foodType || 'Non-Veg',
        isAvailable: f.isAvailable !== false,
        preparationTime: f.preparationTime || '',
        approvalStatus: f.approvalStatus || 'approved',
        rejectionReason: f.rejectionReason || '',
        approvedAt: f.approvedAt || null,
        rejectedAt: f.rejectedAt || null,
        approvedBy: f.approvedBy || null,
        rejectedBy: f.rejectedBy || null,
        createdAt: f.createdAt,
        updatedAt: f.updatedAt
    }));

    return { foods, total, page, limit };
}

const resolveAdminFoodCategory = async ({ categoryId, categoryName, foodType, pureVegRestaurant }) => {
    let resolvedCategoryId = null;
    let resolvedCategoryName = typeof categoryName === 'string' ? categoryName.trim() : '';
    let categoryDoc = null;

    if (categoryId) {
        if (!mongoose.Types.ObjectId.isValid(categoryId)) {
            throw new ValidationError('Invalid category id');
        }
        categoryDoc = await FoodCategory.findById(categoryId)
            .select('name foodTypeScope')
            .lean();
        if (!categoryDoc?._id) {
            throw new ValidationError('Category not found');
        }
        resolvedCategoryId = categoryDoc._id;
        resolvedCategoryName = categoryDoc.name || resolvedCategoryName;
    }

    if (!resolvedCategoryName) {
        throw new ValidationError('Category is required');
    }

    if (categoryDoc?.foodTypeScope) {
        if (pureVegRestaurant && String(categoryDoc.foodTypeScope || '') !== 'Veg') {
            throw new ValidationError('Pure veg restaurants can only use veg categories');
        }
        if (!categoryAllowsFoodType(categoryDoc.foodTypeScope, foodType)) {
            throw new ValidationError(`This ${categoryDoc.foodTypeScope} category cannot accept ${foodType} food`);
        }
    }

    return {
        categoryId: resolvedCategoryId,
        categoryName: resolvedCategoryName
    };
};

const getAdminFoodCreatePricing = (body = {}) => {
    const variants = normalizeFoodVariantsInput(extractRawFoodVariants(body));
    if (variants.length > 0) {
        return {
            price: getFoodDisplayPrice({ variants }),
            variants
        };
    }

    const price = Number(body.price);
    if (!Number.isFinite(price) || price <= 0) throw new ValidationError('Price must be greater than 0');
    return {
        price,
        variants: []
    };
};

const getAdminFoodUpdatedPricing = (existing = {}, body = {}) => {
    const variantsTouched = body.variants !== undefined || body.variations !== undefined;
    const existingHasVariants = hasFoodVariants(existing);
    const update = {};

    if (variantsTouched) {
        const variants = normalizeFoodVariantsInput(extractRawFoodVariants(body));
        update.variants = variants;

        if (variants.length > 0) {
            update.price = getFoodDisplayPrice({ variants });
            return update;
        }

        const nextBasePrice = body.price !== undefined ? Number(body.price) : Number(existingHasVariants ? NaN : existing.price);
        if (!Number.isFinite(nextBasePrice) || nextBasePrice <= 0) {
            throw new ValidationError('Base price must be greater than 0 when variants are removed');
        }
        update.price = nextBasePrice;
        return update;
    }

    if (body.price !== undefined) {
        if (existingHasVariants) {
            throw new ValidationError('Update variants instead of base price for foods with variants');
        }
        const price = Number(body.price);
        if (!Number.isFinite(price) || price <= 0) throw new ValidationError('Price must be greater than 0');
        update.price = price;
    }

    return update;
};

export async function createFood(body) {
    const restaurantId = body.restaurantId;
    if (!restaurantId || !mongoose.Types.ObjectId.isValid(restaurantId)) {
        throw new ValidationError('Valid restaurantId is required');
    }
    const restaurant = await FoodRestaurant.findById(restaurantId)
        .select('pureVegRestaurant')
        .lean();
    if (!restaurant?._id) {
        throw new ValidationError('Restaurant not found');
    }
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) throw new ValidationError('Food name is required');
    const foodType = body.foodType === 'Veg' ? 'Veg' : 'Non-Veg';
    if (restaurant.pureVegRestaurant === true && foodType !== 'Veg') {
        throw new ValidationError('Pure veg restaurants can only use veg foods');
    }
    const { price, variants } = getAdminFoodCreatePricing(body);

    let categoryName = typeof body.categoryName === 'string' ? body.categoryName.trim() : '';
    if (!categoryName && typeof body.category === 'string') categoryName = body.category.trim();
    const { categoryId, categoryName: resolvedCategoryName } = await resolveAdminFoodCategory({
        categoryId: body.categoryId,
        categoryName,
        foodType,
        pureVegRestaurant: restaurant.pureVegRestaurant === true
    });

    const doc = new FoodItem({
        restaurantId,
        categoryId,
        categoryName: resolvedCategoryName,
        name,
        description: typeof body.description === 'string' ? body.description.trim() : '',
        price,
        variants,
        image: typeof body.image === 'string' ? body.image.trim() : '',
        foodType,
        isAvailable: body.isAvailable !== false,
        preparationTime: typeof body.preparationTime === 'string' ? body.preparationTime.trim() : '',
        approvalStatus: 'approved'
    });
    await doc.save();
    try {
        const { FoodRestaurant } = await import('../../restaurant/models/restaurant.model.js');
        const restaurant = await FoodRestaurant.findByIdAndUpdate(restaurantId, {
            $inc: { productCount: 1 }
        });
        if (restaurant && (restaurant.productCount || 0) === 0) {
            await FoodRestaurant.findByIdAndUpdate(restaurantId, { isListed: true });
        }
    } catch (err) {
        console.error('Failed to update restaurant product count on admin food create:', err);
    }
    return doc.toObject();
}

export async function updateFood(id, body) {
    if (!id || !mongoose.Types.ObjectId.isValid(id)) return null;
    const doc = await FoodItem.findById(id);
    if (!doc) return null;
    const restaurant = await FoodRestaurant.findById(doc.restaurantId)
        .select('pureVegRestaurant')
        .lean();
    if (!restaurant?._id) {
        throw new ValidationError('Restaurant not found');
    }
    if (body.name !== undefined) doc.name = String(body.name || '').trim();
    if (body.description !== undefined) doc.description = String(body.description || '').trim();
    const targetFoodType = body.foodType !== undefined ? (body.foodType === 'Veg' ? 'Veg' : 'Non-Veg') : (doc.foodType === 'Veg' ? 'Veg' : 'Non-Veg');
    if (restaurant.pureVegRestaurant === true && targetFoodType !== 'Veg') {
        throw new ValidationError('Pure veg restaurants can only use veg foods');
    }
    const pricingUpdate = getAdminFoodUpdatedPricing(doc.toObject(), body);
    if (pricingUpdate.price !== undefined) doc.price = pricingUpdate.price;
    if (pricingUpdate.variants !== undefined) doc.variants = pricingUpdate.variants;
    if (body.image !== undefined) doc.image = String(body.image || '').trim();
    if (body.foodType !== undefined) doc.foodType = targetFoodType;
    if (body.isAvailable !== undefined) doc.isAvailable = body.isAvailable !== false;
    if (body.preparationTime !== undefined) doc.preparationTime = String(body.preparationTime || '').trim();
    if (body.categoryId !== undefined || body.categoryName !== undefined || body.category !== undefined || body.foodType !== undefined) {
        const nextCategoryName = body.categoryName !== undefined
            ? String(body.categoryName || '').trim()
            : (body.category !== undefined ? String(body.category || '').trim() : doc.categoryName);
        const { categoryId, categoryName } = await resolveAdminFoodCategory({
            categoryId: body.categoryId !== undefined ? body.categoryId : doc.categoryId,
            categoryName: nextCategoryName,
            foodType: targetFoodType,
            pureVegRestaurant: restaurant.pureVegRestaurant === true
        });
        doc.categoryId = categoryId;
        doc.categoryName = categoryName;
    }
    await doc.save();
    return doc.toObject();
}

export async function deleteFood(id) {
    if (!id || !mongoose.Types.ObjectId.isValid(id)) return null;
    const deleted = await FoodItem.findByIdAndDelete(id).lean();
    if (deleted && deleted.restaurantId && deleted.approvalStatus === 'approved') {
        try {
            const { FoodRestaurant } = await import('../../restaurant/models/restaurant.model.js');
            const updated = await FoodRestaurant.findByIdAndUpdate(
                deleted.restaurantId,
                { $inc: { productCount: -1 } },
                { new: true }
            );
            if (updated && updated.productCount <= 0) {
                updated.productCount = 0;
                updated.isListed = false;
                await updated.save();
            }
        } catch (err) {
            console.error('Failed to update restaurant product count on food deletion:', err);
        }
    }
    return deleted ? { id } : null;
}

/** Admin creates a restaurant (JSON body with image URLs already uploaded). Single API. */
export async function createRestaurantByAdmin(body, performer = null) {
    const validatePhonesOnly =
        body.validatePhonesOnly === true ||
        String(body.validatePhonesOnly || '').trim().toLowerCase() === 'true';

    if (validatePhonesOnly) {
        await validateRestaurantPhoneUniqueness({
            ownerPhone: body.ownerPhone,
            primaryContactNumber: body.primaryContactNumber || body.ownerPhone,
        });
        return { validated: true };
    }

    const loc = body.location || {};
    const toStr = (v) => (v != null && v !== undefined ? String(v).trim() : '');
    const toUrl = (v) => (v && (typeof v === 'string' ? v : v.url)) ? (typeof v === 'string' ? v : v.url) : undefined;
    const coordinates = Array.isArray(loc.coordinates) ? loc.coordinates : [];
    const lngFromCoordinates = toFiniteNumber(coordinates[0]);
    const latFromCoordinates = toFiniteNumber(coordinates[1]);
    const latitude = toFiniteNumber(loc.latitude ?? latFromCoordinates);
    const longitude = toFiniteNumber(loc.longitude ?? lngFromCoordinates);
    const menuUrls = Array.isArray(body.menuImages)
        ? body.menuImages.map((m) => toUrl(m)).filter(Boolean)
        : [];

    const normalizedOpeningTime = normalizeRestaurantTime(body.openingTime) || '09:00';
    const normalizedClosingTime = normalizeRestaurantTime(body.closingTime) || '22:00';
    validateOpeningClosingTimes(normalizedOpeningTime, normalizedClosingTime);

    // Normalize phone numbers and extract last 10 digits for duplicate check
    await validateRestaurantPhoneUniqueness({
        ownerPhone: body.ownerPhone,
        primaryContactNumber: body.primaryContactNumber || body.ownerPhone,
    });

    const ownerNormalized = normalizeRestaurantPhone(body.ownerPhone);
    const primaryNormalized = normalizeRestaurantPhone(body.primaryContactNumber || body.ownerPhone);

    const doc = {
        restaurantName: toStr(body.restaurantName) || toStr(body.name),
        ownerName: toStr(body.ownerName),
        ownerEmail: toStr(body.ownerEmail),
        ownerPhone: ownerNormalized.digits,
        ownerPhoneDigits: ownerNormalized.digits,
        ownerPhoneLast10: ownerNormalized.last10 || undefined,
        primaryContactNumber: primaryNormalized.digits,
        primaryContactNumberDigits: primaryNormalized.digits,
        primaryContactNumberLast10: primaryNormalized.last10 || undefined,
        pureVegRestaurant: body.pureVegRestaurant !== undefined
            ? parseBooleanLike(body.pureVegRestaurant, 'pureVegRestaurant')
            : false,
        addressLine1: toStr(loc.addressLine1),
        addressLine2: toStr(loc.addressLine2),
        area: toStr(loc.area),
        city: toStr(loc.city),
        state: toStr(loc.state),
        pincode: toStr(loc.pincode),
        landmark: toStr(loc.landmark),
        cuisines: Array.isArray(body.cuisines) ? body.cuisines : [],
        openingTime: normalizedOpeningTime,
        closingTime: normalizedClosingTime,
        openDays: Array.isArray(body.openDays) ? body.openDays : [],
        panNumber: toStr(body.panNumber),
        nameOnPan: toStr(body.nameOnPan),
        gstRegistered: Boolean(body.gstRegistered),
        gstNumber: toStr(body.gstNumber),
        gstLegalName: toStr(body.gstLegalName),
        gstAddress: toStr(body.gstAddress),
        fssaiNumber: toStr(body.fssaiNumber),
        fssaiExpiry: body.fssaiExpiry ? new Date(body.fssaiExpiry) : undefined,
        accountNumber: toStr(body.accountNumber),
        ifscCode: toStr(body.ifscCode),
        accountHolderName: toStr(body.accountHolderName),
        accountType: toStr(body.accountType),
        menuImages: menuUrls,
        profileImage: toUrl(body.profileImage),
        panImage: toUrl(body.panImage),
        gstImage: toUrl(body.gstImage),
        fssaiImage: toUrl(body.fssaiImage),
        estimatedDeliveryTime: toStr(body.estimatedDeliveryTime),
        featuredDish: toStr(body.featuredDish),
        featuredPrice: typeof body.featuredPrice === 'number' ? body.featuredPrice : (parseFloat(body.featuredPrice) || undefined),
        offer: toStr(body.offer),
        status: 'approved',
        approvedAt: new Date(),
        approvedBy: performer || undefined
    };

    if (body.zoneId !== undefined) {
        const zoneId = String(body.zoneId || '').trim();
        if (!zoneId) {
            doc.zoneId = undefined;
        } else if (!mongoose.Types.ObjectId.isValid(zoneId)) {
            throw new ValidationError('Invalid zoneId');
        } else {
            doc.zoneId = new mongoose.Types.ObjectId(zoneId);
        }
    }

    if (latitude !== null && longitude !== null) {
        doc.location = {
            type: 'Point',
            coordinates: [longitude, latitude],
            latitude,
            longitude,
            formattedAddress: toStr(loc.formattedAddress || loc.address || loc.addressLine1),
            address: toStr(loc.address || loc.formattedAddress || loc.addressLine1),
            addressLine1: toStr(loc.addressLine1 || loc.formattedAddress || loc.address),
            addressLine2: toStr(loc.addressLine2),
            area: toStr(loc.area),
            city: toStr(loc.city),
            state: toStr(loc.state),
            pincode: toStr(loc.pincode || loc.zipCode || loc.postalCode),
            landmark: toStr(loc.landmark),
        };
    }

    if (!doc.restaurantName || !doc.ownerName) {
        throw new ValidationError('Restaurant name and owner name are required');
    }
    if (!doc.ownerPhone && !doc.primaryContactNumber) {
        throw new ValidationError('Owner phone or primary contact number is required');
    }

    const restaurant = await FoodRestaurant.create(doc);

    await syncOutletTimingsFromOpenDays(
        restaurant._id,
        doc.openDays,
        doc.openingTime,
        doc.closingTime
    );

    return restaurant.toObject();
}

export async function approveRestaurant(id, performer = null) {
    if (!id || !mongoose.Types.ObjectId.isValid(id)) return null;

    // Opening-days re-approval on an already-approved restaurant: apply the staged
    // schedule only (do not re-run the fresh-join approval side effects such as
    // referral crediting or the "restaurant approved" notification).
    const existing = await FoodRestaurant.findById(id)
        .select('status pendingOpenDays pendingProfileChanges restaurantName')
        .lean();
    if (!existing) return null;
    const isOpenDaysReapproval = existing.status === 'approved' && existing.pendingOpenDays?.hasPendingUpdate;
    if (isOpenDaysReapproval) {
        await applyPendingOpenDaysUpdate(id);
        const updated = await FoodRestaurant.findById(id).lean();
        try {
            const { notifyOwnersSafely } = await import('../../../../core/notifications/firebase.service.js');
            await notifyOwnersSafely(
                [{ ownerType: 'RESTAURANT', ownerId: id }],
                {
                    title: 'Opening Days Updated ✅',
                    body: `Your updated opening days for "${existing.restaurantName}" have been approved and are now live.`,
                    data: {
                        type: 'restaurant_open_days_approved',
                        restaurantId: String(id)
                    }
                }
            );
        } catch (e) {
            console.error('Failed to send opening-days approval notification:', e);
        }
        invalidateDashboardStatsCache();
        return updated;
    }

    // Already-approved restaurant with staged outlet/bank/location/document changes:
    // apply proposed fields without demoting/re-running first-time approval flow.
    const isProfileReapproval =
        existing.status === 'approved' && existing.pendingProfileChanges?.hasPendingUpdate;
    if (isProfileReapproval) {
        const applyUpdate = buildApplyPendingProfileChangesUpdate(existing.pendingProfileChanges);
        applyUpdate.$set = {
            ...(applyUpdate.$set || {}),
            approvedBy: performer,
        };
        const updated = await FoodRestaurant.findByIdAndUpdate(id, applyUpdate, {
            new: true,
            runValidators: false,
        }).lean();
        try {
            const { notifyOwnersSafely } = await import('../../../../core/notifications/firebase.service.js');
            await notifyOwnersSafely(
                [{ ownerType: 'RESTAURANT', ownerId: id }],
                {
                    title: 'Outlet Update Approved ✅',
                    body: `Your requested outlet changes for "${existing.restaurantName}" are now live for customers.`,
                    data: {
                        type: 'restaurant_profile_changes_approved',
                        restaurantId: String(id),
                    },
                }
            );
        } catch (e) {
            console.error('Failed to send profile-changes approval notification:', e);
        }
        invalidateDashboardStatsCache();
        return updated;
    }

    const updated = await FoodRestaurant.findByIdAndUpdate(
        id,
        {
            $set: {
                status: 'approved',
                isActive: true,
                wasEverApproved: true,
                approvedAt: new Date(),
                rejectedAt: undefined,
                rejectionReason: undefined,
                approvedBy: performer
            },
            $unset: { reVerification: "", pendingProfileChanges: "" }
        },
        { new: true, runValidators: false }
    ).lean();

    if (updated) {
        // --- Referral Reward Crediting ---
        // Re-validate platform settings at payout, then claim + credit + count
        // in one transaction (no double-pay; disabled/zeroed programs cannot pay).
        try {
            const session = await mongoose.startSession();
            try {
                await session.withTransaction(async () => {
                    const pending = await FoodReferralLog.findOne({
                        refereeId: updated._id,
                        role: 'RESTAURANT',
                        status: 'pending'
                    }).session(session);
                    if (!pending) return;

                    const settingsDoc = await FoodReferralSettings.findOne({ isActive: true })
                        .sort({ createdAt: -1 })
                        .session(session)
                        .lean();

                    const referrerReward = Math.max(0, Number(settingsDoc?.restaurant?.referrerReward) || 0);
                    const refereeReward = Math.max(0, Number(settingsDoc?.restaurant?.refereeReward) || 0);
                    const limit = Math.max(0, Number(settingsDoc?.restaurant?.limit) || 0);

                    const referrer = await FoodRestaurant.findById(pending.referrerId)
                        .select('_id status')
                        .session(session)
                        .lean();

                    let rejectReason = null;
                    if (!settingsDoc) rejectReason = 'program_inactive';
                    else if (!referrer) rejectReason = 'referrer_not_found';
                    else if (referrer.status !== 'approved') rejectReason = 'referrer_not_approved';
                    else if (referrerReward <= 0 && refereeReward <= 0) rejectReason = 'reward_disabled';
                    else if (limit <= 0) rejectReason = 'limit_disabled';

                    if (rejectReason) {
                        await FoodReferralLog.updateOne(
                            { _id: pending._id, status: 'pending' },
                            { $set: { status: 'rejected', reason: rejectReason } },
                            { session }
                        );
                        return;
                    }

                    // Atomic hard gate: only credit if referrer is still approved and has slots.
                    const slotReserved = await FoodRestaurant.findOneAndUpdate(
                        {
                            _id: pending.referrerId,
                            status: 'approved',
                            referralCount: { $lt: limit }
                        },
                        { $inc: { referralCount: 1 } },
                        { new: true, session }
                    );
                    if (!slotReserved) {
                        await FoodReferralLog.updateOne(
                            { _id: pending._id, status: 'pending' },
                            { $set: { status: 'rejected', reason: 'limit_reached' } },
                            { session }
                        );
                        return;
                    }

                    // Claim with current settings amounts (not signup-time freeze).
                    const claimed = await FoodReferralLog.findOneAndUpdate(
                        { _id: pending._id, status: 'pending' },
                        {
                            $set: {
                                status: 'credited',
                                rewardAmount: referrerReward,
                                referrerRewardAmount: referrerReward,
                                refereeRewardAmount: refereeReward
                            }
                        },
                        { new: true, session }
                    );
                    if (!claimed) {
                        // Lost the race — release the reserved slot.
                        await FoodRestaurant.updateOne(
                            { _id: pending.referrerId },
                            { $inc: { referralCount: -1 } },
                            { session }
                        );
                        return;
                    }

                    if (referrerReward > 0) {
                        await FoodRestaurantWallet.findOneAndUpdate(
                            { restaurantId: claimed.referrerId },
                            {
                                $inc: {
                                    balance: referrerReward,
                                    totalEarnings: referrerReward,
                                    referralEarnings: referrerReward
                                }
                            },
                            { upsert: true, session }
                        );
                    }

                    if (refereeReward > 0) {
                        await FoodRestaurantWallet.findOneAndUpdate(
                            { restaurantId: updated._id },
                            {
                                $inc: {
                                    balance: refereeReward,
                                    totalEarnings: refereeReward,
                                    referralEarnings: refereeReward
                                }
                            },
                            { upsert: true, session }
                        );
                    }
                });
            } finally {
                await session.endSession();
            }
        } catch (e) {
            console.error('Referral crediting failed on approval:', e);
        }
        // --- End Referral Reward Crediting ---

        try {
            const { notifyOwnersSafely } = await import('../../../../core/notifications/firebase.service.js');
            await notifyOwnersSafely(
                [{ ownerType: 'RESTAURANT', ownerId: updated._id }],
                {
                    title: 'Congratulations! 🎉',
                    body: `Your restaurant "${updated.restaurantName}" has been approved. You can now start receiving orders!`,
                    image: updated.profileImage || 'https://i.ibb.co/3m2Yh7r/Appzeto-Brand-Image.png',
                    data: {
                        type: 'restaurant_approved',
                        restaurantId: String(updated._id)
                    }
                }
            );
        } catch (e) {
            console.error('Failed to send restaurant approval notification:', e);
        }
    }
    if (updated) invalidateDashboardStatsCache();
    return updated;
}

export async function rejectRestaurant(id, reason, performer = null) {
    if (!id || !mongoose.Types.ObjectId.isValid(id)) return null;

    // Opening-days re-approval on an already-approved restaurant: rejecting simply
    // discards the staged change. The restaurant stays approved & online with its
    // current live schedule (never demoted to "rejected").
    const existing = await FoodRestaurant.findById(id)
        .select('status pendingOpenDays pendingProfileChanges restaurantName')
        .lean();
    if (!existing) return null;
    const isOpenDaysReapproval = existing.status === 'approved' && existing.pendingOpenDays?.hasPendingUpdate;
    if (isOpenDaysReapproval) {
        await discardPendingOpenDaysUpdate(id);
        const updated = await FoodRestaurant.findById(id).lean();
        try {
            const { notifyOwnersSafely } = await import('../../../../core/notifications/firebase.service.js');
            await notifyOwnersSafely(
                [{ ownerType: 'RESTAURANT', ownerId: id }],
                {
                    title: 'Opening Days Update Rejected 📋',
                    body: `Your requested opening-days change for "${existing.restaurantName}" was rejected${reason ? `. Reason: ${reason}` : ''}. Your current schedule remains active.`,
                    data: {
                        type: 'restaurant_open_days_rejected',
                        restaurantId: String(id),
                        reason: reason || ''
                    }
                }
            );
        } catch (e) {
            console.error('Failed to send opening-days rejection notification:', e);
        }
        invalidateDashboardStatsCache();
        return updated;
    }

    // Already-approved restaurant profile re-review: discard staged proposed fields only.
    // Live outlet details stay as-is and restaurant remains approved/visible.
    const isProfileReapproval =
        existing.status === 'approved' && existing.pendingProfileChanges?.hasPendingUpdate;
    if (isProfileReapproval) {
        const discardUpdate = buildDiscardPendingProfileChangesUpdate();
        const updated = await FoodRestaurant.findByIdAndUpdate(
            id,
            {
                $unset: discardUpdate.$unset,
                $set: {
                    rejectedBy: performer,
                },
            },
            { new: true, runValidators: false }
        ).lean();
        try {
            const { notifyOwnersSafely } = await import('../../../../core/notifications/firebase.service.js');
            await notifyOwnersSafely(
                [{ ownerType: 'RESTAURANT', ownerId: id }],
                {
                    title: 'Outlet Update Rejected 📋',
                    body: `Your requested outlet changes for "${existing.restaurantName}" were rejected${reason ? `. Reason: ${reason}` : ''}. Customers continue to see your current approved details.`,
                    data: {
                        type: 'restaurant_profile_changes_rejected',
                        restaurantId: String(id),
                        reason: reason || '',
                    },
                }
            );
        } catch (e) {
            console.error('Failed to send profile-changes rejection notification:', e);
        }
        invalidateDashboardStatsCache();
        return updated;
    }

    const updated = await FoodRestaurant.findByIdAndUpdate(
        id,
        {
            $set: {
                status: 'rejected',
                rejectedAt: new Date(),
                rejectionReason: typeof reason === 'string' ? reason.trim() : undefined,
                approvedAt: null,
                rejectedBy: performer
            }
        },
        { new: true, runValidators: false }
    ).lean();

    if (updated) {
        try {
            const { notifyOwnersSafely } = await import('../../../../core/notifications/firebase.service.js');
            await notifyOwnersSafely(
                [{ ownerType: 'RESTAURANT', ownerId: updated._id }],
                {
                    title: 'Update on Registration 📋',
                    body: `Your restaurant registration for "${updated.restaurantName}" has been rejected. Reason: ${reason || 'Incomplete documents'}.`,
                    image: 'https://i.ibb.co/3m2Yh7r/Appzeto-Brand-Image.png',
                    data: {
                        type: 'restaurant_rejected',
                        restaurantId: String(updated._id),
                        reason: reason || ''
                    }
                }
            );
        } catch (e) {
            console.error('Failed to send restaurant rejection notification:', e);
        }
    }
    if (updated) invalidateDashboardStatsCache();
    return updated;
}

// ----- Offers & Coupons -----
export async function getAllOffers(_query = {}) {
    const list = await FoodOffer.find({})
        .sort({ createdAt: -1 })
        .populate({ path: 'restaurantId', select: 'restaurantName' })
        .lean();

    const offers = list.map((o, index) => {
        const now = Date.now();
        const startTs = o.startDate ? new Date(o.startDate).getTime() : null;

        const isScheduled = Boolean(startTs && now < startTs);
        const isExpired = isOfferEndDateExpired(o.endDate);

        const restaurantName =
            o.restaurantScope === 'selected'
                ? (o.restaurantId?.restaurantName || 'Selected Restaurant')
                : 'All Restaurants';

        const discountPercentage = o.discountType === 'percentage' ? Number(o.discountValue) : 0;
        const originalPrice = o.discountType === 'flat-price' ? Number(o.discountValue) : 0;
        const discountedPrice = 0;

        let status = isExpired ? 'inactive' : (o.status || 'active');
        if (status === 'active' && isScheduled) {
            status = 'scheduled';
        }

        return {
            sl: index + 1,
            offerId: String(o._id),
            dishId: 'all',
            restaurantName,
            dishName: 'All Items',
            couponCode: o.couponCode,
            customerGroup: o.customerScope === 'first-time' ? 'new' : 'all',
            customerScope: o.customerScope || 'all',
            discountType: o.discountType,
            discountValue: Number(o.discountValue) || 0,
            discountPercentage,
            originalPrice,
            discountedPrice,
            status,
            showInCart: o.showInCart !== false,
            startDate: o.startDate || null,
            endDate: o.endDate || null,
            minOrderValue: o.minOrderValue ?? 0,
            maxDiscount: o.maxDiscount ?? null,
            usageLimit: o.usageLimit ?? null,
            perUserLimit: o.perUserLimit ?? null,
            usedCount: o.usedCount ?? 0,
            isFirstOrderOnly: Boolean(o.isFirstOrderOnly),
            restaurantScope: o.restaurantScope,
            restaurantDbId: o.restaurantId
                ? String(o.restaurantId?._id || o.restaurantId)
                : null,
            createdByRole: o.createdByRole || 'ADMIN',
        };
    });

    return { offers };
}

export async function createAdminOffer(body) {
    await assertUniquePlatformCouponCode(body.couponCode);

    const doc = await FoodOffer.create({
        couponCode: body.couponCode,
        discountType: body.discountType,
        discountValue: body.discountValue,
        customerScope: body.customerScope,
        restaurantScope: body.restaurantScope,
        restaurantId: body.restaurantScope === 'selected' ? body.restaurantId : undefined,
        minOrderValue: body.minOrderValue ?? 0,
        maxDiscount: body.maxDiscount ?? null,
        usageLimit: body.usageLimit ?? null,
        perUserLimit: body.perUserLimit ?? null,
        startDate: body.startDate,
        isFirstOrderOnly: body.isFirstOrderOnly ?? false,
        endDate: body.endDate,
        status: body.endDate && new Date(body.endDate).getTime() <= Date.now() ? 'inactive' : 'active',
        showInCart: true,
        createdByRole: 'ADMIN',
        adminBearPercentage: 100,
        restaurantBearPercentage: 0
    });

    try {
        await claimCouponCodeReservation({
            ownerType: COUPON_OWNER_TYPES.PLATFORM_OFFER,
            ownerId: doc._id,
            couponCode: doc.couponCode,
        });
    } catch (error) {
        await FoodOffer.findByIdAndDelete(doc._id);
        if (error?.code === 11000) {
            throw new ValidationError('Coupon code already exists');
        }
        throw error;
    }

    if (doc.restaurantScope === 'selected' && doc.restaurantId) {
        try {
            const { notifyOwnersSafely } = await import('../../../../core/notifications/firebase.service.js');
            await notifyOwnersSafely(
                [{ ownerType: 'RESTAURANT', ownerId: doc.restaurantId }],
                {
                    title: 'New Campaign Invitation! 📢',
                    body: `You have been invited to join a new campaign: "${doc.couponCode}". Check it out now!`,
                    image: 'https://i.ibb.co/3m2Yh7r/Appzeto-Brand-Image.png',
                    data: {
                        type: 'campaign_invitation',
                        offerId: String(doc._id),
                        couponCode: doc.couponCode
                    }
                }
            );
        } catch (e) {
            console.error('Failed to send campaign invitation notification:', e);
        }
    }

    return doc.toObject();
}

async function invalidateOffersCacheSafely(context) {
    try {
        const { invalidateCache } = await import('../../../../middleware/cache.js');
        await invalidateCache('offers*');
    } catch (err) {
        console.error(`Failed to invalidate offers cache on ${context}:`, err);
    }
}

async function assertUniquePlatformCouponCode(couponCode, excludeId = null) {
    const normalizedCode = String(couponCode || '').trim().toUpperCase();
    if (!normalizedCode) {
        throw new ValidationError('Coupon code is required');
    }

    const duplicateOfferFilter = { couponCode: normalizedCode };
    if (excludeId) {
        duplicateOfferFilter._id = { $ne: new mongoose.Types.ObjectId(String(excludeId)) };
    }

    const { RestaurantCoupon } = await import('../models/restaurantCoupon.model.js');
    const [offerExists, restaurantCouponExists] = await Promise.all([
        FoodOffer.findOne(duplicateOfferFilter).select('_id').lean(),
        RestaurantCoupon.findOne({ couponCode: normalizedCode }).select('_id').lean(),
    ]);

    if (offerExists || restaurantCouponExists) {
        throw new ValidationError('Coupon code already exists');
    }
}

/** End-of-day semantics: an offer is only expired once its endDate is before today. */
function isOfferEndDateExpired(endDate, now = new Date()) {
    if (!endDate) return false;
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    return new Date(endDate) < startOfToday;
}

export async function updateAdminOffer(id, body) {
    if (!id || !mongoose.Types.ObjectId.isValid(id)) return null;

    const existing = await FoodOffer.findById(id).lean();
    if (!existing) return null;
    const restoreOfferState = {
        couponCode: existing.couponCode,
        discountType: existing.discountType,
        discountValue: existing.discountValue,
        customerScope: existing.customerScope,
        restaurantScope: existing.restaurantScope,
        restaurantId: existing.restaurantId ?? null,
        minOrderValue: existing.minOrderValue ?? 0,
        maxDiscount: existing.maxDiscount ?? null,
        usageLimit: existing.usageLimit ?? null,
        perUserLimit: existing.perUserLimit ?? null,
        startDate: existing.startDate ?? null,
        endDate: existing.endDate ?? null,
        isFirstOrderOnly: Boolean(existing.isFirstOrderOnly),
        status: existing.status,
    };

    if (body.couponCode && body.couponCode !== existing.couponCode) {
        await assertUniquePlatformCouponCode(body.couponCode, existing._id);
    }

    // Preserve the existing lifecycle state unless the new end date forces inactivity.
    let status = existing.status;
    if (isOfferEndDateExpired(body.endDate)) {
        status = 'inactive';
    }

    const updated = await FoodOffer.findByIdAndUpdate(
        id,
        {
            $set: {
                couponCode: body.couponCode,
                discountType: body.discountType,
                discountValue: body.discountValue,
                customerScope: body.customerScope,
                restaurantScope: body.restaurantScope,
                restaurantId: body.restaurantScope === 'selected' ? body.restaurantId : null,
                minOrderValue: body.minOrderValue ?? 0,
                maxDiscount: body.maxDiscount ?? null,
                usageLimit: body.usageLimit ?? null,
                perUserLimit: body.perUserLimit ?? null,
                startDate: body.startDate ?? null,
                endDate: body.endDate ?? null,
                isFirstOrderOnly: body.isFirstOrderOnly ?? false,
                status,
            },
        },
        { new: true }
    ).lean();

    try {
        await claimCouponCodeReservation({
            ownerType: COUPON_OWNER_TYPES.PLATFORM_OFFER,
            ownerId: existing._id,
            couponCode: body.couponCode,
        });
    } catch (error) {
        await FoodOffer.findByIdAndUpdate(
            id,
            { $set: restoreOfferState },
            { new: true }
        );
        if (error?.code === 11000) {
            throw new ValidationError('Coupon code already exists');
        }
        throw error;
    }

    await invalidateOffersCacheSafely('offer update');
    return updated;
}

export async function updateAdminOfferStatus(id, status) {
    if (!id || !mongoose.Types.ObjectId.isValid(id)) return null;
    if (!['active', 'paused', 'inactive'].includes(status)) {
        throw new ValidationError('Status must be active, paused or inactive');
    }

    const existing = await FoodOffer.findById(id).lean();
    if (!existing) return null;

    if (status === 'active' && isOfferEndDateExpired(existing.endDate)) {
        throw new ValidationError('Cannot activate an expired offer. Extend the end date first.');
    }

    const updated = await FoodOffer.findByIdAndUpdate(
        id,
        { $set: { status } },
        { new: true }
    ).lean();

    await invalidateOffersCacheSafely('offer status update');
    return updated;
}

export async function updateAdminOfferCartVisibility(offerId, itemId, showInCart) {
    if (!offerId || !mongoose.Types.ObjectId.isValid(offerId)) return null;
    if (!itemId) return null;
    const updated = await FoodOffer.findByIdAndUpdate(
        offerId,
        { $set: { showInCart: Boolean(showInCart) } },
        { new: true }
    ).lean();
    return updated;
}

export async function deleteAdminOffer(id) {
    if (!id || !mongoose.Types.ObjectId.isValid(id)) return null;
    const deleted = await FoodOffer.findByIdAndDelete(id).lean();
    if (!deleted) return null;
    await FoodOfferUsage.deleteMany({ offerId: new mongoose.Types.ObjectId(id) });
    await releaseCouponCodeReservation({
        ownerType: COUPON_OWNER_TYPES.PLATFORM_OFFER,
        ownerId: id,
    });
    await invalidateOffersCacheSafely('offer delete');
    return { id };
}

export async function expireExpiredOffers() {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    await FoodOffer.updateMany(
        { status: 'active', endDate: { $lt: startOfToday } },
        { $set: { status: 'inactive' } }
    );
}
// ----- Delivery join requests -----
export async function getDeliveryJoinRequests(query) {
    const { status = 'pending', page = 1, limit = 1000, search, zone, vehicleType } = query;
    const filter = {};
    const requestedStatus = String(status || 'pending').trim().toLowerCase();

    if (requestedStatus === 'pending') filter.status = 'pending';
    else if (requestedStatus === 'denied' || requestedStatus === 'rejected') filter.status = 'rejected';
    else if (requestedStatus === 'approved') filter.status = 'approved';
    else if (requestedStatus === 'reapplied') filter.status = 'pending';
    else if (requestedStatus === 'all') {
        /* no status filter */
    } else filter.status = requestedStatus;

    const andParts = [];
    if (search && typeof search === 'string' && search.trim()) {
        const term = search.trim();
        andParts.push({
            $or: [
                { name: { $regex: term, $options: 'i' } },
                { phone: { $regex: term, $options: 'i' } },
                { email: { $regex: term, $options: 'i' } }
            ]
        });
    }

    if (andParts.length) filter.$and = andParts;
    if (vehicleType && vehicleType.trim()) {
        // Prefer driverVehicles (source of truth); keep legacy vehicleType for older docs.
        const term = vehicleType.trim();
        const vehicleMatch = {
            $or: [
                { vehicleType: { $regex: term, $options: 'i' } },
                { vehicleName: { $regex: term, $options: 'i' } },
                { 'driverVehicles.vehicleCode': { $regex: term, $options: 'i' } },
                { 'driverVehicles.vehicleName': { $regex: term, $options: 'i' } }
            ]
        };
        if (filter.$and) filter.$and.push(vehicleMatch);
        else filter.$and = [vehicleMatch];
    }

    const skip = Math.max(0, (Number(page) || 1) - 1) * Math.max(1, Math.min(1000, Number(limit) || 100));
    const limitNum = Math.max(1, Math.min(1000, Number(limit) || 100));

    const list = await FoodDeliveryPartner.find(filter)
        .sort({ updatedAt: -1, createdAt: -1 })
        .lean();

    const { FoodDeliveryPartnerSubmission } = await import(
        '../../delivery/models/deliveryPartnerSubmission.model.js'
    );

    const partnerIds = list.map((doc) => doc._id);
    const latestSubs = partnerIds.length
        ? await FoodDeliveryPartnerSubmission.find({
            partnerId: { $in: partnerIds }
        })
            .sort({ submissionNumber: -1 })
            .lean()
        : [];

    const latestByPartner = new Map();
    const rejectedPrior = new Set();
    for (const sub of latestSubs) {
        const key = String(sub.partnerId);
        if (!latestByPartner.has(key)) {
            latestByPartner.set(key, sub);
        }
        if (sub.status === 'rejected') {
            rejectedPrior.add(key);
        }
    }

    const zones = await FoodZone.find({ isActive: true }).lean();

    let requests = list.map((doc) => {
        const detectedZone = detectZoneFromPartner(doc, zones);
        const key = String(doc._id);
        const latest = latestByPartner.get(key);
        const isReapplied =
            doc.status === 'pending' &&
            (rejectedPrior.has(key) || Number(doc.currentSubmissionNumber || 0) > 1);

        return {
            ...doc,
            detectedZoneName: detectedZone || doc.city || doc.state || 'N/A',
            isReapplied,
            submissionType: latest?.submissionType || (doc.currentSubmissionNumber > 1 ? 'edit_existing' : 'initial'),
            submissionNumber: latest?.submissionNumber || doc.currentSubmissionNumber || 1,
            latestSubmissionId: doc.latestSubmissionId || latest?._id || null
        };
    });

    if (requestedStatus === 'pending') {
        requests = requests.filter((r) => !r.isReapplied);
    }
    if (requestedStatus === 'reapplied') {
        requests = requests.filter((r) => r.isReapplied);
    }

    if (zone && zone.trim()) {
        const zTerm = zone.trim().toLowerCase();
        requests = requests.filter((r) => r.detectedZoneName.toLowerCase().includes(zTerm));
    }

    const totalCount = requests.length;
    const resolveListVehicleType = (doc) => {
        if (doc.vehicleType) return doc.vehicleType;
        const vehicles = Array.isArray(doc.driverVehicles) ? doc.driverVehicles : [];
        if (!vehicles.length) return '';
        const activeId = doc.activeVehicleId ? String(doc.activeVehicleId) : null;
        const active =
            (activeId &&
                vehicles.find((v) => String(v?.id || v?._id || '') === activeId)) ||
            vehicles.find((v) => v?.isDefault) ||
            vehicles[0];
        return active?.vehicleCode || active?.vehicleName || '';
    };
    const paginatedRequests = requests.slice(skip, skip + limitNum).map((doc, index) => ({
        _id: doc._id,
        sl: skip + index + 1,
        name: doc.name || '',
        email: doc.email || '',
        phone: doc.phone || '',
        city: doc.city || '',
        zone: doc.detectedZoneName,
        vehicleType: resolveListVehicleType(doc),
        driverVehicles: doc.driverVehicles || [],
        status: doc.status === 'rejected' ? 'denied' : doc.status,
        isReapplied: Boolean(doc.isReapplied),
        submissionType: doc.submissionType,
        submissionNumber: doc.submissionNumber,
        rejectionReason: doc.rejectionReason || undefined,
        rejectedAt: doc.rejectedAt || undefined,
        approvedAt: doc.approvedAt || undefined,
        profilePhoto: doc.profilePhoto || null,
        profileImage: doc.profilePhoto ? { url: doc.profilePhoto } : null,
        updatedAt: doc.updatedAt,
        createdAt: doc.createdAt
    }));

    return { requests: paginatedRequests, total: totalCount };
}

export async function getDeliveryPartnerSubmissions(partnerId) {
    if (!partnerId || !mongoose.Types.ObjectId.isValid(String(partnerId))) {
        return null;
    }
    const partner = await FoodDeliveryPartner.findById(partnerId)
        .select('_id name phone status latestSubmissionId currentSubmissionNumber rejectionReason rejectedAt approvedAt')
        .lean();
    if (!partner) return null;

    const { listPartnerSubmissions, ensureLegacySubmission } = await import(
        '../../delivery/services/deliveryPartnerSubmission.service.js'
    );

    // Ensure at least one submission exists for legacy partners when admin opens history.
    const partnerDoc = await FoodDeliveryPartner.findById(partnerId);
    if (partnerDoc) {
        await ensureLegacySubmission(partnerDoc);
    }

    const submissions = await listPartnerSubmissions(partnerId);
    const timeline = submissions.map((sub) => ({
        submissionId: sub._id,
        submissionNumber: sub.submissionNumber,
        status: sub.status,
        submissionType: sub.submissionType,
        submittedAt: sub.submittedAt,
        reviewedAt: sub.reviewedAt,
        rejectionReason: sub.rejectionReason || null,
        approvedBy: sub.approvedBy || null,
        rejectedBy: sub.rejectedBy || null,
        previousSubmissionId: sub.previousSubmissionId || null,
        snapshotSummary: {
            name: sub.snapshot?.name || '',
            phone: sub.snapshot?.phone || '',
            vehicleCount: Array.isArray(sub.snapshot?.driverVehicles)
                ? sub.snapshot.driverVehicles.length
                : 0
        }
    }));

    return {
        partner: {
            _id: partner._id,
            name: partner.name,
            phone: partner.phone,
            status: partner.status,
            latestSubmissionId: partner.latestSubmissionId,
            currentSubmissionNumber: partner.currentSubmissionNumber
        },
        timeline,
        submissions: timeline
    };
}

export function getDeliveryWalletsStub() {
    return {
        wallets: [],
        pagination: { page: 1, limit: 100, total: 0, pages: 0 }
    };
}

// ----- Support tickets -----
export async function getSupportTicketStats() {
    const [open, inProgress, resolved, closed] = await Promise.all([
        DeliverySupportTicket.countDocuments({ status: 'open' }),
        DeliverySupportTicket.countDocuments({ status: 'in_progress' }),
        DeliverySupportTicket.countDocuments({ status: 'resolved' }),
        DeliverySupportTicket.countDocuments({ status: 'closed' })
    ]);
    return {
        total: open + inProgress + resolved + closed,
        open,
        inProgress,
        resolved,
        closed
    };
}

export async function getDeliverySupportTickets(query = {}) {
    const { status, priority, search, page = 1, limit = 100 } = query;
    const filter = {};
    if (status && String(status).trim()) filter.status = String(status).trim();
    if (priority && String(priority).trim()) filter.priority = String(priority).trim();
    if (search && typeof search === 'string' && search.trim()) {
        const term = search.trim();
        filter.$or = [
            { subject: { $regex: term, $options: 'i' } },
            { description: { $regex: term, $options: 'i' } },
            { ticketId: { $regex: term, $options: 'i' } }
        ];
    }

    const skip = Math.max(0, (Number(page) || 1) - 1) * Math.max(1, Math.min(500, Number(limit) || 100));
    const limitNum = Math.max(1, Math.min(500, Number(limit) || 100));

    const [list, total] = await Promise.all([
        DeliverySupportTicket.find(filter)
            .populate('deliveryPartnerId', 'name phone email')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum)
            .lean(),
        DeliverySupportTicket.countDocuments(filter)
    ]);

    const tickets = list.map((t) => ({
        _id: t._id,
        ticketId: t.ticketId,
        subject: t.subject,
        description: t.description,
        category: t.category,
        priority: t.priority,
        status: t.status,
        adminResponse: t.adminResponse,
        respondedAt: t.respondedAt,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        deliveryPartner: t.deliveryPartnerId
            ? {
                _id: t.deliveryPartnerId._id,
                name: t.deliveryPartnerId.name || '',
                phone: t.deliveryPartnerId.phone || '',
                email: t.deliveryPartnerId.email || ''
            }
            : null
    }));

    return {
        tickets,
        pagination: {
            page: Number(page) || 1,
            limit: limitNum,
            total,
            pages: Math.ceil(total / limitNum) || 1
        }
    };
}

export async function updateDeliverySupportTicket(id, body = {}) {
    const ticket = await DeliverySupportTicket.findById(id);
    if (!ticket) return null;
    const { status, adminResponse } = body || {};
    if (status !== undefined) {
        const allowed = ['open', 'in_progress', 'resolved', 'closed'];
        if (allowed.includes(String(status))) ticket.status = String(status);
    }
    if (adminResponse !== undefined) {
        ticket.adminResponse = typeof adminResponse === 'string' ? adminResponse.trim() : '';
        if (ticket.adminResponse) ticket.respondedAt = new Date();
    }
    await ticket.save();
    return ticket.toObject();
}

// ----- Delivery partners (approved list) -----
export async function getDeliveryPartners(query) {
    const { page = 1, limit = 1000, search } = query;
    const filter = { status: 'approved' };
    if (search && typeof search === 'string' && search.trim()) {
        const term = search.trim();
        filter.$or = [
            { name: { $regex: term, $options: 'i' } },
            { phone: { $regex: term, $options: 'i' } },
            { email: { $regex: term, $options: 'i' } },
            { city: { $regex: term, $options: 'i' } },
            { state: { $regex: term, $options: 'i' } }
        ];
    }

    const skip = Math.max(0, (Number(page) || 1) - 1) * Math.max(1, Math.min(1000, Number(limit) || 100));
    const limitNum = Math.max(1, Math.min(1000, Number(limit) || 100));

    const [list, total] = await Promise.all([
        FoodDeliveryPartner.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum)
            .lean(),
        FoodDeliveryPartner.countDocuments(filter)
    ]);

    const partnerIds = list.map(p => p._id);
    const orderCountsAgg = await FoodOrder.aggregate([
        {
            $match: {
                'dispatch.deliveryPartnerId': { $in: partnerIds },
                orderStatus: 'delivered',
                orderType: 'food'
            }
        },
        { $group: { _id: '$dispatch.deliveryPartnerId', totalOrders: { $sum: 1 } } }
    ]);

    const countsMap = new Map(orderCountsAgg.map(item => [item._id.toString(), item.totalOrders]));

    // Fetch zones for detection
    const zones = await FoodZone.find({ isActive: true }).lean();

    const deliveryPartners = list.map((doc, index) => {
        const detectedZone = detectZoneFromPartner(doc, zones);
        return {
            _id: doc._id,
            sl: skip + index + 1,
            name: doc.name || '',
            email: doc.email || '',
            phone: doc.phone || '',
            city: doc.city || '',
            deliveryId: doc._id ? `DP-${doc._id.toString().slice(-8).toUpperCase()}` : null,
            zone: detectedZone || doc.city || doc.state || doc.address || 'N/A',
            vehicleType: doc.vehicleType || '',
            status: doc.status,
            isActive: doc.isActive !== false,
            profilePhoto: doc.profilePhoto || null,
            profileImage: doc.profilePhoto ? { url: doc.profilePhoto } : null,
            totalOrders: countsMap.get(doc._id.toString()) || 0
        };
    });

    return {
        deliveryPartners,
        pagination: {
            page: Number(page) || 1,
            limit: limitNum,
            total,
            pages: Math.ceil(total / limitNum) || 1
        }
    };
}

// ----- Delivery partner bonus (admin) -----
function generateBonusTransactionId() {
    const n = Date.now().toString(36).slice(-6).toUpperCase();
    const r = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `BON-${n}${r}`;
}

function buildDeliveryIdStr(partnerId) {
    if (!partnerId) return null;
    return `DP-${String(partnerId).slice(-8).toUpperCase()}`;
}

function mapBonusTransactionRow(t, sl) {
    const partner = t.deliveryPartnerId && typeof t.deliveryPartnerId === 'object' ? t.deliveryPartnerId : null;
    const partnerId = partner?._id
        ? String(partner._id)
        : t.deliveryPartnerId
            ? String(t.deliveryPartnerId)
            : null;
    const admin = t.createdByAdminId && typeof t.createdByAdminId === 'object' ? t.createdByAdminId : null;

    return {
        sl,
        transactionId: t.transactionId,
        deliveryId: t.deliveryIdStr || (partnerId ? buildDeliveryIdStr(partnerId) : null),
        deliveryPartner: t.deliveryPartnerName || partner?.name || '',
        amount: t.amount,
        reference: t.reference || null,
        previousBalance: t.previousBalance ?? 0,
        updatedBalance: t.updatedBalance ?? 0,
        createdBy: t.createdByName || admin?.name || 'Admin',
        createdAt: t.createdAt
    };
}

async function buildBonusTransactionResponse(
    createdTransaction,
    partner,
    previousWalletBalance,
    updatedWalletBalance,
    meta = {}
) {
    const partnerIdStr = String(partner._id);
    const deliveryId = buildDeliveryIdStr(partnerIdStr);
    const transactionObj =
        typeof createdTransaction.toObject === 'function'
            ? createdTransaction.toObject()
            : createdTransaction;

    return {
        transaction: {
            transactionId: transactionObj.transactionId,
            amount: transactionObj.amount,
            reference: transactionObj.reference,
            previousBalance: transactionObj.previousBalance,
            updatedBalance: transactionObj.updatedBalance,
            createdAt: transactionObj.createdAt
        },
        deliveryPartner: {
            id: partnerIdStr,
            deliveryId,
            name: partner.name
        },
        previousWalletBalance,
        updatedWalletBalance,
        idempotentReplay: Boolean(meta.idempotentReplay)
    };
}

function isDuplicateKeyError(error) {
    if (!error) return false;
    if (error.code === 11000 || error.code === 11001) return true;
    const msg = String(error.message || error.errmsg || '');
    if (/E11000|duplicate key/i.test(msg)) return true;
    if (Array.isArray(error.writeErrors) && error.writeErrors.some((e) => e?.code === 11000)) {
        return true;
    }
    if (error.cause) return isDuplicateKeyError(error.cause);
    return false;
}

async function assertIdempotencyRequestHashMatch(storedHash, incomingHash, claimFields = null) {
    let expected = storedHash;
    if (!expected && claimFields) {
        expected = buildBonusRequestHash({
            deliveryPartnerId: claimFields.deliveryPartnerId,
            amount: claimFields.amount,
            reference: claimFields.reference
        });
    }
    if (!expected || expected !== incomingHash) {
        throw new ConflictError(
            'Idempotency key already used with different request payload.'
        );
    }
}

async function loadIdempotentBonusResponse(idempotencyKey, requestHash) {
    const claim = await DeliveryBonusIdempotency.findOne({ key: idempotencyKey }).lean();
    if (!claim || String(claim.transactionId || '').startsWith('PENDING')) return null;

    await assertIdempotencyRequestHashMatch(claim.requestHash, requestHash, claim);

    const partner =
        (await FoodDeliveryPartner.findById(claim.deliveryPartnerId).select('_id name').lean()) || {
            _id: claim.deliveryPartnerId,
            name: claim.deliveryPartnerName
        };

    return buildBonusTransactionResponse(
        {
            transactionId: claim.transactionId,
            amount: claim.amount,
            reference: claim.reference,
            previousBalance: claim.previousBalance,
            updatedBalance: claim.updatedBalance,
            createdAt: claim.createdAt
        },
        partner,
        claim.previousBalance,
        claim.updatedBalance,
        { idempotentReplay: true }
    );
}

export async function getDeliveryPartnerBonusTransactions(query = {}) {
    const page = Math.max(1, Number(query.page) || 1);
    let limitRaw = query.limit != null ? Number(query.limit) : 20;
    if (!Number.isFinite(limitRaw) || limitRaw < 1) limitRaw = 20;
    if (limitRaw > 100) {
        throw new ValidationError('limit cannot exceed 100');
    }
    const limitNum = Math.floor(limitRaw);

    const filter = {};
    const searchTerm =
        query.search && typeof query.search === 'string' ? query.search.trim().slice(0, 100) : '';

    if (searchTerm) {
        const term = escapeRegex(searchTerm);
        const regex = { $regex: term, $options: 'i' };

        const [partnerIds, adminIds] = await Promise.all([
            FoodDeliveryPartner.find({
                $or: [{ name: regex }, { phone: regex }, { email: regex }]
            })
                .select('_id')
                .lean(),
            FoodAdmin.find({ name: regex }).select('_id').lean()
        ]);

        filter.$or = [
            { transactionId: regex },
            { reference: regex },
            { deliveryPartnerName: regex },
            { deliveryIdStr: regex },
            { createdByName: regex },
            { deliveryPartnerId: { $in: partnerIds.map((p) => p._id) } },
            { createdByAdminId: { $in: adminIds.map((a) => a._id) } }
        ];
    }

    const skip = (page - 1) * limitNum;

    const [list, total] = await Promise.all([
        DeliveryBonusTransaction.find(filter)
            .sort({ createdAt: -1, _id: -1 })
            .skip(skip)
            .limit(limitNum)
            .select(
                'transactionId amount reference previousBalance updatedBalance createdAt deliveryPartnerId deliveryPartnerName deliveryIdStr createdByAdminId createdByName'
            )
            .populate({ path: 'deliveryPartnerId', select: 'name' })
            .populate({ path: 'createdByAdminId', select: 'name' })
            .lean(),
        DeliveryBonusTransaction.countDocuments(filter)
    ]);

    const pages = Math.ceil(total / limitNum) || 1;
    const transactions = list.map((t, index) => mapBonusTransactionRow(t, skip + index + 1));

    return {
        transactions,
        pagination: {
            page,
            limit: limitNum,
            total,
            pages,
            hasNextPage: page < pages,
            hasPreviousPage: page > 1
        }
    };
}

export async function addDeliveryPartnerBonus(body, adminUser, reqInfo = {}) {
    const {
        ipAddress = null,
        userAgent = null,
        requestId = null
    } = reqInfo;

    // Resolve from body OR reqInfo — HTTP controller sets both.
    const idempotencyKey =
        (body?.idempotencyKey && String(body.idempotencyKey).trim()) ||
        (reqInfo?.idempotencyKey && String(reqInfo.idempotencyKey).trim()) ||
        null;

    const amount = Number(body.amount);
    if (!Number.isInteger(amount) || amount < 1) {
        throw new ValidationError('Invalid bonus amount. Must be a positive integer.');
    }
    if (!idempotencyKey || idempotencyKey.length < 8) {
        throw new ValidationError('idempotencyKey is required');
    }

    const requestHash = buildBonusRequestHash({
        deliveryPartnerId: body.deliveryPartnerId,
        amount,
        reference: body.reference || null
    });

    // autoIndex is disabled in production — create unique indexes explicitly.
    await ensureDeliveryBonusIdempotencyIndexes();

    // Fast path: completed claim + matching hash → never touch wallet again.
    const existingReplay = await loadIdempotentBonusResponse(idempotencyKey, requestHash);
    if (existingReplay) {
        return existingReplay;
    }

    const performer = adminUser
        ? await resolveActionPerformerSnapshot(adminUser)
        : { userId: null, name: 'System', role: 'SYSTEM', roleName: 'System' };

    const partner = await FoodDeliveryPartner.findById(body.deliveryPartnerId)
        .select('_id name status')
        .lean();
    if (!partner) {
        throw new ValidationError('Delivery partner not found');
    }
    if (partner.status !== 'approved') {
        throw new ValidationError('Delivery partner must be approved');
    }

    const deliveryIdStr = buildDeliveryIdStr(partner._id);
    const adminRole = performer.roleName || performer.role || 'Admin';
    const adminName = performer.name || 'Admin';

    const session = await mongoose.startSession();
    session.startTransaction();

    let previousWalletBalance = 0;
    let updatedWalletBalance = 0;
    let createdTransaction = null;
    let transactionId;

    try {
        // STEP 1 — Claim unique idempotency key BEFORE any wallet mutation.
        // Concurrent duplicates fail here on unique index, not after credit.
        try {
            await DeliveryBonusIdempotency.create(
                [
                    {
                        key: idempotencyKey,
                        requestHash,
                        status: 'completed',
                        transactionId: `PENDING:${idempotencyKey}`.slice(0, 120),
                        deliveryPartnerId: body.deliveryPartnerId,
                        deliveryPartnerName: partner.name || '',
                        amount,
                        reference: body.reference || null,
                        previousBalance: 0,
                        updatedBalance: 0,
                        requestId: requestId || null
                    }
                ],
                { session }
            );
        } catch (claimErr) {
            if (isDuplicateKeyError(claimErr)) {
                await session.abortTransaction();
                // Winner may still be committing — poll briefly for completed snapshot.
                for (let attempt = 0; attempt < 12; attempt += 1) {
                    // eslint-disable-next-line no-await-in-loop
                    const replay = await loadIdempotentBonusResponse(idempotencyKey, requestHash);
                    if (replay) return replay;
                    // eslint-disable-next-line no-await-in-loop
                    const existingTxn = await DeliveryBonusTransaction.findOne({ idempotencyKey }).lean();
                    if (existingTxn) {
                        await assertIdempotencyRequestHashMatch(
                            null,
                            requestHash,
                            {
                                deliveryPartnerId: existingTxn.deliveryPartnerId,
                                amount: existingTxn.amount,
                                reference: existingTxn.reference
                            }
                        );
                        return buildBonusTransactionResponse(
                            existingTxn,
                            partner,
                            existingTxn.previousBalance,
                            existingTxn.updatedBalance,
                            { idempotentReplay: true }
                        );
                    }
                    // eslint-disable-next-line no-await-in-loop
                    await new Promise((r) => setTimeout(r, 40 * (attempt + 1)));
                }
                throw new ValidationError('Duplicate bonus request (idempotency key already used)');
            }
            throw claimErr;
        }

        let attempts = 0;
        do {
            transactionId = generateBonusTransactionId();
            attempts += 1;
            // eslint-disable-next-line no-await-in-loop
            const clash = await DeliveryBonusTransaction.findOne({ transactionId })
                .session(session)
                .select('_id')
                .lean();
            if (!clash) break;
            if (attempts >= 5) {
                throw new Error('Failed to allocate unique bonus transaction id');
            }
        } while (true);

        // STEP 2 — Credit wallet only after unique claim succeeded.
        const updatedWallet = await FoodDeliveryWallet.findOneAndUpdate(
            { deliveryPartnerId: body.deliveryPartnerId },
            {
                $inc: {
                    balance: amount,
                    totalBonus: amount
                },
                $setOnInsert: {
                    deliveryPartnerId: body.deliveryPartnerId,
                    totalEarnings: 0,
                    totalSettled: 0,
                    totalDeliveries: 0,
                    cashInHand: 0,
                    lockedAmount: 0,
                    subscriptionBalance: 0
                }
            },
            { new: true, upsert: true, session }
        );

        updatedWalletBalance = Number(updatedWallet.balance);
        previousWalletBalance = updatedWalletBalance - amount;

        if (
            !Number.isFinite(updatedWalletBalance) ||
            !Number.isFinite(previousWalletBalance) ||
            previousWalletBalance < 0 ||
            previousWalletBalance + amount !== updatedWalletBalance
        ) {
            throw new Error('Wallet balance integrity check failed; transaction rolled back');
        }

        // STEP 3 — Persist bonus ledger + audit.
        createdTransaction = await DeliveryBonusTransaction.create(
            [
                {
                    deliveryPartnerId: body.deliveryPartnerId,
                    deliveryPartnerName: partner.name || '',
                    deliveryIdStr,
                    transactionId,
                    amount,
                    reference: body.reference || null,
                    previousBalance: previousWalletBalance,
                    updatedBalance: updatedWalletBalance,
                    createdByAdminId: performer.userId,
                    createdByName: adminName,
                    adminRole,
                    idempotencyKey,
                    requestId: requestId || null,
                    ipAddress,
                    userAgent
                }
            ],
            { session }
        );
        createdTransaction = createdTransaction[0];

        if (
            createdTransaction.previousBalance + createdTransaction.amount !==
                createdTransaction.updatedBalance ||
            createdTransaction.updatedBalance !== updatedWalletBalance
        ) {
            throw new Error('Bonus ledger mismatch; transaction rolled back');
        }

        await DeliveryBonusAuditLog.create(
            [
                {
                    adminId: performer.userId,
                    adminName,
                    adminRole,
                    deliveryPartnerId: partner._id,
                    deliveryPartnerName: partner.name,
                    deliveryPartnerIdStr: deliveryIdStr,
                    bonusAmount: amount,
                    reference: body.reference || null,
                    previousBalance: previousWalletBalance,
                    updatedBalance: updatedWalletBalance,
                    transactionId,
                    requestId: requestId || null,
                    idempotencyKey,
                    ipAddress,
                    userAgent
                }
            ],
            { session }
        );

        // STEP 4 — Finalize idempotency snapshot for replays.
        await DeliveryBonusIdempotency.updateOne(
            { key: idempotencyKey },
            {
                $set: {
                    status: 'completed',
                    requestHash,
                    transactionId,
                    previousBalance: previousWalletBalance,
                    updatedBalance: updatedWalletBalance,
                    amount,
                    reference: body.reference || null,
                    deliveryPartnerName: partner.name || '',
                    requestId: requestId || null
                }
            },
            { session }
        );

        await session.commitTransaction();
    } catch (error) {
        try {
            await session.abortTransaction();
        } catch {
            // already aborted
        }

        if (isDuplicateKeyError(error)) {
            const replay = await loadIdempotentBonusResponse(idempotencyKey, requestHash);
            if (replay) return replay;
            const existingTxn = await DeliveryBonusTransaction.findOne({ idempotencyKey }).lean();
            if (existingTxn) {
                await assertIdempotencyRequestHashMatch(
                    null,
                    requestHash,
                    {
                        deliveryPartnerId: existingTxn.deliveryPartnerId,
                        amount: existingTxn.amount,
                        reference: existingTxn.reference
                    }
                );
                return buildBonusTransactionResponse(
                    existingTxn,
                    partner,
                    existingTxn.previousBalance,
                    existingTxn.updatedBalance,
                    { idempotentReplay: true }
                );
            }
        }
        throw error;
    } finally {
        session.endSession();
    }

    try {
        const { notifyOwnerSafely } = await import('../../../../core/notifications/firebase.service.js');
        await notifyOwnerSafely(
            { ownerType: 'DELIVERY_PARTNER', ownerId: body.deliveryPartnerId },
            {
                title: 'Bonus Credited',
                body: `You have received a bonus of \u20B9${amount}. ${body.reference || 'Great job!'}`,
                image: 'https://i.ibb.co/3m2Yh7r/Appzeto-Brand-Image.png',
                data: {
                    type: 'bonus_credited',
                    amount: String(amount),
                    transactionId: createdTransaction.transactionId
                }
            }
        );
    } catch (e) {
        console.error('Failed to send bonus notification:', e);
    }

    return buildBonusTransactionResponse(
        createdTransaction,
        partner,
        previousWalletBalance,
        updatedWalletBalance,
        { idempotentReplay: false }
    );
}

// ----- Delivery Earnings (admin) -----
export async function getDeliveryEarnings(query = {}) {
    const page = Math.max(parseInt(query.page, 10) || 1, 1);
    const limit = Math.max(1, Math.min(1000, parseInt(query.limit, 10) || 50));
    const skip = (page - 1) * limit;

    const filter = {
        'dispatch.deliveryPartnerId': { $ne: null },
        orderType: 'food'
    };

    // Date range filters
    const createdAtFilter = {};
    if (query.fromDate) {
        const from = new Date(query.fromDate);
        if (!Number.isNaN(from.getTime())) {
            from.setHours(0, 0, 0, 0);
            createdAtFilter.$gte = from;
        }
    }
    if (query.toDate) {
        const to = new Date(query.toDate);
        if (!Number.isNaN(to.getTime())) {
            to.setHours(23, 59, 59, 999);
            createdAtFilter.$lte = to;
        }
    }

    // Period filters (only when explicit date range is not provided)
    if (!createdAtFilter.$gte && !createdAtFilter.$lte) {
        const period = String(query.period || 'all').trim().toLowerCase();
        const now = new Date();
        if (period === 'today') {
            const start = new Date(now);
            start.setHours(0, 0, 0, 0);
            const end = new Date(now);
            end.setHours(23, 59, 59, 999);
            createdAtFilter.$gte = start;
            createdAtFilter.$lte = end;
        } else if (period === 'week') {
            const start = new Date(now);
            start.setHours(0, 0, 0, 0);
            start.setDate(start.getDate() - start.getDay()); // Sunday
            const end = new Date(start);
            end.setDate(start.getDate() + 6);
            end.setHours(23, 59, 59, 999);
            createdAtFilter.$gte = start;
            createdAtFilter.$lte = end;
        } else if (period === 'month') {
            const start = new Date(now.getFullYear(), now.getMonth(), 1);
            start.setHours(0, 0, 0, 0);
            const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            end.setHours(23, 59, 59, 999);
            createdAtFilter.$gte = start;
            createdAtFilter.$lte = end;
        }
    }

    if (createdAtFilter.$gte || createdAtFilter.$lte) {
        filter.createdAt = createdAtFilter;
    }

    if (query.deliveryPartnerId && mongoose.Types.ObjectId.isValid(query.deliveryPartnerId)) {
        filter['dispatch.deliveryPartnerId'] = new mongoose.Types.ObjectId(query.deliveryPartnerId);
    }

    const search = String(query.search || '').trim();
    if (search) {
        const regex = new RegExp(search, 'i');

        const [partners, restaurants] = await Promise.all([
            FoodDeliveryPartner.find({
                $or: [{ name: regex }, { phone: regex }, { email: regex }]
            }).select('_id').lean(),
            FoodRestaurant.find({
                $or: [{ restaurantName: regex }, { name: regex }]
            }).select('_id').lean()
        ]);

        const partnerIds = partners.map((p) => p._id);
        const restaurantIds = restaurants.map((r) => r._id);

        filter.$or = [
            { orderId: regex },
            { 'dispatch.deliveryPartnerId': { $in: partnerIds } },
            { restaurantId: { $in: restaurantIds } }
        ];
    }

    const [orders, total, earningsAgg, distinctPartners] = await Promise.all([
        FoodOrder.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .select('orderId orderStatus createdAt pricing riderEarning deliveryPartnerSettlement dispatch.deliveryPartnerId restaurantId')
            .populate({ path: 'dispatch.deliveryPartnerId', select: 'name phone' })
            .populate({ path: 'restaurantId', select: 'restaurantName name' })
            .lean(),
        FoodOrder.countDocuments(filter),
        FoodOrder.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: null,
                    totalEarnings: {
                        $sum: {
                            $ifNull: [
                                '$riderEarning',
                                {
                                    $ifNull: [
                                        '$deliveryPartnerSettlement',
                                        { $ifNull: ['$pricing.deliveryFee', 0] }
                                    ]
                                }
                            ]
                        }
                    },
                    totalOrders: { $sum: 1 }
                }
            }
        ]),
        FoodOrder.distinct('dispatch.deliveryPartnerId', filter)
    ]);

    const earnings = orders.map((order) => {
        const partner = order?.dispatch?.deliveryPartnerId;
        const amount = Number(
            order?.riderEarning ??
            order?.deliveryPartnerSettlement ??
            order?.pricing?.deliveryFee ??
            0
        ) || 0;

        return {
            transactionId: String(order._id),
            orderId: order.orderId || 'N/A',
            deliveryPartnerId: partner?._id ? String(partner._id) : null,
            deliveryPartnerName: partner?.name || 'N/A',
            deliveryPartnerPhone: partner?.phone || 'N/A',
            restaurantName: order?.restaurantId?.restaurantName || order?.restaurantId?.name || 'N/A',
            amount,
            orderTotal: Number(order?.pricing?.total || 0) || 0,
            deliveryFee: Number(order?.pricing?.deliveryFee || 0) || 0,
            orderStatus: order?.orderStatus || 'N/A',
            createdAt: order?.createdAt || null
        };
    });

    const agg = earningsAgg?.[0] || {};
    const totalDeliveryPartners = (distinctPartners || []).filter(Boolean).length;

    return {
        earnings,
        summary: {
            totalDeliveryPartners,
            totalEarnings: Number(agg.totalEarnings || 0),
            totalOrders: Number(agg.totalOrders || 0)
        },
        pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit) || 1
        }
    };
}

// ----- Earning Addon Offers (admin) -----
export async function getEarningAddons() {
    const list = await FoodEarningAddon.find({})
        .sort({ createdAt: -1 })
        .lean();

    const now = Date.now();
    const earningAddons = list.map((a) => {
        const start = a.startDate ? new Date(a.startDate).getTime() : 0;
        const end = a.endDate ? new Date(a.endDate).getTime() : 0;
        const isValid = Boolean(a.status === 'active' && start && end && now >= start && now <= end);
        const isExpired = Boolean(end && now > end);
        const isUpcoming = Boolean(start && now < start);

        let status = a.status || 'inactive';
        if (isExpired) status = 'expired';
        else if (isUpcoming && a.status === 'active') status = 'upcoming';

        return {
            ...a,
            isValid,
            status
        };
    });

    return { earningAddons };
}

export async function createEarningAddon(body) {
    const created = await FoodEarningAddon.create({
        title: body.title,
        requiredOrders: body.requiredOrders,
        earningAmount: body.earningAmount,
        startDate: body.startDate,
        endDate: body.endDate,
        maxRedemptions: body.maxRedemptions ?? null,
        status: 'active'
    });
    return created.toObject();
}

export async function updateEarningAddon(id, body) {
    if (!id || !mongoose.Types.ObjectId.isValid(id)) return null;
    const doc = await FoodEarningAddon.findById(id);
    if (!doc) return null;
    doc.title = body.title;
    doc.requiredOrders = body.requiredOrders;
    doc.earningAmount = body.earningAmount;
    doc.startDate = body.startDate;
    doc.endDate = body.endDate;
    doc.maxRedemptions = body.maxRedemptions ?? null;
    await doc.save();
    return doc.toObject();
}

export async function deleteEarningAddon(id) {
    if (!id || !mongoose.Types.ObjectId.isValid(id)) return null;
    const deleted = await FoodEarningAddon.findByIdAndDelete(id).lean();
    return deleted ? { id } : null;
}

export async function toggleEarningAddonStatus(id, status) {
    if (!id || !mongoose.Types.ObjectId.isValid(id)) return null;
    return FoodEarningAddon.findByIdAndUpdate(id, { $set: { status } }, { new: true }).lean();
}

// ----- Earning Addon History (admin) -----
export async function getEarningAddonHistory(query = {}) {
    const { page = 1, limit = 1000, search } = query;
    const filter = {};

    // Optional search by delivery partner name/phone/email or offer title.
    // Keep it simple and fast: only apply when search is provided.
    let partnerIds = null;
    let offerIds = null;
    if (search && typeof search === 'string' && search.trim()) {
        const term = search.trim();
        partnerIds = await FoodDeliveryPartner.find({
            $or: [
                { name: { $regex: term, $options: 'i' } },
                { phone: { $regex: term, $options: 'i' } },
                { email: { $regex: term, $options: 'i' } }
            ]
        }).select('_id').lean();
        offerIds = await FoodEarningAddon.find({ title: { $regex: term, $options: 'i' } }).select('_id').lean();
        filter.$or = [
            { deliveryPartnerId: { $in: (partnerIds || []).map((p) => p._id) } },
            { offerId: { $in: (offerIds || []).map((o) => o._id) } }
        ];
    }

    const skip = Math.max(0, (Number(page) || 1) - 1) * Math.max(1, Math.min(1000, Number(limit) || 100));
    const limitNum = Math.max(1, Math.min(1000, Number(limit) || 100));

    const [list, total] = await Promise.all([
        FoodEarningAddonHistory.find(filter)
            .sort({ completedAt: -1, createdAt: -1 })
            .skip(skip)
            .limit(limitNum)
            .populate({ path: 'deliveryPartnerId', select: 'name phone email' })
            .populate({ path: 'offerId', select: 'title requiredOrders earningAmount' })
            .lean(),
        FoodEarningAddonHistory.countDocuments(filter)
    ]);

    const history = list.map((h, index) => {
        const partner = h.deliveryPartnerId;
        const offer = h.offerId;
        const partnerId = partner?._id ? String(partner._id) : null;
        return {
            _id: h._id,
            sl: skip + index + 1,
            deliveryPartnerId: partnerId,
            deliveryId: partnerId ? `DP-${partnerId.slice(-8).toUpperCase()}` : null,
            deliveryman: partner?.name || '',
            deliveryPhone: partner?.phone || 'N/A',
            offerTitle: offer?.title || '',
            ordersCompleted: h.ordersCompleted ?? 0,
            ordersRequired: h.ordersRequired ?? offer?.requiredOrders ?? 0,
            earningAmount: h.earningAmount ?? offer?.earningAmount ?? 0,
            totalEarning: h.totalEarning ?? h.earningAmount ?? 0,
            status: h.status || 'pending',
            date: h.completedAt || h.createdAt,
            completedAt: h.completedAt || h.createdAt
        };
    });

    return {
        history,
        pagination: {
            page: Number(page) || 1,
            limit: limitNum,
            total,
            pages: Math.ceil(total / limitNum) || 1
        }
    };
}

export async function creditEarningAddonHistory(historyId, notes) {
    if (!historyId || !mongoose.Types.ObjectId.isValid(historyId)) return null;
    const doc = await FoodEarningAddonHistory.findById(historyId).populate('offerId');
    if (!doc) return null;
    if (doc.status !== 'pending') return doc.toObject();

    const amountToCredit = Number(doc.earningAmount || 0);

    // 1. Update history status
    doc.status = 'credited';
    doc.creditedAt = new Date();
    doc.creditedNotes = typeof notes === 'string' ? notes.trim() : '';
    await doc.save();

    // 2. Credit the wallet
    if (amountToCredit > 0) {
        await FoodDeliveryWallet.findOneAndUpdate(
            { deliveryPartnerId: doc.deliveryPartnerId },
            { $inc: { balance: amountToCredit, totalEarnings: amountToCredit } },
            { upsert: true }
        );

        // 3. Create a transaction for ledger
        try {
            await DeliveryBonusTransaction.create({
                deliveryPartnerId: doc.deliveryPartnerId,
                transactionId: `ADDON-${String(doc._id).slice(-8).toUpperCase()}-${Date.now().toString().slice(-4)}`,
                amount: amountToCredit,
                reference: `Earning Addon: ${doc.offerId?.title || 'Offer Reward'}`
            });
        } catch (txnError) {
            console.error('Failed to create bonus transaction:', txnError);
            // Non-blocking but should be logged.
        }
    }

    try {
        const { notifyOwnerSafely } = await import('../../../../core/notifications/firebase.service.js');
        await notifyOwnerSafely(
            { ownerType: 'DELIVERY_PARTNER', ownerId: doc.deliveryPartnerId },
            {
                title: 'Incentive Credited! 🎯',
                body: `Your incentive for "${doc.offerId?.title || 'Earning Addon'}" has been approved and moved to your pocket.`,
                image: 'https://i.ibb.co/3m2Yh7r/Appzeto-Brand-Image.png',
                data: {
                    type: 'incentive_credited',
                    historyId: String(doc._id),
                    amount: String(doc.earningAmount || 0)
                }
            }
        );
    } catch (e) {
        console.error('Failed to send incentive credited notification:', e);
    }

    return doc.toObject();
}

export async function cancelEarningAddonHistory(historyId, reason) {
    if (!historyId || !mongoose.Types.ObjectId.isValid(historyId)) return null;
    const doc = await FoodEarningAddonHistory.findById(historyId).populate('offerId');
    if (!doc) return null;
    if (doc.status !== 'pending') return doc.toObject();
    doc.status = 'cancelled';
    doc.cancelledAt = new Date();
    doc.cancelReason = typeof reason === 'string' ? reason.trim() : '';
    await doc.save();

    try {
        const { notifyOwnerSafely } = await import('../../../../core/notifications/firebase.service.js');
        await notifyOwnerSafely(
            { ownerType: 'DELIVERY_PARTNER', ownerId: doc.deliveryPartnerId },
            {
                title: 'Incentive Update 📋',
                body: `Your incentive request for "${doc.offerId?.title || 'Earning Addon'}" was not approved. Reason: ${doc.cancelReason || 'Ineligible'}`,
                image: 'https://i.ibb.co/3m2Yh7r/Appzeto-Brand-Image.png',
                data: {
                    type: 'incentive_rejected',
                    historyId: String(doc._id),
                    reason: doc.cancelReason
                }
            }
        );
    } catch (e) {
        console.error('Failed to send incentive rejection notification:', e);
    }

    return doc.toObject();
}

export async function checkEarningAddonCompletions(deliveryPartnerId, _force = false) {
    const now = new Date();

    // Only search for active offers that are currently running.
    const activeOffers = await FoodEarningAddon.find({
        status: 'active',
        startDate: { $lte: now },
        endDate: { $gte: now }
    }).lean();

    if (activeOffers.length === 0) return { completionsFound: 0 };

    let partnerIds = [];
    if (deliveryPartnerId === 'all') {
        const partners = await FoodDeliveryPartner.find({ status: 'approved' }).select('_id').lean();
        partnerIds = partners.map(p => p._id);
    } else if (deliveryPartnerId && mongoose.Types.ObjectId.isValid(deliveryPartnerId)) {
        partnerIds = [deliveryPartnerId];
    }

    if (partnerIds.length === 0) return { completionsFound: 0 };

    let globalCompletions = 0;

    for (const pId of partnerIds) {
        for (const offer of activeOffers) {
            // Find existing history so we don't grant it twice for the same offer.
            const existing = await FoodEarningAddonHistory.findOne({
                deliveryPartnerId: pId,
                offerId: offer._id,
                status: { $in: ['pending', 'credited'] }
            }).lean();

            if (existing) continue;

            // Count orders delivered by this partner during the offer period.
            const orderCount = await FoodOrder.countDocuments({
                'dispatch.deliveryPartnerId': pId,
                orderStatus: 'delivered',
                createdAt: { $gte: offer.startDate, $lte: offer.endDate }
            });

            if (orderCount >= (offer.requiredOrders || 1)) {
                // Requirement met!
                await FoodEarningAddonHistory.create({
                    offerId: offer._id,
                    deliveryPartnerId: pId,
                    ordersCompleted: orderCount,
                    ordersRequired: offer.requiredOrders,
                    earningAmount: offer.earningAmount,
                    totalEarning: offer.earningAmount,
                    status: 'pending',
                    completedAt: now
                });

                // Update current redemptions in addon
                await FoodEarningAddon.findByIdAndUpdate(offer._id, { $inc: { currentRedemptions: 1 } });

                globalCompletions++;
            }
        }
    }

    return { completionsFound: globalCompletions };
}

export async function getDeliveryPartnerById(id) {
    const partner = await FoodDeliveryPartner.findById(id).lean();
    if (!partner) return null;

    const zones = await FoodZone.find({ isActive: true }).lean();
    const detectedZone = detectZoneFromPartner(partner, zones);

    const deliveryId = partner._id ? `DP-${partner._id.toString().slice(-8).toUpperCase()}` : null;
    return {
        ...partner,
        email: partner.email || null,
        deliveryId,
        detectedZone: detectedZone || partner.city || partner.state || 'N/A',
        status: partner.status === 'rejected' ? 'blocked' : partner.status,
        isActive: partner.isActive !== false,
        profileImage: partner.profilePhoto ? { url: partner.profilePhoto } : null,
        documents: {
            aadhar: (partner.aadharPhoto || partner.aadharNumber)
                ? { number: partner.aadharNumber || null, document: partner.aadharPhoto || null }
                : null,
            pan: (partner.panPhoto || partner.panNumber)
                ? { number: partner.panNumber || null, document: partner.panPhoto || null }
                : null,
            drivingLicense: (partner.drivingLicensePhoto || partner.drivingLicenseNumber)
                ? {
                    number: partner.drivingLicenseNumber || null,
                    document: partner.drivingLicensePhoto || null
                }
                : null,
            bankDetails:
                partner.bankAccountHolderName || partner.bankAccountNumber || partner.bankIfscCode || partner.bankName
                    ? {
                        accountHolderName: partner.bankAccountHolderName || null,
                        accountNumber: partner.bankAccountNumber || null,
                        ifscCode: partner.bankIfscCode || null,
                        bankName: partner.bankName || null
                    }
                    : null
        },
        location: (partner.address || partner.city || partner.state)
            ? { addressLine1: partner.address, city: partner.city, state: partner.state }
            : null,
        vehicle: (partner.vehicleType || partner.vehicleName || partner.vehicleNumber || partner.vehicleImage)
            ? {
                type: partner.vehicleType,
                brand: partner.vehicleName,
                model: partner.vehicleName,
                number: partner.vehicleNumber,
                vehicleImage: partner.vehicleImage || null
            }
            : null
    };
}

export async function getDeliverymanReviews(query = {}) {
    const limit = Math.min(Math.max(parseInt(query.limit, 10) || 50, 1), 1000);
    const page = Math.max(parseInt(query.page, 10) || 1, 1);
    const skip = (page - 1) * limit;

    const filter = {
        'ratings.deliveryPartner.rating': { $exists: true, $ne: null },
        orderType: 'food'
    };

    if (query.search && String(query.search).trim()) {
        const term = String(query.search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const searchRegex = new RegExp(term, 'i');

        // Find delivery partners matching search
        const partners = await FoodDeliveryPartner.find({
            $or: [
                { name: searchRegex },
                { phone: searchRegex }
            ]
        }).select('_id').lean();

        // Find customers matching search
        const customers = await FoodUser.find({
            $or: [
                { name: searchRegex },
                { email: searchRegex }
            ]
        }).select('_id').lean();

        filter.$or = [
            { orderId: searchRegex },
            { 'ratings.deliveryPartner.comment': searchRegex },
            { 'dispatch.deliveryPartnerId': { $in: partners.map(p => p._id) } },
            { userId: { $in: customers.map(c => c._id) } }
        ];
    }

    const [docs, total] = await Promise.all([
        FoodOrder.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('userId', 'name email phone')
            .populate('dispatch.deliveryPartnerId', 'name phone')
            .select('orderId userId dispatch.deliveryPartnerId ratings.deliveryPartner createdAt deliveryState.deliveredAt')
            .lean(),
        FoodOrder.countDocuments(filter)
    ]);

    const reviews = docs.map((doc, index) => ({
        sl: skip + index + 1,
        orderId: doc.orderId,
        deliveryman: doc.dispatch?.deliveryPartnerId?.name || 'Unknown',
        deliverymanId: doc.dispatch?.deliveryPartnerId?._id || 'N/A',
        deliverymanPhone: doc.dispatch?.deliveryPartnerId?.phone || 'N/A',
        customer: doc.userId?.name || 'Unknown',
        customerId: doc.userId?._id || 'N/A',
        customerPhone: doc.userId?.phone || 'N/A',
        review: doc.ratings?.deliveryPartner?.comment || '',
        rating: doc.ratings?.deliveryPartner?.rating || 0,
        submittedAt: doc.createdAt,
        deliveredAt: doc.deliveryState?.deliveredAt
    }));

    return { reviews, total, page, limit };
}

export async function approveDeliveryPartner(id, performer = null) {
    const partner = await FoodDeliveryPartner.findById(id);
    if (!partner) return null;

    if (partner.status === 'approved') {
        throw new ConflictError('Delivery partner is already approved');
    }
    if (partner.status !== 'pending') {
        throw new ValidationError('Only pending onboarding applications can be approved');
    }

    const { ensureLegacySubmission } = await import(
        '../../delivery/services/deliveryPartnerSubmission.service.js'
    );
    const { FoodDeliveryPartnerSubmission } = await import(
        '../../delivery/models/deliveryPartnerSubmission.model.js'
    );
    await ensureLegacySubmission(partner);

    partner.status = 'approved';
    partner.isActive = true;
    partner.approvedAt = new Date();
    partner.rejectedAt = undefined;
    partner.rejectionReason = undefined;
    partner.rejectedBy = undefined;
    partner.approvedBy = performer;
    const { activateDriverVehiclesOnPartnerApproval } = await import('../../../porter/orders/services/porter-driver-vehicle.service.js');
    await activateDriverVehiclesOnPartnerApproval(partner);
    await partner.save();

    if (partner.latestSubmissionId) {
        await FoodDeliveryPartnerSubmission.findByIdAndUpdate(partner.latestSubmissionId, {
            $set: {
                status: 'approved',
                reviewedAt: new Date(),
                approvedBy: performer,
                rejectionReason: null,
                rejectedBy: null
            }
        });
    }

    try {
        const { notifyOwnerSafely } = await import('../../../../core/notifications/firebase.service.js');
        await notifyOwnerSafely(
            { ownerType: 'DELIVERY_PARTNER', ownerId: partner._id },
            {
                title: 'Welcome Aboard! 🚲',
                body: `Your delivery partner application has been approved. You can now go online and start earning!`,
                image: 'https://i.ibb.co/3m2Yh7r/Appzeto-Brand-Image.png',
                data: {
                    type: 'onboarding_approved',
                    partnerId: String(partner._id)
                }
            }
        );
    } catch (e) {
        console.error('Failed to send delivery partner approval notification:', e);
    }

    // Referral crediting: pending log first, wallet/bonus credit, then mark credited (retryable on later approval runs).
    try {
        const referrerId = partner.referredBy ? String(partner.referredBy) : '';
        if (referrerId && mongoose.Types.ObjectId.isValid(referrerId)) {
            let log = await FoodReferralLog.findOne({ refereeId: partner._id, role: 'DELIVERY_PARTNER' });

            if (!log) {
                const settingsDoc = await FoodReferralSettings.findOne({ isActive: true }).sort({ createdAt: -1 }).lean();

                const referrerReward = Math.max(0, Number(settingsDoc?.delivery?.referrerReward) || 0);
                const refereeReward = Math.max(0, Number(settingsDoc?.delivery?.refereeReward) || 0);
                const limit = Math.max(0, Number(settingsDoc?.delivery?.limit) || 0);

                const referrer = await FoodDeliveryPartner.findById(referrerId).select('_id referralCount status name').lean();

                if (referrer && referrer.status === 'approved' && (referrerReward > 0 || refereeReward > 0) && limit > 0 && Number(referrer.referralCount || 0) < limit) {
                    log = await FoodReferralLog.create({
                        referrerId: referrer._id,
                        refereeId: partner._id,
                        role: 'DELIVERY_PARTNER',
                        rewardAmount: referrerReward,
                        referrerRewardAmount: referrerReward,
                        refereeRewardAmount: refereeReward,
                        status: 'pending'
                    });
                } else {
                    await FoodReferralLog.create({
                        referrerId: new mongoose.Types.ObjectId(referrerId),
                        refereeId: partner._id,
                        role: 'DELIVERY_PARTNER',
                        rewardAmount: referrerReward,
                        status: 'rejected',
                        reason: !referrer ? 'referrer_not_found' : (referrerReward <= 0 && refereeReward <= 0) ? 'reward_disabled' : limit <= 0 ? 'limit_disabled' : 'limit_reached'
                    });
                }
            }

            if (log?.status === 'pending') {
                const referrerReward = Math.max(0, Number(log.referrerRewardAmount) || 0);
                const refereeReward = Math.max(0, Number(log.refereeRewardAmount) || 0);
                const referrerBonusRef = `referral_log:${String(log._id)}:referrer`;
                const refereeBonusRef = `referral_log:${String(log._id)}:referee`;

                const [existingReferrerBonus, existingRefereeBonus] = await Promise.all([
                    referrerReward > 0
                        ? DeliveryBonusTransaction.findOne({ reference: referrerBonusRef }).select('_id').lean()
                        : Promise.resolve(null),
                    refereeReward > 0
                        ? DeliveryBonusTransaction.findOne({ reference: refereeBonusRef }).select('_id').lean()
                        : Promise.resolve(null)
                ]);

                await Promise.all([
                    referrerReward > 0 && !existingReferrerBonus
                        ? addDeliveryPartnerBonus(
                            {
                                deliveryPartnerId: String(log.referrerId),
                                amount: referrerReward,
                                reference: referrerBonusRef,
                                idempotencyKey: referrerBonusRef
                            },
                            null
                        )
                        : Promise.resolve(),
                    refereeReward > 0 && !existingRefereeBonus
                        ? addDeliveryPartnerBonus(
                            {
                                deliveryPartnerId: String(partner._id),
                                amount: refereeReward,
                                reference: refereeBonusRef,
                                idempotencyKey: refereeBonusRef
                            },
                            null
                        )
                        : Promise.resolve()
                ]);

                // Atomic pending → credited so retries cannot double-increment referralCount.
                const marked = await FoodReferralLog.findOneAndUpdate(
                    { _id: log._id, status: 'pending' },
                    { $set: { status: 'credited' } },
                    { new: true }
                );
                if (marked) {
                    await FoodDeliveryPartner.updateOne({ _id: log.referrerId }, { $inc: { referralCount: 1 } });
                }
            }
        }
    } catch (e) {
        // Never fail approval due to referral errors. Pending logs stay retryable.
        // eslint-disable-next-line no-console
        console.warn('Referral crediting failed (delivery approval):', e?.message || e);
    }
    invalidateDashboardStatsCache();
    return partner.toObject();
}

export async function rejectDeliveryPartner(id, reason, performer = null) {
    if (!id || !mongoose.Types.ObjectId.isValid(id)) return null;

    const rejectionReason = typeof reason === 'string' ? reason.trim() : '';
    if (!rejectionReason) {
        throw new ValidationError('Rejection reason is required');
    }

    const partner = await FoodDeliveryPartner.findById(id);
    if (!partner) return null;

    if (partner.status === 'rejected') {
        throw new ConflictError('Delivery partner application is already rejected');
    }
    if (partner.status === 'approved') {
        throw new ConflictError('Approved delivery partners cannot be rejected via onboarding reject. Deactivate instead.');
    }
    if (partner.status !== 'pending') {
        throw new ValidationError('Only pending onboarding applications can be rejected');
    }

    const { ensureLegacySubmission } = await import(
        '../../delivery/services/deliveryPartnerSubmission.service.js'
    );
    const { FoodDeliveryPartnerSubmission } = await import(
        '../../delivery/models/deliveryPartnerSubmission.model.js'
    );
    const { FoodRefreshToken } = await import('../../../../core/refreshTokens/refreshToken.model.js');

    await ensureLegacySubmission(partner);

    const reviewedAt = new Date();
    partner.status = 'rejected';
    partner.isActive = false;
    partner.rejectedAt = reviewedAt;
    partner.rejectionReason = rejectionReason;
    partner.approvedAt = undefined;
    partner.approvedBy = undefined;
    partner.rejectedBy = performer;
    partner.availabilityStatus = 'offline';
    await partner.save();

    if (partner.latestSubmissionId) {
        await FoodDeliveryPartnerSubmission.findByIdAndUpdate(partner.latestSubmissionId, {
            $set: {
                status: 'rejected',
                reviewedAt,
                rejectionReason,
                rejectedBy: performer,
                approvedBy: null
            }
        });
    }

    await Promise.all([
        FoodRefreshToken.deleteMany({ userId: partner._id }),
        FoodDeliveryPartner.updateOne(
            { _id: partner._id },
            { $set: { fcmTokens: partner.fcmTokens || [], fcmTokenMobile: partner.fcmTokenMobile || [] } }
        )
    ]);

    const updated = partner.toObject();

    if (updated) {
        try {
            const { notifyOwnerSafely } = await import('../../../../core/notifications/firebase.service.js');
            await notifyOwnerSafely(
                { ownerType: 'DELIVERY_PARTNER', ownerId: updated._id },
                {
                    title: 'Onboarding Update 📋',
                    body: `Your application to join as a delivery partner was rejected. Reason: ${rejectionReason}.`,
                    image: 'https://i.ibb.co/3m2Yh7r/Appzeto-Brand-Image.png',
                    data: {
                        type: 'onboarding_rejected',
                        partnerId: String(updated._id),
                        reason: rejectionReason
                    }
                }
            );
        } catch (e) {
            console.error('Failed to send delivery partner rejection notification:', e);
        }
    }
    if (updated) invalidateDashboardStatsCache();
    return updated;
}

export async function updateDeliveryPartnerActiveStatus(id, isActive) {
    if (!id || !mongoose.Types.ObjectId.isValid(id)) return null;
    const nextIsActive = Boolean(isActive);
    const update = {
        isActive: nextIsActive,
        ...(nextIsActive ? {} : { availabilityStatus: 'offline' }),
    };

    const updated = await FoodDeliveryPartner.findByIdAndUpdate(
        id,
        { $set: update },
        { new: true },
    ).lean();
    if (!updated) return null;

    if (!nextIsActive) {
        await Promise.all([
            FoodRefreshToken.deleteMany({ userId: updated._id }),
            FoodDeliveryPartner.updateOne(
                { _id: updated._id },
                { $set: { fcmTokens: [], fcmTokenMobile: [] } },
            ),
        ]);
    }

    return updated;
}

// ----- Zones CRUD -----
export async function getZones(query) {
    const limit = Math.min(Math.max(parseInt(query.limit, 10) || 100, 1), 1000);
    const page = Math.max(parseInt(query.page, 10) || 1, 1);
    const skip = (page - 1) * limit;
    const isActive = query.isActive;
    const search = typeof query.search === 'string' ? query.search.trim() : '';

    const filter = {};
    if (isActive !== undefined && isActive !== '') {
        filter.isActive = isActive === 'true' || isActive === '1';
    }
    if (search) {
        filter.$or = [
            { name: { $regex: search, $options: 'i' } },
            { zoneName: { $regex: search, $options: 'i' } },
            { serviceLocation: { $regex: search, $options: 'i' } },
            { country: { $regex: search, $options: 'i' } }
        ];
    }

    const [zones, total] = await Promise.all([
        FoodZone.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        FoodZone.countDocuments(filter)
    ]);
    return { zones, total, page, limit };
}

export async function getZoneById(id) {
    return FoodZone.findById(id).lean();
}

export async function createZone(body) {
    const name = typeof body.name === 'string' ? body.name.trim() : (body.zoneName && body.zoneName.trim()) || '';
    if (!name) return { error: 'Zone name is required' };
    const coordinates = Array.isArray(body.coordinates) ? body.coordinates : [];
    if (coordinates.length < 3) return { error: 'At least 3 coordinates (polygon points) are required' };

    const normalized = [];
    for (const c of coordinates) {
        const latitude = Number(c?.latitude);
        const longitude = Number(c?.longitude);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
            return { error: 'Each coordinate must have valid finite latitude and longitude values' };
        }
        normalized.push({ latitude, longitude });
    }

    const country = (body.country && body.country.trim()) || 'India';
    const overlapResult = await assertNoZoneOverlap(FoodZone, normalized, { extraFilter: { country } });
    if (overlapResult) return overlapResult;

    const zone = new FoodZone({
        name,
        zoneName: body.zoneName && body.zoneName.trim() ? body.zoneName.trim() : name,
        country,
        serviceLocation: (body.serviceLocation && body.serviceLocation.trim()) || name,
        unit: body.unit === 'miles' ? 'miles' : 'kilometer',
        coordinates: normalized,
        isActive: body.isActive !== false
    });
    await zone.save();
    return { zone: zone.toObject() };
}

export async function updateZone(id, body) {
    const zone = await FoodZone.findById(id);
    if (!zone) return null;

    if (body.name !== undefined) zone.name = String(body.name).trim();
    if (body.zoneName !== undefined) zone.zoneName = String(body.zoneName).trim();
    if (body.country !== undefined) zone.country = String(body.country).trim();
    if (body.serviceLocation !== undefined) zone.serviceLocation = String(body.serviceLocation).trim();
    if (body.unit !== undefined) zone.unit = body.unit === 'miles' ? 'miles' : 'kilometer';
    if (body.isActive !== undefined) zone.isActive = body.isActive !== false;
    if (Array.isArray(body.coordinates) && body.coordinates.length >= 3) {
        const normalizedCoords = [];
        for (const c of body.coordinates) {
            const latitude = Number(c?.latitude);
            const longitude = Number(c?.longitude);
            if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
                return { error: 'Each coordinate must have valid finite latitude and longitude values' };
            }
            normalizedCoords.push({ latitude, longitude });
        }
        const overlapResult = await assertNoZoneOverlap(FoodZone, normalizedCoords, {
            excludeId: id,
            extraFilter: { country: zone.country },
        });
        if (overlapResult) return overlapResult;
        zone.coordinates = normalizedCoords;
    }
    if (zone.name) zone.serviceLocation = zone.serviceLocation || zone.name;

    await zone.save();
    return { zone: zone.toObject() };
}

export async function deleteZone(id) {
    const zone = await FoodZone.findByIdAndDelete(id);
    return zone ? { id } : null;
}

// ----- Withdrawals (admin) -----
export async function getWithdrawals(query = {}) {
    const limit = Math.min(Math.max(parseInt(query.limit, 10) || 50, 1), 500);
    const page = Math.max(parseInt(query.page, 10) || 1, 1);
    const skip = (page - 1) * limit;

    const filter = {};
    if (query.status && query.status !== 'all') {
        filter.status = query.status.toLowerCase();
    }
    if (query.restaurantId && mongoose.Types.ObjectId.isValid(query.restaurantId)) {
        filter.restaurantId = new mongoose.Types.ObjectId(query.restaurantId);
    }

    const [withdrawals, total] = await Promise.all([
        FoodRestaurantWithdrawal.find(filter)
            .populate('restaurantId', 'restaurantName profileImage ownerName phone ownerPhone accountHolderName accountNumber ifscCode accountType upiId upiQrImage')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        FoodRestaurantWithdrawal.countDocuments(filter)
    ]);

    // UI expects status with first letter capitalized, and data in 'requests' key
    const requests = withdrawals.map((w) => ({
        ...w,
        id: w._id,
        restaurantName: w.restaurantId?.restaurantName || 'N/A',
        restaurantIdString: w.restaurantId ? `REST${w.restaurantId._id.toString().slice(-6).padStart(6, '0')}` : 'N/A',
        restaurantBankDetails: {
            accountHolderName: w.restaurantId?.accountHolderName || '',
            accountNumber: w.restaurantId?.accountNumber || '',
            ifscCode: w.restaurantId?.ifscCode || '',
            accountType: w.restaurantId?.accountType || '',
            upiId: w.restaurantId?.upiId || '',
            upiQrImage: w.restaurantId?.upiQrImage || ''
        },
        status: w.status.charAt(0).toUpperCase() + w.status.slice(1)
    }));

    return { requests, total, page, limit };
}

export async function updateWithdrawalStatus(id, { status, adminNote, rejectionReason, transactionId }) {
    if (!id || !mongoose.Types.ObjectId.isValid(id)) throw new ValidationError('Invalid withdrawal ID');

    const existing = await FoodRestaurantWithdrawal.findById(id).lean();
    if (!existing) throw new ValidationError('Withdrawal request not found');

    const nextStatus = String(status || '').trim().toLowerCase();
    const wasAlreadyApproved = String(existing.status || '').trim().toLowerCase() === 'approved';

    const update = {
        status: nextStatus,
        adminNote,
        rejectionReason,
        transactionId,
        processedAt: new Date()
    };

    const updated = await FoodRestaurantWithdrawal.findByIdAndUpdate(
        id,
        { $set: update },
        { new: true }
    ).populate('restaurantId', 'restaurantName').lean();

    if (!updated) throw new ValidationError('Withdrawal request not found');

    // On first approval only: consume matching delivered order shares so available
    // balance does not regenerate after pending → approved.
    if (nextStatus === 'approved' && !wasAlreadyApproved) {
        try {
            const restaurantId = updated.restaurantId?._id || updated.restaurantId || existing.restaurantId;
            await foodTransactionService.settleRestaurantSharesForWithdrawal(
                restaurantId,
                updated.amount,
                {
                    withdrawalId: String(updated._id),
                    note: `Settled via restaurant withdrawal approval (${updated._id})`,
                    recordedByRole: 'ADMIN',
                }
            );
        } catch (err) {
            // Withdrawal status is already updated; log without rolling back approval
            // so admin payment records stay consistent with existing flow.
            console.error(
                `Failed to settle restaurant shares for withdrawal ${updated._id}:`,
                err?.message || err
            );
        }
    }

    return updated;
}

export async function getDeliveryWithdrawals(query = {}) {
    const limit = parseInt(query.limit, 10) || 100;
    const page = parseInt(query.page, 10) || 1;
    const skip = (page - 1) * limit;

    const filter = {};
    if (query.status && query.status !== 'All') {
        filter.status = query.status.toLowerCase();
    }

    if (query.search) {
        // Search by amount or placeholder for name (name requires join usually)
        if (!isNaN(query.search)) {
            filter.amount = Number(query.search);
        }
    }

    const [withdrawals, total] = await Promise.all([
        FoodDeliveryWithdrawal.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('deliveryPartnerId', 'name phone profilePartnerId upiId upiQrCode')
            .lean(),
        FoodDeliveryWithdrawal.countDocuments(filter)
    ]);

    const requests = withdrawals.map((w) => ({
        ...w,
        id: w._id,
        deliveryName: w.deliveryPartnerId?.name || 'N/A',
        deliveryPhone: w.deliveryPartnerId?.phone || 'N/A',
        deliveryIdString: w.deliveryPartnerId?.profilePartnerId || w.deliveryPartnerId?.phone || 'N/A',
        status: w.status.charAt(0).toUpperCase() + w.status.slice(1)
    }));

    return { requests, total, page, limit };
}

export async function updateDeliveryWithdrawalStatus(id, { status, adminNote, rejectionReason, transactionId }) {
    if (!id || !mongoose.Types.ObjectId.isValid(id)) throw new ValidationError('Invalid withdrawal ID');

    const update = {
        status: String(status).toLowerCase(),
        adminNote,
        rejectionReason,
        transactionId,
        processedAt: new Date()
    };

    const existing = await FoodDeliveryWithdrawal.findById(id).lean();
    if (!existing) throw new ValidationError('Withdrawal request not found');
    if (existing.status !== 'pending') throw new ValidationError(`Withdrawal is already ${existing.status}`);

    const updated = await FoodDeliveryWithdrawal.findByIdAndUpdate(
        id,
        { $set: update },
        { new: true }
    ).populate('deliveryPartnerId', 'name phone profilePartnerId').lean();

    // If approved, deduct from wallet balance using central transaction service
    if (status.toLowerCase() === 'approved' || status.toLowerCase() === 'processed') {
        const amount = Number(updated.amount || 0);
        if (amount > 0) {
            await debitWallet({
                entityType: 'deliveryBoy',
                entityId: updated.deliveryPartnerId?._id || updated.deliveryPartnerId,
                amount: amount,
                description: `Withdrawal Approved - ${updated.orderId || updated.id}`,
                category: 'settlement_payout',
                metadata: { withdrawalId: updated._id, transactionId }
            });
        }
    }

    return updated;
}

/**
 * Fetch delivery partner wallets with financial summary
 */
export async function getDeliveryWallets(query = {}) {
    const limit = parseInt(query.limit, 10) || 20;
    const page = parseInt(query.page, 10) || 1;
    const skip = (page - 1) * limit;

    const filter = { status: 'approved' };
    if (query.search) {
        filter.$or = [
            { name: new RegExp(query.search, 'i') },
            { phone: new RegExp(query.search, 'i') }
        ];
    }

    const [partners, total] = await Promise.all([
        FoodDeliveryPartner.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        FoodDeliveryPartner.countDocuments(filter)
    ]);

    const cashLimitSettings = await FoodDeliveryCashLimit.findOne({ isActive: true }).lean();
    const globalLimit = Number(cashLimitSettings?.deliveryCashLimit || 0);

    const wallets = await Promise.all(partners.map(async (p) => {
        const wallet = await getDeliveryPartnerWalletEnhanced(p._id);

        return {
            walletId: wallet?._id,
            deliveryId: p._id,
            name: p.name,
            deliveryIdString: p.phone,
            pocketBalance: Number(wallet?.pocketBalance || 0),
            remainingCashLimit: Number(wallet?.availableCashLimit || 0),
            cashCollected: Number(wallet?.cashInHand || 0),
            totalEarning: Number(wallet?.totalEarned || 0),
            bonus: Number(wallet?.totalBonus || 0),
            totalWithdrawn: Number(wallet?.totalWithdrawn || 0),
            totalDeliveries: Number(wallet?.totalDeliveries || 0)
        };
    }));

    return {
        wallets,
        pagination: {
            total,
            page,
            limit,
            pages: Math.ceil(total / limit) || 1
        }
    };
}

export async function updateDeliveryBoyWallet(dto) {
    const { deliveryId, pocketBalance, cashInHand } = dto;
    const wallet = await getDeliveryPartnerWalletEnhanced(deliveryId);

    // Adjust Pocket Balance via Bonus/Adjustment
    const pocketDiff = Number(pocketBalance) - wallet.pocketBalance;
    if (Math.abs(pocketDiff) > 0.01) {
        await DeliveryBonusTransaction.create({
            deliveryPartnerId: deliveryId,
            amount: pocketDiff,
            reason: 'Admin manual adjustment',
            transactionId: generateBonusTransactionId()
        });
    }

    // Adjust Cash In Hand via Deposit/Adjustment (Deposit reduces cashInHand)
    const cashDiff = wallet.cashInHand - Number(cashInHand);
    if (Math.abs(cashDiff) > 0.01) {
        await FoodDeliveryCashDeposit.create({
            deliveryPartnerId: deliveryId,
            amount: cashDiff,
            status: 'Completed',
            paymentMethod: 'cash',
            razorpayOrderId: 'manual_adj_' + Date.now()
        });
    }

    const updated = await getDeliveryPartnerWalletEnhanced(deliveryId);
    return {
        walletId: updated?._id,
        deliveryId: deliveryId,
        pocketBalance: updated.pocketBalance,
        cashInHand: updated.cashInHand,
        remainingCashLimit: updated.availableCashLimit,
        availableCashLimit: updated.availableCashLimit
    };
}

/**
 * Fetch cash limit settlement (deposit) transactions
 */
export async function getCashLimitSettlements(query = {}) {
    const limit = parseInt(query.limit, 10) || 20;
    const page = parseInt(query.page, 10) || 1;
    const skip = (page - 1) * limit;

    const filter = {};
    if (query.search) {
        // Search by razorpay ID or find partner IDs to search by partner
        if (query.search.startsWith('pay_')) {
            filter.razorpayPaymentId = query.search;
        }
    }

    const [deposits, total] = await Promise.all([
        FoodDeliveryCashDeposit.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('deliveryPartnerId', 'name phone')
            .lean(),
        FoodDeliveryCashDeposit.countDocuments(filter)
    ]);

    const transactions = deposits.map((d) => ({
        id: d._id,
        createdAt: d.createdAt,
        deliveryId: d.deliveryPartnerId?._id,
        deliveryName: d.deliveryPartnerId?.name || 'N/A',
        deliveryIdString: d.deliveryPartnerId?.phone || 'N/A',
        amount: Number(d.amount || 0),
        status: d.status,
        razorpayPaymentId: d.razorpayPaymentId || '-'
    }));

    return {
        transactions,
        pagination: {
            total,
            page,
            limit,
            pages: Math.ceil(total / limit) || 1
        }
    };
}

export async function getSidebarBadges() {
    try {
        const [
            pendingRestaurants,
            pendingDeliveryPartners,
            pendingFoods,
            pendingAddons,
            pendingOrders,
            pendingOfflinePayments,
            pendingRestaurantWithdrawals,
            pendingDeliveryWithdrawals,
            openUserSupportTickets,
            openRestaurantSupportTickets,
            openDeliverySupportTickets,
            pendingEarningAddons,
            pendingSafetyReports,
            pendingEmergencyHelp,
            pendingRestaurantComplaints
        ] = await Promise.all([
            FoodRestaurant.countDocuments({ status: 'pending' }),
            FoodDeliveryPartner.countDocuments({ status: 'pending' }),
            FoodItem.countDocuments({ status: 'pending' }),
            FoodAddon.countDocuments({ status: 'pending' }),
            FoodOrder.countDocuments({ orderStatus: { $in: ['created', 'placed'] } }),
            FoodOrder.countDocuments({ paymentMethod: 'offline_payment', orderStatus: { $in: ['created', 'placed'] } }),
            FoodRestaurantWithdrawal.countDocuments({ status: 'pending' }),
            FoodDeliveryWithdrawal.countDocuments({ status: 'pending' }),
            FoodSupportTicket.countDocuments({ status: 'open' }),
            FoodRestaurantSupportTicket.countDocuments({ status: 'open' }),
            DeliverySupportTicket.countDocuments({ status: 'open' }),
            FoodEarningAddonHistory.countDocuments({ status: 'pending' }),
            FoodSafetyEmergencyReport.countDocuments({ status: 'pending' }),
            FoodDeliveryEmergencyHelp.countDocuments({ status: 'pending' }),
            FoodSupportTicket.countDocuments({ status: 'open', restaurantId: { $exists: true } })
        ]);

        return {
            restaurants: pendingRestaurants,
            deliveryPartners: pendingDeliveryPartners,
            foods: pendingFoods + pendingAddons,
            foodApprovals: pendingFoods,
            orders: pendingOrders,
            offlinePayments: pendingOfflinePayments,
            restaurantWithdrawals: pendingRestaurantWithdrawals,
            deliveryWithdrawals: pendingDeliveryWithdrawals,
            userSupportTickets: openUserSupportTickets + openRestaurantSupportTickets,
            deliverySupportTickets: openDeliverySupportTickets,
            earningAddons: pendingEarningAddons,
            safetyReports: pendingSafetyReports,
            emergencyHelp: pendingEmergencyHelp,
            restaurantComplaints: pendingRestaurantComplaints
        };
    } catch (error) {
        console.error('Error fetching sidebar badges:', error);
        return {};
    }
}

const USER_CANCEL_FULL_REFUND_WINDOW_MS = 30 * 1000;
const CANCELLED_ORDER_STATUSES_FOR_REFUND = ['cancelled_by_user', 'cancelled_by_restaurant', 'cancelled_by_admin'];

function isOnlinePrepaidMethod(method) {
    return ['razorpay', 'razorpay_qr'].includes(String(method || '').trim().toLowerCase());
}

function getUserCancellationElapsedMs(order) {
    const createdAt = order?.createdAt ? new Date(order.createdAt) : null;
    if (!createdAt || Number.isNaN(createdAt.getTime())) return null;

    const history = Array.isArray(order?.statusHistory) ? [...order.statusHistory].reverse() : [];
    const cancelledEntry = history.find((entry) => String(entry?.to || '') === 'cancelled_by_user');
    const cancelledAtCandidate = cancelledEntry?.at || order?.updatedAt || null;
    if (!cancelledAtCandidate) return null;

    const cancelledAt = new Date(cancelledAtCandidate);
    if (Number.isNaN(cancelledAt.getTime())) return null;
    return cancelledAt.getTime() - createdAt.getTime();
}

export async function processRefund(orderId, refundAmount, refundTo) {
    if (!orderId || !mongoose.Types.ObjectId.isValid(String(orderId))) {
        throw new ValidationError('Invalid order id');
    }

    const order = await FoodOrder.findById(orderId);
    if (!order) {
        throw new ValidationError('Order not found');
    }

    if (!CANCELLED_ORDER_STATUSES_FOR_REFUND.includes(String(order.orderStatus || ''))) {
        throw new ValidationError('Only cancelled orders can be refunded');
    }

    if (order.payment?.refund?.status === 'processed' || order.payment?.status === 'refunded') {
        throw new ValidationError('Refund already processed for this order');
    }

    const totalAmount = Number(order?.pricing?.total || 0);
    if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
        throw new ValidationError('No refundable amount found for this order');
    }

    const normalizedAmount =
        refundAmount === null || refundAmount === undefined || refundAmount === ''
            ? totalAmount
            : Number(refundAmount);

    if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
        throw new ValidationError('Refund amount must be greater than 0');
    }

    if (normalizedAmount > totalAmount) {
        throw new ValidationError(`Refund amount cannot exceed ₹${totalAmount.toFixed(2)}`);
    }

    const paymentMethod = String(order?.payment?.method || '').trim().toLowerCase();
    const isWalletPayment = paymentMethod === 'wallet';
    const isOnlinePayment = isOnlinePrepaidMethod(paymentMethod);

    if (!isWalletPayment && !isOnlinePayment) {
        throw new ValidationError('Refund is only available for prepaid orders');
    }

    const requestedPartial = Math.abs(normalizedAmount - totalAmount) > 0.009;
    const userCancelledOnlineAfterWindow =
        String(order.orderStatus) === 'cancelled_by_user' &&
        isOnlinePayment &&
        (() => {
            const elapsedMs = getUserCancellationElapsedMs(order);
            return elapsedMs !== null && elapsedMs > USER_CANCEL_FULL_REFUND_WINDOW_MS;
        })();

    if (requestedPartial && !userCancelledOnlineAfterWindow) {
        throw new ValidationError(
            'Partial refund is allowed only for user-cancelled online orders after 30 seconds. Admin or restaurant cancellations must be refunded in full.'
        );
    }

    const existingRefund = order.payment?.refund || {};
    const requestedRefundMethod =
        existingRefund?.requestedMethod === 'wallet' || existingRefund?.requestedMethod === 'gateway'
            ? existingRefund.requestedMethod
            : null;
    const normalizedRefundMethod = isWalletPayment
        ? 'wallet'
        : refundTo === 'wallet' || refundTo === 'gateway'
            ? refundTo
            : requestedRefundMethod || 'gateway';
    const processedAt = new Date();

    if (normalizedRefundMethod === 'wallet') {
        const refundTransactionId = `wallet_refund_${String(order._id)}_${normalizedAmount.toFixed(2)}`;
        await refundWalletBalance(
            order.userId,
            normalizedAmount,
            'Order refund',
            {
                orderId: String(order._id),
                orderReadableId: String(order.orderId || ''),
                source: 'admin_manual_refund',
                refundTransactionId,
            }
        );

        order.payment.status = 'refunded';
        order.payment.refund = {
            status: 'processed',
            amount: normalizedAmount,
            refundId: refundTransactionId,
            requestedMethod: requestedRefundMethod || normalizedRefundMethod,
            processedMethod: 'wallet',
            requestedAt: existingRefund?.requestedAt || processedAt,
            requestedByUser: Boolean(existingRefund?.requestedByUser),
            reason: existingRefund?.reason || '',
            processedAt
        };
    } else {
        const paymentId = order.payment?.razorpay?.paymentId;
        if (!paymentId) {
            throw new ValidationError('Original payment reference not found for this online order');
        }

        const refundResult = await initiateRazorpayRefund(paymentId, normalizedAmount);
        if (!refundResult?.success) {
            order.payment.refund = {
                status: 'failed',
                amount: normalizedAmount,
                requestedMethod: requestedRefundMethod || normalizedRefundMethod,
                processedMethod: 'gateway',
                requestedAt: existingRefund?.requestedAt || processedAt,
                requestedByUser: Boolean(existingRefund?.requestedByUser),
                reason: existingRefund?.reason || ''
            };
            await order.save();
            throw new ValidationError(refundResult?.error || 'Failed to process Razorpay refund');
        }

        order.payment.status = 'refunded';
        order.payment.refund = {
            status: 'processed',
            amount: normalizedAmount,
            refundId: refundResult.refundId || '',
            requestedMethod: requestedRefundMethod || normalizedRefundMethod,
            processedMethod: 'gateway',
            requestedAt: existingRefund?.requestedAt || processedAt,
            requestedByUser: Boolean(existingRefund?.requestedByUser),
            reason: existingRefund?.reason || '',
            processedAt
        };
    }

    await order.save();

    try {
        await foodTransactionService.applyRefundToTransaction(
            order._id,
            normalizedAmount,
            totalAmount,
            {
                note:
                    normalizedAmount < totalAmount
                        ? `Partial refund of ₹${normalizedAmount.toFixed(2)} processed by admin`
                        : `Full refund of ₹${normalizedAmount.toFixed(2)} processed by admin`,
                recordedByRole: 'ADMIN',
            }
        );
    } catch (_err) {
        // Keep the refund completed even if finance history sync needs follow-up.
    }

    return order.toObject();
}

export async function getRestaurantCoupons() {
    const { RestaurantCoupon } = await import('../models/restaurantCoupon.model.js');
    const { SellerCoupon } = await import('../../../quick-commerce/models/sellerCoupon.model.js');

    const [restaurantCoupons, sellerCoupons] = await Promise.all([
        RestaurantCoupon.find({}).lean(),
        SellerCoupon.find({}).lean()
    ]);

    const mappedRestaurants = restaurantCoupons.map((c) => ({
        ...c,
        type: 'restaurant',
        minOrderValue: c.minOrderValue ?? c.minOrderAmount ?? 0,
        minOrderAmount: c.minOrderValue ?? c.minOrderAmount ?? 0,
        endDate: c.endDate ?? c.expiryDate ?? null,
        expiryDate: c.endDate ?? c.expiryDate ?? null,
        discountType: c.discountType === 'fixed' ? 'flat-price' : c.discountType,
        customerScope: c.customerScope || 'all',
        usedCount: c.usedCount ?? 0,
        usageLimit: c.usageLimit ?? null,
        perUserLimit: c.perUserLimit ?? null,
        maxDiscount: c.maxDiscount ?? null,
        startDate: c.startDate ?? null,
    }));
    const mappedSellers = sellerCoupons.map(c => ({ ...c, type: 'seller' }));

    return [...mappedRestaurants, ...mappedSellers].sort((a, b) => {
        const dateA = new Date(a.createdAt || 0);
        const dateB = new Date(b.createdAt || 0);
        return dateB - dateA;
    });
}

export async function updateRestaurantCouponStatus(id, status) {
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        throw new ValidationError('Invalid coupon request ID');
    }
    if (!status || !['Approved', 'Rejected'].includes(status)) {
        throw new ValidationError('Status must be Approved or Rejected');
    }
    const { RestaurantCoupon } = await import('../models/restaurantCoupon.model.js');
    const { SellerCoupon } = await import('../../../quick-commerce/models/sellerCoupon.model.js');

    let updated = await RestaurantCoupon.findByIdAndUpdate(
        id,
        { $set: { status } },
        { new: true }
    ).lean();

    let type = 'restaurant';

    if (!updated) {
        updated = await SellerCoupon.findByIdAndUpdate(
            id,
            { $set: { status } },
            { new: true }
        ).lean();
        type = 'seller';
    }

    if (!updated) {
        throw new ValidationError('Coupon request not found');
    }

    try {
        const { invalidateCache } = await import('../../../../middleware/cache.js');
        if (type === 'restaurant') {
            await invalidateCache('offers*');
        } else {
            await invalidateCache('quick_coupons*');
            await invalidateCache('quick_offers*');
        }
    } catch (err) {
        console.error('Failed to invalidate cache on status update:', err);
    }

    return { ...updated, type };
}

export async function getDepositPaymentSettings() {
    const { DepositPaymentSettings } = await import('../models/depositPaymentSettings.model.js');
    let settings = await DepositPaymentSettings.findOne({});
    if (!settings) {
        settings = await DepositPaymentSettings.create({});
    }
    return settings;
}

export async function updateDepositPaymentSettings(body = {}) {
    const { DepositPaymentSettings } = await import('../models/depositPaymentSettings.model.js');
    let settings = await DepositPaymentSettings.findOne({});
    if (!settings) {
        settings = await DepositPaymentSettings.create(body);
    } else {
        Object.assign(settings, body);
        await settings.save();
    }
    return settings;
}

export async function getCashPayRequests(query = {}) {
    const limit = parseInt(query.limit, 10) || 20;
    const page = parseInt(query.page, 10) || 1;
    const skip = (page - 1) * limit;

    const filter = {
        depositType: { $in: ['admin_bank', 'admin_upi', 'admin_qr', 'zone_hub'] }
    };

    if (query.status) {
        filter.status = query.status;
    }

    const [requests, total] = await Promise.all([
        FoodDeliveryCashDeposit.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('deliveryPartnerId', 'name phone profilePartnerId')
            .populate('zoneId', 'name zoneName')
            .populate('zoneHubRestaurantId', 'restaurantName restaurantId')
            .lean(),
        FoodDeliveryCashDeposit.countDocuments(filter)
    ]);

    const formattedRequests = requests.map((r) => ({
        id: r._id,
        createdAt: r.createdAt,
        deliveryId: r.deliveryPartnerId?._id || '',
        deliveryName: r.deliveryPartnerId?.name || 'N/A',
        deliveryPhone: r.deliveryPartnerId?.phone || 'N/A',
        deliveryPartnerIdString: r.deliveryPartnerId?.profilePartnerId || r.deliveryPartnerId?.phone || 'N/A',
        amount: Number(r.amount || 0),
        paymentMethod: r.paymentMethod,
        depositType: r.depositType,
        paymentProof: r.paymentProof || '',
        status: r.status,
        adminNote: r.adminNote || '',
        zoneName: r.zoneId?.zoneName || r.zoneId?.name || 'N/A',
        zoneHubName: r.zoneHubRestaurantId?.restaurantName || 'N/A',
        zoneHubDisplayId: r.zoneHubRestaurantId?.restaurantId || 'N/A'
    }));

    return {
        requests: formattedRequests,
        pagination: {
            total,
            page,
            limit,
            pages: Math.ceil(total / limit) || 1
        }
    };
}

export async function updateCashPayRequestStatus(id, { status, adminNote, performer }) {
    if (!id || !mongoose.Types.ObjectId.isValid(id)) throw new ValidationError('Invalid request ID');

    const validStatuses = ['Completed', 'Failed'];
    if (!validStatuses.includes(status)) {
        throw new ValidationError('Invalid status. Must be Completed or Failed');
    }

    const existing = await FoodDeliveryCashDeposit.findById(id).lean();
    if (!existing) throw new ValidationError('Cash pay request not found');
    if (existing.status !== 'Pending') {
        throw new ValidationError(`Request has already been processed with status: ${existing.status}`);
    }

    const updateFields = {
        status,
        adminNote,
        processedAt: new Date()
    };

    if (performer && performer.id) {
        updateFields.adminId = performer.id;
    }

    const updated = await FoodDeliveryCashDeposit.findByIdAndUpdate(
        id,
        { $set: updateFields },
        { new: true }
    ).populate('deliveryPartnerId', 'name phone profilePartnerId').lean();

    return updated;
}

export async function getZoneHubs(query = {}) {
    const limit = parseInt(query.limit, 10) || 50;
    const page = parseInt(query.page, 10) || 1;
    const skip = (page - 1) * limit;

    const filter = {};
    if (query.search) {
        filter.name = { $regex: query.search, $options: 'i' };
    }

    const [zones, total] = await Promise.all([
        FoodZone.find(filter)
            .sort({ name: 1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        FoodZone.countDocuments(filter)
    ]);

    const zoneHubsPromises = zones.map(async (z) => {
        const hubs = await FoodRestaurant.find({
            zoneId: z._id,
            isZoneHub: true,
            status: 'approved',
            isDeleted: { $ne: true }
        }).select('restaurantName primaryContactNumber ownerPhone ownerName addressLine1 location status city').lean();

        return {
            id: z._id,
            zoneId: z._id,
            name: z.name,
            zoneName: z.zoneName || z.name,
            country: z.country,
            isActive: z.isActive,
            hubAssigned: hubs.length > 0,
            hubs: hubs.map(h => ({
                id: h._id,
                name: h.restaurantName,
                phone: h.primaryContactNumber || h.ownerPhone || 'N/A',
                owner: h.ownerName || 'N/A',
                address: h.addressLine1 || h.location?.addressLine1 || 'N/A',
                city: h.city || 'N/A',
                status: h.status
            })),
            hub: hubs.length > 0 ? {
                id: hubs[0]._id,
                name: hubs[0].restaurantName,
                phone: hubs[0].primaryContactNumber || hubs[0].ownerPhone || 'N/A',
                owner: hubs[0].ownerName || 'N/A',
                address: hubs[0].addressLine1 || hubs[0].location?.addressLine1 || 'N/A',
                city: hubs[0].city || 'N/A',
                status: hubs[0].status
            } : null
        };
    });

    const zoneHubs = await Promise.all(zoneHubsPromises);

    return {
        zoneHubs,
        pagination: {
            total,
            page,
            limit,
            pages: Math.ceil(total / limit) || 1
        }
    };
}

export async function getRestaurantsInZone(zoneId) {
    if (!zoneId || !mongoose.Types.ObjectId.isValid(zoneId)) {
        throw new ValidationError('Invalid Zone ID');
    }
    const list = await FoodRestaurant.find({
        zoneId: new mongoose.Types.ObjectId(zoneId),
        status: 'approved',
        isDeleted: { $ne: true }
    })
        .select('restaurantName restaurantId ownerPhone ownerName location addressLine1 city')
        .sort({ restaurantName: 1 })
        .lean();

    return list.map(r => ({
        id: r._id,
        restaurantId: r._id,
        displayId: r.restaurantId,
        name: r.restaurantName,
        phone: r.ownerPhone || 'N/A',
        owner: r.ownerName || 'N/A',
        address: r.addressLine1 || r.location?.addressLine1 || 'N/A'
    }));
}

export async function assignZoneHub(zoneId, restaurantId, action = 'assign') {
    if (!zoneId || !mongoose.Types.ObjectId.isValid(zoneId)) {
        throw new ValidationError('Invalid Zone ID');
    }

    if (!restaurantId) {
        // If restaurantId is null or empty, unassign ALL hubs in this zone
        await FoodRestaurant.updateMany(
            { zoneId: new mongoose.Types.ObjectId(zoneId) },
            { $set: { isZoneHub: false } }
        );
        return { success: true, message: 'All zone hubs unassigned' };
    }

    if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
        throw new ValidationError('Invalid Restaurant ID');
    }

    const restaurant = await FoodRestaurant.findById(restaurantId);
    if (!restaurant) throw new ValidationError('Restaurant not found');
    if (String(restaurant.zoneId) !== String(zoneId)) {
        throw new ValidationError('Selected restaurant does not belong to this zone');
    }

    if (action === 'unassign') {
        restaurant.isZoneHub = false;
    } else {
        if (restaurant.status !== 'approved') {
            throw new ValidationError('Only approved restaurants can be designated as Zone Hub');
        }
        restaurant.isZoneHub = true;
    }

    await restaurant.save();
    return restaurant;
}

export async function getAdminCODVerifications(query = {}) {
    const limit = parseInt(query.limit, 10) || 20;
    const page = parseInt(query.page, 10) || 1;
    const skip = (page - 1) * limit;

    const filter = {
        depositType: 'zone_hub',
        status: 'Restaurant_Accepted'
    };

    const [requests, total] = await Promise.all([
        FoodDeliveryCashDeposit.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('deliveryPartnerId', 'name phone profilePartnerId')
            .populate('zoneId', 'name zoneName')
            .populate('zoneHubRestaurantId', 'restaurantName restaurantId ownerName ownerPhone')
            .lean(),
        FoodDeliveryCashDeposit.countDocuments(filter)
    ]);

    const formattedRequests = requests.map((r) => ({
        id: r._id,
        createdAt: r.createdAt,
        deliveryId: r.deliveryPartnerId?._id || '',
        deliveryName: r.deliveryPartnerId?.name || 'N/A',
        deliveryPhone: r.deliveryPartnerId?.phone || 'N/A',
        deliveryPartnerIdString: r.deliveryPartnerId?.profilePartnerId || r.deliveryPartnerId?.phone || 'N/A',
        amount: Number(r.amount || 0),
        paymentMethod: r.paymentMethod,
        depositType: r.depositType,
        paymentProof: r.paymentProof || '',
        status: r.status,
        zoneName: r.zoneId?.zoneName || r.zoneId?.name || 'N/A',
        zoneHubName: r.zoneHubRestaurantId?.restaurantName || 'N/A',
        zoneHubDisplayId: r.zoneHubRestaurantId?.restaurantId || 'N/A',
        zoneHubOwnerName: r.zoneHubRestaurantId?.ownerName || 'N/A',
        zoneHubOwnerPhone: r.zoneHubRestaurantId?.ownerPhone || 'N/A',
        restaurantProof: r.restaurantProof || '',
        restaurantNote: r.restaurantNote || '',
        restaurantProcessedAt: r.restaurantProcessedAt || null
    }));

    return {
        requests: formattedRequests,
        pagination: {
            total,
            page,
            limit,
            pages: Math.ceil(total / limit) || 1
        }
    };
}

export async function settleCODVerification(id, { action, adminNote, performer }) {
    if (!id || !mongoose.Types.ObjectId.isValid(id)) throw new ValidationError('Invalid request ID');

    const deposit = await FoodDeliveryCashDeposit.findById(id);
    if (!deposit) throw new ValidationError('COD verification request not found');

    if (deposit.status !== 'Restaurant_Accepted') {
        throw new ValidationError(`Request cannot be processed because status is: ${deposit.status}`);
    }

    const updateFields = {
        adminNote,
        processedAt: new Date()
    };

    if (action === 'approve') {
        updateFields.status = 'Completed';
    } else if (action === 'reject') {
        updateFields.status = 'Failed'; // Mark as Failed so it is settled as rejected
    } else {
        throw new ValidationError('Invalid action. Must be approve or reject');
    }

    if (performer && performer.id) {
        updateFields.adminId = performer.id;
    }

    const updated = await FoodDeliveryCashDeposit.findByIdAndUpdate(
        id,
        { $set: updateFields },
        { new: true }
    ).populate('deliveryPartnerId', 'name phone profilePartnerId')
        .populate('zoneHubRestaurantId', 'restaurantName')
        .lean();

    return updated;
}
