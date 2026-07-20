import { useEffect, useRef, useCallback } from "react";
import { useOrders } from "@food/context/OrdersContext";
import { orderAPI } from "@food/api";
import { useActiveOrderStore } from "@food/store/activeOrderStore";
import {
  activeOrdersFingerprint,
  extractOrderFromDetailResponse,
  getCustomerToken,
  getOrderKey,
  getOrderStatus,
  isTerminalOrder,
  isTerminalStatus,
  mergeUniqueOrders,
  parseOrdersListResponse,
  pickActiveOrderFromList,
} from "@food/utils/activeOrderUtils";
import {
  getOrderListCache,
  invalidateOrderListCache,
  isOrderListCacheFresh,
  setOrderListCache,
} from "@food/utils/orderListCache";

const POLL_CONNECTED_MS = 45_000;
const POLL_DISCONNECTED_MS = 15_000;
const POLL_TICK_MS = 5_000;
const ETA_TICK_MS = 10_000;
const SOCKET_DEBOUNCE_MS = 300;

/**
 * Owns active-order lifecycle: socket-driven refresh, polling fallback, cache invalidation,
 * and detail hydration (etaPromise.endsAt). Mount inside OrdersProvider.
 */
export function useActiveOrderManager() {
  const { orders: contextOrders } = useOrders();
  const refreshGenRef = useRef(0);
  const lastPollAtRef = useRef(0);
  const socketDebounceRef = useRef(null);
  const hasFetchedApiRef = useRef(false);

  const setActiveOrder = useActiveOrderStore((s) => s.setActiveOrder);
  const mergeActiveOrder = useActiveOrderStore((s) => s.mergeActiveOrder);
  const removeIfMatches = useActiveOrderStore((s) => s.removeIfMatches);
  const clearActiveOrder = useActiveOrderStore((s) => s.clearActiveOrder);
  const resetStore = useActiveOrderStore((s) => s.reset);
  const markInvalidOrderId = useActiveOrderStore((s) => s.markInvalidOrderId);
  const tickEta = useActiveOrderStore((s) => s.tickEta);
  const setSyncing = useActiveOrderStore((s) => s.setSyncing);
  const setSocketConnected = useActiveOrderStore((s) => s.setSocketConnected);

  const resolveActiveFromSources = useCallback(
    async ({ force = false, preferDetailKey = null } = {}) => {
      const token = getCustomerToken();
      if (!token) {
        resetStore();
        return;
      }

      const gen = ++refreshGenRef.current;
      setSyncing(true);

      try {
        let apiOrders = [];
        let fetchedThisPass = false;

        if (!force && isOrderListCacheFresh()) {
          apiOrders = getOrderListCache().orders;
          if (apiOrders.length > 0 || hasFetchedApiRef.current) {
            hasFetchedApiRef.current = true;
          }
        } else {
          if (force) {
            orderAPI.getOrders.invalidate?.();
            invalidateOrderListCache();
          }

          const response = await orderAPI.getOrders({ limit: 10, page: 1 });
          if (gen !== refreshGenRef.current) return;

          apiOrders = parseOrdersListResponse(response);
          setOrderListCache(apiOrders, activeOrdersFingerprint(apiOrders));
          hasFetchedApiRef.current = true;
          fetchedThisPass = true;
        }

        const invalidOrderIds = useActiveOrderStore.getState().invalidOrderIds;
        const merged = mergeUniqueOrders(apiOrders, contextOrders, {
          hasFetchedApi: hasFetchedApiRef.current || fetchedThisPass,
          invalidOrderIds,
        });
        let candidate = pickActiveOrderFromList(merged);

        if (preferDetailKey) {
          const preferKey = String(preferDetailKey).trim();
          const preferred = merged.find((order) => getOrderKey(order) === preferKey);
          if (preferred && !isTerminalOrder(preferred)) {
            candidate = preferred;
          } else if (preferred && isTerminalStatus(getOrderStatus(preferred))) {
            removeIfMatches(preferKey);
            candidate = pickActiveOrderFromList(
              merged.filter((o) => getOrderKey(o) !== preferKey),
            );
          }
        }

        if (!candidate) {
          setActiveOrder(null);
          return;
        }

        const detailKey = getOrderKey(candidate);
        if (!detailKey) {
          setActiveOrder(null);
          return;
        }

        // Preserve old card behavior: show list/context candidate immediately,
        // then hydrate detail (endsAt) without blanking the banner.
        if (!isTerminalOrder(candidate)) {
          setActiveOrder(candidate);
        }

        try {
          const detailRes = await orderAPI.getOrderDetails(detailKey, {
            force: force || Boolean(preferDetailKey),
          });
          if (gen !== refreshGenRef.current) return;

          const detail = extractOrderFromDetailResponse(detailRes);
          if (detail && !isTerminalOrder(detail)) {
            setActiveOrder({ ...candidate, ...detail });
          } else if (detail && isTerminalOrder(detail)) {
            setActiveOrder(null);
          }
          // If detail payload unusable, keep list candidate already set.
        } catch (error) {
          if (gen !== refreshGenRef.current) return;

          if (error?.response?.status === 404 || error?.response?.status === 400) {
            markInvalidOrderId(detailKey);
            removeIfMatches(detailKey);
            const fallback = pickActiveOrderFromList(
              merged.filter((order) => getOrderKey(order) !== detailKey),
            );
            if (fallback) {
              setActiveOrder(fallback);
            } else {
              setActiveOrder(null);
            }
          }
          // Non-404: keep optimistic/list candidate already set.
        }
      } finally {
        if (gen === refreshGenRef.current) {
          setSyncing(false);
        }
      }
    },
    [
      contextOrders,
      markInvalidOrderId,
      removeIfMatches,
      resetStore,
      setActiveOrder,
      setSyncing,
    ],
  );

  useEffect(() => {
    if (!getCustomerToken()) {
      resetStore();
      return;
    }
    resolveActiveFromSources();
  }, [contextOrders, resolveActiveFromSources, resetStore]);

  useEffect(() => {
    if (!getCustomerToken()) return undefined;

    const runPollIfDue = () => {
      const connected =
        typeof window !== "undefined" && window.orderSocketConnected === true;
      setSocketConnected(connected);

      const pollInterval = connected ? POLL_CONNECTED_MS : POLL_DISCONNECTED_MS;
      const now = Date.now();
      if (now - lastPollAtRef.current < pollInterval) {
        return;
      }
      lastPollAtRef.current = now;
      resolveActiveFromSources({ force: !connected });
    };

    runPollIfDue();
    const id = setInterval(runPollIfDue, POLL_TICK_MS);
    return () => clearInterval(id);
  }, [resolveActiveFromSources, setSocketConnected]);

  useEffect(() => {
    if (!getCustomerToken()) return undefined;
    const id = setInterval(() => tickEta(), ETA_TICK_MS);
    return () => clearInterval(id);
  }, [tickEta]);

  useEffect(() => {
    if (!getCustomerToken()) return undefined;

    const invalidateCaches = () => {
      invalidateOrderListCache();
      orderAPI.getOrders.invalidate?.();
    };

    const handleOrderStatusNotification = (event) => {
      const detail = event?.detail || {};
      const incomingKey = String(detail.orderMongoId || detail.orderId || "").trim();
      const status = detail.orderStatus || detail.status;

      if (incomingKey && isTerminalStatus(status)) {
        removeIfMatches(incomingKey);
      }

      const currentKey = getOrderKey(useActiveOrderStore.getState().activeOrder);
      if (incomingKey && currentKey && incomingKey === currentKey) {
        mergeActiveOrder({
          orderStatus: detail.orderStatus,
          status: detail.status || detail.orderStatus,
          deliveryState: detail.deliveryState,
          dispatchStatus: detail.dispatchStatus,
          dispatch: detail.dispatch,
        });
        if (isTerminalStatus(status)) {
          invalidateCaches();
          return;
        }
      }

      invalidateCaches();

      if (socketDebounceRef.current) {
        clearTimeout(socketDebounceRef.current);
      }
      socketDebounceRef.current = setTimeout(() => {
        resolveActiveFromSources({
          force: true,
          preferDetailKey: incomingKey || undefined,
        });
      }, SOCKET_DEBOUNCE_MS);
    };

    const handleOrderPlaced = (event) => {
      const placed = event?.detail?.order || null;
      // Immediate banner — same intent as old card merging context + fast refetch.
      if (placed && !isTerminalOrder(placed)) {
        setActiveOrder(placed);
      }
      invalidateCaches();
      lastPollAtRef.current = 0;
      resolveActiveFromSources({
        force: true,
        preferDetailKey: getOrderKey(placed) || undefined,
      });
    };

    const handleAuthChange = () => {
      if (!getCustomerToken()) {
        resetStore();
        hasFetchedApiRef.current = false;
        return;
      }
      lastPollAtRef.current = 0;
      resolveActiveFromSources({ force: true });
    };

    window.addEventListener("orderStatusNotification", handleOrderStatusNotification);
    window.addEventListener("order-placed", handleOrderPlaced);
    window.addEventListener("userAuthChanged", handleAuthChange);

    return () => {
      window.removeEventListener("orderStatusNotification", handleOrderStatusNotification);
      window.removeEventListener("order-placed", handleOrderPlaced);
      window.removeEventListener("userAuthChanged", handleAuthChange);
      if (socketDebounceRef.current) {
        clearTimeout(socketDebounceRef.current);
      }
    };
  }, [
    mergeActiveOrder,
    removeIfMatches,
    resetStore,
    resolveActiveFromSources,
    setActiveOrder,
  ]);

  return null;
}

/** Mount inside OrdersProvider (UserLayout). */
export function ActiveOrderManagerBridge() {
  useActiveOrderManager();
  return null;
}
