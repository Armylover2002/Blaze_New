import React, { memo, useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Flame, X, Bookmark, Share2 } from "lucide-react";
import { restaurantAPI } from "@food/api";
import { useCart } from "@food/context/CartContext";

// Module-level cache: persists across component unmount/remount, avoids re-fetching same restaurants
const productsCache = new Map();

const ProductModal = ({ product, onClose, onAdd }) => {
  const [quantity, setQuantity] = useState(1);

  if (!product) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] bg-black/60 flex items-end sm:items-center justify-center sm:p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          className="bg-white w-full sm:w-[400px] sm:rounded-2xl rounded-t-2xl overflow-hidden flex flex-col max-h-[90vh]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header Image Area */}
          <div className="relative h-64 bg-gray-100">
            <button
              onClick={onClose}
              className="absolute top-4 left-4 z-10 p-2 bg-[#2d333b]/60 text-white rounded-full hover:bg-black/80 transition border-0 outline-none flex items-center justify-center"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="absolute bottom-[-20px] right-4 z-10 flex gap-2">
               <button className="p-2.5 bg-white text-gray-700 rounded-full shadow-md hover:bg-gray-50 transition border border-gray-100 outline-none flex items-center justify-center">
                 <Bookmark className="w-5 h-5" />
               </button>
               <button className="p-2.5 bg-white text-gray-700 rounded-full shadow-md hover:bg-gray-50 transition border border-gray-100 outline-none flex items-center justify-center">
                 <Share2 className="w-5 h-5" />
               </button>
            </div>
            <img
              src={product.image || product.imageUrl || "https://via.placeholder.com/400"}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          </div>

          {/* Details Area */}
          <div className="p-5 pt-8 flex-1 overflow-y-auto">
            <div className="flex items-start gap-2 mb-1">
              <div className={`mt-1.5 shrink-0 w-4 h-4 rounded-sm flex items-center justify-center border ${product.isVeg ? 'border-green-600' : 'border-red-600'}`}>
                <div className={`w-2 h-2 rounded-full ${product.isVeg ? 'bg-green-600' : 'bg-red-600'}`} />
              </div>
              <h2 className="text-xl font-bold text-gray-900 leading-tight">{product.name}</h2>
            </div>
            <p className="text-sm text-gray-500 mt-2">{product.description || "Delicious food item from our menu."}</p>
          </div>

          {/* Footer Area */}
          <div className="p-4 border-t border-gray-100 flex items-center justify-between gap-4 bg-white">
            <div className="flex items-center border border-gray-200 rounded-xl p-1 bg-white">
              <button 
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="w-10 h-10 flex items-center justify-center text-gray-500 hover:text-red-500 transition-colors border-0 outline-none bg-transparent"
              >
                -
              </button>
              <span className="w-10 text-center font-bold text-gray-800">{quantity}</span>
              <button 
                onClick={() => setQuantity(quantity + 1)}
                className="w-10 h-10 flex items-center justify-center text-gray-500 hover:text-red-500 transition-colors border-0 outline-none bg-transparent"
              >
                +
              </button>
            </div>
            
            <button
              onClick={() => onAdd(product, quantity)}
              className="flex-1 bg-[#ff3b30] hover:bg-[#ff2d20] text-white py-3.5 px-6 rounded-xl font-bold text-base flex justify-center items-center transition-colors shadow-sm border-0 outline-none"
            >
              Add item ₹{(product.price || 0) * quantity}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

const RecommendedSection = memo(({ recommendedForYouRestaurants }) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const { addToCart, cart, updateQuantity } = useCart();

  // Stable key derived from IDs — prevents unnecessary re-fetches when parent re-renders
  const restaurantIdsKey = useMemo(
    () => (recommendedForYouRestaurants || []).map(r => r.mongoId || r.id).join(","),
    [recommendedForYouRestaurants]
  );

  useEffect(() => {
    if (!restaurantIdsKey) return;

    // Serve from cache if available
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
              menu.sections.forEach(section => {
                if (section.items) {
                  section.items.forEach(item => {
                    items.push({
                      ...item,
                      restaurantId: restaurant.mongoId || restaurant.id,
                      restaurant: restaurant.name,
                      restaurantData: restaurant
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
        // Silently fail — section simply won't show
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [restaurantIdsKey]); // Stable string dependency — no spurious re-runs

  // Loading Skeleton
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
            <div key={i} className="bg-white rounded-[12px] border border-gray-100 overflow-hidden shadow-sm h-full flex flex-col animate-pulse">
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

  const handleAddToCart = (product, quantity) => {
    addToCart({
      ...product,
      quantity,
      price: product.price,
      name: product.name,
      restaurantId: product.restaurantId,
      restaurant: product.restaurant
    });
    setSelectedProduct(null);
  };

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
                onClick={() => setSelectedProduct(product)}
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
                  {product.isVeg && (
                    <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm border border-gray-200 px-1.5 py-0.5 rounded shadow-sm flex items-center">
                      <span className="text-[8px] font-bold text-green-700">VEG</span>
                    </div>
                  )}
                </div>
                <div className="p-3 flex flex-col flex-1">
                  <h4 className="font-bold text-sm text-[#1c1c1e] line-clamp-2">
                    {product.name}
                  </h4>
                  <p className="text-[10px] text-gray-500 mt-1 line-clamp-1 mb-auto">
                    {product.restaurant}
                  </p>
                  <div className="flex justify-between items-center mt-3 shrink-0">
                    <span className="text-sm font-bold text-[#1c1c1e]">
                      ₹{product.price || "199"}
                    </span>
                    {(() => {
                      const inCart = cart.some(item => (item.id === product.id || item.id === product._id || item.productId === (product.id || product._id)));
                      const cartItem = cart.find(item => (item.id === product.id || item.id === product._id || item.productId === (product.id || product._id)));
                      
                      if (inCart && cartItem) {
                        return (
                          <div className="flex items-center gap-1.5 border border-[#FF0000] rounded-[6px] bg-red-50 text-[#FF0000] overflow-hidden" onClick={(e) => e.stopPropagation()}>
                            <button
                              className="px-2 py-1 font-bold hover:bg-red-100 transition-colors border-0 outline-none"
                              onClick={(e) => {
                                e.stopPropagation();
                                updateQuantity(product._id || product.id, cartItem.quantity - 1, null, product);
                              }}
                            >
                              -
                            </button>
                            <span className="font-bold text-[10px] min-w-[12px] text-center">{cartItem.quantity}</span>
                            <button
                              className="px-2 py-1 font-bold hover:bg-red-100 transition-colors border-0 outline-none"
                              onClick={(e) => {
                                e.stopPropagation();
                                updateQuantity(product._id || product.id, cartItem.quantity + 1, null, product);
                              }}
                            >
                              +
                            </button>
                          </div>
                        );
                      }
                      
                      return (
                        <button 
                          className="bg-red-50 text-[#FF0000] font-bold text-[10px] px-4 py-1.5 rounded-[6px] transition-colors hover:bg-red-100 border-0 outline-none"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedProduct(product);
                          }}
                        >
                          ADD
                        </button>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </motion.div>
        ))}
      </div>

      {selectedProduct && (
        <ProductModal 
          product={selectedProduct} 
          onClose={() => setSelectedProduct(null)} 
          onAdd={handleAddToCart}
        />
      )}
    </motion.section>
  );
});

export default RecommendedSection;
