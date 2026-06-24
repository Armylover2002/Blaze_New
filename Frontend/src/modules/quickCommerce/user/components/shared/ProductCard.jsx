import React from "react";
import { useNavigate } from "react-router-dom";
import { Heart, Plus, Minus, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWishlist } from "../../context/WishlistContext";
import { useCart } from "../../context/CartContext";
import { useToast } from "@shared/components/ui/Toast";
import { useCartAnimation } from "../../context/CartAnimationContext";
import { resolveQuickImageUrl } from "../../utils/image";
import { getCloudinarySrcSet } from "@/shared/utils/cloudinaryUtils";
import { motion, AnimatePresence } from "framer-motion";
import { getQuickProductPath } from "../../utils/routes";

// ─── Constants (module-level) ─────────────────────────────────────────────────

const HEART_ANIMATE = { scale: [1, 1.3, 1] };
const HEART_INITIAL = { scale: 0 };
const HEART_POPUP_INITIAL = { scale: 0.5, opacity: 1, y: 0 };
const HEART_POPUP_ANIMATE = { scale: 2.5, opacity: 0, y: -60 };
const HEART_POPUP_TRANSITION = { duration: 0.8, ease: "easeOut" };

const IMG_SIZES = "(max-width: 768px) 150px, (max-width: 1024px) 200px, 250px";

// Module-level constant — computed once, no per-render browser reflow
const IS_MOBILE_SCREEN = typeof window !== "undefined" && window.innerWidth < 768;
const HEART_ICON_SIZE = IS_MOBILE_SCREEN ? 12 : 16;


// ─── ScallopedBadge ───────────────────────────────────────────────────────────

const ScallopedBadge = React.memo(function ScallopedBadge({ text, className }) {
  const hasPct = text.includes("%");
  const parts = hasPct ? text.split(" ") : null;

  return (
    <div className={cn("relative w-9 h-9 flex items-center justify-center", className)}>
      <svg
        viewBox="0 0 100 100"
        className="absolute inset-0 w-full h-full drop-shadow-[0_1px_3px_rgba(168,85,247,0.4)]"
      >
        <path
          fill="#A364FF"
          d="M50 0 C 54 0, 56 4, 61 5 C 66 6, 70 2, 75 5 C 80 8, 81 14, 84 18 C 88 22, 94 23, 96 28 C 98 33, 94 38, 94 43 C 94 48, 98 52, 98 57 C 98 62, 94 66, 92 71 C 90 76, 92 82, 88 86 C 84 90, 78 89, 73 92 C 68 95, 66 100, 61 100 C 56 100, 53 96, 48 96 C 43 96, 40 100, 35 99 C 30 98, 28 92, 23 90 C 18 88, 12 89, 9 84 C 6 79, 10 74, 9 69 C 8 64, 2 61, 2 56 C 2 51, 6 47, 7 42 C 8 37, 4 31, 6 26 C 8 21, 14 20, 18 16 C 22 12, 24 6, 29 4 C 34 2, 38 6, 43 5 C 48 4, 49 0, 53 0"
        />
      </svg>
      <div className="relative z-10 text-white font-black flex flex-col items-center justify-center leading-none text-center">
        {hasPct ? (
          <>
            <span className="text-[9px] leading-tight">{parts[0]}</span>
            <span className="text-[6px] opacity-90 tracking-tighter uppercase">{parts[1] || "OFF"}</span>
          </>
        ) : (
          <span className="text-[8px] uppercase tracking-tighter">{text}</span>
        )}
      </div>
    </div>
  );
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Stable ID extractor — no closure allocation per render */
const getComparableId = (value) => String(value ?? "").split("::")[0];

/** Calculate discount badge text once */
function getBadgeText(badge, product) {
  if (badge) return badge;
  if (product.discount) return product.discount;
  if (product.originalPrice > product.price && product.originalPrice > 0) {
    return `${Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)}% OFF`;
  }
  return null;
}

// ─── ProductCard ──────────────────────────────────────────────────────────────

const ProductCard = React.memo(function ProductCard({
  product,
  badge,
  className,
  compact = false,
  neutralBg = false,
  curvedInfo = false,
}) {
  const navigate = useNavigate();
  const { toggleWishlist: toggleWishlistGlobal, isInWishlist } = useWishlist();
  const { cart, addToCart, updateQuantity, removeFromCart } = useCart();
  const { showToast } = useToast();
  const { animateAddToCart, animateRemoveFromCart } = useCartAnimation();

  const [showHeartPopup, setShowHeartPopup] = React.useState(false);
  const imageRef = React.useRef(null);

  // Stable product IDs
  const productId = product.id || product._id;

  // Find cart item — memoized
  const cartItem = React.useMemo(() => {
    const pid = getComparableId(productId);
    return cart.find(
      (item) =>
        getComparableId(item.productId || item.itemId || item.id || item._id) === pid,
    );
  }, [cart, productId]);

  const quantity = cartItem ? cartItem.quantity : 0;
  const isWishlisted = isInWishlist(productId);

  // Resolve image once
  const resolvedImage = React.useMemo(
    () => resolveQuickImageUrl(product.image || product.mainImage) || product.image || product.mainImage,
    [product.image, product.mainImage],
  );

  // Compute srcSet once
  const srcSet = React.useMemo(
    () => getCloudinarySrcSet(product.image || product.mainImage),
    [product.image, product.mainImage],
  );

  // Badge text — compute once
  const badgeText = React.useMemo(() => getBadgeText(badge, product), [badge, product]);

  // Formatted prices — compute once
  const formattedPrice = React.useMemo(
    () => Number(product.price || 0).toLocaleString(),
    [product.price],
  );
  const formattedOriginalPrice = React.useMemo(
    () => Number(product.originalPrice || 0).toLocaleString(),
    [product.originalPrice],
  );

  const handleProductClick = React.useCallback(() => {
    if (!productId) return;
    navigate(getQuickProductPath(productId), { state: { product } });
  }, [navigate, productId, product]);

  const toggleWishlist = React.useCallback(
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
    [isWishlisted, toggleWishlistGlobal, product, showToast],
  );

  const handleAddToCart = React.useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      const stock = Number(product.stock ?? Infinity);
      if (stock <= 0) {
        showToast("This product is out of stock", "error");
        return;
      }
      if (imageRef.current) {
        animateAddToCart(imageRef.current.getBoundingClientRect(), resolvedImage);
      }
      addToCart(product);
    },
    [animateAddToCart, product, addToCart, resolvedImage, showToast],
  );

  const handleIncrement = React.useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      const stock = Number(product.stock ?? Infinity);
      if (quantity >= stock) {
        showToast(`Only ${stock} items are available in stock.`, "error");
        return;
      }
      updateQuantity(productId, 1);
    },
    [updateQuantity, productId, product.stock, quantity, showToast],
  );

  const handleDecrement = React.useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (quantity === 1) {
        animateRemoveFromCart(product.image);
        removeFromCart(productId);
      } else {
        updateQuantity(productId, -1);
      }
    },
    [quantity, animateRemoveFromCart, product.image, removeFromCart, productId, updateQuantity],
  );

  // Icon size — module-level constant (no per-render reflow)
  const heartSize = HEART_ICON_SIZE;

  return (
    <div
      className={cn(
        "flex-shrink-0 w-full flex flex-col h-full cursor-pointer group bg-transparent",
        className,
      )}
      onClick={handleProductClick}
    >
      <div className="flex flex-col h-full w-full rounded-xl overflow-hidden transition-all duration-500 product-card-container premium-wave-shimmer bg-[#FFF5F5] border border-red-100/50 shadow-sm hover:shadow-md">

        {/* Image Section */}
        <div className="relative overflow-hidden w-full h-[90px] md:h-[110px] p-1 md:p-2">
          {badgeText && (
            <div className="absolute top-0.5 left-0.5 z-10">
              <ScallopedBadge text={badgeText} />
            </div>
          )}

          <button
            onClick={toggleWishlist}
            className="absolute top-1 right-1 z-10 w-6 h-6 md:w-8 md:h-8 bg-white/90 backdrop-blur-md rounded-full shadow-sm flex items-center justify-center cursor-pointer hover:bg-white transition-all active:scale-90 border border-slate-100/50"
          >
            <motion.div
              whileTap={{ scale: 0.8 }}
              animate={isWishlisted ? HEART_ANIMATE : {}}
            >
              <Heart
                size={heartSize}
                className={cn(
                  isWishlisted
                    ? "text-red-500 fill-red-500"
                    : "text-slate-300 dark:text-slate-500 group-hover:text-slate-400 dark:group-hover:text-slate-300",
                )}
              />
            </motion.div>
          </button>

          <AnimatePresence>
            {showHeartPopup && (
              <motion.div
                initial={HEART_POPUP_INITIAL}
                animate={HEART_POPUP_ANIMATE}
                exit={{ opacity: 0 }}
                transition={HEART_POPUP_TRANSITION}
                className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none text-red-500/30"
              >
                <Heart size={48} fill="currentColor" />
              </motion.div>
            )}
          </AnimatePresence>

          <div className="w-full h-full rounded-md overflow-hidden bg-white flex items-center justify-center transition-transform duration-500 group-hover:scale-110">
            <img
              ref={imageRef}
              src={resolvedImage}
              srcSet={srcSet}
              sizes={IMG_SIZES}
              alt={product.name}
              className="w-full h-full object-contain mix-blend-multiply p-0.5 md:p-1"
              loading="lazy"
            />
          </div>
        </div>

        {/* Content Section */}
        <div className="flex flex-col flex-1 px-1.5 py-1 space-y-0.5 bg-[#FFF5F5] border-t border-red-100/30 relative product-content-area transition-all duration-300">
          <div className="space-y-0">
            <div className="flex items-center gap-1 text-[7.5px] md:text-[8px] text-slate-500 font-bold uppercase tracking-wider">
              <Clock size={7} className="text-emerald-600" />
              <span>{product.deliveryTime || "10 MINS"}</span>
            </div>
            <h3 className="text-[11px] md:text-[12.5px] font-bold text-slate-900 line-clamp-1 leading-tight">
              {product.name}
            </h3>
            <p className="text-[8px] md:text-[10px] text-slate-400 font-semibold italic">
              {product.weight || "1 unit"}
            </p>
          </div>

          <div className="mt-auto flex items-center justify-between gap-1 pt-0.5 border-t border-slate-200/20">
            <div className="flex flex-col justify-center">
              <span className="text-[12.5px] md:text-[14px] font-black text-slate-900 leading-none">
                ₹{formattedPrice}
              </span>
              {product.originalPrice > product.price && (
                <span className="text-[8.5px] md:text-[9.5px] text-slate-400 line-through font-bold leading-none mt-0.5">
                  ₹{formattedOriginalPrice}
                </span>
              )}
            </div>


          </div>
        </div>
      </div>
    </div>
  );
});

export default ProductCard;