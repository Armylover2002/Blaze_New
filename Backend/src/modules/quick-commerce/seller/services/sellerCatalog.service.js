import mongoose from "mongoose";
import { QuickCategory } from "../../models/category.model.js";
import { SellerNotification } from "../models/sellerNotification.model.js";
import { Seller } from "../models/seller.model.js";

const DEFAULT_CATEGORY_TREE = [
  {
    name: "Catalog",
    slug: "catalog",
    children: [
      {
        name: "Groceries",
        slug: "groceries",
        children: [
          { name: "Staples", slug: "staples" },
          { name: "Dairy & Breakfast", slug: "dairy-breakfast" },
          { name: "Snacks", slug: "snacks" },
        ],
      },
      {
        name: "Fresh",
        slug: "fresh",
        children: [
          { name: "Fruits", slug: "fruits" },
          { name: "Vegetables", slug: "vegetables" },
          { name: "Herbs", slug: "herbs" },
        ],
      },
      {
        name: "Beverages",
        slug: "beverages",
        children: [
          { name: "Soft Drinks", slug: "soft-drinks" },
          { name: "Tea & Coffee", slug: "tea-coffee" },
          { name: "Juices", slug: "juices" },
        ],
      },
      {
        name: "Home Essentials",
        slug: "home-essentials",
        children: [
          { name: "Cleaning", slug: "cleaning" },
          { name: "Laundry", slug: "laundry" },
          { name: "Kitchen Care", slug: "kitchen-care" },
        ],
      },
      {
        name: "Personal Care",
        slug: "personal-care",
        children: [
          { name: "Skin Care", slug: "skin-care" },
          { name: "Hair Care", slug: "hair-care" },
          { name: "Daily Hygiene", slug: "daily-hygiene" },
        ],
      },
    ],
  },
];

const categoryNode = (doc) => ({
  _id: doc._id,
  id: doc._id,
  name: doc.name,
  slug: doc.slug,
  type: doc.type || "header",
  ...(doc.type === "header" || !doc.parentId ? { businessType: doc.businessType || "quick_commerce" } : {}),
  parentId: doc.parentId || null,
  children: [],
});

const toObjectId = (value) => {
  if (!value || !mongoose.Types.ObjectId.isValid(value)) return null;
  return new mongoose.Types.ObjectId(value);
};

const walkSeed = async (nodes, parentId = null, depth = 0, parentKey = "") => {
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];
    const type =
      depth <= 0 ? "header" : depth === 1 ? "category" : "subcategory";
    const doc = await QuickCategory.findOneAndUpdate(
      { slug: node.slug, parentId },
      {
        $set: {
          isActive: true,
          status: "active",
        },
        $setOnInsert: {
          name: node.name,
          slug: node.slug,
          parentId,
          type,
          sortOrder: index,
        },
      },
      { upsert: true, new: true },
    );

    if (Array.isArray(node.children) && node.children.length) {
      await walkSeed(node.children, doc._id, depth + 1, parentKey);
    }
  }
};

export const ensureSellerCategoriesSeeded = async () => {
  const existingCount = await QuickCategory.countDocuments();
  if (existingCount > 0) return;
  await walkSeed(DEFAULT_CATEGORY_TREE);
};

export const buildSellerCategoryTree = async () => {
  await ensureSellerCategoriesSeeded();
  const docs = await QuickCategory.find({ isActive: { $ne: false } })
    .sort({ sortOrder: 1, name: 1 })
    .lean();

  const lookup = new Map();
  const roots = [];

  docs.forEach((doc) => {
    lookup.set(String(doc._id), categoryNode(doc));
  });

  docs.forEach((doc) => {
    const current = lookup.get(String(doc._id));
    if (doc.parentId && lookup.has(String(doc.parentId))) {
      lookup.get(String(doc.parentId)).children.push(current);
    } else {
      roots.push(current);
    }
  });

  return roots;
};

export const getDefaultSellerCategoryPath = async () => {
  await ensureSellerCategoriesSeeded();
  const header = await QuickCategory.findOne({ type: "header", isActive: { $ne: false } })
    .sort({ sortOrder: 1, createdAt: 1 })
    .lean();
  if (!header) return null;

  const category = await QuickCategory.findOne({
    parentId: header._id,
    type: "category",
    isActive: { $ne: false },
  })
    .sort({ sortOrder: 1, createdAt: 1 })
    .lean();

  const subcategory = category
    ? await QuickCategory.findOne({
        parentId: category._id,
        type: "subcategory",
        isActive: { $ne: false },
      })
        .sort({ sortOrder: 1, createdAt: 1 })
        .lean()
    : null;

  return {
    headerId: header?._id || null,
    categoryId: category?._id || null,
    subcategoryId: subcategory?._id || category?._id || header?._id || null,
  };
};

export const resolveSellerCategoryIds = async ({
  headerId,
  categoryId,
  subcategoryId,
}) => {
  await ensureSellerCategoriesSeeded();
  const selectedIds = [headerId, categoryId, subcategoryId]
    .map((value) => toObjectId(value))
    .filter(Boolean);

  if (selectedIds.length >= 1) {
    const docs = await QuickCategory.find({ _id: { $in: selectedIds } }).lean();
    const byId = new Map(docs.map((doc) => [String(doc._id), doc]));
    const selectedHeader = headerId ? byId.get(String(headerId)) : null;
    const selectedCategory = categoryId ? byId.get(String(categoryId)) : null;
    const selectedSubcategory = subcategoryId
      ? byId.get(String(subcategoryId))
      : null;

    const category =
      selectedCategory?.type === "category"
        ? selectedCategory
        : selectedSubcategory?.type === "subcategory" &&
            selectedSubcategory.parentId
          ? await QuickCategory.findOne({
              _id: selectedSubcategory.parentId,
              type: "category",
              isActive: { $ne: false },
            }).lean()
          : null;

    const header =
      selectedHeader?.type === "header"
        ? selectedHeader
        : category?.parentId
          ? await QuickCategory.findOne({
              _id: category.parentId,
              type: "header",
              isActive: { $ne: false },
            }).lean()
          : null;

    const subcategory =
      selectedSubcategory?.type === "subcategory" ? selectedSubcategory : null;

    if (category && header && String(category.parentId) === String(header._id)) {
      return {
        headerId: header._id,
        categoryId: category._id,
        subcategoryId:
          subcategory && String(subcategory.parentId) === String(category._id)
            ? subcategory._id
            : null,
      };
    }

    if (
      selectedHeader?.type === "header" &&
      !selectedCategory &&
      !selectedSubcategory
    ) {
      const fallback = await getDefaultSellerCategoryPath();
      return {
        headerId: selectedHeader._id,
        categoryId: fallback?.categoryId || null,
        subcategoryId: fallback?.subcategoryId || null,
      };
    }
  }

  return getDefaultSellerCategoryPath();
};

const notificationPayloadForProduct = (product) => {
  if (!product || typeof product.stock !== "number") return null;

  if (product.stock <= 0) {
    return {
      key: `inventory:${product._id}:out`,
      type: "inventory",
      title: `Out of stock: ${product.name}`,
      message: `${product.name} is unavailable until you restock it.`,
      metadata: { productId: String(product._id), stock: product.stock },
    };
  }

  if (product.stock <= Number(product.lowStockAlert || 5)) {
    return {
      key: `inventory:${product._id}:low`,
      type: "inventory",
      title: `Low stock: ${product.name}`,
      message: `Only ${product.stock} unit(s) are left for ${product.name}.`,
      metadata: { productId: String(product._id), stock: product.stock },
    };
  }

  return null;
};

export const syncSellerInventoryNotification = async (sellerId, product) => {
  if (!sellerId || !product?._id) return;

  const staleKeys = [
    `inventory:${product._id}:low`,
    `inventory:${product._id}:out`,
  ];

  const nextNotification = notificationPayloadForProduct(product);

  if (!nextNotification) {
    await SellerNotification.deleteMany({
      sellerId,
      key: { $in: staleKeys },
    });
    return;
  }

  await SellerNotification.deleteMany({
    sellerId,
    key: { $in: staleKeys.filter((key) => key !== nextNotification.key) },
  });

  await SellerNotification.findOneAndUpdate(
    { sellerId, key: nextNotification.key },
    {
      $set: {
        type: nextNotification.type,
        title: nextNotification.title,
        message: nextNotification.message,
        metadata: nextNotification.metadata,
      },
      $setOnInsert: { isRead: false },
    },
    { upsert: true, new: true },
  );
};

const normalizeSlugKey = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");

export const isPharmacyCategoryHeader = (header) => {
  const businessType = normalizeCatalogBusinessType(header?.businessType);
  if (businessType === "pharmacy") return true;
  const slug = normalizeSlugKey(header?.slug);
  if (slug === "pharmacy") return true;
  return normalizeSlugKey(header?.name) === "pharmacy";
};

const headerIdMatch = (headerId) => {
  if (!headerId) return null;
  const id = String(headerId);
  return mongoose.Types.ObjectId.isValid(id)
    ? { $in: [new mongoose.Types.ObjectId(id), id] }
    : id;
};

const getPharmacySellerIds = async () => {
  const sellers = await Seller.find({
    "shopInfo.businessType": { $regex: /^pharmacy$/i },
  })
    .select("_id")
    .lean();

  return sellers
    .map((seller) => seller._id)
    .filter((id) => mongoose.Types.ObjectId.isValid(String(id)));
};

const isPharmacyCatalogProductClause = (scope, pharmacySellerIds = []) => {
  const headerMatch = headerIdMatch(scope.headerId);
  const orClauses = [];

  if (headerMatch) {
    orClauses.push({ headerId: headerMatch });
  }
  if (scope.categoryIds.length) {
    orClauses.push(
      { categoryId: { $in: scope.categoryIds } },
      { subcategoryId: { $in: scope.categoryIds } },
    );
  }
  orClauses.push(
    { "pharmacyDetails.genericName": { $exists: true, $nin: [null, ""] } },
    { "pharmacyDetails.manufacturer": { $exists: true, $nin: [null, ""] } },
    { "pharmacyDetails.dosageForm": { $exists: true, $nin: [null, ""] } },
  );
  if (pharmacySellerIds.length) {
    orClauses.push({ sellerId: { $in: pharmacySellerIds } });
  }

  return { $or: orClauses };
};

const normalizeCatalogBusinessType = (value) =>
  String(value || "quick_commerce")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");

let pharmacyCatalogScopeCache = { value: null, expiry: 0 };

export const getPharmacyCatalogScope = async () => {
  if (pharmacyCatalogScopeCache.value && Date.now() < pharmacyCatalogScopeCache.expiry) {
    return pharmacyCatalogScopeCache.value;
  }

  const headers = await QuickCategory.find({
    type: "header",
    isActive: { $ne: false },
  }).lean();

  const pharmacyHeader = headers.find(isPharmacyCategoryHeader) || null;
  if (!pharmacyHeader) {
    const empty = { headerId: null, categoryIds: [] };
    pharmacyCatalogScopeCache = { value: empty, expiry: Date.now() + 60_000 };
    return empty;
  }

  const headerId = String(pharmacyHeader._id);
  const allDocs = await QuickCategory.find({ isActive: { $ne: false } }).lean();
  const childrenMap = new Map();

  allDocs.forEach((doc) => {
    if (!doc.parentId) return;
    const pid = String(doc.parentId);
    if (!childrenMap.has(pid)) childrenMap.set(pid, []);
    childrenMap.get(pid).push(doc);
  });

  const categoryIds = new Set([headerId]);
  const walk = (id) => {
    (childrenMap.get(String(id)) || []).forEach((child) => {
      categoryIds.add(String(child._id));
      walk(child._id);
    });
  };
  walk(headerId);

  const scope = {
    headerId: pharmacyHeader._id,
    categoryIds: Array.from(categoryIds).map((id) => new mongoose.Types.ObjectId(id)),
  };

  pharmacyCatalogScopeCache = { value: scope, expiry: Date.now() + 60_000 };
  return scope;
};

export const buildSellerCatalogBrowseFilter = async ({
  sellerBusinessType,
  sellerId,
  searchTerm = "",
}) => {
  const scope = await getPharmacyCatalogScope();
  const pharmacySellerIds = await getPharmacySellerIds();
  const isPharmacySeller = normalizeCatalogBusinessType(sellerBusinessType) === "pharmacy";
  const andClauses = [];
  const trimmedSearch = String(searchTerm || "").trim();

  // Quick-commerce sellers browse other sellers' catalogs only.
  // Pharmacy sellers browse the full pharmacy catalog (including own products).
  if (!isPharmacySeller) {
    const scopedSellerId = mongoose.Types.ObjectId.isValid(String(sellerId))
      ? new mongoose.Types.ObjectId(String(sellerId))
      : sellerId;
    andClauses.push({ sellerId: { $ne: scopedSellerId } });
  }

  if (trimmedSearch) {
    andClauses.push({
      $or: [
        { name: { $regex: trimmedSearch, $options: "i" } },
        { sku: { $regex: trimmedSearch, $options: "i" } },
        { brand: { $regex: trimmedSearch, $options: "i" } },
        { "pharmacyDetails.genericName": { $regex: trimmedSearch, $options: "i" } },
      ],
    });
  }

  if (isPharmacySeller) {
    andClauses.push(isPharmacyCatalogProductClause(scope, pharmacySellerIds));
  } else if (scope.headerId || scope.categoryIds.length || pharmacySellerIds.length) {
    andClauses.push({ $nor: [isPharmacyCatalogProductClause(scope, pharmacySellerIds)] });
  }

  return andClauses.length ? { $and: andClauses } : {};
};

export const isPharmacyCatalogProduct = async (product = {}) => {
  const scope = await getPharmacyCatalogScope();
  const headerId = product?.headerId?._id || product?.headerId;
  const categoryId = product?.categoryId?._id || product?.categoryId;
  const subcategoryId = product?.subcategoryId?._id || product?.subcategoryId;
  const categoryIdSet = new Set(scope.categoryIds.map((id) => String(id)));

  if (scope.headerId && String(headerId) === String(scope.headerId)) return true;
  if (categoryId && categoryIdSet.has(String(categoryId))) return true;
  if (subcategoryId && categoryIdSet.has(String(subcategoryId))) return true;

  const pd = product?.pharmacyDetails || {};
  if (String(pd.genericName || "").trim()) return true;
  if (String(pd.manufacturer || "").trim()) return true;
  if (String(pd.dosageForm || "").trim()) return true;

  const productSellerId = product?.sellerId?._id || product?.sellerId;
  const pharmacySellerIds = await getPharmacySellerIds();
  if (
    productSellerId &&
    pharmacySellerIds.some((id) => String(id) === String(productSellerId))
  ) {
    return true;
  }

  return false;
};
