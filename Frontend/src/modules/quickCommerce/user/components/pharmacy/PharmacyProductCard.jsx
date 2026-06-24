import React, { useCallback, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Heart, Minus, Plus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useCart } from "../../context/CartContext";
import { useWishlist } from "../../context/WishlistContext";
import { useToast } from "@shared/components/ui/Toast";
import { useCartAnimation } from "../../context/CartAnimationContext";
import { resolveQuickImageUrl } from "../../utils/image";
import { getQuickProductPath } from "../../utils/routes";
import { getMedicineMeta, variantsWithoutPlaceholder, applyVariantToProduct, getCartLineId } from "./pharmacyProductMeta";
import PharmacyMetaLines from "./PharmacyMetaLines";

const HEART_ANIMATE = { scale: [1, 1.3, 1] };

const PharmacyProductCard = React.memo(({ product, className, compact = true }) => {
  const navigate = useNavigate();
  const { addToCart, updateQuantity, removeFromCart, cart } = useCart();
  const { toggleWishlist: toggleWishlistGlobal, isInWishlist } = useWishlist();
  const { showToast } = useToast();
  const { animateAddToCart, animateRemoveFromCart } = useCartAnimation();
  const imageRef = useRef(null);
  const [showHeartPopup, setShowHeartPopup] = useState(false);

  const productId = product?.id || product?._id;
  const pharmacyVariants = useMemo(
    () => variantsWithoutPlaceholder(product?.variants),
    [product?.variants],
  );
  const defaultVariant = pharmacyVariants[0] || null;
  const cartLineId = useMemo(() => {
    if (!productId) return "";
    return getCartLineId(productId, defaultVariant);
  }, [productId, defaultVariant]);
  const meta = useMemo(() => getMedicineMeta(product, defaultVariant), [product, defaultVariant]);
  const resolvedImage = resolveQuickImageUrl(meta.image) || meta.image;

  const quantity = useMemo(() => {
    const item = cart.find(
      (c) => String(c.id || c._id || c.productId) === String(cartLineId),
    );
    return item?.quantity || 0;
  }, [cart, cartLineId]);

  const isWishlisted = isInWishlist(productId);
  const stock = Number(defaultVariant?.stock ?? product?.stock ?? Infinity);

  const handleProductClick = useCallback(() => {
    if (!productId) return;
    navigate(getQuickProductPath(productId), { state: { product } });
  }, [navigate, productId, product]);

  const handleAddToCart = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (stock <= 0) {
        showToast("This product is out of stock", "error");
        return;
      }
      if (imageRef.current) {
        animateAddToCart(imageRef.current.getBoundingClientRect(), resolvedImage);
      }
      addToCart(applyVariantToProduct(product, defaultVariant));
    },
    [addToCart, animateAddToCart, product, defaultVariant, resolvedImage, showToast, stock],
  );

  const handleIncrement = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (quantity >= stock) {
        showToast(`Only ${stock} items are available in stock.`, "error");
        return;
      }
      updateQuantity(cartLineId, 1);
    },
    [cartLineId, quantity, showToast, stock, updateQuantity],
  );

  const handleDecrement = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (quantity === 1) {
        animateRemoveFromCart(product.image);
        removeFromCart(cartLineId);
      } else {
        updateQuantity(cartLineId, -1);
      }
    },
    [animateRemoveFromCart, cartLineId, product.image, quantity, removeFromCart, updateQuantity],
  );

  const toggleWishlist = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!isWishlisted) {
        setShowHeartPopup(true);
        setTimeout(() => setShowHeartPopup(false), 1000);
      }
      toggleWishlistGlobal(product);
      showToast(
        isWishlisted
          ? `${product.name} removed from wishlist`
          : `${product.name} added to wishlist`,
        isWishlisted ? "info" : "success",
      );
    },
    [isWishlisted, product, showToast, toggleWishlistGlobal],
  );

  return (
    <div
      className={cn(
        "flex flex-col h-full cursor-pointer group",
        compact ? "w-full" : "w-full max-w-sm",
        className,
      )}
      onClick={handleProductClick}
    >
      <div className="flex flex-col h-full rounded-2xl overflow-hidden border border-slate-200/80 bg-white shadow-sm hover:shadow-md transition-all duration-300">
        <div className="relative h-[100px] md:h-[120px] bg-slate-50 p-2">
          {meta.rxOtc && (
            <span
              className={cn(
                "absolute top-2 left-2 z-10 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide",
                meta.rxOtc === "Rx"
                  ? "bg-violet-100 text-violet-700"
                  : "bg-sky-100 text-sky-700",
              )}
            >
              {meta.rxOtc}
            </span>
          )}

          <button
            onClick={toggleWishlist}
            className="absolute top-2 right-2 z-10 w-7 h-7 bg-white/95 rounded-full shadow-sm flex items-center justify-center border border-slate-100"
          >
            <motion.div whileTap={{ scale: 0.8 }} animate={isWishlisted ? HEART_ANIMATE : {}}>
              <Heart
                size={14}
                className={cn(
                  isWishlisted ? "text-red-500 fill-red-500" : "text-slate-300",
                )}
              />
            </motion.div>
          </button>

          <AnimatePresence>
            {showHeartPopup && (
              <motion.div
                initial={{ scale: 0.5, opacity: 1 }}
                animate={{ scale: 2, opacity: 0 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none text-red-400"
              >
                <Heart size={40} fill="currentColor" />
              </motion.div>
            )}
          </AnimatePresence>

          <div className="w-full h-full flex items-center justify-center">
            <img
              ref={imageRef}
              src={resolvedImage}
              alt={meta.brandName}
              className="max-h-full max-w-full object-contain"
              loading="lazy"
            />
          </div>
        </div>

        <div className="flex flex-col flex-1 p-2.5 gap-1">
          <h3 className="text-[13px] md:text-sm font-bold text-slate-900 line-clamp-2 leading-tight">
            {meta.brandName}
          </h3>

          <PharmacyMetaLines
            product={product}
            meta={meta}
            showManufacturer
            showGeneric
            showStrengthDosage
            showPack
          />

          <div className="mt-auto pt-2 flex items-end justify-between gap-2 border-t border-slate-100">
            <div className="flex flex-col">
              <span className="text-sm md:text-base font-black text-teal-700">
                ₹{meta.sellingPrice.toLocaleString("en-IN")}
              </span>
              {meta.hasDiscount && (
                <span className="text-[10px] text-slate-400 line-through font-semibold">
                  ₹{meta.mrp.toLocaleString("en-IN")}
                </span>
              )}
            </div>

            {quantity > 0 ? (
              <div
                className="flex items-center bg-teal-600 text-white rounded-xl h-8 overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={handleDecrement}
                  className="flex h-8 w-8 items-center justify-center hover:bg-white/15"
                >
                  <Minus size={14} strokeWidth={3} />
                </button>
                <span className="min-w-[20px] text-center text-sm font-bold">{quantity}</span>
                <button
                  onClick={handleIncrement}
                  disabled={quantity >= stock}
                  className="flex h-8 w-8 items-center justify-center hover:bg-white/15 disabled:opacity-40"
                >
                  <Plus size={14} strokeWidth={3} />
                </button>
              </div>
            ) : (
              <button
                onClick={handleAddToCart}
                className="px-3 py-1.5 rounded-xl bg-teal-600 text-white text-xs font-bold hover:bg-teal-700 transition-colors"
              >
                ADD
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

PharmacyProductCard.displayName = "PharmacyProductCard";

export default PharmacyProductCard;
