import mongoose from 'mongoose';
import { FoodUser } from '../../../core/users/user.model.js';
import { NotFoundError } from '../../../core/auth/errors.js';
import { parseListQuery, buildDateRangeFilter, toPorterPagination, escapeRegex } from '../utils/pagination.util.js';
import { mapPorterUser } from '../utils/mappers.util.js';
import { validateUpdatePorterUserDto, validateUserId } from '../validators/user.validator.js';
import { validateListQuery } from '../validators/listQuery.validator.js';

import { PorterOrder } from '../orders/models/porterOrder.model.js';

const baseFilter = {
    role: { $in: ['USER', null] },
    isDeleted: { $ne: true },
};

const buildSort = (sortBy, sortOrder) => {
    const map = {
        name: 'name',
        totalOrders: 'createdAt',
        walletBalance: 'walletBalance',
        createdAt: 'createdAt',
    };
    const key = map[sortBy] || 'createdAt';
    return { [key]: sortOrder };
};

export async function listPorterUsers(query = {}) {
    validateListQuery(query);
    const parsed = parseListQuery(query);
    const filter = { ...baseFilter };

    if (parsed.status === 'active') filter.isActive = true;
    if (parsed.status === 'inactive') filter.isActive = false;

    if (parsed.verification === 'verified') filter.isVerified = true;
    if (parsed.verification === 'pending') filter.isVerified = { $ne: true };


    if (parsed.search) {
        const term = escapeRegex(parsed.search);
        filter.$or = [
            { name: { $regex: term, $options: 'i' } },
            { email: { $regex: term, $options: 'i' } },
            { phone: { $regex: term, $options: 'i' } },
        ];
    }

    const dateRange = buildDateRangeFilter(parsed.createdFrom, parsed.createdTo);
    if (dateRange) filter.createdAt = dateRange;

    const sort = buildSort(parsed.sortBy, parsed.sortOrder);

    const [docs, total] = await Promise.all([
        FoodUser.find(filter)
            .sort(sort)
            .skip(parsed.skip)
            .limit(parsed.limit)
            .select('name email phone countryCode profileImage walletBalance isVerified isActive address addresses createdAt')
            .lean(),
        FoodUser.countDocuments(filter),
    ]);

    const userIds = docs.map(d => d._id);
    const stats = await PorterOrder.aggregate([
        { $match: { userId: { $in: userIds }, isDeleted: false } },
        {
            $group: {
                _id: "$userId",
                totalOrders: { $sum: 1 },
                completedOrders: {
                    $sum: { $cond: [{ $in: ["$status", ["completed", "delivered"]] }, 1, 0] }
                },
                cancelledOrders: {
                    $sum: { $cond: [{ $in: ["$status", ["cancelled_by_user", "cancelled_by_admin", "cancelled_by_driver", "failed"]] }, 1, 0] }
                }
            }
        }
    ]);

    const statsMap = {};
    stats.forEach(s => {
        statsMap[s._id.toString()] = {
            totalOrders: s.totalOrders,
            completedOrders: s.completedOrders,
            cancelledOrders: s.cancelledOrders,
        };
    });

    const records = docs.map((doc) => {
        const userStats = statsMap[doc._id.toString()] || {};
        return mapPorterUser(doc, { ...userStats });
    });
    return toPorterPagination({ docs: records, total, page: parsed.page, limit: parsed.limit });
}

export async function getPorterUserById(id) {
    const userId = validateUserId(id);
    const doc = await FoodUser.findOne({ _id: userId, ...baseFilter })
        .select('name email phone countryCode profileImage walletBalance isVerified isActive address addresses createdAt')
        .lean();

    if (!doc) throw new NotFoundError('User not found');

    const stats = await PorterOrder.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(userId), isDeleted: false } },
        {
            $group: {
                _id: null,
                totalOrders: { $sum: 1 },
                completedOrders: {
                    $sum: { $cond: [{ $in: ["$status", ["completed", "delivered"]] }, 1, 0] }
                },
                cancelledOrders: {
                    $sum: { $cond: [{ $in: ["$status", ["cancelled_by_user", "cancelled_by_admin", "cancelled_by_driver", "failed"]] }, 1, 0] }
                }
            }
        }
    ]);

    const recentOrderDocs = await PorterOrder.find({ userId, isDeleted: false })
        .sort({ createdAt: -1 })
        .limit(5)
        .lean();

    const recentOrders = recentOrderDocs.map(o => ({
        id: o.orderNumber || String(o._id),
        goodsType: o.parcel?.parcelName || o.vehicleName || 'Parcel',
        amount: o.pricing?.total || 0,
        status: o.status
    }));

    const userStats = stats.length > 0 ? {
        totalOrders: stats[0].totalOrders,
        completedOrders: stats[0].completedOrders,
        cancelledOrders: stats[0].cancelledOrders,
    } : {};

    return mapPorterUser(doc, { ...userStats, recentOrders });
}

export async function updatePorterUser(id, body) {
    const userId = validateUserId(id);
    const doc = await FoodUser.findOne({ _id: userId, ...baseFilter });
    if (!doc) throw new NotFoundError('User not found');

    if (body.walletBalance !== undefined) {
        doc.walletBalance = Number(body.walletBalance);
    }
    
    await doc.save();
    return getPorterUserById(id);
}
