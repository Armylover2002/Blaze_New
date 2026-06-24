import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Lottie from 'lottie-react';
import {
  ArrowLeft,
  Banknote,
  Check,
  ChevronRight,
  CreditCard,
  MapPin,
  Minus,
  Plus,
  ShoppingBag,
  Timer,
  Trash2,
  Wallet,
} from 'lucide-react';
import { useAuth } from '@core/context/AuthContext';
import { useProfile } from '@food/context/ProfileContext';
import { Button } from '@/components/ui/button';
import { useSettings } from '@core/context/SettingsContext';
import { useToast } from '@shared/components/ui/Toast';
import { useCart } from '../context/CartContext';
import { customerApi } from '../services/customerApi';
import emptyBoxAnimation from '../assets/lottie/Empty box.json';
import { getQuickCategoriesPath, getQuickCheckoutPath } from '../utils/routes';
import { resolveQuickImageUrl } from '../utils/image';
import { useLocation as useAppLocation } from '../context/LocationContext';
import LocationDrawer from '../components/shared/LocationDrawer';
import PharmacyMetaLines from '../components/pharmacy/PharmacyMetaLines';
import { getVariantDisplayLabel } from '../components/pharmacy/pharmacyProductMeta';

// ─── Pure helpers (outside component — no closure allocation on each render) ──

const DEFAULT_QUICK_BILLING_SETTINGS = {
  deliveryFee: 25,
  deliveryFeeRanges: [],
  deliveryCommissionRules: [],
  freeDeliveryThreshold: 0,
  platformFee: 0,
  gstRate: 0,
};

const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=200&auto=format&fit=crop';

const calculateHaversineDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const calculateFrontendRiderEarning = (distanceKm, rules = []) => {
  const d = Number(distanceKm);
  if (!Number.isFinite(d) || d < 0 || !rules.length) return 0;

  const sorted = [...rules]
    .filter((r) => r && r.status !== false)
    .sort((a, b) => (Number(a.minDistance) || 0) - (Number(b.minDistance) || 0));

  const baseRule = sorted.find((r) => (Number(r.minDistance) || 0) === 0);
  if (!baseRule) return 0;

  let earning = Number(baseRule.basePayout || 0);
  for (const rule of sorted) {
    const perKm = Number(rule.commissionPerKm || 0);
    if (!Number.isFinite(perKm) || perKm <= 0) continue;
    const min = Number(rule.minDistance || 0);
    const max = rule.maxDistance == null ? null : Number(rule.maxDistance);
    if (d <= min) continue;
    const upper = max == null ? d : Math.min(d, max);
    const kmInSlab = Math.max(0, upper - min);
    if (kmInSlab > 0) earning += kmInSlab * perKm;
  }

  return Number.isFinite(earning) && earning > 0 ? Math.round(earning) : 0;
};

const calculateQuickCartPricing = ({ subtotal = 0, cartItems = [], feeSettings = DEFAULT_QUICK_BILLING_SETTINGS, categoryFeeMap = {}, distanceKm = 0 }) => {
  const safeSubtotal = Number(subtotal || 0);
  const freeThreshold = Number(feeSettings?.freeDeliveryThreshold || 0);

  let deliveryFee = 0;
  if (safeSubtotal > 0) {
    if (Number.isFinite(freeThreshold) && freeThreshold > 0 && safeSubtotal >= freeThreshold) {
      deliveryFee = 0;
    } else if (Array.isArray(feeSettings?.deliveryCommissionRules) && feeSettings.deliveryCommissionRules.length > 0) {
      deliveryFee = calculateFrontendRiderEarning(distanceKm, feeSettings.deliveryCommissionRules);
    } else {
      deliveryFee = Number(feeSettings?.deliveryFee || 0);
    }
  }

  const handlingFee = cartItems.reduce((maxFee, item) => {
    const candidateIds = [item?.headerId, item?.categoryId, item?.subcategoryId];
    const itemFee = candidateIds.reduce((cur, rawId) => {
      const id =
        rawId && typeof rawId === 'object' && rawId._id
          ? String(rawId._id)
          : String(rawId || '').trim();
      return Math.max(cur, Number(categoryFeeMap[id] || 0));
    }, 0);
    return Math.max(maxFee, itemFee);
  }, 0);

  const platformFee = Number(feeSettings?.platformFee || 0);
  const gstRate = Number(feeSettings?.gstRate || 0);
  const gstAmount =
    Number.isFinite(gstRate) && gstRate > 0
      ? Math.round(safeSubtotal * (gstRate / 100))
      : 0;

  return {
    deliveryFee,
    handlingFee,
    platformFee,
    gstAmount,
    grandTotal: Math.max(0, safeSubtotal + deliveryFee + platformFee + gstAmount),
  };
};

// ─── Sub-components (memoized to prevent list re-renders) ─────────────────────

const CartItem = React.memo(({ item, onRemove, onUpdateQuantity, showToast }) => {
  const imageUrl = resolveQuickImageUrl(item.mainImage || item.image) || item.mainImage || item.image || FALLBACK_IMAGE;
  const itemTotal = Number(item.price || 0) * Number(item.quantity || 0);
  const stock = Number(item.stock ?? Infinity);
  const hasPharmacyMeta = Boolean(item?.pharmacyDetails);
  const variantLabel = item?.selectedVariant
    ? getVariantDisplayLabel(item.selectedVariant, item)
    : '';

  const handleRemove = useCallback(() => onRemove(item), [onRemove, item]);
  const handleDecr = useCallback(() => onUpdateQuantity(item.id || item._id, -1), [onUpdateQuantity, item.id, item._id]);
  const handleIncr = useCallback(() => {
    if (item.quantity >= stock) { showToast(`Only ${stock} items are available in stock.`, 'error'); return; }
    onUpdateQuantity(item.id || item._id, 1);
  }, [onUpdateQuantity, item.id, item._id, item.quantity, stock, showToast]);

  const handleImgError = useCallback((e) => { e.currentTarget.src = FALLBACK_IMAGE; }, []);

  return (
    <article className="rounded-[24px] bg-white p-4 shadow-sm">
      <div className="flex gap-4">
        <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-slate-50">
          <img
            src={imageUrl}
            alt={item.name}
            className="h-full w-full object-contain p-2"
            onError={handleImgError}
            loading="lazy"
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="line-clamp-2 text-base font-semibold text-slate-900">{item.name}</h2>
              {variantLabel ? (
                <p className="mt-1 text-xs font-semibold text-teal-700">{variantLabel}</p>
              ) : (
                <p className="mt-1 text-xs font-medium text-slate-500">{item.weight || item.unit || '1 unit'}</p>
              )}
              {hasPharmacyMeta && (
                <PharmacyMetaLines
                  product={item}
                  showManufacturer
                  showGeneric
                  showStrengthDosage
                  showPack
                  className="mt-2"
                />
              )}
            </div>
            <button
              onClick={handleRemove}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-500"
            >
              <Trash2 size={16} />
            </button>
          </div>

          <div className="mt-4 flex items-end justify-between gap-3">
            <div>
              <p className="text-lg font-bold text-slate-900">₹{itemTotal}</p>
              {item.quantity > 1 && (
                <p className="text-xs text-slate-400">₹{item.price} each</p>
              )}
            </div>

            <div className="inline-flex items-center gap-3 rounded-full bg-slate-100 px-2 py-1">
              <button
                onClick={handleDecr}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm"
              >
                <Minus size={14} strokeWidth={3} />
              </button>
              <span className="min-w-[18px] text-center text-sm font-bold text-slate-900">
                {item.quantity}
              </span>
              <button
                onClick={handleIncr}
                disabled={item.quantity >= stock}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Plus size={14} strokeWidth={3} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
});
CartItem.displayName = 'CartItem';

// ─── Main CartPage ─────────────────────────────────────────────────────────────

const CartPage = () => {
  const navigate = useNavigate();
  const { cart, removeFromCart, updateQuantity, cartTotal, clearCart, loading } = useCart();
  const { showToast } = useToast();
  const { settings } = useSettings();
  const { currentLocation, savedAddresses, updateLocation, refreshAddresses } = useAppLocation();
  const { user, isAuthenticated } = useAuth();
  const { userProfile } = useProfile();

  const [isLocationOpen, setIsLocationOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('Home');

  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [quickBillingSettings, setQuickBillingSettings] = useState(DEFAULT_QUICK_BILLING_SETTINGS);
  const [categoryFeeMap, setCategoryFeeMap] = useState({});
  const [isUserCodAllowed, setIsUserCodAllowed] = useState(true);
  const [storeLocation, setStoreLocation] = useState(null);
  const [distanceKm, setDistanceKm] = useState(0);
  const [selectedPayment, setSelectedPayment] = useState('cash');
  const [walletBalance, setWalletBalance] = useState(Number(userProfile?.walletBalance || 0));

  // ── Stable path constants ──────────────────────────────────────────────────
  const categoriesPath = useMemo(() => getQuickCategoriesPath(), []);
  const checkoutPath = useMemo(() => getQuickCheckoutPath(), []);

  // ── Derived values ─────────────────────────────────────────────────────────
  const itemCount = useMemo(
    () => cart.reduce((n, item) => n + Number(item.quantity || 0), 0),
    [cart],
  );

  const { deliveryFee, handlingFee, platformFee, gstAmount, grandTotal } = useMemo(
    () =>
      calculateQuickCartPricing({
        subtotal: cartTotal,
        cartItems: cart,
        feeSettings: quickBillingSettings,
        categoryFeeMap,
        distanceKm,
      }),
    [cartTotal, cart, quickBillingSettings, categoryFeeMap, distanceKm],
  );

  const paymentMethods = useMemo(
    () => [
      ...(settings?.onlineEnabled === false
        ? []
        : [{ id: 'online', label: 'Pay Online', icon: CreditCard, sublabel: 'UPI / Cards / NetBanking' }]),
      ...(isAuthenticated ? [{
        id: 'wallet',
        label: 'Wallet',
        icon: Wallet,
        sublabel: `Balance: ₹${Number(walletBalance || 0).toLocaleString('en-IN')}`,
        disabled: Number(walletBalance || 0) < Number(grandTotal || 0),
      }] : []),
      ...(settings?.codEnabled === false || !isUserCodAllowed
        ? []
        : [{ id: 'cash', label: 'Cash on Delivery', icon: Banknote, sublabel: 'Pay after delivery' }]),
    ],
    [settings?.onlineEnabled, settings?.codEnabled, isUserCodAllowed, isAuthenticated, walletBalance, grandTotal],
  );

  const selectedPaymentMethod = useMemo(
    () => paymentMethods.find((m) => m.id === selectedPayment) || null,
    [paymentMethods, selectedPayment],
  );

  // ── Effects ────────────────────────────────────────────────────────────────

  // Fetch store location from first cart item's seller
  useEffect(() => {
    let mounted = true;
    const firstItem = cart[0];
    const sellerId =
      firstItem?.sellerId?._id ||
      firstItem?.sellerId ||
      firstItem?.seller?._id ||
      firstItem?.quickStoreId ||
      firstItem?.storeId;

    if (!sellerId || typeof sellerId !== 'string' || sellerId === 'quick-commerce') {
      setStoreLocation(null);
      setDistanceKm(0);
      return;
    }

    customerApi.getStoreDetails(sellerId).then((response) => {
      if (!mounted) return;
      const store = response?.data?.result || response?.data?.data || null;
      if (!store) return;

      const loc = store.location;
      let sCoords = null;
      if (Array.isArray(loc?.coordinates) && loc.coordinates.length === 2) {
        sCoords = { lat: Number(loc.coordinates[1]), lng: Number(loc.coordinates[0]) };
      } else if (Number.isFinite(Number(loc?.latitude)) && Number.isFinite(Number(loc?.longitude))) {
        sCoords = { lat: Number(loc.latitude), lng: Number(loc.longitude) };
      }
      setStoreLocation(sCoords);
    }).catch((err) => console.error('Failed to fetch store details:', err));

    return () => { mounted = false; };
  }, [cart]); // eslint-disable-line react-hooks/exhaustive-deps

  // Compute distance whenever store or user location changes
  useEffect(() => {
    if (!storeLocation) { setDistanceKm(0); return; }

    const lat1 = storeLocation.lat;
    const lon1 = storeLocation.lng;
    const lat2 = Number(currentLocation?.latitude || currentLocation?.lat);
    const lon2 = Number(currentLocation?.longitude || currentLocation?.lng);

    if (Number.isFinite(lat1) && Number.isFinite(lon1) && Number.isFinite(lat2) && Number.isFinite(lon2)) {
      setDistanceKm(calculateHaversineDistance(lat1, lon1, lat2, lon2));
    } else {
      setDistanceKm(0);
    }
  }, [storeLocation, currentLocation]);

  // Load billing settings + category fee map (single parallel fetch)
  useEffect(() => {
    let mounted = true;

    Promise.all([
      customerApi.getBillingSettings(),
      customerApi.getCategories({ tree: true }),
    ]).then(([billingResponse, categoriesResponse]) => {
      if (!mounted) return;

      const feeSettings =
        billingResponse?.data?.data?.feeSettings ||
        billingResponse?.data?.result ||
        null;
      if (feeSettings) {
        setQuickBillingSettings((prev) => ({
          ...prev,
          ...feeSettings,
          deliveryFeeRanges: Array.isArray(feeSettings.deliveryFeeRanges) ? feeSettings.deliveryFeeRanges : prev.deliveryFeeRanges,
          deliveryCommissionRules: Array.isArray(feeSettings.deliveryCommissionRules) ? feeSettings.deliveryCommissionRules : prev.deliveryCommissionRules,
        }));
      }

      const results = categoriesResponse?.data?.results || categoriesResponse?.data?.result || [];
      if (Array.isArray(results)) {
        const nextFeeMap = {};
        const visit = (items = []) => {
          items.forEach((item) => {
            const id = String(item?._id || item?.id || '').trim();
            if (id) nextFeeMap[id] = Number(item?.handlingFees || 0);
            if (Array.isArray(item?.children) && item.children.length > 0) visit(item.children);
          });
        };
        visit(results);
        setCategoryFeeMap(nextFeeMap);
      }
    }).catch((err) => console.error('Failed to load quick cart billing settings:', err));

    return () => { mounted = false; };
  }, []);

  // Refresh addresses on mount to ensure synchronization
  useEffect(() => {
    refreshAddresses?.();
  }, [refreshAddresses]);

  // Load user COD permission
  useEffect(() => {
    let mounted = true;
    customerApi.getProfile().then((response) => {
      if (!mounted) return;
      const profile = response?.data?.result || response?.data?.data || response?.data?.user || null;
      if (profile) setIsUserCodAllowed(profile.isCodAllowed !== false);
    }).catch(() => { if (mounted) setIsUserCodAllowed(true); });
    return () => { mounted = false; };
  }, []);

  // Load wallet balance
  useEffect(() => {
    if (!isAuthenticated) {
      setWalletBalance(0);
      return undefined;
    }
    let mounted = true;
    const loadWalletBalance = async () => {
      try {
        const response = await customerApi.getWalletBalance();
        const wallet = response?.data?.data?.wallet || response?.data?.result?.wallet;
        if (!mounted) return;
        if (wallet?.balance != null) {
          setWalletBalance(Number(wallet.balance) || 0);
        } else if (userProfile?.walletBalance != null) {
          setWalletBalance(Number(userProfile.walletBalance) || 0);
        }
      } catch {
        if (mounted && userProfile?.walletBalance != null) {
          setWalletBalance(Number(userProfile.walletBalance) || 0);
        }
      }
    };
    loadWalletBalance();
    return () => { mounted = false; };
  }, [isAuthenticated, userProfile?.walletBalance]);

  // Sync selectedPayment when paymentMethods list changes
  useEffect(() => {
    if (!paymentMethods.length) return;
    if (!paymentMethods.some((m) => m.id === selectedPayment)) {
      setSelectedPayment(paymentMethods[0].id);
    }
  }, [paymentMethods, selectedPayment]);

  // Auto-detect which saved address is currently active
  useEffect(() => {
    if (!savedAddresses.length) return;
    const matching = savedAddresses.find(
      (addr) => addr.address === currentLocation?.name
    );
    if (matching) {
      setActiveTab(matching.label === "Office" ? "Work" : matching.label);
    }
  }, [savedAddresses, currentLocation]);

  // Keep check-out state's address in sync with global currentLocation updates
  useEffect(() => {
    if (!currentLocation?.name) return;
    try {
      const CHECKOUT_STORAGE_KEY = "quick_commerce_checkout_state_v1";
      const stored = localStorage.getItem(CHECKOUT_STORAGE_KEY);
      const parsed = stored ? JSON.parse(stored) : {};

      if (parsed.currentAddress?.address !== currentLocation.name) {
        const nextAddress = {
          ...parsed.currentAddress,
          address: currentLocation.name,
          city: currentLocation.city || parsed.currentAddress?.city || "Indore",
          landmark: parsed.currentAddress?.landmark || "",
          location: currentLocation.latitude && currentLocation.longitude
            ? { lat: currentLocation.latitude, lng: currentLocation.longitude }
            : parsed.currentAddress?.location,
        };

        localStorage.setItem(CHECKOUT_STORAGE_KEY, JSON.stringify({
          ...parsed,
          currentAddress: nextAddress
        }));
      }
    } catch (err) {
      console.error("Failed to sync currentLocation to checkout state:", err);
    }
  }, [currentLocation]);

  const handleSelectAddress = useCallback((addr) => {
    if (!addr) return;

    const newLoc = {
      name: addr.address,
      time: "12-15 mins",
      city: addr.city || currentLocation?.city || "Indore",
      state: currentLocation?.state || "Madhya Pradesh",
      pincode: currentLocation?.pincode || "452018",
      latitude: addr.location?.lat ?? currentLocation?.latitude,
      longitude: addr.location?.lng ?? currentLocation?.longitude,
    };

    updateLocation(newLoc, { persist: true });

    try {
      const CHECKOUT_STORAGE_KEY = "quick_commerce_checkout_state_v1";
      const stored = localStorage.getItem(CHECKOUT_STORAGE_KEY);
      const parsed = stored ? JSON.parse(stored) : {};

      const nextAddress = {
        id: addr.id,
        type: addr.label,
        name: addr.name || parsed.currentAddress?.name || "",
        address: addr.address,
        city: addr.city || parsed.currentAddress?.city || "Indore",
        phone: addr.phone || parsed.currentAddress?.phone || "",
        landmark: "",
        location: addr.location ? { lat: addr.location.lat, lng: addr.location.lng } : undefined,
      };

      localStorage.setItem(CHECKOUT_STORAGE_KEY, JSON.stringify({
        ...parsed,
        currentAddress: nextAddress
      }));
    } catch (err) {
      console.error("Failed to update checkout state in localStorage:", err);
    }

    showToast(`Delivery location set to ${addr.label}`, 'success');
  }, [currentLocation, updateLocation, showToast]);

  // ── Stable handlers ────────────────────────────────────────────────────────
  const handleRemove = useCallback(
    (item) => {
      removeFromCart(item.id || item._id);
      showToast(`${item.name} removed from cart`, 'info');
    },
    [removeFromCart, showToast],
  );

  const handleClearAll = useCallback(async () => {
    setShowClearConfirm(false);
    await clearCart();
    showToast('Cart cleared', 'info');
  }, [clearCart, showToast]);

  const handleBack = useCallback(() => {
    if (window.history.state && window.history.state.idx > 0) { navigate(-1); return; }
    navigate(categoriesPath);
  }, [navigate, categoriesPath]);

  const openClearConfirm = useCallback(() => setShowClearConfirm(true), []);
  const closeClearConfirm = useCallback(() => setShowClearConfirm(false), []);

  // ✅ FIX: LocationDrawer close hone pe addresses refresh karo
  const handleLocationDrawerClose = useCallback(() => {
    setIsLocationOpen(false);
    // Drawer band hote hi saved addresses reload karo taaki cart mein naya address dikhe
    refreshAddresses?.();
  }, [refreshAddresses]);

  // ── Loading / empty states ─────────────────────────────────────────────────
  if (loading && cart.length === 0) {
    return (
      <div className="min-h-screen bg-[#f7f7f7] px-4 py-6">
        <div className="mx-auto flex max-w-md flex-col items-center justify-center rounded-[28px] bg-white px-6 py-16 text-center shadow-sm">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-[#FF0000]" />
          <h2 className="mt-5 text-xl font-bold text-slate-900">Loading your cart</h2>
          <p className="mt-2 text-sm text-slate-500">Pulling in your saved items...</p>
        </div>
      </div>
    );
  }

  if (cart.length === 0) {
    return (
      <div className="min-h-screen bg-[#f7f7f7] px-4 py-6">
        <div className="mx-auto max-w-md">
          <div className="mb-5 flex items-center gap-3">
            <button
              type="button"
              onClick={handleBack}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Your Cart</h1>
              <p className="text-sm text-slate-500">Add items to get started</p>
            </div>
          </div>

          <div className="rounded-[28px] bg-white px-6 py-10 text-center shadow-sm">
            <div className="mx-auto mb-6 flex h-44 w-44 items-center justify-center">
              <Lottie animationData={emptyBoxAnimation} loop className="h-40 w-40" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">Your cart is empty</h2>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              Pick a few essentials and they&apos;ll show up here.
            </p>
            <Link to={categoriesPath} className="mt-6 inline-flex w-full">
              <Button className="h-12 w-full rounded-2xl bg-red-600 text-white hover:bg-red-700">
                Start Shopping
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Main render ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#f5f5f5] pb-[calc(9rem+env(safe-area-inset-bottom))]">
      <div className="mx-auto max-w-3xl px-4 py-5">

        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleBack}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Your Cart</h1>
              <p className="text-sm text-slate-500">{itemCount} item{itemCount === 1 ? '' : 's'}</p>
            </div>
          </div>
          <button
            onClick={openClearConfirm}
            className="text-sm font-semibold text-rose-500 transition-colors hover:text-rose-600"
          >
            Clear all
          </button>
        </div>

        {/* Clear cart confirmation modal */}
        {showClearConfirm && (
          <div className="fixed inset-0 z-[600] flex items-end sm:items-center justify-center px-4 pb-6 sm:pb-0">
            <div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={closeClearConfirm}
            />
            <div className="relative z-10 w-full max-w-sm rounded-[28px] bg-white p-6 shadow-2xl">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 mx-auto">
                <Trash2 size={22} className="text-rose-500" />
              </div>
              <h3 className="text-center text-lg font-bold text-slate-900">Clear your cart?</h3>
              <p className="mt-2 text-center text-sm text-slate-500">
                All {itemCount} item{itemCount === 1 ? '' : 's'} will be removed. This can&apos;t be undone.
              </p>
              <div className="mt-6 flex gap-3">
                <button
                  onClick={closeClearConfirm}
                  className="flex-1 rounded-2xl border-2 border-slate-200 py-3 text-sm font-bold text-slate-700 transition-colors hover:border-slate-300"
                >
                  Cancel
                </button>
                <button
                  onClick={handleClearAll}
                  className="flex-1 rounded-2xl bg-rose-500 py-3 text-sm font-bold text-white transition-colors hover:bg-rose-600"
                >
                  Clear all
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delivery Banner */}
        <section className="mb-4 rounded-[24px] bg-[#FFF2EB] p-4 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.24em] text-[#FF0000]">
                Delivery in 10 minutes
              </p>
              <h2 className="mt-1 text-lg font-bold text-slate-900">
                Shipment from your nearby store
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Fast doorstep delivery with live seller-side processing.
              </p>
            </div>
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-[#FF0000] shadow-sm">
              <Timer size={20} />
            </div>
          </div>
        </section>

        {/* Delivery Address Section */}
        <section className="mb-4 rounded-[24px] bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between w-full text-left">
            <div className="flex items-start gap-4 flex-1">
              <div className="bg-[#FFF2EB] dark:bg-[#FF0000]/10 p-2.5 rounded-xl">
                <MapPin className="h-5 w-5 text-[#FF0000]" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-sm md:text-base font-extrabold text-slate-900 leading-tight">
                  Delivery at Location
                </h2>
                <p className="text-xs md:text-sm text-slate-500 line-clamp-2 mt-1 pr-2">
                  {currentLocation?.name || "Add delivery address"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsLocationOpen(true)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#FFF2EB] text-[#FF0000] hover:bg-[#FFE8DB] transition-all"
            >
              <ChevronRight size={16} strokeWidth={2.5} />
            </button>
          </div>

          {/* Quick Select Pills */}
          {savedAddresses.length > 0 && (
            <div className="mt-4">
              <div className="flex flex-wrap gap-2">
                {["Home", "Work", "Other"].map((label) => {
                  const targetLabel = label === "Work" ? "Office" : label;
                  const hasAddress = savedAddresses.some(
                    (addr) => addr.label === targetLabel || addr.label === label
                  );
                  const isSelected = activeTab === label;
                  return (
                    <button
                      key={label}
                      type="button"
                      disabled={!hasAddress}
                      onClick={() => {
                        setActiveTab(label);
                        const matched = savedAddresses.find(
                          (addr) => addr.label === targetLabel
                        );
                        if (matched) handleSelectAddress(matched);
                      }}
                      className={`text-xs px-4 py-1.5 rounded-full font-bold transition-all ${isSelected
                        ? "bg-[#FF0000] text-white"
                        : hasAddress
                          ? "bg-slate-100 text-slate-700 hover:bg-slate-200"
                          : "bg-gray-50 text-gray-400 border border-gray-100 cursor-not-allowed opacity-50"
                        }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              {/* Selected Saved Address Details */}
              {savedAddresses.find((addr) => addr.label === (activeTab === "Work" ? "Office" : activeTab)) && (
                <div
                  onClick={() => {
                    const matched = savedAddresses.find(
                      (addr) => addr.label === (activeTab === "Work" ? "Office" : activeTab)
                    );
                    if (matched) handleSelectAddress(matched);
                  }}
                  className={`mt-4 rounded-2xl border-2 p-4 cursor-pointer transition-all ${savedAddresses.find((addr) => addr.label === (activeTab === "Work" ? "Office" : activeTab))?.address === currentLocation?.name
                    ? "border-[#FF0000] bg-[#FFF2EB]/10"
                    : "border-slate-100 hover:border-slate-200"
                    }`}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-extrabold text-slate-900 text-sm">
                      {activeTab}
                    </h3>
                    {savedAddresses.find((addr) => addr.label === (activeTab === "Work" ? "Office" : activeTab))?.address === currentLocation?.name && (
                      <span className="bg-[#FF0000] text-white text-[9px] px-2 py-0.5 rounded font-black tracking-wide">
                        SELECTED
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                    {savedAddresses.find((addr) => addr.label === (activeTab === "Work" ? "Office" : activeTab))?.address}
                  </p>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Cart Items — each item is memoized */}
        <div className="space-y-3">
          {cart.map((item) => (
            <CartItem
              key={item.id || item._id}
              item={item}
              onRemove={handleRemove}
              onUpdateQuantity={updateQuantity}
              showToast={showToast}
            />
          ))}
        </div>

        {/* Bill Details */}
        <section className="mt-4 rounded-[24px] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Bill details</p>
              <h2 className="mt-1 text-lg font-bold text-slate-900">Price breakdown</h2>
            </div>
            <span className="rounded-full bg-[#FFF2EB] px-3 py-1 text-xs font-bold text-[#FF0000]">
              {itemCount} item{itemCount === 1 ? '' : 's'}
            </span>
          </div>

          <div className="mt-5 space-y-3 text-sm text-slate-600">
            {[
              ['Items total', cartTotal],
              ['Delivery fee', deliveryFee],
              ['Platform fee', platformFee],
              ['GST', gstAmount],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between">
                <span>{label}</span>
                <span className="font-semibold text-slate-900">₹{value}</span>
              </div>
            ))}
            <div className="border-t border-dashed border-slate-200 pt-3">
              <div className="flex items-center justify-between text-base font-bold text-slate-900">
                <span>To pay</span>
                <span>₹{grandTotal}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Payment Selection */}
        <section className="mt-4 rounded-[24px] bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Payment</p>
              <h2 className="mt-1 text-lg font-bold text-slate-900">Choose how you want to pay</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                We&apos;ll carry this choice into checkout so you don&apos;t have to pick it again.
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {paymentMethods.length ? (
              paymentMethods.map((method) => {
                const Icon = method.icon;
                const isSelected = selectedPayment === method.id;
                const isDisabled = Boolean(method.disabled);
                return (
                  <button
                    key={method.id}
                    type="button"
                    onClick={() => !isDisabled && setSelectedPayment(method.id)}
                    disabled={isDisabled}
                    className={`flex w-full items-center gap-3 rounded-2xl border-2 p-3 text-left transition-all ${isDisabled
                      ? 'border-slate-100 bg-slate-50 opacity-60 cursor-not-allowed'
                      : isSelected
                      ? 'border-[#FF0000] bg-[#FFF2EB]'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                  >
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full ${isSelected ? 'bg-[#FFE8DB]' : 'bg-slate-100'}`}>
                      <Icon size={18} className={isSelected ? 'text-[#FF0000]' : 'text-slate-600'} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-bold ${isSelected ? 'text-[#FF0000]' : 'text-slate-800'}`}>
                        {method.label}
                      </p>
                      <p className="text-xs text-slate-500">{method.sublabel}</p>
                    </div>
                    <div className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${isSelected ? 'border-[#FF0000] bg-[#FF0000]' : 'border-slate-300'}`}>
                      {isSelected && <Check size={12} className="text-white" />}
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                Payment options are currently unavailable. You can still review the order on checkout.
              </div>
            )}
          </div>
        </section>

        {/* Checkout Card */}
        <Link to={checkoutPath} state={{ selectedPayment }} className="block mt-4">
          <section className="rounded-[24px] bg-white p-5 shadow-sm transition-all hover:shadow-md active:scale-[0.99]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Checkout</p>
                <h2 className="mt-1 text-lg font-bold text-slate-900">
                  Address, payment and seller confirmation
                </h2>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  Review delivery details on the next screen and place the order to push it into the matched seller dashboard.
                </p>
              </div>
              <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FF0000]/10 text-[#FF0000]">
                <ChevronRight size={18} />
              </div>
            </div>
          </section>
        </Link>
      </div>

      {/* Sticky Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-[520] border-t border-slate-200 bg-white px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(15,23,42,0.08)]">
        <div className="mx-auto flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">To pay</p>
            <p className="truncate text-2xl font-bold text-slate-900">₹{grandTotal}</p>
            <p className="text-xs text-slate-500">
              {selectedPaymentMethod ? selectedPaymentMethod.label : 'Includes delivery charges'}
            </p>
          </div>

          <Link
            to={checkoutPath}
            state={{ selectedPayment }}
            className="block w-full flex-1 sm:min-w-[220px]"
          >
            <Button className="h-12 w-full rounded-2xl bg-red-600 px-4 text-sm text-white whitespace-normal sm:whitespace-nowrap hover:bg-red-700">
              <ShoppingBag size={18} className="mr-2" />
              Proceed to Checkout
            </Button>
          </Link>
        </div>
      </div>

      {/* ✅ FIX: onClose mein refreshAddresses call ho raha hai */}
      <LocationDrawer
        isOpen={isLocationOpen}
        onClose={handleLocationDrawerClose}
      />
    </div>
  );
};

export default CartPage;