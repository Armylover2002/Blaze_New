// ============================================================
// OPTIMIZED ProductDetailPage.jsx
// ============================================================
//
// KEY OPTIMIZATIONS:
//
// 1. normalizeProduct, normalizePrice, cleanDescription, resolveQuickImageUrl
//    — pure functions, already outside component ✓
//
// 2. initialProduct (useMemo) — already good ✓
//
// 3. Image deduplication in normalizeProduct — original used Set on an array
//    that could contain undefined entries; tightened to filter before Set.
//
// 4. ProductDetailSection → React.memo  (the 3 detail chips re-rendered on
//    every cart/quantity change)
//
// 5. handleToggleWishlist → useCallback
//
// 6. quantity selector: add/remove handlers → useCallback with stable refs
//    (avoids re-creating lambdas inside JSX on every render)
//
// 7. isWishlisted → useMemo ✓ (already in original)
//
// 8. activeImage initialisation: original had two separate effects that both
//     set activeImage — merged into one, preventing a redundant extra render.
//
// ============================================================

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Clock, Heart, Loader2,
  Minus, Plus, ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCart } from "../context/CartContext";
import { useWishlist } from "../context/WishlistContext";
import { useToast } from "@shared/components/ui/Toast";
import { customerApi } from "../services/customerApi";
import { resolveQuickImageUrl } from "../utils/image";
import { isStoreCurrentlyOpen } from "@shared/utils/timeFormat";
import PharmacyProductDetailsView from "../components/pharmacy/PharmacyProductDetailsView";
import {
  resolvePharmacyHeaderForProduct,
  isPharmacyHeaderContext,
  variantsWithoutPlaceholder,
  applyVariantToProduct,
  getMedicineMeta,
  getCartLineId,
} from "../components/pharmacy/pharmacyProductMeta";

// ─── Pure helpers (unchanged) ─────────────────────────────────────────────────

const getProductIdentifier = (value) =>
  String(value?.cartLineId || value?.id || value?._id || value?.productId || value?.itemId || "").trim();

const normalizePrice = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const cleanDescription = (text) => {
  if (!text) return "No description is available for this product yet.";
  const value = String(text).trim();
  if (!value) return "No description is available for this product yet.";
  if (value.startsWith("{\\rtf") || value.includes("\\par")) {
    const cleaned = value
      .replace(/\{\\[^}]*\}/g, " ")
      .replace(/\\[a-z]+\d*\s?/gi, " ")
      .replace(/\\'/g, "'")
      .replace(/[{}]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return cleaned || "No description is available for this product yet.";
  }
  return value;
};

const normalizeProduct = (product = {}, fallback = {}) => {
  const source = { ...fallback, ...product };

  // Tightened: filter before dedup so Set doesn't waste slots on empty strings
  const imageCandidates = [
    source.mainImage,
    source.image,
    ...(Array.isArray(source.galleryImages) ? source.galleryImages : []),
  ]
    .filter(Boolean)
    .map((image) => resolveQuickImageUrl(image) || image)
    .filter(Boolean);
  const images = [...new Set(imageCandidates)];

  const salePrice = normalizePrice(source.salePrice, 0);
  const basePrice = normalizePrice(source.price, salePrice);
  const price = salePrice > 0 ? salePrice : basePrice;
  const originalPrice = Math.max(
    price,
    normalizePrice(source.originalPrice ?? source.mrp ?? source.price, price),
  );
  const stock = normalizePrice(source.stock, 0);

  return {
    ...source,
    id: source.id || source._id,
    _id: source._id || source.id,
    name: source.name || "Product",
    category: source.category || source.categoryName || source.categoryId?.name || "Quick Commerce",
    price,
    originalPrice,
    description: cleanDescription(source.description),
    images: images.length > 0
      ? images
      : ["https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=1200&auto=format&fit=crop"],
    details: [
      { label: "Unit", value: source.weight || source.unit || "1 unit" },
      { label: "Stock", value: stock > 0 ? `${stock} available` : "Out of stock" },
      { label: "Brand", value: source.brand || "Quick Select" },
    ],
    storeName:
      source.storeName || source.restaurantName || source.seller?.name ||
      source.sellerId?.name || source.store?.name || source.storeId?.name || "Fresh Mart",
    openingHours: source.seller?.shopInfo?.openingHours || source.sellerId?.shopInfo?.openingHours || source.seller?.openingHours || source.sellerId?.openingHours || "",
    deliveryTime: source.deliveryTime || "8-12 mins",
  };
};

// ─── Extracted memoized sub-components ───────────────────────────────────────

// Detail chip: only re-renders when the detail itself changes
const ProductDetailChip = React.memo(function ProductDetailChip({ detail }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 text-center shadow-sm transition-colors">
      <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">{detail.label}</p>
      <p className="text-sm font-black text-foreground">{detail.value}</p>
    </div>
  );
});

// ─── Main component ───────────────────────────────────────────────────────────

const ProductDetailPage = () => {
  const { productId, id } = useParams();
  const resolvedProductId = productId || id;
  const location = useLocation();
  const navigate = useNavigate();

  const initialProduct = useMemo(() => {
    const routeProduct = location.state?.product;
    return routeProduct ? normalizeProduct(routeProduct) : null;
  }, [location.state]);

  const [product, setProduct] = useState(initialProduct);
  const [activeImage, setActiveImage] = useState(initialProduct?.images?.[0] || "");
  const [loadingProduct, setLoadingProduct] = useState(!initialProduct);
  const [productError, setProductError] = useState("");
  const [categoryFullMap, setCategoryFullMap] = useState({});
  const [selectedVariant, setSelectedVariant] = useState(null);

  const { cart, addToCart, updateQuantity, removeFromCart } = useCart();
  const { toggleWishlist: toggleWishlistGlobal, isInWishlist } = useWishlist();
  const { showToast } = useToast();

  const isWishlisted = useMemo(
    () => (product ? isInWishlist(product.id || product._id) : false),
    [product, isInWishlist],
  );

  useEffect(() => {
    let cancelled = false;
    const loadCategoryTree = async () => {
      try {
        const response = await customerApi.getCategories({ tree: true });
        if (!response?.data?.success || cancelled) return;
        const results = response.data.results || response.data.result || [];
        const allCats = Array.isArray(results) ? results : [];
        const fullMap = {};
        const flatten = (items) => {
          items.forEach((item) => {
            fullMap[item._id] = item;
            if (item.children?.length > 0) flatten(item.children);
          });
        };
        flatten(allCats);
        if (!cancelled) setCategoryFullMap(fullMap);
      } catch {
        if (!cancelled) setCategoryFullMap({});
      }
    };
    loadCategoryTree();
    return () => { cancelled = true; };
  }, []);

  const isPharmacyMode = useMemo(() => {
    if (!product || !Object.keys(categoryFullMap).length) return false;
    const headerNode = resolvePharmacyHeaderForProduct(product, categoryFullMap);
    return isPharmacyHeaderContext(headerNode);
  }, [product, categoryFullMap]);

  const pharmacyVariants = useMemo(
    () => (product ? variantsWithoutPlaceholder(product.variants) : []),
    [product],
  );

  useEffect(() => {
    if (!product || !isPharmacyMode) {
      setSelectedVariant(null);
      return;
    }
    setSelectedVariant(pharmacyVariants[0] || null);
  }, [product, isPharmacyMode, pharmacyVariants]);

  const pharmacyCartLineId = useMemo(() => {
    if (!product) return "";
    const baseId = product.id || product._id;
    return getCartLineId(baseId, selectedVariant);
  }, [product, selectedVariant]);

  const pharmacyMeta = useMemo(
    () => (product && isPharmacyMode ? getMedicineMeta(product, selectedVariant) : null),
    [product, isPharmacyMode, selectedVariant],
  );

  const pharmacyStock = useMemo(() => {
    if (!isPharmacyMode || !product) return Number(product?.stock ?? 0);
    if (selectedVariant) return Number(selectedVariant.stock ?? product.stock ?? 0);
    return Number(product.stock ?? 0);
  }, [isPharmacyMode, product, selectedVariant]);

  const quantity = useMemo(() => {
    if (!product) return 0;
    const lookupId = isPharmacyMode ? pharmacyCartLineId : getProductIdentifier(product);
    const cartItem = cart.find((item) => getProductIdentifier(item) === lookupId);
    return cartItem ? cartItem.quantity : 0;
  }, [cart, product, isPharmacyMode, pharmacyCartLineId]);

  // Merged the two original activeImage effects into one — prevents double-render
  // when product loads: original had effect[resolvedProductId] setting product,
  // then a second effect[product] setting activeImage.
  useEffect(() => {
    let cancelled = false;
    const fetchProduct = async () => {
      if (!resolvedProductId) {
        setLoadingProduct(false);
        setProductError("Product id is missing from the route.");
        return;
      }
      setLoadingProduct(true);
      setProductError("");
      try {
        const response = await customerApi.getProductDetails(resolvedProductId);
        const result =
          response?.data?.result || response?.data?.data || response?.data?.product || null;
        if (!result) throw new Error("Product not found");
        if (!cancelled) {
          const normalized = normalizeProduct(result, location.state?.product);
          setProduct(normalized);
          // Set active image in the same state flush — avoids the extra render
          // from the second useEffect that was watching `product`
          setActiveImage(normalized.images[0] || "");
        }
      } catch (error) {
        if (!cancelled) {
          setProduct(null);
          setProductError(error?.response?.data?.message || "Unable to load this product.");
        }
      } finally {
        if (!cancelled) setLoadingProduct(false);
      }
    };
    fetchProduct();
    return () => { cancelled = true; };
  }, [resolvedProductId]); // ← removed location.state from dep — it's only needed for initial render

  // useCallback: stable reference, doesn't cause child re-renders
  const handleToggleWishlist = useCallback(() => {
    if (!product) return;
    toggleWishlistGlobal(product);
    showToast(
      isWishlisted ? `${product.name} removed from wishlist` : `${product.name} added to wishlist`,
      isWishlisted ? "info" : "success",
    );
  }, [product, toggleWishlistGlobal, isWishlisted, showToast]);

  // Stable add/update/remove handlers so quantity buttons don't get new refs each render
  const handleAddToCart = useCallback(async () => {
    if (!product) return;
    const cartProduct = isPharmacyMode
      ? applyVariantToProduct(product, selectedVariant)
      : product;
    const stock = Number(cartProduct.stock ?? Infinity);
    if (stock <= 0) { showToast("This product is out of stock", "error"); return; }
    const result = await addToCart(cartProduct);
    if (result?.ok === false) return;
    showToast(`${product.name} added to cart`, "success");
  }, [product, isPharmacyMode, selectedVariant, addToCart, showToast]);

  const handleDecrement = useCallback(() => {
    if (!product) return;
    const cartLineId = isPharmacyMode ? pharmacyCartLineId : (product.id || product._id);
    if (quantity === 1) removeFromCart(cartLineId);
    else updateQuantity(cartLineId, -1);
  }, [product, isPharmacyMode, pharmacyCartLineId, quantity, removeFromCart, updateQuantity]);

  const handleIncrement = useCallback(() => {
    if (!product) return;
    const stock = Number(pharmacyStock ?? product.stock ?? Infinity);
    if (quantity >= stock) { showToast(`Only ${stock} items are available in stock.`, "error"); return; }
    const cartLineId = isPharmacyMode ? pharmacyCartLineId : (product.id || product._id);
    updateQuantity(cartLineId, 1);
  }, [product, isPharmacyMode, pharmacyCartLineId, pharmacyStock, quantity, updateQuantity, showToast]);

  // ── Loading / error states ───────────────────────────────────────────────

  if (loadingProduct) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-[1920px] items-center justify-center px-4 md:px-[50px]">
        <div className="flex items-center gap-3 rounded-2xl bg-card border border-border px-6 py-4 shadow-sm">
          <Loader2 className="animate-spin text-[#0c831f]" size={22} />
          <span className="font-bold text-slate-600 dark:text-slate-400">Loading product...</span>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-[1920px] flex-col items-center justify-center px-4 text-center md:px-[50px]">
        <h1 className="text-2xl font-black text-foreground">Product not found</h1>
        <p className="mt-2 max-w-md text-sm font-medium text-slate-500 dark:text-slate-400">
          {productError || "This product may have been removed or is no longer available."}
        </p>
        <Button onClick={() => navigate(-1)} className="mt-6 rounded-2xl bg-red-600 px-6 py-3 text-white hover:bg-red-700">
          Go back
        </Button>
      </div>
    );
  }

  const discountPercent = product.originalPrice > product.price
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice * 100))
    : 0;

  if (isPharmacyMode) {
    return (
      <>
        <PharmacyProductDetailsView
          product={product}
          meta={pharmacyMeta}
          selectedVariant={selectedVariant}
          onVariantChange={setSelectedVariant}
          activeImage={activeImage}
          onImageSelect={setActiveImage}
          quantity={quantity}
          isWishlisted={isWishlisted}
          onToggleWishlist={handleToggleWishlist}
          onAddToCart={handleAddToCart}
          onIncrement={handleIncrement}
          onDecrement={handleDecrement}
          onBack={() => navigate(-1)}
          stock={pharmacyStock}
        />
      </>
    );
  }

  // ── Main render — identical JSX, sub-components replaced with memo versions ──

  return (
    <div className="relative z-10 mx-auto w-full max-w-[1920px] animate-in px-4 py-4 fade-in duration-700 md:px-[50px] md:py-8">
      <button
        onClick={() => navigate(-1)}
        className="group mb-6 inline-flex items-center gap-2 font-bold text-slate-500 dark:text-slate-400 transition-colors hover:text-red-600 dark:hover:text-red-400"
      >
        <ArrowLeft size={20} className="transition-transform group-hover:-translate-x-1" />
        Back
      </button>

      <div className="flex flex-col gap-10 lg:flex-row lg:gap-16">
        {/* Image Column */}
        <div className="space-y-4 lg:w-[45%] xl:w-[40%]">
          <div className="relative aspect-square overflow-hidden rounded-[2rem] border border-border bg-card dark:bg-background shadow-sm transition-colors">
            <img src={activeImage} alt={product.name} className="h-full w-full object-contain p-6 mix-blend-multiply dark:mix-blend-normal" />
            <button
              onClick={handleToggleWishlist}
              className={cn("absolute right-5 top-5 rounded-full p-3.5 shadow-lg transition-all", isWishlisted ? "bg-red-50 dark:bg-red-950/30 text-red-500" : "bg-card dark:bg-background text-slate-400 dark:text-slate-300")}
            >
              <Heart size={20} fill={isWishlisted ? "currentColor" : "none"} className={cn(isWishlisted && "fill-current")} />
            </button>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {product.images.map((image, index) => (
              <button
                key={`${image}-${index}`}
                onClick={() => setActiveImage(image)}
                className={cn("h-20 w-20 flex-shrink-0 overflow-hidden rounded-2xl border-2 transition-all md:h-24 md:w-24", activeImage === image ? "scale-95 border-red-600 shadow-lg" : "border-transparent opacity-70 hover:opacity-100")}
              >
                <img src={image} alt={`${product.name} ${index + 1}`} className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        </div>

        {/* Info Column */}
        <div className="space-y-6 md:space-y-8 lg:w-[55%] xl:w-[60%]">
          <div>
            <div className="mb-4 flex items-center gap-3">
              <span className="rounded-full border border-red-600/20 bg-red-600/10 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-red-600">{product.category}</span>
            </div>
            <h1 className="mb-2 text-2xl font-black leading-tight text-foreground md:text-3xl transition-colors">{product.name}</h1>
            <div className="mb-6 flex items-center gap-2">
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-red-100 text-red-600">
                <ShieldCheck size={14} />
              </div>
              <span className="text-sm font-black uppercase tracking-tighter text-slate-500 dark:text-slate-400">
                Sold by: <span className="text-foreground underline decoration-red-500/30 decoration-2 underline-offset-4">{product.storeName}</span>
              </span>
            </div>
            <div className="mb-5 flex items-baseline gap-4">
              <span className="text-3xl font-black text-red-600 dark:text-red-500">₹{product.price}</span>
              {product.originalPrice > product.price && (
                <>
                  <span className="text-lg font-bold text-slate-400 dark:text-slate-500 line-through">₹{product.originalPrice}</span>
                  <span className="rounded-lg bg-red-50 dark:bg-red-950/30 px-2 py-1 text-xs font-black uppercase text-red-500">{discountPercent}% OFF</span>
                </>
              )}
            </div>
            <p className="max-w-2xl text-lg font-medium leading-relaxed text-slate-600 dark:text-slate-300 transition-colors">{product.description}</p>
          </div>

          <div className="flex flex-col items-center gap-6 rounded-[2.5rem] border border-border bg-card dark:bg-slate-900/50 p-6 sm:flex-row transition-colors">
            <div className="w-full sm:w-72">
              {!isStoreCurrentlyOpen(product.openingHours) ? (
                <div className="flex h-16 w-full items-center justify-center rounded-2xl bg-slate-200 text-slate-500 font-black shadow-none cursor-not-allowed">
                  SELLER SHOP OFF
                </div>
              ) : quantity > 0 ? (
                <div className="flex h-16 w-full items-center rounded-2xl bg-red-600 px-2 text-white shadow-xl shadow-red-100">
                  <button onClick={handleDecrement} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-all hover:bg-white/20">
                    <Minus size={24} strokeWidth={3} />
                  </button>
                  <span className="flex-1 text-center text-xl font-black">{quantity}</span>
                  <button
                    disabled={quantity >= Number(product.stock ?? Infinity)}
                    onClick={handleIncrement}
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-all hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Plus size={24} strokeWidth={3} />
                  </button>
                </div>
              ) : (
                <Button onClick={handleAddToCart} className="h-16 w-full rounded-2xl bg-red-600 text-lg font-black text-white shadow-xl shadow-red-100 transition-all hover:-translate-y-1 hover:bg-red-700">
                  <Plus className="mr-2" size={24} strokeWidth={3} />
                  ADD TO CART
                </Button>
              )}
            </div>
            <div className="flex flex-col gap-1 text-center sm:text-left">
              <span className="flex items-center justify-center gap-1 text-xs font-black uppercase tracking-widest text-red-600 sm:justify-start">
                <ShieldCheck size={14} />Hygiene Guaranteed
              </span>
              <span className="flex items-center justify-center gap-1 text-sm font-bold text-slate-400 dark:text-slate-500 sm:justify-start">
                <Clock size={14} />Delivered in {product.deliveryTime}
              </span>
            </div>
          </div>

          {/* Detail chips — memoized */}
          <div className="grid grid-cols-3 gap-4">
            {product.details.map((detail) => (
              <ProductDetailChip key={detail.label} detail={detail} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetailPage;
