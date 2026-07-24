import React, { useState, useMemo } from "react";
import Button from "@shared/components/ui/Button";
import Badge from "@shared/components/ui/Badge";
import {
  HiOutlineArrowLeft,
  HiOutlineCube,
  HiOutlineTag,
  HiOutlineCurrencyDollar,
  HiOutlineSwatch,
  HiOutlineFolderOpen,
  HiOutlinePhoto,
  HiOutlineScale,
  HiOutlineArrowPath,
  HiOutlineTrash,
  HiOutlinePlus,
  HiOutlineSquaresPlus,
  HiOutlineCurrencyRupee,
  HiOutlineQrCode,
  HiOutlineCheckCircle,
} from "react-icons/hi2";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import toast2 from "react-hot-toast";
import { sellerApi } from "../services/sellerApi";
import { useAuthStore } from "@/core/auth/auth.store";


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

  // Volume/weight formats: "100ml Bottle", "30gm Tube"
  if (!s && hasQty && (uKey === "ml" || uKey === "gm") && packLabel) {
    return `${q}${uKey} ${packLabel}`;
  }

  // Pack formats without strength: "Strip of 15 Tablets", "Pack of 10 Vials"
  if (!s && hasQty && packLabel) {
    if (pTypeKey === "strip") return `${packLabel} of ${qtyPart}`;
    if (pTypeKey === "box") return `Pack of ${qtyPart}`;
    if (pTypeKey === "bottle" || pTypeKey === "tube" || pTypeKey === "vial") return `${qtyPart} ${packLabel}`;
    return `${packLabel} of ${qtyPart}`;
  }

  // Strength + pack formats: "650mg - Strip of 15 Tablets", "650mg - Box of 10 Strips"
  if (s && hasQty && packLabel) {
    return `${s} - ${packLabel} of ${qtyPart}`;
  }

  // Fallbacks
  if (s && qtyPart) return `${s} - ${qtyPart}`;
  if (s) return s;
  return qtyPart || "";
};

const AddProduct = () => {
  const navigate = useNavigate();
  const user = useAuthStore(state => state.user);
  const sellerBusinessType = normalizeType(user?.shopInfo?.businessType);
  const [modalTab, setModalTab] = useState("general");
  const [isSaving, setIsSaving] = useState(false);
  const mainImageInputRef = React.useRef(null);
  const [pharmacyVariantDraft, setPharmacyVariantDraft] = useState(() => ({
    strength: "",
    packType: "strip",
    packQuantity: 10,
    unit: "tablet",
  }));
  const [pharmacyVariantsEnabled, setPharmacyVariantsEnabled] = useState(false);

  // ── Product ID auto-fill state ───────────────────────────────────────
  const [productIdInput, setProductIdInput] = useState("");
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [autoFilled, setAutoFilled] = useState(false);

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

  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    sku: "",
    description: "",
    price: "",
    salePrice: "",
    packingFee: "",
    stock: "",
    lowStockAlert: 5,
    category: "",
    subcategory: "",
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
      // Legacy/free-text fallback kept for backwards compatibility.
      packSize: "",
    },
    variants: [],
  });

  // ── Handle Product ID lookup & auto-fill ──────────────────────────────
  const handleProductIdLookup = async () => {
    const sku = productIdInput.trim();
    if (!sku) return;
    setIsLookingUp(true);
    try {
      const res = await sellerApi.lookupProductBySku(sku);
      if (res.data.success) {
        const p = res.data.result || {};
        setFormData(prev => ({
          ...prev,
          name: p.name || prev.name,
          description: p.description || prev.description,
          brand: p.brand || prev.brand,
          weight: p.weight || prev.weight,
          tags: Array.isArray(p.tags) ? p.tags.join(', ') : (p.tags || prev.tags),
          price: p.price || prev.price,
          salePrice: p.salePrice || prev.salePrice,
          stock: p.stock || prev.stock,
          lowStockAlert: p.lowStockAlert || prev.lowStockAlert,
          // Category IDs from populated objects
          header: p.headerId?._id || p.headerId || prev.header,
          category: p.categoryId?._id || p.categoryId || prev.category,
          subcategory: p.subcategoryId?._id || p.subcategoryId || prev.subcategory,
          // Images — pre-populate URL strings (seller can re-upload if needed)
          mainImage: p.mainImage || prev.mainImage,
          galleryImages: Array.isArray(p.galleryImages) && p.galleryImages.length > 0
            ? p.galleryImages
            : prev.galleryImages,
          // Variants
          variants: Array.isArray(p.variants) && p.variants.length > 0
            ? p.variants.map((v, i) => ({ ...v, id: v._id || Date.now() + i }))
            : prev.variants,
        }));
        setAutoFilled(true);
        toast2.success('Product data loaded! Review and save as your own.');
      }
    } catch (err) {
      const status = err?.response?.status;
      if (status === 404) {
        toast2.error('Product ID not found. Check the ID and try again.');
      } else if (status === 403) {
        toast2.error('This Product ID belongs to your own store.');
      } else {
        toast2.error('Could not fetch product. Please try again.');
      }
    } finally {
      setIsLookingUp(false);
    }
  };

  const [dbCategories, setDbCategories] = useState([]);
  const [isLoadingCats, setIsLoadingCats] = useState(true);

  React.useEffect(() => {
    const fetchCats = async () => {
      try {
        const res = await sellerApi.getCategoryTree();
        if (res.data.success) {
          setDbCategories(res.data.results || res.data.result || []);
        }
      } catch (error) {
        toast.error("Failed to load categories");
      } finally {
        setIsLoadingCats(false);
      }
    };
    fetchCats();
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

  // Remove placeholder dropdown options UX by auto-selecting the first valid
  // Main Group -> Category -> Sub-Category once categories are loaded.
  React.useEffect(() => {
    if (isLoadingCats) return;
    if (!Array.isArray(categories) || categories.length === 0) return;

    const getId = (x) => x?._id || x?.id || "";

    setFormData((prev) => {
      const currentHeaderId = prev.header;
      const headerObj =
        categories.find((h) => getId(h) === currentHeaderId) || categories[0];

      const nextHeaderId = getId(headerObj);
      const children = headerObj?.children || [];

      const currentCategoryId = prev.category;
      const categoryObj =
        children.find((c) => getId(c) === currentCategoryId) || children[0];

      const nextCategoryId = getId(categoryObj);
      const subList = categoryObj?.children || [];

      const currentSubId = prev.subcategory;
      const subObj =
        subList.find((sc) => getId(sc) === currentSubId) || subList[0];

      const nextSubId = getId(subObj);

      const shouldUpdateHeader = !currentHeaderId || getId(headerObj) !== currentHeaderId;
      const shouldUpdateCategory = !currentCategoryId || getId(categoryObj) !== currentCategoryId;
      const shouldUpdateSub = !currentSubId || getId(subObj) !== currentSubId;

      if (!shouldUpdateHeader && !shouldUpdateCategory && !shouldUpdateSub) return prev;

      return {
        ...prev,
        header: shouldUpdateHeader ? nextHeaderId : prev.header,
        category: shouldUpdateCategory ? nextCategoryId : prev.category,
        subcategory: shouldUpdateSub ? nextSubId : prev.subcategory,
      };
    });
  }, [categories, isLoadingCats]);

  const handleSave = async () => {
    // Validate required fields
    if (!formData.name) {
      toast.error("Please fill in the Product Title");
      return;
    }

    // Validate all three category levels are selected
    if (!formData.header || !formData.category || !formData.subcategory) {
      toast.error("Please select all three category levels: Main Group, Specific Category, and Sub-Category");
      return;
    }

    if (sellerBusinessType === "pharmacy") {
      const pd = formData.pharmacyDetails || {};
      if (!pd.genericName || !pd.manufacturer) {
        toast.error("Please fill Generic Name and Manufacturer in Medicine Details");
        return;
      }
      if (!pd.dosageForm || !pd.packType || !pd.unit || !pd.packQuantity || Number(pd.packQuantity) < 1) {
        toast.error("Please fill Dosage Form, Pack Type, Pack Quantity and Unit in Medicine Details");
        return;
      }

      // Pharmacy numeric/format validation
      if (pd.hsnCode) {
        const digitsOnly = sanitizeDigits(pd.hsnCode);
        if (digitsOnly !== String(pd.hsnCode)) {
          toast.error("HSN Code must contain digits only");
          return;
        }
        // Common HSN length is 4/6/8 digits. Keep it flexible but block too-short values.
        if (digitsOnly.length < 4 || digitsOnly.length > 8) {
          toast.error("HSN Code must be 4 to 8 digits");
          return;
        }
      }

      if (pd.drugLicenseNumber) {
        const normalized = sanitizeLicense(pd.drugLicenseNumber);
        if (normalized !== String(pd.drugLicenseNumber).toUpperCase().replace(/\s+/g, "")) {
          toast.error("Drug License Number format is invalid");
          return;
        }
      }

      if (pd.batchNumber) {
        const normalized = sanitizeBatch(pd.batchNumber);
        if (normalized !== String(pd.batchNumber).toUpperCase().replace(/\s+/g, "")) {
          toast.error("Batch Number format is invalid");
          return;
        }
      }
    }

    const firstVariant = formData.variants[0] || {};
    const effectivePrice = firstVariant.price || formData.price;
    const effectiveStock = firstVariant.stock || formData.stock;

    if (!effectivePrice || !effectiveStock) {
      toast.error("Please fill in Price and Stock in the Pricing & Stock tab");
      return;
    }

    if (formData.salePrice && Number(formData.salePrice) < 1) {
      toast.error("Discounted price must be at least 1");
      return;
    }

    if (formData.stock && Number(formData.stock) < 1) {
      toast.error("Stock must be at least 1");
      return;
    }

    if (formData.variants.some((v) => v.salePrice && Number(v.salePrice) < 1)) {
      toast.error("Sale price must be at least 1");
      return;
    }

    if (formData.variants.some((v) => v.stock && Number(v.stock) < 1)) {
      toast.error("Stock must be at least 1");
      return;
    }

    setIsSaving(true);
    try {
      const data = new FormData();

      // Basic fields
      data.append("name", formData.name);
      data.append("slug", formData.slug);
      data.append("sku", formData.sku);
      data.append("description", formData.description);
      data.append("brand", formData.brand);
      data.append("weight", formData.weight);
      data.append("status", formData.status);

      // Map top-level price/stock — prefer pricing tab values, fallback to first variant
      data.append("price", formData.price || firstVariant.price);
      data.append("salePrice", formData.salePrice || firstVariant.salePrice || 0);
      data.append("packingFee", formData.packingFee || 0);
      data.append("stock", formData.stock || firstVariant.stock);
      data.append("lowStockAlert", formData.lowStockAlert || 5);

      // Category IDs
      data.append("headerId", formData.header);
      data.append("categoryId", formData.category);
      data.append("subcategoryId", formData.subcategory);

      // Tags
      data.append("tags", formData.tags);

      // Pharmacy Details
      if (sellerBusinessType === "pharmacy") {
        data.append("pharmacyDetails", JSON.stringify(formData.pharmacyDetails));
      }

      // Images
      if (formData.mainImageFile) {
        data.append("mainImage", formData.mainImageFile);
      } else if (formData.mainImage) {
        data.append("mainImage", formData.mainImage);
      }

      if (formData.galleryFiles && formData.galleryFiles.length > 0) {
        formData.galleryFiles.forEach(file => {
          data.append("galleryImages", file);
        });
      } else if (formData.galleryImages && formData.galleryImages.length > 0) {
        data.append("galleryImages", JSON.stringify(formData.galleryImages));
      }

      // Variants
      data.append("variants", JSON.stringify(formData.variants));

      await sellerApi.createProduct(data);
      toast.success("Product saved successfully!");
      navigate("/seller/products");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to save product");
    } finally {
      setIsSaving(false);
    }
  };

  const handleImageUpload = (e, type) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        if (type === "main") {
          setFormData({
            ...formData,
            mainImage: reader.result,
            mainImageFile: file
          });
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

  const [addMethod, setAddMethod] = useState(null); // 'single', 'bulk', or null
  const [csvFile, setCsvFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [validationErrors, setValidationErrors] = useState([]);
  const [criticalError, setCriticalError] = useState(null);

  const downloadTemplate = () => {
    let headers = [
      "name", "description", "brand", "price", "salePrice", "stock", "lowStockAlert", 
      "header", "category", "subcategory", "mainImage", "galleryImages", "status",
      "variantName", "variantPrice", "variantSalePrice", "variantStock"
    ];
    let sampleRow = [
      "Organic Baby Puree",
      "Delicious organic baby puree mix",
      "NutriBaby",
      "110",
      "89",
      "120",
      "10",
      "Kids",
      "Kids Food",
      "Baby Food",
      "https://images.unsplash.com/photo-1596263576925-d90d63691097",
      "https://images.unsplash.com/photo-1596263576925-d90d63691097",
      "active",
      "200g Pack",
      "110",
      "89",
      "120"
    ];

    if (sellerBusinessType === "pharmacy") {
      headers = [
        ...headers,
        "genericName", "manufacturer", "composition", "strength", "dosageForm", "packType",
        "packQuantity", "unit", "storageCondition", "prescriptionRequired",
        "drugClassification", "drugLicenseNumber", "hsnCode", "batchNumber",
        "mfgDate", "expDate", "packSize"
      ];
      sampleRow = [
        "Paracetamol 500mg Strip",
        "Effective pain relief and fever reduction",
        "GSK Pharma",
        "15",
        "12",
        "200",
        "50",
        "Pharmacy",
        "Medicines",
        "Pain Relief",
        "https://images.unsplash.com/photo-1584308666744-24d5e4719bbd",
        "https://images.unsplash.com/photo-1584308666744-24d5e4719bbd",
        "active",
        "Strip of 10",
        "15",
        "12",
        "200",
        "Paracetamol", "GSK Pharma", "Paracetamol 500mg", "500mg", "tablet", "strip",
        "10", "tablet", "Store in a cool dry place", "No",
        "otc", "DL-123456", "300490", "B-9988",
        "2023-01", "2025-01", "10 tablets"
      ];
    }
    
    // Escaping commas by quoting values
    const escapedRow = sampleRow.map(val => `"${String(val).replace(/"/g, '""')}"`);
    const csvContent = [headers.join(","), escapedRow.join(",")].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "product_bulk_upload_template.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleBulkUpload = async (e) => {
    e.preventDefault();
    if (!csvFile) {
      toast.error("Please select a CSV file first");
      return;
    }

    setIsUploading(true);
    setValidationErrors([]);
    setCriticalError(null);

    try {
      const data = new FormData();
      data.append("csvFile", csvFile);

      const res = await sellerApi.bulkUploadProducts(data);
      if (res.data.success) {
        toast.success(res.data.message || "Products imported successfully!");
        navigate("/seller/products");
      }
    } catch (error) {
      const resData = error.response?.data;
      if (resData?.errors && Array.isArray(resData.errors)) {
        setValidationErrors(resData.errors);
        toast.error("CSV Validation Failed. Please review the errors.");
      } else {
        setCriticalError(resData?.message || "Failed to upload and import products due to an unexpected server error.");
        toast.error("Failed to upload and import products.");
      }
    } finally {
      setIsUploading(false);
    }
  };

  if (addMethod === null) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 pb-12 animate-in fade-in duration-300">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            className="pl-0 hover:bg-transparent hover:text-red-600"
            onClick={() => navigate(-1)}>
            <HiOutlineArrowLeft className="mr-2 h-5 w-5" />
            Back to Products
          </Button>
        </div>

        <div className="text-center space-y-2 py-6">
          <h2 className="text-2xl font-black text-slate-800">Add New Product</h2>
          <p className="text-sm text-slate-500 font-medium">
            Choose how you want to add products to your store.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card 1: Single Add */}
          <div
            onClick={() => setAddMethod("single")}
            className="bg-white p-8 rounded-3xl border border-slate-100 shadow-lg hover:shadow-xl hover:border-red-500/20 transition-all cursor-pointer group flex flex-col items-center text-center space-y-4"
          >
            <div className="p-4 bg-red-50 text-red-500 rounded-2xl group-hover:bg-red-500 group-hover:text-white transition-all">
              <HiOutlineCube className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">Single Product</h3>
            <p className="text-sm text-slate-500 font-medium leading-relaxed">
              Add a single product manually. Perfect for entering rich descriptions, uploading custom cover photos, and configuring specific item variants.
            </p>
            <span className="text-xs font-black text-red-500 group-hover:translate-x-1 transition-transform inline-flex items-center gap-1">
              PROCEED <HiOutlineArrowLeft className="h-4 w-4 rotate-180" />
            </span>
          </div>

          {/* Card 2: Bulk Upload */}
          <div
            onClick={() => setAddMethod("bulk")}
            className="bg-white p-8 rounded-3xl border border-slate-100 shadow-lg hover:shadow-xl hover:border-red-500/20 transition-all cursor-pointer group flex flex-col items-center text-center space-y-4"
          >
            <div className="p-4 bg-red-50 text-red-500 rounded-2xl group-hover:bg-red-500 group-hover:text-white transition-all">
              <HiOutlineSquaresPlus className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">Bulk CSV Upload</h3>
            <p className="text-sm text-slate-500 font-medium leading-relaxed">
              Upload a spreadsheet in CSV format. Ideal for importing dozens or hundreds of products at once with external image URLs.
            </p>
            <span className="text-xs font-black text-red-500 group-hover:translate-x-1 transition-transform inline-flex items-center gap-1">
              PROCEED <HiOutlineArrowLeft className="h-4 w-4 rotate-180" />
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (addMethod === "bulk") {
    return (
      <div className="max-w-4xl mx-auto space-y-6 pb-12 animate-in fade-in duration-300">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            className="pl-0 hover:bg-transparent hover:text-red-600"
            onClick={() => setAddMethod(null)}>
            <HiOutlineArrowLeft className="mr-2 h-5 w-5" />
            Change Method
          </Button>
        </div>

        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-8 space-y-6">
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-slate-900">Bulk Product Upload</h3>
            <p className="text-sm text-slate-500 font-medium">
              Upload a CSV file to add products in bulk.
            </p>
          </div>

          <form onSubmit={handleBulkUpload} className="space-y-6">
            {/* Warning Alert */}
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 space-y-3 animate-in slide-in-from-top duration-300">
              <h4 className="text-sm font-bold text-amber-800 flex items-center gap-2">
                ⚠️ Upload Recommendation & SKU Guidelines
              </h4>
              <p className="text-xs text-amber-700 font-semibold leading-relaxed">
                <strong>Limit Upload Count:</strong> We recommend uploading at most <strong>100 products</strong> in a single CSV file. Uploading extremely large batches at once may cause processing timeouts or database performance issues.
              </p>
              <div className="border-t border-amber-200/60 pt-3 space-y-2 text-xs text-amber-700 font-medium">
                <p className="leading-relaxed font-semibold text-amber-800 bg-amber-100/50 p-3 rounded-lg flex flex-col gap-1.5">
                  <span>💡 <strong>Automatic SKU Generation:</strong></span>
                  <span>Unique product and variant SKUs will be automatically generated by the server based on the product name and variant name (e.g. <code>SKU-RICE-DAAWAT-[RANDOM-ID]</code> and <code>SKU-RICE-DAAWAT-[RANDOM-ID]-1KG</code>).</span>
                  <span><strong>Do not</strong> include <code>sku</code> or <code>variantSku</code> columns in your CSV.</span>
                </p>
              </div>
            </div>

            {/* Drag & Drop selector */}
            <div className="border-2 border-dashed border-slate-200 bg-slate-50/50 rounded-2xl p-8 flex flex-col items-center justify-center text-center hover:border-red-500 hover:bg-red-500/5 transition-all relative">
              <input
                type="file"
                accept=".csv"
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    setCsvFile(e.target.files[0]);
                    setValidationErrors([]);
                  }
                }}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <HiOutlineSquaresPlus className="h-12 w-12 text-slate-300 mb-3" />
              {csvFile ? (
                <div className="space-y-1">
                  <p className="text-sm font-bold text-slate-800">{csvFile.name}</p>
                  <p className="text-xs text-slate-400 font-medium">
                    {(csvFile.size / 1024).toFixed(2)} KB
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="text-sm font-bold text-slate-700">
                    Click to browse or drag & drop CSV file
                  </p>
                  <p className="text-xs text-slate-400 font-medium">
                    Spreadsheet file (.csv) only
                  </p>
                </div>
              )}
            </div>

            {/* Template Download & Instructions */}
            <div className="bg-slate-50/80 rounded-2xl p-6 border border-slate-100 space-y-4">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                <div className="space-y-0.5">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    CSV Structure Template
                  </h4>
                  <p className="text-xs text-slate-500 font-medium">
                    Make sure your CSV contains all required headers and correct formatting.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={downloadTemplate}
                  className="flex items-center gap-1.5 px-4 py-2 bg-red-500 text-white rounded-lg text-xs font-bold hover:bg-red-600 transition-all shadow-sm shrink-0 self-start sm:self-center"
                >
                  Download CSV Template
                </button>
              </div>

              <div className="border-t border-slate-200/60 pt-4 space-y-2">
                <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Supported Fields & Formats:
                </p>
                <ul className="text-xs text-slate-500 font-medium space-y-1.5 list-disc list-inside">
                  <li><strong className="text-slate-700">General Info</strong>: <code>name</code> (required), <code>description</code>, <code>brand</code>.</li>
                  <li><strong className="text-slate-700">Pricing & Stock</strong>: <code>price</code> (required), <code>salePrice</code> (discounted price), <code>stock</code> (required), <code>lowStockAlert</code>.</li>
                  <li><strong className="text-slate-700">Groups / Categories</strong>: <code>header</code>, <code>category</code>, <code>subcategory</code> (look up by names) OR <code>headerId</code>, <code>categoryId</code>, <code>subcategoryId</code> (24-char IDs).</li>
                  <li><strong className="text-slate-700">Photos</strong>: <code>mainImage</code> (Cover photo URL starting with http/https), <code>galleryImages</code> (comma-separated URLs).</li>
                  <li><strong className="text-slate-700">Item Variants</strong>: <code>variantName</code> (defaults to Default/weight), <code>variantPrice</code>, <code>variantSalePrice</code>, <code>variantStock</code>. Multiple rows with same name automatically group into single product with variants.</li>
                </ul>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-100 pt-6">
              <Button
                variant="outline"
                type="button"
                onClick={() => setAddMethod(null)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!csvFile || isUploading}
                className="min-w-[150px]"
              >
                {isUploading ? "Importing..." : "Upload & Import"}
              </Button>
            </div>

            {/* Uploading loading overlay modal */}
            {isUploading && (
              <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
                <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center space-y-6 shadow-2xl border border-slate-100 scale-in duration-200">
                  <div className="flex justify-center">
                    <div className="relative flex items-center justify-center animate-bounce">
                      <div className="w-16 h-16 border-4 border-red-500/20 border-t-orange-500 rounded-full animate-spin"></div>
                      <HiOutlineArrowPath className="absolute h-6 w-6 text-red-500 animate-spin" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-lg font-black text-slate-800">Uploading & Processing</h3>
                    <p className="text-sm text-slate-500 font-medium leading-relaxed">
                      Please wait while we validate your CSV data, process categories, verify SKU integrity, and create your products in bulk.
                    </p>
                  </div>
                  <div className="bg-red-50/50 rounded-xl py-2 px-4 inline-flex items-center gap-2 text-xs font-bold text-red-600">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                    </span>
                    Do not close this page
                  </div>
                </div>
              </div>
            )}

            {/* Validation errors overlay modal */}
            {validationErrors.length > 0 && (
              <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
                <div className="bg-white rounded-3xl p-8 max-w-2xl w-full text-left space-y-6 shadow-2xl border border-slate-100 flex flex-col max-h-[85vh]">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4 shrink-0">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-rose-50 text-rose-500 rounded-2xl text-xl">
                        ⚠️
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-slate-800">CSV Validation Failed</h3>
                        <p className="text-xs text-slate-500 font-medium">
                          We found {validationErrors.length} errors in your CSV file.
                        </p>
                      </div>
                    </div>
                    <button 
                      type="button"
                      onClick={() => setValidationErrors([])}
                      className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-2.5 custom-scrollbar pr-2 py-1">
                    {validationErrors.map((err, idx) => (
                      <div key={idx} className="p-3.5 bg-rose-50/50 border border-rose-100/50 rounded-xl flex items-start gap-2.5">
                        <span className="text-rose-500 font-bold mt-0.5 text-xs shrink-0">•</span>
                        <p className="text-xs text-rose-800 font-bold leading-relaxed">{err}</p>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-end gap-3 border-t border-slate-100 pt-4 shrink-0">
                    <button
                      type="button"
                      onClick={() => setValidationErrors([])}
                      className="px-5 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-200 transition-all"
                    >
                      Go Back & Fix
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Critical server error overlay modal */}
            {criticalError && (
              <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
                <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center space-y-6 shadow-2xl border border-slate-100">
                  <div className="flex justify-center">
                    <div className="p-4 bg-rose-50 text-rose-500 rounded-full">
                      <span className="text-3xl">🚫</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-lg font-black text-slate-800">Import Failed</h3>
                    <p className="text-sm text-slate-500 font-medium leading-relaxed">
                      {criticalError}
                    </p>
                  </div>
                  <div className="flex justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => setCriticalError(null)}
                      className="px-6 py-2.5 bg-rose-500 text-white rounded-xl text-xs font-bold hover:bg-rose-600 transition-all shadow-md"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            )}
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <Button
          variant="ghost"
          className="pl-0 hover:bg-transparent hover:text-red-500-600"
          onClick={() => navigate(-1)}>
          <HiOutlineArrowLeft className="mr-2 h-5 w-5" />
          Back to Products
        </Button>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="min-w-[140px]">
            {isSaving ? (
              <>
                <HiOutlineArrowPath className="mr-2 h-5 w-5 animate-spin" />
                Publishing...
              </>
            ) : (
              "Save & Publish"
            )}
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-xl overflow-hidden flex flex-col md:flex-row min-h-[600px] border border-slate-100">
        {/* Sidebar Tabs */}
        <div className="md:w-64 bg-slate-50/50 border-r border-slate-100 p-4 space-y-1 overflow-y-auto">
          {[
            { id: "general", label: "General Info", icon: HiOutlineTag },
            ...(sellerBusinessType === "pharmacy" ? [{ id: "medicine", label: "Medicine Details", icon: HiOutlineTag }] : []),
            { id: "pricing", label: "Pricing & Stock", icon: HiOutlineCurrencyRupee },
            { id: "variants", label: "Item Variants", icon: HiOutlineSwatch },
            { id: "category", label: "Groups", icon: HiOutlineFolderOpen },
            { id: "media", label: "Photos", icon: HiOutlinePhoto },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setModalTab(tab.id)}
              className={cn(
                "w-full flex items-center space-x-3 px-4 py-3 rounded-md text-xs font-bold transition-all text-left",
                modalTab === tab.id
                  ? "bg-white text-red-500 shadow-sm ring-1 ring-slate-100"
                  : "text-slate-600 hover:bg-slate-100",
              )}>
              <tab.icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          ))}

          <div className="pt-8 px-4">
            <div className="p-4 bg-emerald-50 rounded-md border border-emerald-100">
              <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest mb-1">
                Status
              </p>
              <select
                value={formData.status}
                onChange={(e) =>
                  setFormData({ ...formData, status: e.target.value })
                }
                className="w-full bg-transparent border-none text-xs font-bold text-emerald-700 outline-none p-0 cursor-pointer focus:ring-0">
                <option value="active">PUBLISHED</option>
                <option value="inactive">DRAFT</option>
              </select>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 p-8 overflow-y-auto">
          {modalTab === "general" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-300">

              {/* ── Product ID Auto-Fill field ────────────────────────────── */}
              <div className={cn(
                "flex flex-col space-y-2 p-4 rounded-2xl border transition-all",
                autoFilled
                  ? "bg-red-50 border-red-200"
                  : "bg-slate-50 border-slate-100",
              )}>
                <label className="text-[10px] sm:text-xs font-bold text-red-600 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                  <HiOutlineQrCode className="h-3.5 w-3.5" />
                  Import from Product ID
                  <span className="text-[9px] font-medium text-slate-400 normal-case tracking-normal">(optional)</span>
                </label>
                <div className="flex gap-2">
                  <input
                    value={productIdInput}
                    onChange={e => { setProductIdInput(e.target.value); setAutoFilled(false); }}
                    onKeyDown={e => e.key === 'Enter' && handleProductIdLookup()}
                    placeholder="Paste Product ID (e.g. SKU-S17VXD)"
                    className="flex-1 px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm font-mono font-semibold outline-none focus:ring-2 focus:ring-red-300 transition-all placeholder:text-slate-400 placeholder:font-sans"
                  />
                  <button
                    type="button"
                    onClick={handleProductIdLookup}
                    disabled={!productIdInput.trim() || isLookingUp}
                    className="flex items-center gap-1.5 px-4 py-2.5 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm shrink-0"
                  >
                    {isLookingUp ? (
                      <HiOutlineArrowPath className="h-4 w-4 animate-spin" />
                    ) : autoFilled ? (
                      <HiOutlineCheckCircle className="h-4 w-4" />
                    ) : (
                      <HiOutlineQrCode className="h-4 w-4" />
                    )}
                    <span>{isLookingUp ? 'Loading…' : autoFilled ? 'Loaded' : 'Fetch'}</span>
                  </button>
                </div>
                {autoFilled && (
                  <p className="text-[10px] font-semibold text-red-600 ml-1 flex items-center gap-1">
                    <HiOutlineCheckCircle className="h-3 w-3" />
                    Product data auto-filled. Review and edit below, then save.
                  </p>
                )}
              </div>

              <div className="space-y-1.5 flex flex-col">
                <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                  Product Title
                </label>
                <input
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-md text-sm font-semibold outline-none ring-red-500/5 focus:ring-2 transition-all"
                  placeholder="e.g. Premium Basmati Rice"
                />
              </div>
              <div className="space-y-1.5 flex flex-col">
                <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                  About this item
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  onWheel={(e) => e.stopPropagation()}
                  onTouchMove={(e) => e.stopPropagation()}
                  className="w-full px-4 py-3 bg-slate-100 border-none rounded-2xl text-sm font-semibold min-h-[160px] max-h-[260px] outline-none transition-all focus:ring-2 focus:ring-red-500/5 resize-none overflow-y-auto custom-scrollbar"
                  placeholder="Describe the item here..."
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
                      setFormData({ ...formData, brand: e.target.value })
                    }
                    className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-md text-sm font-semibold outline-none ring-red-500/5 focus:ring-2 transition-all"
                    placeholder="e.g. Amul"
                  />
                </div>
                <div className="space-y-1.5 flex flex-col">
                  <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                    Product Code
                  </label>
                  <input
                    value={formData.sku}
                    readOnly
                    className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-md text-sm font-mono font-bold outline-none text-slate-400 cursor-not-allowed"
                    placeholder="AUTO-GENERATED"
                  />
                </div>
              </div>
            </div>
          )}

          {modalTab === "medicine" && sellerBusinessType === "pharmacy" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-300">
              <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 space-y-6">
                
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide border-b border-slate-200 pb-2">Medicine Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1.5 flex flex-col">
                    <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">Generic Name</label>
                    <input type="text" value={formData.pharmacyDetails.genericName} onChange={(e) => setFormData({ ...formData, pharmacyDetails: { ...formData.pharmacyDetails, genericName: e.target.value } })} className="w-full px-4 py-2.5 bg-white border-none rounded-md text-sm font-bold outline-none ring-slate-100 ring-1 focus:ring-2 focus:ring-red-500/20" placeholder="e.g. Paracetamol" />
                  </div>
                  <div className="space-y-1.5 flex flex-col">
                    <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">Manufacturer</label>
                    <input type="text" value={formData.pharmacyDetails.manufacturer} onChange={(e) => setFormData({ ...formData, pharmacyDetails: { ...formData.pharmacyDetails, manufacturer: e.target.value } })} className="w-full px-4 py-2.5 bg-white border-none rounded-md text-sm font-bold outline-none ring-slate-100 ring-1 focus:ring-2 focus:ring-red-500/20" placeholder="Manufacturer Name" />
                  </div>
                  <div className="space-y-1.5 flex flex-col">
                    <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">Composition</label>
                    <input type="text" value={formData.pharmacyDetails.composition} onChange={(e) => setFormData({ ...formData, pharmacyDetails: { ...formData.pharmacyDetails, composition: e.target.value } })} className="w-full px-4 py-2.5 bg-white border-none rounded-md text-sm font-bold outline-none ring-slate-100 ring-1 focus:ring-2 focus:ring-red-500/20" placeholder="Active ingredients" />
                  </div>
                  <div className="space-y-1.5 flex flex-col">
                    <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">Strength</label>
                    <input type="text" value={formData.pharmacyDetails.strength} onChange={(e) => setFormData({ ...formData, pharmacyDetails: { ...formData.pharmacyDetails, strength: e.target.value } })} className="w-full px-4 py-2.5 bg-white border-none rounded-md text-sm font-bold outline-none ring-slate-100 ring-1 focus:ring-2 focus:ring-red-500/20" placeholder="e.g. 500mg" />
                  </div>
                  <div className="space-y-1.5 flex flex-col">
                    <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">Dosage Form</label>
                    <select
                      value={formData.pharmacyDetails.dosageForm}
                      onChange={(e) => setFormData({ ...formData, pharmacyDetails: { ...formData.pharmacyDetails, dosageForm: e.target.value } })}
                      className="w-full px-4 py-2.5 bg-white border-none rounded-md text-sm font-bold outline-none ring-slate-100 ring-1 focus:ring-2 focus:ring-red-500/20 cursor-pointer"
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
                      className="w-full px-4 py-2.5 bg-white border-none rounded-md text-sm font-bold outline-none ring-slate-100 ring-1 focus:ring-2 focus:ring-red-500/20 cursor-pointer"
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
                      className="w-full px-4 py-2.5 bg-white border-none rounded-md text-sm font-bold outline-none ring-slate-100 ring-1 focus:ring-2 focus:ring-red-500/20"
                      placeholder="e.g. 10"
                    />
                  </div>
                  <div className="space-y-1.5 flex flex-col">
                    <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">Unit</label>
                    <select
                      value={formData.pharmacyDetails.unit}
                      onChange={(e) => setFormData({ ...formData, pharmacyDetails: { ...formData.pharmacyDetails, unit: e.target.value } })}
                      className="w-full px-4 py-2.5 bg-white border-none rounded-md text-sm font-bold outline-none ring-slate-100 ring-1 focus:ring-2 focus:ring-red-500/20 cursor-pointer"
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
                      className="w-full px-4 py-2.5 bg-white border-none rounded-md text-sm font-bold outline-none ring-slate-100 ring-1 focus:ring-2 focus:ring-red-500/20 cursor-pointer"
                    >
                      {PHARMACY_CLASSIFICATION_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5 flex flex-col">
                    <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">Prescription Required</label>
                    <select
                      value={formData.pharmacyDetails.prescriptionRequired ? "Yes" : "No"}
                      onChange={(e) => setFormData({ ...formData, pharmacyDetails: { ...formData.pharmacyDetails, prescriptionRequired: e.target.value === "Yes" } })}
                      className="w-full px-4 py-2.5 bg-white border-none rounded-md text-sm font-bold outline-none ring-slate-100 ring-1 focus:ring-2 focus:ring-red-500/20 cursor-pointer"
                    >
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
                      className="w-full px-4 py-2.5 bg-white border-none rounded-md text-sm font-bold outline-none ring-slate-100 ring-1 focus:ring-2 focus:ring-red-500/20"
                      placeholder="License Number"
                      autoCapitalize="characters"
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
                      className="w-full px-4 py-2.5 bg-white border-none rounded-md text-sm font-bold outline-none ring-slate-100 ring-1 focus:ring-2 focus:ring-red-500/20"
                      placeholder="HSN Code"
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
                      className="w-full px-4 py-2.5 bg-white border-none rounded-md text-sm font-bold outline-none ring-slate-100 ring-1 focus:ring-2 focus:ring-red-500/20"
                      placeholder="Batch Number"
                      autoCapitalize="characters"
                    />
                  </div>
                  <div className="space-y-1.5 flex flex-col">
                    <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">Manufacturing Date</label>
                    <input type="date" value={formData.pharmacyDetails.mfgDate} onChange={(e) => setFormData({ ...formData, pharmacyDetails: { ...formData.pharmacyDetails, mfgDate: e.target.value } })} className="w-full px-4 py-2.5 bg-white border-none rounded-md text-sm font-bold outline-none ring-slate-100 ring-1 focus:ring-2 focus:ring-red-500/20" />
                  </div>
                  <div className="space-y-1.5 flex flex-col">
                    <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">Expiry Date</label>
                    <input type="date" value={formData.pharmacyDetails.expDate} onChange={(e) => setFormData({ ...formData, pharmacyDetails: { ...formData.pharmacyDetails, expDate: e.target.value } })} className="w-full px-4 py-2.5 bg-white border-none rounded-md text-sm font-bold outline-none ring-slate-100 ring-1 focus:ring-2 focus:ring-red-500/20" />
                  </div>
                  <div className="space-y-1.5 flex flex-col">
                    <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">Storage Condition</label>
                    <input type="text" value={formData.pharmacyDetails.storageCondition} onChange={(e) => setFormData({ ...formData, pharmacyDetails: { ...formData.pharmacyDetails, storageCondition: e.target.value } })} className="w-full px-4 py-2.5 bg-white border-none rounded-md text-sm font-bold outline-none ring-slate-100 ring-1 focus:ring-2 focus:ring-red-500/20" placeholder="e.g. Store below 25°C" />
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
                    min="1"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    placeholder="e.g. 500"
                    className="w-full px-4 py-3 bg-white shadow-sm ring-1 ring-slate-200 border-none rounded-xl text-lg font-bold outline-none focus:ring-2 focus:ring-red-500/10"
                  />
                </div>
                <div className="space-y-1.5 flex flex-col">
                  <label className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest ml-1">
                    Discounted Price (₹)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.salePrice}
                    onChange={(e) => setFormData({ ...formData, salePrice: e.target.value })}
                    placeholder="e.g. 450"
                    className="w-full px-4 py-3 bg-emerald-50/50 shadow-sm ring-1 ring-emerald-100 border-none rounded-xl text-lg font-bold text-emerald-700 outline-none focus:ring-2 focus:ring-emerald-200"
                  />
                </div>
              </div>

              <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-1.5 flex flex-col">
                  <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                    Packing Fee (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.packingFee}
                    onChange={(e) => setFormData({ ...formData, packingFee: e.target.value })}
                    placeholder="e.g. 10"
                    className="w-full px-4 py-3 bg-white shadow-sm ring-1 ring-slate-200 border-none rounded-xl text-lg font-bold outline-none focus:ring-2 focus:ring-red-500/10"
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
                    min="1"
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                    placeholder="e.g. 10"
                    className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-xl text-sm font-bold outline-none ring-red-500/5 focus:ring-2"
                  />
                </div>
                <div className="space-y-1.5 flex flex-col">
                  <label className="text-[9px] font-bold text-rose-500 uppercase tracking-widest ml-1">
                    Alert me when stock is below
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.lowStockAlert}
                    onChange={(e) => setFormData({ ...formData, lowStockAlert: e.target.value })}
                    className="w-full px-4 py-2.5 bg-rose-50/30 border-none rounded-xl text-sm font-bold text-rose-600 outline-none ring-rose-100 focus:ring-2"
                  />
                </div>
              </div>
            </div>
          )}

          {modalTab === "variants" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-300">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    Product Variants
                  </h4>
                  <p className="text-xs text-slate-600 font-medium">
                    Add different sizes, colors or weights.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setFormData({
                      ...formData,
                      variants: [
                        ...(formData.variants || []),
                        {
                          id: Date.now(),
                          name: "",
                          price: "",
                          salePrice: "",
                          stock: "",
                          sku: "",
                        },
                      ],
                    })
                  }
                  className="flex items-center space-x-2 px-3 py-1.5 bg-red-500/10 text-red-500 rounded-lg text-[10px] font-bold hover:bg-red-500/20 transition-all">
                  <HiOutlineSquaresPlus className="h-4 w-4" />
                  <span>ADD MANUAL VARIANT</span>
                </button>
              </div>

              {sellerBusinessType === "pharmacy" && (
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

                        const isDuplicate = (formData.variants || []).some(
                          (v) =>
                            v.strength === strength &&
                            v.packType === packType &&
                            v.packQuantity === packQuantity &&
                            v.unit === unit
                        );

                        if (isDuplicate) {
                          toast.error("A variant with this exact strength and pack size already exists.");
                          return;
                        }

                        const baseVariants = variantsWithoutPharmacyPlaceholder(formData.variants || []);
                        setFormData({
                          ...formData,
                          variants: [
                            ...baseVariants,
                            {
                              id: Date.now(),
                              name,
                              strength,
                              packType,
                              packQuantity,
                              unit,
                              price: formData.price || "",
                              salePrice: formData.salePrice || "",
                              stock: formData.stock || "",
                              sku: "",
                            },
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
                        className="w-full px-3 py-2 bg-slate-50 ring-1 ring-slate-200 border-none rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-red-500/10"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">
                        Pack Type
                      </label>
                      <select
                        value={pharmacyVariantDraft.packType}
                        onChange={(e) => setPharmacyVariantDraft({ ...pharmacyVariantDraft, packType: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 ring-1 ring-slate-200 border-none rounded-xl text-xs font-bold outline-none cursor-pointer focus:ring-2 focus:ring-red-500/10"
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
                        className="w-full px-3 py-2 bg-slate-50 ring-1 ring-slate-200 border-none rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-red-500/10"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">
                        Unit
                      </label>
                      <select
                        value={pharmacyVariantDraft.unit}
                        onChange={(e) => setPharmacyVariantDraft({ ...pharmacyVariantDraft, unit: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 ring-1 ring-slate-200 border-none rounded-xl text-xs font-bold outline-none cursor-pointer focus:ring-2 focus:ring-red-500/10"
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

              {sellerBusinessType === "pharmacy" && (formData.variants || []).length === 0 ? (
                <div className="p-6 bg-slate-50 rounded-2xl border border-dashed border-slate-200 flex flex-col items-center justify-center text-center">
                  <div className="p-4 bg-white shadow-sm rounded-full mb-3 text-slate-300">
                    <HiOutlineCube className="h-8 w-8" />
                  </div>
                  <h5 className="text-sm font-bold text-slate-700">No variants added yet</h5>
                  <p className="text-xs font-semibold text-slate-500 mt-2 max-w-sm">
                    Variants are truly optional for pharmacy products. Use the <strong>Pricing & Stock</strong> tab for single-pack medicines.
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1 max-w-sm">
                    Use the Variant Builder above only when selling multiple strengths, pack sizes, or dosage variants.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {(formData.variants || []).map((variant, index) => (
                  <div
                    key={variant.id}
                    className="p-4 bg-slate-50 rounded-2xl border border-slate-100 grid grid-cols-1 md:grid-cols-12 gap-4 items-end group relative">
                    <div className="col-span-12 md:col-span-3 space-y-1">
                      <label className="text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                        Variant Name
                      </label>
                      <input
                        value={variant.name}
                        onChange={(e) => {
                          const newVariants = [...formData.variants];
                          newVariants[index].name = e.target.value;
                          setFormData({ ...formData, variants: newVariants });
                        }}
                        placeholder="e.g. 1kg Bag"
                        className="w-full px-3 py-2 bg-white ring-1 ring-slate-200 border-none rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-red-500/10"
                      />
                    </div>
                    <div className="col-span-6 md:col-span-2 space-y-1">
                      <label className="text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                        Price
                      </label>
                      <input
                        type="number"
                        value={variant.price}
                        onChange={(e) => {
                          const newVariants = [...formData.variants];
                          newVariants[index].price = e.target.value;
                          setFormData({ ...formData, variants: newVariants });
                        }}
                        placeholder="500"
                        className="w-full px-3 py-2 bg-white ring-1 ring-slate-200 border-none rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-red-500/10"
                      />
                    </div>
                    <div className="col-span-6 md:col-span-2 space-y-1">
                      <label className="text-[8px] font-bold text-emerald-500 uppercase tracking-widest ml-1">
                        Sale
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={variant.salePrice}
                        onChange={(e) => {
                          const newVariants = [...formData.variants];
                          newVariants[index].salePrice = e.target.value;
                          setFormData({ ...formData, variants: newVariants });
                        }}
                        placeholder="450"
                        className={`w-full px-3 py-2 border-none rounded-xl text-xs font-bold outline-none focus:ring-2 ${variant.salePrice && Number(variant.salePrice) < 1 ? "bg-red-50 ring-1 ring-red-300 text-red-600 focus:ring-red-300" : "bg-emerald-50 ring-1 ring-emerald-100 text-emerald-700 focus:ring-emerald-200"}`}
                      />
                      {variant.salePrice && Number(variant.salePrice) < 1 && (
                        <p className="text-[9px] font-semibold text-red-500 ml-1">Min value is 1</p>
                      )}
                    </div>
                    <div className="col-span-6 md:col-span-2 space-y-1">
                      <label className="text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                        Stock
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={variant.stock}
                        onChange={(e) => {
                          const newVariants = [...formData.variants];
                          newVariants[index].stock = e.target.value;
                          setFormData({ ...formData, variants: newVariants });
                        }}
                        placeholder="10"
                        className={`w-full px-3 py-2 border-none rounded-xl text-xs font-bold outline-none focus:ring-2 ${variant.stock && Number(variant.stock) < 1 ? "bg-red-50 ring-1 ring-red-300 text-red-600 focus:ring-red-300" : "bg-white ring-1 ring-slate-200 focus:ring-red-500/10"}`}
                      />
                      {variant.stock && Number(variant.stock) < 1 && (
                        <p className="text-[9px] font-semibold text-red-500 ml-1">Min value is 1</p>
                      )}
                    </div>
                    <div className="col-span-5 md:col-span-2 space-y-1">
                      <label className="text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                        Product Code
                      </label>
                      <input
                        value={variant.sku}
                        readOnly
                        placeholder="AUTO-GENERATED"
                        className="w-full px-3 py-2 bg-slate-100 ring-1 ring-slate-200 border-none rounded-xl text-xs font-mono font-bold text-slate-400 cursor-not-allowed outline-none"
                      />
                    </div>
                    <div className="col-span-1 flex justify-end pb-1">
                      <button
                        onClick={() => {
                          if (sellerBusinessType === "pharmacy" || formData.variants.length > 1) {
                            const newVariants = formData.variants.filter(
                              (_, i) => i !== index,
                            );
                            setFormData({ ...formData, variants: newVariants });
                          }
                        }}
                        className="p-2 text-slate-300 hover:text-rose-500 transition-colors">
                        <HiOutlineTrash className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  ))}
                </div>
              )}
            </div>
          )}

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
                    className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-md text-sm font-bold outline-none cursor-pointer focus:ring-2 focus:ring-red-500/5 transition-all">
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
                    disabled={!formData.header}
                    className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-md text-sm font-bold outline-none cursor-pointer focus:ring-2 focus:ring-red-500/5 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
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
              <div className="grid grid-cols-1 gap-6">
                <div className="space-y-1.5 flex flex-col">
                  <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                    Sub-Category <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.subcategory}
                    onChange={(e) =>
                      setFormData({ ...formData, subcategory: e.target.value })
                    }
                    disabled={!formData.category}
                    className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-md text-sm font-bold outline-none cursor-pointer focus:ring-2 focus:ring-red-500/5 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
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
            </div>
          )}

          {modalTab === "media" && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-2 duration-300">
              {/* Main Image Section */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                  Main Cover Photo
                </label>
                <div className="flex flex-col md:flex-row items-start gap-6">
                  <div className="w-48 aspect-square rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center group hover:border-red-500 hover:bg-red-500/5 transition-all cursor-pointer overflow-hidden relative">
                    <input
                      ref={mainImageInputRef}
                      type="file"
                      accept="image/*"
                      className="absolute inset-0 opacity-0 cursor-pointer z-10"
                      onChange={(e) => handleImageUpload(e, "main")}
                    />
                    {formData.mainImage ? (
                      <img
                        src={formData.mainImage}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <>
                        <HiOutlinePhoto className="h-10 w-10 text-slate-200 group-hover:text-red-500 transition-colors" />
                        <p className="text-[9px] font-bold text-slate-600 mt-2 uppercase tracking-widest group-hover:text-red-500">
                          Upload Cover
                        </p>
                      </>
                    )}
                  </div>
                  <div className="flex-1 space-y-2 pt-2">
                    <p className="text-xs font-bold text-slate-900">
                      Choose a primary image
                    </p>
                    <p className="text-xs text-slate-600 font-medium leading-relaxed">
                      We show this image on the search page and the main
                      store listing. Make sure it is clear and bright.
                    </p>
                    <button
                      type="button"
                      onClick={() => mainImageInputRef.current?.click()}
                      className="text-[10px] font-black text-red-500 uppercase tracking-wider hover:underline">
                      Pick from Library
                    </button>
                  </div>
                </div>
              </div>

              {/* Gallery Section */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                  Gallery Photos (Max 5)
                </label>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className="aspect-square rounded-md border-2 border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center group hover:border-red-500 hover:bg-red-500/5 transition-all cursor-pointer relative overflow-hidden">
                      {formData.galleryImages[i - 1] ? (
                        <img
                          src={formData.galleryImages[i - 1]}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <>
                          <input
                            type="file"
                            className="absolute inset-0 opacity-0 cursor-pointer z-10"
                            onChange={(e) => handleImageUpload(e, "gallery")}
                          />
                          <HiOutlinePlus className="h-5 w-5 text-slate-200 group-hover:text-red-500 transition-colors" />
                          <p className="text-[8px] font-bold text-slate-600 mt-1 uppercase tracking-widest group-hover:text-red-500">
                            Add
                          </p>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <p className="text-xs text-slate-600 font-medium italic text-center pt-4 border-t border-slate-50">
                Quick Tip: Using WebP format at 800x800px makes your store load
                3x faster.
              </p>
            </div>
          )}

          
        </div>
      </div>
    </div>
  );
};

export default AddProduct;
