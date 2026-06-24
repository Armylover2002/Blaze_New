const DOSAGE_FORM_LABELS = {
  tablet: "Tablet",
  capsule: "Capsule",
  syrup: "Syrup",
  injection: "Injection",
  drops: "Drops",
  cream: "Cream",
  ointment: "Ointment",
  powder: "Powder",
  spray: "Spray",
  inhaler: "Inhaler",
  medical_device: "Medical Device",
  other: "Other",
};

const PACK_TYPE_LABELS = {
  strip: "Strip",
  bottle: "Bottle",
  box: "Box",
  tube: "Tube",
  vial: "Vial",
  device: "Device",
  piece: "Piece",
};

const UNIT_LABELS = {
  tablet: "Tablets",
  capsule: "Capsules",
  ml: "ml",
  gm: "gm",
  piece: "Pieces",
  vial: "Vials",
  strip: "Strips",
};

const CLASSIFICATION_LABELS = {
  otc: "OTC",
  prescription: "Prescription",
  ayurvedic: "Ayurvedic",
  homeopathic: "Homeopathic",
  surgical: "Surgical",
  medical_device: "Medical Device",
  other: "Other",
};

export const normalizeSlug = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");

export const isPharmacyHeader = (header) => {
  const slug = normalizeSlug(header?.slug);
  if (slug) return slug === "pharmacy";
  return normalizeSlug(header?.name) === "pharmacy";
};

const getParentId = (node) => {
  if (!node?.parentId) return null;
  if (typeof node.parentId === "object") {
    return node.parentId._id || node.parentId.id || null;
  }
  return node.parentId;
};

/** Walk category tree upward until a header node is found. */
export const resolveHeaderFromCategoryTree = (nodeId, fullMap = {}) => {
  if (!nodeId || !fullMap || typeof fullMap !== "object") return null;

  let current = fullMap[nodeId];
  const visited = new Set();

  while (current && !visited.has(String(current._id))) {
    visited.add(String(current._id));
    if (current.type === "header") return current;
    const parentId = getParentId(current);
    if (!parentId) break;
    current = fullMap[parentId];
  }

  return null;
};

/** Resolve pharmacy header from a product using headerId / categoryId only. */
export const resolvePharmacyHeaderForProduct = (product, fullMap = {}) => {
  if (!product || !fullMap) return null;

  const headerId =
    product.headerId?._id ||
    product.headerId?.id ||
    product.headerId;

  if (headerId) {
    const direct = fullMap[headerId];
    if (direct?.type === "header") return direct;
    const fromHeader = resolveHeaderFromCategoryTree(headerId, fullMap);
    if (fromHeader) return fromHeader;
  }

  const categoryId =
    product.categoryId?._id ||
    product.categoryId?.id ||
    product.categoryId ||
    product.subcategoryId?._id ||
    product.subcategoryId?.id ||
    product.subcategoryId;

  if (categoryId) {
    return resolveHeaderFromCategoryTree(categoryId, fullMap);
  }

  return null;
};

export const isPharmacyHeaderContext = (headerNode) => isPharmacyHeader(headerNode);

const isPharmacyDefaultPlaceholderVariant = (variant) => {
  if (!variant || typeof variant !== "object") return false;
  const packQty = variant.packQuantity;
  const hasPackQty =
    packQty !== "" &&
    packQty != null &&
    Number.isFinite(Number(packQty)) &&
    Number(packQty) > 0;

  return (
    String(variant.name || "").trim() === "Default" &&
    !String(variant.strength || "").trim() &&
    !String(variant.packType || "").trim() &&
    !hasPackQty &&
    !String(variant.unit || "").trim()
  );
};

export const variantsWithoutPlaceholder = (variants) =>
  (Array.isArray(variants) ? variants : []).filter(
    (v) => !isPharmacyDefaultPlaceholderVariant(v),
  );

export const getVariantKey = (variant) => {
  if (!variant || typeof variant !== "object") return "";
  return String(
    variant._id || variant.id || variant.sku || variant.name || "",
  ).trim();
};

export const getVariantDisplayLabel = (variant, product = {}) => {
  if (!variant) return "";
  const named = String(variant.name || "").trim();
  if (named && named !== "Default") return named;

  const pd = product.pharmacyDetails || {};
  const strength = variant.strength || pd.strength || "";
  const packLine = formatPackLine(
    variant.packType || pd.packType || "",
    variant.packQuantity ?? pd.packQuantity ?? "",
    variant.unit || pd.unit || "",
  );
  const strengthLine = formatStrengthDosage(strength, pd.dosageForm || "");
  return [strengthLine, packLine].filter(Boolean).join(" · ") || named || "Variant";
};

export const getCartLineId = (productId, variant) => {
  const baseId = String(productId || "").trim().split("::")[0];
  if (!baseId) return "";
  const variantKey = getVariantKey(variant);
  return variantKey ? `${baseId}::${variantKey}` : baseId;
};

export const applyVariantToProduct = (product = {}, variant = null) => {
  if (!variant) return product;

  const baseId = String(product.id || product._id || "").trim().split("::")[0];
  const salePrice = Number(variant.salePrice || 0);
  const basePrice = Number(variant.price || 0);
  const price = salePrice > 0 ? salePrice : basePrice;
  const mrp = Math.max(
    price,
    Number(product.originalPrice ?? product.mrp ?? basePrice ?? price),
  );

  return {
    ...product,
    id: getCartLineId(baseId, variant),
    _id: getCartLineId(baseId, variant),
    productId: baseId,
    selectedVariant: variant,
    price,
    salePrice,
    mrp,
    originalPrice: mrp,
    stock: Number(variant.stock ?? product.stock ?? 0),
  };
};

const labelFromMap = (map, value) => {
  if (!value) return "";
  const key = String(value).trim().toLowerCase();
  return map[key] || String(value);
};

const formatPackLine = (packType, packQuantity, unit) => {
  const pLabel = labelFromMap(PACK_TYPE_LABELS, packType);
  const qty = Number(packQuantity);
  const uLabel = labelFromMap(UNIT_LABELS, unit) || unit || "";
  const hasQty = Number.isFinite(qty) && qty > 0;

  if (!pLabel && !hasQty) return "";
  if (pLabel && hasQty) {
    if (pLabel === "Strip") return `Strip of ${qty} ${uLabel || "Units"}`;
    if (pLabel === "Box") return `Box of ${qty} ${uLabel || "Units"}`;
    if (pLabel === "Bottle" || pLabel === "Tube" || pLabel === "Vial") {
      return hasQty && (unit === "ml" || unit === "gm")
        ? `${qty}${unit} ${pLabel}`
        : `${qty} ${uLabel} ${pLabel}`.trim();
    }
    return `${pLabel} of ${qty} ${uLabel || "Units"}`;
  }
  if (hasQty && (unit === "ml" || unit === "gm")) return `${qty}${unit} Bottle`;
  if (pLabel) return pLabel;
  return hasQty ? `${qty} ${uLabel}` : "";
};

const formatStrengthDosage = (strength, dosageForm) => {
  const s = String(strength || "").trim();
  const d = labelFromMap(DOSAGE_FORM_LABELS, dosageForm);
  if (s && d) return `${s} ${d}`;
  return s || d || "";
};

export const getRxOtcLabel = (pd = {}) => {
  if (pd.prescriptionRequired) return "Rx";
  const dc = String(pd.drugClassification || "").toLowerCase();
  if (dc === "prescription") return "Rx";
  if (dc === "otc" || !dc) return "OTC";
  return labelFromMap(CLASSIFICATION_LABELS, dc) || dc.toUpperCase();
};

export const formatPharmacyDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

/** Map product + pharmacyDetails + variant metadata for pharmacy UI. */
export const getMedicineMeta = (product = {}, selectedVariant = null) => {
  const pd = product.pharmacyDetails || {};
  const realVariants = variantsWithoutPlaceholder(product.variants);
  const v = selectedVariant || product.selectedVariant || realVariants[0] || {};

  const strength = v.strength || pd.strength || "";
  const dosageForm = pd.dosageForm || "";
  const packType = v.packType || pd.packType || "";
  const packQuantity = v.packQuantity ?? pd.packQuantity ?? "";
  const unit = v.unit || pd.unit || "";

  const variantSalePrice = Number(v.salePrice || 0);
  const variantBasePrice = Number(v.price || 0);
  const productSalePrice = Number(product.salePrice || 0);
  const productBasePrice = Number(product.price || 0);
  const sellingPrice =
    variantSalePrice > 0
      ? variantSalePrice
      : variantBasePrice > 0
        ? variantBasePrice
        : productSalePrice > 0
          ? productSalePrice
          : productBasePrice;
  const mrp = Math.max(
    sellingPrice,
    variantBasePrice > 0
      ? variantBasePrice
      : Number(product.originalPrice ?? product.mrp ?? product.price ?? sellingPrice),
  );

  return {
    brandName: product.name || "Medicine",
    genericName: pd.genericName || "",
    manufacturer: pd.manufacturer || product.brand || "",
    composition: pd.composition || "",
    strength,
    dosageForm,
    dosageFormLabel: labelFromMap(DOSAGE_FORM_LABELS, dosageForm),
    packType,
    packTypeLabel: labelFromMap(PACK_TYPE_LABELS, packType),
    packQuantity,
    unit,
    unitLabel: labelFromMap(UNIT_LABELS, unit),
    strengthDosageLine: formatStrengthDosage(strength, dosageForm),
    packLine: formatPackLine(packType, packQuantity, unit) || getVariantDisplayLabel(v, product),
    variantLabel: getVariantDisplayLabel(v, product),
    storageCondition: pd.storageCondition || "",
    batchNumber: pd.batchNumber || "",
    mfgDate: pd.mfgDate || "",
    expDate: pd.expDate || "",
    drugClassification: pd.drugClassification || "",
    drugClassificationLabel: labelFromMap(CLASSIFICATION_LABELS, pd.drugClassification),
    prescriptionRequired: Boolean(pd.prescriptionRequired),
    rxOtc: getRxOtcLabel(pd),
    mrp,
    sellingPrice,
    hasDiscount: mrp > sellingPrice,
    variants: realVariants,
    image:
      product.mainImage ||
      product.image ||
      "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?q=80&w=400",
  };
};
