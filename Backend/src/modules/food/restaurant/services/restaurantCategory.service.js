import mongoose from 'mongoose';
import { ValidationError } from '../../../../core/auth/errors.js';
import { FoodCategory } from '../../admin/models/category.model.js';
import { FoodItem } from '../../admin/models/food.model.js';
import { FoodRestaurant } from '../models/restaurant.model.js';
import {
    backfillLegacyCategoryWorkflow,
    GLOBAL_CATEGORY_FILTER,
    normalizeCategoryFoodTypeScope,
    serializeCategoryForResponse,
    toObjectId
} from '../../shared/categoryWorkflow.js';

const escapeRegex = (s) => String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const APPROVED_CATEGORY_FILTER = [
    { approvalStatus: 'approved' },
    { approvalStatus: { $exists: false }, isApproved: { $ne: false } }
];

const getRestaurantContext = async (restaurantId) => {
    if (!restaurantId || !mongoose.Types.ObjectId.isValid(String(restaurantId))) {
        throw new ValidationError('Invalid restaurant id');
    }

    const restaurant = await FoodRestaurant.findById(restaurantId)
        .select('zoneId pureVegRestaurant')
        .lean();
    if (!restaurant?._id) {
        throw new ValidationError('Restaurant not found');
    }

    return {
        restaurantId: toObjectId(restaurantId),
        zoneId: restaurant.zoneId ? String(restaurant.zoneId) : '',
        pureVegRestaurant: restaurant.pureVegRestaurant === true
    };
};

const applyZoneVisibilityFilter = (filterAndList, zoneIdRaw) => {
    if (zoneIdRaw && mongoose.Types.ObjectId.isValid(zoneIdRaw)) {
        filterAndList.push({
            $or: [
                { zoneId: new mongoose.Types.ObjectId(zoneIdRaw) },
                { zoneId: { $exists: false } },
                { zoneId: null }
            ]
        });
        return;
    }

    filterAndList.push({
        $or: [{ zoneId: { $exists: false } }, { zoneId: null }]
    });
};

export async function listRestaurantCategories(restaurantId, query = {}) {
    const context = await getRestaurantContext(restaurantId);
    const limit = Math.min(Math.max(parseInt(query.limit, 10) || 1000, 1), 1000);
    const page = Math.max(parseInt(query.page, 10) || 1, 1);
    const skip = (page - 1) * limit;

    const search = typeof query.search === 'string' ? query.search.trim() : '';
    const includeInactive = query.includeInactive === 'true' || query.includeInactive === '1';
    const withCounts = query.withCounts === 'true' || query.withCounts === '1';
    const compact = query.compact === 'true' || query.compact === '1';
    const zoneIdRaw = typeof query.zoneId === 'string' ? query.zoneId.trim() : context.zoneId;

    const filter = {};
    if (!includeInactive) filter.isActive = true;

    const visibilityFilter = compact
        ? {
            $or: [
                {
                    $and: [
                        { $or: GLOBAL_CATEGORY_FILTER },
                        { $or: APPROVED_CATEGORY_FILTER }
                    ]
                },
                {
                    restaurantId: context.restaurantId,
                    $or: APPROVED_CATEGORY_FILTER
                }
            ]
        }
        : {
            $or: [
                {
                    $and: [
                        { $or: GLOBAL_CATEGORY_FILTER },
                        { $or: APPROVED_CATEGORY_FILTER }
                    ]
                },
                { restaurantId: context.restaurantId },
                { createdByRestaurantId: context.restaurantId }
            ]
        };

    filter.$and = [visibilityFilter];
    if (search) {
        const term = escapeRegex(search.slice(0, 80));
        filter.$and.push({ name: { $regex: term, $options: 'i' } });
    }
    applyZoneVisibilityFilter(filter.$and, zoneIdRaw);

    if (compact && context.pureVegRestaurant) {
        filter.$and.push({ foodTypeScope: { $ne: 'Non-Veg' } });
    }

    const queryBuilder = FoodCategory.find(filter)
        .sort({ sortOrder: 1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select(
            compact
                ? 'name image type foodTypeScope approvalStatus rejectionReason zoneId restaurantId createdByRestaurantId isActive sortOrder requestedAt approvedAt rejectedAt globalizedAt'
                : 'name image type foodTypeScope approvalStatus rejectionReason zoneId restaurantId createdByRestaurantId isActive sortOrder requestedAt approvedAt rejectedAt globalizedAt createdAt updatedAt'
        );

    const [list, total] = await Promise.all([
        queryBuilder.lean(),
        FoodCategory.countDocuments(filter)
    ]);

    // Read-only: normalize legacy records in-memory for the response, but never write on a GET.
    const statsById = await backfillLegacyCategoryWorkflow(list, { persist: false });
    const restaurantIds = !compact
        ? Array.from(
            new Set(
                list
                    .flatMap((category) => [category?.restaurantId, category?.createdByRestaurantId])
                    .map((value) => (value ? String(value) : ''))
                    .filter(Boolean)
            )
        )
        : [];
    const restaurants = restaurantIds.length
        ? await FoodRestaurant.find({ _id: { $in: restaurantIds } })
            .select('restaurantName ownerName ownerPhone')
            .lean()
        : [];
    const restaurantMap = new Map(restaurants.map((restaurant) => [String(restaurant._id), restaurant]));

    const hydratedList = !compact
        ? list.map((category) => ({
            ...category,
            restaurantId: category?.restaurantId ? restaurantMap.get(String(category.restaurantId)) || category.restaurantId : category.restaurantId,
            createdByRestaurantId: category?.createdByRestaurantId ? restaurantMap.get(String(category.createdByRestaurantId)) || category.createdByRestaurantId : category.createdByRestaurantId
        }))
        : list;

    const categories = hydratedList.map((category) =>
        serializeCategoryForResponse(category, {
            currentRestaurantId: restaurantId,
            includeCounts: withCounts || !compact,
            statsById
        })
    );

    return { categories, total, page, limit };
}

export async function listPublicCategories(query = {}) {
    const limit = Math.min(Math.max(parseInt(query.limit, 10) || 1000, 1), 1000);
    const page = Math.max(parseInt(query.page, 10) || 1, 1);
    const skip = (page - 1) * limit;

    const search = typeof query.search === 'string' ? query.search.trim() : '';
    const zoneIdRaw = typeof query.zoneId === 'string' ? query.zoneId.trim() : '';

    const approvedCategoryIds = await FoodItem.distinct('categoryId', {
        approvalStatus: 'approved',
        categoryId: { $ne: null }
    });

    if (!approvedCategoryIds.length) {
        return { categories: [], total: 0, page, limit };
    }

    const filter = {
        _id: { $in: approvedCategoryIds },
        isActive: true,
        $and: [{ $or: GLOBAL_CATEGORY_FILTER }, { $or: APPROVED_CATEGORY_FILTER }]
    };

    if (search) {
        const term = escapeRegex(search.slice(0, 80));
        filter.$and.push({ name: { $regex: term, $options: 'i' } });
    }
    applyZoneVisibilityFilter(filter.$and, zoneIdRaw);

    const [list, total] = await Promise.all([
        FoodCategory.find(filter)
            .sort({ sortOrder: 1, createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .select('name image type foodTypeScope zoneId sortOrder createdAt updatedAt')
            .lean(),
        FoodCategory.countDocuments(filter)
    ]);

    // Read-only path; this projection omits fields the backfill would infer from, so persisting
    // here could write wrong values. Normalize in-memory only.
    await backfillLegacyCategoryWorkflow(list, { persist: false });
    const categories = list.map((category) => serializeCategoryForResponse(category));

    return { categories, total, page, limit };
}

/**
 * Return the live status of a single category for a restaurant. Used by the
 * restaurant dashboard to dynamically warn when a previously-used category has
 * been deactivated by the admin, without relying on cached/stale values.
 */
export async function getRestaurantCategoryStatus(restaurantId, id) {
    const context = await getRestaurantContext(restaurantId);
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        throw new ValidationError('Invalid category id');
    }

    const category = await FoodCategory.findById(id)
        .select('name image foodTypeScope approvalStatus isActive restaurantId createdByRestaurantId zoneId')
        .lean();

    if (!category?._id) return null;

    // Read-only status check: normalize in-memory without writing on a GET.
    await backfillLegacyCategoryWorkflow([category], { persist: false });

    return {
        id: String(category._id),
        _id: String(category._id),
        name: category.name || '',
        isActive: category.isActive !== false,
        approvalStatus: category.approvalStatus || 'approved',
        foodTypeScope: normalizeCategoryFoodTypeScope(category.foodTypeScope, 'Veg'),
        ownedByRestaurant:
            String(category.restaurantId || '') === String(context.restaurantId) ||
            String(category.createdByRestaurantId || '') === String(context.restaurantId)
    };
}

export async function createRestaurantCategory(restaurantId, body = {}) {
    const context = await getRestaurantContext(restaurantId);

    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) throw new ValidationError('Category name is required');
    if (name.length > 200) throw new ValidationError('Category name is too long');

    const foodTypeScopeRaw = typeof body.foodTypeScope === 'string' ? body.foodTypeScope.trim() : '';
    if (!foodTypeScopeRaw) {
        throw new ValidationError('Category diet type is required');
    }
    const foodTypeScope = normalizeCategoryFoodTypeScope(foodTypeScopeRaw, '');
    if (!foodTypeScope) {
        throw new ValidationError('Invalid category diet type');
    }
    if (!['Veg', 'Non-Veg'].includes(foodTypeScope)) {
        throw new ValidationError('Category diet type must be Veg or Non-Veg');
    }
    if (context.pureVegRestaurant && foodTypeScope !== 'Veg') {
        throw new ValidationError('Pure veg restaurants can only create veg categories');
    }

    const doc = new FoodCategory({
        name,
        image: typeof body.image === 'string' ? body.image.trim() : '',
        type: typeof body.type === 'string' ? body.type.trim() : '',
        foodTypeScope,
        isActive: body.isActive !== false,
        sortOrder: Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 0,
        restaurantId: context.restaurantId,
        createdByRestaurantId: context.restaurantId,
        approvalStatus: 'pending',
        isApproved: false,
        rejectionReason: '',
        requestedAt: new Date(),
        zoneId: context.zoneId && mongoose.Types.ObjectId.isValid(context.zoneId)
            ? new mongoose.Types.ObjectId(context.zoneId)
            : undefined
    });
    await doc.save();
    return doc.toObject();
}

export async function updateRestaurantCategory(restaurantId, id, body = {}) {
    const context = await getRestaurantContext(restaurantId);
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        throw new ValidationError('Invalid category id');
    }

    const doc = await FoodCategory.findOne({ _id: id, restaurantId: context.restaurantId });
    if (!doc) return null;

    const nextFoodTypeScope = body.foodTypeScope !== undefined
        ? normalizeCategoryFoodTypeScope(body.foodTypeScope, '')
        : normalizeCategoryFoodTypeScope(doc.foodTypeScope, 'Veg');
    if (body.foodTypeScope !== undefined && !nextFoodTypeScope) {
        throw new ValidationError('Invalid category diet type');
    }
    if (body.foodTypeScope !== undefined && !['Veg', 'Non-Veg'].includes(nextFoodTypeScope)) {
        throw new ValidationError('Category diet type must be Veg or Non-Veg');
    }
    if (context.pureVegRestaurant && nextFoodTypeScope !== 'Veg') {
        throw new ValidationError('Pure veg restaurants can only keep veg categories');
    }

    let needsApproval = false;

    if (body.name !== undefined) {
        const name = String(body.name || '').trim();
        if (!name) throw new ValidationError('Category name is required');
        if (name.length > 200) throw new ValidationError('Category name is too long');
        if (doc.name !== name) {
            doc.name = name;
            needsApproval = true;
        }
    }
    if (body.image !== undefined) {
        const image = String(body.image || '').trim();
        if (doc.image !== image) {
            doc.image = image;
            needsApproval = true;
        }
    }
    if (body.type !== undefined) {
        const type = String(body.type || '').trim();
        if (doc.type !== type) {
            doc.type = type;
            needsApproval = true;
        }
    }
    if (body.isActive !== undefined) {
        doc.isActive = body.isActive !== false;
    }
    if (body.sortOrder !== undefined) {
        const sortOrder = Number(body.sortOrder) || 0;
        if (doc.sortOrder !== sortOrder) {
            doc.sortOrder = sortOrder;
            needsApproval = true;
        }
    }
    if (body.foodTypeScope !== undefined) {
        const incompatibleFoods = await FoodItem.countDocuments({
            categoryId: doc._id,
            foodType: nextFoodTypeScope === 'Veg' ? 'Non-Veg' : 'Veg'
        });
        if (incompatibleFoods > 0) {
            throw new ValidationError(`This category already has ${incompatibleFoods} food item(s) outside the selected diet type`);
        }
        if (doc.foodTypeScope !== nextFoodTypeScope) {
            doc.foodTypeScope = nextFoodTypeScope;
            needsApproval = true;
        }
    }

    if (needsApproval) {
        doc.createdByRestaurantId = doc.createdByRestaurantId || context.restaurantId;
        doc.approvalStatus = 'pending';
        doc.isApproved = false;
        doc.rejectionReason = '';
        doc.requestedAt = new Date();
        doc.approvedAt = undefined;
        doc.rejectedAt = undefined;
    }

    await doc.save();
    return doc.toObject();
}

export async function deleteRestaurantCategory(restaurantId, id) {
    const context = await getRestaurantContext(restaurantId);
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        throw new ValidationError('Invalid category id');
    }

    const category = await FoodCategory.findOne({ _id: id, restaurantId: context.restaurantId })
        .select('_id name')
        .lean();
    if (!category?._id) return null;

    const linkedItems = await FoodItem.find({
        categoryId: id,
        restaurantId: context.restaurantId
    })
        .select('_id name categoryName')
        .lean();

    if (linkedItems.length > 0) {
        await FoodItem.updateMany(
            { categoryId: id, restaurantId: context.restaurantId },
            {
                $set: {
                    isAvailable: false,
                    categoryId: null
                }
            }
        );
    }

    const deleted = await FoodCategory.findOneAndDelete({ _id: id, restaurantId: context.restaurantId }).lean();
    if (!deleted) return null;

    return {
        id,
        deactivatedItemCount: linkedItems.length,
        deactivatedItemIds: linkedItems.map((item) => String(item._id))
    };
}
