import mongoose from 'mongoose';
import { QuickCategory } from '../models/category.model.js';
import { QuickProduct } from '../models/product.model.js';
import { QuickReview } from '../models/review.model.js';
import { FoodUser } from '../../../core/users/user.model.js';
import { Seller } from '../seller/models/seller.model.js';
import {
  getQuickCategories,
  getQuickCoupons,
  getQuickExperienceSections,
  getQuickHeroConfig,
  getQuickOfferSections,
  getQuickOffers,
  getQuickSettings,
} from '../services/content.service.js';
import {
  isQuickCouponCurrentlyValid,
  isQuickCouponExpired,
  isQuickCouponNotStarted,
} from '../utils/coupon.helpers.js';
import {
  escapeRegex,
  publicProductVisibilityFilter,
} from '../utils/productVisibility.helpers.js';

const setNoCache = (res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
};

const setPublicCache = (res, maxAge = 300) => {
  res.set('Cache-Control', `public, max-age=${maxAge}`);
};

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

const publicCategoryFilter = {
  $and: [
    {
      $or: [
        { status: 'active' },
        { status: { $exists: false } },
        { isActive: true },
        { isActive: { $exists: false } },
      ],
    },
    {
      $or: [
        { type: { $ne: 'subcategory' } },
        approvedOrLegacyFilter,
      ],
    },
  ],
};

const publicProductFilter = publicProductVisibilityFilter;

const mapCategory = (category) => ({
  id: category._id,
  _id: category._id,
  name: category.name,
  slug: category.slug,
  image: category.image,
  status: category.status || (category.isActive ? 'active' : 'inactive'),
  type: category.type || 'header',
  parentId: category.parentId || null,
  iconId: category.iconId || '',
  headerColor: category.headerColor || category.accentColor,
  handlingFees: Number(category.handlingFees || 0),
  adminCommission: Number(category.adminCommission || 0),
  color: category.accentColor,
  approvalStatus: category.approvalStatus || 'approved',
});

const buildSellerMap = async (products = []) => {
  const sellerIds = [...new Set(
    products
      .map((product) => String(product?.sellerId || '').trim())
      .filter(Boolean)
  )];

  if (!sellerIds.length) return {};

  const sellers = await Seller.find({ _id: { $in: sellerIds } })
    .select('_id shopName name')
    .lean();

  return sellers.reduce((acc, seller) => {
    acc[String(seller._id)] = seller;
    return acc;
  }, {});
};

const mapProduct = (product, sellerMap = {}) => {
  const seller = sellerMap[String(product?.sellerId || '')] || null;
  return ({
  id: product._id,
  _id: product._id,
  name: product.name,
  slug: product.slug,
  image: product.mainImage || product.image,
  mainImage: product.mainImage || product.image,
  galleryImages: Array.isArray(product.galleryImages) ? product.galleryImages : [],
  categoryId: product.categoryId,
  subcategoryId: product.subcategoryId || null,
  headerId: product.headerId || null,
  price: product.price,
  salePrice: product.salePrice || 0,
  originalPrice: product.mrp,
  weight: product.unit,
  unit: product.unit,
  stock: Number(product.stock || 0),
  status: product.status || (product.isActive ? 'active' : 'inactive'),
  brand: product.brand || '',
  description: product.description || '',
  tags: Array.isArray(product.tags) ? product.tags : [],
  variants: Array.isArray(product.variants) ? product.variants : [],
  pharmacyDetails:
    product.pharmacyDetails &&
    typeof product.pharmacyDetails === 'object'
      ? product.pharmacyDetails
      : {},
  deliveryTime: product.deliveryTime,
  rating: product.rating,
  badge: product.badge,
  approvalStatus: product.approvalStatus || 'approved',
  sellerId: product.sellerId || seller?._id || null,
  seller: seller
    ? {
        _id: seller._id,
        id: seller._id,
        name: seller.name || '',
        shopName: seller.shopName || seller.name || 'Store',
      }
    : null,
  storeName: seller?.shopName || seller?.name || '',
  restaurantName: seller?.shopName || seller?.name || '',
});
};

export const getHomeData = async (req, res) => {
  setPublicCache(res, 60); // 1 minute cache
  // Note: ensureQuickCommerceSeedData is called once at server startup (server.js)
  // No need to re-run on every request — this was causing unnecessary DB overhead.

  const pageType = req.query?.pageType || 'home';
  const headerId = req.query?.headerId || null;

  const [categories, products, settings, heroConfig, experienceSections, offerSections] = await Promise.all([
    getQuickCategories(),
    QuickProduct.find(publicProductFilter).sort({ createdAt: -1 }).limit(18).lean(),
    getQuickSettings(),
    getQuickHeroConfig({ pageType, headerId }),
    getQuickExperienceSections({ pageType, headerId }),
    getQuickOfferSections(),
  ]);
  const sellerMap = await buildSellerMap(products);

  const fallbackHero = {
    title: 'Blinkit style quick delivery',
    subtitle: 'Groceries delivered in minutes',
    banners: {
      items: [
        {
          imageUrl: '/assets/ExperienceBanner.png',
          title: '',
          subtitle: '',
          linkType: 'none',
          linkValue: '',
          status: 'active',
        },
      ],
    },
    categoryIds: categories.slice(0, 5).map((category) => String(category._id)),
  };

  const fallbackSections = [
    {
      _id: 'best-sellers-section',
      title: 'Best Sellers',
      displayType: 'products',
      config: {
        products: {
          productIds: products.slice(0, 6).map((product) => String(product._id)),
          rows: 1,
          columns: 2,
          singleRowScrollable: true,
        },
      },
    },
  ];

  const resolvedHero = heroConfig
    ? {
        ...heroConfig,
        banners: heroConfig.banners || { items: [] },
        categoryIds: Array.isArray(heroConfig.categoryIds) ? heroConfig.categoryIds : [],
      }
    : fallbackHero;

  const resolvedSections = experienceSections.length ? experienceSections : fallbackSections;

  const homeData = {
    settings: settings || {},
    categories: categories.map(mapCategory),
    bestSellers: products.map((product) => mapProduct(product, sellerMap)),
    hero: resolvedHero,
    sections: resolvedSections,
    offerSections,
  };

  // Partial returns for specialized frontend calls
  if (req.path.includes('/hero')) {
    return res.json({ success: true, result: resolvedHero });
  }

  if (req.path.includes('/experience')) {
    return res.json({ success: true, result: resolvedSections });
  }

  if (req.path.includes('/offer-sections')) {
    return res.json({ success: true, results: offerSections });
  }

  return res.json({
    success: true,
    result: homeData,
  });
};

// ─── Bootstrap endpoint — single request mein sab kuch ────────────────────────
// Ye naya endpoint 5 separate frontend calls ko 1 mein replace karta hai.
// Cache: 2 minutes (content.service.js mein already 5-min in-memory cache hai)
export const getBootstrapData = async (req, res) => {
  setPublicCache(res, 120); // 2 minute HTTP cache

  try {
    // Sab parallel fetch — content.service.js ke in-memory cache se mostly serve hoga
    const [categories, products, heroConfig, experienceSections, offerSections] = await Promise.all([
      getQuickCategories(),
      QuickProduct.find(publicProductFilter)
        .select('_id name slug mainImage image categoryId subcategoryId headerId price salePrice mrp unit stock status isActive approvalStatus deliveryTime rating badge sellerId')
        .sort({ createdAt: -1 })
        .limit(20)
        .lean(),
      getQuickHeroConfig({ pageType: 'home', headerId: null }),
      getQuickExperienceSections({ pageType: 'home', headerId: null }),
      getQuickOfferSections(),
    ]);

    // Seller map sirf agar products hain (lean select se bahut fast)
    const sellerMap = products.length > 0 ? await buildSellerMap(products) : {};

    const resolvedHero = heroConfig
      ? {
          ...heroConfig,
          banners: heroConfig.banners || { items: [] },
          categoryIds: Array.isArray(heroConfig.categoryIds) ? heroConfig.categoryIds : [],
        }
      : { banners: { items: [] }, categoryIds: [] };

    return res.json({
      success: true,
      result: {
        categories: categories.map(mapCategory),
        products: products.map((p) => mapProduct(p, sellerMap)),
        heroConfig: resolvedHero,
        experienceSections: experienceSections.length ? experienceSections : [],
        offerSections: offerSections || [],
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Bootstrap fetch failed' });
  }
};

// ─── Lean experience endpoint — bina poora getHomeData chalaye ─────────────────
export const getExperienceSectionsLean = async (req, res) => {
  setPublicCache(res, 120);
  try {
    const pageType = req.query?.pageType || 'home';
    const headerId = req.query?.headerId || null;
    if (process.env.DEBUG_QUICK_EXPERIENCE === 'true') {
      console.log('[quick-commerce] /experience incoming', {
        pageType,
        headerId,
        headerIdType: typeof headerId,
      });
    }
    const sections = await getQuickExperienceSections({ pageType, headerId });
    if (process.env.DEBUG_QUICK_EXPERIENCE === 'true') {
      console.log('[quick-commerce] /experience outgoing', {
        count: Array.isArray(sections) ? sections.length : 0,
        ids: Array.isArray(sections) ? sections.map((s) => String(s?._id)) : [],
        displayTypes: Array.isArray(sections) ? sections.map((s) => s?.displayType) : [],
        titles: Array.isArray(sections) ? sections.map((s) => s?.title) : [],
      });
    }
    return res.json({ success: true, result: sections });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Failed to fetch experience sections' });
  }
};

// ─── Lean hero endpoint — bina poora getHomeData chalaye ──────────────────────
export const getHeroConfigLean = async (req, res) => {
  setPublicCache(res, 300);
  try {
    const pageType = req.query?.pageType || 'home';
    const headerId = req.query?.headerId || null;
    const heroConfig = await getQuickHeroConfig({ pageType, headerId });
    const resolved = heroConfig
      ? {
          ...heroConfig,
          banners: heroConfig.banners || { items: [] },
          categoryIds: Array.isArray(heroConfig.categoryIds) ? heroConfig.categoryIds : [],
        }
      : { banners: { items: [] }, categoryIds: [] };
    return res.json({ success: true, result: resolved });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Failed to fetch hero config' });
  }
};

// ─── Lean offer-sections endpoint — bina poora getHomeData chalaye ────────────
export const getOfferSectionsLean = async (req, res) => {
  setPublicCache(res, 120);
  try {
    const offerSections = await getQuickOfferSections();
    return res.json({ success: true, results: offerSections || [] });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Failed to fetch offer sections' });
  }
};

export const getCoupons = async (req, res) => {
  setNoCache(res);
  try {
    const adminCoupons = await getQuickCoupons();
    let results = Array.isArray(adminCoupons) ? [...adminCoupons] : [];

    const { sellerId } = req.query;
    if (sellerId && mongoose.Types.ObjectId.isValid(sellerId)) {
      const { SellerCoupon } = await import('../models/sellerCoupon.model.js');
      const now = new Date();
      const sellerCoupons = await SellerCoupon.find({
        sellerId: new mongoose.Types.ObjectId(sellerId),
        status: 'Approved',
        validTill: { $gt: now }
      }).lean();

      const mappedSellerCoupons = sellerCoupons.map(c => ({
        ...c,
        id: c._id,
        code: c.code,
        minOrderValue: c.minOrderValue,
        title: c.discountType === 'percent' ? `${c.discountValue}% OFF` : `₹${c.discountValue} FLAT OFF`,
        validTill: c.validTill,
        isSellerCoupon: true
      }));

      results = [...results, ...mappedSellerCoupons];
    }

    return res.json({ success: true, results });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Failed to fetch coupons' });
  }
};

export const applyCoupon = async (req, res) => {
  setNoCache(res);
  const { code, cartTotal, items } = req.body;

  if (!code) {
    return res.status(400).json({ success: false, message: 'Coupon code is required' });
  }

  // Look up in admin coupons first
  const adminCoupons = await getQuickCoupons();
  let coupon = adminCoupons.find(
    (c) => String(c.code || '').toUpperCase() === String(code).toUpperCase()
  );

  // If not found in admin coupons, check seller coupons
  if (!coupon) {
    let sellerId = null;
    if (Array.isArray(items) && items.length > 0) {
      const firstItem = items.find(item => item.sellerId || item.seller?._id || item.sellerId?._id);
      sellerId = firstItem?.sellerId?._id || firstItem?.sellerId || firstItem?.seller?._id;
    }

    if (sellerId && mongoose.Types.ObjectId.isValid(sellerId)) {
      const { SellerCoupon } = await import('../models/sellerCoupon.model.js');
      const now = new Date();
      const sellerCoupon = await SellerCoupon.findOne({
        sellerId: new mongoose.Types.ObjectId(sellerId),
        code: String(code).toUpperCase().trim(),
        status: 'Approved',
        validTill: { $gt: now }
      }).lean();

      if (sellerCoupon) {
        coupon = {
          ...sellerCoupon,
          code: sellerCoupon.code,
          minOrderValue: sellerCoupon.minOrderValue,
          validTill: sellerCoupon.validTill,
          isSellerCoupon: true
        };
      }
    }
  }

  if (!coupon) {
    return res.status(404).json({ success: false, message: 'Coupon not found or expired' });
  }

  if (!isQuickCouponCurrentlyValid(coupon)) {
    if (isQuickCouponExpired(coupon)) {
      return res.status(400).json({ success: false, message: 'This coupon has expired' });
    }
    if (isQuickCouponNotStarted(coupon)) {
      return res.status(400).json({ success: false, message: 'This coupon is not active yet' });
    }
    return res.status(400).json({ success: false, message: 'This coupon is not active' });
  }

  const minOrder = Number(coupon.minOrderValue || coupon.minOrder || 0);
  const total = Number(cartTotal || 0);
  if (minOrder > 0 && total < minOrder) {
    return res.status(400).json({
      success: false,
      message: `Minimum order value of ₹${minOrder} required for this coupon`,
    });
  }

  // Calculate discount
  let discountAmount = 0;
  const discountType = String(coupon.discountType || 'flat').toLowerCase();
  const discountValue = Number(coupon.discountValue || coupon.discount || 0);
  const maxDiscount = Number(coupon.maxDiscount || coupon.maxDiscountValue || 0);

  if (discountType === 'percent' || discountType === 'percentage') {
    discountAmount = Math.round((total * discountValue) / 100);
    if (maxDiscount > 0) discountAmount = Math.min(discountAmount, maxDiscount);
  } else {
    discountAmount = discountValue;
  }

  discountAmount = Math.min(discountAmount, total);

  return res.json({
    success: true,
    message: `Coupon ${coupon.code} applied successfully!`,
    result: {
      code: coupon.code,
      description: coupon.description,
      discountAmount,
      discountType,
      discountValue,
    },
  });
};

export const getOffers = async (_req, res) => {
  setNoCache(res);
  const offers = await getQuickOffers();
  return res.json({ success: true, results: offers });
};

export const getCategories = async (req, res) => {
  setPublicCache(res, 300); // 5 minutes cache
  // Note: ensureQuickCommerceSeedData runs at server startup — no need here.

  const { tree, parentId } = req.query;
  const categories = await getQuickCategories({ parentId });
  const mapped = categories.map(mapCategory);

  if (tree === 'true' || tree === true) {
    // Optimized tree builder using a map instead of recursive filter
    const catMap = {};
    mapped.forEach(cat => {
      cat.children = [];
      catMap[String(cat._id)] = cat;
    });
    
    const root = [];
    mapped.forEach(cat => {
      if (cat.parentId && catMap[String(cat.parentId)]) {
        catMap[String(cat.parentId)].children.push(cat);
      } else {
        root.push(cat);
      }
    });
    return res.json({ success: true, results: root });
  }

  return res.json({ success: true, results: mapped });
};

export const getProducts = async (req, res) => {
  setPublicCache(res, 60);
  // Note: ensureQuickCommerceSeedData runs at server startup — no need here.

  const { categoryId, search, limit, page } = req.query;
  const query = { ...publicProductFilter };

  if (categoryId) {
    query.$or = [
      { categoryId: categoryId },
      { subcategoryId: categoryId },
      { headerId: categoryId }
    ];
  }
  if (search) {
    const term = escapeRegex(String(search).trim().slice(0, 80));
    if (term) query.name = { $regex: term, $options: 'i' };
  }

  // Backward compatible pagination
  const hasPagination = !!req.query.page;
  
  let products = [];
  let total = 0;
  let totalPages = 0;
  let hasMore = false;
  let parsedLimit = 50;
  let parsedPage = 1;

  if (hasPagination) {
    parsedPage = Math.max(1, parseInt(page, 10) || 1);
    parsedLimit = Math.max(1, Math.min(parseInt(limit, 10) || 20, 100));
    const skip = (parsedPage - 1) * parsedLimit;
    
    [products, total] = await Promise.all([
      QuickProduct.find(query).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(parsedLimit).lean(),
      QuickProduct.countDocuments(query)
    ]);
    totalPages = Math.ceil(total / parsedLimit);
    hasMore = parsedPage < totalPages;
  } else {
    parsedLimit = Number(limit) > 0 ? Math.min(Number(limit), 100) : 50;
    products = await QuickProduct.find(query).sort({ createdAt: -1, _id: -1 }).limit(parsedLimit).lean();
  }

  const sellerMap = await buildSellerMap(products);

  const responsePayload = {
    success: true,
    result: {
      items: products.map((product) => mapProduct(product, sellerMap)),
    },
  };

  if (hasPagination) {
    responsePayload.result.total = total;
    responsePayload.result.page = parsedPage;
    responsePayload.result.limit = parsedLimit;
    responsePayload.result.totalPages = totalPages;
    responsePayload.result.hasMore = hasMore;
  }

  return res.json(responsePayload);
};

export const getProductById = async (req, res) => {
  setPublicCache(res, 600); // 10 minutes cache

  const product = await QuickProduct.findOne({ _id: req.params.productId, ...publicProductFilter }).lean();

  if (!product) {
    return res.status(404).json({ success: false, message: 'Product not found' });
  }

  const sellerMap = await buildSellerMap([product]);

  return res.json({ success: true, result: mapProduct(product, sellerMap) });
};

export const getProductReviews = async (req, res) => {
  setPublicCache(res, 300); // 5 minutes cache
  const { productId } = req.params;

  try {
    const reviews = await QuickReview.find({
      productId,
      status: 'approved',
    }).populate('userId', 'name profileImage').sort({ createdAt: -1 }).lean();

    return res.json({
      success: true,
      results: reviews,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch reviews',
    });
  }
};

export const submitProductReview = async (req, res) => {
  const { productId, rating, comment } = req.body;
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required to submit a review',
    });
  }

  if (!productId || !rating || !comment) {
    return res.status(400).json({
      success: false,
      message: 'Product ID, rating, and comment are required',
    });
  }

  try {
    const [product, user] = await Promise.all([
      QuickProduct.findById(productId),
      FoodUser.findById(userId).select('name profileImage'),
    ]);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    const review = await QuickReview.create({
      productId,
      userId,
      userName: user?.name || 'Customer',
      userAvatar: user?.profileImage || '',
      rating: Number(rating),
      comment: String(comment).trim(),
      status: 'approved', // Auto-approving for now as per simple implementation, or can be 'pending'
    });

    return res.status(201).json({
      success: true,
      message: 'Review submitted successfully',
      result: review,
    });
  } catch (error) {
    console.error('Error submitting review:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to submit review',
    });
  }
};

export const getStoreDetails = async (req, res) => {
  setPublicCache(res, 300);
  try {
    const { storeId } = req.params;
    if (!storeId || !mongoose.Types.ObjectId.isValid(storeId)) {
      return res.status(400).json({ success: false, message: 'Invalid store ID' });
    }
    const seller = await Seller.findById(storeId).select('_id name shopName location').lean();
    if (!seller) {
      return res.status(404).json({ success: false, message: 'Store not found' });
    }
    return res.json({
      success: true,
      result: {
        _id: seller._id,
        id: seller._id,
        name: seller.name || '',
        shopName: seller.shopName || seller.name || 'Store',
        location: seller.location || null,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Failed to fetch store details' });
  }
};


