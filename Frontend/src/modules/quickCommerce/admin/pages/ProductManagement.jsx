import React, { useState, useMemo, useEffect } from 'react';
import Card from '@shared/components/ui/Card';
import Badge from '@shared/components/ui/Badge';
import { adminApi } from '../services/adminApi';
import { toast } from 'sonner';
import {
    HiOutlinePlus,
    HiOutlineCube,
    HiOutlineMagnifyingGlass,
    HiOutlineFunnel,
    HiOutlineTrash,
    HiOutlinePencilSquare,
    HiOutlineEye,
    HiOutlinePhoto,
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
    HiOutlineCurrencyDollar,
    HiOutlineSquaresPlus
} from 'react-icons/hi2';
import Modal from '@shared/components/ui/Modal';
import Pagination from '@shared/components/ui/Pagination';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { convertToWebP } from '@/shared/utils/imageUploadUtils';
import { useAuth } from "@core/context/AuthContext";
import { getCurrentUser } from "@food/utils/auth";
import { canPerformAdminPermissionAction, extractAdminPermissions, extractAdminRoleId, fetchAdminRolePermissions } from "@food/utils/adminPermissions";


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
  { value: "other", label: "Other" },
];

const sanitizeLicense = (val) => val.replace(/[^A-Za-z0-9-]/g, '').toUpperCase();
const sanitizeDigits = (val) => val.replace(/[^0-9]/g, '');
const sanitizeBatch = (val) => val.replace(/[^A-Za-z0-9]/g, '').toUpperCase();

const DEFAULT_PHARMACY_DETAILS = {
  genericName: '',
  manufacturer: '',
  composition: '',
  strength: '',
  dosageForm: 'tablet',
  packType: 'strip',
  packQuantity: 10,
  unit: 'tablet',
  storageCondition: '',
  prescriptionRequired: false,
  drugClassification: 'otc',
  drugLicenseNumber: '',
  hsnCode: '',
  batchNumber: '',
  mfgDate: '',
  expDate: '',
  packSize: '',
};

const formatDateInputValue = (value) => {
  if (!value) return '';
  const raw = String(value).trim();
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
};

const resolveHeaderBusinessType = (item = {}) =>
  String(
    item?.headerBusinessType ||
      item?.headerId?.businessType ||
      item?.header?.businessType ||
      '',
  )
    .trim()
    .toLowerCase();

const resolveSellerBusinessType = (item = {}) =>
  String(
    item?.sellerBusinessType ||
      item?.seller?.shopInfo?.businessType ||
      item?.seller?.businessType ||
      '',
  )
    .trim()
    .toLowerCase();

const hasMeaningfulPharmacyDetails = (item = {}) => {
  const pd = item?.pharmacyDetails;
  if (!pd || typeof pd !== 'object') return false;
  return [
    'genericName',
    'manufacturer',
    'composition',
    'strength',
    'dosageForm',
    'packType',
    'drugClassification',
    'batchNumber',
    'hsnCode',
  ].some((key) => String(pd[key] || '').trim());
};

const hasPharmacyVariantMeta = (item = {}) => {
  const variants = Array.isArray(item?.variants) ? item.variants : [];
  return variants.some(
    (variant) =>
      String(variant?.strength || '').trim() ||
      String(variant?.packType || '').trim() ||
      String(variant?.unit || '').trim(),
  );
};

const isPharmacyProduct = (item = {}) => {
  if (!item) return false;
  if (resolveHeaderBusinessType(item) === 'pharmacy') return true;
  const sellerType = resolveSellerBusinessType(item);
  if (sellerType === 'pharmacy' || sellerType === 'pharmacies') return true;
  if (hasMeaningfulPharmacyDetails(item)) return true;
  if (hasPharmacyVariantMeta(item)) return true;
  return false;
};

const normalizePharmacyDetailsForForm = (raw = {}, product = {}) => {
  const source = raw && typeof raw === 'object' ? raw : {};
  return {
    ...DEFAULT_PHARMACY_DETAILS,
    ...source,
    genericName: source.genericName || source.generic_name || product.name || '',
    manufacturer: source.manufacturer || product.brand || '',
    composition: source.composition || '',
    strength: source.strength || product.weight || '',
    dosageForm: source.dosageForm || source.dosage_form || DEFAULT_PHARMACY_DETAILS.dosageForm,
    packType: source.packType || source.pack_type || DEFAULT_PHARMACY_DETAILS.packType,
    packQuantity: source.packQuantity ?? source.pack_quantity ?? DEFAULT_PHARMACY_DETAILS.packQuantity,
    unit: source.unit || DEFAULT_PHARMACY_DETAILS.unit,
    storageCondition: source.storageCondition || source.storage_condition || '',
    prescriptionRequired: Boolean(
      source.prescriptionRequired ?? source.prescription ?? false,
    ),
    drugClassification:
      source.drugClassification || source.classification || DEFAULT_PHARMACY_DETAILS.drugClassification,
    drugLicenseNumber: source.drugLicenseNumber || source.drug_license_number || '',
    hsnCode: source.hsnCode || source.hsn_code || '',
    batchNumber: source.batchNumber || source.batch_number || '',
    mfgDate: formatDateInputValue(source.mfgDate || source.mfg_date),
    expDate: formatDateInputValue(source.expDate || source.exp_date),
    packSize: source.packSize || source.pack_size || '',
  };
};

const ProductManagement = () => {
    const { user: authUser } = useAuth();
    const currentUser = useMemo(() => authUser || getCurrentUser("admin"), [authUser]);
    const [resolvedPermissions, setResolvedPermissions] = useState({});

    useEffect(() => {
        let isMounted = true;

        const resolvePermissions = async () => {
            if (!currentUser || currentUser.role === "ADMIN") {
                if (isMounted) setResolvedPermissions({});
                return;
            }

            const existingPermissions = extractAdminPermissions(currentUser);
            if (Object.keys(existingPermissions).length > 0) {
                if (isMounted) setResolvedPermissions(existingPermissions);
                return;
            }

            const roleId = extractAdminRoleId(currentUser);
            if (!roleId) {
                if (isMounted) setResolvedPermissions({});
                return;
            }

            try {
                const rolePermissions = await fetchAdminRolePermissions(roleId);
                if (isMounted) setResolvedPermissions(rolePermissions);
            } catch {
                if (isMounted) setResolvedPermissions({});
            }
        };

        resolvePermissions();
        return () => {
            isMounted = false;
        };
    }, [currentUser]);

    const permissionKey = "quick::core_management::products";
    const canCreate = canPerformAdminPermissionAction(currentUser, resolvedPermissions, permissionKey, "create");
    const canEdit = canPerformAdminPermissionAction(currentUser, resolvedPermissions, permissionKey, "edit");
    const canDelete = canPerformAdminPermissionAction(currentUser, resolvedPermissions, permissionKey, "delete");

    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]); // All categories for dropdowns
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);
    const [total, setTotal] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState('all');
    const [filterStatus, setFilterStatus] = useState('all'); // Added filterStatus
    const [filterBusinessType, setFilterBusinessType] = useState('all'); // Added filterBusinessType

    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState(null);
    const [editingItem, setEditingItem] = useState(null);
    const [isViewMode, setIsViewMode] = useState(false);
    const [isPharmacyModal, setIsPharmacyModal] = useState(false);
    const [modalTab, setModalTab] = useState('general');

    const modalTabs = useMemo(() => {
        const tabs = [
            { id: 'general', label: 'General Info', icon: HiOutlineTag },
            ...(isPharmacyModal ? [{ id: 'medicine', label: 'Medicine Details', icon: HiOutlineTag }] : []),
            { id: 'pricing', label: 'Pricing & Stock', icon: HiOutlineCurrencyDollar },
            { id: 'variants', label: 'Item Variants', icon: HiOutlineSwatch },
            { id: 'category', label: 'Groups', icon: HiOutlineFolderOpen },
            { id: 'media', label: 'Photos', icon: HiOutlinePhoto },
        ];
        return tabs;
    }, [isPharmacyModal]);

    useEffect(() => {
        if (!isPharmacyModal && modalTab === 'medicine') {
            setModalTab('general');
        }
    }, [isPharmacyModal, modalTab]);

    const [formData, setFormData] = useState({
        name: '',
        slug: '',
        sku: '',
        description: '',
        price: '',
        salePrice: '',
        stock: '',
        lowStockAlert: 5,
        unit: 'packet',
        header: '',
        categoryId: '',
        subcategoryId: '',
        status: 'active',
        isFeatured: false,
        tags: '',
        weight: '',
        brand: '',
        mainImage: null,
        galleryImages: [],
        pharmacyDetails: { ...DEFAULT_PHARMACY_DETAILS },
        variants: [
            { id: Date.now(), name: 'Default', price: '', salePrice: '', stock: '', sku: '' }
        ]
    });

    const [viewingVariants, setViewingVariants] = useState(null);
    const [isVariantsViewModalOpen, setIsVariantsViewModalOpen] = useState(false);

    const [imageFiles, setImageFiles] = useState([]);
    const [previews, setPreviews] = useState([]);

    const fetchCategories = async () => {
        try {
            const response = await adminApi.getCategoryTree();
            if (response.data.success) {
                setCategories(response.data.results || response.data.result || []);
            }
        } catch (error) {
            console.error('Failed to fetch categories');
        }
    };

    const fetchProducts = async (requestedPage = 1) => {
        setIsLoading(true);
        try {
            const params = { page: requestedPage, limit: pageSize };
            if (searchTerm) params.search = searchTerm;
            if (filterCategory !== 'all') params.category = filterCategory;
            if (filterStatus !== 'all') params.status = filterStatus;
            if (filterBusinessType !== 'all') params.businessType = filterBusinessType;

            const response = await adminApi.getProducts(params);
            if (response.data.success) {
                const payload = response.data.result || {};
                const list = Array.isArray(payload.items) ? payload.items : (response.data.results || []);
                setProducts(list);
                setTotal(typeof payload.total === 'number' ? payload.total : list.length);
                setPage(typeof payload.page === 'number' ? payload.page : requestedPage);
            }
        } catch (error) {
            toast.error('Failed to fetch products');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchCategories();
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchProducts(1);
        }, 500); // Debounce search
        return () => clearTimeout(timer);
    }, [searchTerm, filterCategory, filterStatus, filterBusinessType, pageSize]);

    const handleSave = async () => {
        if (!editingItem) {
            return toast.error('Only product editing is allowed for admins');
        }

        if (!formData.name || !formData.price || !formData.stock || !formData.header || !formData.categoryId || !formData.subcategoryId) {
            return toast.error('Please fill all required fields, including categories');
        }

        setIsSaving(true);
        try {
            const data = new FormData();
            data.append('name', formData.name);
            data.append('slug', formData.slug);
            data.append('sku', formData.sku);
            data.append('description', formData.description);
            data.append('price', Number(formData.price));
            data.append('salePrice', Number(formData.salePrice) || 0);
            data.append('stock', Number(formData.stock));
            data.append('lowStockAlert', Number(formData.lowStockAlert) || 5);
            data.append('unit', formData.unit);
            data.append('headerId', formData.header);
            data.append('categoryId', formData.categoryId);
            data.append('subcategoryId', formData.subcategoryId);
            data.append('status', formData.status);
            data.append('isFeatured', formData.isFeatured);
            data.append('brand', formData.brand);
            data.append('weight', formData.weight);
            data.append('tags', formData.tags);
            data.append('variants', JSON.stringify(formData.variants));

            if (isPharmacyModal) {
                data.append('pharmacyDetails', JSON.stringify(formData.pharmacyDetails));
            }

            if (formData.mainImageFile) {
                data.append('mainImage', formData.mainImageFile);
            }
            if (formData.galleryFiles && formData.galleryFiles.length > 0) {
                formData.galleryFiles.forEach((file) => data.append('galleryImages', file));
            }

            await adminApi.updateProduct(editingItem._id, data);
            toast.success('Product updated successfully');
            setIsProductModalOpen(false);
            fetchProducts(page);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to save product');
        } finally {
            setIsSaving(false);
        }
    };

    const confirmDelete = async () => {
        try {
            await adminApi.deleteProduct(itemToDelete._id);
            toast.success('Product deleted');
            setIsDeleteModalOpen(false);
            fetchProducts(page);
        } catch (error) {
            toast.error('Failed to delete product');
        }
    };

    const handleImageChange = (e) => {
        const files = Array.from(e.target.files);
        if (files.length + imageFiles.length > 5) {
            return toast.error('Max 5 images allowed');
        }

        const newPreviews = files.map(file => URL.createObjectURL(file));
        setPreviews([...previews, ...newPreviews]);
        setImageFiles([...imageFiles, ...files]);
    };

    const handleImageUpload = async (e, type) => {
        if (e.target.files && e.target.files[0]) {
            try {
                const originalFile = e.target.files[0];
                const webpFile = await convertToWebP(originalFile);
                
                const reader = new FileReader();
                reader.onloadend = () => {
                    if (type === 'main') {
                        setFormData({ ...formData, mainImage: reader.result, mainImageFile: webpFile });
                    } else {
                        setFormData({
                            ...formData,
                            galleryImages: [...formData.galleryImages, reader.result],
                            galleryFiles: [...(formData.galleryFiles || []), webpFile]
                        });
                    }
                };
                reader.readAsDataURL(webpFile);
            } catch (error) {
                console.error("WebP conversion failed:", error);
                toast.error("Failed to process image");
            }
        }
    };

    const openModal = async (item = null, viewMode = false) => {
        setIsViewMode(viewMode);
        if (item) {
            let product = item;
            const productId = item._id || item.id;
            if (productId) {
                try {
                    const response = await adminApi.getProductById(productId);
                    if (response.data?.success && response.data?.result) {
                        product = response.data.result;
                    }
                } catch (error) {
                    console.warn('Failed to fetch product details, using list payload', error);
                }
            }

            const pharmacyProduct = isPharmacyProduct(product);
            setIsPharmacyModal(pharmacyProduct);

            setFormData({
                name: product.name || '',
                slug: product.slug || '',
                sku: product.sku || '',
                description: product.description || '',
                price: product.price || '',
                salePrice: product.salePrice || product.discountPrice || '',
                stock: product.stock || '',
                lowStockAlert: product.lowStockAlert || 5,
                unit: product.unit || 'packet',
                header: product.headerId?._id || product.headerId || '',
                categoryId: product.categoryId?._id || product.categoryId || '',
                subcategoryId: product.subcategoryId?._id || product.subcategoryId || '',
                status: product.status || 'active',
                isFeatured: product.isFeatured || false,
                tags: Array.isArray(product.tags) ? product.tags.join(', ') : product.tags || '',
                weight: product.weight || '',
                brand: product.brand || '',
                mainImage: product.mainImage || null,
                galleryImages: product.galleryImages || [],
                pharmacyDetails: normalizePharmacyDetailsForForm(product.pharmacyDetails, product),
                variants: (product.variants && product.variants.length > 0) ? product.variants.map(v => ({ ...v, id: v._id || Date.now() })) : [
                    {
                        id: Date.now(),
                        name: 'Default',
                        price: product.price || '',
                        salePrice: product.salePrice || product.discountPrice || '',
                        stock: product.stock || '',
                        sku: product.sku || ''
                    }
                ]
            });
            setPreviews(item.images || product.galleryImages || []);
            setEditingItem(product);
        } else {
            setIsPharmacyModal(false);
            setFormData({
                name: '', slug: '', sku: '', description: '', price: '',
                salePrice: '', stock: '', lowStockAlert: 5, unit: 'packet',
                header: '', categoryId: '', subcategoryId: '', status: 'active',
                isFeatured: false, tags: '', weight: '', brand: '',
                mainImage: null, galleryImages: [],
                pharmacyDetails: { ...DEFAULT_PHARMACY_DETAILS },
                variants: [
                    { id: Date.now(), name: 'Default', price: '', salePrice: '', stock: '', sku: '' }
                ]
            });
            setPreviews([]);
            setEditingItem(null);
        }
        setImageFiles([]);
        setModalTab('general');
        setIsProductModalOpen(true);
    };

    const productsList = Array.isArray(products) ? products : [];
    
    const getProductTotalStock = (product) => {
        if (product.variants?.length > 0) {
            return product.variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
        }
        return Number(product.stock) || 0;
    };

    const stats = useMemo(() => ({
        total: total,
        lowStock: productsList.filter(p => {
            const stock = getProductTotalStock(p);
            return stock > 0 && stock <= 10;
        }).length,
        outOfStock: productsList.filter(p => getProductTotalStock(p) === 0).length,
        active: productsList.filter(p => p.status === 'active').length
    }), [productsList, total]);

    const StatusBadge = ({ status, stock }) => {
        if (stock === 0) return <Badge variant="error" className="text-[10px] px-1.5 py-0">Out of Stock</Badge>;
        if (stock <= 10) return <Badge variant="warning" className="text-[10px] px-1.5 py-0">Low Stock</Badge>;
        if (status === 'active') return <Badge variant="success" className="text-[10px] px-1.5 py-0">Active</Badge>;
        return <Badge variant="gray" className="text-[10px] px-1.5 py-0">Draft</Badge>;
    };

    return (
        <div className="ds-section-spacing animate-in fade-in slide-in-from-bottom-2 duration-700 pb-16">
            {/* Page Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                    <h1 className="ds-h1 flex items-center gap-2">
                        Product List
                        <Badge variant="primary" className="text-[9px] px-1.5 py-0 font-bold tracking-wider uppercase">Live</Badge>
                    </h1>
                    <p className="ds-description mt-0.5">Track your items, prices, and how many are left in stock.</p>
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'All Items', val: stats.total, icon: HiOutlineCube, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                    { label: 'Active Items', val: stats.active, icon: HiOutlineCheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                    { label: 'Low Stock', val: stats.lowStock, icon: HiOutlineExclamationCircle, color: 'text-amber-600', bg: 'bg-amber-50' },
                    { label: 'Out of Stock', val: stats.outOfStock, icon: HiOutlineArchiveBox, color: 'text-rose-600', bg: 'bg-rose-50' }
                ].map((stat, i) => (
                    <Card key={i} className="border-none shadow-sm ring-1 ring-slate-100 p-4 relative overflow-hidden group">
                        <div className="flex items-center gap-3">
                            <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 duration-300", stat.bg, stat.color)}>
                                <stat.icon className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="ds-label">{stat.label}</p>
                                <h4 className="ds-stat-medium">{stat.val}</h4>
                            </div>
                        </div>
                    </Card>
                ))}
            </div>

            {/* Toolbox */}
            <Card className="border-none shadow-sm ring-1 ring-slate-100 p-3 bg-white/60 backdrop-blur-xl">
                <div className="flex flex-col lg:flex-row gap-3 items-center">
                    <div className="relative flex-1 group w-full">
                        <HiOutlineMagnifyingGlass className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-primary transition-all" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search by name, SKU or slug..."
                            className="w-full pl-10 pr-4 py-2.5 bg-slate-100/50 border-none rounded-xl text-xs font-semibold text-slate-700 placeholder:text-slate-400 focus:ring-2 focus:ring-primary/5 transition-all outline-none"
                        />
                    </div>
                    <div className="flex gap-2 shrink-0 w-full lg:w-auto">
                        <select
                            value={filterBusinessType}
                            onChange={(e) => setFilterBusinessType(e.target.value)}
                            className="flex-1 lg:flex-none px-4 py-2.5 bg-white ring-1 ring-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-primary/5 outline-none appearance-none cursor-pointer"
                        >
                            <option value="all">All Types</option>
                            <option value="quick_commerce">Products</option>
                            <option value="pharmacy">Medicines</option>
                        </select>
                        <select
                            value={filterCategory}
                            onChange={(e) => setFilterCategory(e.target.value)}
                            className="flex-1 lg:flex-none px-4 py-2.5 bg-white ring-1 ring-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-primary/5 outline-none appearance-none cursor-pointer"
                        >
                            <option value="all">All Categories</option>
                            {categories.map(h => (
                                <optgroup key={h._id} label={h.name}>
                                    <option value={h._id}>All {h.name}</option>
                                    {(h.children || []).map(c => (
                                        <option key={c._id} value={c._id}>{c.name}</option>
                                    ))}
                                </optgroup>
                            ))}
                        </select>
                        <button
                            onClick={() => {
                                const nextStatus = filterStatus === 'all' ? 'active' : filterStatus === 'active' ? 'inactive' : 'all';
                                setFilterStatus(nextStatus);
                            }}
                            className={cn(
                                "flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap",
                                filterStatus === 'active' ? "bg-emerald-500 text-white shadow-md shadow-emerald-100" :
                                    filterStatus === 'inactive' ? "bg-amber-500 text-white shadow-md shadow-amber-100" :
                                        "bg-white ring-1 ring-slate-200 text-slate-600 hover:bg-slate-50"
                            )}
                        >
                            <HiOutlineFunnel className="h-4 w-4" />
                            <span>
                                {filterStatus === 'active' ? 'ONLY LIVE' :
                                    filterStatus === 'inactive' ? 'ONLY DRAFT' :
                                        'SHOW ALL'}
                            </span>
                        </button>
                    </div>
                </div>
            </Card>

            {/* Product Table */}
            <Card className="border-none shadow-xl ring-1 ring-slate-100 overflow-hidden rounded-xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-100">
                                <th className="px-6 py-3 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wider">Product</th>
                                <th className="px-6 py-3 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wider">Seller</th>
                                <th className="px-6 py-3 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wider">Variant</th>
                                <th className="px-6 py-3 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wider">Category</th>
                                <th className="px-6 py-3 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wider">Subcategory</th>
                                <th className="px-6 py-3 text-center text-[10px] font-semibold text-gray-600 uppercase tracking-wider">Price</th>
                                <th className="px-6 py-3 text-center text-[10px] font-semibold text-gray-600 uppercase tracking-wider">Stock</th>
                                <th className="px-6 py-3 text-center text-[10px] font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-3 text-right text-[10px] font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {isLoading ? (
                                <tr>
                                    <td colSpan="9" className="px-6 py-20 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <HiOutlineArrowPath className="h-8 w-8 text-primary animate-spin" />
                                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Loading Products...</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : productsList.length === 0 ? (
                                <tr>
                                    <td colSpan="9" className="px-6 py-20 text-center text-slate-400 font-bold text-xs uppercase tracking-widest">No products found</td>
                                </tr>
                            ) : productsList.map((p) => (
                                <tr key={p._id} className="hover:bg-slate-50/30 transition-colors group">
                                    {/* Product Column */}
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-lg overflow-hidden bg-slate-100 ring-1 ring-slate-200">
                                                <img src={p.mainImage || p.images?.[0]} alt={p.name} className="h-full w-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-slate-900">{p.name}</p>
                                                <p className="text-[9px] font-semibold text-slate-400">{p.unit}</p>
                                            </div>
                                        </div>
                                    </td>

                                    {/* Seller Column */}
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <div className="h-2 w-2 rounded-full bg-blue-500" />
                                            <span className="text-xs font-bold text-slate-700">
                                                {p.seller?.shopName || p.storeName || p.restaurantName || 'Admin'}
                                            </span>
                                        </div>
                                    </td>

                                    {/* Variant Column */}
                                    <td
                                        className="px-6 py-4 cursor-pointer hover:bg-purple-50/50 transition-colors group/variant"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setViewingVariants(p);
                                            setIsVariantsViewModalOpen(true);
                                        }}
                                    >
                                        {p.variants && p.variants.length > 0 ? (
                                            <div className="flex items-center gap-1.5">
                                                <HiOutlineSwatch className="h-3.5 w-3.5 text-purple-500 group-hover/variant:scale-110 transition-transform" />
                                                <span className="text-xs font-bold text-purple-700 underline underline-offset-4 decoration-purple-200 group-hover/variant:decoration-purple-500">{p.variants.length} Variant{p.variants.length > 1 ? 's' : ''}</span>
                                            </div>
                                        ) : (
                                            <span className="text-xs font-semibold text-slate-400">No variants</span>
                                        )}
                                    </td>

                                    {/* Category Column */}
                                    <td className="px-6 py-4">
                                        <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg">{p.categoryId?.name || 'N/A'}</span>
                                    </td>

                                    {/* Subcategory Column */}
                                    <td className="px-6 py-4">
                                        <span className="text-xs font-bold text-slate-600">{p.subcategoryId?.name || 'N/A'}</span>
                                    </td>

                                    {/* Price Column */}
                                    <td className="px-6 py-4 text-center">
                                        <div className="flex flex-col items-center">
                                            <span className={cn("text-xs font-bold", p.salePrice > 0 ? "text-slate-400 line-through scale-90" : "text-slate-900")}>₹{p.price}</span>
                                            {p.salePrice > 0 && <span className="text-xs font-bold text-emerald-600">₹{p.salePrice}</span>}
                                        </div>
                                    </td>

                                    {/* Stock Column */}
                                    <td className="px-6 py-4 text-center">
                                        {(() => {
                                            const totalStock = getProductTotalStock(p);
                                            return (
                                                <span className={cn("text-xs font-bold", totalStock === 0 ? "text-rose-500" : totalStock <= 10 ? "text-amber-500" : "text-emerald-500")}>
                                                    {totalStock}
                                                </span>
                                            );
                                        })()}
                                    </td>

                                    {/* Status Column */}
                                    <td className="px-6 py-4 text-center">
                                        <StatusBadge status={p.status} stock={getProductTotalStock(p)} />
                                    </td>

                                    {/* Actions Column */}
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end space-x-1.5">
                                            <button
                                                onClick={() => openModal(p, true)}
                                                className="p-1.5 hover:bg-slate-100 hover:text-slate-600 rounded-lg transition-all text-gray-400 shadow-sm ring-1 ring-gray-100"
                                                title="View Details"
                                            >
                                                <HiOutlineEye className="h-3.5 w-3.5" />
                                            </button>

                                            {canDelete && (
                                                <button
                                                    onClick={() => (setItemToDelete(p), setIsDeleteModalOpen(true))}
                                                    className="p-1.5 hover:bg-rose-50 hover:text-rose-600 rounded-lg transition-all text-gray-400 shadow-sm ring-1 ring-gray-100"
                                                >
                                                    <HiOutlineTrash className="h-3.5 w-3.5" />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="px-6 py-3 border-t border-slate-100">
                    <Pagination
                        page={page}
                        totalPages={Math.ceil(total / pageSize) || 1}
                        total={total}
                        pageSize={pageSize}
                        onPageChange={(p) => fetchProducts(p)}
                        onPageSizeChange={(newSize) => {
                            setPageSize(newSize);
                            setPage(1);
                        }}
                        loading={isLoading}
                    />
                </div>
            </Card>

            {/* Super Detailed Modal */}
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
                            className="w-full max-w-5xl relative z-10 bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col"
                        >
                            {/* Modal Header */}
                            <div className="flex items-center justify-between p-6 border-b border-slate-100">
                                <div className="flex items-center space-x-3">
                                    <div className="h-10 w-10 bg-red-600 text-white rounded-xl flex items-center justify-center">
                                        <HiOutlineCube className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <h3 className="admin-h3">
                                            {isViewMode ? 'Product Details' : 'Edit Product'}
                                        </h3>
                                        <div className="flex items-center space-x-2 mt-0.5">
                                            <Badge variant="primary" className="text-[7px] font-bold uppercase tracking-widest px-1">SYSTEM</Badge>
                                            <HiOutlineChevronRight className="h-2.5 w-2.5 text-slate-300" />
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{formData.sku || 'PENDING SKU'}</span>
                                        </div>
                                    </div>
                                </div>
                                <button onClick={() => setIsProductModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400">
                                    <HiOutlineXMark className="h-5 w-5" />
                                </button>
                            </div>

                            <div className="flex flex-col lg:flex-row flex-1 min-h-[400px] max-h-[calc(100vh-200px)] overflow-hidden">
                                {/* Modal Sidebar Tabs */}
                                <div className="lg:w-1/4 bg-slate-50/50 border-r border-slate-100 p-4 space-y-1 overflow-y-auto scrollbar-hide">
                                    {modalTabs.map((tab) => (
                                        <button
                                            key={tab.id}
                                            onClick={() => setModalTab(tab.id)}
                                            className={cn(
                                                "w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-xs font-bold transition-all",
                                                modalTab === tab.id
                                                    ? "bg-white text-primary shadow-sm ring-1 ring-slate-100"
                                                    : "text-slate-500 hover:bg-slate-100"
                                            )}
                                        >
                                            <tab.icon className="h-4 w-4" />
                                            <span>{tab.label}</span>
                                        </button>
                                    ))}

                                    <div className="pt-8 px-4">
                                        <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                                            <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest mb-1">Status</p>
                                            <select
                                                value={formData.status}
                                                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                                disabled={isViewMode}
                                                className="w-full bg-transparent border-none text-xs font-bold text-emerald-700 outline-none p-0 cursor-pointer disabled:opacity-80"
                                            >
                                                <option value="active">PUBLISHED</option>
                                                <option value="inactive">DRAFT</option>
                                            </select>
                                        </div>
                                        <div className="mt-3 p-4 bg-indigo-50 rounded-2xl border border-indigo-100 flex items-center justify-between">
                                            <p className="text-[9px] font-bold text-indigo-600 uppercase tracking-widest">Featured</p>
                                            <input
                                                type="checkbox"
                                                checked={formData.isFeatured}
                                                onChange={(e) => setFormData({ ...formData, isFeatured: e.target.checked })}
                                                disabled={isViewMode}
                                                className="h-4 w-4 rounded border-indigo-300 text-primary focus:ring-primary disabled:opacity-80"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Modal Content Area */}
                                <div className="flex-1 p-4 overflow-y-auto">
                                    {modalTab === 'general' && (
                                        <div className="ds-section-spacing animate-in fade-in slide-in-from-right-2 duration-300">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div className="space-y-1.5 flex flex-col">
                                                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Product Title</label>
                                                    <input
                                                        value={formData.name}
                                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                                        className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-xl text-sm font-semibold outline-none ring-primary/5 focus:ring-2"
                                                        placeholder="e.g. Premium Basmati Rice"
                                                        disabled={isViewMode}
                                                    />
                                                </div>
                                                <div className="space-y-1.5 flex flex-col">
                                                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Web Address</label>
                                                    <div className="flex items-center bg-slate-50 rounded-xl px-4 py-2.5">
                                                        <span className="text-[10px] text-slate-400 font-bold mr-1">/product/</span>
                                                        <input
                                                            value={formData.slug}
                                                            onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                                                            className="flex-1 bg-transparent border-none text-sm text-slate-500 font-semibold outline-none"
                                                            placeholder="premium-basmati-rice"
                                                            disabled={isViewMode}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="space-y-1.5 flex flex-col">
                                                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">About this item</label>
                                                <textarea
                                                    value={formData.description}
                                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                                    onWheel={(e) => e.stopPropagation()}
                                                    onTouchMove={(e) => e.stopPropagation()}
                                                    className="w-full px-4 py-3 bg-slate-100 border-none rounded-2xl text-sm font-semibold min-h-[160px] max-h-[260px] outline-none resize-none overflow-y-auto custom-scrollbar"
                                                    placeholder="Describe the item here..."
                                                    disabled={isViewMode}
                                                />
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div className="space-y-1.5 flex flex-col">
                                                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Brand Name</label>
                                                    <input
                                                        value={formData.brand}
                                                        onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                                                        className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-xl text-sm font-semibold outline-none ring-primary/5 focus:ring-2"
                                                        placeholder="e.g. Amul"
                                                        disabled={isViewMode}
                                                    />
                                                </div>
                                                <div className="space-y-1.5 flex flex-col">
                                                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Product Code</label>
                                                    <input
                                                        value={formData.sku}
                                                        onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                                                        className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-xl text-sm font-mono font-bold outline-none ring-primary/5 focus:ring-2"
                                                        placeholder="AUTO-GENERATED"
                                                        disabled={isViewMode}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {modalTab === 'category' && (
                                        <div className="ds-section-spacing animate-in fade-in slide-in-from-right-2 duration-300">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div className="space-y-1.5 flex flex-col">
                                                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Main Group (Header) <span className="text-rose-500">*</span></label>
                                                    <select
                                                        value={formData.header}
                                                        onChange={(e) => setFormData({ ...formData, header: e.target.value, categoryId: '', subcategoryId: '' })}
                                                        disabled={isViewMode}
                                                        className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-xl text-sm font-bold outline-none cursor-pointer disabled:opacity-50"
                                                    >
                                                        <option value="">Select Main Group</option>
                                                        {categories.map(h => <option key={h._id} value={h._id}>{h.name}</option>)}
                                                    </select>
                                                </div>
                                                <div className="space-y-1.5 flex flex-col">
                                                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Specific Category <span className="text-rose-500">*</span></label>
                                                    <select
                                                        value={formData.categoryId}
                                                        onChange={(e) => setFormData({ ...formData, categoryId: e.target.value, subcategoryId: '' })}
                                                        disabled={isViewMode || !formData.header}
                                                        className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-xl text-sm font-bold outline-none cursor-pointer disabled:opacity-50"
                                                    >
                                                        <option value="">Select Category</option>
                                                        {categories.find(h => h._id === formData.header)?.children?.map(c => (
                                                            <option key={c._id} value={c._id}>{c.name}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>
                                            <div className="space-y-1.5 flex flex-col">
                                                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Sub-Category <span className="text-rose-500">*</span></label>
                                                <select
                                                    value={formData.subcategoryId}
                                                    onChange={(e) => setFormData({ ...formData, subcategoryId: e.target.value })}
                                                    disabled={isViewMode || !formData.categoryId}
                                                    className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-xl text-sm font-bold outline-none cursor-pointer disabled:opacity-50"
                                                >
                                                    <option value="">Select Sub-Category</option>
                                                    {categories.find(h => h._id === formData.header)?.children?.find(c => c._id === formData.categoryId)?.children?.map(sc => (
                                                        <option key={sc._id} value={sc._id}>{sc.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                    )}

                                    {modalTab === 'media' && (
                                        <div className="ds-section-spacing animate-in fade-in slide-in-from-right-2 duration-300">
                                            <div className="space-y-3">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Main Cover Photo</label>
                                                <div className="flex flex-col md:flex-row items-start gap-6">
                                                    <div className="w-48 aspect-square rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center group hover:border-primary hover:bg-primary/5 transition-all overflow-hidden relative">
                                                        {!isViewMode && (
                                                            <input
                                                                type="file"
                                                                className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                                                onChange={(e) => handleImageUpload(e, 'main')}
                                                            />
                                                        )}
                                                        {formData.mainImage ? (
                                                            <img src={formData.mainImage} alt="Main Preview" className="w-full h-full object-cover" />
                                                        ) : (
                                                            <div className="flex flex-col items-center">
                                                                <HiOutlinePhoto className="h-10 w-10 text-slate-200" />
                                                                {!isViewMode && <p className="text-[10px] text-slate-400 font-bold mt-2">UPLOAD</p>}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="space-y-3">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Gallery Images</label>
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
                                                        <div className="w-32 aspect-square rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center group hover:border-primary hover:bg-primary/5 transition-all cursor-pointer relative">
                                                            <input
                                                                type="file"
                                                                multiple
                                                                className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                                                onChange={(e) => handleImageUpload(e, 'gallery')}
                                                            />
                                                            <HiOutlinePhoto className="h-8 w-8 text-slate-200" />
                                                            <p className="text-[10px] text-slate-400 font-bold mt-2">ADD MORE</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <p className="text-[10px] text-slate-400 font-medium italic text-center pt-4 border-t border-slate-50 outline-none">
                                                Quick Tip: Multiple photos help users trust your products more!
                                            </p>
                                        </div>
                                    )}

                                    {modalTab === 'medicine' && (
                                        <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-300">
                                            <div className="space-y-6">
                                                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide border-b border-slate-200 pb-2">Medicine Information</h3>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                    <div className="space-y-1.5 flex flex-col">
                                                        <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">Generic Name</label>
                                                        <input type="text" value={formData.pharmacyDetails.genericName} onChange={(e) => setFormData({ ...formData, pharmacyDetails: { ...formData.pharmacyDetails, genericName: e.target.value } })} className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-xl text-sm font-semibold outline-none ring-primary/5 focus:ring-2" placeholder="e.g. Paracetamol" disabled={isViewMode} />
                                                    </div>
                                                    <div className="space-y-1.5 flex flex-col">
                                                        <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">Manufacturer</label>
                                                        <input type="text" value={formData.pharmacyDetails.manufacturer} onChange={(e) => setFormData({ ...formData, pharmacyDetails: { ...formData.pharmacyDetails, manufacturer: e.target.value } })} className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-xl text-sm font-semibold outline-none ring-primary/5 focus:ring-2" placeholder="Manufacturer Name" disabled={isViewMode} />
                                                    </div>
                                                    <div className="space-y-1.5 flex flex-col">
                                                        <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">Composition</label>
                                                        <input type="text" value={formData.pharmacyDetails.composition} onChange={(e) => setFormData({ ...formData, pharmacyDetails: { ...formData.pharmacyDetails, composition: e.target.value } })} className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-xl text-sm font-semibold outline-none ring-primary/5 focus:ring-2" placeholder="Active ingredients" disabled={isViewMode} />
                                                    </div>
                                                    <div className="space-y-1.5 flex flex-col">
                                                        <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">Strength</label>
                                                        <input type="text" value={formData.pharmacyDetails.strength} onChange={(e) => setFormData({ ...formData, pharmacyDetails: { ...formData.pharmacyDetails, strength: e.target.value } })} className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-xl text-sm font-semibold outline-none ring-primary/5 focus:ring-2" placeholder="e.g. 500mg" disabled={isViewMode} />
                                                    </div>
                                                    <div className="space-y-1.5 flex flex-col">
                                                        <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">Dosage Form</label>
                                                        <select
                                                            value={formData.pharmacyDetails.dosageForm}
                                                            onChange={(e) => setFormData({ ...formData, pharmacyDetails: { ...formData.pharmacyDetails, dosageForm: e.target.value } })}
                                                            className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-xl text-sm font-semibold outline-none ring-primary/5 focus:ring-2 cursor-pointer"
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
                                                            className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-xl text-sm font-semibold outline-none ring-primary/5 focus:ring-2 cursor-pointer"
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
                                                            className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-xl text-sm font-semibold outline-none ring-primary/5 focus:ring-2"
                                                            placeholder="e.g. 10"
                                                            disabled={isViewMode}
                                                        />
                                                    </div>
                                                    <div className="space-y-1.5 flex flex-col">
                                                        <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">Unit</label>
                                                        <select
                                                            value={formData.pharmacyDetails.unit}
                                                            onChange={(e) => setFormData({ ...formData, pharmacyDetails: { ...formData.pharmacyDetails, unit: e.target.value } })}
                                                            className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-xl text-sm font-semibold outline-none ring-primary/5 focus:ring-2 cursor-pointer"
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
                                                            className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-xl text-sm font-semibold outline-none ring-primary/5 focus:ring-2 cursor-pointer"
                                                            disabled={isViewMode}
                                                        >
                                                            {PHARMACY_CLASSIFICATION_OPTIONS.map(opt => (
                                                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    <div className="space-y-1.5 flex flex-col">
                                                        <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">Prescription Required</label>
                                                        <select value={formData.pharmacyDetails.prescriptionRequired ? "Yes" : "No"} onChange={(e) => setFormData({ ...formData, pharmacyDetails: { ...formData.pharmacyDetails, prescriptionRequired: e.target.value === "Yes" } })} className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-xl text-sm font-semibold outline-none ring-primary/5 focus:ring-2" disabled={isViewMode}>
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
                                                            className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-xl text-sm font-semibold outline-none ring-primary/5 focus:ring-2"
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
                                                            className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-xl text-sm font-semibold outline-none ring-primary/5 focus:ring-2"
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
                                                            className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-xl text-sm font-semibold outline-none ring-primary/5 focus:ring-2"
                                                            placeholder="Batch Number"
                                                            autoCapitalize="characters"
                                                            disabled={isViewMode}
                                                        />
                                                    </div>
                                                    <div className="space-y-1.5 flex flex-col">
                                                        <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">Manufacturing Date</label>
                                                        <input type="date" value={formData.pharmacyDetails.mfgDate} onChange={(e) => setFormData({ ...formData, pharmacyDetails: { ...formData.pharmacyDetails, mfgDate: e.target.value } })} className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-xl text-sm font-semibold outline-none ring-primary/5 focus:ring-2" disabled={isViewMode} />
                                                    </div>
                                                    <div className="space-y-1.5 flex flex-col">
                                                        <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">Expiry Date</label>
                                                        <input type="date" value={formData.pharmacyDetails.expDate} onChange={(e) => setFormData({ ...formData, pharmacyDetails: { ...formData.pharmacyDetails, expDate: e.target.value } })} className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-xl text-sm font-semibold outline-none ring-primary/5 focus:ring-2" disabled={isViewMode} />
                                                    </div>
                                                    <div className="space-y-1.5 flex flex-col">
                                                        <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">Storage Condition</label>
                                                        <input type="text" value={formData.pharmacyDetails.storageCondition} onChange={(e) => setFormData({ ...formData, pharmacyDetails: { ...formData.pharmacyDetails, storageCondition: e.target.value } })} className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-xl text-sm font-semibold outline-none ring-primary/5 focus:ring-2" placeholder="e.g. Store below 25°C" disabled={isViewMode} />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {modalTab === 'variants' && (
                                        <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-300">
                                            <div className="flex items-center justify-between">
                                                <h4 className="text-sm font-bold">Product Variants</h4>
                                                {!isViewMode && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setFormData({ ...formData, variants: [...formData.variants, { id: Date.now(), name: '', price: '', salePrice: '', stock: '', sku: '' }] })}
                                                        className="bg-primary/10 text-primary px-3 py-1 rounded-lg text-[10px] font-bold"
                                                    >
                                                        + ADD
                                                    </button>
                                                )}
                                            </div>
                                            <div className="space-y-3">
                                                {formData.variants.map((v, i) => (
                                                    <div key={v.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                                                        <input
                                                            value={v.name}
                                                            onChange={e => {
                                                                const news = [...formData.variants];
                                                                news[i].name = e.target.value;
                                                                setFormData({ ...formData, variants: news });
                                                            }}
                                                            placeholder="Name"
                                                            className="bg-white px-3 py-2 rounded-xl text-xs ring-1 ring-slate-100 outline-none"
                                                            disabled={isViewMode}
                                                        />
                                                        <input
                                                            type="number"
                                                            value={v.price}
                                                            onChange={e => {
                                                                const news = [...formData.variants];
                                                                news[i].price = e.target.value;
                                                                setFormData({ ...formData, variants: news });
                                                            }}
                                                            placeholder="Price"
                                                            className="bg-white px-3 py-2 rounded-xl text-xs ring-1 ring-slate-100 outline-none"
                                                            disabled={isViewMode}
                                                        />
                                                        <input
                                                            type="number"
                                                            value={v.stock}
                                                            onChange={e => {
                                                                const news = [...formData.variants];
                                                                news[i].stock = e.target.value;
                                                                setFormData({ ...formData, variants: news });
                                                            }}
                                                            placeholder="Stock"
                                                            className="bg-white px-3 py-2 rounded-xl text-xs ring-1 ring-slate-100 outline-none"
                                                            disabled={isViewMode}
                                                        />
                                                        <div className="flex justify-end">
                                                            {!isViewMode && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setFormData({ ...formData, variants: formData.variants.filter((_, idx) => idx !== i) })}
                                                                    className="text-rose-500 p-2 hover:bg-rose-50 rounded-lg"
                                                                >
                                                                    <HiOutlineTrash className="h-4 w-4" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {modalTab === 'pricing' && (
                                        <div className="space-y-8 animate-in fade-in slide-in-from-right-2 duration-300">
                                            <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-8">
                                                <div className="space-y-1.5 flex flex-col">
                                                    <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">Price (₹)</label>
                                                    <input
                                                        type="number"
                                                        value={formData.price}
                                                        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                                                        className="w-full px-4 py-3 bg-white shadow-sm ring-1 ring-slate-200 border-none rounded-xl text-lg font-bold outline-none focus:ring-2 focus:ring-primary/10"
                                                        disabled={isViewMode}
                                                    />
                                                </div>
                                                <div className="space-y-1.5 flex flex-col">
                                                    <label className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest ml-1">Discounted Price (₹)</label>
                                                    <input
                                                        type="number"
                                                        value={formData.salePrice}
                                                        onChange={(e) => setFormData({ ...formData, salePrice: e.target.value })}
                                                        className="w-full px-4 py-3 bg-emerald-50/50 shadow-sm ring-1 ring-emerald-100 border-none rounded-xl text-lg font-bold text-emerald-700 outline-none focus:ring-2 focus:ring-emerald-200"
                                                        disabled={isViewMode}
                                                    />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-6">
                                                <div className="space-y-1.5 flex flex-col">
                                                    <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">How many in stock</label>
                                                    <input
                                                        type="number"
                                                        value={formData.variants?.length > 0 ? formData.variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0) : formData.stock}
                                                        onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                                                        className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-xl text-sm font-bold outline-none ring-primary/5 focus:ring-2 disabled:opacity-60"
                                                        disabled={isViewMode || formData.variants?.length > 0}
                                                    />
                                                </div>
                                                <div className="space-y-1.5 flex flex-col">
                                                    <label className="text-[9px] font-bold text-rose-500 uppercase tracking-widest ml-1">Low Stock Alert Level</label>
                                                    <input
                                                        type="number"
                                                        value={formData.lowStockAlert}
                                                        onChange={(e) => setFormData({ ...formData, lowStockAlert: e.target.value })}
                                                        className="w-full px-4 py-2.5 bg-rose-50/50 border-none rounded-xl text-sm font-bold text-rose-600 outline-none ring-rose-100 focus:ring-2 focus:ring-rose-200"
                                                        disabled={isViewMode}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Modal Footer */}
                            <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-3">
                                <button
                                    onClick={() => setIsProductModalOpen(false)}
                                    className="px-6 py-2.5 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100 transition-colors"
                                >
                                    CLOSE
                                </button>
                                {!isViewMode && (
                                    <button
                                        onClick={handleSave}
                                        disabled={isSaving}
                                        className="bg-red-600 text-white px-10 py-2.5 rounded-xl text-xs font-bold shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-50"
                                    >
                                        {isSaving ? 'SAVING...' : 'SAVE CHANGES'}
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
            {/* Delete Confirmation Modal */}
            <Modal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                title="Confirm Deletion"
                size="sm"
                footer={
                    <>
                        <button
                            onClick={() => setIsDeleteModalOpen(false)}
                            className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors"
                        >
                            CANCEL
                        </button>
                        <button
                            onClick={confirmDelete}
                            className="px-6 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold shadow-lg shadow-rose-100 hover:bg-rose-700 transition-all active:scale-95"
                        >
                            DELETE PRODUCT
                        </button>
                    </>
                }
            >
                <div className="flex flex-col items-center text-center py-4">
                    <div className="h-16 w-16 bg-rose-50 rounded-full flex items-center justify-center mb-4">
                        <HiOutlineExclamationCircle className="h-10 w-10 text-rose-500" />
                    </div>
                    <h3 className="text-lg font-black text-slate-900 mb-2 uppercase tracking-tight">Delete Product?</h3>
                    <p className="text-sm text-slate-500 font-medium">
                        Are you sure you want to delete <span className="font-bold text-slate-900">"{itemToDelete?.name}"</span>?
                        This action cannot be undone.
                    </p>
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
                            {viewingVariants?.mainImage || viewingVariants?.images?.[0] || viewingVariants?.galleryImages?.[0] ? (
                                <img src={viewingVariants.mainImage || viewingVariants.images?.[0] || viewingVariants.galleryImages?.[0]} alt="" className="h-full w-full object-cover" />
                            ) : (
                                <HiOutlineCube className="h-8 w-8 text-slate-200" />
                            )}
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-slate-900 leading-tight">{viewingVariants?.name}</h3>
                            <div className="flex items-center gap-2 mt-1">
                                <Badge variant="primary" className="text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5">{viewingVariants?.categoryId?.name || 'Category'}</Badge>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Master SKU: {viewingVariants?.sku || viewingVariants?._id?.slice(-6).toUpperCase() || 'N/A'}</span>
                            </div>
                        </div>
                    </div>

                    <div className="overflow-hidden rounded-2xl border border-slate-100 shadow-sm bg-white">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-slate-50/50 border-b border-slate-100">
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Variant Specification</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Unit Price</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Available Stock</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Variant SKU</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {viewingVariants?.variants?.map((v, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50/30 transition-all cursor-default">
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="text-xs font-black text-slate-700 group-hover:text-primary transition-colors">{v.name}</span>
                                                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Variation {idx + 1}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex flex-col items-center">
                                                <span className={cn("text-xs font-bold", v.salePrice > 0 ? "text-slate-400 line-through scale-90" : "text-slate-900")}>₹{v.price}</span>
                                                {v.salePrice > 0 && <span className="text-xs font-bold text-emerald-600">₹{v.salePrice}</span>}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <Badge variant={v.stock === 0 ? "rose" : v.stock <= 10 ? "amber" : "emerald"} className="text-[10px] font-black uppercase tracking-widest px-2 shadow-sm">
                                                {v.stock === 0 ? 'OUT OF STOCK' : `${v.stock} UNITS`}
                                            </Badge>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="text-[10px] font-bold text-slate-400 font-mono tracking-tighter uppercase bg-slate-100 px-2 py-1 rounded-lg">
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
                            className="bg-red-600 text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:-translate-y-0.5 transition-all active:scale-95"
                        >
                            CLOSE VIEWER
                        </button>
                    </div>
                </div>
            </Modal>

        </div>
    );
};

export default ProductManagement;
