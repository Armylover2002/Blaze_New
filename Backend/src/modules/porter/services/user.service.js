import { FoodUser } from '../../../core/users/user.model.js';
import { NotFoundError } from '../../../core/auth/errors.js';
import { parseListQuery, buildDateRangeFilter, toPorterPagination, escapeRegex } from '../utils/pagination.util.js';
import { mapPorterUser } from '../utils/mappers.util.js';
import { validateUpdatePorterUserDto, validateUserId } from '../validators/user.validator.js';
import { validateListQuery } from '../validators/listQuery.validator.js';

const baseFilter = {
    role: 'USER',
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

    const records = docs.map((doc) => mapPorterUser(doc));
    return toPorterPagination({ docs: records, total, page: parsed.page, limit: parsed.limit });
}

export async function getPorterUserById(id) {
    const userId = validateUserId(id);
    const doc = await FoodUser.findOne({ _id: userId, ...baseFilter })
        .select('name email phone countryCode profileImage walletBalance isVerified isActive address addresses createdAt')
        .lean();

    if (!doc) throw new NotFoundError('User not found');
    return mapPorterUser(doc);
}
