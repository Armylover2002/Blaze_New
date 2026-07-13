import React, { memo, useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { restaurantAPI } from "@food/api";
import { useCart } from "@food/context/CartContext";
import RestaurantItemDetailSheet from "@food/components/user/restaurant-details/sheets/RestaurantItemDetailSheet";
import {
  buildCartLineId,
  getDefaultFoodVariant,
  getFoodDisplayPrice,
  getFoodPriceLabel,
  getFoodVariants,
  hasFoodVariants,
} from "@food/utils/foodVariants";

const productsCache = new Map();

const RecommendedSection = memo(({ recommendedForYouRestaurants }) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showItemDetail, setShowItemDetail] = useState(false);
  const [selectedItemImageIndex, setSelectedItemImageIndex] = useState(0);
  const [selectedVariantId, setSelectedVariantId] = useState("");
  const { addToCart, updateQuantity, removeFromCart, getCartItem, cart } = useCart();

  const restaurantIdsKey = useMemo(
    () => (recommendedForYouRestaurants || []).map((r) => r.mongoId || r.id).join(","),
    [recommendedForYouRestaurants],
  );

  useEffect(() => {
    if (!restaurantIdsKey) return;

    if (productsCache.has(restaurantIdsKey)) {
      setProducts(productsCache.get(restaurantIdsKey));
      return;
    }

    const fetchProducts = async () => {
      setLoading(true);
      try {
        const restaurantsToFetch = (recommendedForYouRestaurants || []).slice(0, 3);
        const fetchPromises = restaurantsToFetch.map(async (restaurant) => {
          try {
            const res = await restaurantAPI.getMenuByRestaurantId(restaurant.mongoId || restaurant.id);
            const menu = res.data?.data?.menu;
            const items = [];
            if (menu?.sections) {
              menu.sections.forEach((section) => {
                if (section.items) {
                  section.items.forEach((item) => {
                    items.push({
                      ...item,
                      restaurantId: restaurant.mongoId || restaurant.id,
                      restaurant: restaurant.name,
                      restaurantData: restaurant,
                    });
                  });
                }
              });
            }
            return items;
          } catch {
            return [];
          }
        });

        const results = await Promise.all(fetchPromises);
        const allProducts = results.flat().slice(0, 6);
        productsCache.set(restaurantIdsKey, allProducts);
        setProducts(allProducts);
      } catch {
        // Silently fail
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [restaurantIdsKey]);

  useEffect(() => {
    if (!selectedProduct) {
      setSelectedVariantId("");
      return;
    }
    const defaultVariant = getDefaultFoodVariant(selectedProduct);
    setSelectedVariantId(defaultVariant?.id || "");
  }, [selectedProduct]);

  const getVariantForDish = (item, preferredVariantId = "") => {
    const variants = getFoodVariants(item);
    if (variants.length === 0) return null;
    return (
      variants.find((variant) => String(variant.id) === String(preferredVariantId || "")) ||
      variants[0]
    );
  };

  const getLineItemIdForDish = (item, variant = null) =>
    buildCartLineId(item?.id || item?._id || "", variant?.id || variant?._id || "");

  const getDishQuantity = (item, preferredVariantId = "") => {
    const variant = getVariantForDish(item, preferredVariantId);
    const lineItemId = getLineItemIdForDish(item, variant);
    const cartItem = cart.find((entry) => entry.id === lineItemId);
    return cartItem?.quantity || 0;
  };

  const updateItemQuantity = (item, newQuantity, event = null, preferredVariant = null) => {
    const resolvedVariant = preferredVariant || getDefaultFoodVariant(item);
    const lineItemId = getLineItemIdForDish(item, resolvedVariant);
    const itemId = String(item.id || item._id || "");

    const cartItem = {
      id: lineItemId,
      lineItemId,
      itemId,
      name: item.name,
      price: resolvedVariant?.price ?? getFoodDisplayPrice(item),
      otherPrice: resolvedVariant?.otherPrice ?? item.otherPrice ?? 0,
      variantId: resolvedVariant?.id || "",
      variantName: resolvedVariant?.name || "",
      variantPrice: resolvedVariant?.price ?? getFoodDisplayPrice(item),
      image: item.image,
      restaurant: item.restaurant,
      restaurantId: item.restaurantId,
      description: item.description,
      isVeg: item.foodType === "Veg" || item.isVeg === true,
      preparationTime: item.preparationTime,
    };

    if (newQuantity <= 0) {
      removeFromCart(lineItemId);
      return;
    }

    const existingCartItem = getCartItem(lineItemId);
    if (existingCartItem) {
      updateQuantity(lineItemId, newQuantity);
      return;
    }

    const result = addToCart(cartItem);
    if (result?.ok === false) {
      toast.error(result.error || "Cannot add item to cart.");
      return;
    }
    if (newQuantity > 1) {
      updateQuantity(lineItemId, newQuantity);
    }
  };

  const openProductDetail = (product) => {
    setSelectedProduct(product);
    setSelectedItemImageIndex(0);
    setShowItemDetail(true);
  };

  const handleProductAddClick = (product, event) => {
    event.stopPropagation();
    if (hasFoodVariants(product)) {
      openProductDetail(product);
      return;
    }
    updateItemQuantity(product, 1);
  };

  if (loading) {
    return (
      <section className="mt-8 px-4" data-purpose="recommended-section">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
            Recommended for you
          </h3>
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="bg-white rounded-[12px] border border-gray-100 overflow-hidden shadow-sm h-full flex flex-col animate-pulse"
            >
              <div className="h-32 sm:h-36 bg-gray-200 shrink-0" />
              <div className="p-3 flex flex-col flex-1">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                <div className="h-3 bg-gray-200 rounded w-1/2 mt-1 mb-auto" />
                <div className="flex justify-between items-center mt-3 shrink-0">
                  <div className="h-4 bg-gray-200 rounded w-1/4" />
                  <div className="h-6 bg-gray-200 rounded w-1/4" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (!products || products.length === 0) return null;

  return (
    <motion.section
      className="mt-8 px-4"
      data-purpose="recommended-section"
      initial={false}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
          Recommended for you
        </h3>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 lg:gap-5">
        {products.map((product, index) => (
          <motion.div
            key={`recommended-prod-${product._id || product.id || index}`}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.35, delay: index * 0.05 }}
          >
            <div
              onClick={() => openProductDetail(product)}
              className="bg-white rounded-[12px] border border-gray-100 overflow-hidden shadow-sm block hover:shadow-md transition-shadow cursor-pointer h-full flex flex-col"
              data-purpose="product-card"
            >
              <div className="relative h-32 sm:h-36 bg-gray-100 shrink-0">
                <img
                  src={product.image || product.imageUrl || "https://via.placeholder.com/150"}
                  alt={product.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                {product.foodType === "Veg" || product.isVeg ? (
                  <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm border border-gray-200 px-1.5 py-0.5 rounded shadow-sm flex items-center">
                    <span className="text-[8px] font-bold text-green-700">VEG</span>
                  </div>
                ) : null}
              </div>
              <div className="p-3 flex flex-col flex-1">
                <h4 className="font-bold text-sm text-[#1c1c1e] line-clamp-2">{product.name}</h4>
                <p className="text-[10px] text-gray-500 mt-1 line-clamp-1 mb-auto">
                  {product.restaurant}
                </p>
                <div className="flex justify-between items-center mt-3 shrink-0">
                  <span className="text-sm font-bold text-[#1c1c1e]">
                    {getFoodPriceLabel(product)}
                  </span>
                  <button
                    type="button"
                    className="bg-red-50 text-[#FF0000] font-bold text-[10px] px-4 py-1.5 rounded-[6px] transition-colors hover:bg-red-100 border-0 outline-none"
                    onClick={(e) => handleProductAddClick(product, e)}
                  >
                    ADD
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <RestaurantItemDetailSheet
        open={showItemDetail}
        onClose={() => {
          setShowItemDetail(false);
          setSelectedProduct(null);
        }}
        selectedItem={selectedProduct}
        selectedItemImageIndex={selectedItemImageIndex}
        setSelectedItemImageIndex={setSelectedItemImageIndex}
        selectedVariantId={selectedVariantId}
        setSelectedVariantId={setSelectedVariantId}
        restaurant={selectedProduct?.restaurantData || { name: selectedProduct?.restaurant }}
        shouldShowGrayscale={false}
        isRecommendedItem={() => true}
        showBookmark={false}
        showShare={false}
        getDishQuantity={getDishQuantity}
        updateItemQuantity={updateItemQuantity}
        getVariantForDish={getVariantForDish}
      />
    </motion.section>
  );
});

export default RecommendedSection;
