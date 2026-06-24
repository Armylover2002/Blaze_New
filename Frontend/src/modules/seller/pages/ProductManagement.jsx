import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import Card from "@shared/components/ui/Card";
import Badge from "@shared/components/ui/Badge";
import {
  HiOutlinePlus,
  HiOutlineCube,
  HiOutlineMagnifyingGlass,
  HiOutlineFunnel,
  HiOutlineTrash,
  HiOutlinePencilSquare,
  HiOutlineEye,
  HiOutlinePhoto,
  HiOutlineCurrencyDollar,
  HiOutlineArchiveBox,
  HiOutlineTag,
  HiOutlineScale,
  HiOutlineArrowPath,
  HiOutlineXMark,
  HiOutlineChevronRight,
  HiOutlineCheckCircle,
  HiOutlineExclamationCircle,
  HiOutlineFolderOpen,
  HiOutlineSwatch,
  HiOutlineSquaresPlus,
  HiOutlineQrCode,
  HiOutlineClipboardDocument,
  HiOutlineClipboardDocumentCheck,
  HiOutlineChevronLeft,
  HiOutlineInformationCircle,
} from "react-icons/hi2";
import Modal from "@shared/components/ui/Modal";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useSearchParams } from "react-router-dom";
import { sellerApi } from "../services/sellerApi";
import { toast } from "sonner";
import { useAuthStore } from "@/core/auth/auth.store";

import { MagicCard } from "@/components/ui/magic-card";
import { BlurFade } from "@/components/ui/blur-fade";
import ShimmerButton from "@/components/ui/shimmer-button";
import Pagination from "@shared/components/ui/Pagination";

const ProductMobileCard = React.memo(({
  product: p,
  openEditModal,
  handleDeleteClick,
  setViewingVariants,
  setIsVariantsViewModalOpen,
  cn
}) => {
  const totalStock = p.variants?.length > 0
    ? p.variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0)
    : p.stock;
  return (
    <div className="flex items-center gap-3 p-3 hover:bg-slate-50 transition-colors">
      <div className="h-14 w-14 rounded-xl overflow-hidden bg-slate-100 ring-1 ring-slate-200 shrink-0">
        <img
          src={p.mainImage || p.image || "https://images.unsplash.com/photo-1550989460-0adf9ea622e2"}
          alt={p.name}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-slate-900 truncate">{p.name}</p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-xs text-slate-500 font-medium">{p.categoryId?.name || "N/A"}</span>
          <span className="text-[10px] text-slate-400">•</span>
          <span className="text-xs font-bold text-slate-900">₹{p.salePrice || p.price}</span>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className={cn(
            "text-[10px] font-bold px-1.5 py-0.5 rounded",
            totalStock === 0 ? "bg-rose-50 text-rose-600" : totalStock <= 10 ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600"
          )}>Stock: {totalStock}</span>
          {p.variants?.length > 0 && (
            <button
              onClick={() => { setViewingVariants(p); setIsVariantsViewModalOpen(true); }}
              className="text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">
              {p.variants.length} variants
            </button>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={() => openEditModal(p, true)}
          className="p-2 hover:bg-slate-100 hover:text-slate-600 rounded-lg transition-all text-slate-400 shadow-sm ring-1 ring-slate-200"
          title="View Details">
          <HiOutlineEye className="h-4 w-4" />
        </button>
        <button
          onClick={() => openEditModal(p, false)}
          className="p-2 hover:bg-white hover:text-red-500 rounded-lg transition-all text-slate-600 shadow-sm ring-1 ring-slate-200">
          <HiOutlinePencilSquare className="h-4 w-4" />
        </button>
        <button
          onClick={() => handleDeleteClick(p)}
          className="p-2 hover:bg-rose-50 hover:text-rose-600 rounded-lg transition-all text-slate-600 shadow-sm ring-1 ring-slate-200">
          <HiOutlineTrash className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
});
ProductMobileCard.displayName = "ProductMobileCard";

const ProductRow = React.memo(({
  product: p,
  openEditModal,
  handleDeleteClick,
  setViewingVariants,
  setIsVariantsViewModalOpen,
  cn
}) => {
  const totalStock = p.variants?.length > 0
    ? p.variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0)
    : p.stock;
  return (
    <tr className="ds-table-row">
      <td className="ds-table-cell">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-xl overflow-hidden bg-slate-100 ring-1 ring-slate-200">
            <img
              src={p.mainImage || p.image || "https://images.unsplash.com/photo-1550989460-0adf9ea622e2"}
              alt={p.name}
              className="h-full w-full object-cover group-hover:scale-110 transition-transform duration-500"
              loading="lazy"
            />
          </div>
          <div>
            <p className="font-semibold text-slate-900">
              {p.name}
            </p>
          </div>
        </div>
      </td>
      <td className="ds-table-cell font-semibold">
        {p.sku ||
          (Array.isArray(p.variants) && p.variants.length > 0 && p.variants[0]?.sku) ||
          "—"}
      </td>
      <td className="ds-table-cell text-left">
        <div className="flex flex-col">
          <span className="text-xs font-semibold text-slate-900 uppercase tracking-tight bg-slate-100 px-3 py-0.5 rounded-full w-fit">
            {p.headerId?.name || "N/A"}
          </span>
        </div>
      </td>
      <td className="ds-table-cell">
        <span className="font-medium text-slate-700">
          {p.categoryId?.name || "N/A"}
        </span>
      </td>
      <td className="ds-table-cell font-bold text-slate-900">
        ₹{p.price}
      </td>
      <td className="ds-table-cell font-bold text-emerald-700">
        ₹{p.salePrice || p.price}
      </td>
      <td className="ds-table-cell text-center">
        {p.variants?.length > 0 ? (
          <div
            onClick={() => {
              setViewingVariants(p);
              setIsVariantsViewModalOpen(true);
            }}
            className="flex flex-col items-center cursor-pointer hover:bg-slate-50 p-1.5 rounded-xl transition-all active:scale-95 group"
          >
            <Badge
              variant="orange"
              className="text-[10px] font-bold px-3 py-0.5 group-hover:shadow-sm transition-all animate-pulse"
            >
              {p.variants.length} VARIANTS
            </Badge>
          </div>
        ) : (
          <span className="text-xs font-medium text-slate-400 bg-slate-50 border border-slate-100 px-2 py-1 rounded italic">
            None
          </span>
        )}
      </td>
      <td className="ds-table-cell text-center">
        <span
          className={cn(
            "font-bold",
            totalStock === 0
              ? "text-rose-600"
              : totalStock <= 10
                ? "text-amber-600"
                : "text-emerald-600",
          )}>
          {totalStock}
        </span>
      </td>
      <td className="ds-table-cell text-right">
        <div className="flex items-center justify-end space-x-2">
          <button
            onClick={() => openEditModal(p, true)}
            className="p-2 hover:bg-slate-100 hover:text-slate-600 rounded-lg transition-all text-slate-400 shadow-sm ring-1 ring-slate-200"
            title="View Details">
            <HiOutlineEye className="h-4 w-4" />
          </button>
          <button
            onClick={() => openEditModal(p, false)}
            className="p-2 hover:bg-white hover:text-red-500 rounded-lg transition-all text-slate-600 shadow-sm ring-1 ring-slate-200">
            <HiOutlinePencilSquare className="h-4 w-4" />
          </button>
          <button
            onClick={() => handleDeleteClick(p)}
            className="p-2 hover:bg-rose-50 hover:text-rose-600 rounded-lg transition-all text-slate-600 shadow-sm ring-1 ring-slate-200">
            <HiOutlineTrash className="h-4 w-4" />
          </button>
        </div>
      </td>
    </tr>
  );
});
ProductRow.displayName = "ProductRow";

const normalizeType = (type) =>
  (type || "quick_commerce").toLowerCase().replace(/\s+/g, "_");

const normalizeSlugKey = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");

const isPharmacyHeader = (header) => {
  // Prefer slug so admins can rename the display name safely.
  const slug = normalizeSlugKey(header?.slug);
  if (slug) return slug === "pharmacy";
  // Back-compat fallback (older data may not have slug).
  const name = normalizeSlugKey(header?.name);
  return name === "pharmacy";
};

const PHARMACY_DOSAGE_FORM_OPTIONS = [
  { value: "tablet", label: "Tablet" },
  { value: "capsule", label: "Capsule" },
  { value: "syrup", label: "Syrup" },
  { value: "injection", label: "Injection" },
  { value: "drops", label: "Drops" },
  { value: "cream", label: "Cream" },
  { value: "ointment", label: "Ointment" },
  { value: "powder", label: "Powder" },
  { value: "spray", label: "Spray" },
  { value: "inhaler", label: "Inhaler" },
  { value: "medical_device", label: "Medical Device" },
  { value: "other", label: "Other" },
];

const PHARMACY_PACK_TYPE_OPTIONS = [
  { value: "strip", label: "Strip" },
  { value: "bottle", label: "Bottle" },
  { value: "box", label: "Box" },
  { value: "tube", label: "Tube" },
  { value: "vial", label: "Vial" },
  { value: "device", label: "Device" },
  { value: "piece", label: "Piece" },
];

const PHARMACY_UNIT_OPTIONS = [
  { value: "tablet", label: "Tablet" },
  { value: "capsule", label: "Capsule" },
  { value: "ml", label: "ml" },
  { value: "gm", label: "gm" },
  { value: "piece", label: "Piece" },
  { value: "vial", label: "Vial" },
  { value: "strip", label: "Strip" },
];

const PHARMACY_CLASSIFICATION_OPTIONS = [
  { value: "otc", label: "OTC" },
  { value: "prescription", label: "Prescription" },
  { value: "ayurvedic", label: "Ayurvedic" },
  { value: "homeopathic", label: "Homeopathic" },
  { value: "surgical", label: "Surgical" },
  { value: "medical_device", label: "Medical Device" },
  { value: "other", label: "Other" },
];

const PHARMACY_VARIANT_UNIT_LABELS = {
  tablet: "Tablets",
  capsule: "Capsules",
  ml: "ml",
  gm: "gm",
  piece: "Pieces",
  vial: "Vials",
  strip: "Strips",
};

const PHARMACY_VARIANT_PACK_TYPE_LABELS = {
  strip: "Strip",
  bottle: "Bottle",
  box: "Box",
  tube: "Tube",
  vial: "Vial",
  device: "Device",
  piece: "Piece",
};

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

const variantsWithoutPharmacyPlaceholder = (variants) => {
  const list = Array.isArray(variants) ? variants : [];
  // Remove ALL placeholder variants before appending generated variant.
  // Only strips items that are exactly the empty "Default" placeholder.
  return list.filter((v) => !isPharmacyDefaultPlaceholderVariant(v));
};

const buildPharmacyVariantName = ({ strength, packType, packQuantity, unit }) => {
  const s = String(strength || "").trim();
  const pTypeKey = String(packType || "").trim();
  const q = Number(packQuantity);
  const uKey = String(unit || "").trim();
  const uLabel = PHARMACY_VARIANT_UNIT_LABELS[uKey] || uKey || "Unit";
  const packLabel = PHARMACY_VARIANT_PACK_TYPE_LABELS[pTypeKey] || "";

  const hasQty = Number.isFinite(q) && q > 0;
  const qtyPart = hasQty ? `${q} ${uLabel}` : "";

  if (!s && hasQty && (uKey === "ml" || uKey === "gm") && packLabel) {
    return `${q}${uKey} ${packLabel}`;
  }

  if (!s && hasQty && packLabel) {
    if (pTypeKey === "strip") return `${packLabel} of ${qtyPart}`;
    if (pTypeKey === "box") return `Pack of ${qtyPart}`;
    if (pTypeKey === "bottle" || pTypeKey === "tube" || pTypeKey === "vial") return `${qtyPart} ${packLabel}`;
    return `${packLabel} of ${qtyPart}`;
  }

  if (s && hasQty && packLabel) {
    return `${s} - ${packLabel} of ${qtyPart}`;
  }

  if (s && qtyPart) return `${s} - ${qtyPart}`;
  if (s) return s;
  return qtyPart || "";
};

const formatPharmacyOptionLabel = (options, value) => {
  if (!value) return "—";
  const hit = options.find((o) => o.value === value);
  return hit?.label || String(value);
};

const getRxOtcLabel = (pd) => {
  if (!pd || typeof pd !== "object") return "—";
  if (pd.prescriptionRequired) return "Rx";
  const dc = String(pd.drugClassification || "").toLowerCase();
  if (dc === "prescription") return "Rx";
  if (dc === "otc" || !dc) return "OTC";
  return formatPharmacyOptionLabel(PHARMACY_CLASSIFICATION_OPTIONS, dc);
};

const getProductTotalStock = (product) => {
  if (product.variants?.length > 0) {
    return product.variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
  }
  return Number(product.stock) || 0;
};

const getPharmacyProductMeta = (product) => {
  const pd = product.pharmacyDetails || {};
  const realVariants = variantsWithoutPharmacyPlaceholder(product.variants);
  const v = realVariants[0];
  return {
    genericName: pd.genericName || "—",
    strength: v?.strength || pd.strength || "—",
    dosageForm: formatPharmacyOptionLabel(PHARMACY_DOSAGE_FORM_OPTIONS, pd.dosageForm),
    packType: formatPharmacyOptionLabel(
      PHARMACY_PACK_TYPE_OPTIONS,
      v?.packType || pd.packType,
    ),
    batchNumber: pd.batchNumber || "—",
    expDate: pd.expDate || "",
    rxOtc: getRxOtcLabel(pd),
  };
};

const getExpiryInfo = (expDate) => {
  if (!expDate) {
    return { daysRemaining: null, tier: "none", dateLabel: "—", daysLabel: "—" };
  }
  const exp = new Date(expDate);
  if (Number.isNaN(exp.getTime())) {
    return { daysRemaining: null, tier: "none", dateLabel: "—", daysLabel: "—" };
  }
  exp.setHours(23, 59, 59, 999);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysRemaining = Math.ceil((exp - today) / 86400000);
  let tier = "safe";
  if (daysRemaining < 0) tier = "expired";
  else if (daysRemaining <= 30) tier = "critical";
  else if (daysRemaining <= 90) tier = "warning";
  return {
    daysRemaining,
    tier,
    dateLabel: exp.toLocaleDateString(),
    daysLabel: daysRemaining < 0 ? "Expired" : String(daysRemaining),
  };
};

const EXPIRY_TIER_CLASS = {
  expired: "text-red-600 bg-red-50 ring-1 ring-red-100",
  critical: "text-orange-600 bg-orange-50 ring-1 ring-orange-100",
  warning: "text-yellow-700 bg-yellow-50 ring-1 ring-yellow-100",
  safe: "text-emerald-600 bg-emerald-50 ring-1 ring-emerald-100",
  none: "text-slate-400",
};

const getPharmacyListStatus = (product, totalStock) => {
  const threshold = product.lowStockAlert ?? 5;
  if (product.status === "inactive") return { label: "Inactive", tone: "slate" };
  if (totalStock === 0) return { label: "Out of Stock", tone: "rose" };
  if (totalStock <= threshold) return { label: "Low Stock", tone: "amber" };
  return { label: "Active", tone: "emerald" };
};

const PHARMACY_STATUS_TONE_CLASS = {
  slate: "bg-slate-100 text-slate-600",
  rose: "bg-rose-50 text-rose-600",
  amber: "bg-amber-50 text-amber-600",
  emerald: "bg-emerald-50 text-emerald-600",
};

const PharmacyProductMobileCard = React.memo(({
  product: p,
  openEditModal,
  handleDeleteClick,
  cn,
}) => {
  const meta = getPharmacyProductMeta(p);
  const totalStock = getProductTotalStock(p);
  const expiry = getExpiryInfo(meta.expDate);
  const status = getPharmacyListStatus(p, totalStock);
  return (
    <div className="flex items-center gap-3 p-3 hover:bg-slate-50 transition-colors">
      <div className="h-14 w-14 rounded-xl overflow-hidden bg-slate-100 ring-1 ring-slate-200 shrink-0">
        <img
          src={p.mainImage || p.image || "https://images.unsplash.com/photo-1550989460-0adf9ea622e2"}
          alt={p.name}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-slate-900 truncate">{p.name}</p>
        <p className="text-xs text-slate-500 truncate">{meta.genericName}</p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
            {meta.strength}
          </span>
          <span className="text-[10px] font-bold text-slate-600">{meta.dosageForm}</span>
          <span className={cn(
            "text-[10px] font-bold px-1.5 py-0.5 rounded",
            PHARMACY_STATUS_TONE_CLASS[status.tone],
          )}>
            {status.label}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className={cn(
            "text-[10px] font-bold px-1.5 py-0.5 rounded",
            totalStock === 0 ? "bg-rose-50 text-rose-600" : totalStock <= (p.lowStockAlert ?? 5) ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600",
          )}>
            Stock: {totalStock}
          </span>
          {expiry.tier !== "none" && (
            <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full", EXPIRY_TIER_CLASS[expiry.tier])}>
              Exp: {expiry.dateLabel}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={() => openEditModal(p, true)}
          className="p-2 hover:bg-slate-100 hover:text-slate-600 rounded-lg transition-all text-slate-400 shadow-sm ring-1 ring-slate-200"
          title="View Details">
          <HiOutlineEye className="h-4 w-4" />
        </button>
        <button
          onClick={() => openEditModal(p, false)}
          className="p-2 hover:bg-white hover:text-red-500 rounded-lg transition-all text-slate-600 shadow-sm ring-1 ring-slate-200">
          <HiOutlinePencilSquare className="h-4 w-4" />
        </button>
        <button
          onClick={() => handleDeleteClick(p)}
          className="p-2 hover:bg-rose-50 hover:text-rose-600 rounded-lg transition-all text-slate-600 shadow-sm ring-1 ring-slate-200">
          <HiOutlineTrash className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
});
PharmacyProductMobileCard.displayName = "PharmacyProductMobileCard";

const PharmacyProductRow = React.memo(({
  product: p,
  openEditModal,
  handleDeleteClick,
  cn,
}) => {
  const meta = getPharmacyProductMeta(p);
  const totalStock = getProductTotalStock(p);
  const expiry = getExpiryInfo(meta.expDate);
  const status = getPharmacyListStatus(p, totalStock);
  const threshold = p.lowStockAlert ?? 5;
  return (
    <tr className="ds-table-row">
      <td className="ds-table-cell">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl overflow-hidden bg-slate-100 ring-1 ring-slate-200 shrink-0">
            <img
              src={p.mainImage || p.image || "https://images.unsplash.com/photo-1550989460-0adf9ea622e2"}
              alt={p.name}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          </div>
          <p className="font-semibold text-slate-900">{p.name}</p>
        </div>
      </td>
      <td className="ds-table-cell text-slate-700">{meta.genericName}</td>
      <td className="ds-table-cell font-medium text-slate-800">{meta.strength}</td>
      <td className="ds-table-cell text-slate-700">{meta.dosageForm}</td>
      <td className="ds-table-cell text-slate-700">{meta.packType}</td>
      <td className="ds-table-cell text-slate-700">{p.categoryId?.name || "—"}</td>
      <td className="ds-table-cell">
        <span className={cn(
          "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide",
          meta.rxOtc === "Rx" ? "bg-violet-50 text-violet-700" : "bg-sky-50 text-sky-700",
        )}>
          {meta.rxOtc}
        </span>
      </td>
      <td className="ds-table-cell text-center">
        <span className={cn(
          "font-bold",
          totalStock === 0 ? "text-rose-600" : totalStock <= threshold ? "text-amber-600" : "text-emerald-600",
        )}>
          {totalStock}
        </span>
      </td>
      <td className="ds-table-cell">
        {expiry.tier === "none" ? (
          <span className="text-slate-400">—</span>
        ) : (
          <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full", EXPIRY_TIER_CLASS[expiry.tier])}>
            {expiry.dateLabel}
          </span>
        )}
      </td>
      <td className="ds-table-cell">
        <span className={cn(
          "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide",
          PHARMACY_STATUS_TONE_CLASS[status.tone],
        )}>
          {status.label}
        </span>
      </td>
      <td className="ds-table-cell text-right">
        <div className="flex items-center justify-end space-x-2">
          <button
            onClick={() => openEditModal(p, true)}
            className="p-2 hover:bg-slate-100 hover:text-slate-600 rounded-lg transition-all text-slate-400 shadow-sm ring-1 ring-slate-200"
            title="View Details">
            <HiOutlineEye className="h-4 w-4" />
          </button>
          <button
            onClick={() => openEditModal(p, false)}
            className="p-2 hover:bg-white hover:text-red-500 rounded-lg transition-all text-slate-600 shadow-sm ring-1 ring-slate-200">
            <HiOutlinePencilSquare className="h-4 w-4" />
          </button>
          <button
            onClick={() => handleDeleteClick(p)}
            className="p-2 hover:bg-rose-50 hover:text-rose-600 rounded-lg transition-all text-slate-600 shadow-sm ring-1 ring-slate-200">
            <HiOutlineTrash className="h-4 w-4" />
          </button>
        </div>
      </td>
    </tr>
  );
});
PharmacyProductRow.displayName = "PharmacyProductRow";

const ProductManagement = () => {
  const navigate = useNavigate();
  const user = useAuthStore(state => state.user);
  const sellerBusinessType = normalizeType(user?.shopInfo?.businessType);
  const isPharmacySeller = sellerBusinessType === "pharmacy";
  const [searchParams, setSearchParams] = useSearchParams();
  const qFromUrl = searchParams.get("q") || "";

  const [products, setProducts] = useState([]);
  const [dbCategories, setDbCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);

  const fetchProducts = useCallback(async (requestedPage = 1) => {
    setIsLoading(true);
    try {
      const res = await sellerApi.getProducts({ page: requestedPage, limit: pageSize });
      if (res.data.success) {
        // Backend returns handleResponse(..., { items, page, limit, total, totalPages })
        const payload = res.data.result || {};
        const rawProducts = Array.isArray(payload.items)
          ? payload.items
          : (res.data.results || []);
        const safe = Array.isArray(rawProducts) ? rawProducts : [];
        setProducts(safe);
        if (typeof payload.total === "number") {
          setTotal(payload.total);
        } else {
          setTotal(safe.length);
        }
        if (typeof payload.page === "number") {
          setPage(payload.page);
        } else {
          setPage(requestedPage);
        }
      }
    } catch (error) {
      toast.error("Failed to fetch products");
    } finally {
      setIsLoading(false);
    }
  }, [pageSize]);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await sellerApi.getCategoryTree();
      if (res.data.success) {
        setDbCategories(res.data.results || res.data.result || []);
      }
    } catch (error) {
      // fail silently
    }
  }, []);

  React.useEffect(() => {
    fetchProducts(1);
    fetchCategories();
  }, []);

  const categories = useMemo(() => {
    return dbCategories.filter((header) => {
      // Category headers no longer depend on header.businessType.
      // Pharmacy sellers should only see the single "Pharmacy" header.
      if (sellerBusinessType === "pharmacy") {
        return isPharmacyHeader(header);
      }

      // All other sellers (quick commerce, etc.) should not see the Pharmacy header.
      return !isPharmacyHeader(header);
    });
  }, [dbCategories, sellerBusinessType]);

  const [searchTerm, setSearchTerm] = useState(qFromUrl);

  React.useEffect(() => {
    if (qFromUrl !== searchTerm) setSearchTerm(qFromUrl);
  }, [qFromUrl]);

  const [filterCategory, setFilterCategory] = useState("all");
  const [filterStatus, setFilterStatus] = useState("All");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterDropdownRef = useRef(null);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [viewingVariants, setViewingVariants] = useState(null);
  const [isVariantsViewModalOpen, setIsVariantsViewModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [isViewMode, setIsViewMode] = useState(false);
  const [modalTab, setModalTab] = useState("general");
  const [pharmacyVariantDraft, setPharmacyVariantDraft] = useState(() => ({
    strength: "",
    packType: "strip",
    packQuantity: 10,
    unit: "tablet",
  }));
  const [pharmacyVariantsEnabled, setPharmacyVariantsEnabled] = useState(false);

  // ── Product IDs catalog browser state ────────────────────────────────────
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogPage, setCatalogPage] = useState(1);
  const [catalogTotal, setCatalogTotal] = useState(0);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogSearchInput, setCatalogSearchInput] = useState("");
  const [viewingCatalogProduct, setViewingCatalogProduct] = useState(null);
  const [copiedSku, setCopiedSku] = useState(false);
  const catalogSearchRef = useRef(null);

  // ── Fetch catalog products whenever drawer opens or search/page changes ──
  useEffect(() => {
    if (!isCatalogOpen) return;
    let cancelled = false;
    const fetchCatalog = async () => {
      setCatalogLoading(true);
      try {
        const res = await sellerApi.browseProductCatalog({ page: catalogPage, limit: 20, search: catalogSearch });
        if (!cancelled && res.data.success) {
          const payload = res.data.result || {};
          setCatalogProducts(Array.isArray(payload.items) ? payload.items : []);
          setCatalogTotal(typeof payload.total === 'number' ? payload.total : 0);
        }
      } catch (_) {
        if (!cancelled) setCatalogProducts([]);
      } finally {
        if (!cancelled) setCatalogLoading(false);
      }
    };
    fetchCatalog();
    return () => { cancelled = true; };
  }, [isCatalogOpen, catalogPage, catalogSearch]);

  // Debounce search input to update catalogSearch automatically
  useEffect(() => {
    if (!isCatalogOpen) return;
    const handler = setTimeout(() => {
      setCatalogPage(1);
      setCatalogSearch(catalogSearchInput.trim());
    }, 400);

    return () => {
      clearTimeout(handler);
    };
  }, [catalogSearchInput, isCatalogOpen]);

  const handleCatalogSearch = () => {
    setCatalogPage(1);
    setCatalogSearch(catalogSearchInput.trim());
  };

  const handleCopySku = (sku) => {
    navigator.clipboard.writeText(sku).then(() => {
      setCopiedSku(true);
      setTimeout(() => setCopiedSku(false), 2000);
    });
  };

  // Lock body scroll when any modal is open
  useEffect(() => {
    const anyOpen = isProductModalOpen || isDeleteModalOpen || isVariantsViewModalOpen || isCatalogOpen || !!viewingCatalogProduct;
    if (anyOpen) {
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      document.body.style.overflow = "hidden";
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    } else {
      document.body.style.overflow = "";
      document.body.style.paddingRight = "";
    }
    return () => {
      document.body.style.overflow = "";
      document.body.style.paddingRight = "";
    };
  }, [isProductModalOpen, isDeleteModalOpen, isVariantsViewModalOpen, isCatalogOpen, viewingCatalogProduct]);

  // Close filter dropdown on outside click
  React.useEffect(() => {
    if (!isFilterOpen) return;
    const handleClickOutside = (event) => {
      if (
        filterDropdownRef.current &&
        !filterDropdownRef.current.contains(event.target)
      ) {
        setIsFilterOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isFilterOpen]);

  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    sku: "",
    description: "",
    price: "",
    salePrice: "",
    stock: "",
    lowStockAlert: 5,
    category: "",
    header: "",
    subcategory: "",
    status: "active",
    tags: "",
    weight: "",
    brand: "",
    mainImage: null,
    galleryImages: [],
    pharmacyDetails: {
      genericName: "",
      manufacturer: "",
      composition: "",
      strength: "",
      dosageForm: "tablet",
      packType: "strip",
      packQuantity: 10,
      unit: "tablet",
      storageCondition: "",
      prescriptionRequired: false,
      drugClassification: "otc",
      drugLicenseNumber: "",
      hsnCode: "",
      batchNumber: "",
      mfgDate: "",
      expDate: "",
      // Legacy/free-text fallback kept for backwards compatibility.
      packSize: "",
    },
    variants: [
      { id: Date.now(), name: "Default", price: "", salePrice: "", stock: "", sku: "" },
    ],
  });

  const sanitizeDigits = (value = "") => String(value).replace(/\D+/g, "");

  const sanitizeLicense = (value = "") =>
    String(value)
      .toUpperCase()
      .replace(/\s+/g, "")
      .replace(/[^A-Z0-9/-]+/g, "");

  const sanitizeBatch = (value = "") =>
    String(value)
      .toUpperCase()
      .replace(/\s+/g, "")
      .replace(/[^A-Z0-9-]+/g, "");

  const safeProducts = useMemo(
    () => (Array.isArray(products) ? products : []),
    [products]
  );

  const filteredProducts = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const min = priceMin ? Number(priceMin) : null;
    const max = priceMax ? Number(priceMax) : null;

    return safeProducts.filter((p) => {
      const variantSkus = Array.isArray(p.variants)
        ? p.variants
            .map((v) => (v?.sku || "").toString().toLowerCase())
            .filter(Boolean)
        : [];
      const skuCandidate =
        (p.sku || "").toString().toLowerCase() ||
        (variantSkus.length > 0 ? variantSkus[0] : "");

      const matchesSearch =
        !term ||
        p.name.toLowerCase().includes(term) ||
        (!!skuCandidate && skuCandidate.includes(term));
      const matchesCategory =
        filterCategory === "all" ||
        (p.categoryId?._id || p.categoryId) === filterCategory ||
        (p.headerId?._id || p.headerId) === filterCategory;

      let matchesStatus = filterStatus === "All";
      if (filterStatus === "Active") matchesStatus = p.status === "active";
      if (filterStatus === "Low Stock")
        matchesStatus = p.stock > 0 && p.stock <= 10;
      if (filterStatus === "Out of Stock") matchesStatus = p.stock === 0;

      let matchesPrice = true;
      const effectivePrice = Number(p.salePrice ?? p.price ?? 0);
      if (min !== null && !Number.isNaN(min)) {
        matchesPrice = matchesPrice && effectivePrice >= min;
      }
      if (max !== null && !Number.isNaN(max)) {
        matchesPrice = matchesPrice && effectivePrice <= max;
      }

      return matchesSearch && matchesCategory && matchesStatus && matchesPrice;
    });
  }, [safeProducts, searchTerm, filterCategory, filterStatus, priceMin, priceMax]);

  const getProductTotalStock = (p) => {
    return p.variants?.length > 0
      ? p.variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0)
      : p.stock;
  };

  const stats = useMemo(
    () => ({
      total: safeProducts.length,
      lowStock: safeProducts.filter((p) => {
        const stock = getProductTotalStock(p);
        return stock > 0 && stock <= 10;
      }).length,
      outOfStock: safeProducts.filter((p) => getProductTotalStock(p) === 0).length,
      active: safeProducts.filter((p) => p.status === "active").length,
    }),
    [safeProducts],
  );

  const handleSave = async () => {
    try {
      if (!formData.name || !formData.price || !formData.stock || !formData.header || !formData.category || !formData.subcategory) {
        toast.error("Please fill all required fields, including categories");
        return;
      }

      if (sellerBusinessType === "pharmacy") {
        if (!formData.pharmacyDetails.genericName || !formData.pharmacyDetails.manufacturer) {
          toast.error("Please fill Generic Name and Manufacturer for Pharmacy products.");
          return;
        }
        if (!formData.pharmacyDetails.dosageForm || !formData.pharmacyDetails.packType || !formData.pharmacyDetails.unit || !formData.pharmacyDetails.packQuantity || Number(formData.pharmacyDetails.packQuantity) < 1) {
          toast.error("Please fill Dosage Form, Pack Type, Pack Quantity and Unit for Pharmacy products.");
          return;
        }
      }

      const data = new FormData();
      data.append("name", formData.name);
      data.append("slug", formData.slug);
      data.append("sku", formData.sku);
      data.append("description", formData.description);
      data.append("price", Number(formData.price));
      data.append("salePrice", Number(formData.salePrice) || 0);
      data.append("stock", Number(formData.stock));
      data.append("headerId", formData.header);
      data.append("categoryId", formData.category);
      data.append("subcategoryId", formData.subcategory);
      data.append("status", formData.status);
      data.append("brand", formData.brand);
      data.append("weight", formData.weight);
      data.append("tags", formData.tags);
      data.append("variants", JSON.stringify(formData.variants));

      if (sellerBusinessType === "pharmacy") {
        data.append("pharmacyDetails", JSON.stringify(formData.pharmacyDetails));
      }

      if (formData.mainImageFile) {
        data.append("mainImage", formData.mainImageFile);
      } else if (formData.mainImage) {
        data.append("mainImage", formData.mainImage);
      }
      if (formData.galleryFiles && formData.galleryFiles.length > 0) {
        formData.galleryFiles.forEach((file) => data.append("galleryImages", file));
      } else if (formData.galleryImages && formData.galleryImages.length > 0) {
        data.append("galleryImages", JSON.stringify(formData.galleryImages));
      }

      if (editingItem) {
        await sellerApi.updateProduct(editingItem._id || editingItem.id, data);
        toast.success("Product updated successfully");
      } else {
        await sellerApi.createProduct(data);
        toast.success("Product created successfully");
      }

      setIsProductModalOpen(false);
      setEditingItem(null);
      fetchProducts();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to save product");
    }
  };

  const handleImageUpload = (e, type) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        if (type === "main") {
          setFormData({ ...formData, mainImage: reader.result, mainImageFile: file });
        } else {
          setFormData({
            ...formData,
            galleryImages: [...formData.galleryImages, reader.result],
            galleryFiles: [...(formData.galleryFiles || []), file]
          });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const exportProducts = useCallback(() => {
    console.log("Exporting products...");
    alert("Exporting " + safeProducts.length + " products as CSV (Simulation)");
  }, [safeProducts.length]);

  const handleDeleteClick = useCallback((product) => {
    setItemToDelete(product);
    setIsDeleteModalOpen(true);
  }, []);

  const confirmDelete = useCallback(async () => {
    try {
      await sellerApi.deleteProduct(itemToDelete._id || itemToDelete.id);
      toast.success("Product deleted successfully");
      setIsDeleteModalOpen(false);
      setItemToDelete(null);
      fetchProducts();
    } catch (error) {
      toast.error("Failed to delete product");
    }
  }, [itemToDelete, fetchProducts]);

  const openEditModal = useCallback((item = null, viewMode = false) => {
    setIsViewMode(viewMode);
    if (item) {
      setFormData({
        name: item.name || "",
        slug: item.slug || "",
        sku: item.sku || "",
        description: item.description || "",
        price: item.price || "",
        salePrice: item.salePrice || "",
        stock: item.stock || "",
        lowStockAlert: item.lowStockAlert || 5,
        header: item.headerId?._id || item.headerId || "",
        category: item.categoryId?._id || item.categoryId || "",
        subcategory: item.subcategoryId?._id || item.subcategoryId || "",
        status: item.status || "active",
        tags: Array.isArray(item.tags) ? item.tags.join(", ") : item.tags || "",
        weight: item.weight || "",
        brand: item.brand || "",
        mainImage: item.mainImage || null,
        galleryImages: item.galleryImages || [],
        pharmacyDetails: item.pharmacyDetails || {
          genericName: "",
          manufacturer: "",
          composition: "",
          strength: "",
          dosageForm: "tablet",
          packType: "strip",
          packQuantity: 10,
          unit: "tablet",
          storageCondition: "",
          prescriptionRequired: false,
          drugClassification: "otc",
          drugLicenseNumber: "",
          hsnCode: "",
          batchNumber: "",
          mfgDate: "",
          expDate: "",
          packSize: "",
        },
        variants: (item.variants && item.variants.length > 0) ? item.variants.map(v => ({ ...v, id: v._id || Date.now() })) : [
          {
            id: Date.now(),
            name: "Default",
            price: item.price || "",
            salePrice: item.salePrice || "",
            stock: item.stock || "",
            sku: item.sku || "",
          },
        ],
      });
      setEditingItem(item);
    } else {
      setFormData({
        name: "",
        slug: "",
        sku: "",
        description: "",
        price: "",
        salePrice: "",
        stock: "",
        lowStockAlert: 5,
        category: "",
        header: "",
        status: "active",
        tags: "",
        weight: "",
        brand: "",
        mainImage: null,
        galleryImages: [],
        pharmacyDetails: {
          genericName: "",
          manufacturer: "",
          composition: "",
          strength: "",
          dosageForm: "tablet",
          packType: "strip",
          packQuantity: 10,
          unit: "tablet",
          storageCondition: "",
          prescriptionRequired: false,
          drugClassification: "otc",
          drugLicenseNumber: "",
          hsnCode: "",
          batchNumber: "",
          mfgDate: "",
          expDate: "",
          packSize: "",
        },
        variants: [
          {
            id: Date.now(),
            name: "Default",
            price: "",
            salePrice: "",
            stock: "",
            sku: "",
          },
        ],
      });
      setEditingItem(null);
    }
    setModalTab("general");
    setIsProductModalOpen(true);
  }, []);

  return (
    <div className="space-y-6 pb-16">
      <BlurFade delay={0.1}>
        {/* Page Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2 text-slate-900">
              Product List
              <Badge
                variant="primary"
                className="text-[9px] px-1.5 py-0 font-bold tracking-wider uppercase bg-red-100 text-red-700">
                Live
              </Badge>
            </h1>
            <p className="text-slate-600 text-base mt-0.5">
              Track your items, prices, and how many are left in stock.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Product IDs browser — pharmacy sellers see pharmacy catalog only (server-filtered) */}
            <button
              onClick={() => { setIsCatalogOpen(true); setCatalogPage(1); setCatalogSearch(""); setCatalogSearchInput(""); }}
              className="px-5 py-2.5 rounded-lg text-xs font-bold border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 hover:border-red-300 transition-all flex items-center gap-2 shadow-sm"
            >
              <HiOutlineQrCode className="h-4 w-4" />
              <span>{isPharmacySeller ? "PHARMACY PRODUCT IDs" : "PRODUCT IDs"}</span>
            </button>
            <ShimmerButton
              onClick={() => navigate("/seller/products/add")}
              className="px-6 py-2.5 rounded-lg text-xs font-bold shadow-xl flex items-center space-x-2 text-white"
              background="#FF0000">
              <HiOutlinePlus className="h-4 w-4 mr-2" />
              <span>ADD NEW PRODUCT</span>
            </ShimmerButton>
          </div>
        </div>
      </BlurFade>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "All Items",
            val: stats.total,
            icon: HiOutlineCube,
            color: "text-red-600",
            bg: "bg-red-50",
            status: "All",
          },
          {
            label: "Active Items",
            val: stats.active,
            icon: HiOutlineCheckCircle,
            color: "text-emerald-600",
            bg: "bg-emerald-50",
            status: "Active",
          },
          {
            label: "Low Stock",
            val: stats.lowStock,
            icon: HiOutlineExclamationCircle,
            color: "text-amber-600",
            bg: "bg-amber-50",
            status: "Low Stock",
          },
          {
            label: "Out of Stock",
            val: stats.outOfStock,
            icon: HiOutlineArchiveBox,
            color: "text-rose-600",
            bg: "bg-rose-50",
            status: "Out of Stock",
          },
        ].map((stat, i) => (
          <BlurFade key={i} delay={0.1 + i * 0.05}>
            <div
              onClick={() => setFilterStatus(stat.status)}
              className={cn(
                "cursor-pointer rounded-lg transition-all duration-300",
                filterStatus === stat.status
                  ? "ring-2 ring-red-500 shadow-lg"
                  : "hover:shadow-md",
              )}>
              <MagicCard
                className="border-none shadow-sm ring-1 ring-slate-100 p-0 overflow-hidden group bg-white"
                gradientColor={
                  stat.bg.includes("orange")
                    ? "#FFEDED"
                    : stat.bg.includes("emerald")
                      ? "#ecfdf5"
                      : stat.bg.includes("amber")
                        ? "#fffbeb"
                        : "#fff1f2"
                }>
                <div className="flex items-center gap-3 p-4 relative z-10">
                  <div
                    className={cn(
                      "h-12 w-12 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110 duration-300 shadow-sm",
                      stat.bg,
                      stat.color,
                    )}>
                    <stat.icon className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-600 uppercase tracking-widest">
                      {stat.label}
                    </p>
                    <h4 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                      {stat.val}
                    </h4>
                  </div>
                </div>
              </MagicCard>
            </div>
          </BlurFade>
        ))}
      </div>

      {/* Toolbox */}
      <BlurFade delay={0.25}>
        <Card className="relative z-30 border-none shadow-sm ring-1 ring-slate-100 p-3 bg-white/60 backdrop-blur-xl">
          <div className="flex flex-col lg:flex-row gap-3 items-center">
            <div className="relative flex-1 group w-full">
              <HiOutlineMagnifyingGlass className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-600 group-focus-within:text-red-500 transition-all" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  const value = e.target.value;
                  setSearchTerm(value);
                  const next = new URLSearchParams(searchParams);
                  if (value) {
                    next.set("q", value);
                  } else {
                    next.delete("q");
                  }
                  setSearchParams(next);
                }}
                placeholder="Search by name or SKU..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-100/50 border-none rounded-lg text-sm font-semibold text-slate-700 placeholder:text-slate-500 focus:ring-2 focus:ring-red-500/5 transition-all outline-none"
              />
            </div>
            <div className="relative flex gap-2 shrink-0 w-full lg:w-auto">
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="flex-1 lg:flex-none px-4 py-2.5 bg-white ring-1 ring-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:ring-2 focus:ring-red-500/5 outline-none appearance-none cursor-pointer">
                <option value="all">All Categories</option>
                {categories.map((h) => (
                  <optgroup key={h._id || h.id} label={h.name}>
                    {(h.children || []).map((c) => (
                      <option key={c._id || c.id} value={c._id || c.id}>
                        {c.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <button
                onClick={() => setIsFilterOpen((prev) => !prev)}
                className="flex items-center space-x-2 px-4 py-2.5 bg-white ring-1 ring-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all"
              >
                <HiOutlineFunnel className="h-4 w-4" />
                <span>Filters</span>
              </button>
            </div>
          </div>
        </Card>
      </BlurFade>

      {/* Product Table */}
      <BlurFade delay={0.3}>
        <Card className="relative z-10 border-none shadow-xl ring-1 ring-slate-100 overflow-hidden rounded-3xl">
          {/* Mobile Card List */}
          <div className="md:hidden divide-y divide-slate-100">
            {filteredProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4">
                <HiOutlineFolderOpen className="h-10 w-10 text-slate-300 mb-3" />
                <p className="text-sm font-bold text-slate-600">No products found</p>
                <p className="text-xs text-slate-400 mt-1">Try adjusting your filters</p>
              </div>
            ) : filteredProducts.map((p) => (
              sellerBusinessType === "pharmacy" ? (
                <PharmacyProductMobileCard
                  key={p._id || p.id}
                  product={p}
                  openEditModal={openEditModal}
                  handleDeleteClick={handleDeleteClick}
                  cn={cn}
                />
              ) : (
                <ProductMobileCard
                  key={p._id || p.id}
                  product={p}
                  openEditModal={openEditModal}
                  handleDeleteClick={handleDeleteClick}
                  setViewingVariants={setViewingVariants}
                  setIsVariantsViewModalOpen={setIsVariantsViewModalOpen}
                  cn={cn}
                />
              )
            ))}
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="ds-table">
              <thead className="ds-table-header">
                <tr>
                  {sellerBusinessType === "pharmacy" ? (
                    <>
                      <th className="ds-table-header-cell text-left">Product Name</th>
                      <th className="ds-table-header-cell text-left">Generic Name</th>
                      <th className="ds-table-header-cell text-left">Strength</th>
                      <th className="ds-table-header-cell text-left">Dosage Form</th>
                      <th className="ds-table-header-cell text-left">Pack Type</th>
                      <th className="ds-table-header-cell text-left">Category</th>
                      <th className="ds-table-header-cell text-left">Rx/OTC</th>
                      <th className="ds-table-header-cell text-center">Stock</th>
                      <th className="ds-table-header-cell text-left">Expiry Date</th>
                      <th className="ds-table-header-cell text-left">Status</th>
                      <th className="ds-table-header-cell text-right">Actions</th>
                    </>
                  ) : (
                    <>
                      <th className="ds-table-header-cell text-left">
                        Product
                      </th>
                      <th className="ds-table-header-cell text-left">
                        Product Code
                      </th>
                      <th className="ds-table-header-cell text-left">
                        Header
                      </th>
                      <th className="ds-table-header-cell text-left">
                        Category
                      </th>
                      <th className="ds-table-header-cell text-left">
                        Reg. Price
                      </th>
                      <th className="ds-table-header-cell text-left">
                        Discounted Price
                      </th>
                      <th className="ds-table-header-cell text-center">
                        Variant
                      </th>
                      <th className="ds-table-header-cell text-center">
                        Stock
                      </th>
                      <th className="ds-table-header-cell text-right">
                        Actions
                      </th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((p) => (
                  sellerBusinessType === "pharmacy" ? (
                    <PharmacyProductRow
                      key={p._id || p.id}
                      product={p}
                      openEditModal={openEditModal}
                      handleDeleteClick={handleDeleteClick}
                      cn={cn}
                    />
                  ) : (
                    <ProductRow
                      key={p._id || p.id}
                      product={p}
                      openEditModal={openEditModal}
                      handleDeleteClick={handleDeleteClick}
                      setViewingVariants={setViewingVariants}
                      setIsVariantsViewModalOpen={setIsVariantsViewModalOpen}
                      cn={cn}
                    />
                  )
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </BlurFade>

      {isFilterOpen && (
        <div
          ref={filterDropdownRef}
          className="fixed z-[9999] right-4 top-auto w-[calc(100vw-2rem)] sm:w-64 sm:absolute sm:right-4 sm:top-auto rounded-xl border border-slate-200 bg-white shadow-xl p-4 space-y-3"
          style={{ maxWidth: '320px' }}
        >
          <div>
            <p className="text-[11px] font-semibold text-slate-600 uppercase tracking-[0.18em] mb-1">
              Status
            </p>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-red-500/10 outline-none bg-white"
            >
              <option value="All">All</option>
              <option value="Active">Active</option>
              <option value="Low Stock">Low Stock</option>
              <option value="Out of Stock">Out of Stock</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-[11px] font-semibold text-slate-600 uppercase tracking-[0.18em] mb-1">
                Min Price
              </p>
              <input
                type="number"
                min="0"
                value={priceMin}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "" || Number(val) >= 0) setPriceMin(val);
                }}
                placeholder="e.g. 100"
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-red-500/10 outline-none bg-white"
              />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-600 uppercase tracking-[0.18em] mb-1">
                Max Price
              </p>
              <input
                type="number"
                min="1"
                value={priceMax}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "" || Number(val) >= 1) setPriceMax(val);
                }}
                placeholder="e.g. 1000"
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-red-500/10 outline-none bg-white"
              />
            </div>
          </div>
          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={() => {
                setFilterCategory("all");
                setFilterStatus("All");
                setPriceMin("");
                setPriceMax("");
                setSearchTerm("");
                setSearchParams({});
              }}
              className="text-[11px] font-bold text-slate-600 hover:text-slate-700"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => setIsFilterOpen(false)}
              className="px-3 py-1.5 text-[11px] font-semibold rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              Done
            </button>
          </div>
        </div>
      )}

      <div className="mt-4">
        <Pagination
          page={page}
          totalPages={Math.ceil(total / pageSize) || 1}
          total={total}
          pageSize={pageSize}
          onPageChange={(p) => fetchProducts(p)}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setPage(1);
            fetchProducts(1);
          }}
          loading={isLoading}
        />
      </div>

      {/* Edit Modal (Copy from Admin) */}
      <AnimatePresence>
        {isProductModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 lg:p-12 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-md"
              onClick={() => setIsProductModalOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-5xl relative z-10 bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col">
              {/* Modal Header */}
              <div className="flex items-center justify-between p-6 border-b border-slate-100">
                <div className="flex items-center space-x-3">
                  <div className="h-10 w-10 bg-slate-900 text-white rounded-xl flex items-center justify-center">
                    <HiOutlineCube className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">
                      {isViewMode ? 'Product Details' : 'Edit Product'}
                    </h3>
                    <div className="flex items-center space-x-2 mt-0.5">
                      <Badge
                        variant="primary"
                        className="text-[7px] font-bold uppercase tracking-widest px-1 bg-red-100 text-red-700">
                        SELLER
                      </Badge>
                      <HiOutlineChevronRight className="h-2.5 w-2.5 text-slate-300" />
                      <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">
                        {formData.sku || "PENDING SKU"}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setIsProductModalOpen(false)}
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-600">
                  <HiOutlineXMark className="h-5 w-5" />
                </button>
              </div>

              <div className="flex flex-col lg:flex-row flex-1 min-h-[400px] max-h-[calc(100vh-200px)] overflow-hidden">
                {/* Modal Sidebar Tabs */}
                <div className="lg:w-1/4 bg-slate-50/50 border-r border-slate-100 p-4 space-y-1 overflow-y-auto">
                  {[
                    {
                      id: "general",
                      label: "General Info",
                      icon: HiOutlineTag,
                    },
                    ...(sellerBusinessType === "pharmacy" ? [{ id: "medicine", label: "Medicine Details", icon: HiOutlineTag }] : []),
                    {
                      id: "pricing",
                      label: "Pricing & Stock",
                      icon: HiOutlineCurrencyDollar,
                    },
                    {
                      id: "variants",
                      label: "Item Variants",
                      icon: HiOutlineSwatch,
                    },
                    {
                      id: "category",
                      label: "Groups",
                      icon: HiOutlineFolderOpen,
                    },
                    { id: "media", label: "Photos", icon: HiOutlinePhoto },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setModalTab(tab.id)}
                      className={cn(
                        "w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-xs font-bold transition-all text-left",
                        modalTab === tab.id
                          ? "bg-white text-red-500 shadow-sm ring-1 ring-slate-100"
                          : "text-slate-600 hover:bg-slate-100",
                      )}>
                      <tab.icon className="h-4 w-4" />
                      <span>{tab.label}</span>
                    </button>
                  ))}

                  <div className="pt-8 px-4">
                    <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                      <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest mb-1">
                        Status
                      </p>
                      <select
                        value={formData.status}
                        onChange={(e) =>
                          setFormData({ ...formData, status: e.target.value })
                        }
                        disabled={isViewMode}
                        className="w-full bg-transparent border-none text-xs font-bold text-emerald-700 outline-none p-0 cursor-pointer focus:ring-0 disabled:opacity-80">
                        <option value="active">PUBLISHED</option>
                        <option value="inactive">DRAFT</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Modal Content Area */}
                <div className="flex-1 p-8 overflow-y-auto">
                  {modalTab === "general" && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-300">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-1.5 flex flex-col">
                          <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                            Product Title
                          </label>
                          <input
                            value={formData.name}
                            onChange={(e) =>
                              setFormData({ ...formData, name: e.target.value })
                            }
                            className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-xl text-sm font-semibold outline-none ring-red-500/5 focus:ring-2"
                            placeholder="e.g. Premium Basmati Rice"
                            disabled={isViewMode}
                          />
                        </div>
                        <div className="space-y-1.5 flex flex-col">
                          <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                            Web Address
                          </label>
                          <div className="flex items-center bg-slate-50 rounded-xl px-4 py-2.5">
                            <span className="text-[10px] text-slate-600 font-bold mr-1">
                              /product/
                            </span>
                            <input
                              value={formData.slug}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  slug: e.target.value,
                                })
                              }
                              className="flex-1 bg-transparent border-none text-sm text-slate-600 font-semibold outline-none"
                              placeholder="premium-basmati-rice"
                              disabled={isViewMode}
                            />
                          </div>
                        </div>
                      </div>
                      <div className="space-y-1.5 flex flex-col">
                        <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                          About this item
                        </label>
                        <textarea
                          value={formData.description}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              description: e.target.value,
                            })
                          }
                          onWheel={(e) => e.stopPropagation()}
                          onTouchMove={(e) => e.stopPropagation()}
                          className="w-full px-4 py-3 bg-slate-100 border-none rounded-2xl text-sm font-semibold min-h-[160px] max-h-[260px] outline-none resize-none overflow-y-auto custom-scrollbar"
                          placeholder="Describe the item here..."
                          disabled={isViewMode}
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-1.5 flex flex-col">
                          <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                            Brand Name
                          </label>
                          <input
                            value={formData.brand}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                brand: e.target.value,
                              })
                            }
                            className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-xl text-sm font-semibold outline-none ring-red-500/5 focus:ring-2"
                            placeholder="e.g. Amul"
                            disabled={isViewMode}
                          />
                        </div>
                        <div className="space-y-1.5 flex flex-col">
                          <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                            Product Code
                          </label>
                          <input
                            value={formData.sku}
                            onChange={(e) =>
                              setFormData({ ...formData, sku: e.target.value })
                            }
                            className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-xl text-sm font-mono font-bold outline-none ring-red-500/5 focus:ring-2"
                            placeholder="AUTO-GENERATED"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {modalTab === "medicine" && sellerBusinessType === "pharmacy" && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-300">
                      <div className="space-y-6">
                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide border-b border-slate-200 pb-2">Medicine Information</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-1.5 flex flex-col">
                            <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">Generic Name</label>
                            <input type="text" value={formData.pharmacyDetails.genericName} onChange={(e) => setFormData({ ...formData, pharmacyDetails: { ...formData.pharmacyDetails, genericName: e.target.value } })} className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-md text-sm font-bold outline-none ring-slate-100 ring-1 focus:ring-2 focus:ring-red-500/20" placeholder="e.g. Paracetamol" disabled={isViewMode} />
                          </div>
                          <div className="space-y-1.5 flex flex-col">
                            <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">Manufacturer</label>
                            <input type="text" value={formData.pharmacyDetails.manufacturer} onChange={(e) => setFormData({ ...formData, pharmacyDetails: { ...formData.pharmacyDetails, manufacturer: e.target.value } })} className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-md text-sm font-bold outline-none ring-slate-100 ring-1 focus:ring-2 focus:ring-red-500/20" placeholder="Manufacturer Name" disabled={isViewMode} />
                          </div>
                          <div className="space-y-1.5 flex flex-col">
                            <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">Composition</label>
                            <input type="text" value={formData.pharmacyDetails.composition} onChange={(e) => setFormData({ ...formData, pharmacyDetails: { ...formData.pharmacyDetails, composition: e.target.value } })} className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-md text-sm font-bold outline-none ring-slate-100 ring-1 focus:ring-2 focus:ring-red-500/20" placeholder="Active ingredients" disabled={isViewMode} />
                          </div>
                          <div className="space-y-1.5 flex flex-col">
                            <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">Strength</label>
                            <input type="text" value={formData.pharmacyDetails.strength} onChange={(e) => setFormData({ ...formData, pharmacyDetails: { ...formData.pharmacyDetails, strength: e.target.value } })} className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-md text-sm font-bold outline-none ring-slate-100 ring-1 focus:ring-2 focus:ring-red-500/20" placeholder="e.g. 500mg" disabled={isViewMode} />
                          </div>
                          <div className="space-y-1.5 flex flex-col">
                            <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">Dosage Form</label>
                            <select
                              value={formData.pharmacyDetails.dosageForm}
                              onChange={(e) => setFormData({ ...formData, pharmacyDetails: { ...formData.pharmacyDetails, dosageForm: e.target.value } })}
                              className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-md text-sm font-bold outline-none ring-slate-100 ring-1 focus:ring-2 focus:ring-red-500/20 cursor-pointer"
                              disabled={isViewMode}
                            >
                              {PHARMACY_DOSAGE_FORM_OPTIONS.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-1.5 flex flex-col">
                            <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">Pack Type</label>
                            <select
                              value={formData.pharmacyDetails.packType}
                              onChange={(e) => setFormData({ ...formData, pharmacyDetails: { ...formData.pharmacyDetails, packType: e.target.value } })}
                              className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-md text-sm font-bold outline-none ring-slate-100 ring-1 focus:ring-2 focus:ring-red-500/20 cursor-pointer"
                              disabled={isViewMode}
                            >
                              {PHARMACY_PACK_TYPE_OPTIONS.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-1.5 flex flex-col">
                            <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">Pack Quantity</label>
                            <input
                              type="number"
                              min="1"
                              value={formData.pharmacyDetails.packQuantity}
                              onChange={(e) => setFormData({ ...formData, pharmacyDetails: { ...formData.pharmacyDetails, packQuantity: e.target.value } })}
                              className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-md text-sm font-bold outline-none ring-slate-100 ring-1 focus:ring-2 focus:ring-red-500/20"
                              placeholder="e.g. 10"
                              disabled={isViewMode}
                            />
                          </div>
                          <div className="space-y-1.5 flex flex-col">
                            <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">Unit</label>
                            <select
                              value={formData.pharmacyDetails.unit}
                              onChange={(e) => setFormData({ ...formData, pharmacyDetails: { ...formData.pharmacyDetails, unit: e.target.value } })}
                              className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-md text-sm font-bold outline-none ring-slate-100 ring-1 focus:ring-2 focus:ring-red-500/20 cursor-pointer"
                              disabled={isViewMode}
                            >
                              {PHARMACY_UNIT_OPTIONS.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide border-b border-slate-200 pb-2 mt-8">Classification & Regulatory</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-1.5 flex flex-col">
                            <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">Classification</label>
                            <select
                              value={formData.pharmacyDetails.drugClassification}
                              onChange={(e) => setFormData({ ...formData, pharmacyDetails: { ...formData.pharmacyDetails, drugClassification: e.target.value } })}
                              className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-md text-sm font-bold outline-none ring-slate-100 ring-1 focus:ring-2 focus:ring-red-500/20 cursor-pointer"
                              disabled={isViewMode}
                            >
                              {PHARMACY_CLASSIFICATION_OPTIONS.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-1.5 flex flex-col">
                            <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">Prescription Required</label>
                            <select value={formData.pharmacyDetails.prescriptionRequired ? "Yes" : "No"} onChange={(e) => setFormData({ ...formData, pharmacyDetails: { ...formData.pharmacyDetails, prescriptionRequired: e.target.value === "Yes" } })} className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-md text-sm font-bold outline-none ring-slate-100 ring-1 focus:ring-2 focus:ring-red-500/20" disabled={isViewMode}>
                              <option value="No">No</option>
                              <option value="Yes">Yes</option>
                            </select>
                          </div>
                          <div className="space-y-1.5 flex flex-col">
                            <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">Drug License Number</label>
                            <input
                              type="text"
                              value={formData.pharmacyDetails.drugLicenseNumber}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  pharmacyDetails: {
                                    ...formData.pharmacyDetails,
                                    drugLicenseNumber: sanitizeLicense(e.target.value),
                                  },
                                })
                              }
                              className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-md text-sm font-bold outline-none ring-slate-100 ring-1 focus:ring-2 focus:ring-red-500/20"
                              placeholder="License Number"
                              autoCapitalize="characters"
                              disabled={isViewMode}
                            />
                          </div>
                          <div className="space-y-1.5 flex flex-col">
                            <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">HSN Code</label>
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              value={formData.pharmacyDetails.hsnCode}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  pharmacyDetails: {
                                    ...formData.pharmacyDetails,
                                    hsnCode: sanitizeDigits(e.target.value),
                                  },
                                })
                              }
                              className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-md text-sm font-bold outline-none ring-slate-100 ring-1 focus:ring-2 focus:ring-red-500/20"
                              placeholder="HSN Code"
                              disabled={isViewMode}
                            />
                          </div>
                        </div>

                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide border-b border-slate-200 pb-2 mt-8">Batch Details & Storage</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-1.5 flex flex-col">
                            <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">Batch Number</label>
                            <input
                              type="text"
                              value={formData.pharmacyDetails.batchNumber}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  pharmacyDetails: {
                                    ...formData.pharmacyDetails,
                                    batchNumber: sanitizeBatch(e.target.value),
                                  },
                                })
                              }
                              className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-md text-sm font-bold outline-none ring-slate-100 ring-1 focus:ring-2 focus:ring-red-500/20"
                              placeholder="Batch Number"
                              autoCapitalize="characters"
                              disabled={isViewMode}
                            />
                          </div>
                          <div className="space-y-1.5 flex flex-col">
                            <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">Manufacturing Date</label>
                            <input type="date" value={formData.pharmacyDetails.mfgDate} onChange={(e) => setFormData({ ...formData, pharmacyDetails: { ...formData.pharmacyDetails, mfgDate: e.target.value } })} className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-md text-sm font-bold outline-none ring-slate-100 ring-1 focus:ring-2 focus:ring-red-500/20" disabled={isViewMode} />
                          </div>
                          <div className="space-y-1.5 flex flex-col">
                            <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">Expiry Date</label>
                            <input type="date" value={formData.pharmacyDetails.expDate} onChange={(e) => setFormData({ ...formData, pharmacyDetails: { ...formData.pharmacyDetails, expDate: e.target.value } })} className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-md text-sm font-bold outline-none ring-slate-100 ring-1 focus:ring-2 focus:ring-red-500/20" disabled={isViewMode} />
                          </div>
                          <div className="space-y-1.5 flex flex-col">
                            <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">Storage Condition</label>
                            <input type="text" value={formData.pharmacyDetails.storageCondition} onChange={(e) => setFormData({ ...formData, pharmacyDetails: { ...formData.pharmacyDetails, storageCondition: e.target.value } })} className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-md text-sm font-bold outline-none ring-slate-100 ring-1 focus:ring-2 focus:ring-red-500/20" placeholder="e.g. Store below 25°C" disabled={isViewMode} />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {modalTab === "pricing" && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-right-2 duration-300">
                      <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-1.5 flex flex-col">
                          <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                            Price (₹)
                          </label>
                          <input
                            type="number"
                            value={formData.price}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                price: e.target.value,
                              })
                            }
                            className="w-full px-4 py-3 bg-white shadow-sm ring-1 ring-slate-200 border-none rounded-xl text-lg font-bold outline-none focus:ring-2 focus:ring-red-500/10"
                            disabled={isViewMode}
                          />
                        </div>
                        <div className="space-y-1.5 flex flex-col">
                          <label className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest ml-1">
                            Discounted Price (₹)
                          </label>
                          <input
                            type="number"
                            value={formData.salePrice}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                salePrice: e.target.value,
                              })
                            }
                            className="w-full px-4 py-3 bg-emerald-50/50 shadow-sm ring-1 ring-emerald-100 border-none rounded-xl text-lg font-bold text-emerald-700 outline-none focus:ring-2 focus:ring-emerald-200"
                            disabled={isViewMode}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-1.5 flex flex-col">
                          <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                            How many in stock
                          </label>
                          <input
                            type="number"
                            value={formData.variants?.length > 0 ? formData.variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0) : formData.stock}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                stock: e.target.value,
                              })
                            }
                            className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-xl text-sm font-bold outline-none ring-red-500/5 focus:ring-2 disabled:opacity-60"
                            disabled={isViewMode || formData.variants?.length > 0}
                          />
                        </div>
                        <div className="space-y-1.5 flex flex-col">
                          <label className="text-[9px] font-bold text-rose-500 uppercase tracking-widest ml-1">
                            Alert me when stock is below
                          </label>
                          <input
                            type="number"
                            value={formData.lowStockAlert}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                lowStockAlert: e.target.value,
                              })
                            }
                            className="w-full px-4 py-2.5 bg-rose-50/30 border-none rounded-xl text-sm font-bold text-rose-600 outline-none ring-rose-100 focus:ring-2"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                  {/* Additional tabs populated as needed */}
                  {modalTab === "category" && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-300">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-1.5 flex flex-col">
                          <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                            Main Group <span className="text-rose-500">*</span>
                          </label>
                          <select
                            value={formData.header}
                            onChange={(e) =>
                              setFormData({ ...formData, header: e.target.value, category: "", subcategory: "" })
                            }
                            disabled={isViewMode}
                            className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-xl text-sm font-bold outline-none cursor-pointer disabled:opacity-50">
                            <option value="">Select Main Group</option>
                            {categories.map((h) => (
                              <option key={h._id || h.id} value={h._id || h.id}>
                                {h.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1.5 flex flex-col">
                          <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                            Specific Category <span className="text-rose-500">*</span>
                          </label>
                          <select
                            value={formData.category}
                            onChange={(e) =>
                              setFormData({ ...formData, category: e.target.value, subcategory: "" })
                            }
                            disabled={isViewMode || !formData.header}
                            className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-xl text-sm font-bold outline-none cursor-pointer disabled:opacity-50">
                            <option value="">Select Category</option>
                            {categories
                              .find((h) => (h._id || h.id) === formData.header)
                              ?.children?.map((c) => (
                                <option key={c._id || c.id} value={c._id || c.id}>
                                  {c.name}
                                </option>
                              ))}
                          </select>
                        </div>
                      </div>
                      <div className="space-y-1.5 flex flex-col">
                        <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                          Sub-Category <span className="text-rose-500">*</span>
                        </label>
                        <select
                          value={formData.subcategory}
                          onChange={(e) =>
                            setFormData({ ...formData, subcategory: e.target.value })
                          }
                          disabled={isViewMode || !formData.category}
                          className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-xl text-sm font-bold outline-none cursor-pointer disabled:opacity-50">
                          <option value="">Select Sub-Category</option>
                          {categories
                            .find((h) => (h._id || h.id) === formData.header)
                            ?.children?.find((c) => (c._id || c.id) === formData.category)
                            ?.children?.map((sc) => (
                              <option key={sc._id || sc.id} value={sc._id || sc.id}>
                                {sc.name}
                              </option>
                            ))}
                        </select>
                      </div>
                    </div>
                  )}

                  {modalTab === "media" && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-right-2 duration-300">
                      <div className="space-y-3">
                        <label className="text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                          Main Cover Photo
                        </label>
                        <div className="flex flex-col md:flex-row items-start gap-6">
                          <div className="w-48 aspect-square rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center group hover:border-red-500 hover:bg-red-500/5 transition-all overflow-hidden relative">
                            {!isViewMode && (
                              <input
                                type="file"
                                className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                onChange={(e) => handleImageUpload(e, "main")}
                              />
                            )}
                            {formData.mainImage ? (
                              <img src={formData.mainImage} alt="Main Preview" className="w-full h-full object-cover" />
                            ) : (
                              <div className="flex flex-col items-center">
                                <HiOutlinePhoto className="h-10 w-10 text-slate-200" />
                                {!isViewMode && <p className="text-[10px] text-slate-600 font-bold mt-2">UPLOAD</p>}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <label className="text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                          Gallery Images
                        </label>
                        <div className="flex flex-wrap items-start gap-4">
                          {formData.galleryImages?.map((img, idx) => (
                            <div key={idx} className="w-32 aspect-square rounded-2xl border-2 border-slate-200 bg-slate-50 relative overflow-hidden group">
                              <img src={img} alt={`Gallery ${idx + 1}`} className="w-full h-full object-cover" />
                              {!isViewMode && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const newGallery = formData.galleryImages.filter((_, i) => i !== idx);
                                    const newFiles = formData.galleryFiles?.filter((_, i) => i !== idx);
                                    setFormData({ ...formData, galleryImages: newGallery, galleryFiles: newFiles });
                                  }}
                                  className="absolute top-2 right-2 p-1.5 bg-white/90 text-red-500 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50"
                                >
                                  <HiOutlineTrash className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          ))}
                          
                          {!isViewMode && (
                            <div className="w-32 aspect-square rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center group hover:border-red-500 hover:bg-red-500/5 transition-all cursor-pointer relative">
                              <input
                                type="file"
                                multiple
                                className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                onChange={(e) => handleImageUpload(e, "gallery")}
                              />
                              <HiOutlinePhoto className="h-8 w-8 text-slate-200" />
                              <p className="text-[10px] text-slate-600 font-bold mt-2">ADD MORE</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {modalTab === "variants" && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-300">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-bold">Product Variants</h4>
                        {sellerBusinessType !== "pharmacy" && !isViewMode && (
                          <button
                            type="button"
                            onClick={() => setFormData({ ...formData, variants: [...formData.variants, { id: Date.now(), name: "", price: "", salePrice: "", stock: "", sku: "" }] })}
                            className="bg-red-500/10 text-red-500 px-3 py-1 rounded-lg text-[10px] font-bold">+ ADD</button>
                        )}
                      </div>

                      {sellerBusinessType === "pharmacy" && !isViewMode && (
                        <div className="p-4 bg-white rounded-2xl ring-1 ring-slate-100">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-xs font-black text-slate-800 uppercase tracking-widest">
                                Variant Builder (Pharmacy)
                              </p>
                              <p className="text-[11px] text-slate-500 font-semibold">
                                Generates consistent names like <span className="font-mono">500mg - 10 Tablets</span>
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const strength = pharmacyVariantDraft.strength || formData?.pharmacyDetails?.strength || "";
                                const packType = pharmacyVariantDraft.packType || formData?.pharmacyDetails?.packType || "strip";
                                const packQuantity = pharmacyVariantDraft.packQuantity ?? formData?.pharmacyDetails?.packQuantity ?? 0;
                                const unit = pharmacyVariantDraft.unit || formData?.pharmacyDetails?.unit || "tablet";
                                const name = buildPharmacyVariantName({ strength, packType, packQuantity, unit });

                                if (!name) {
                                  toast.error("Please fill Strength and Pack Quantity to generate a variant name");
                                  return;
                                }

                                setPharmacyVariantsEnabled(true);
                                const baseVariants = variantsWithoutPharmacyPlaceholder(formData.variants);
                                setFormData({
                                  ...formData,
                                  variants: [
                                    ...baseVariants,
                                    { id: Date.now(), name, strength, packType, packQuantity, unit, price: formData.price || "", salePrice: formData.salePrice || "", stock: formData.stock || "", sku: "" },
                                  ],
                                });
                              }}
                              className="px-4 py-2 rounded-xl bg-red-600 text-white text-[10px] font-black tracking-widest shadow-lg hover:bg-red-700 transition-colors"
                            >
                              ADD GENERATED VARIANT
                            </button>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
                            <div className="space-y-1">
                              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                Strength
                              </label>
                              <input
                                type="text"
                                value={pharmacyVariantDraft.strength}
                                onChange={(e) => setPharmacyVariantDraft({ ...pharmacyVariantDraft, strength: e.target.value })}
                                placeholder={formData?.pharmacyDetails?.strength ? `e.g. ${formData.pharmacyDetails.strength}` : "e.g. 500mg"}
                                className="w-full bg-slate-50 px-3 py-2 rounded-xl text-xs ring-1 ring-slate-200 outline-none"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                Pack Type
                              </label>
                              <select
                                value={pharmacyVariantDraft.packType}
                                onChange={(e) => setPharmacyVariantDraft({ ...pharmacyVariantDraft, packType: e.target.value })}
                                className="w-full bg-slate-50 px-3 py-2 rounded-xl text-xs ring-1 ring-slate-200 outline-none cursor-pointer"
                              >
                                {PHARMACY_PACK_TYPE_OPTIONS.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="space-y-1">
                              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                Pack Quantity
                              </label>
                              <input
                                type="number"
                                min="1"
                                value={pharmacyVariantDraft.packQuantity}
                                onChange={(e) => setPharmacyVariantDraft({ ...pharmacyVariantDraft, packQuantity: e.target.value })}
                                className="w-full bg-slate-50 px-3 py-2 rounded-xl text-xs ring-1 ring-slate-200 outline-none"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                Unit
                              </label>
                              <select
                                value={pharmacyVariantDraft.unit}
                                onChange={(e) => setPharmacyVariantDraft({ ...pharmacyVariantDraft, unit: e.target.value })}
                                className="w-full bg-slate-50 px-3 py-2 rounded-xl text-xs ring-1 ring-slate-200 outline-none cursor-pointer"
                              >
                                {PHARMACY_UNIT_OPTIONS.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <div className="mt-3 text-[11px] font-semibold text-slate-600">
                            Preview:&nbsp;
                            <span className="font-mono text-slate-900">
                              {buildPharmacyVariantName({
                                strength: pharmacyVariantDraft.strength || formData?.pharmacyDetails?.strength || "",
                                packType: pharmacyVariantDraft.packType || formData?.pharmacyDetails?.packType || "strip",
                                packQuantity: pharmacyVariantDraft.packQuantity ?? formData?.pharmacyDetails?.packQuantity ?? 0,
                                unit: pharmacyVariantDraft.unit || formData?.pharmacyDetails?.unit || "tablet",
                              }) || "—"}
                            </span>
                          </div>
                        </div>
                      )}

                      {sellerBusinessType === "pharmacy" && !pharmacyVariantsEnabled && (formData.variants || []).length <= 1 ? (
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                          <p className="text-xs font-bold text-slate-700">
                            Variants are optional for pharmacy products.
                          </p>
                          <p className="text-[11px] font-semibold text-slate-500 mt-1">
                            If this medicine has only one pack/strength, you can skip variants and just use the Pricing tab.
                            Use the Variant Builder above to add variants only when you sell multiple packs/strengths.
                          </p>
                          {!isViewMode && (
                            <button
                              type="button"
                              onClick={() => setPharmacyVariantsEnabled(true)}
                              className="mt-3 px-4 py-2 rounded-xl bg-white ring-1 ring-slate-200 text-slate-700 text-[10px] font-black tracking-widest hover:bg-slate-100"
                            >
                              ENABLE MANUAL VARIANT EDITING
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {formData.variants.map((v, i) => (
                          <div key={v.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
                            <div className="md:col-span-2 space-y-1">
                              <label className="text-[8px] font-bold text-slate-600 uppercase tracking-widest ml-1">Variant Name</label>
                              <input value={v.name} onChange={e => {
                                const news = [...formData.variants];
                                news[i].name = e.target.value;
                                setFormData({ ...formData, variants: news });
                              }} placeholder="e.g. 1kg" className="w-full bg-white px-3 py-2 rounded-xl text-xs ring-1 ring-slate-100 outline-none" disabled={isViewMode} />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[8px] font-bold text-slate-600 uppercase tracking-widest ml-1">Price</label>
                              <input type="number" value={v.price} onChange={e => {
                                const news = [...formData.variants];
                                news[i].price = e.target.value;
                                setFormData({ ...formData, variants: news });
                              }} placeholder="Price" className="w-full bg-white px-3 py-2 rounded-xl text-xs ring-1 ring-slate-100 outline-none" disabled={isViewMode} />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[8px] font-bold text-emerald-400 uppercase tracking-widest ml-1">Sale Price</label>
                              <input type="number" value={v.salePrice} onChange={e => {
                                const news = [...formData.variants];
                                news[i].salePrice = e.target.value;
                                setFormData({ ...formData, variants: news });
                              }} placeholder="Sale" className="w-full bg-emerald-50/50 px-3 py-2 rounded-xl text-xs ring-1 ring-emerald-100 text-emerald-700 outline-none" disabled={isViewMode} />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[8px] font-bold text-slate-600 uppercase tracking-widest ml-1">Stock</label>
                              <input type="number" value={v.stock} onChange={e => {
                                const news = [...formData.variants];
                                news[i].stock = e.target.value;
                                setFormData({ ...formData, variants: news });
                              }} placeholder="Stock" className="w-full bg-white px-3 py-2 rounded-xl text-xs ring-1 ring-slate-100 outline-none" disabled={isViewMode} />
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 space-y-1">
                                <label className="text-[8px] font-bold text-slate-600 uppercase tracking-widest ml-1">SKU</label>
                                <input value={v.sku} onChange={e => {
                                  const news = [...formData.variants];
                                  news[i].sku = e.target.value;
                                  setFormData({ ...formData, variants: news });
                                }} placeholder="SKU" className="w-full bg-white px-3 py-2 rounded-xl text-[10px] ring-1 ring-slate-100 outline-none" disabled={isViewMode} />
                              </div>
                              {!isViewMode && (
                                <button type="button" onClick={() => setFormData({ ...formData, variants: formData.variants.filter((_, idx) => idx !== i) })} className="text-rose-500 p-2 hover:bg-rose-50 rounded-lg shrink-0 mb-0.5">
                                  <HiOutlineTrash className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-3">
                <button
                  onClick={() => setIsProductModalOpen(false)}
                  className="px-6 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100">
                  CLOSE
                </button>
                {!isViewMode && (
                  <button
                    onClick={handleSave}
                    className="bg-red-500 text-white px-10 py-2.5 rounded-xl text-xs font-bold shadow-xl hover:bg-red-600 hover:-translate-y-0.5 transition-all">
                    SAVE CHANGES
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Confirm Deletion"
        size="sm"
        footer={
          <div className="flex gap-4 justify-end w-full">
            <button
              onClick={() => setIsDeleteModalOpen(false)}
              className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-700 transition-colors">
              Cancel
            </button>
            <button
              onClick={confirmDelete}
              className="px-6 py-2.5 bg-rose-600 text-white rounded-xl text-sm font-semibold shadow-lg shadow-rose-100 hover:bg-rose-700 transition-all active:scale-95">
              Delete product
            </button>
          </div>
        }>
        <div className="px-6 py-6 flex flex-col items-center text-center space-y-5">
          <div className="h-18 w-18 md:h-20 md:w-20 bg-rose-50 rounded-full flex items-center justify-center text-rose-500">
            <HiOutlineTrash className="h-9 w-9 md:h-10 md:w-10" />
          </div>
          <div className="space-y-2 max-w-md">
            <h4 className="text-lg font-semibold text-slate-900">
              Are you absolutely sure?
            </h4>
            <p className="text-sm text-slate-600 leading-relaxed">
              This action cannot be undone. This will permanently remove{" "}
              <span className="font-semibold text-slate-900">
                {itemToDelete?.name}
              </span>{" "}
              from the catalog.
            </p>
          </div>
        </div>
      </Modal>

      {/* Viewing Variants Modal */}
      <Modal
        isOpen={isVariantsViewModalOpen}
        onClose={() => setIsVariantsViewModalOpen(false)}
        title="Product Variants Details"
        size="lg"
      >
        <div className="py-2">
          <div className="flex items-center gap-4 mb-6 p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <div className="h-16 w-16 bg-white rounded-xl shadow-sm overflow-hidden flex items-center justify-center border border-slate-100">
              {viewingVariants?.mainImage || viewingVariants?.galleryImages?.[0] || viewingVariants?.image ? (
                <img src={viewingVariants.mainImage || viewingVariants.galleryImages?.[0] || viewingVariants.image} alt="" className="h-full w-full object-cover" />
              ) : (
                <HiOutlineCube className="h-8 w-8 text-slate-200" />
              )}
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 leading-tight">{viewingVariants?.name}</h3>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="primary" className="text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5">{viewingVariants?.categoryId?.name || 'Category'}</Badge>
                <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">Master SKU: {viewingVariants?.sku || viewingVariants?._id?.slice(-6).toUpperCase() || 'N/A'}</span>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-100 shadow-sm bg-white">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-6 py-4 text-[10px] font-black text-slate-600 uppercase tracking-widest">Variant Specification</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-600 uppercase tracking-widest text-center">Unit Price</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-600 uppercase tracking-widest text-center">Available Stock</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-600 uppercase tracking-widest text-right">Variant SKU</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {viewingVariants?.variants?.map((v, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/30 transition-all cursor-default">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-xs font-black text-slate-700 group-hover:text-red-500 transition-colors">{v.name}</span>
                        <span className="text-[9px] text-slate-600 font-bold uppercase tracking-widest mt-0.5">Variation {idx + 1}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex flex-col items-center">
                        <span className={cn("text-xs font-bold", v.salePrice > 0 ? "text-slate-600 line-through scale-90" : "text-slate-900")}>₹{v.price}</span>
                        {v.salePrice > 0 && <span className="text-xs font-bold text-emerald-600">₹{v.salePrice}</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Badge variant={v.stock === 0 ? "rose" : v.stock <= 10 ? "amber" : "emerald"} className="text-[10px] font-black uppercase tracking-widest px-2 shadow-sm">
                        {v.stock === 0 ? 'OUT OF STOCK' : `${v.stock} UNITS`}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-[10px] font-bold text-slate-600 font-mono tracking-tighter uppercase bg-slate-100 px-2 py-1 rounded-lg">
                        {v.sku || 'N/A'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-8 flex justify-end">
            <button
              onClick={() => setIsVariantsViewModalOpen(false)}
              className="bg-red-500 text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-red-600 hover:-translate-y-0.5 transition-all active:scale-95"
            >
              CLOSE VIEWER
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Product IDs Catalog Drawer ───────────────────────────────────── */}
      <AnimatePresence>
        {isCatalogOpen && (
          <motion.div
            key="catalog-overlay"
            className="fixed inset-0 z-[9998] bg-black/40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsCatalogOpen(false)}
          />
        )}
        {isCatalogOpen && (
          <motion.div
            key="catalog-drawer"
            className="fixed right-0 top-0 h-full z-[9999] w-full max-w-2xl bg-white shadow-2xl flex flex-col"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 220 }}
          >
            {/* Drawer Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-red-600 to-red-700 text-white">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <HiOutlineQrCode className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold">
                    {isPharmacySeller ? "Pharmacy Product ID Browser" : "Product ID Browser"}
                  </h2>
                  <p className="text-xs text-red-200 font-medium">
                    {isPharmacySeller
                      ? `${catalogTotal} pharmacy products in catalog`
                      : `${catalogTotal} products in catalog`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCatalogOpen(false)}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              >
                <HiOutlineXMark className="h-5 w-5" />
              </button>
            </div>

            {/* Info Banner */}
            <div className="flex items-start gap-2 px-6 py-3 bg-red-50 border-b border-red-100">
              <HiOutlineInformationCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
              <p className="text-[11px] font-medium text-red-700 leading-relaxed">
                {isPharmacySeller ? (
                  <>
                    Browse <strong>pharmacy-only</strong> products from the shared catalog. Grocery and other Quick Commerce items are hidden. Click <strong>View</strong> to copy a Product ID for your medicine form.
                  </>
                ) : (
                  <>
                    Browse products from the shared catalog. Click <strong>View</strong> to see details and copy the Product ID to auto-fill your new product form.
                  </>
                )}
              </p>
            </div>

            {/* Search Bar */}
            <div className="px-6 py-3 border-b border-slate-100 flex gap-2">
              <div className="relative flex-1">
                <HiOutlineMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  ref={catalogSearchRef}
                  value={catalogSearchInput}
                  onChange={e => setCatalogSearchInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCatalogSearch()}
                  placeholder={isPharmacySeller ? "Search by name, SKU, generic name…" : "Search by name, SKU, or brand…"}
                  className="w-full pl-9 pr-4 py-2 bg-slate-100 rounded-lg text-sm font-medium outline-none focus:ring-2 focus:ring-red-300 transition-all"
                />
              </div>
              <button
                onClick={handleCatalogSearch}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 transition-colors"
              >
                Search
              </button>
            </div>

            {/* Product List */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
              {catalogLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <div className="h-8 w-8 rounded-full border-2 border-red-600 border-t-transparent animate-spin" />
                  <p className="text-xs font-semibold text-slate-500">Loading products…</p>
                </div>
              ) : catalogProducts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <HiOutlineFolderOpen className="h-10 w-10 text-slate-300" />
                  <p className="text-sm font-bold text-slate-600">
                    {isPharmacySeller ? "No pharmacy products found" : "No products found"}
                  </p>
                  <p className="text-xs text-slate-400">Try a different search term</p>
                </div>
              ) : (
                catalogProducts.map((product) => (
                  <div key={product._id || product.id} className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50 transition-colors">
                    <div className="h-14 w-14 rounded-xl overflow-hidden bg-slate-100 ring-1 ring-slate-200 shrink-0">
                      <img
                        src={product.mainImage || "https://images.unsplash.com/photo-1550989460-0adf9ea622e2"}
                        alt={product.name}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">{product.name}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {isPharmacySeller && product.pharmacyDetails?.genericName && (
                          <span className="text-xs text-slate-500">{product.pharmacyDetails.genericName}</span>
                        )}
                        {!isPharmacySeller && product.brand && <span className="text-xs text-slate-500">{product.brand}</span>}
                        <span className="text-xs font-bold text-slate-900">₹{product.salePrice || product.price}</span>
                        <span className="text-[10px] font-mono font-bold bg-red-50 text-red-600 px-1.5 py-0.5 rounded">
                          {product.sku || '—'}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => setViewingCatalogProduct(product)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 hover:border-red-300 hover:text-red-700 hover:bg-red-50 transition-all shadow-sm"
                    >
                      <HiOutlineEye className="h-3.5 w-3.5" />
                      View
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Pagination Footer */}
            {catalogTotal > 20 && !catalogLoading && (
              <div className="flex items-center justify-between px-6 py-3 border-t border-slate-100 bg-slate-50">
                <p className="text-xs font-medium text-slate-500">Page {catalogPage} of {Math.ceil(catalogTotal / 20)}</p>
                <div className="flex gap-2">
                  <button
                    disabled={catalogPage === 1}
                    onClick={() => setCatalogPage(p => Math.max(1, p - 1))}
                    className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  >
                    <HiOutlineChevronLeft className="h-4 w-4 text-slate-600" />
                  </button>
                  <button
                    disabled={catalogPage >= Math.ceil(catalogTotal / 20)}
                    onClick={() => setCatalogPage(p => p + 1)}
                    className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  >
                    <HiOutlineChevronRight className="h-4 w-4 text-slate-600" />
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Catalog Product Detail Modal ──────────────────────────────────── */}
      <AnimatePresence>
        {viewingCatalogProduct && (
          <motion.div
            className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setViewingCatalogProduct(null)} />
            <motion.div
              className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
              initial={{ scale: 0.92, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.92, y: 20 }}
              transition={{ type: "spring", damping: 24, stiffness: 200 }}
            >
              {/* Modal Header */}
              <div className="sticky top-0 bg-white/95 backdrop-blur z-10 flex items-center justify-between px-6 py-4 border-b border-slate-100 rounded-t-3xl">
                <h3 className="text-sm font-bold text-slate-900">Product Details</h3>
                <button
                  onClick={() => setViewingCatalogProduct(null)}
                  className="p-1.5 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <HiOutlineXMark className="h-5 w-5 text-slate-600" />
                </button>
              </div>

              <div className="p-6 space-y-5">
                {/* Product ID chip — prominent, copyable */}
                <div className="flex items-center justify-between bg-red-50 border border-red-100 rounded-2xl px-4 py-3">
                  <div>
                    <p className="text-[9px] font-bold text-red-400 uppercase tracking-widest mb-0.5">Product ID</p>
                    <p className="text-base font-black text-red-700 font-mono tracking-wide">
                      {viewingCatalogProduct.sku || '—'}
                    </p>
                  </div>
                  <button
                    onClick={() => handleCopySku(viewingCatalogProduct.sku)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-700 active:scale-95 transition-all shadow-sm"
                  >
                    {copiedSku ? (
                      <><HiOutlineClipboardDocumentCheck className="h-4 w-4" /><span>Copied!</span></>
                    ) : (
                      <><HiOutlineClipboardDocument className="h-4 w-4" /><span>Copy ID</span></>
                    )}
                  </button>
                </div>

                {/* Product Image */}
                {viewingCatalogProduct.mainImage && (
                  <div className="rounded-2xl overflow-hidden bg-slate-100 aspect-video">
                    <img
                      src={viewingCatalogProduct.mainImage}
                      alt={viewingCatalogProduct.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                {/* Name */}
                <div>
                  <h4 className="text-lg font-black text-slate-900">{viewingCatalogProduct.name}</h4>
                  {viewingCatalogProduct.brand && (
                    <p className="text-xs font-semibold text-slate-500 mt-0.5">by {viewingCatalogProduct.brand}</p>
                  )}
                </div>

                {/* Pricing */}
                <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl">
                  <div>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Price</p>
                    <p className="text-lg font-black text-slate-900">₹{viewingCatalogProduct.price}</p>
                  </div>
                  {viewingCatalogProduct.salePrice > 0 && (
                    <div>
                      <p className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest">Sale Price</p>
                      <p className="text-lg font-black text-emerald-600">₹{viewingCatalogProduct.salePrice}</p>
                    </div>
                  )}
                  {viewingCatalogProduct.weight && (
                    <div>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Weight</p>
                      <p className="text-sm font-bold text-slate-700">{viewingCatalogProduct.weight}</p>
                    </div>
                  )}
                </div>

                {/* Category */}
                {(viewingCatalogProduct.headerId?.name || viewingCatalogProduct.categoryId?.name) && (
                  <div className="flex flex-wrap gap-2">
                    {viewingCatalogProduct.headerId?.name && (
                      <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full">
                        {viewingCatalogProduct.headerId.name}
                      </span>
                    )}
                    {viewingCatalogProduct.categoryId?.name && (
                      <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2.5 py-1 rounded-full">
                        {viewingCatalogProduct.categoryId.name}
                      </span>
                    )}
                    {viewingCatalogProduct.subcategoryId?.name && (
                      <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-2.5 py-1 rounded-full">
                        {viewingCatalogProduct.subcategoryId.name}
                      </span>
                    )}
                  </div>
                )}

                {/* Description */}
                {viewingCatalogProduct.description && (
                  <p className="text-xs text-slate-600 font-medium leading-relaxed">
                    {viewingCatalogProduct.description}
                  </p>
                )}

                {/* Tags */}
                {Array.isArray(viewingCatalogProduct.tags) && viewingCatalogProduct.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {viewingCatalogProduct.tags.map((tag, i) => (
                      <span key={i} className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">#{tag}</span>
                    ))}
                  </div>
                )}

                {/* Variants */}
                {Array.isArray(viewingCatalogProduct.variants) && viewingCatalogProduct.variants.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Variants ({viewingCatalogProduct.variants.length})</p>
                    <div className="space-y-2">
                      {viewingCatalogProduct.variants.map((v, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                          <span className="text-xs font-bold text-slate-700">{v.name}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-bold text-slate-900">₹{v.price}</span>
                            {v.salePrice > 0 && <span className="text-xs font-bold text-emerald-600">₹{v.salePrice}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Gallery */}
                {Array.isArray(viewingCatalogProduct.galleryImages) && viewingCatalogProduct.galleryImages.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Gallery</p>
                    <div className="grid grid-cols-3 gap-2">
                      {viewingCatalogProduct.galleryImages.map((img, i) => (
                        <div key={i} className="aspect-square rounded-xl overflow-hidden bg-slate-100">
                          <img src={img} alt={`Gallery ${i+1}`} className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* CTA */}
                <div className="pt-2 border-t border-slate-100">
                  <p className="text-[10px] text-slate-400 text-center font-medium">
                    Copy the Product ID above and paste it in the <strong>Add New Product</strong> form to auto-fill all details.
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div >
  );
};

export default ProductManagement;
