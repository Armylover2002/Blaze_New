import React, { memo, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import ProductCard from "../shared/ProductCard";
import { cn } from "@/lib/utils";
import ExperienceBannerCarousel from "./ExperienceBannerCarousel";
import { resolveQuickImageUrl } from "../../utils/image";
import { getCloudinarySrcSet } from "@/shared/utils/cloudinaryUtils";
import { motion } from "framer-motion";
import { getQuickCategoryPath } from "../../utils/routes";

// ─── Static constants bahar rakhe — har render pe recreate nahi hoga ──────────
const CATEGORY_BG_COLORS = [
  "#E7F3FF",
  "#F0FFF4",
  "#FFF5F5",
  "#FFF9E7",
  "#F3E8FF",
  "#E6FFFA",
  "#FFEDD5",
  "#F0F9FF",
];

const GRID_COLS_MAP = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
  5: "grid-cols-5",
};

const MOTION_TRANSITION = {
  type: "spring",
  stiffness: 260,
  damping: 20,
};

const MOTION_VIEWPORT = { once: true, amount: 0.2 };

// ─── Banner Section ────────────────────────────────────────────────────────────
const BannerSection = memo(({ section }) => {
  const items =
    section.config?.banners?.items || section.config?.items || [];
  if (!items.length) return null;

  return (
    <div className="-mt-8 md:-mt-8">
      <ExperienceBannerCarousel section={section} items={items} slideGap={12} />
    </div>
  );
});
BannerSection.displayName = "BannerSection";

// ─── Categories Section ────────────────────────────────────────────────────────
const CategoryItem = memo(({ cat, idx, onClick }) => {
  const bgColor = CATEGORY_BG_COLORS[idx % CATEGORY_BG_COLORS.length];
  const motionInitial = useMemo(
    () => ({
      rotateY: idx % 2 === 0 ? 45 : -45,
      opacity: 0,
      y: 20,
      scale: 0.95,
    }),
    [idx]
  );
  const motionAnimate = { rotateY: 0, opacity: 1, y: 0, scale: 1 };
  const motionTransition = useMemo(
    () => ({ ...MOTION_TRANSITION, delay: (idx % 4) * 0.05 }),
    [idx]
  );

  return (
    <motion.div
      initial={motionInitial}
      whileInView={motionAnimate}
      viewport={MOTION_VIEWPORT}
      transition={motionTransition}
      onClick={onClick}
      className="flex flex-col items-center group cursor-pointer"
    >
      <div
        className="w-full aspect-square rounded-2xl p-2.5 mb-1.5 group-hover:scale-[1.05] transition-all duration-300 flex items-center justify-center overflow-hidden shadow-sm border border-white/50"
        style={{ backgroundColor: bgColor }}
      >
        <img
          src={cat.image}
          srcSet={getCloudinarySrcSet(cat.image)}
          sizes="(max-width: 768px) 25vw, 150px"
          alt={cat.name}
          className="w-full h-full object-contain group-hover:rotate-6 transition-transform duration-500 drop-shadow-sm mix-blend-multiply"
          loading="lazy"
        />
      </div>
      <span className="text-[10px] md:text-xs font-bold text-slate-700 text-center line-clamp-1 group-hover:text-black transition-colors">
        {cat.name}
      </span>
    </motion.div>
  );
});
CategoryItem.displayName = "CategoryItem";

const CategoriesSection = memo(({ section }) => {
  const navigate = useNavigate();
  const categoryConfig = section.config?.categories || {};
  const rows = categoryConfig.rows || 1;
  const visibleCount = rows * 4;

  const items = useMemo(
    () =>
      (categoryConfig.items || [])
        .slice(0, visibleCount)
        .map((c) => ({
          ...c,
          id: c.id || c._id,
          image: resolveQuickImageUrl(c.image || c.mainImage),
        })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [categoryConfig.items, visibleCount]
  );

  const handleClick = useCallback(
    (id) => () => navigate(getQuickCategoryPath(id)),
    [navigate]
  );

  if (!items.length) return null;

  return (
    <div id={`section-${section._id}`} className="mt-0">
      {section.title && (
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-base font-black text-foreground">{section.title}</h3>
          <span className="text-[11px] font-semibold text-slate-400">
            {items.length} categories
          </span>
        </div>
      )}
      <div
        className="grid grid-cols-4 gap-2 md:gap-4 overflow-hidden [perspective:1000px]"
        style={{ gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))` }}
      >
        {items.map((cat, idx) => (
          <CategoryItem
            key={cat.id || `cat-${idx}`}
            cat={cat}
            idx={idx}
            onClick={handleClick(cat.id)}
          />
        ))}
      </div>
    </div>
  );
});
CategoriesSection.displayName = "CategoriesSection";

// ─── Subcategories Section ─────────────────────────────────────────────────────
const SubcategoryItem = memo(({ cat, onClick }) => (
  <button
    className="flex flex-col items-center gap-2 w-20 shrink-0 group"
    onClick={onClick}
  >
    <div className="relative aspect-square w-full rounded-2xl bg-card dark:bg-background border border-border flex items-center justify-center overflow-hidden p-1 transition-all duration-200 group-hover:border-[#0c831f]/40 group-hover:bg-accent group-hover:shadow-[0_10px_25px_rgba(15,23,42,0.08)]">
      {cat.image ? (
        <img
          src={resolveQuickImageUrl(cat.image)}
          srcSet={getCloudinarySrcSet(cat.image)}
          sizes="80px"
          alt={cat.name}
          className="w-full h-full object-contain object-center mix-blend-multiply transition-transform duration-200 group-hover:scale-105"
          loading="lazy"
        />
      ) : (
        <div className="h-6 w-6 rounded-full bg-slate-100" />
      )}
    </div>
    <div className="text-[11px] font-semibold text-foreground text-center leading-snug line-clamp-2 group-hover:text-[#0c831f]">
      {cat.name}
    </div>
  </button>
));
SubcategoryItem.displayName = "SubcategoryItem";

const SubcategoriesSection = memo(({ section }) => {
  const navigate = useNavigate();
  const items = section.config?.subcategories?.items || [];

  const handleSubcategoryClick = useCallback(
    (cat) => () => {
      const parentId =
        cat.parentId?._id ||
        cat.parentId ||
        cat.categoryId?._id ||
        cat.categoryId ||
        null;

      if (parentId) {
        navigate(getQuickCategoryPath(parentId), {
          state: { activeSubcategoryId: cat._id },
        });
      } else {
        navigate(getQuickCategoryPath(cat._id));
      }
    },
    [navigate]
  );

  if (!items.length) return null;

  return (
    <div id={`section-${section._id}`}>
      <div className="flex items-center justify-between mb-3">
        {section.title && (
          <h3 className="text-base font-black text-foreground">{section.title}</h3>
        )}
        <span className="text-[11px] font-semibold text-slate-400">
          {items.length} items
        </span>
      </div>
      <div className="overflow-x-auto no-scrollbar -mx-4 px-4">
        <div className="flex gap-4 pb-2">
          {items.map((cat, idx) => (
            <SubcategoryItem
              key={cat._id || cat.id || `subcat-${idx}`}
              cat={cat}
              onClick={handleSubcategoryClick(cat)}
            />
          ))}
        </div>
      </div>
    </div>
  );
});
SubcategoriesSection.displayName = "SubcategoriesSection";

// ─── Products Section ──────────────────────────────────────────────────────────
const ProductsSection = memo(({ section }) => {
  const productConfig = section.config?.products || {};
  const rows = productConfig.rows || 1;
  const columns = productConfig.columns || 3;
  const singleRowScrollable = !!productConfig.singleRowScrollable;

  const allProducts = useMemo(
    () =>
      (productConfig.items || []).map((p) => ({
        ...p,
        id: p._id || p.id,
        image: resolveQuickImageUrl(
          p.mainImage ||
          p.image ||
          "https://images.unsplash.com/photo-1550989460-0adf9ea622e2"
        ),
        price: Number(p.price || p.salePrice || 0),
        originalPrice: Number(
          p.originalPrice || p.mrp || p.price || p.salePrice || 0
        ),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [productConfig.items]
  );

  if (!allProducts.length) return null;

  const heading = section.title;

  if (singleRowScrollable) {
    return (
      <div id={`section-${section._id}`} className="mb-2">
        <div className="flex items-center justify-between mb-3">
          {heading && (
            <h3 className="text-base font-black text-foreground">{heading}</h3>
          )}
          <span className="text-[11px] font-semibold text-slate-400">
            {allProducts.length} items
          </span>
        </div>
        <div className="relative z-10 flex overflow-x-auto gap-3 pb-4 no-scrollbar">
          {allProducts.map((product, idx) => (
            <div key={product._id || product.id || `prod1-${idx}`} className="w-[165px] shrink-0">
              <ProductCard product={product} compact={true} neutralBg={true} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const items = allProducts.slice(0, rows * columns);
  const gridClass = GRID_COLS_MAP[columns] || "grid-cols-2";

  return (
    <div id={`section-${section._id}`}>
      <div className="flex items-center justify-between mb-3">
        {heading && (
          <h3 className="text-base font-black text-foreground">{heading}</h3>
        )}
        <span className="text-[11px] font-semibold text-slate-400">
          {items.length} items
        </span>
      </div>
      <div className={cn("grid gap-2 md:gap-4", gridClass)}>
        {items.map((product, idx) => (
          <div key={product._id || product.id || `prod2-${idx}`}>
            <ProductCard
              product={product}
              compact={true}
              neutralBg={true}
            />
          </div>
        ))}
      </div>
    </div>
  );
});
ProductsSection.displayName = "ProductsSection";

// ─── Main SectionRenderer ──────────────────────────────────────────────────────
const SectionRenderer = ({
  sections = [],
  productsById = {},
  categoriesById = {},
  subcategoriesById = {},
}) => {
  return (
    <div className="space-y-8">
      {sections.map((section, idx) => {
        const sectionKey = section._id || `sec-${idx}`;
        switch (section.displayType) {
          case "banners":
            return <BannerSection key={sectionKey} section={section} />;

          case "categories":
            return (
              <CategoriesSection
                key={sectionKey}
                section={section}
              />
            );

          case "subcategories":
            return (
              <SubcategoriesSection
                key={sectionKey}
                section={section}
              />
            );

          case "products":
            return <ProductsSection key={sectionKey} section={section} />;

          default:
            return null;
        }
      })}
    </div>
  );
};

export default memo(SectionRenderer);