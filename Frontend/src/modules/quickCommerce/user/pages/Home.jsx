import React, { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback, startTransition } from 'react';
import { useNavigate, useLocation as useRouterLocation } from 'react-router-dom';
import {
  Star,
  ChevronDown,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  Heart,
  Snowflake,
  Dog,
} from 'lucide-react';

// MUI Icons
import HomeIcon from '@mui/icons-material/Home';
import DevicesIcon from '@mui/icons-material/Devices';
import LocalGroceryStoreIcon from '@mui/icons-material/LocalGroceryStore';
import KitchenIcon from '@mui/icons-material/Kitchen';
import ChildCareIcon from '@mui/icons-material/ChildCare';
import PetsIcon from '@mui/icons-material/Pets';
import SportsSoccerIcon from '@mui/icons-material/SportsSoccer';
import CardGiftcardIcon from '@mui/icons-material/CardGiftcard';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import SpaIcon from '@mui/icons-material/Spa';
import ToysIcon from '@mui/icons-material/Toys';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import YardIcon from '@mui/icons-material/Yard';
import BusinessCenterIcon from '@mui/icons-material/BusinessCenter';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import CheckroomIcon from '@mui/icons-material/Checkroom';
import LocalCafeIcon from '@mui/icons-material/LocalCafe';
import DiamondIcon from '@mui/icons-material/Diamond';
import ColorLensIcon from '@mui/icons-material/ColorLens';
import BuildIcon from '@mui/icons-material/Build';
import LuggageIcon from '@mui/icons-material/Luggage';
import ArrowRightIcon from '@mui/icons-material/ArrowForwardIos';
import VerifiedIcon from '@mui/icons-material/Verified';

import { motion, useScroll, useTransform } from 'framer-motion';
import { customerApi } from '../services/customerApi';
import { toast } from 'sonner';
import ProductCard from '../components/shared/ProductCard';
import PharmacyProductCard from '../components/pharmacy/PharmacyProductCard';
import MainLocationHeader from '../components/shared/MainLocationHeader';
import MiniCart from '../components/shared/MiniCart';
import ProductDetailSheet from '../components/shared/ProductDetailSheet';
import Footer from '../components/layout/Footer';
import BottomNav from '../components/layout/BottomNav';
import MobileFooterMessage from '../components/layout/MobileFooterMessage';
import { useProductDetail } from '../context/ProductDetailContext';
import { cn } from '@/lib/utils';
import { Skeleton } from '@food/components/ui/skeleton';
import CardBanner from '@/assets/CardBanner.jpg';
import SectionRenderer from '../components/experience/SectionRenderer';
import ExperienceBannerCarousel from '../components/experience/ExperienceBannerCarousel';
import { useLocation } from '../context/LocationContext';
import { resolveQuickImageUrl } from '../utils/image';
import { getCloudinarySrcSet } from '@/shared/utils/cloudinaryUtils';
import { useQuickHomeData } from '../hooks/useQuickHomeData';
import { PharmacyEmptyState } from '../components/pharmacy/PharmacyEmptyState';
import {
  getSideImageByKey,
  getBackgroundColorByValue,
  getBackgroundGradientByValue,
} from '@/shared/constants/offerSectionOptions';
import {
  getQuickCartPath,
  getQuickCategoriesPath,
  getQuickCategoryPath,
} from '../utils/routes';

// ─── Static constants (outside component) ────────────────────────────────────

const DEFAULT_CATEGORY_THEME = {
  gradient: 'linear-gradient(to bottom, #F7C332, #F7E08F)',
  shadow: 'shadow-yellow-500/20',
  accent: 'text-[#1A1A1A]',
};

const ALL_CATEGORY = {
  id: 'all', _id: 'all', name: 'All', icon: HomeIcon,
  theme: DEFAULT_CATEGORY_THEME, headerColor: '#ffdb3a',
  banner: { title: 'HOUSEFULL', subtitle: 'SALE', floatingElements: 'sparkles', textColor: 'text-black' },
};

const MARQUEE_MESSAGES = ['24/7 Delivery', 'Minimum Order ₹99', 'Save Big on Essentials!'];

const quickCategoryPalettes = [
  { bgFrom: '#ffd96a', bgVia: '#ffeaa0', bgTo: '#fff0c7', glowColor: 'rgba(255,184,0,0.18)', frameColor: '#f0d98a' },
  { bgFrom: '#9fe88c', bgVia: '#c3f1b2', bgTo: '#e4f8da', glowColor: 'rgba(126,220,141,0.18)', frameColor: '#bfe3b7' },
  { bgFrom: '#f3a25d', bgVia: '#f9c48b', bgTo: '#fee0bf', glowColor: 'rgba(255,139,61,0.16)', frameColor: '#efc08e' },
  { bgFrom: '#b8eff0', bgVia: '#d5f7f5', bgTo: '#edfdfc', glowColor: 'rgba(122,215,215,0.16)', frameColor: '#b9e5e3' },
];

const QUICK_THEME_STORAGE_KEY = 'food.quick.headerColor';
const QUICK_HEADER_RETURN_STORAGE_KEY = 'food.quick.headerReturn';

// Floating elements — purely visual, rendered at call-site, no state
const getQuickCategoryImage = (category = {}) => {
  const candidate =
    category?.image ||
    category?.icon ||
    category?.thumbnail ||
    category?.imageUrl ||
    category?.iconUrl ||
    category?.media?.image ||
    category?.media?.url ||
    '';
  return resolveQuickImageUrl(candidate) || 'https://cdn-icons-png.flaticon.com/128/2321/2321831.png';
};

// ─── Loading skeleton ─────────────────────────────────────────────────────────

const QuickHomeLoadingState = React.memo(({ embedded }) => (
  <div className={cn('pb-8', embedded ? 'pt-0' : 'pt-4 md:pt-6')}>
    <div className="block md:hidden">
      <Skeleton className="h-[190px] w-full rounded-none" />
    </div>
    <div className="px-4 py-4 md:px-8 lg:px-[50px]">
      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex min-w-[84px] flex-col items-center gap-2 md:min-w-[112px]">
            <Skeleton className="h-[96px] w-[84px] rounded-[22px] md:h-[126px] md:w-[112px]" />
            <Skeleton className="h-3 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </div>
    <div className="px-4 pb-4 md:px-8 lg:px-[50px]">
      <div className="rounded-[28px] border border-[#0c831f]/10 bg-white/80 dark:bg-card/80 p-4 shadow-[0_10px_30px_rgba(15,23,42,0.06)] md:p-6">
        <div className="mb-5 flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-4 w-28 rounded-full" />
            <Skeleton className="h-8 w-52 rounded-full" />
          </div>
          <Skeleton className="h-10 w-24 rounded-full" />
        </div>
        <div className="flex gap-3 overflow-hidden md:gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="w-[140px] shrink-0 space-y-3">
              <Skeleton className="h-[132px] w-full rounded-[20px]" />
              <Skeleton className="h-3 w-5/6 rounded-full" />
              <Skeleton className="h-3 w-2/3 rounded-full" />
              <Skeleton className="h-8 w-full rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
));
QuickHomeLoadingState.displayName = 'QuickHomeLoadingState';

// ─── Floating particles (memoized, recreated only on `type` change) ───────────

const FloatingElements = React.memo(({ type }) => {
  const COUNT = 10;
  const particles = useMemo(() => {
    const getContent = (i) => {
      switch (type) {
        case 'hearts': return <Heart fill="white" size={12 + (i % 5) * 2} className="drop-shadow-sm" />;
        case 'snow': return <Snowflake fill="white" size={10 + (i % 4) * 3} className="drop-shadow-sm" />;
        case 'stars':
        case 'sparkles': return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="white" className="drop-shadow-md">
            <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" />
          </svg>
        );
        default: return (
          <div className="bg-white/40 rounded-full blur-[1px]" style={{ width: 4 + (i % 3) * 3, height: 4 + (i % 3) * 3 }} />
        );
      }
    };
    return Array.from({ length: COUNT }, (_, i) => {
      const duration = 15 + Math.random() * 20;
      const delay = Math.random() * -20;
      const depth = 0.5 + Math.random() * 0.5;
      return {
        i,
        style: { left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`, opacity: 0.1 * depth, zIndex: Math.floor(depth * 10) },
        animate: { x: [0, 50, -50, 0], y: [0, -100, -50, 0], rotate: [0, 360], scale: [depth, depth * 1.2, depth] },
        transition: { duration: duration / depth, repeat: Infinity, ease: 'easeInOut', delay },
        content: getContent(i),
      };
    });
  }, [type]);

  return (
    <>
      {particles.map(({ i, style, animate, transition, content }) => (
        <motion.div
          key={i}
          className="absolute pointer-events-none"
          style={{ ...style, willChange: 'transform' }}
          animate={animate}
          transition={transition}
        >
          <div className="transform-gpu">{content}</div>
        </motion.div>
      ))}
    </>
  );
});
FloatingElements.displayName = 'FloatingElements';

// ─── Main Home component ──────────────────────────────────────────────────────

const Home = ({ embedded = false, onThemeChange, embeddedHeaderColor = null }) => {
  const { scrollY } = useScroll();
  const { isOpen: isProductDetailOpen } = useProductDetail();
  const { currentLocation } = useLocation();
  const navigate = useNavigate();
  const locationRouter = useRouterLocation();
  const routePathname = typeof window !== 'undefined' ? window.location.pathname : '';
  const quickCatsRef = useRef(null);

  const {
    categories,
    activeCategory,
    setActiveCategory,
    products,
    categoryProducts,
    quickCategories,
    experienceSections,
    offerSections,
    categoryMap,
    subcategoryMap,
    headerSections,
    heroConfig,
    isLoading,
    isBootstrapped,
  } = useQuickHomeData({ currentLocation });

  const [mobileBannerIndex, setMobileBannerIndex] = useState(0);
  const [isInstantBannerJump, setIsInstantBannerJump] = useState(false);
  const [pendingReturn, setPendingReturn] = useState(null);

  useLayoutEffect(() => {
    if (!embedded || typeof window === 'undefined') return;
    window.scrollTo(0, 0);
  }, [embedded, routePathname]);

  // ── Handle external category selection (e.g., from BottomNav) ─────────────
  useEffect(() => {
    if (locationRouter.state?.categoryToSelect && categories.length > 1) {
      const targetCatId = locationRouter.state.categoryToSelect;
      let cat = categoryMap[targetCatId];
      
      // If not in categoryMap, try finding it in quickCategories (header rail categories)
      if (!cat) {
        cat = quickCategories.find(c => c.id === targetCatId || c._id === targetCatId || c.name?.toLowerCase() === targetCatId.toLowerCase());
      }

      // Special case: BottomNav can pass a header slug like "pharmacy"
      if (!cat && typeof targetCatId === 'string') {
        const slug = targetCatId.toLowerCase().trim();
        const headerMatch = categories.find((h) => {
          const hSlug = String(h?.slug || '').toLowerCase();
          const hName = String(h?.name || '').toLowerCase();
          return hSlug === slug || hName === slug;
        });
        if (headerMatch) cat = headerMatch;
      }
      
      if (cat) {
        if (typeof window !== 'undefined') {
          // Ensure navigation feels like it opens "from top"
          window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        }
        setActiveCategory(cat);
        
        // Also trigger theme change so header color updates immediately
        if (typeof onThemeChange === 'function') {
          const resolvedColor = cat?.headerColor || '#FF0000';
          if (typeof window !== 'undefined') {
            window.sessionStorage.setItem('food.quick.theme', resolvedColor);
            window.dispatchEvent(new Event('quickThemeChange'));
          }
          onThemeChange({ name: cat?.name || 'All', color: resolvedColor });
        }

        // Clear the state after selection to prevent it from re-triggering on reload
        navigate(locationRouter.pathname, { replace: true, state: {} });
      }
    }
  }, [locationRouter.state, categoryMap, quickCategories, categories, setActiveCategory, navigate, locationRouter.pathname, onThemeChange]);

  // ── Stable callbacks ───────────────────────────────────────────────────────
  const scrollQuickCats = useCallback((direction) => {
    quickCatsRef.current?.scrollBy({
      left: direction === 'left' ? -300 : 300,
      behavior: 'smooth',
    });
  }, []);

  const scrollLeft = useCallback(() => scrollQuickCats('left'), [scrollQuickCats]);
  const scrollRight = useCallback(() => scrollQuickCats('right'), [scrollQuickCats]);

  const navigateToCategories = useCallback(() => navigate(getQuickCategoriesPath()), [navigate]);

  // ── Theme change — only when activeCategory changes (fallback) ───────────
  useEffect(() => {
    const resolvedColor = activeCategory?.headerColor || '#FF0000';
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(QUICK_THEME_STORAGE_KEY, resolvedColor);
      window.dispatchEvent(new Event('quickThemeChange'));
      // Used by BottomNav to highlight Pharmacy tab correctly.
      window.sessionStorage.setItem('quick.activeHeaderSlug', String(activeCategory?.slug || activeCategory?.name || '').toLowerCase());
      window.dispatchEvent(new Event('quickActiveHeaderChange'));
    }
    
    if (typeof onThemeChange === 'function') {
      onThemeChange({ name: activeCategory?.name || 'All', color: resolvedColor });
    }
    // We specifically omit onThemeChange to prevent infinite loops, and only run when activeCategory changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategory]);

  // ── Derived flags ──────────────────────────────────────────────────────────
  // With progressive loading: isBootstrapped = true as soon as categories arrive.
  // Products/sections load in background — don't block the whole page for them.
  const isInitialPageLoading = !isBootstrapped;
  const hasHeroBanners = (heroConfig.banners?.items || []).length > 0;
  const shouldShowHeroFallback = !isInitialPageLoading && !hasHeroBanners;

  // ── Mobile banner autoplay ─────────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      startTransition(() => {
        setMobileBannerIndex((prev) => (prev >= 2 ? prev : prev + 1));
      });
    }, 3500);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!isInstantBannerJump) return;
    const id = requestAnimationFrame(() => setIsInstantBannerJump(false));
    return () => cancelAnimationFrame(id);
  }, [isInstantBannerJump]);

  const handleBannerTransitionEnd = useCallback(() => {
    if (mobileBannerIndex === 2) {
      setIsInstantBannerJump(true);
      setMobileBannerIndex(0);
    }
  }, [mobileBannerIndex]);

  // ── Derived lists (heavy computation, memoized) ────────────────────────────
  const productsById = useMemo(() => {
    const map = {};
    products.forEach((p) => { map[p._id || p.id] = p; });
    return map;
  }, [products]);

  const effectiveQuickCategories = useMemo(() => {
    const ids = heroConfig.categoryIds || [];
    let cats = quickCategories;
    if (ids.length > 0) {
      const resolved = ids
        .map((id) => categoryMap[id])
        .filter(Boolean)
        .map((c) => ({ id: c._id, name: c.name, image: getQuickCategoryImage(c) }));
      if (resolved.length > 0) cats = resolved;
    }
    const isPharmacyModeTemp = String(activeCategory?.slug || '').toLowerCase() === 'pharmacy';
    if (isPharmacyModeTemp) {
      return cats.filter(cat => {
        const mappedCat = categoryMap[cat.id || cat._id];
        if (!mappedCat) return false;
        const parentHeaderId = mappedCat.parentId || mappedCat.headerId || mappedCat.parent?._id || mappedCat.header?._id;
        return String(parentHeaderId) === String(activeCategory?._id) || String(mappedCat._id) === String(activeCategory?._id);
      });
    }
    return cats;
  }, [heroConfig.categoryIds, categoryMap, quickCategories, activeCategory]);

  const filteredProducts = useMemo(() => {
    const activeCatId = activeCategory?._id || activeCategory?.id;
    if (!activeCatId || activeCatId === 'all') return products;
    if (categoryProducts !== null) return categoryProducts;
    return products.filter((p) => {
      const productCatId = p.categoryId?._id || p.categoryId || p.category?._id || p.category;
      if (!productCatId) return false;
      const cat = categoryMap[String(productCatId)];
      if (!cat) return false;
      const parentHeaderId = cat.parentId || cat.headerId || cat.parent?._id || cat.header?._id;
      return String(parentHeaderId) === String(activeCatId) || String(productCatId) === String(activeCatId);
    });
  }, [products, categoryProducts, activeCategory, categoryMap]);

  const isPharmacyMode =
    String(activeCategory?.slug || '').toLowerCase() === 'pharmacy' ||
    String(activeCategory?.name || '').toLowerCase() === 'pharmacy';

  const hasAnyPharmacyData = isPharmacyMode && filteredProducts.length > 0;

  const sectionsForRenderer = headerSections.length 
    ? headerSections 
    : (isPharmacyMode ? [] : experienceSections);

  const hasRenderableExperience = useMemo(
    () =>
      sectionsForRenderer.some((section) => {
        const banners =
          (section.config?.banners?.items || section.config?.items || []).length;

        const categories =
          (section.config?.categories?.items || []).length;

        const subcategories =
          (section.config?.subcategories?.items || []).length;

        const products =
          (section.config?.products?.items || []).length;

        return (
          banners > 0 ||
          categories > 0 ||
          subcategories > 0 ||
          products > 0
        );
      }),
    [sectionsForRenderer],
  );

  // ── Scroll parallax transforms ─────────────────────────────────────────────
  const opacity = useTransform(scrollY, [0, 300], [1, 0.6]);
  const y = useTransform(scrollY, [0, 300], [0, 80]);
  const scale = useTransform(scrollY, [0, 300], [1, 0.95]);
  const pointerEvents = useTransform(scrollY, [0, 100], ['auto', 'none']);

  // ── Scroll-to-section after category switch ────────────────────────────────
  useEffect(() => {
    if (!pendingReturn?.sectionId) return;
    const allSections = sectionsForRenderer;
    if (!allSections.length) return;

    const targetSectionId =
      pendingReturn.sectionId === '__auto__'
        ? (allSections.find((s) => s?.displayType === 'categories')?._id || allSections[0]?._id)
        : pendingReturn.sectionId;

    if (!targetSectionId || !allSections.some((s) => s._id === targetSectionId)) return;

    const el = document.getElementById(`section-${targetSectionId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'instant', block: 'start' });
      window.sessionStorage.removeItem('experienceReturn');
      setPendingReturn(null);
    }
  }, [sectionsForRenderer, pendingReturn]);

  // ── Offer sections filter (memoized — this was running on every render) ───
  const visibleOfferSections = useMemo(() => {
    const activeCatId = activeCategory?._id || activeCategory?.id;
    return [...offerSections]
      .filter((section) => {
        if ((section.title || '').trim().toLowerCase() === 'best sellers') return false;
        if (!activeCatId || activeCatId === 'all') return true;
        const sectionCatIds = (section.categoryIds || []).map((c) =>
          typeof c === 'object' ? String(c._id || c.id || '') : String(c),
        );
        if (sectionCatIds.length === 0) return true;
        return sectionCatIds.some((id) => {
          if (id === String(activeCatId)) return true;
          const cat = categoryMap[id];
          const parentHeaderId = cat?.parentId || cat?.headerId || cat?.parent?._id || cat?.header?._id;
          return String(parentHeaderId) === String(activeCatId);
        });
      })
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [offerSections, activeCategory, categoryMap]);

  // ── Category card click handler (stable) ──────────────────────────────────
  const handleCategoryClick = useCallback(
    (cat) => {
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(
          QUICK_HEADER_RETURN_STORAGE_KEY,
          JSON.stringify({
            headerId: activeCategory?._id || activeCategory?.id || ALL_CATEGORY._id,
            color: '#FF0000',
            name: activeCategory?.name || ALL_CATEGORY.name,
          }),
        );
      }
      navigate(getQuickCategoryPath(cat.id));
    },
    [navigate, activeCategory],
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className={cn(
      'bg-[#F5F7F8] dark:bg-background',
      embedded ? 'min-h-0 bg-white dark:bg-card pt-0' : 'min-h-screen pt-[176px] md:pt-[210px]',
    )}>
      <div className={cn('contents', isProductDetailOpen && 'hidden md:contents')}>
        <MainLocationHeader
          categories={categories}
          activeCategory={activeCategory}
          onCategorySelect={(cat) => {
            setActiveCategory(cat);
            if (typeof onThemeChange === 'function') {
              const resolvedColor = cat?.headerColor || '#FF0000';
              if (typeof window !== 'undefined') {
                window.sessionStorage.setItem(QUICK_THEME_STORAGE_KEY, resolvedColor);
                window.dispatchEvent(new Event('quickThemeChange'));
              }
              onThemeChange({ name: cat?.name || 'All', color: resolvedColor });
            }
          }}
          embedded={embedded}
          embeddedHeaderColor={embeddedHeaderColor}
          showTopContent={!embedded}
          showSearchBar={!embedded}
        />
      </div>

      {isInitialPageLoading ? (
        <QuickHomeLoadingState embedded={embedded} />
      ) : (
        <div className={cn('pt-0', embedded && 'pt-0')}>

          {/* Hero Banners (mobile) */}
          <div className={cn('block md:hidden', embedded ? '-mt-[1px]' : 'mt-0')}>
            <div className="relative w-full overflow-hidden bg-transparent">
              {hasHeroBanners ? (
                <div className="px-3 py-2">
                  <ExperienceBannerCarousel
                    section={{ title: '' }}
                    items={heroConfig.banners.items}
                  />
                </div>
              ) : isPharmacyMode ? (
                <div className="px-3 py-2">
                  <div className="w-full h-[174px] bg-gradient-to-r from-teal-50 to-emerald-50 p-6 relative overflow-hidden flex items-center shadow-md rounded-[20px] border border-teal-100">
                    <div className="relative z-10 w-[60%] flex flex-col items-start justify-center gap-1">
                      <h4 className="text-[28px] sm:text-[32px] font-[900] text-teal-900 tracking-tight leading-none">Your Health</h4>
                      <h4 className="text-[28px] sm:text-[32px] font-[900] text-teal-700 tracking-tighter italic leading-none">Delivered</h4>
                      <p className="text-[12px] sm:text-[13px] font-medium text-teal-800 mt-2 mb-2 leading-tight">Get essential medicines and healthcare products.</p>
                    </div>
                  </div>
                </div>
              ) : shouldShowHeroFallback ? (
                <>
                <div
                  className={cn('flex', !isInstantBannerJump && 'transition-transform duration-500 ease-out')}
                  style={{ transform: `translateX(-${mobileBannerIndex * 100}%)` }}
                  onTransitionEnd={handleBannerTransitionEnd}
                >
                  {/* Slide 1 */}
                  <motion.div onClick={navigateToCategories} whileTap={{ scale: 0.96 }} className="min-w-full px-3 py-2">
                    <div className="w-full h-[174px] bg-[#B05212] p-4 relative overflow-hidden flex items-center shadow-md rounded-[20px]">
                      {/* Faint dashed lines background */}
                      <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20" preserveAspectRatio="none" viewBox="0 0 100 100">
                        <path d="M -10 40 Q 30 -20 60 40 T 130 40" fill="none" stroke="white" strokeWidth="1" strokeDasharray="3 3" />
                        <path d="M -20 70 Q 20 120 70 60 T 140 70" fill="none" stroke="white" strokeWidth="1" strokeDasharray="3 3" />
                      </svg>
                      
                      <div className="relative z-10 w-[55%] flex flex-col items-start justify-center gap-1 pl-2">
                        <div className="flex flex-col leading-[1.05]">
                          <h4 className="text-[32px] sm:text-[36px] font-[1000] text-white tracking-tight">Fastest</h4>
                          <h4 className="text-[32px] sm:text-[36px] font-[1000] text-[#FFD6B3] tracking-tighter italic">Groceries</h4>
                        </div>
                        <p className="text-[12px] sm:text-[13px] font-medium text-white/95 mt-1 mb-2">Get it all in 10 minutes or less.</p>
                        <button className="bg-white text-[#B05212] px-5 py-2 rounded-full font-bold text-[13px] tracking-wide shadow-md hover:bg-gray-50 active:scale-95 transition-all">
                          Shop Now
                        </button>
                      </div>
                      
                      <div className="absolute right-0 bottom-0 top-0 w-[45%] flex items-center justify-end overflow-hidden">
                        <div className="h-full w-full bg-red-100 rounded-l-[16px] overflow-hidden shadow-[-4px_0_15px_rgba(0,0,0,0.15)] relative">
                          <img src={CardBanner} alt="Promo" className="w-full h-full object-cover object-left" loading="lazy" />
                          <div className="absolute inset-0 bg-gradient-to-r from-[#B05212]/20 to-transparent pointer-events-none" />
                        </div>
                      </div>
                    </div>
                  </motion.div>

                  {/* Slide 2 */}
                  <motion.div onClick={() => navigate('/categories')} whileTap={{ scale: 0.96 }} className="min-w-full px-3 py-2">
                    <div className="w-full h-[174px] bg-white dark:bg-card relative overflow-hidden flex shadow-md rounded-[20px] group">
                      <img src={CardBanner} alt="Promotion" className="w-full h-full object-cover" loading="lazy" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/5 to-transparent pointer-events-none" />
                    </div>
                  </motion.div>

                  {/* Slide 3 — reuses slide 1 content */}
                  <motion.div onClick={navigateToCategories} whileTap={{ scale: 0.96 }} className="min-w-full px-3 py-2">
                    <div className="w-full h-[174px] bg-[#B05212] p-4 relative overflow-hidden flex items-center shadow-md rounded-[20px]">
                      {/* Faint dashed lines background */}
                      <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20" preserveAspectRatio="none" viewBox="0 0 100 100">
                        <path d="M -10 40 Q 30 -20 60 40 T 130 40" fill="none" stroke="white" strokeWidth="1" strokeDasharray="3 3" />
                        <path d="M -20 70 Q 20 120 70 60 T 140 70" fill="none" stroke="white" strokeWidth="1" strokeDasharray="3 3" />
                      </svg>
                      
                      <div className="relative z-10 w-[55%] flex flex-col items-start justify-center gap-1 pl-2">
                        <div className="flex flex-col leading-[1.05]">
                          <h4 className="text-[32px] sm:text-[36px] font-[1000] text-white tracking-tight">Fastest</h4>
                          <h4 className="text-[32px] sm:text-[36px] font-[1000] text-[#FFD6B3] tracking-tighter italic">Groceries</h4>
                        </div>
                        <p className="text-[12px] sm:text-[13px] font-medium text-white/95 mt-1 mb-2">Get it all in 10 minutes or less.</p>
                        <button className="bg-white text-[#B05212] px-5 py-2 rounded-full font-bold text-[13px] tracking-wide shadow-md hover:bg-gray-50 active:scale-95 transition-all">
                          Shop Now
                        </button>
                      </div>
                      
                      <div className="absolute right-0 bottom-0 top-0 w-[45%] flex items-center justify-end overflow-hidden">
                        <div className="h-full w-full bg-red-100 rounded-l-[16px] overflow-hidden shadow-[-4px_0_15px_rgba(0,0,0,0.15)] relative">
                          <img src={CardBanner} alt="Promo" className="w-full h-full object-cover object-left" loading="lazy" />
                          <div className="absolute inset-0 bg-gradient-to-r from-[#B05212]/20 to-transparent pointer-events-none" />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </div>
                {/* Fallback Pagination Dots */}
                <div className="flex justify-center items-center gap-1.5 mt-3 pb-1">
                  {[0, 1].map((idx) => {
                    const realActiveIndex = mobileBannerIndex % 2;
                    const isActive = idx === realActiveIndex;
                    return (
                      <div
                        key={idx}
                        className={cn(
                          "h-[4px] rounded-full transition-all duration-300",
                          isActive ? "w-4 bg-black" : "w-[6px] bg-gray-200"
                        )}
                      />
                    );
                  })}
                </div>
              </>
              ) : null}
            </div>
          </div>

          {isPharmacyMode && !hasAnyPharmacyData ? (
            <div className="w-full mt-8 mb-12 px-4 md:px-8">
              <div className="bg-white rounded-3xl shadow-sm border border-slate-100">
                <PharmacyEmptyState variant="products" className="py-16" />
              </div>
            </div>
          ) : (
            <>
              {/* Promo Marquee Strip */}
              <div className={cn('w-full md:-mt-[2px] mb-4', embedded ? '-mt-[1px]' : '-mt-[2px]')}>
            <div
              className={cn(
                'relative overflow-hidden border-y transition-colors duration-300 shadow-red-700/30'
              )}
              style={{
                backgroundColor: '#FF0000',
                backgroundImage: 'linear-gradient(to bottom, rgba(0, 0, 0, 0.05), rgba(0, 0, 0, 0.35))',
                borderTopColor: 'rgba(255, 255, 255, 0.12)',
                borderBottomColor: 'rgba(255, 255, 255, 0.12)',
              }}
            >
              <div 
                className="absolute inset-y-0 left-0 w-16 pointer-events-none z-10"
                style={{ 
                  backgroundImage: `linear-gradient(to right, #FF0000, transparent)` 
                }} 
              />
              <div 
                className="absolute inset-y-0 right-0 w-16 pointer-events-none z-10"
                style={{ 
                  backgroundImage: `linear-gradient(to left, #FF0000, transparent)` 
                }} 
              />
              <div 
                className="classic-marquee-track flex w-max items-center gap-4 px-3 md:px-6 py-4 text-sm md:text-base font-bold -translate-y-[4px] text-white/95 transition-colors duration-300"
              >
                {[...MARQUEE_MESSAGES, ...MARQUEE_MESSAGES].map((message, idx) => (
                  <React.Fragment key={`${message}-${idx}`}>
                    <span className="whitespace-nowrap drop-shadow-[0_1px_1.5px_rgba(0,0,0,0.35)]">{message}</span>
                    <span className="text-white/40">•</span>
                  </React.Fragment>
                ))}
                <span className="whitespace-nowrap">❤️</span>
                <span className="whitespace-nowrap">🎁</span>
              </div>
            </div>
          </div>

          {/* Quick Category Slider */}
          {effectiveQuickCategories.length > 0 ? (
            <div className={cn('w-full mb-5 overflow-hidden relative group z-20 md:mt-3', embedded ? 'mt-2' : 'mt-4 md:mt-6')}>
              <div className={cn('relative overflow-hidden bg-white dark:bg-card', embedded ? 'shadow-none' : 'shadow-[0_14px_28px_rgba(15,23,42,0.09)]')}>
                <div className="relative z-10 px-4 pt-3 pb-1 md:px-8 md:pt-4">
                  <h2 className="text-center text-[18px] md:text-[20px] font-bold tracking-tight text-[#132018] leading-none">Quick categories</h2>
                </div>

                <div className="absolute left-4 lg:left-10 top-[58%] -translate-y-1/2 z-20 hidden md:flex">
                  <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={scrollLeft}
                    className="h-10 w-10 bg-white/90 backdrop-blur-md shadow-xl rounded-full flex items-center justify-center border border-gray-100 cursor-pointer hover:bg-white text-[#0c831f] transition-all">
                    <ChevronLeft size={22} strokeWidth={3} />
                  </motion.button>
                </div>

                <div ref={quickCatsRef} className="relative z-10 flex items-start gap-2.5 md:gap-3 lg:gap-4 overflow-x-auto no-scrollbar px-4 pb-3 pt-1 md:px-8 md:pb-4 snap-x scroll-smooth">
                  {effectiveQuickCategories.map((cat, idx) => {
                    const palette = quickCategoryPalettes[idx % quickCategoryPalettes.length];
                    const categoryImage = getQuickCategoryImage(cat);
                    return (
                      <motion.div
                        key={cat.id}
                        whileHover={{ y: -4 }}
                        whileTap={{ scale: 0.96 }}
                        onClick={() => handleCategoryClick(cat)}
                        className="flex flex-col items-center gap-1 min-w-[84px] md:min-w-[112px] lg:min-w-[128px] cursor-pointer group/item snap-start"
                      >
                        <div
                          className="relative w-[84px] h-[96px] md:w-[112px] md:h-[126px] lg:w-[128px] lg:h-[140px] rounded-t-full rounded-b-[24px] shadow-[0_10px_22px_rgba(15,23,42,0.10)] border flex items-start justify-center p-2 transition-all duration-300 group-hover/item:-translate-y-1 group-hover/item:shadow-[0_16px_30px_rgba(15,23,42,0.14)] overflow-hidden"
                          style={{
                            backgroundImage: `linear-gradient(135deg, rgba(255,255,255,0.96) 0%, rgba(255,255,255,0.6) 24%, rgba(255,255,255,0.15) 100%), linear-gradient(135deg, ${palette.bgFrom}, ${palette.bgVia}, ${palette.bgTo})`,
                            borderColor: palette.frameColor,
                          }}
                        >
                          <div className="absolute inset-0 opacity-40 pointer-events-none" style={{ backgroundColor: palette.glowColor }} />
                          {categoryImage ? (
                            <img
                              src={categoryImage}
                              alt={cat.name}
                              className="absolute left-1/2 top-3 z-10 h-[68px] w-[68px] -translate-x-1/2 object-contain drop-shadow-[0_5px_12px_rgba(0,0,0,0.10)] mix-blend-multiply group-hover/item:scale-110 transition-transform duration-500"
                              loading="lazy"
                            />
                          ) : (
                            <div className="absolute left-1/2 top-3 z-10 flex h-[68px] w-[68px] -translate-x-1/2 items-center justify-center rounded-[20px] bg-white/55 text-2xl font-black uppercase text-slate-400">
                              {(cat.name || '?').charAt(0)}
                            </div>
                          )}
                          <div className="absolute inset-x-2 bottom-1.5 z-20 text-center">
                            <span className="block text-[10px] md:text-[11px] lg:text-[12px] font-semibold text-[#1f2b20] leading-tight whitespace-nowrap overflow-hidden text-ellipsis drop-shadow-[0_1px_0_rgba(255,255,255,0.65)] group-hover/item:text-[#0c831f] transition-colors">
                              {cat.name}
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>

                <div className="absolute right-4 lg:right-10 top-[58%] -translate-y-1/2 z-20 hidden md:flex">
                  <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={scrollRight}
                    className="h-10 w-10 bg-white/90 backdrop-blur-md shadow-xl rounded-full flex items-center justify-center border border-gray-100 cursor-pointer hover:bg-white text-[#0c831f] transition-all">
                    <ChevronRight size={22} strokeWidth={3} />
                  </motion.button>
                </div>
              </div>
            </div>
          ) : null}

          {/* Lowest Price Ever Section */}
          <div className={cn('mb-4 md:mb-6', embedded ? 'mt-4 md:mt-5' : 'mt-6 md:mt-10')}>
            <div className="relative overflow-hidden bg-[#e7f3ff] pt-6 md:pt-8 pb-0 rounded-none md:rounded-[32px] mx-0 md:mx-8 lg:mx-[50px] shadow-sm">
              <div className="relative z-10 px-4 md:px-8">
                <div className="flex justify-between items-center mb-3 md:mb-5 px-1">
                  <div className="flex flex-col">
                    <h3 className="text-lg md:text-3xl font-[1000] text-[#004b91] tracking-tighter uppercase leading-none">
                      Lowest Price <span className="text-[#004b91]">ever</span>
                    </h3>
                    <div className="flex items-center gap-1.5 md:gap-2 mt-1 md:mt-2">
                      <div className="h-1 w-1 md:h-1.5 md:w-1.5 bg-[#004b91] rounded-full animate-pulse" />
                      <span className="text-[9px] md:text-[10px] font-black text-[#004b91] uppercase tracking-wider opacity-80">
                        Unbeatable Savings • Updated hourly
                      </span>
                    </div>
                  </div>
                  <motion.div
                    onClick={navigateToCategories}
                    whileHover={{ x: 5, scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="flex items-center gap-1 md:gap-1.5 bg-white px-3 py-1.5 md:px-5 md:py-2.5 rounded-full text-[#004b91] font-bold text-[9px] md:text-xs cursor-pointer shadow-sm border border-[#004b91]/5 transition-all shrink-0 whitespace-nowrap"
                  >
                    See all <ArrowRightIcon sx={{ fontSize: 10, ml: 0.5 }} />
                  </motion.div>
                </div>

                <div className="relative z-10 flex overflow-x-auto gap-3 md:gap-4 pb-5 md:pb-6 no-scrollbar -mx-4 px-4 md:mx-0 md:px-0 snap-x snap-mandatory scroll-smooth">
                  {filteredProducts.slice(0, 12).map((product) => (
                    <div key={product.id} className="w-[125px] md:w-[155px] lg:w-[175px] shrink-0 snap-start">
                      {isPharmacyMode ? (
                        <PharmacyProductCard
                          product={product}
                          className="bg-white rounded-[20px] shadow-[0_8px_20px_-8px_rgba(0,0,0,0.1)] border-blue-50/50 transition-all"
                          compact={true}
                        />
                      ) : (
                        <ProductCard
                          product={product}
                          className="bg-white rounded-[20px] shadow-[0_8px_20px_-8px_rgba(0,0,0,0.1)] border-blue-50/50 transition-all"
                          compact={true}
                          curvedInfo={true}
                        />
                      )}
                    </div>
                  ))}
                  {filteredProducts.length === 0 && !isLoading && (
                    <div className="w-full py-10 md:py-20 text-center text-slate-400 font-black italic md:text-xl">
                      {activeCategory && activeCategory._id !== 'all'
                        ? `No products found in ${activeCategory.name}`
                        : 'Curating the best deals for you...'}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Offer Sections */}
          {visibleOfferSections.length > 0 && (
            <div className="w-full px-0 pt-0 pb-2 md:pb-4">
              {visibleOfferSections.map((section) => {
                const bgColor = getBackgroundColorByValue(section.backgroundColor);
                const sectionProducts = (section.productIds || [])
                  .filter((p) => typeof p === 'object' && p !== null)
                  .filter((p) => {
                     if (!isPharmacyMode) return true;
                     const pCatId = p.categoryId?._id || p.categoryId || p.category?._id || p.category;
                     const cat = categoryMap[String(pCatId)];
                     if (!cat) return false;
                     const parentHeaderId = cat.parentId || cat.headerId || cat.parent?._id || cat.header?._id;
                     return String(parentHeaderId) === String(activeCategory._id) || String(pCatId) === String(activeCategory._id);
                  })
                  .map((p) => ({
                    id: p._id,
                    _id: p._id,
                    name: p.name,
                    image: resolveQuickImageUrl(p.mainImage || p.image || ''),
                    price: Number(p.salePrice || 0) > 0 ? Number(p.salePrice) : Number(p.price || 0),
                    originalPrice: Number(p.originalPrice || p.mrp || p.price || p.salePrice || 0),
                    weight: p.weight,
                    deliveryTime: p.deliveryTime,
                  }));

                if (isPharmacyMode && sectionProducts.length === 0) return null;

                return (
                  <motion.div
                    key={section._id}
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.25 }}
                    transition={{ duration: 0.4 }}
                    className={cn(
                      'mb-4 rounded-none overflow-hidden shadow-[0_10px_25px_rgba(15,23,42,0.1)] border-y border-slate-100/70 border-x-0 md:border-x',
                      section.title?.toLowerCase().includes('masala') ? 'bg-[#FFF9E7]' : 'bg-white',
                    )}
                  >
                    <div
                      className="relative flex items-center justify-between px-5 md:px-8 py-5 md:py-6 text-black dark:text-white"
                      style={{ backgroundColor: bgColor, backgroundImage: getBackgroundGradientByValue(section.backgroundColor) }}
                    >
                      <div className="pointer-events-none absolute inset-0 overflow-hidden">
                        <div className="absolute -top-10 -left-10 w-40 h-40 md:w-56 md:h-56 bg-white/20 rounded-full blur-3xl" />
                        <div className="absolute -bottom-10 right-0 w-44 h-44 bg-white/10 rounded-full blur-3xl" />
                      </div>
                      <div className="flex-1 pr-4">
                        <p className="text-[10px] md:text-[11px] font-black uppercase tracking-[0.25em] text-black/60 dark:text-white/60 mb-1">Trending right now</p>
                        <h3 className="text-2xl md:text-3xl font-black tracking-tight leading-tight drop-shadow-sm">{section.title}</h3>
                        {(() => {
                          const categoryNamesLabel = (section.categoryIds || [])
                            .map((c) => typeof c === 'object' && c?.name ? c.name : null)
                            .filter(Boolean)
                            .join(', ') || section.categoryId?.name;
                          return categoryNamesLabel ? (
                            <p className="text-xs md:text-sm font-semibold text-black/75 dark:text-white/75 mt-1">
                              {categoryNamesLabel}
                            </p>
                          ) : null;
                        })()}
                      </div>
                      <motion.div
                        whileHover={{ y: -4, rotate: -4, scale: 1.06 }}
                        transition={{ type: 'spring', stiffness: 260, damping: 18 }}
                        className="w-20 h-20 md:w-24 md:h-24 rounded-2xl flex-shrink-0 shadow-[0_16px_30px_rgba(0,0,0,0.25)] border border-black/10 overflow-hidden relative bg-black/10"
                      >
                        {sectionProducts[0]?.image ? (
                          <>
                            <img
                              src={sectionProducts[0].image}
                              srcSet={getCloudinarySrcSet(sectionProducts[0].image)}
                              sizes="100px"
                              alt={section.title}
                              className="absolute inset-0 w-full h-full object-cover scale-110"
                              loading="lazy"
                            />
                            <div className="absolute inset-0 bg-gradient-to-tr from-black/60 via-black/20 to-transparent" />
                            <div className="absolute -bottom-6 -right-6 w-16 h-16 rounded-full bg-amber-400/60 blur-xl mix-blend-screen" />
                          </>
                        ) : (
                          <div className="absolute inset-0 bg-gradient-to-br from-red-400 via-red-500 to-rose-500" />
                        )}
                        {sectionProducts.length > 0 && (
                          <div className="absolute top-1 left-1 px-2 py-0.5 rounded-full bg-black/70 text-[9px] font-bold text-white/90 tracking-wide flex items-center gap-1">
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            {sectionProducts.length} items
                          </div>
                        )}
                        <div className="relative z-10 flex items-center justify-center h-full">
                          <Sparkles className="text-amber-200 drop-shadow-[0_0_12px_rgba(251,191,36,0.9)]" size={30} />
                        </div>
                      </motion.div>
                    </div>

                    <div className="p-4 md:p-5">
                      <div className="flex overflow-x-auto gap-3 md:gap-4 pb-2 no-scrollbar snap-x snap-mandatory">
                        {sectionProducts.length === 0 ? (
                          <div className="w-full py-6 text-center text-slate-400 text-sm font-bold">No products in this section yet.</div>
                        ) : (
                          sectionProducts.map((product) => (
                            <div key={product.id} className="w-[130px] md:w-[160px] lg:w-[180px] flex-shrink-0 snap-start">
                              {isPharmacyMode ? (
                                <PharmacyProductCard
                                  product={product}
                                  className="border border-slate-100 dark:border-white/5 shadow-[0_10px_24px_rgba(15,23,42,0.08)]"
                                  compact
                                />
                              ) : (
                                <ProductCard
                                  product={product}
                                  className="border border-slate-100 dark:border-white/5 shadow-[0_10px_24px_rgba(15,23,42,0.08)]"
                                  compact
                                />
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* Experience Sections */}
          {hasRenderableExperience && (
            <div className="container mx-auto px-4 md:px-8 lg:px-[50px] bg-[#F0F9FF] rounded-none pt-4 pb-10 mt-[-28px] mb-10 relative z-[1] border-x-2 border-b-2 border-sky-200/50 shadow-sm overflow-hidden">
              <motion.div
                animate={{ x: ['-100%', '100%'], opacity: [0, 1, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-transparent via-sky-400/80 to-transparent"
              />
              <SectionRenderer
                sections={sectionsForRenderer}
                productsById={productsById}
                categoriesById={categoryMap}
                subcategoriesById={subcategoryMap}
              />
            </div>
          )}
            </>
          )}

          {embedded && (
            <>
              <div className="hidden md:block"><Footer /></div>
              <div className="md:hidden">
                <MobileFooterMessage />
                <BottomNav />
              </div>
            </>
          )}

          {embedded && (
            <>
              <MiniCart linkTo={getQuickCartPath(routePathname)} />
              <ProductDetailSheet />
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default React.memo(Home);