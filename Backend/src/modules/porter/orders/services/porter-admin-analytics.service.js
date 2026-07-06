import mongoose from 'mongoose';
import { PorterOrder } from '../models/porterOrder.model.js';
import { PorterEarning } from '../models/porterEarning.model.js';
import { PORTER_ORDER_STATUS, PORTER_PAYMENT_STATUS } from '../constants/porterOrderStatus.constants.js';

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
        PorterOrder.aggregate([
            { $match: { ...baseFilter, status: { $in: ['delivered', 'completed'] } } },
            { $group: { _id: null, total: { $sum: '$pricing.total' }, count: { $sum: 1 } } },
        ]),
        PorterOrder.aggregate([
            {
                $match: {
                    ...baseFilter,
                    status: { $in: ['delivered', 'completed'] },
                    'deliveryState.deliveredAt': { $gte: todayStart },
                },
            },
            { $group: { _id: null, total: { $sum: '$pricing.total' } } },
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
    const completedCount = Number(revenueAgg?.[0]?.count) || 0;
    const todayRevenue = Number(todayRevenueAgg?.[0]?.total) || 0;
    const avgOrderValue = completedCount > 0 ? Math.round(totalRevenue / completedCount) : 0;

    return {
        kpis: {
            totalOrders,
            activeOrders,
            todayOrders,
            deliveredOrders,
            cancelledOrders,
            totalRevenue,
            todayRevenue,
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
            payment: o.payment?.method || 'wallet',
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
            { $group: { _id: '$vehicleName', orders: { $sum: 1 }, revenue: { $sum: '$pricing.total' } } },
            { $sort: { orders: -1 } },
            { $limit: 8 },
        ]),
        PorterOrder.aggregate([
            { $match: { ...baseFilter, createdAt: { $gte: since }, zoneId: { $ne: null } } },
            { $group: { _id: '$zoneId', orders: { $sum: 1 }, revenue: { $sum: '$pricing.total' } } },
            { $sort: { orders: -1 } },
            { $limit: 8 },
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
            orders: z.orders,
            revenue: z.revenue,
        })),
        topDrivers: topDrivers.map((d) => ({
            driverId: String(d._id),
            trips: d.trips,
            earnings: d.earnings,
        })),
        statusBreakdown,
    };
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
            .select({
                orderNumber: 1, status: 1, pricing: 1, payment: 1, createdAt: 1,
                'deliveryState.deliveredAt': 1,
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
                    netPayout: { $sum: '$pricing.driverEarning' },
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
        records: docs.map((o) => ({
            id: String(o._id),
            orderNumber: o.orderNumber,
            amount: o.pricing?.total ?? 0,
            commission: o.pricing?.commission ?? 0,
            tax: o.pricing?.serviceTax ?? 0,
            driverPayout: o.pricing?.driverEarning ?? 0,
            paymentMethod: o.payment?.method,
            status: o.status,
            date: o.deliveryState?.deliveredAt || o.createdAt,
        })),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
}
