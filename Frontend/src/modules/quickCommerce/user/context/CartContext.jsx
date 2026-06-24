import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ShoppingBag } from "lucide-react";
import { customerApi } from "../services/customerApi";
import { useAuth } from "@core/context/AuthContext";
import { useCart as useFoodCart } from "@food/context/CartContext";
import { useToast } from "@shared/components/ui/Toast";
import { getCartLineId, getVariantKey } from "../components/pharmacy/pharmacyProductMeta";

const CartContext = createContext();
const QUICK_CART_STORAGE_KEY = "quick_commerce_cart";

export const useCart = () => useContext(CartContext);

const isQuickCartItem = (item) => {
  if (!item || typeof item !== "object") return false;
  if (item.orderType === "quick" || item.type === "quick") return true;

  return Boolean(
    item.quickStoreId ||
      item.storeId ||
      item.store?.id ||
      item.store?._id ||
      item.sellerId ||
      item.seller?.id ||
      item.seller?._id,
  );
};

const readStoredQuickCart = () => {
  try {
    const quickCart = localStorage.getItem(QUICK_CART_STORAGE_KEY);
    if (quickCart) {
      const parsedQuickCart = JSON.parse(quickCart);
      return Array.isArray(parsedQuickCart)
        ? parsedQuickCart.filter(isQuickCartItem)
        : [];
    }

    const legacyCart = localStorage.getItem("cart");
    if (!legacyCart) return [];

    const parsedLegacyCart = JSON.parse(legacyCart);
    const quickItems = Array.isArray(parsedLegacyCart)
      ? parsedLegacyCart.filter(isQuickCartItem)
      : [];

    if (quickItems.length > 0) {
      localStorage.setItem(QUICK_CART_STORAGE_KEY, JSON.stringify(quickItems));
    }
    return quickItems;
  } catch (error) {
    console.error("Failed to load quick cart from localStorage", error);
    return [];
  }
};

const normalizeProductId = (value) => {
  const rawValue = String(value ?? "").trim();
  if (!rawValue) return "";
  return rawValue.split("::")[0];
};

const getCartLineKey = (itemOrProduct) =>
  String(
    itemOrProduct?.id ||
      itemOrProduct?._id ||
      itemOrProduct?.productId ||
      itemOrProduct?.itemId ||
      "",
  ).trim();

const getProductId = (product) =>
  normalizeProductId(
    product?.productId || product?.itemId || product?.id || product?._id,
  );

const QUICK_COMMERCE_PLACEHOLDER_SELLER = "quick-commerce";

const resolveQuickSellerId = (product = {}) => {
  if (!product || typeof product !== "object") return "";

  const candidates = [
    product.sellerId,
    product.seller?._id,
    product.seller?.id,
    product.quickStoreId,
    product.restaurantId,
    product.sourceId,
    product.storeId,
    product.store?._id,
    product.store?.id,
    product.storeId?._id,
    product.storeId?.id,
    product.restaurant?._id,
  ];

  for (const candidate of candidates) {
    const raw = candidate?._id ?? candidate?.id ?? candidate;
    const str = String(raw ?? "").trim();
    if (!str || str === QUICK_COMMERCE_PLACEHOLDER_SELLER) continue;
    if (/^[a-fA-F0-9]{24}$/.test(str)) return str;
  }
  return "";
};

const getQuickStoreName = (product) =>
  product?.restaurant ||
  product?.restaurantName ||
  product?.storeName ||
  product?.store?.name ||
  product?.storeId?.name ||
  product?.seller?.name ||
  product?.sellerId?.name ||
  "Quick Commerce";

const getQuickStoreId = (product) =>
  resolveQuickSellerId(product) || QUICK_COMMERCE_PLACEHOLDER_SELLER;

const normalizeQuickSellerId = (item) => resolveQuickSellerId(item);

const getCartSellerIds = (cartItems = []) => {
  if (!Array.isArray(cartItems) || cartItems.length === 0) return new Set();
  return new Set(
    cartItems.map((item) => getQuickStoreId(item)).filter(Boolean),
  );
};

const checkSellerConflict = (cartItems, product) => {
  if (!Array.isArray(cartItems) || cartItems.length === 0) return null;

  const productSellerId = getQuickStoreId(product);
  if (!productSellerId) return null;

  const cartSellerIds = getCartSellerIds(cartItems);
  if (cartSellerIds.size === 0) return null;
  if (cartSellerIds.has(productSellerId)) return null;

  const cartItem =
    cartItems.find((item) => getQuickStoreId(item) && cartSellerIds.has(getQuickStoreId(item))) ||
    cartItems[0];

  return {
    code: "SELLER_MISMATCH",
    cartSellerName: getQuickStoreName(cartItem),
    productSellerName: getQuickStoreName(product),
  };
};

const normalizeQuickProductForSharedCart = (product) => {
  const lineKey = getCartLineKey(product);
  const id = getProductId(product);
  const sellerId = resolveQuickSellerId(product);
  const quickStoreId = sellerId || getQuickStoreId(product);
  const quickStoreName = getQuickStoreName(product);
  const salePrice = Number(product?.salePrice || 0);
  const basePrice = Number(product?.price || 0);
  const originalPrice = Number(
    product?.originalPrice ?? product?.mrp ?? product?.price ?? salePrice ?? 0,
  );

  return {
    ...product,
    id: lineKey || id,
    _id: lineKey || product?._id || id,
    productId: id,
    orderType: "quick",
    type: "quick",
    image: product?.image || product?.mainImage,
    mainImage: product?.mainImage || product?.image,
    price: salePrice > 0 ? salePrice : basePrice,
    salePrice,
    mrp: originalPrice,
    originalPrice,
    quickStoreName,
    quickStoreId,
    sellerId,
    sourceId: quickStoreId,
    sourceName: quickStoreName,
    restaurant: quickStoreName,
    restaurantId: quickStoreId,
  };
};

const shrinkCartItem = (item) => {
  if (!item) return null;
  // Only keep essential fields to minimize localStorage footprint and avoid QuotaExceededError
  return {
    id: item.id || item._id,
    _id: item._id || item.id,
    productId: item.productId || item.id || item._id,
    name: item.name,
    price: Number(item.price || 0),
    salePrice: Number(item.salePrice || 0),
    mrp: Number(item.mrp || 0),
    originalPrice: Number(item.originalPrice || 0),
    quantity: Number(item.quantity || 0),
    stock: Number(item.stock ?? 0),
    image: item.image,
    mainImage: item.mainImage,
    weight: item.weight,
    unit: item.unit,
    categoryId: item.categoryId || null,
    subcategoryId: item.subcategoryId || null,
    headerId: item.headerId || null,
    sellerId: item.sellerId || resolveQuickSellerId(item),
    quickStoreId: item.quickStoreId || resolveQuickSellerId(item),
    quickStoreName: item.quickStoreName,
    // Pharmacy UI metadata (UI-only; safe to persist for richer rows)
    pharmacyDetails: item.pharmacyDetails || null,
    selectedVariant: item.selectedVariant
      ? {
          _id: item.selectedVariant._id || item.selectedVariant.id || "",
          name: item.selectedVariant.name || "",
          strength: item.selectedVariant.strength || "",
          packType: item.selectedVariant.packType || "",
          packQuantity: item.selectedVariant.packQuantity ?? "",
          unit: item.selectedVariant.unit || "",
          sku: item.selectedVariant.sku || "",
          price: Number(item.selectedVariant.price || 0),
          salePrice: Number(item.selectedVariant.salePrice || 0),
          stock: Number(item.selectedVariant.stock ?? 0),
        }
      : null,
    variants: Array.isArray(item.variants)
      ? item.variants.slice(0, 2).map((v) => ({
          name: v?.name,
          strength: v?.strength,
          packType: v?.packType,
          packQuantity: v?.packQuantity,
          unit: v?.unit,
        }))
      : [],
    orderType: "quick",
    type: "quick",
  };
};

const persistQuickCartSnapshot = (items) => {
  try {
    if (Array.isArray(items) && items.length > 0) {
      const shrunkItems = items.map(shrinkCartItem).filter(Boolean);
      localStorage.setItem(QUICK_CART_STORAGE_KEY, JSON.stringify(shrunkItems));
    } else {
      localStorage.removeItem(QUICK_CART_STORAGE_KEY);
    }
  } catch (error) {
    if (error.name === "QuotaExceededError") {
      console.warn("Storage quota exceeded. Attempting to clear space...");
      try {
        // Fallback: remove non-essential keys if needed, or just clear this specific key
        // For now, we've shrunk the items, if it still fails, it's a very large cart
        // or other data is hogging space.
        const legacyKeys = [
          "cart",
          "recent_searches",
          "search_history",
          "appzeto_recent_searches",
          "user_recent_searches_v1",
        ];
        legacyKeys.forEach(key => {
            if (key !== QUICK_CART_STORAGE_KEY) localStorage.removeItem(key);
        });
      } catch (e) {
        console.error("Critical storage failure", e);
      }
    }
    console.error("Failed to persist quick cart snapshot", error);
  }

  // Also sync with legacy 'cart' key to ensure Food module sees these changes
  // This prevents items from reappearing when navigating back to Food-bridged pages
  try {
    const legacyCart = localStorage.getItem("cart");
    if (legacyCart) {
      const parsed = JSON.parse(legacyCart);
      if (Array.isArray(parsed)) {
        const otherItems = parsed.filter((item) => !isQuickCartItem(item));
        const nextLegacyCart = [...otherItems, ...items];
        if (nextLegacyCart.length > 0) {
          localStorage.setItem("cart", JSON.stringify(nextLegacyCart));
        } else {
          localStorage.removeItem("cart");
        }
      }
    }
  } catch (e) {
    // ignore legacy sync errors
  }
};

const useStandaloneQuickCart = (isBridged = false) => {
  const { isAuthenticated } = useAuth();
  const { showToast } = useToast();
  const [cart, setCart] = useState(() => readStoredQuickCart());

  const [loading, setLoading] = useState(Boolean(isAuthenticated));
  const pendingRequestsRef = useRef(0);

  const normalizeBackendCart = (items) => {
    if (!items) return [];
    return items.map((item) => {
      const productId = getProductId(item);
      const variantName = String(item.variantName || item.selectedVariant?.name || "").trim();
      const variantKey = String(
        item.variantKey || item.selectedVariant?._id || item.selectedVariant?.id || "",
      ).trim();
      const selectedVariant =
        item.selectedVariant ||
        (variantName
          ? {
              _id: variantKey,
              name: variantName,
              sku: item.variantSku || "",
              price: Number(item.price || 0),
              salePrice: Number(item.price || 0),
              stock: Number(item.stock ?? 0),
            }
          : null);
      const lineId = getCartLineId(productId, selectedVariant);

      return {
        ...item,
        quickStoreId: resolveQuickSellerId(item) || getQuickStoreId(item),
        quickStoreName: getQuickStoreName(item),
        sellerId: item.sellerId || resolveQuickSellerId(item),
        id: lineId,
        _id: lineId,
        productId,
        itemId: productId,
        quantity: Number(item.quantity || 1),
        stock: Number(item.stock ?? 0),
        categoryId: item.categoryId || null,
        subcategoryId: item.subcategoryId || null,
        headerId: item.headerId || null,
        image: item.mainImage || item.image || "",
        mainImage: item.mainImage || item.image || "",
        price: Number(item.price || 0),
        mrp: Number(item.mrp || item.price || 0),
        variantName,
        variantKey,
        variantSku: item.variantSku || "",
        selectedVariant,
        orderType: "quick",
        type: "quick",
        sourceId: resolveQuickSellerId(item) || getQuickStoreId(item),
        sourceName: getQuickStoreName(item),
        restaurant: getQuickStoreName(item),
        restaurantId: resolveQuickSellerId(item) || getQuickStoreId(item),
      };
    });
  };

  const syncCart = (backendItems) => {
    if (pendingRequestsRef.current === 0) {
      setCart(normalizeBackendCart(backendItems));
    }
  };

  const fetchCart = async () => {
    if (isAuthenticated) {
      setLoading(true);
      try {
        const response = await customerApi.getCart();
        const items = response.data?.result?.items || response.data?.items || [];
        const normalizedItems = normalizeBackendCart(items);
        setCart(normalizedItems);
        persistQuickCartSnapshot(normalizedItems);
      } catch (error) {
        console.error("Failed to fetch cart from backend", error);
      } finally {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchCart();
    } else {
      try {
        setLoading(false);
        setCart(readStoredQuickCart());
      } catch (error) {
        setCart([]);
      }
    }
  }, [isAuthenticated]);

  // Sync cart when localStorage changes (e.g., cleared from another tab or bridged mode)
  useEffect(() => {
    if (isBridged) return;
    const handleStorage = (e) => {
      if (e.key === QUICK_CART_STORAGE_KEY) {
        if (!e.newValue) {
          setCart([]);
        } else {
          try {
            const parsed = JSON.parse(e.newValue);
            if (Array.isArray(parsed)) setCart(parsed);
          } catch {}
        }
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [isBridged]);

  useEffect(() => {
    if (!isBridged) {
      persistQuickCartSnapshot(cart);
    }
  }, [cart, isBridged]);

  const addToCart = async (product, { skipSellerCheck = false } = {}) => {
    const lineKey = getCartLineKey(product);
    const apiProductId = getProductId(product);
    if (!lineKey || !apiProductId) return { ok: false, code: "INVALID_PRODUCT" };

    if (!skipSellerCheck) {
      const conflict = checkSellerConflict(cart, product);
      if (conflict) {
        return { ok: false, ...conflict, product };
      }
    }

    const existingItem = cart.find((item) => getCartLineKey(item) === lineKey);
    const stock = Number(product.stock ?? (existingItem ? existingItem.stock : 0) ?? 0);
    const currentQty = existingItem ? existingItem.quantity : 0;
    const targetQty = currentQty + 1;

    if (targetQty > stock) {
      showToast(`Only ${stock} items are available in stock.`, "error");
      return { ok: false, code: "OUT_OF_STOCK" };
    }

    const resolvedSellerId = resolveQuickSellerId(product);

    setCart((prev) => {
      const existing = prev.find((item) => getCartLineKey(item) === lineKey);
      if (existing) {
        return prev.map((item) =>
          getCartLineKey(item) === lineKey ? { ...item, quantity: item.quantity + 1 } : item,
        );
      }
      return [
        ...prev,
        {
          ...product,
          id: lineKey,
          _id: lineKey,
          productId: apiProductId,
          itemId: apiProductId,
          orderType: "quick",
          type: "quick",
          sellerId: resolvedSellerId,
          quickStoreId: resolvedSellerId || getQuickStoreId(product),
          quickStoreName: getQuickStoreName(product),
          sourceId: resolvedSellerId || getQuickStoreId(product),
          sourceName: getQuickStoreName(product),
          restaurant: getQuickStoreName(product),
          restaurantId: getQuickStoreId(product),
          quantity: 1,
          stock,
          categoryId: product.categoryId || null,
          subcategoryId: product.subcategoryId || null,
          headerId: product.headerId || null,
          image: product.image || product.mainImage,
          mainImage: product.mainImage || product.image,
        },
      ];
    });

    if (isAuthenticated) {
      pendingRequestsRef.current += 1;
      try {
        const response = await customerApi.addToCart({
          productId: apiProductId,
          quantity: 1,
          variantName: product.selectedVariant?.name || "",
          variantKey: getVariantKey(product.selectedVariant) || "",
          variantSku: product.selectedVariant?.sku || "",
          price: Number(product.price || product.salePrice || 0),
        });
        pendingRequestsRef.current -= 1;
        syncCart(response.data?.result?.items || response.data?.items);
      } catch (error) {
        pendingRequestsRef.current -= 1;
        const errorCode = error?.response?.data?.code;
        if (error?.response?.status === 400) {
          if (errorCode === "SELLER_MISMATCH") {
            await fetchCart();
            return {
              ok: false,
              code: "SELLER_MISMATCH",
              product,
              cartSellerName: getQuickStoreName(cart[0]),
              productSellerName: getQuickStoreName(product),
            };
          }
          const errMsg = error?.response?.data?.message || `Only ${stock} items are available in stock.`;
          showToast(errMsg, "error");
          await fetchCart();
        } else if (pendingRequestsRef.current === 0) {
          await fetchCart();
        }
      }
    }

    return { ok: true };
  };

  const removeFromCart = async (cartLineId) => {
    const resolvedLineKey = getCartLineKey({ id: cartLineId });
    const resolvedProductId = normalizeProductId(cartLineId);
    if (!resolvedLineKey) return;

    const currentItem = cart.find((item) => getCartLineKey(item) === resolvedLineKey);
    const nextCart = cart.filter((item) => getCartLineKey(item) !== resolvedLineKey);
    setCart(nextCart);
    persistQuickCartSnapshot(nextCart);

    pendingRequestsRef.current += 1;
    try {
      const response = await customerApi.removeFromCart(resolvedProductId, {
        variantKey: currentItem?.variantKey || currentItem?.selectedVariant?._id || "",
        variantName: currentItem?.variantName || currentItem?.selectedVariant?.name || "",
      });
      pendingRequestsRef.current -= 1;
      syncCart(response.data?.result?.items || response.data?.items);
    } catch (error) {
      pendingRequestsRef.current -= 1;
      if (pendingRequestsRef.current === 0) await fetchCart();
    }
  };

  const updateQuantity = async (cartLineId, delta) => {
    const resolvedLineKey = getCartLineKey({ id: cartLineId });
    const resolvedProductId = normalizeProductId(cartLineId);
    if (!resolvedLineKey) return;
    const currentItem = cart.find((item) => getCartLineKey(item) === resolvedLineKey);
    if (!currentItem) return;
    const stock = Number(currentItem.stock ?? 0);
    const newQty = Math.max(0, currentItem.quantity + delta);

    if (delta > 0 && newQty > stock) {
      showToast(`Only ${stock} items are available in stock.`, "error");
      return;
    }

    if (newQty === 0) {
      removeFromCart(resolvedLineKey);
      return;
    }

    setCart((prev) =>
      prev.map((item) =>
        getCartLineKey(item) === resolvedLineKey ? { ...item, quantity: newQty } : item,
      ),
    );

    if (isAuthenticated) {
      pendingRequestsRef.current += 1;
      try {
        await customerApi.updateCartQuantity({
          productId: resolvedProductId,
          quantity: newQty,
          variantKey: currentItem?.variantKey || currentItem?.selectedVariant?._id || "",
          variantName: currentItem?.variantName || currentItem?.selectedVariant?.name || "",
        });
        pendingRequestsRef.current -= 1;
      } catch (error) {
        pendingRequestsRef.current -= 1;
        if (error?.response?.status === 400) {
          const errMsg = error?.response?.data?.message || `Only ${stock} items are available in stock.`;
          showToast(errMsg, "error");
          await fetchCart();
        } else if (error?.response?.status === 404) {
          try {
            await customerApi.addToCart({
              productId: resolvedProductId,
              quantity: newQty,
            });
          } catch (addError) {
            console.error("Failed to fallback-add item to cart", addError);
            if (addError?.response?.status === 400) {
              const errMsg = addError?.response?.data?.message || `Only ${stock} items are available in stock.`;
              showToast(errMsg, "error");
              await fetchCart();
            }
          }
        } else if (pendingRequestsRef.current === 0) {
          await fetchCart();
        }
      }
    }
  };

  const clearCart = async () => {
    pendingRequestsRef.current += 1;
    setCart([]);
    persistQuickCartSnapshot([]);

    // Also clear Quick items from legacy cart to prevent them from reappearing
    // when switching back to Food-bridged pages (like Home)
    try {
      const legacyCart = localStorage.getItem("cart");
      if (legacyCart) {
        const parsed = JSON.parse(legacyCart);
        if (Array.isArray(parsed)) {
          const remaining = parsed.filter((item) => !isQuickCartItem(item));
          if (remaining.length > 0) {
            localStorage.setItem("cart", JSON.stringify(remaining));
          } else {
            localStorage.removeItem("cart");
          }
        }
      }
    } catch (e) {
      console.warn("Failed to clear legacy cart items", e);
    }

    try {
      const response = await customerApi.clearCart();
      const clearedItems = response.data?.result?.items || response.data?.items || [];
      setCart([]);
      persistQuickCartSnapshot([]);
      syncCart(clearedItems);
    } catch (error) {
      console.error("Error clearing cart on backend", error);
    } finally {
      pendingRequestsRef.current = Math.max(0, pendingRequestsRef.current - 1);
    }
  };

  const cartTotal = useMemo(
    () => cart.reduce((total, item) => total + (item.price || 0) * item.quantity, 0),
    [cart]
  );
  const cartCount = useMemo(
    () => cart.reduce((total, item) => total + item.quantity, 0),
    [cart]
  );

  return {
    cart,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    cartTotal,
    cartCount,
    loading,
    fetchCart,
  };
};

export const CartProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const foodCart = useFoodCart();
  const { showToast } = useToast();
  const isUsingFoodCart = foodCart?._isProvider === true;
  const standaloneCart = useStandaloneQuickCart(isUsingFoodCart);
  const [sellerConflict, setSellerConflict] = useState(null);
  const [isResolvingSellerConflict, setIsResolvingSellerConflict] = useState(false);

  // Use foodCart.cart (stable array ref) as dep — avoids re-running when foodCart object ref changes
  const quickItemsFromFoodCart = useMemo(
    () => (Array.isArray(foodCart?.cart) ? foodCart.cart.filter(isQuickCartItem) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [foodCart?.cart],
  );

  useEffect(() => {
    if (!isUsingFoodCart) return;

    persistQuickCartSnapshot(quickItemsFromFoodCart);
  }, [isUsingFoodCart, quickItemsFromFoodCart]);

  const bridgedValue = useMemo(() => {
    if (!isUsingFoodCart) {
      return standaloneCart;
    }

    const addToCart = async (product, { skipSellerCheck = false } = {}) => {
      const normalizedProduct = normalizeQuickProductForSharedCart(product);
      const lineKey = getCartLineKey(normalizedProduct);
      const existingItem = quickItemsFromFoodCart.find(
        (item) => getCartLineKey(item) === lineKey,
      );

      if (!skipSellerCheck) {
        const conflict = checkSellerConflict(quickItemsFromFoodCart, normalizedProduct);
        if (conflict) {
          return { ok: false, ...conflict, product: normalizedProduct };
        }
      }

      const stock = Number(product.stock ?? (existingItem ? existingItem.stock : 0) ?? 0);
      const currentQty = existingItem ? Number(existingItem.quantity || 0) : 0;
      const targetQty = currentQty + 1;

      if (targetQty > stock) {
        showToast(`Only ${stock} items are available in stock.`, "error");
        return { ok: false, code: "OUT_OF_STOCK" };
      }

      const nextQuickItems = existingItem
        ? quickItemsFromFoodCart.map((item) =>
            getCartLineKey(item) === lineKey
              ? { ...item, quantity: Number(item.quantity || 0) + 1 }
              : item,
          )
        : [...quickItemsFromFoodCart, { ...normalizedProduct, quantity: 1 }];

      persistQuickCartSnapshot(nextQuickItems);
      foodCart.addToCart(normalizedProduct);

      if (isAuthenticated) {
        try {
          await customerApi.addToCart({
            productId: getProductId(normalizedProduct),
            quantity: 1,
          });
        } catch (error) {
          console.error("Failed to sync bridged addToCart to backend", error);
          if (error?.response?.status === 400) {
            const errorCode = error?.response?.data?.code;
            if (errorCode === "SELLER_MISMATCH") {
              if (currentQty === 0) {
                foodCart.removeFromCart(lineKey);
              } else {
                foodCart.updateQuantity(normalizedProduct.id, currentQty);
              }
              persistQuickCartSnapshot(quickItemsFromFoodCart);
              return {
                ok: false,
                code: "SELLER_MISMATCH",
                product: normalizedProduct,
                cartSellerName: getQuickStoreName(quickItemsFromFoodCart[0]),
                productSellerName: getQuickStoreName(normalizedProduct),
              };
            }
            const errMsg = error?.response?.data?.message || `Only ${stock} items are available in stock.`;
            showToast(errMsg, "error");
            foodCart.updateQuantity(normalizedProduct.id, currentQty);
            persistQuickCartSnapshot(quickItemsFromFoodCart);
          }
        }
      }

      return { ok: true };
    };

    const removeFromCart = async (cartLineId) => {
      const resolvedLineKey = getCartLineKey({ id: cartLineId });
      const resolvedProductId = normalizeProductId(cartLineId);
      if (!resolvedLineKey) return;

      const currentItem = quickItemsFromFoodCart.find(
        (item) => getCartLineKey(item) === resolvedLineKey,
      );
      const nextQuickItems = quickItemsFromFoodCart.filter(
        (item) => getCartLineKey(item) !== resolvedLineKey,
      );
      persistQuickCartSnapshot(nextQuickItems);
      foodCart.removeFromCart(resolvedLineKey);

      try {
        await customerApi.removeFromCart(resolvedProductId, {
          variantKey: currentItem?.variantKey || currentItem?.variantId || currentItem?.selectedVariant?._id || "",
          variantName: currentItem?.variantName || currentItem?.selectedVariant?.name || "",
        });
      } catch (error) {
        console.error("Failed to sync bridged removeFromCart to backend", error);
      }
    };

    const updateQuantity = async (cartLineId, delta) => {
      const resolvedLineKey = getCartLineKey({ id: cartLineId });
      const resolvedProductId = normalizeProductId(cartLineId);
      if (!resolvedLineKey) return;
      const currentItem = foodCart.getCartItem(resolvedLineKey);
      if (!currentItem) return;
      const stock = Number(currentItem.stock ?? 0);
      const nextQuantity = Math.max(0, (currentItem.quantity || 0) + delta);

      if (delta > 0 && nextQuantity > stock) {
        showToast(`Only ${stock} items are available in stock.`, "error");
        return;
      }

      const nextQuickItems =
        nextQuantity === 0
          ? quickItemsFromFoodCart.filter(
              (item) => getCartLineKey(item) !== resolvedLineKey,
            )
          : quickItemsFromFoodCart.map((item) =>
              getCartLineKey(item) === resolvedLineKey
                ? { ...item, quantity: nextQuantity }
                : item,
            );
      persistQuickCartSnapshot(nextQuickItems);
      foodCart.updateQuantity(resolvedLineKey, nextQuantity);

      if (isAuthenticated) {
        try {
          if (nextQuantity === 0) {
            await customerApi.removeFromCart(resolvedProductId, {
              variantKey: currentItem?.variantKey || currentItem?.variantId || currentItem?.selectedVariant?._id || "",
              variantName: currentItem?.variantName || currentItem?.selectedVariant?.name || ""
            });
          } else {
            try {
              await customerApi.updateCartQuantity({
                productId: resolvedProductId,
                quantity: nextQuantity,
                variantKey: currentItem?.variantKey || currentItem?.variantId || currentItem?.selectedVariant?._id || "",
                variantName: currentItem?.variantName || currentItem?.selectedVariant?.name || "",
              });
            } catch (error) {
              if (error?.response?.status === 404) {
                // Fallback: if update fails with 404, the item might be missing from backend cart
                // but present in local bridged cart. Try adding it.
                await customerApi.addToCart({
                  productId: resolvedProductId,
                  quantity: nextQuantity,
                });
              } else {
                throw error;
              }
            }
          }
        } catch (error) {
          console.error("Failed to sync bridged updateQuantity to backend", error);
          if (error?.response?.status === 400) {
            const errMsg = error?.response?.data?.message || `Only ${stock} items are available in stock.`;
            showToast(errMsg, "error");
            foodCart.updateQuantity(resolvedProductId, currentItem.quantity);
            persistQuickCartSnapshot(quickItemsFromFoodCart);
          }
        }
      }
    };

    const clearCart = async () => {
      persistQuickCartSnapshot([]);
      foodCart.clearCart();

      try {
        await customerApi.clearCart();
        persistQuickCartSnapshot([]);
      } catch (error) {
        console.error("Failed to sync bridged clearCart to backend", error);
      }
    };

    return {
      cart: quickItemsFromFoodCart,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      cartTotal: quickItemsFromFoodCart.reduce(
        (total, item) => total + Number(item.price || 0) * Number(item.quantity || 0),
        0,
      ),
      cartCount: quickItemsFromFoodCart.reduce(
        (total, item) => total + Number(item.quantity || 0),
        0,
      ),
      loading: false,
    };
  }, [
    // Stable: only re-run bridgedValue when the actual data/flags change, not the whole foodCart object
    isUsingFoodCart,
    quickItemsFromFoodCart,
    standaloneCart,
    isAuthenticated,
    // foodCart action refs — stable via useCallback in Food CartContext
    foodCart?.addToCart,
    foodCart?.removeFromCart,
    foodCart?.updateQuantity,
    foodCart?.clearCart,
    foodCart?.getCartItem,
  ]);

  const closeSellerConflict = useCallback(() => {
    if (isResolvingSellerConflict) return;
    setSellerConflict(null);
  }, [isResolvingSellerConflict]);

  const confirmSellerConflict = useCallback(async () => {
    if (!sellerConflict?.onConfirm || isResolvingSellerConflict) return;
    setIsResolvingSellerConflict(true);
    try {
      const run = sellerConflict.onConfirm;
      setSellerConflict(null);
      await run();
    } finally {
      setIsResolvingSellerConflict(false);
    }
  }, [sellerConflict, isResolvingSellerConflict]);

  const contextValue = useMemo(() => {
    const baseValue = bridgedValue;
    const rawAddToCart = baseValue.addToCart;
    const clearCartFn = baseValue.clearCart;

    const addToCart = async (product, options = {}) => {
      const result = await rawAddToCart(product, options);
      if (result?.ok === false && result?.code === "SELLER_MISMATCH" && !options?.skipSellerCheck) {
        setSellerConflict({
          product: result.product || product,
          cartSellerName: result.cartSellerName,
          productSellerName: result.productSellerName,
          onConfirm: async () => {
            await clearCartFn();
            await rawAddToCart(result.product || product, { skipSellerCheck: true });
          },
        });
      }
      return result ?? { ok: true };
    };

    return {
      ...baseValue,
      addToCart,
    };
  }, [bridgedValue]);

  return (
    <CartContext.Provider value={{ ...contextValue, showToast }}>
      {children}
      {sellerConflict && (
        <div className="fixed inset-0 z-[600] flex items-end sm:items-center justify-center px-4 pb-6 sm:pb-0">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={closeSellerConflict}
          />
          <div className="relative z-10 w-full max-w-sm rounded-[28px] bg-white p-6 shadow-2xl">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 mx-auto">
              <ShoppingBag size={22} className="text-amber-600" />
            </div>
            <h3 className="text-center text-lg font-bold text-slate-900">
              Items from another seller
            </h3>
            <p className="mt-2 text-center text-sm text-slate-500">
              Your cart contains items from another seller.
              Do you want to clear the cart and add this product?
            </p>
            {sellerConflict.cartSellerName ? (
              <p className="mt-2 text-center text-xs font-semibold text-slate-400">
                Current: {sellerConflict.cartSellerName}
              </p>
            ) : null}
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={closeSellerConflict}
                disabled={isResolvingSellerConflict}
                className="flex-1 rounded-2xl border-2 border-slate-200 py-3 text-sm font-bold text-slate-700 transition-colors hover:border-slate-300 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmSellerConflict}
                disabled={isResolvingSellerConflict}
                className="flex-1 rounded-2xl bg-primary py-3 text-sm font-bold text-white transition-colors hover:bg-primary/90 disabled:opacity-60"
              >
                {isResolvingSellerConflict ? "Updating..." : "Clear Cart & Continue"}
              </button>
            </div>
          </div>
        </div>
      )}
    </CartContext.Provider>
  );
};
