
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useToast } from '@shared/components/ui/Toast';
import { cn } from '@/lib/utils';
import ProductCard from '../components/shared/ProductCard';
import PharmacyProductCard from '../components/pharmacy/PharmacyProductCard';
import { PharmacyEmptyState } from '../components/pharmacy/PharmacyEmptyState';
import {
    resolveHeaderFromCategoryTree,
    isPharmacyHeaderContext,
} from '../components/pharmacy/pharmacyProductMeta';
import ProductDetailSheet from '../components/shared/ProductDetailSheet';
import { useProductDetail } from '../context/ProductDetailContext';
import { customerApi } from '../services/customerApi';
import MiniCart from '../components/shared/MiniCart';
import SectionRenderer from "../components/experience/SectionRenderer";
import { useLocation as useAppLocation } from '../context/LocationContext';

const QUICK_THEME_STORAGE_KEY = "food.quick.headerColor";
const QUICK_HEADER_RETURN_STORAGE_KEY = "food.quick.headerReturn";
const FALLBACK_HEADER_COLOR = "#FF0000";

// Sidebar button extracted to avoid re-rendering entire sidebar
// when only the selected subcategory changes
const SubCategoryButton = React.memo(function SubCategoryButton({ cat, isSelected, onSelect }) {
    return (
        <button
            onClick={() => onSelect(cat.id)}
            className={cn(
                "flex flex-col items-center py-4 px-1 gap-2 transition-all relative border-l-4",
                isSelected
                    ? "bg-[#F7FCF5] dark:bg-emerald-950/20 border-[#0c831f]"
                    : "border-transparent hover:bg-gray-50 dark:hover:bg-white/5",
            )}
        >
            <div className={cn(
                "w-12 h-12 rounded-2xl flex items-center justify-center p-2 transition-all duration-300",
                isSelected ? "scale-110" : "grayscale opacity-70",
            )}>
                <img src={cat.icon} alt={cat.name} loading="lazy" className="w-full h-full object-contain" />
            </div>
            <span className={cn(
                "text-[10px] text-center font-bold font-sans leading-tight px-1",
                isSelected ? "text-[#0c831f]" : "text-gray-500",
            )}>
                {cat.name}
            </span>
        </button>
    );
});

const CategoryProductsPage = () => {
    const { categoryId: catId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const { currentLocation } = useAppLocation();
    const initialSubcategoryId = location.state?.activeSubcategoryId || 'all';
    const { isOpen: isProductDetailOpen } = useProductDetail();
    const [selectedSubCategory, setSelectedSubCategory] = useState(initialSubcategoryId);
    const [category, setCategory] = useState(null);
    const [subCategories, setSubCategories] = useState([{
        id: 'all', name: 'All',
        icon: 'https://cdn-icons-png.flaticon.com/128/2321/2321831.png',
    }]);
    const [products, setProducts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [headerTheme, setHeaderTheme] = useState(FALLBACK_HEADER_COLOR);
    const [experienceSections, setExperienceSections] = useState([]);
    const [heroConfig, setHeroConfig] = useState(null);
    const [categoryMap, setCategoryMap] = useState({});
    const [subcategoryMap, setSubcategoryMap] = useState({});
    const [categoryFullMap, setCategoryFullMap] = useState({});

    useEffect(() => {
        // Force header color to red consistently across all pages
        setHeaderTheme("#FF0000");
    }, []);

    // useCallback so the effect dep array is stable across renders
    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const hasValidLocation =
                Number.isFinite(currentLocation?.latitude) &&
                Number.isFinite(currentLocation?.longitude);

            const [prodRes, catRes, expRes, heroRes] = await Promise.all([
                hasValidLocation
                    ? customerApi.getProducts({ categoryId: catId, lat: currentLocation.latitude, lng: currentLocation.longitude })
                    : Promise.resolve({ data: { success: true, result: { items: [] } } }),
                customerApi.getCategories({ tree: true }),
                customerApi.getExperienceSections({ pageType: 'header', headerId: catId }).catch(() => null),
                customerApi.getHeroConfig({ pageType: 'header', headerId: catId }).catch(() => null),
            ]);

            if (prodRes.data.success) {
                const rawResult = prodRes.data.result;
                const dbProds = Array.isArray(prodRes.data.results)
                    ? prodRes.data.results
                    : Array.isArray(rawResult?.items) ? rawResult.items
                        : Array.isArray(rawResult) ? rawResult : [];
                setProducts(dbProds.map((p) => ({
                    ...p, id: p._id,
                    image: p.mainImage || p.image || "https://images.unsplash.com/photo-1550989460-0adf9ea622e2",
                    price: p.salePrice || p.price, originalPrice: p.price,
                    weight: p.weight || "1 unit", deliveryTime: "8-15 mins",
                })));
            }

            if (catRes.data.success) {
                const results = catRes.data.results || catRes.data.result || [];
                const allCats = Array.isArray(results) ? results : [];
                const cMap = {}, sMap = {}, fullMap = {};
                const flatten = (items) => {
                    items.forEach((item) => {
                        fullMap[item._id] = item;
                        if (item.type === 'category') cMap[item._id] = item;
                        else if (item.type === 'subcategory') sMap[item._id] = item;
                        if (item.children?.length > 0) flatten(item.children);
                    });
                };
                flatten(allCats);
                setCategoryMap(cMap);
                setSubcategoryMap(sMap);
                setCategoryFullMap(fullMap);

                const currentCat = fullMap[catId];
                if (currentCat) {
                    setCategory(currentCat);
                    let subs = [], isDirectSub = false;
                    if (currentCat.children?.length > 0) {
                        subs = currentCat.children;
                    } else if (currentCat.parentId) {
                        const parent = fullMap[currentCat.parentId?._id || currentCat.parentId];
                        if (parent?.children) subs = parent.children;
                        isDirectSub = true;
                    }
                    const formattedSubs = subs.map((s) => ({
                        id: s._id, name: s.name,
                        icon: s.image || 'https://cdn-icons-png.flaticon.com/128/2321/2321801.png',
                    }));
                    setSubCategories([{ id: 'all', name: 'All', icon: 'https://cdn-icons-png.flaticon.com/128/2321/2321831.png' }, ...formattedSubs]);
                    if (isDirectSub && selectedSubCategory === 'all' && !location.state?.activeSubcategoryId) {
                        setSelectedSubCategory(currentCat._id);
                    }
                }
            }

            if (expRes?.data?.success) setExperienceSections(expRes.data.result || expRes.data.results || []);
            if (heroRes?.data?.success) setHeroConfig(heroRes.data.result);
        } catch (error) {
            console.error("Error fetching category data:", error);
        } finally {
            setIsLoading(false);
        }
    }, [catId, currentLocation?.latitude, currentLocation?.longitude, location.state?.activeSubcategoryId]);
    // ↑ Using specific lat/lng instead of the whole currentLocation object —
    //   prevents refetch when only city/state change (which don't affect product results)

    useEffect(() => {
        fetchData();
        setSelectedSubCategory(location.state?.activeSubcategoryId || 'all');
    }, [fetchData]);

    const safeProducts = Array.isArray(products) ? products : [];

    // useMemo: filteredProducts was recomputed on every render (tip change, modal open, etc.)
    const filteredProducts = useMemo(
        () => safeProducts.filter(
            (p) => selectedSubCategory === 'all' ||
                p.subcategoryId?._id === selectedSubCategory ||
                p.subcategoryId === selectedSubCategory,
        ),
        [safeProducts, selectedSubCategory],
    );

    const productsById = useMemo(() => {
        const map = {};
        safeProducts.forEach((p) => { map[p._id || p.id] = p; });
        return map;
    }, [safeProducts]);

    // Memoize the filtered sections to avoid recomputation on every render
    const mainExperienceSections = useMemo(
        () => experienceSections.filter((s) => (s.title || '').trim().toLowerCase() !== 'best sellers'),
        [experienceSections],
    );

    const isPharmacyMode = useMemo(() => {
        const headerNode = resolveHeaderFromCategoryTree(catId, categoryFullMap);
        return isPharmacyHeaderContext(headerNode);
    }, [catId, categoryFullMap]);

    return (
        <div className="flex min-h-screen flex-col bg-white dark:bg-background font-sans pt-0 transition-colors duration-500">
            <div className="mx-auto flex w-full max-w-[1920px] flex-1 flex-col">
                <header
                    className={cn(
                        "sticky top-0 z-30 px-4 py-4 flex items-center justify-between border-b border-white/20 shadow-[0_10px_30px_rgba(15,23,42,0.12)] backdrop-blur-md",
                        isProductDetailOpen && "hidden md:flex",
                    )}
                    style={{ backgroundImage: `linear-gradient(180deg, ${headerTheme} 0%, ${headerTheme}F2 100%)` }}
                >
                    <div className="flex items-center gap-3">
                        <button onClick={() => navigate(-1)} className="p-1 hover:bg-white/15 rounded-full transition-colors">
                            <ChevronLeft size={24} className="text-white" />
                        </button>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase tracking-[0.24em] text-white/75">
                                {isPharmacyMode ? 'Pharmacy' : 'Quick Category'}
                            </span>
                            <h1 className="text-[18px] font-bold text-white tracking-tight">{category?.name || catId}</h1>
                        </div>
                    </div>
                </header>

                <div className="flex flex-1 relative items-start">
                    <aside className="w-20 md:w-28 border-r border-gray-50 dark:border-white/5 flex flex-col bg-white dark:bg-card overflow-y-auto hide-scrollbar sticky top-0 h-screen pb-32 transition-colors">
                        {subCategories.map((cat) => (
                            <SubCategoryButton
                                key={cat.id}
                                cat={cat}
                                isSelected={selectedSubCategory === cat.id}
                                onSelect={setSelectedSubCategory}
                            />
                        ))}
                    </aside>

                    <main className="flex-1 px-3 pt-1 pb-24 bg-white dark:bg-background transition-colors">
                        {selectedSubCategory === 'all' && mainExperienceSections.length > 0 && (
                            <div className="mb-4">
                                <SectionRenderer
                                    sections={mainExperienceSections}
                                    productsById={productsById}
                                    categoriesById={categoryMap}
                                    subcategoriesById={subcategoryMap}
                                />
                            </div>
                        )}
                        <div className={cn(
                            "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-2 gap-y-4 md:gap-4 lg:gap-6",
                            isPharmacyMode && "sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4",
                        )}>
                            {filteredProducts.map((product) => (
                                isPharmacyMode ? (
                                    <PharmacyProductCard key={product.id} product={product} compact={true} />
                                ) : (
                                    <ProductCard key={product.id} product={product} compact={true} />
                                )
                            ))}
                            {filteredProducts.length === 0 && !isLoading && (
                                <div className="col-span-full py-10 md:py-20 text-center flex justify-center w-full">
                                    {isPharmacyMode ? (
                                        <PharmacyEmptyState variant="products" className="py-6 w-full" />
                                    ) : (
                                        <p className="text-slate-400 font-black italic md:text-xl w-full">No products found in this category</p>
                                    )}
                                </div>
                            )}
                        </div>
                    </main>
                </div>

                <MiniCart />
                <ProductDetailSheet />
            </div>
            <style dangerouslySetInnerHTML={{ __html: `@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap');body{font-family:'Outfit',sans-serif}.hide-scrollbar::-webkit-scrollbar{display:none}.hide-scrollbar{-ms-overflow-style:none;scrollbar-width:none}` }} />
        </div>
    );
};

export default CategoryProductsPage;
