import mongoose from 'mongoose';
import { FoodItem } from '../admin/models/food.model.js';

export const CATEGORY_APPROVAL_STATUSES = ['pending', 'approved', 'rejected'];
export const CATEGORY_FOOD_TYPE_SCOPES = ['Veg', 'Non-Veg'];
export const GLOBAL_CATEGORY_FILTER = [{ restaurantId: { $exists: false } }, { restaurantId: null }];

export const toObjectId = (value) => new mongoose.Types.ObjectId(String(value));

export const normalizeCategoryApprovalStatus = (value, fallback = 'pending') => {
    const normalized = String(value || '').trim();
    return CATEGORY_APPROVAL_STATUSES.includes(normalized) ? normalized : fallback;
};

export const normalizeCategoryFoodTypeScope = (value, fallback = 'Veg') => {
    const normalized = String(value || '').trim();
    if (normalized === 'Both') {
        return CATEGORY_FOOD_TYPE_SCOPES.includes(fallback) ? fallback : 'Veg';
    }
    return CATEGORY_FOOD_TYPE_SCOPES.includes(normalized) ? normalized : fallback;
};

export const normalizeFoodTypeForCategory = (value) => {
    const normalized = String(value || '').trim();
    if (normalized === 'Veg') return 'Veg';
    return 'Non-Veg';
};

export const categoryAllowsFoodType = (scope, foodType) => {
    const rawScope = String(scope || '').trim();
    const normalizedFoodType = normalizeFoodTypeForCategory(foodType);
    if (rawScope === 'Both') return true;
    const normalizedScope = normalizeCategoryFoodTypeScope(scope, '');
    if (!normalizedScope) return false;
    return normalizedScope === normalizedFoodType;
};

export const isGlobalCategory = (category = {}) => {
    const restaurantId = category?.restaurantId;
    return !restaurantId;
};

export const getCategoryApprovalStatus = (category = {}) => {
    if (CATEGORY_APPROVAL_STATUSES.includes(String(category?.approvalStatus || '').trim())) {
        return String(category.approvalStatus).trim();
    }
    return category?.isApproved === false ? 'pending' : 'approved';
};

const buildCategoryStatsMap = async (categoryIds = []) => {
    const validIds = Array.from(
        new Set(
            (categoryIds || [])
                .map((value) => {
                    if (!value) return '';
                    const raw = String(value);
                    return mongoose.Types.ObjectId.isValid(raw) ? raw : '';
                })
                .filter(Boolean)
        )
    ).map((value) => new mongoose.Types.ObjectId(value));

    if (!validIds.length) return new Map();

    const stats = await FoodItem.aggregate([
        { $match: { categoryId: { $in: validIds } } },
        {
            $group: {
                _id: '$categoryId',
                totalFoods: { $sum: 1 },
                vegFoods: {
                    $sum: {
                        $cond: [{ $eq: ['$foodType', 'Veg'] }, 1, 0]
                    }
                },
                approvedFoods: {
                    $sum: {
                        $cond: [{ $eq: ['$approvalStatus', 'approved'] }, 1, 0]
                    }
                }
            }
        }
    ]);

    return new Map(stats.map((item) => [String(item._id), item]));
};

/**
 * Normalizes legacy category records (missing approvalStatus/foodTypeScope/createdByRestaurantId)
 * and returns a stats map keyed by category id.
 *
 * @param {Array} categories
 * @param {Object} [options]
 * @param {boolean} [options.persist=true] When false, legacy fields are normalized in-memory only
 *        and NOT written back to MongoDB. Use this for read-only paths (e.g. list endpoints) so a
 *        GET never mutates the database. The returned/serialized data is unchanged either way.
 */
export const backfillLegacyCategoryWorkflow = async (categories = [], options = {}) => {
    const { persist = true } = options;
    const list = Array.isArray(categories) ? categories.filter(Boolean) : [];
    if (!list.length) return new Map();

    const statsById = await buildCategoryStatsMap(list.map((category) => category?._id || category?.id));
    const writes = [];

    for (const category of list) {
        const categoryId = String(category?._id || category?.id || '');
        if (!categoryId) continue;

        const stats = statsById.get(categoryId) || null;
        const next = {};
        const hasRestaurantOwner = Boolean(category?.restaurantId);
        const currentApprovalStatus = String(category?.approvalStatus || '').trim();
        const currentFoodTypeScope = String(category?.foodTypeScope || '').trim();

        if (!category?.createdByRestaurantId && hasRestaurantOwner) {
            next.createdByRestaurantId = category.restaurantId;
        }

        if (!CATEGORY_APPROVAL_STATUSES.includes(currentApprovalStatus)) {
            let approvalStatus = 'approved';
            if (hasRestaurantOwner) {
                if (Number(stats?.totalFoods || 0) > 0) {
                    approvalStatus = 'approved';
                } else if (category?.isApproved === false) {
                    approvalStatus = 'pending';
                }
            } else if (category?.isApproved === false) {
                approvalStatus = 'pending';
            }

            next.approvalStatus = approvalStatus;
            next.isApproved = approvalStatus === 'approved';
            if (approvalStatus === 'approved' && !category?.approvedAt) {
                next.approvedAt = category?.updatedAt || category?.createdAt || new Date();
            }
            if (approvalStatus === 'pending' && !category?.requestedAt) {
                next.requestedAt = category?.updatedAt || category?.createdAt || new Date();
            }
        }

        if (!CATEGORY_FOOD_TYPE_SCOPES.includes(currentFoodTypeScope) || currentFoodTypeScope === 'Both') {
            let foodTypeScope = 'Veg';
            if (Number(stats?.totalFoods || 0) > 0) {
                const vegFoods = Number(stats?.vegFoods || 0);
                const totalFoods = Number(stats?.totalFoods || 0);
                foodTypeScope = vegFoods === totalFoods ? 'Veg' : 'Non-Veg';
            }
            next.foodTypeScope = foodTypeScope;
        }

        if (Object.keys(next).length > 0) {
            writes.push({
                updateOne: {
                    filter: { _id: category._id || category.id },
                    update: { $set: next }
                }
            });
            Object.assign(category, next);
        }
    }

    if (writes.length && persist) {
        const { FoodCategory } = await import('../admin/models/category.model.js');
        await FoodCategory.bulkWrite(writes, { ordered: false });
    }

    return statsById;
};

export const serializeCategoryForResponse = (category = {}, options = {}) => {
    const statsById = options.statsById instanceof Map ? options.statsById : new Map();
    const categoryId = String(category?._id || category?.id || '');
    const stats = statsById.get(categoryId) || null;
    const approvalStatus = getCategoryApprovalStatus(category);
    const restaurantId = category?.restaurantId?._id
        ? String(category.restaurantId._id)
        : (category?.restaurantId ? String(category.restaurantId) : null);
    const createdByRestaurantId = category?.createdByRestaurantId?._id
        ? String(category.createdByRestaurantId._id)
        : (category?.createdByRestaurantId ? String(category.createdByRestaurantId) : null);
    const isGlobal = !restaurantId;
    const isOwnedByRestaurant = options.currentRestaurantId
        ? createdByRestaurantId === String(options.currentRestaurantId) || restaurantId === String(options.currentRestaurantId)
        : false;

    return {
        id: category._id || category.id,
        _id: category._id || category.id,
        name: category.name,
        image: category.image || '',
        type: category.type || '',
        status: category.isActive !== false,
        isActive: category.isActive !== false,
        isApproved: approvalStatus === 'approved',
        approvalStatus,
        foodTypeScope: normalizeCategoryFoodTypeScope(category.foodTypeScope, 'Veg'),
        rejectionReason: category.rejectionReason || '',
        restaurantId,
        createdByRestaurantId,
        isGlobal,
        globalizedAt: category.globalizedAt || null,
        requestedAt: category.requestedAt || null,
        approvedAt: category.approvedAt || null,
        rejectedAt: category.rejectedAt || null,
        ownedByRestaurant: isOwnedByRestaurant,
        canEdit: options.currentRestaurantId
            ? Boolean(restaurantId && restaurantId === String(options.currentRestaurantId))
            : true,
        canDelete: options.currentRestaurantId
            ? Boolean(restaurantId && restaurantId === String(options.currentRestaurantId))
            : true,
        restaurant: category?.restaurantId?._id
            ? {
                _id: category.restaurantId._id,
                name: category.restaurantId.restaurantName || '',
                ownerName: category.restaurantId.ownerName || '',
                ownerPhone: category.restaurantId.ownerPhone || ''
            }
            : null,
        createdByRestaurant: category?.createdByRestaurantId?._id
            ? {
                _id: category.createdByRestaurantId._id,
                name: category.createdByRestaurantId.restaurantName || '',
                ownerName: category.createdByRestaurantId.ownerName || '',
                ownerPhone: category.createdByRestaurantId.ownerPhone || ''
            }
            : null,
        zoneId: category.zoneId || null,
        sortOrder: category.sortOrder || 0,
        itemCount: options.includeCounts ? Number(stats?.totalFoods || 0) : undefined,
        approvedFoodCount: options.includeCounts ? Number(stats?.approvedFoods || 0) : undefined,
        createdAt: category.createdAt,
        updatedAt: category.updatedAt
    };
};
