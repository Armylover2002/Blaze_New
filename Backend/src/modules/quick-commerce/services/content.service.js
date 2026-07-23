
import mongoose from 'mongoose';
import { QuickCategory } from '../models/category.model.js';
import { QuickProduct } from '../models/product.model.js';
import { QuickExperienceSection } from '../models/experience.model.js';
import { QuickHeroConfig } from '../models/heroConfig.model.js';
import {
  buildQuickCouponDateQuery,
  enrichQuickCoupon,
  isQuickCouponCurrentlyValid,
  isQuickCouponExpired,
  normalizeCouponValidFrom,
  normalizeCouponValidTill,
  startOfDay,
} from '../utils/coupon.helpers.js';

const CATEGORY_SELECT_FIELDS = '_id name slug image status isActive type parentId iconId headerColor accentColor handlingFees adminCommission approvalStatus sortOrder';
const PRODUCT_SELECT_FIELDS = '_id name slug mainImage image galleryImages categoryId subcategoryId headerId price salePrice mrp unit stock status isActive brand description tags variants pharmacyDetails deliveryTime rating badge approvalStatus sellerId';


const getCollection = (name) => mongoose.connection?.db?.collection(name) || null;

// --- In-memory Cache ---
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const cache = {
  settings: { data: null, expiry: 0 },
  hero: { data: new Map(), expiry: 0 },
  experience: { data: new Map(), expiry: 0 },
  offerSections: { data: null, expiry: 0 },
  categories: { data: null, treeInfo: null, expiry: 0 },
  coupons: { data: null, expiry: 0 },
  offers: { data: null, expiry: 0 },
};

const isExpired = (expiry) => Date.now() > expiry;

const buildCategoryTreeInfo = (allCategories = []) => {
  const childrenMap = new Map();
  allCategories.forEach((c) => {
    if (c.parentId) {
      const pid = String(c.parentId);
      if (!childrenMap.has(pid)) childrenMap.set(pid, []);
      childrenMap.get(pid).push(c);
    }
  });

  const getRecursiveChildIds = (catId, seen = new Set()) => {
    const id = String(catId);
    if (seen.has(id)) return [];
    seen.add(id);
    let ids = [id];
    const children = childrenMap.get(id) || [];
    children.forEach((child) => {
      ids = [...ids, ...getRecursiveChildIds(child._id, seen)];
    });
    return ids;
  };

  return { allCategories, childrenMap, getRecursiveChildIds };
};

export const clearContentCache = () => {
  cache.settings.expiry = 0;
  cache.hero.data.clear();
  cache.experience.data.clear();
  cache.offerSections.expiry = 0;
  cache.categories.data = null;
  cache.categories.treeInfo = null;
  cache.categories.expiry = 0;
  cache.coupons.data = null;
  cache.coupons.expiry = 0;
  cache.offers.data = null;
  cache.offers.expiry = 0;
};

const toIdString = (value) => {
  if (!value) return null;
  if (typeof value === 'object' && value !== null) {
    if (value._id) return String(value._id);
    if (value.id) return String(value.id);
  }
  return String(value);
};

const normalizeStatusQuery = () => ({
  $and: [
    {
      $or: [
        { status: 'active' },
        { status: { $exists: false } },
        { isActive: true },
        { isActive: { $exists: false } },
      ],
    },
  ],
});

const approvedOrLegacyFilter = {
  $and: [
    {
      $or: [
        { approvalStatus: 'approved' },
        { approvalStatus: { $exists: false } },
      ],
    },
  ],
};

export const getQuickSettings = async () => {
  if (cache.settings.data && !isExpired(cache.settings.expiry)) {
    return cache.settings.data;
  }

  const collection = getCollection('quick_settings');
  if (!collection) return null;
  const data = await collection.findOne({}, { sort: { updatedAt: -1, createdAt: -1 } });
  
  cache.settings.data = data;
  cache.settings.expiry = Date.now() + CACHE_TTL;
  return data;
};

export const getQuickHeroConfig = async ({ pageType = 'home', headerId = null } = {}) => {
  const cacheKey = `${pageType}:${headerId}`;
  if (cache.hero.data.has(cacheKey) && !isExpired(cache.hero.expiry)) {
    return cache.hero.data.get(cacheKey);
  }

  const collection = getCollection('quick_hero_configs');
  if (!collection) return null;

  const query = { pageType };
  if (pageType === 'header') {
    query.headerId = headerId ? String(headerId) : null;
  }

  const data = await QuickHeroConfig.findOne(query).sort({ updatedAt: -1, createdAt: -1 }).lean();
  
  cache.hero.data.set(cacheKey, data);
  cache.hero.expiry = Date.now() + CACHE_TTL;
  return data;
};

export const getAllQuickHeroConfigs = async () => {
  const collection = getCollection('quick_hero_configs');
  if (!collection) return [];
  return QuickHeroConfig.find({}).lean();
};

export const setQuickHeroConfig = async (data) => {
  const query = { pageType: data.pageType };
  if (data.pageType === 'header') {
    query.headerId = data.headerId ? String(data.headerId) : null;
  }

  const result = await QuickHeroConfig.findOneAndUpdate(
    query,
    { $set: data },
    { upsert: true, new: true }
  ).lean();
  clearContentCache();
  return result;
};

export const getQuickExperienceSections = async ({ pageType = 'home', headerId = null } = {}) => {
  const cacheKey = `${pageType}:${headerId}`;
  if (cache.experience.data.has(cacheKey) && !isExpired(cache.experience.expiry)) {
    if (process.env.DEBUG_QUICK_EXPERIENCE === 'true') {
      const cached = cache.experience.data.get(cacheKey) || [];
      console.log('[quick-commerce] getQuickExperienceSections cache HIT', {
        cacheKey,
        pageType,
        headerId,
        headerIdType: typeof headerId,
        cachedCount: Array.isArray(cached) ? cached.length : 0,
        cachedIds: Array.isArray(cached) ? cached.map((s) => String(s?._id)) : [],
        cachedDisplayTypes: Array.isArray(cached) ? cached.map((s) => s?.displayType) : [],
      });
    }
    return cache.experience.data.get(cacheKey);
  }

  const collection = getCollection('quick_experience_sections');
  if (!collection) return [];

  const query = {
    pageType,
    ...normalizeStatusQuery(),
  };

  if (pageType === 'header') {
    query.headerId = headerId ? String(headerId) : null;
  }

  if (process.env.DEBUG_QUICK_EXPERIENCE === 'true') {
    console.log('[quick-commerce] getQuickExperienceSections cache MISS', {
      cacheKey,
      pageType,
      headerId,
      headerIdType: typeof headerId,
      mongoQuery: query,
    });
  }

  const sections = await QuickExperienceSection.find(query).sort({ order: 1, createdAt: 1 }).lean();
  if (process.env.DEBUG_QUICK_EXPERIENCE === 'true') {
    console.log('[quick-commerce] getQuickExperienceSections raw mongo sections', {
      count: Array.isArray(sections) ? sections.length : 0,
      ids: Array.isArray(sections) ? sections.map((s) => String(s?._id)) : [],
      displayTypes: Array.isArray(sections) ? sections.map((s) => s?.displayType) : [],
      titles: Array.isArray(sections) ? sections.map((s) => s?.title) : [],
      headerIdValues: Array.isArray(sections) ? sections.map((s) => String(s?.headerId ?? '')) : [],
    });
  }
  if (!sections.length) return [];

  // --- Category Tree Logic (Optimized) ---
  const getCategoryTreeInfo = async () => {
    if (cache.categories.data && !isExpired(cache.categories.expiry)) {
      if (cache.categories.treeInfo) {
        return cache.categories.treeInfo;
      }
      const treeInfo = buildCategoryTreeInfo(cache.categories.data);
      cache.categories.treeInfo = treeInfo;
      return treeInfo;
    }
    const allCategories = await QuickCategory.find(normalizeStatusQuery()).select(CATEGORY_SELECT_FIELDS).lean();
    const treeInfo = buildCategoryTreeInfo(allCategories);
    cache.categories.data = allCategories;
    cache.categories.treeInfo = treeInfo;
    cache.categories.expiry = Date.now() + CACHE_TTL;
    return treeInfo;
  };

  const { getRecursiveChildIds } = await getCategoryTreeInfo();

  // Hydrate data
  const productIds = new Set();
  const categoryIds = new Set();
  const subcategoryIds = new Set();
  
  const dynamicProductCategoryIds = new Set();
  const dynamicProductSubcategoryIds = new Set();

  sections.forEach((section) => {
    const { config = {} } = section;
    const typeConfig = config[section.displayType] || config; // Handle both nested and flat
    
    // Banners
    const bannerItems = typeConfig.banners?.items || typeConfig.items || [];

    // Categories
    const catIds = typeConfig.categoryIds || [];
    catIds.forEach(id => {
      const nid = toIdString(id);
      if (nid) categoryIds.add(nid);
    });

    // Subcategories
    const subcatIds = typeConfig.subcategoryIds || [];
    subcatIds.forEach(id => {
      const nid = toIdString(id);
      if (nid) subcategoryIds.add(nid);
    });

    // Products
    const prodIds = typeConfig.productIds || [];
    prodIds.forEach(id => {
      const nid = toIdString(id);
      if (nid) productIds.add(nid);
    });

    // If products type and no explicit products, collect categories for dynamic fetch
    if (section.displayType === 'products' && (!prodIds || prodIds.length === 0)) {
       catIds.forEach(id => {
         const nid = toIdString(id);
         if (nid) {
            getRecursiveChildIds(nid).forEach(childId => dynamicProductCategoryIds.add(childId));
         }
       });
       subcatIds.forEach(id => {
         const nid = toIdString(id);
         if (nid) {
            getRecursiveChildIds(nid).forEach(childId => dynamicProductSubcategoryIds.add(childId));
         }
       });
    }
  });

  // Pre-fetch products for dynamic product sections
  if (query.pageType === 'header' && query.headerId) {
    const childCategories = (cache.categories.data || [])
      .filter(c => String(c.parentId) === String(query.headerId) && c.isActive !== false);
    
    childCategories.forEach(c => {
      const nid = toIdString(c._id);
      if (nid) {
        getRecursiveChildIds(nid).forEach(childId => dynamicProductCategoryIds.add(childId));
      }
    });
  }

  const [products, categories] = await Promise.all([
    (productIds.size || dynamicProductCategoryIds.size || dynamicProductSubcategoryIds.size)
      ? QuickProduct.find({ 
          $and: [
            { 
              $or: [
                { _id: { $in: Array.from(productIds) } },
                { categoryId: { $in: Array.from(dynamicProductCategoryIds) } },
                { subcategoryId: { $in: Array.from(dynamicProductSubcategoryIds) } },
                { headerId: { $in: Array.from(dynamicProductCategoryIds) } }
              ]
            },
            approvedOrLegacyFilter,
            { isActive: { $ne: false } }
          ]
        }).select(PRODUCT_SELECT_FIELDS).sort({ createdAt: -1 }).limit(500).lean()
      : Promise.resolve([]),
    (categoryIds.size || subcategoryIds.size)
      ? QuickCategory.find({
          _id: { $in: Array.from(new Set([...Array.from(categoryIds), ...Array.from(subcategoryIds)])) },
          isActive: { $ne: false }
        }).select(CATEGORY_SELECT_FIELDS).lean()
      : Promise.resolve([]),
  ]);

  const productsById = new Map(products.map((p) => [String(p._id), p]));
  const categoriesById = new Map(categories.map((c) => [String(c._id), c]));

  const finalSections = sections.map((section) => {
    const { config = {} } = section;
    const typeConfig = config[section.displayType] || config;
    const newConfig = { ...config };

    if (section.displayType === 'categories') {
      const target = config.categories ? { ...config.categories } : { ...config };
      target.items = (target.categoryIds || [])
          .map(id => categoriesById.get(toIdString(id)))
          .filter(Boolean);
      
      newConfig.categories = target;
    }

    if (section.displayType === 'subcategories') {
      const target = config.subcategories ? { ...config.subcategories } : { ...config };
      target.items = (target.subcategoryIds || [])
          .map(id => categoriesById.get(toIdString(id)))
          .filter(Boolean);
      
      newConfig.subcategories = target;
    }

    if (section.displayType === 'products') {
      const target = config.products ? { ...config.products } : { ...config };
      const explicitItems = (target.productIds || [])
          .map(id => productsById.get(toIdString(id)))
          .filter(Boolean);
      
      if (explicitItems.length > 0) {
        target.items = explicitItems;
      } else {
        const sectionCatIds = new Set((target.categoryIds || []).map(toIdString).filter(Boolean));
        const sectionSubcatIds = new Set((target.subcategoryIds || []).map(toIdString).filter(Boolean));
        
        const expandedCatIds = new Set();
        sectionCatIds.forEach(id => getRecursiveChildIds(id).forEach(cid => expandedCatIds.add(cid)));
        const expandedSubcatIds = new Set();
        sectionSubcatIds.forEach(id => getRecursiveChildIds(id).forEach(cid => expandedSubcatIds.add(cid)));

        target.items = products.filter(p => 
          expandedCatIds.has(toIdString(p.categoryId)) || 
          expandedSubcatIds.has(toIdString(p.subcategoryId)) ||
          expandedCatIds.has(toIdString(p.headerId))
        ).slice(0, (target.rows || 1) * (target.columns || 4) || 20);
      }
      
      newConfig.products = target;
    }

    return {
      ...section,
      config: newConfig
    };
  });

  let augmentedSections = [...finalSections];

  // Generate Dynamic Product Sections
  if (query.pageType === 'header' && query.headerId) {
    const existingProductCatIds = new Set();
    augmentedSections.forEach(sec => {
      if (sec.displayType === 'products') {
        const prodConfig = sec.config?.products || sec.config || {};
        const catIds = prodConfig.categoryIds || [];
        catIds.forEach(id => existingProductCatIds.add(toIdString(id)));
      }
    });

    const childCategories = (cache.categories.data || [])
      .filter(c => String(c.parentId) === String(query.headerId) && c.isActive !== false)
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

    let maxOrder = augmentedSections.length > 0 ? Math.max(...augmentedSections.map(s => s.order || 0)) : 0;

    childCategories.forEach((childCat, idx) => {
      const catIdStr = toIdString(childCat._id);
      if (!existingProductCatIds.has(catIdStr)) {
        const expandedCatIds = new Set();
        getRecursiveChildIds(catIdStr).forEach(cid => expandedCatIds.add(cid));
        
        const catProducts = products.filter(p => expandedCatIds.has(toIdString(p.categoryId))).slice(0, 20);

        if (catProducts.length > 0) {
          const virtualSection = {
            _id: `virtual_${catIdStr}`,
            pageType: "header",
            headerId: query.headerId,
            displayType: "products",
            title: childCat.name,
            status: "active",
            order: maxOrder + 1 + idx,
            config: {
              products: {
                categoryIds: [childCat._id],
                subcategoryIds: [],
                productIds: [],
                rows: 2,
                columns: 2,
                singleRowScrollable: false,
                items: catProducts
              }
            }
          };
          augmentedSections.push(virtualSection);
        }
      }
    });
  }

  if (process.env.DEBUG_QUICK_EXPERIENCE === 'true') {
    console.log('[quick-commerce] getQuickExperienceSections final sections (post-hydration)', {
      count: Array.isArray(augmentedSections) ? augmentedSections.length : 0,
      ids: Array.isArray(augmentedSections) ? augmentedSections.map((s) => String(s?._id)) : [],
      displayTypes: Array.isArray(augmentedSections) ? augmentedSections.map((s) => s?.displayType) : [],
      categoriesItemsCounts: Array.isArray(augmentedSections)
        ? augmentedSections.map((s) => (s?.displayType === 'categories' ? (s?.config?.categories?.items || []).length : null))
        : [],
      productsItemsCounts: Array.isArray(augmentedSections)
        ? augmentedSections.map((s) => (s?.displayType === 'products' ? (s?.config?.products?.items || []).length : null))
        : [],
    });
  }

  cache.experience.data.set(cacheKey, augmentedSections);
  cache.experience.expiry = Date.now() + CACHE_TTL;
  return augmentedSections;
};

export const createQuickExperienceSection = async (data) => {
  // Get max order to append at end
  const maxSection = await QuickExperienceSection.findOne({
    pageType: data.pageType,
    headerId: data.headerId || null
  }).sort({ order: -1 });
  
  const order = (maxSection?.order ?? -1) + 1;
  return QuickExperienceSection.create({ ...data, order });
};

export const updateQuickExperienceSection = async (id, data) => {
  return QuickExperienceSection.findByIdAndUpdate(id, { $set: data }, { new: true }).lean();
};

export const deleteQuickExperienceSection = async (id) => {
  return QuickExperienceSection.findByIdAndDelete(id);
};

export const reorderQuickExperienceSections = async (items = []) => {
  const ops = items.map((item) => ({
    updateOne: {
      filter: { _id: item.id },
      update: { $set: { order: item.order } },
    },
  }));
  if (!ops.length) return;
  return QuickExperienceSection.bulkWrite(ops);
};

export const expireStaleQuickCoupons = async () => {
  const collection = getCollection('quick_coupons');
  if (!collection) return 0;

  const now = new Date();
  const today = startOfDay(now);
  const result = await collection.updateMany(
    {
      isActive: true,
      validTill: { $type: 'date', $lt: today },
    },
    { $set: { isActive: false, status: 'expired', updatedAt: now } },
  );

  return Number(result?.modifiedCount || 0);
};

export const getQuickCoupons = async () => {
  if (cache.coupons.data && !isExpired(cache.coupons.expiry)) {
    return cache.coupons.data;
  }

  const collection = getCollection('quick_coupons');
  if (!collection) return [];

  const coupons = await collection
    .find({
      $and: [
        normalizeStatusQuery().$and[0],
        buildQuickCouponDateQuery(),
      ],
    })
    .sort({ updatedAt: -1, createdAt: -1 })
    .toArray();

  const result = coupons
    .filter((coupon) => isQuickCouponCurrentlyValid(coupon))
    .map((coupon) => enrichQuickCoupon(coupon));

  cache.coupons.data = result;
  cache.coupons.expiry = Date.now() + CACHE_TTL;
  return result;
};

export const getAdminQuickCoupons = async (params = {}) => {
  const collection = getCollection('quick_coupons');
  if (!collection) return [];

  await expireStaleQuickCoupons();

  const filter = {};
  if (params.status && params.status !== 'all') {
    if (params.status === 'active') {
      filter.isActive = true;
    } else if (params.status === 'inactive') {
      filter.isActive = false;
    } else if (params.status === 'expired') {
      filter.$or = [{ status: 'expired' }, { isActive: false }];
    }
  }
  if (params.search) {
    filter.$or = [
      { code: { $regex: params.search, $options: 'i' } },
      { title: { $regex: params.search, $options: 'i' } },
      { description: { $regex: params.search, $options: 'i' } },
    ];
  }

  const coupons = await collection.find(filter).sort({ updatedAt: -1, createdAt: -1 }).toArray();
  const now = new Date();

  return coupons
    .map((coupon) => enrichQuickCoupon(coupon, now))
    .filter((coupon) => {
      if (params.status === 'active') return coupon.isEffectivelyActive;
      if (params.status === 'expired') return coupon.effectiveStatus === 'expired';
      if (params.status === 'inactive') {
        return coupon.effectiveStatus === 'inactive' || coupon.effectiveStatus === 'scheduled';
      }
      return true;
    });
};

export const createAdminQuickCoupon = async (data) => {
  const collection = getCollection('quick_coupons');
  if (!collection) throw new Error('Collection not found');

  if (!data.code) throw new Error('Coupon code is required');
  if (!data.discountValue || Number(data.discountValue) <= 0) throw new Error('Discount value must be greater than 0');

  const existing = await collection.findOne({ code: String(data.code).toUpperCase().trim() });
  if (existing) throw new Error('A coupon with this code already exists');

  const coupon = {
    ...data,
    code: String(data.code).toUpperCase().trim(),
    discountValue: Number(data.discountValue),
    minOrderValue: data.minOrderValue ? Number(data.minOrderValue) : 0,
    maxDiscount: data.maxDiscount ? Number(data.maxDiscount) : undefined,
    usageLimit: data.usageLimit ? Number(data.usageLimit) : undefined,
    perUserLimit: data.perUserLimit ? Number(data.perUserLimit) : 1,
    usedCount: 0,
    isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
    status: 'active',
    validFrom: normalizeCouponValidFrom(data.validFrom),
    validTill: normalizeCouponValidTill(data.validTill),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const result = await collection.insertOne(coupon);
  clearContentCache();
  return { ...coupon, _id: result.insertedId };
};

export const updateAdminQuickCoupon = async (id, data) => {
  const collection = getCollection('quick_coupons');
  if (!collection) throw new Error('Collection not found');

  const update = {
    ...data,
    updatedAt: new Date(),
  };
  if (update.code) update.code = String(update.code).toUpperCase().trim();
  if (update.discountValue !== undefined) update.discountValue = Number(update.discountValue);
  if (update.minOrderValue !== undefined) update.minOrderValue = Number(update.minOrderValue);
  if (update.maxDiscount !== undefined) update.maxDiscount = update.maxDiscount ? Number(update.maxDiscount) : undefined;
  if (update.validFrom !== undefined) update.validFrom = normalizeCouponValidFrom(update.validFrom);
  if (update.validTill !== undefined) update.validTill = normalizeCouponValidTill(update.validTill);
  delete update._id;

  const { ObjectId } = mongoose.Types;
  const objId = ObjectId.isValid(id) ? new ObjectId(id) : null;
  if (!objId) throw new Error('Invalid coupon ID');

  const result = await collection.findOneAndUpdate(
    { _id: objId },
    { $set: update },
    { returnDocument: 'after' }
  );
  clearContentCache();
  return result;
};

export const deleteAdminQuickCoupon = async (id) => {
  const collection = getCollection('quick_coupons');
  if (!collection) throw new Error('Collection not found');

  const { ObjectId } = mongoose.Types;
  const objId = ObjectId.isValid(id) ? new ObjectId(id) : null;
  if (!objId) throw new Error('Invalid coupon ID');

  await collection.deleteOne({ _id: objId });
  clearContentCache();
  return true;
};

export const toggleAdminQuickCouponStatus = async (id) => {
  const collection = getCollection('quick_coupons');
  if (!collection) throw new Error('Collection not found');

  const { ObjectId } = mongoose.Types;
  const objId = ObjectId.isValid(id) ? new ObjectId(id) : null;
  if (!objId) throw new Error('Invalid coupon ID');

  const existing = await collection.findOne({ _id: objId });
  if (!existing) throw new Error('Coupon not found');

  if (isQuickCouponExpired(existing)) {
    throw new Error('Expired coupons cannot be reactivated. Update the validity dates first.');
  }

  const newStatus = !existing.isActive;
  await collection.updateOne({ _id: objId }, { $set: { isActive: newStatus, updatedAt: new Date() } });
  clearContentCache();
  return { ...existing, isActive: newStatus };
};

export const getQuickOffers = async () => {
  if (cache.offers.data && !isExpired(cache.offers.expiry)) {
    return cache.offers.data;
  }

  const collection = getCollection('quick_offers');
  if (!collection) return [];

  const result = await collection.find(normalizeStatusQuery()).sort({ updatedAt: -1, createdAt: -1 }).toArray();
  cache.offers.data = result;
  cache.offers.expiry = Date.now() + CACHE_TTL;
  return result;
};

export const getQuickOfferSections = async (query = {}) => {
  if (cache.offerSections.data && !isExpired(cache.offerSections.expiry)) {
    return cache.offerSections.data;
  }

  const collection = getCollection('quick_offer_sections');
  if (!collection) return [];

  const filter = normalizeStatusQuery();
  if (query.status && query.status !== 'all') {
    // Override normalizeStatusQuery if explicit status is provided
    filter.$and = filter.$and.filter(f => !f.status);
    filter.$and.push({ status: query.status });
  }

  const sections = await collection
    .find(filter)
    .sort({ order: 1, createdAt: 1 })
    .toArray();

  if (!sections.length) return [];

  const productIds = new Set();
  const categoryIds = new Set();

  sections.forEach((section) => {
    const rawProductIds = Array.isArray(section.productIds) ? section.productIds : [];
    rawProductIds.forEach((id) => {
      const normalized = toIdString(id);
      if (normalized) productIds.add(normalized);
    });

    const rawCategoryIds = Array.isArray(section.categoryIds)
      ? section.categoryIds
      : section.categoryId
        ? [section.categoryId]
        : [];

    rawCategoryIds.forEach((id) => {
      const normalized = toIdString(id);
      if (normalized) categoryIds.add(normalized);
    });
  });

  const [products, categories] = await Promise.all([
    productIds.size
      ? QuickProduct.find({ _id: { $in: Array.from(productIds) } }).select(PRODUCT_SELECT_FIELDS).lean()
      : Promise.resolve([]),
    categoryIds.size
      ? QuickCategory.find({ _id: { $in: Array.from(categoryIds) } }).select(CATEGORY_SELECT_FIELDS).lean()
      : Promise.resolve([]),
  ]);

  const productsById = new Map(products.map((product) => [String(product._id), product]));
  const categoriesById = new Map(categories.map((category) => [String(category._id), category]));

  const finalOfferSections = sections.map((section) => {
    const hydratedCategoryIds = (Array.isArray(section.categoryIds) ? section.categoryIds : [])
      .map((id) => categoriesById.get(toIdString(id)) || id);

    const hydratedCategory =
      categoriesById.get(toIdString(section.categoryId)) || section.categoryId || null;

    const hydratedProducts = (Array.isArray(section.productIds) ? section.productIds : [])
      .map((id) => productsById.get(toIdString(id)) || id);

    return {
      ...section,
      categoryId: hydratedCategory,
      categoryIds: hydratedCategoryIds,
      productIds: hydratedProducts,
    };
  });

  cache.offerSections.data = finalOfferSections;
  cache.offerSections.expiry = Date.now() + CACHE_TTL;
  return finalOfferSections;
};

export const createQuickOfferSection = async (data) => {
  const collection = getCollection('quick_offer_sections');
  if (!collection) throw new Error('Collection not found');

  const section = {
    ...data,
    order: data.order ?? 0,
    status: data.status || 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const result = await collection.insertOne(section);
  return { ...section, _id: result.insertedId };
};

export const updateQuickOfferSection = async (id, data) => {
  const collection = getCollection('quick_offer_sections');
  if (!collection) throw new Error('Collection not found');

  const update = {
    ...data,
    updatedAt: new Date(),
  };
  delete update._id;

  const result = await collection.findOneAndUpdate(
    { _id: toId(id) },
    { $set: update },
    { returnDocument: 'after' }
  );

  return result;
};

export const deleteQuickOfferSection = async (id) => {
  const collection = getCollection('quick_offer_sections');
  if (!collection) throw new Error('Collection not found');

  await collection.deleteOne({ _id: toId(id) });
  return true;
};

export const reorderQuickOfferSections = async (items = []) => {
  const collection = getCollection('quick_offer_sections');
  if (!collection) throw new Error('Collection not found');

  const ops = items.map((item) => ({
    updateOne: {
      filter: { _id: toId(item.id) },
      update: { $set: { order: item.order, updatedAt: new Date() } },
    },
  }));

  if (ops.length > 0) {
    await collection.bulkWrite(ops);
  }
  return true;
};

export const getQuickCategories = async (query = {}) => {
  if (!query.parentId && cache.categories.data && !isExpired(cache.categories.expiry)) {
    return cache.categories.data;
  }

  const filter = normalizeStatusQuery();

  if (query.parentId) {
    filter.$and.push({ parentId: query.parentId });
  }

  const categories = await QuickCategory.find(filter)
    .select(CATEGORY_SELECT_FIELDS)
    .sort({ sortOrder: 1, name: 1 })
    .sort({ order: 1, name: 1 })
    .sort({ sortOrder: 1, name: 1 })
    .lean();

  if (!query.parentId) {
    cache.categories.data = categories;
    cache.categories.treeInfo = buildCategoryTreeInfo(categories);
    cache.categories.expiry = Date.now() + CACHE_TTL;
  }
  return categories;
};
