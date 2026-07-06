import { useEffect, useRef, useState, useCallback } from "react";
import io from "socket.io-client";
import { API_BASE_URL } from "@food/api/config";

const debugLog = (...args) => {
  if (import.meta.env.DEV) console.log("[PorterCustomerSocket]", ...args);
};

function normalizeSocketUrl() {
  let backendUrl = API_BASE_URL;
  try {
    backendUrl = new URL(backendUrl).origin;
  } catch {
    backendUrl = String(backendUrl || "")
      .replace(/\/api\/v\d+\/?$/i, "")
      .replace(/\/api\/?$/i, "")
      .replace(/\/+$/, "");
  }
  return backendUrl;
}

/**
 * Socket-first Porter order tracking for customers.
 * Joins user room (auto) + tracking room for the active order.
 */
export function usePorterCustomerSocket(orderId, { enabled = true } = {}) {
  const socketRef = useRef(null);
  const orderIdRef = useRef(orderId);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);

  orderIdRef.current = orderId;

  const clearSocket = useCallback(() => {
    const socket = socketRef.current;
    if (!socket) return;
    const prevOrderId = orderIdRef.current;
    if (prevOrderId) {
      socket.emit("leave-tracking", prevOrderId);
    }
    socket.removeAllListeners();
    socket.disconnect();
    socketRef.current = null;
    setIsConnected(false);
  }, []);

  useEffect(() => {
    if (!enabled || !API_BASE_URL) {
      clearSocket();
      return undefined;
    }

    const token = localStorage.getItem("user_accessToken") || localStorage.getItem("accessToken");
    if (!token) return undefined;

    clearSocket();

    const socket = io(normalizeSocketUrl(), {
      path: "/socket.io/",
      transports: ["websocket", "polling"],
      reconnection: true,
      auth: { token },
    });
    socketRef.current = socket;

    const onStatus = (payload) => {
      if (String(payload?.documentType || "") !== "porter_order") return;
      if (orderIdRef.current && String(payload.orderId) !== String(orderIdRef.current)) return;
      debugLog("status update", payload?.status);
      setLastUpdate({ ...payload, receivedAt: Date.now() });
    };

    const onCancelled = (payload) => {
      if (String(payload?.documentType || "") !== "porter_order") return;
      if (orderIdRef.current && String(payload.orderId) !== String(orderIdRef.current)) return;
      setLastUpdate({ ...payload, cancelled: true, receivedAt: Date.now() });
    };

    socket.on("connect", () => {
      setIsConnected(true);
      if (orderIdRef.current) {
        socket.emit("join-tracking", orderIdRef.current);
      }
    });

    socket.on("disconnect", () => setIsConnected(false));
    socket.on("porter_order_status", onStatus);
    socket.on("order-status-update", onStatus);
    socket.on("porter_order_cancelled", onCancelled);

    return () => clearSocket();
  }, [enabled, clearSocket]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !orderId) return undefined;

    if (socket.connected) {
      socket.emit("join-tracking", orderId);
    }

    return () => {
      if (socket.connected) socket.emit("leave-tracking", orderId);
    };
  }, [orderId, isConnected]);

  return { isConnected, lastUpdate };
}

export default usePorterCustomerSocket;
