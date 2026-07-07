import { motion, AnimatePresence } from "framer-motion"
import { X, ChevronLeft, ChevronRight, Bookmark, Share2, Plus, Minus } from "lucide-react"
import { Button } from "@food/components/ui/button"
import { RUPEE_SYMBOL } from "../restaurantDetailsUtils"
import { getFoodVariants, hasFoodVariants } from "@food/utils/foodVariants"
import BottomSheetPortal from "./BottomSheetPortal"

export default function RestaurantItemDetailSheet({
  open,
  onClose,
  selectedItem,
  selectedItemImageIndex,
  setSelectedItemImageIndex,
  selectedVariantId,
  setSelectedVariantId,
  restaurant,
  shouldShowGrayscale,
  isRecommendedItem,
  handleBookmarkClick,
  isDishFavorite,
  getDishQuantity,
  updateItemQuantity,
  getVariantForDish,
}) {
  if (!selectedItem) return null;
  return (
    <BottomSheetPortal open={open} onClose={onClose} sheetClassName="fixed left-0 right-0 bottom-0 md:left-1/2 md:right-auto md:-translate-x-1/2 md:bottom-auto md:top-1/2 md:-translate-y-1/2 z-[10000] bg-white dark:bg-[#1a1a1a] rounded-t-3xl md:rounded-3xl shadow-2xl w-full md:w-auto flex flex-col max-h-[90vh] md:max-w-2xl lg:max-w-3xl">
      {/* Close Button - Top Center Above Popup with 4px gap */}
                  <div className="absolute -top-[44px] left-1/2 -translate-x-1/2 z-[10001]">
                    <motion.button
                      onClick={() => onClose()}
                      className="h-10 w-10 rounded-full bg-gray-800 flex items-center justify-center hover:bg-gray-900 transition-colors shadow-lg"
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                    >
                      <X className="h-5 w-5 text-white" />
                    </motion.button>
                  </div>

                  {/* Image Section */}
                  <div className="relative w-full h-64 overflow-hidden rounded-t-3xl bg-gray-100 dark:bg-gray-800">
                    {(() => {
                      const allImages = (selectedItem.images || []).filter(img => img && typeof img === 'string');
                      if (selectedItem.image && !allImages.includes(selectedItem.image)) {
                        allImages.unshift(selectedItem.image);
                      }

                      if (allImages.length === 0) {
                        return (
                          <div className="w-full h-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                            <span className="text-sm text-gray-400">No image available</span>
                          </div>
                        )
                      }

                      return (
                        <div className="relative w-full h-full">
                          <AnimatePresence mode="wait">
                            <motion.img
                              key={selectedItemImageIndex}
                              src={allImages[selectedItemImageIndex]}
                              alt={`${selectedItem.name} - Image ${selectedItemImageIndex + 1}`}
                              className="w-full h-full object-cover"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 0.2 }}
                            />
                          </AnimatePresence>

                          {/* Navigation Chevrons */}
                          {allImages.length > 1 && (
                            <>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedItemImageIndex(prev => (prev - 1 + allImages.length) % allImages.length);
                                }}
                                className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/85 dark:bg-black/70 backdrop-blur-sm rounded-full flex items-center justify-center shadow hover:bg-white dark:hover:bg-black transition-all z-10"
                              >
                                <ChevronLeft className="w-4 h-4 text-gray-900 dark:text-white" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedItemImageIndex(prev => (prev + 1) % allImages.length);
                                }}
                                className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/85 dark:bg-black/70 backdrop-blur-sm rounded-full flex items-center justify-center shadow hover:bg-white dark:hover:bg-black transition-all z-10"
                              >
                                <ChevronRight className="w-4 h-4 text-gray-900 dark:text-white" />
                              </button>

                              {/* Slide Counter Overlay */}
                              <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-sm px-2.5 py-1 rounded-full z-10">
                                <span className="text-white text-[10px] font-semibold">
                                  {selectedItemImageIndex + 1} / {allImages.length}
                                </span>
                              </div>

                              {/* Indicators at the bottom */}
                              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-10">
                                {allImages.map((_, idx) => (
                                  <button
                                    key={idx}
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedItemImageIndex(idx);
                                    }}
                                    className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${idx === selectedItemImageIndex ? "bg-white scale-125" : "bg-white/50"
                                      }`}
                                  />
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                      )
                    })()}
                    {/* Bookmark and Share Icons Overlay */}
                    <div className="absolute bottom-4 right-4 flex items-center gap-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleBookmarkClick(selectedItem)
                        }}
                        className={`h-10 w-10 rounded-full border flex items-center justify-center transition-all duration-300 ${isDishFavorite(selectedItem.id, restaurant?.restaurantId || restaurant?._id || restaurant?.id)
                          ? "border-red-500 dark:border-red-400 bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-400"
                          : "border-white dark:border-gray-800 bg-white/90 dark:bg-[#1a1a1a]/90 text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-[#2a2a2a]"
                          }`}
                      >
                        <Bookmark
                          className={`h-5 w-5 transition-all duration-300 ${isDishFavorite(selectedItem.id, restaurant?.restaurantId || restaurant?._id || restaurant?.id) ? "fill-red-500 dark:fill-red-400" : ""
                            }`}
                        />
                      </button>
                      <button className="h-10 w-10 rounded-full border border-white dark:border-gray-800 bg-white/90 dark:bg-[#1a1a1a]/90 text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-[#2a2a2a] flex items-center justify-center transition-colors">
                        <Share2 className="h-5 w-5" />
                      </button>
                    </div>
                  </div>

                  {/* Content Section */}
                  <div className="flex-1 overflow-y-auto px-4 py-4">
                    {/* Item Name and Indicator */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2 flex-1">
                        <div className="h-5 w-5 rounded border-2 border-amber-700 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                          <div className="h-2.5 w-2.5 rounded-full bg-amber-700 dark:bg-amber-600" />
                        </div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                          {selectedItem.name}
                        </h2>
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 leading-relaxed">
                      {selectedItem.description}
                    </p>

                    {/* Highly Recommended Progress Bar */}
                    {isRecommendedItem(selectedItem) && (
                      <div className="flex items-center gap-2 mb-4">
                        <div className="flex-1 h-0.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div className="h-full bg-green-500 dark:bg-green-400 rounded-full" style={{ width: '50%' }} />
                        </div>
                        <span className="text-xs text-gray-600 dark:text-gray-400 font-medium whitespace-nowrap">
                          highly recommended
                        </span>
                      </div>
                    )}

                    {/* Not Eligible for Coupons */}
                    {selectedItem.notEligibleForCoupons && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-4">
                        NOT ELIGIBLE FOR COUPONS
                      </p>
                    )}

                    {hasFoodVariants(selectedItem) && (
                      <div className="mb-4">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Choose a variant</p>
                        <div className="flex flex-wrap gap-2">
                          {getFoodVariants(selectedItem).map((variant) => (
                            <button
                              key={variant.id}
                              type="button"
                              onClick={() => setSelectedVariantId(variant.id)}
                              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${String(selectedVariantId || "") === String(variant.id)
                                  ? "border-red-500 bg-red-50 text-red-600 dark:border-red-400 dark:bg-red-900/30 dark:text-red-200"
                                  : "border-gray-200 bg-white text-gray-700 dark:border-gray-700 dark:bg-[#2a2a2a] dark:text-gray-300"
                                }`}
                            >
                              {variant.name} · {RUPEE_SYMBOL}{Math.round(variant.price)}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Bottom Action Bar */}
                  <div className="border-t border-gray-200 dark:border-gray-800 px-4 py-4 bg-white dark:bg-[#1a1a1a]">
                    <div className="flex items-center gap-4">
                      {/* Quantity Selector */}
                      <div className={`flex items-center gap-3 border-2 rounded-lg px-3 h-[44px] bg-white dark:bg-[#2a2a2a] ${shouldShowGrayscale
                        ? 'border-gray-300 dark:border-gray-700 opacity-50'
                        : 'border-gray-300 dark:border-gray-700'
                        }`}>
                        <button
                          onClick={(e) => {
                            if (!shouldShowGrayscale) {
                              updateItemQuantity(
                                selectedItem,
                                Math.max(0, getDishQuantity(selectedItem, selectedVariantId) - 1),
                                e,
                                getVariantForDish(selectedItem, selectedVariantId),
                              )
                            }
                          }}
                          disabled={getDishQuantity(selectedItem, selectedVariantId) === 0 || shouldShowGrayscale}
                          className={`${shouldShowGrayscale
                            ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white disabled:text-gray-300 dark:disabled:text-gray-600 disabled:cursor-not-allowed'
                            }`}
                        >
                          <Minus className="h-5 w-5" />
                        </button>
                        <span className={`text-lg font-semibold min-w-[2rem] text-center ${shouldShowGrayscale
                          ? 'text-gray-400 dark:text-gray-600'
                          : 'text-gray-900 dark:text-white'
                          }`}>
                          {getDishQuantity(selectedItem, selectedVariantId)}
                        </span>
                        <button
                          onClick={(e) => {
                            if (!shouldShowGrayscale) {
                              updateItemQuantity(
                                selectedItem,
                                getDishQuantity(selectedItem, selectedVariantId) + 1,
                                e,
                                getVariantForDish(selectedItem, selectedVariantId),
                              )
                            }
                          }}
                          disabled={shouldShowGrayscale}
                          className={shouldShowGrayscale
                            ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                          }
                        >
                          <Plus className="h-5 w-5" />
                        </button>
                      </div>

                      {/* Add Item Button */}
                      <Button
                        className={`flex-1 h-[44px] rounded-lg font-semibold flex items-center justify-center gap-2 ${shouldShowGrayscale
                          ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-600 cursor-not-allowed opacity-50'
                          : 'bg-red-500 hover:bg-red-600 text-white'
                          }`}
                        onClick={(e) => {
                          if (!shouldShowGrayscale) {
                            updateItemQuantity(
                              selectedItem,
                              getDishQuantity(selectedItem, selectedVariantId) + 1,
                              e,
                              getVariantForDish(selectedItem, selectedVariantId),
                            )
                            onClose()
                          }
                        }}
                        disabled={shouldShowGrayscale}
                      >
                        <span>Add item</span>
                        <div className="flex items-center gap-1">
                          {selectedItem.originalPrice && selectedItem.originalPrice > selectedItem.price && (
                            <span className="text-sm line-through text-red-200">
                              {RUPEE_SYMBOL}{Math.round(selectedItem.originalPrice)}
                            </span>
                          )}
                          <span className="text-base font-bold">
                            {hasFoodVariants(selectedItem)
                              ? `${getVariantForDish(selectedItem, selectedVariantId)?.name || "Default"} · ${RUPEE_SYMBOL}${Math.round(getVariantForDish(selectedItem, selectedVariantId)?.price || selectedItem.price)}`
                              : `${RUPEE_SYMBOL}${Math.round(selectedItem.price)}`}
                          </span>
                        </div>
                      </Button>
                    </div>
                  </div>
    </BottomSheetPortal>
  );
}
