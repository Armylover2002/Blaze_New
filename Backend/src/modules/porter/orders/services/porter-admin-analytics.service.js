import mongoose from 'mongoose';
import { PorterOrder } from '../models/porterOrder.model.js';
import { PorterEarning } from '../models/porterEarning.model.js';
import { PORTER_ORDER_STATUS, PORTER_PAYMENT_STATUS } from '../constants/porterOrderStatus.constants.js';
import { FoodUser } from '../../../../core/users/user.model.js';
import { FoodDeliveryPartner } from '../../../food/delivery/models/deliveryPartner.model.js';
import { FoodDeliveryWallet } from '../../../food/delivery/models/deliveryWallet.model.js';

const baseFilter = { isDeleted: { $ne: true } };

const startOfDay = (d = new Date()) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
};

const daysAgo = (n) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d;
};

export async function getPorterDashboardStats() {
    const todayStart = startOfDay();
    const weekStart = daysAgo(7);

    const [
        totalOrders,
        activeOrders,
        todayOrders,
        deliveredOrders,
        cancelledOrders,
        scheduledOrders,
        revenueAgg,
        todayRevenueAgg,
        recentOrders,
    ] = await Promise.all([
        PorterOrder.countDocuments(baseFilter),
        PorterOrder.countDocuments({
            ...baseFilter,
            status: {
                $in: [
                    'searching_partner', 'assigned', 'partner_accepted',
                    'en_route_pickup', 'at_pickup', 'picked_up', 'in_transit', 'at_drop',
                ],
            },
        }),
        PorterOrder.countDocuments({ ...baseFilter, createdAt: { $gte: todayStart } }),
        PorterOrder.countDocuments({ ...baseFilter, status: { $in: ['delivered', 'completed'] } }),
        PorterOrder.countDocuments({ ...baseFilter, status: { $regex: '^cancelled' } }),
        PorterOrder.countDocuments({ ...baseFilter, status: 'scheduled' }),
        PorterOrder.aggregate([
            { $match: { ...baseFilter, status: { $in: ['delivered', 'completed'] } } },
            { $group: { _id: null, total: { $sum: '$pricing.total' }, driverEarning: { $sum: '$pricing.driverEarning' }, count: { $sum: 1 } } },
        ]),
        PorterOrder.aggregate([
            {
                $match: {
                    ...baseFilter,
                    status: { $in: ['delivered', 'completed'] },
                    'deliveryState.deliveredAt': { $gte: todayStart },
                },
            },
            { $group: { _id: null, total: { $sum: '$pricing.total' }, driverEarning: { $sum: '$pricing.driverEarning' } } },
        ]),
        PorterOrder.find(baseFilter)
            .sort({ createdAt: -1 })
            .limit(10)
            .populate('userId', 'name phone')
            .populate('dispatch.deliveryPartnerId', 'name phone')
            .select({
                orderNumber: 1, status: 1, pickup: 1, delivery: 1, vehicleName: 1,
                pricing: 1, payment: 1, createdAt: 1, userId: 1, 'dispatch.deliveryPartnerId': 1,
                route: 1, parcel: 1,
            })
            .lean(),
    ]);

    const totalRevenue = Number(revenueAgg?.[0]?.total) || 0;
    const totalDriverEarning = Number(revenueAgg?.[0]?.driverEarning) || 0;
    const completedCount = Number(revenueAgg?.[0]?.count) || 0;
    const todayRevenue = Number(todayRevenueAgg?.[0]?.total) || 0;
    const todayDriverEarning = Number(todayRevenueAgg?.[0]?.driverEarning) || 0;
    const avgOrderValue = completedCount > 0 ? Math.round(totalRevenue / completedCount) : 0;

    return {
        kpis: {
            totalOrders,
            activeOrders,
            todayOrders,
            deliveredOrders,
            cancelledOrders,
            scheduledOrders,
            totalRevenue,
            todayRevenue,
            totalAdminEarning: totalRevenue - totalDriverEarning,
            todayAdminEarning: todayRevenue - todayDriverEarning,
            avgOrderValue,
            fleetUtilization: totalOrders > 0
                ? `${Math.round((activeOrders / Math.max(totalOrders, 1)) * 100)}%`
                : '0%',
        },
        recentOrders: recentOrders.map((o) => ({
            id: String(o._id),
            orderNumber: o.orderNumber,
            customer: o.userId?.name || 'Customer',
            customerPhone: o.userId?.phone || '',
            pickup: o.pickup?.address || '',
            drop: o.delivery?.address || '',
            driver: o.dispatch?.deliveryPartnerId?.name || '—',
            vehicle: o.vehicleName || '—',
            goodsType: o.parcel?.parcelName || 'Parcel',
            distance: o.route?.distanceText || `${o.route?.distanceKm ?? 0} km`,
            amount: o.pricing?.total ?? 0,
            paymentStatus: o.payment?.status,
            paymentMethod: o.payment?.method || 'wallet',
            status: o.status,
            time: o.createdAt,
        })),
    };
}

export async function getPorterReportsStats({ range = 'monthly' } = {}) {
    const rangeDays = range === 'daily' ? 7 : range === 'weekly' ? 28 : 90;
    const since = daysAgo(rangeDays);

    const [statusBreakdown, dailyRevenue, vehicleBreakdown, zoneBreakdown, topDrivers] = await Promise.all([
        PorterOrder.aggregate([
            { $match: { ...baseFilter, createdAt: { $gte: since } } },
            { $group: { _id: '$status', count: { $sum: 1 } } },
        ]),
        PorterOrder.aggregate([
            {
                $match: {
                    ...baseFilter,
                    status: { $in: ['delivered', 'completed'] },
                    createdAt: { $gte: since },
                },
            },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                    revenue: { $sum: '$pricing.total' },
                    orders: { $sum: 1 },
                },
            },
            { $sort: { _id: 1 } },
        ]),
        PorterOrder.aggregate([
            { $match: { ...baseFilter, createdAt: { $gte: since } } },
            { $group: { 
                _id: '$vehicleName', 
                orders: { $sum: 1 }, 
                revenue: { $sum: { $cond: [{ $in: ['$status', ['delivered', 'completed']] }, '$pricing.total', 0] } } 
            } },
            { $sort: { orders: -1 } },
            { $limit: 8 },
        ]),
        PorterOrder.aggregate([
            { $match: { ...baseFilter, createdAt: { $gte: since }, zoneId: { $ne: null } } },
            { $group: { 
                _id: '$zoneId', 
                orders: { $sum: 1 }, 
                revenue: { $sum: { $cond: [{ $in: ['$status', ['delivered', 'completed']] }, '$pricing.total', 0] } } 
            } },
            { $sort: { orders: -1 } },
            { $limit: 8 },
            {
                $lookup: {
                    from: 'porter_zones',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'zone'
                }
            },
            { $unwind: { path: '$zone', preserveNullAndEmptyArrays: true } }
        ]),
        PorterEarning.aggregate([
            { $match: { isDeleted: { $ne: true }, createdAt: { $gte: since } } },
            {
                $group: {
                    _id: '$deliveryPartnerId',
                    trips: { $sum: 1 },
                    earnings: { $sum: '$netEarning' },
                },
            },
            { $sort: { earnings: -1 } },
            { $limit: 10 },
            {
                $lookup: {
                    from: 'food_delivery_partners',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'driverInfo'
                }
            },
            { $unwind: { path: '$driverInfo', preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: 'porter_orders',
                    let: { driverId: '$_id' },
                    pipeline: [
                        { $match: { $expr: { $eq: ['$dispatch.deliveryPartnerId', '$$driverId'] }, 'rating.score': { $exists: true } } },
                        { $sort: { createdAt: -1 } },
                        { $limit: 1 }
                    ],
                    as: 'latestOrder'
                }
            },
            { $unwind: { path: '$latestOrder', preserveNullAndEmptyArrays: true } }
        ]),
    ]);

    const totalOrders = statusBreakdown.reduce((s, r) => s + r.count, 0);
    const delivered = statusBreakdown.find((r) => ['delivered', 'completed'].includes(r._id))?.count || 0;
    const totalRevenue = dailyRevenue.reduce((s, r) => s + (r.revenue || 0), 0);

    return {
        kpis: {
            totalRevenue: `₹${totalRevenue.toLocaleString('en-IN')}`,
            totalOrders: String(totalOrders),
            avgOrderValue: delivered > 0 ? `₹${Math.round(totalRevenue / delivered).toLocaleString('en-IN')}` : '₹0',
            fleetUtilization: totalOrders > 0 ? `${Math.round((delivered / totalOrders) * 100)}%` : '0%',
        },
        revenueTrend: dailyRevenue.map((r) => ({
            name: r._id,
            revenue: r.revenue,
            orders: r.orders,
        })),
        vehicleUtilization: vehicleBreakdown.map((v) => ({
            name: v._id || 'Unknown',
            value: v.orders,
            revenue: v.revenue,
        })),
        zonePerformance: zoneBreakdown.map((z) => ({
            zoneId: String(z._id),
            zoneName: z.zone?.name || null,
            orders: z.orders,
            revenue: z.revenue,
        })),
        topDrivers: topDrivers.map((d) => {
            const info = d.driverInfo || {};
            const activeVehicle = info.driverVehicles?.find(v => v.status === 'active' || v.isDefault) || info.driverVehicles?.[0];
            const vName = info.vehicleName || info.vehicleType || activeVehicle?.vehicleName || activeVehicle?.vehicleCode || '—';
            
            const review = d.latestOrder?.rating;
            let reviewText = '';
            if (review && review.score) {
                reviewText = `${review.comment || ''} ${review.tags && review.tags.length ? `[${review.tags.join(', ')}]` : ''}`.trim();
            }

            return {
                id: String(d._id),
                driverId: String(d._id),
                trips: d.trips,
                earnings: d.earnings,
                name: info.name || 'Unknown',
                phone: info.phone || '—',
                status: info.status || 'inactive',
                rating: info.rating || 0,
                vehicle: vName,
                image: info.profilePhoto || null,
                completedOrders: d.trips,
                latestReviewText: reviewText || null
            };
        }),
        statusBreakdown,
    };
}

/**
 * Per-driver Porter wallet / earnings view for the admin wallet screen.
 *
 * Everything is computed from real data in a single aggregation round-trip
 * (porter_earnings joined with driver profile, live wallet balance, and COD
 * cash-in-hand). Earnings are settled to the driver wallet at delivery, so the
 * meaningful "pending" figure is COD cash the driver still holds for the
 * platform — not unsettled earnings.
 */
export async function getPorterAdminWallets() {
    const todayStart = startOfDay();

    const [rows, dashRev, dashTodayRev] = await Promise.all([
        PorterEarning.aggregate([
            { $match: { isDeleted: { $ne: true } } },
            {
                $group: {
                    _id: '$deliveryPartnerId',
                    totalEarnings: { $sum: { $ifNull: ['$netEarning', 0] } },
                    totalTrips: { $sum: 1 },
                    todayEarnings: {
                        $sum: {
                            $cond: [{ $gte: ['$createdAt', todayStart] }, { $ifNull: ['$netEarning', 0] }, 0],
                        },
                    },
                    lastSettlement: { $max: '$settledAt' },
                },
            },
            {
                // COD cash the driver collected (owed to platform => pending settlement)
                $lookup: {
                    from: 'porter_orders',
                    let: { pid: '$_id' },
                    pipeline: [
                        {
                            $match: {
                                $expr: { $eq: ['$dispatch.deliveryPartnerId', '$$pid'] },
                                status: { $in: ['delivered', 'completed'] },
                                'payment.method': 'cash',
                                'payment.status': 'paid',
                                isDeleted: { $ne: true },
                            },
                        },
                        { $group: { _id: null, cash: { $sum: { $ifNull: ['$pricing.total', 0] } } } },
                    ],
                    as: 'cashAgg',
                },
            },
            {
                $lookup: {
                    from: 'food_delivery_partners',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'driver',
                },
            },
            { $unwind: { path: '$driver', preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: 'food_delivery_wallets',
                    localField: '_id',
                    foreignField: 'deliveryPartnerId',
                    as: 'wallet',
                },
            },
            { $unwind: { path: '$wallet', preserveNullAndEmptyArrays: true } },
            {
                $project: {
                    _id: 0,
                    driverId: { $toString: '$_id' },
                    driverName: { $ifNull: ['$driver.name', 'Unknown driver'] },
                    photo: '$driver.profilePhoto',
                    vehicle: {
                        $ifNull: ['$driver.vehicleName', { $ifNull: ['$driver.vehicleType', '—'] }],
                    },
                    driverStatus: { $ifNull: ['$driver.status', 'inactive'] },
                    walletBalance: { $ifNull: ['$wallet.balance', 0] },
                    totalEarnings: 1,
                    totalTrips: 1,
                    todayEarnings: 1,
                    lastSettlement: 1,
                    cashCollected: { $ifNull: [{ $arrayElemAt: ['$cashAgg.cash', 0] }, 0] },
                },
            },
            { $sort: { totalEarnings: -1 } },
            { $limit: 1000 },
        ]),
        PorterOrder.aggregate([
            { $match: { ...baseFilter, status: { $in: ['delivered', 'completed'] } } },
            { $group: { _id: null, total: { $sum: '$pricing.total' }, driverEarning: { $sum: '$pricing.driverEarning' } } },
        ]),
        PorterOrder.aggregate([
            {
                $match: {
                    ...baseFilter,
                    status: { $in: ['delivered', 'completed'] },
                    'deliveryState.deliveredAt': { $gte: todayStart },
                },
            },
            { $group: { _id: null, total: { $sum: '$pricing.total' }, driverEarning: { $sum: '$pricing.driverEarning' } } },
        ]),
    ]);

    const records = rows.map((d, i) => {
        const cashCollected = Math.round(Number(d.cashCollected) || 0);
        return {
            id: d.driverId || `porter-wallet-${i}`,
            driverId: d.driverId,
            driverName: d.driverName,
            photo: d.photo || null,
            vehicle: d.vehicle || '—',
            walletBalance: Math.round(Number(d.walletBalance) || 0),
            todayEarnings: Math.round(Number(d.todayEarnings) || 0),
            pending: cashCollected,
            completed: Math.round(Number(d.totalEarnings) || 0),
            totalTrips: Number(d.totalTrips) || 0,
            lastSettlement: d.lastSettlement || null,
            status: cashCollected > 0 ? 'pending' : 'settled',
        };
    });

    const totalRev = Number(dashRev?.[0]?.total) || 0;
    const totalDrv = Number(dashRev?.[0]?.driverEarning) || 0;
    const todayRev = Number(dashTodayRev?.[0]?.total) || 0;
    const todayDrv = Number(dashTodayRev?.[0]?.driverEarning) || 0;

    const summary = records.reduce(
        (acc, r) => {
            acc.availableBalance += r.walletBalance;
            acc.todayEarnings += r.todayEarnings;
            acc.totalEarnings += r.completed;
            acc.pendingSettlement += r.pending;
            return acc;
        },
        { 
            availableBalance: 0, todayEarnings: 0, totalEarnings: 0, pendingSettlement: 0, totalDrivers: records.length,
            adminTotalEarning: totalRev - totalDrv,
            adminTodayEarning: todayRev - todayDrv
        },
    );

    return { summary, records };
}

export async function getPorterAdminTransactions(query = {}) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const filter = {
        ...baseFilter,
        status: { $in: ['delivered', 'completed'] },
    };

    const [docs, total, summaryAgg] = await Promise.all([
        PorterOrder.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('userId', 'name')
            .populate('dispatch.deliveryPartnerId', 'name')
            .select({
                orderNumber: 1, status: 1, pricing: 1, payment: 1, createdAt: 1,
                'deliveryState.deliveredAt': 1, userId: 1, dispatch: 1
            })
            .lean(),
        PorterOrder.countDocuments(filter),
        PorterOrder.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: null,
                    grossRevenue: { $sum: '$pricing.total' },
                    totalCommission: { $sum: '$pricing.commission' },
                    totalTax: { $sum: '$pricing.serviceTax' },
                    netPayout: { $sum: { $ifNull: ['$pricing.driverEarning', 0] } },
                },
            },
        ]),
    ]);

    const summary = summaryAgg?.[0] || {};

    return {
        summary: {
            grossRevenue: summary.grossRevenue || 0,
            totalCommission: summary.totalCommission || 0,
            totalTax: summary.totalTax || 0,
            netPayout: summary.netPayout || 0,
        },
        records: docs.map((o) => {
            const amount = o.pricing?.total ?? 0;
            const commission = o.pricing?.commission ?? 0;
            const tax = o.pricing?.serviceTax ?? 0;
            const platformFee = o.pricing?.platformFee ?? 0;
            const discount = o.pricing?.discount ?? 0;
            
            return {
                id: String(o._id),
                orderNumber: o.orderNumber,
                amount: amount,
                commission: commission,
                tax: tax,
                platformFee: platformFee,
                discount: discount,
                netPayout: o.pricing?.driverEarning ?? 0,
                driverPayout: o.pricing?.driverEarning ?? 0,
                paymentMethod: o.payment?.method || 'wallet',
                customer: o.userId?.name || 'Customer',
                driverName: o.dispatch?.deliveryPartnerId?.name || '—',
                status: o.status,
                date: o.deliveryState?.deliveredAt || o.createdAt,
            };
        }),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
}
