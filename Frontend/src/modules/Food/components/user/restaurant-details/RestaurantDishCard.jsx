import { motion } from "framer-motion";
import { Bookmark, Share2, Clock, Plus, Minus } from "lucide-react";
import {
  getFoodDisplayPrice,
  getFoodVariants,
  hasFoodVariants,
} from "@food/utils/foodVariants";
import { FOOD_IMAGE_FALLBACK, RUPEE_SYMBOL } from "./restaurantDetailsUtils";

function VegIndicator({ isVeg }) {
  return (
    <div
      className={`h-4 w-4 border-2 flex items-center justify-center rounded-sm shrink-0 ${
        isVeg ? "border-green-600" : "border-red-600"
      }`}
    >
      <div className={`h-2 w-2 rounded-full ${isVeg ? "bg-green-600" : "bg-red-600"}`} />
    </div>
  );
}

function PriceBlock({ item }) {
  const price = getFoodDisplayPrice(item);
  const variants = getFoodVariants(item);

  let otherPrice = Number(item.otherPrice) || 0;
  if (variants.length > 0) {
    const validOtherPrices = variants.map((v) => Number(v.otherPrice) || 0).filter((p) => p > 0);
    if (validOtherPrices.length > 0) otherPrice = Math.min(...validOtherPrices);
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2 flex-wrap">
        <p className="text-lg font-black text-gray-900 dark:text-white">
          {RUPEE_SYMBOL}{Math.round(price)}
        </p>
        {item.preparationTime && String(item.preparationTime).trim() && (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
            <Clock className="h-3 w-3" />
            {String(item.preparationTime).trim()}
          </span>
        )}
      </div>
      {otherPrice > 0 && otherPrice > price && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-400 line-through">
            {RUPEE_SYMBOL}{Math.round(otherPrice)}
          </span>
          <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
            Save {RUPEE_SYMBOL}{Math.round(otherPrice - price)}
          </span>
        </div>
      )}
      {hasFoodVariants(item) && (
        <p className="text-[11px] font-medium text-gray-500">Customisable</p>
      )}
    </div>
  );
}

export default function RestaurantDishCard({
  item,
  quantity = 0,
  highlighted = false,
  disabled = false,
  isRecommended = false,
  isBookmarked = false,
  cardRef,
  onOpen,
  onBookmark,
  onShare,
  onDecrease,
  onIncrease,
}) {
  const isVeg = item.foodType === "Veg";

  return (
    <article
      ref={cardRef}
      onClick={onOpen}
      className={`group relative flex gap-4 p-4 sm:p-5 cursor-pointer transition-all duration-300 rounded-2xl border mb-3 ${
        highlighted
          ? "bg-red-50/80 border-[#FF0000] ring-2 ring-[#FF0000]/20 dark:bg-red-950/20"
          : "bg-white dark:bg-[#1a1a1a] border-gray-100 dark:border-gray-800 hover:shadow-md hover:border-gray-200"
      }`}
    >
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex items-center gap-2 mb-1.5">
          <VegIndicator isVeg={isVeg} />
          {item.isSpicy && (
            <span className="text-[11px] font-bold uppercase tracking-wide text-orange-600">Spicy</span>
          )}
          {isRecommended && (
            <span className="text-[11px] font-bold uppercase tracking-wide text-[#FF0000]">Bestseller</span>
          )}
        </div>

        <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white leading-snug pr-2">
          {item.name}
        </h3>

        {isRecommended && (
          <div className="flex items-center gap-2 mt-1.5 mb-1">
            <div className="h-1 w-14 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full w-3/4 bg-[#FF0000] rounded-full" />
            </div>
            <span className="text-[11px] text-gray-500 font-medium">Highly recommended</span>
          </div>
        )}

        <div className="mt-2">
          <PriceBlock item={item} />
        </div>

        {item.description && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 line-clamp-2 leading-relaxed">
            {item.description}
          </p>
        )}

        <div className="flex gap-2 mt-3 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={onBookmark}
            className={`p-2 rounded-xl border transition-colors ${
              isBookmarked
                ? "border-red-300 bg-red-50 text-red-600"
                : "border-gray-200 text-gray-500 hover:bg-gray-50"
            }`}
          >
            <Bookmark className={`h-4 w-4 ${isBookmarked ? "fill-current" : ""}`} />
          </button>
          <button
            type="button"
            onClick={onShare}
            className="p-2 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
          >
            <Share2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="relative w-[108px] sm:w-[120px] shrink-0">
        <div className="aspect-square w-full overflow-hidden rounded-2xl bg-gray-100 dark:bg-gray-800 shadow-sm">
          {item.image ? (
            <img
              src={item.image}
              alt={item.name}
              className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
              onError={(e) => {
                if (e.currentTarget.src !== FOOD_IMAGE_FALLBACK) {
                  e.currentTarget.src = FOOD_IMAGE_FALLBACK;
                }
              }}
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center text-xs text-gray-400">No image</div>
          )}
        </div>

        {quantity > 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className={`absolute -bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-xl px-3 py-1.5 shadow-lg border bg-white ${
              disabled ? "border-gray-200 opacity-50" : "border-[#FF0000]"
            }`}
          >
            <button type="button" disabled={disabled} onClick={onDecrease} className="text-[#FF0000] font-bold">
              <Minus className="h-4 w-4" />
            </button>
            <span className="text-sm font-bold min-w-[1rem] text-center">{quantity}</span>
            <button type="button" disabled={disabled} onClick={onIncrease} className="text-[#FF0000] font-bold">
              <Plus className="h-4 w-4" />
            </button>
          </motion.div>
        ) : (
          <motion.button
            type="button"
            disabled={disabled}
            onClick={onIncrease}
            className={`absolute -bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-xl px-4 py-1.5 text-sm font-bold shadow-lg border bg-white transition-colors ${
              disabled
                ? "border-gray-200 text-gray-400 cursor-not-allowed"
                : "border-[#FF0000] text-[#FF0000] hover:bg-red-50"
            }`}
          >
            ADD <Plus className="h-4 w-4 stroke-[3px]" />
          </motion.button>
        )}
      </div>
    </article>
  );
}
