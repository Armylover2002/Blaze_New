import { useEffect, useRef, useCallback, useState } from "react";
import porterUserApi from "../services/userApi";
import { usePorterCustomerSocket } from "./usePorterCustomerSocket";

export function usePorterOrderTracking(orderId, { pollMs = 5000, enabled = true } = {}) {
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(Boolean(orderId));
  const [error, setError] = useState(null);
  const seqRef = useRef(0);
  const pollTimerRef = useRef(null);

  const { isConnected, lastUpdate } = usePorterCustomerSocket(orderId, { enabled });

  const refresh = useCallback(async () => {
    if (!orderId || !enabled) return null;
    const seq = ++seqRef.current;
    try {
      const data = await porterUserApi.getOrder(orderId);
      if (seq !== seqRef.current) return null;
      const next = data?.order || data;
      setOrder(next);
      setError(null);
      return next;
    } catch (err) {
      if (seq !== seqRef.current) return null;
      setError(err);
      return null;
    } finally {
      if (seq === seqRef.current) setLoading(false);
    }
  }, [orderId, enabled]);

  const clearPollTimer = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const startPolling = useCallback(() => {
    clearPollTimer();
    if (!orderId || !enabled) return;
    pollTimerRef.current = setInterval(refresh, pollMs);
  }, [orderId, enabled, pollMs, refresh, clearPollTimer]);

  useEffect(() => {
    if (!orderId || !enabled) {
      clearPollTimer();
      return undefined;
    }

    setLoading(true);
    refresh();

    if (isConnected) {
      clearPollTimer();
    } else {
      startPolling();
    }

    return () => {
      seqRef.current += 1;
      clearPollTimer();
    };
  }, [orderId, enabled, isConnected, refresh, startPolling, clearPollTimer]);

  useEffect(() => {
    if (!lastUpdate || !orderId) return;
    if (String(lastUpdate.orderId) !== String(orderId)) return;

    setOrder((prev) => ({
      ...(prev || {}),
      id: orderId,
      orderNumber: lastUpdate.orderNumber || prev?.orderNumber,
      status: lastUpdate.status || prev?.status,
      dispatch: lastUpdate.dispatch || prev?.dispatch,
      deliveryState: lastUpdate.deliveryState || prev?.deliveryState,
      cancelled: Boolean(lastUpdate.cancelled),
    }));
  }, [lastUpdate, orderId]);

  return { order, loading, error, refresh, isSocketConnected: isConnected };
}
