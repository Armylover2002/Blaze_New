import React, { useState, useEffect, useRef, useCallback, memo } from "react";
import { generateOrderInvoice } from "../../utils/printOrderInvoice";
import { useNavigate } from "react-router-dom";
import {
  checkOnboardingStatus,
  isRestaurantOnboardingComplete,
} from "@food/utils/onboardingUtils";
import { motion, AnimatePresence } from "framer-motion";
// import Lenis from "lenis";
import {
  Printer,
  Volume2,
  VolumeX,
  ChevronDown,
  ChevronUp,
  Minus,
  Plus,
  X,
  AlertCircle,
  Loader2,
  Calendar,
  Clock,
  MessageSquare,
  Check,
  Phone,
  User,
  Lock,
  Unlock,
  Star,
  Package,
  Utensils,
  Search,
  Menu,
  CheckCircle2,
  Inbox,
} from "lucide-react";
import { toast } from "sonner";
import BottomNavOrders from "@food/components/restaurant/BottomNavOrders";
import RestaurantNavbar from "@food/components/restaurant/RestaurantNavbar";
import notificationSound from "@food/assets/audio/alert.mp3";
import { restaurantAPI } from "@food/api";
import {
  formatScheduledAtShort,
  parseValidDate,
} from "@food/utils/scheduleTime";
import { useRestaurantNotifications } from "@food/hooks/useRestaurantNotifications";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import ResendNotificationButton from "@food/components/restaurant/ResendNotificationButton";
import { ActionSlider } from "@/modules/DeliveryV2/components/ui/ActionSlider";
const debugLog = (...args) => { };
const debugWarn = (...args) => { };
const debugError = (...args) => { };

const STORAGE_KEY = "restaurant_online_status";

// Top filter tabs
const filterTabs = [
  { id: "all", label: "All", icon: Menu },
  { id: "preparing", label: "Preparing", icon: Clock },
  { id: "ready", label: "Ready", icon: Check },
  { id: "out-for-delivery", label: "Out for delivery", icon: Package },
  { id: "scheduled", label: "Scheduled", icon: Calendar },
  { id: "completed", label: "Completed", icon: CheckCircle2 },
  { id: "cancelled", label: "Cancelled", icon: X },
];

const allOrdersStatusPriority = {
  pending: 0,
  confirmed: 1,
  preparing: 2,
  ready: 3,
  out_for_delivery: 4,
  scheduled: 5,
  delivered: 6,
  completed: 6,
  cancelled: 7,
};

const getAllOrdersTimestamp = (order) => {
  const status = String(order?.status || order?.orderStatus || "").toLowerCase();
  // Only while still scheduled: list clock must show scheduledAt (not createdAt).
  if (status === "scheduled") {
    const scheduled = parseValidDate(order.scheduledAt);
    if (scheduled) return scheduled.toISOString();
  }
  return (
    order?.cancelledAt ||
    order?.deliveredAt ||
    order?.updatedAt ||
    order?.createdAt ||
    new Date().toISOString()
  );
};

const getRestaurantVisibleItems = (items = []) => {
  const normalizedItems = Array.isArray(items) ? items : [];
  const foodItems = normalizedItems.filter((item) => {
    const itemType = String(item?.type || item?.orderType || "food").toLowerCase();
    return itemType !== "quick";
  });
  return foodItems.length ? foodItems : normalizedItems;
};

const buildOrderItemsSummary = (items = []) =>
  getRestaurantVisibleItems(items)
    .map((item) => `${item.quantity}x ${item.name}`)
    .join(", ") || "No items";

const getOrderPreviewItem = (items = []) =>
  getRestaurantVisibleItems(items)[0] || null;

const transformOrderForList = (order) => {
  const status = String(order.status || order.orderStatus || "pending").toLowerCase();
  const displayTs =
    status === "scheduled" && parseValidDate(order.scheduledAt)
      ? order.scheduledAt
      : getAllOrdersTimestamp(order);
  const isFoodQuick = String(order.deliveryMode || "").toLowerCase() === "quick";
  return {
  orderId: order.orderId || order._id,
  mongoId: order._id,
  status: order.status || "pending",
  customerName: order.userId?.name || order.customerName || "Customer",
  type: "Home Delivery",
  tableOrToken: null,
  timePlaced: new Date(displayTs).toLocaleDateString(
    "en-US",
    {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    },
  ),
  scheduledAt: order.scheduledAt || null,
  eta: order.etaPromise?.max || null,
  deliveryMode: order.deliveryMode || "basic",
  isFoodQuickDelivery: isFoodQuick,
  etaPromise: order.etaPromise || null,
  itemsSummary: buildOrderItemsSummary(order.items),
  photoUrl: getOrderPreviewItem(order.items)?.image || null,
  photoAlt: getOrderPreviewItem(order.items)?.name || "Order",
  paymentMethod: order.paymentMethod || order.payment?.method || null,
  deliveryPartnerId: order.deliveryPartnerId || null,
  dispatchStatus: order.dispatch?.status || null,
  preparingTimestamp: order.tracking?.preparing?.timestamp
    ? new Date(order.tracking.preparing.timestamp)
    : new Date(order.createdAt || Date.now()),
  initialETA: order.etaPromise?.max || order.estimatedDeliveryTime || 30,
  sortTimestamp: new Date(getAllOrdersTimestamp(order)).getTime(),
  kitchenPriority: isFoodQuick ? 0 : 1,
};
};

// Completed Orders List Component
function CompletedOrders({ onSelectOrder, refreshToken = 0, searchQuery = "" }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetchOrders = async () => {
      try {
        const response = await restaurantAPI.getOrders();

        if (!isMounted) return;

        if (response.data?.success && response.data.data?.orders) {
          const completedOrders = response.data.data.orders.filter(
            (order) =>
              order.status === "delivered" || order.status === "completed",
          );

          const transformedOrders = completedOrders.map((order) => ({
            orderId: order.orderId || order._id,
            mongoId: order._id,
            status: order.status || "delivered",
            customerName: order.userId?.name || order.customerName || "Customer",
            type: "Home Delivery",
            tableOrToken: null,
            timePlaced: new Date(order.createdAt).toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
            }),
            deliveredAt:
              order.deliveredAt || order.updatedAt || order.createdAt,
            itemsSummary: buildOrderItemsSummary(order.items),
            photoUrl: getOrderPreviewItem(order.items)?.image || null,
            photoAlt: getOrderPreviewItem(order.items)?.name || "Order",
            amount: order.pricing?.total || order.total || 0,
            paymentMethod: order.paymentMethod || order.payment?.method || null,
          }));

          transformedOrders.sort((a, b) => {
            const dateA = new Date(a.deliveredAt);
            const dateB = new Date(b.deliveredAt);
            return dateB - dateA;
          });

          if (isMounted) {
            setOrders(transformedOrders);
            setLoading(false);
          }
        } else {
          if (isMounted) {
            setOrders([]);
            setLoading(false);
          }
        }
      } catch (error) {
        if (!isMounted) return;

        if (error.code !== "ERR_NETWORK" && error.response?.status !== 404) {
          debugError("Error fetching completed orders:", error);
        }

        if (isMounted) {
          setOrders([]);
          setLoading(false);
        }
      }
    };

    fetchOrders();

    return () => {
      isMounted = false;
    };
  }, [refreshToken]);

  if (loading) {
    return (
      <div className="pt-4 pb-6">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-base font-semibold text-black">
            Completed orders
          </h2>
          <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
        </div>
        <div className="text-center py-8 text-gray-500 text-sm">Loading...</div>
      </div>
    );
  }

  const filteredOrders = orders.filter(o => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      String(o.orderId || o.mongoId || "").toLowerCase().includes(q) ||
      String(o.customerName || "").toLowerCase().includes(q) ||
      String(o.itemsSummary || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="pt-4 pb-6">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-base font-semibold text-black">Completed orders</h2>
        <span className="text-xs text-gray-500">{filteredOrders.length} total</span>
      </div>
      {filteredOrders.length === 0 ? (
        <div className="text-center py-8 text-gray-500 text-sm">
          No completed orders yet
        </div>
      ) : (
        <div>
          {filteredOrders.map((order) => {
            const deliveredDate = order.deliveredAt
              ? new Date(order.deliveredAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })
              : "N/A";

            return (
              <div
                key={order.orderId || order.mongoId}
                className="w-full bg-white rounded-2xl p-4 mb-3 border border-gray-200">
                <button
                  type="button"
                  onClick={() =>
                    onSelectOrder?.({
                      orderId: order.orderId,
                      status: "Delivered",
                      customerName: order.customerName,
                      type: order.type,
                      tableOrToken: order.tableOrToken,
                      timePlaced: deliveredDate,
                      itemsSummary: order.itemsSummary,
                      paymentMethod: order.paymentMethod,
                    })
                  }
                  className="w-full text-left flex gap-3 items-stretch">
                  <div className="h-20 w-20 rounded-xl overflow-hidden bg-gray-100 flex items-center justify-center flex-shrink-0 my-auto">
                    {order.photoUrl ? (
                      <img
                        src={order.photoUrl}
                        alt={order.photoAlt}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="h-full w-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center px-2">
                        <span className="text-[11px] font-medium text-gray-500 text-center leading-tight">
                          {order.photoAlt}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 flex flex-col justify-between min-h-[80px]">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-black leading-tight">
                          Order #{order.orderId}
                        </p>
                        <p className="text-[11px] text-gray-500 mt-1">
                          {order.customerName}
                        </p>
                      </div>

                      <div className="flex flex-col items-end gap-1">
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium border border-[#FF0000]/40 text-[#FF0000]">
                          <span className="h-1.5 w-1.5 rounded-full bg-[#FF0000]" />
                          Delivered
                        </span>
                        <span className="text-[11px] text-gray-500 text-right">
                          {deliveredDate}
                        </span>
                      </div>
                    </div>

                    <div className="mt-2">
                      <p className="text-xs text-gray-600 line-clamp-1">
                        {order.itemsSummary}
                      </p>
                    </div>

                    <div className="mt-2 flex items-end justify-between gap-2">
                      <div className="flex flex-col gap-1">
                        <p className="text-[11px] text-gray-500">
                          {order.type}
                        </p>
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-[11px] text-gray-500">
                          Amount
                        </span>
                        <span className="text-xs font-medium text-black">
                          ₹{order.amount.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Cancelled Orders List Component
function CancelledOrders({ onSelectOrder, refreshToken = 0, searchQuery = "" }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetchOrders = async () => {
      try {
        const response = await restaurantAPI.getOrders();

        if (!isMounted) return;

        if (response.data?.success && response.data.data?.orders) {
          // Filter cancelled orders (both restaurant and user cancelled)
          const cancelledOrders = response.data.data.orders.filter(
            (order) => order.status === "cancelled",
          );

          const transformedOrders = cancelledOrders.map((order) => ({
            orderId: order.orderId || order._id,
            mongoId: order._id,
            status: order.status || "cancelled",
            customerName: order.userId?.name || order.customerName || "Customer",
            type: "Home Delivery",
            tableOrToken: null,
            timePlaced: new Date(order.createdAt).toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
            }),
            cancelledAt:
              order.cancelledAt || order.updatedAt || order.createdAt,
            cancelledBy: order.cancelledBy || "unknown",
            cancellationReason:
              order.cancellationReason || "No reason provided",
            itemsSummary: buildOrderItemsSummary(order.items),
            photoUrl: getOrderPreviewItem(order.items)?.image || null,
            photoAlt: getOrderPreviewItem(order.items)?.name || "Order",
            amount: order.pricing?.total || order.total || 0,
            paymentMethod: order.paymentMethod || order.payment?.method || null,
          }));

          transformedOrders.sort((a, b) => {
            const dateA = new Date(a.cancelledAt);
            const dateB = new Date(b.cancelledAt);
            return dateB - dateA;
          });

          if (isMounted) {
            setOrders(transformedOrders);
            setLoading(false);
          }
        } else {
          if (isMounted) {
            setOrders([]);
            setLoading(false);
          }
        }
      } catch (error) {
        if (!isMounted) return;

        if (error.code !== "ERR_NETWORK" && error.response?.status !== 404) {
          debugError("Error fetching cancelled orders:", error);
        }

        if (isMounted) {
          setOrders([]);
          setLoading(false);
        }
      }
    };

    fetchOrders();

    return () => {
      isMounted = false;
    };
  }, [refreshToken]);

  if (loading) {
    return (
      <div className="pt-4 pb-6">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-base font-semibold text-black">
            Cancelled orders
          </h2>
          <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
        </div>
        <div className="text-center py-8 text-gray-500 text-sm">Loading...</div>
      </div>
    );
  }

  const filteredOrders = orders.filter(o => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      String(o.orderId || o.mongoId || "").toLowerCase().includes(q) ||
      String(o.customerName || "").toLowerCase().includes(q) ||
      String(o.itemsSummary || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="pt-4 pb-6">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-base font-semibold text-black">Cancelled orders</h2>
        <span className="text-xs text-gray-500">{filteredOrders.length} total</span>
      </div>
      {filteredOrders.length === 0 ? (
        <div className="text-center py-8 text-gray-500 text-sm">
          No cancelled orders yet
        </div>
      ) : (
        <div>
          {filteredOrders.map((order) => {
            const cancelledDate = order.cancelledAt
              ? new Date(order.cancelledAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })
              : "N/A";

            const cancelledByText =
              order.cancelledBy === "user"
                ? "Cancelled by User"
                : order.cancelledBy === "restaurant"
                  ? "Cancelled by Restaurant"
                  : "Cancelled";

            return (
              <div
                key={order.orderId || order.mongoId}
                className="w-full bg-white rounded-2xl p-4 mb-3 border border-gray-200">
                <button
                  type="button"
                  onClick={() =>
                    onSelectOrder?.({
                      orderId: order.orderId,
                      status: "Cancelled",
                      customerName: order.customerName,
                      type: order.type,
                      tableOrToken: order.tableOrToken,
                      timePlaced: cancelledDate,
                      itemsSummary: order.itemsSummary,
                      paymentMethod: order.paymentMethod,
                    })
                  }
                  className="w-full text-left flex gap-3 items-stretch">
                  <div className="h-20 w-20 rounded-xl overflow-hidden bg-gray-100 flex items-center justify-center flex-shrink-0 my-auto">
                    {order.photoUrl ? (
                      <img
                        src={order.photoUrl}
                        alt={order.photoAlt}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="h-full w-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center px-2">
                        <span className="text-[11px] font-medium text-gray-500 text-center leading-tight">
                          {order.photoAlt}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 flex flex-col justify-between min-h-[80px]">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-black leading-tight">
                          Order #{order.orderId}
                        </p>
                        <p className="text-[11px] text-gray-500 mt-1">
                          {order.customerName}
                        </p>
                      </div>

                      <div className="flex flex-col items-end gap-1">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium border ${order.cancelledBy === "user"
                            ? "border-red-500 text-red-600"
                            : "border-red-500 text-red-600"
                            }`}>
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${order.cancelledBy === "user"
                              ? "bg-red-500"
                              : "bg-red-500"
                              }`}
                          />
                          {cancelledByText}
                        </span>
                        <span className="text-[11px] text-gray-500 text-right">
                          {cancelledDate}
                        </span>
                      </div>
                    </div>

                    <div className="mt-2">
                      <p className="text-xs text-gray-600 line-clamp-1">
                        {order.itemsSummary}
                      </p>
                      {order.cancellationReason && (
                        <p className="text-[10px] text-red-600 mt-1 line-clamp-1">
                          Reason: {order.cancellationReason}
                        </p>
                      )}
                    </div>

                    <div className="mt-2 flex items-end justify-between gap-2">
                      <div className="flex flex-col gap-1">
                        <p className="text-[11px] text-gray-500">
                          {order.type}
                        </p>
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-[11px] text-gray-500">
                          Amount
                        </span>
                        <span className="text-xs font-medium text-black">
                          ₹{order.amount.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AllOrders({ onSelectOrder, onCancel, searchQuery = "" }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [markingReadyOrderIds, setMarkingReadyOrderIds] = useState({});

  useEffect(() => {
    let isMounted = true;
    let intervalId = null;
    let countdownIntervalId = null;

    const fetchOrders = async () => {
      try {
        const response = await restaurantAPI.getOrders();

        if (!isMounted) return;

        if (response.data?.success && response.data.data?.orders) {
          const transformedOrders = response.data.data.orders
            .map(transformOrderForList)
            .sort((a, b) => {
              const quickDiff = (a.kitchenPriority ?? 1) - (b.kitchenPriority ?? 1);
              if (quickDiff !== 0) return quickDiff;
              const priorityDiff =
                (allOrdersStatusPriority[a.status] ?? 999) -
                (allOrdersStatusPriority[b.status] ?? 999);
              if (priorityDiff !== 0) return priorityDiff;
              return b.sortTimestamp - a.sortTimestamp;
            });

          setOrders(transformedOrders);
        } else {
          setOrders([]);
        }
      } catch (error) {
        if (!isMounted) return;

        if (
          error.code !== "ERR_NETWORK" &&
          error.response?.status !== 404 &&
          error.response?.status !== 401
        ) {
          debugError("Error fetching all orders:", error);
        }

        setOrders([]);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchOrders();
    intervalId = setInterval(fetchOrders, 10000);
    countdownIntervalId = setInterval(() => {
      if (isMounted) {
        setCurrentTime(new Date());
      }
    }, 1000);

    return () => {
      isMounted = false;
      if (intervalId) clearInterval(intervalId);
      if (countdownIntervalId) clearInterval(countdownIntervalId);
    };
  }, []);

  const handleMarkReady = async ({ orderId, mongoId }) => {
    const orderKey = mongoId || orderId;
    if (!orderKey || markingReadyOrderIds[orderKey]) return;

    try {
      setMarkingReadyOrderIds((prev) => ({ ...prev, [orderKey]: true }));
      await restaurantAPI.markOrderReady(orderKey);
      setOrders((prev) =>
        prev.map((order) =>
          (order.mongoId || order.orderId) === orderKey
            ? {
              ...order,
              status: "ready",
              eta: null,
              sortTimestamp: Date.now(),
            }
            : order,
        ),
      );
      toast.success("Order marked as ready");
    } catch (error) {
      debugError("Error marking order as ready from All orders:", error);
      toast.error(
        error.response?.data?.message || "Failed to mark order as ready",
      );
    } finally {
      setMarkingReadyOrderIds((prev) => ({ ...prev, [orderKey]: false }));
    }
  };

  if (loading) {
    return (
      <div className="pt-4 pb-6">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-base font-semibold text-black">All orders</h2>
          <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
        </div>
        <div className="text-center py-8 text-gray-500 text-sm">Loading...</div>
      </div>
    );
  }

  const filteredOrders = orders.filter(o => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      String(o.orderId || o.mongoId || "").toLowerCase().includes(q) ||
      String(o.customerName || "").toLowerCase().includes(q) ||
      String(o.itemsSummary || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="pt-4 pb-6 md:pt-0">
      <div className="flex items-baseline justify-between mb-3 md:mb-5">
        <div className="flex items-center gap-2">
          <h2 className="text-base md:text-lg font-bold text-gray-900">All orders</h2>
          <span className="text-xs md:text-sm font-semibold text-gray-500">({filteredOrders.length})</span>
        </div>
        <button className="text-sm font-semibold text-blue-600 hidden md:block hover:text-blue-700 transition-colors">
          Full History &gt;
        </button>
      </div>
      {filteredOrders.length === 0 ? (
        <div className="md:bg-white md:rounded-2xl md:border md:border-gray-100/80 md:shadow-sm flex flex-col items-center justify-center py-16 md:min-h-[400px]">
          <div className="w-16 h-16 bg-slate-50/80 rounded-full flex items-center justify-center mb-4 border border-gray-100 hidden md:flex">
            <Inbox className="w-6 h-6 text-slate-300" strokeWidth={1.5} />
          </div>
          <h3 className="text-base md:text-lg font-bold text-gray-500 md:text-gray-900">There is no live order</h3>
          <p className="text-sm text-gray-400 mt-1 hidden md:block">There are no orders here right now.</p>
        </div>
      ) : (
        <div>
          {filteredOrders.map((order) => {
            const normalizedStatus = String(order.status || "").toLowerCase();
            let etaDisplay = order.eta;

            if (normalizedStatus === "preparing" && order.preparingTimestamp) {
              const elapsedMs = currentTime - order.preparingTimestamp;
              const elapsedMinutes = Math.floor(elapsedMs / 60000);
              const remainingMinutes = Math.max(
                0,
                order.initialETA - elapsedMinutes,
              );

              if (remainingMinutes <= 0) {
                const remainingSeconds = Math.max(
                  0,
                  Math.floor(order.initialETA * 60 - elapsedMs / 1000),
                );
                etaDisplay =
                  remainingSeconds > 0 ? `${remainingSeconds} secs` : "0 mins";
              } else {
                etaDisplay = `${remainingMinutes} mins`;
              }
            }

            return (
              <OrderCard
                key={order.orderId || order.mongoId}
                {...order}
                eta={etaDisplay}
                onSelect={onSelectOrder}
                onCancel={
                  normalizedStatus === "preparing" ? onCancel : undefined
                }
                onMarkReady={
                  normalizedStatus === "preparing" ? handleMarkReady : undefined
                }
                isMarkingReady={Boolean(
                  markingReadyOrderIds[order.mongoId || order.orderId],
                )}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function OrdersMain() {
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const contentRef = useRef(null);
  const filterBarRef = useRef(null);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  const touchStartY = useRef(0);
  const isSwiping = useRef(false);
  const mouseStartX = useRef(0);
  const mouseEndX = useRef(0);
  const isMouseDown = useRef(false);

  // New order popup states
  const [showNewOrderPopup, setShowNewOrderPopup] = useState(false);
  const [popupOrder, setPopupOrder] = useState(null); // Store order for popup (from Socket.IO or API)
  const [isMuted, setIsMuted] = useState(false);
  const [prepTime, setPrepTime] = useState(11);
  const [countdown, setCountdown] = useState(240); // 4 minutes in seconds
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(true);
  const [showRejectPopup, setShowRejectPopup] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showCancelPopup, setShowCancelPopup] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [orderToCancel, setOrderToCancel] = useState(null);
  const [acceptSwipeProgress, setAcceptSwipeProgress] = useState(0);
  const [isAcceptingOrder, setIsAcceptingOrder] = useState(false);
  const audioRef = useRef(null);
  const shownOrdersRef = useRef(new Set()); // Track orders already shown in popup
  const acceptSliderRef = useRef(null);
  const acceptSwipeStartXRef = useRef(0);
  const acceptSwipeActiveRef = useRef(false);
  const [restaurantStatus, setRestaurantStatus] = useState({
    isActive: null,
    rejectionReason: null,
    onboarding: null,
    isLoading: true,
  });
  const [isReverifying, setIsReverifying] = useState(false);
  const audioUnlockedRef = useRef(false);
  const showNewOrderPopupRef = useRef(showNewOrderPopup);
  const isMutedRef = useRef(isMuted);
  const newOrderRef = useRef(null);

  // Timer persistence helpers
  const getInitialCountdown = (orderId) => {
    if (!orderId) return 240;
    const storageKey = `order_timer_${orderId}`;
    const startTime = localStorage.getItem(storageKey);

    if (startTime) {
      const elapsed = Math.floor((Date.now() - parseInt(startTime)) / 1000);
      const remaining = 240 - elapsed;
      return remaining > 0 ? remaining : 0;
    } else {
      localStorage.setItem(storageKey, Date.now().toString());
      return 240;
    }
  };

  const clearOrderTimer = (orderId) => {
    if (orderId) {
      localStorage.removeItem(`order_timer_${orderId}`);
    }
  };

  const markOrderAsShown = (orderLike) => {
    const keys = [
      orderLike?.orderMongoId,
      orderLike?.orderId,
      orderLike?._id,
      orderLike?.id,
    ]
      .map((v) => (v == null ? "" : String(v).trim()))
      .filter(Boolean);

    for (const k of keys) shownOrdersRef.current.add(k);
  };

  const hasOrderBeenShown = (orderLike) => {
    const keys = [
      orderLike?.orderMongoId,
      orderLike?.orderId,
      orderLike?._id,
      orderLike?.id,
    ]
      .map((v) => (v == null ? "" : String(v).trim()))
      .filter(Boolean);

    return keys.some((k) => shownOrdersRef.current.has(k));
  };

  const getPopupOrderTotal = (orderLike) => {
    if (!orderLike) return 0;

    const rawItems = Array.isArray(orderLike.items) ? orderLike.items : [];
    const visibleItems = getRestaurantVisibleItems(rawItems);
    const hasFilteredMixedItems = visibleItems.length > 0 && visibleItems.length !== rawItems.length;

    if (hasFilteredMixedItems) {
      const visibleItemsTotal = visibleItems.reduce((sum, item) => {
        const price = Number(item?.price || 0);
        const qty = Number(item?.quantity || 0);
        return sum + (Number.isFinite(price) ? price : 0) * (Number.isFinite(qty) ? qty : 0);
      }, 0);

      return Number.isFinite(visibleItemsTotal) ? visibleItemsTotal : 0;
    }

    const directTotal = Number(orderLike.total);
    if (Number.isFinite(directTotal) && directTotal > 0) return directTotal;

    const pricingTotal = Number(orderLike.pricing?.total);
    if (Number.isFinite(pricingTotal) && pricingTotal > 0) return pricingTotal;

    const amountDue = Number(orderLike.payment?.amountDue);
    if (Number.isFinite(amountDue) && amountDue > 0) return amountDue;

    const itemsTotal = visibleItems.reduce((sum, item) => {
      const price = Number(item?.price || 0);
      const qty = Number(item?.quantity || 0);
      return sum + (Number.isFinite(price) ? price : 0) * (Number.isFinite(qty) ? qty : 0);
    }, 0);

    return Number.isFinite(itemsTotal) ? itemsTotal : 0;
  };

  // Restaurant notifications hook for real-time orders
  const { newOrder, clearNewOrder, isConnected } = useRestaurantNotifications();

  const rejectReasons = [
    "Restaurant is too busy",
    "Item not available",
    "Outside delivery area",
    "Kitchen closing soon",
    "Technical issue",
    "Other reason",
  ];

  // Fetch restaurant verification status
  useEffect(() => {
    const fetchRestaurantStatus = async () => {
      try {
        const response = await restaurantAPI.getCurrentRestaurant();
        const restaurant =
          response?.data?.data?.restaurant || response?.data?.restaurant;
        if (restaurant) {
          setRestaurantStatus({
            isActive: restaurant.isActive,
            rejectionReason: restaurant.rejectionReason || null,
            onboarding: restaurant.onboarding || null,
            isLoading: false,
          });

          // Check if onboarding is incomplete and redirect if needed
          if (!isRestaurantOnboardingComplete(restaurant)) {
            // Onboarding is incomplete, redirect to onboarding page
            const incompleteStep = await checkOnboardingStatus();
            if (incompleteStep) {
              navigate(`/restaurant/onboarding?step=${incompleteStep}`, {
                replace: true,
              });
              return;
            }
          }
        }
      } catch (error) {
        // Only log error if it's not a network/timeout error (backend might be down/slow)
        if (
          error.code !== "ERR_NETWORK" &&
          error.code !== "ECONNABORTED" &&
          !error.message?.includes("timeout")
        ) {
          debugError("Error fetching restaurant status:", error);
        }
        // Set loading to false so UI doesn't stay in loading state
        setRestaurantStatus((prev) => ({ ...prev, isLoading: false }));
      }
    };

    fetchRestaurantStatus();

    // Listen for restaurant profile updates
    const handleProfileRefresh = () => {
      fetchRestaurantStatus();
    };

    window.addEventListener("restaurantProfileRefresh", handleProfileRefresh);

    return () => {
      window.removeEventListener(
        "restaurantProfileRefresh",
        handleProfileRefresh,
      );
    };
  }, [navigate]);

  // Handle reverify (resubmit for approval)
  const handleReverify = async () => {
    try {
      setIsReverifying(true);
      await restaurantAPI.reverify();

      // Refresh restaurant status
      const response = await restaurantAPI.getCurrentRestaurant();
      const restaurant =
        response?.data?.data?.restaurant || response?.data?.restaurant;
      if (restaurant) {
        setRestaurantStatus({
          isActive: restaurant.isActive,
          rejectionReason: restaurant.rejectionReason || null,
          onboarding: restaurant.onboarding || null,
          isLoading: false,
        });
      }

      // Trigger profile refresh event
      window.dispatchEvent(new Event("restaurantProfileRefresh"));

      alert(
        "Restaurant reverified successfully! Verification will be done in 24 hours.",
      );
    } catch (error) {
      // Don't log network/timeout errors (backend might be down)
      if (
        error.code !== "ERR_NETWORK" &&
        error.code !== "ECONNABORTED" &&
        !error.message?.includes("timeout")
      ) {
        debugError("Error reverifying restaurant:", error);
      }

      // Handle 401 Unauthorized errors (token expired/invalid)
      if (error.response?.status === 401) {
        const errorMessage =
          error.response?.data?.message ||
          "Your session has expired. Please login again.";
        alert(errorMessage);
        // The axios interceptor should handle redirecting to login
        // But if it doesn't, we can manually redirect
        if (!error.response?.data?.message?.includes("inactive")) {
          // Only redirect if it's not an "inactive" error (which we handle differently)
          setTimeout(() => {
            window.location.href = "/restaurant/login";
          }, 1500);
        }
      } else {
        // Other errors (400, 500, etc.)
        const errorMessage =
          error.response?.data?.message ||
          "Failed to reverify restaurant. Please try again.";
        alert(errorMessage);
      }
    } finally {
      setIsReverifying(false);
    }
  };

  // Lenis smooth scrolling removed as it interferes with flex container scrolling in h-screen layouts
  
  // Show new order popup when real order notification arrives from Socket.IO
  useEffect(() => {
    if (newOrder) {
      debugLog("?? New order received via Socket.IO:", newOrder);

      const scheduledAt = newOrder.scheduledAt
        ? new Date(newOrder.scheduledAt).getTime()
        : null;
      const isFutureScheduled =
        scheduledAt && scheduledAt > Date.now() + 15 * 60000;

      if (isFutureScheduled) {
        toast.info(
          `New scheduled order received for ${formatScheduledAtShort(newOrder.scheduledAt) || "later"}`,
        );
        requestOrdersRefresh();
        return; // Do not show the immediate popup
      }

      if (!hasOrderBeenShown(newOrder)) {
        markOrderAsShown(newOrder);
        setPopupOrder(newOrder);
        setShowNewOrderPopup(true);
        const orderId = newOrder.orderMongoId || newOrder.orderId || newOrder._id;
        setCountdown(getInitialCountdown(orderId));
        requestOrdersRefresh();
      }
    }
  }, [newOrder]);

  // Keep refs in sync to avoid stale state inside one-time event handlers.
  useEffect(() => {
    showNewOrderPopupRef.current = showNewOrderPopup;
  }, [showNewOrderPopup]);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    newOrderRef.current = newOrder;
  }, [newOrder]);

  // Best-effort unlock for popup buzzer so it can keep playing when tab is backgrounded.
  useEffect(() => {
    const unlockAudio = async () => {
      if (audioUnlockedRef.current || !audioRef.current) return;
      try {
        audioRef.current.muted = true;
        await audioRef.current.play();
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current.muted = false;
        audioRef.current.volume = 1;
        audioUnlockedRef.current = true;

        // If an order popup is already open, start buzzing immediately after unlock.
        if (showNewOrderPopupRef.current && !isMutedRef.current) {
          audioRef.current.loop = true;
          audioRef.current.currentTime = 0;
          audioRef.current.play().catch(() => { });
        }
      } catch (_) {
        audioRef.current.muted = false;
      }
    };

    window.addEventListener("pointerdown", unlockAudio, {
      once: true,
      passive: true,
    });
    window.addEventListener("keydown", unlockAudio, { once: true });

    return () => {
      window.removeEventListener("pointerdown", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
    };
  }, []);

  const [ordersRefreshToken, setOrdersRefreshToken] = useState(0);
  const requestOrdersRefresh = () => setOrdersRefreshToken((t) => t + 1);

  // Check for confirmed orders that haven't been shown in popup yet, or scheduled orders whose time has come
  useEffect(() => {
    const checkOrdersToPopup = async () => {
      // Skip if popup is already showing or Socket.IO order exists
      if (showNewOrderPopupRef.current || newOrderRef.current) return;

      try {
        const response = await restaurantAPI.getOrders();
        if (response.data?.success && response.data.data?.orders) {
          const now = Date.now();

          // Find orders that should trigger the popup
          const targetOrders = response.data.data.orders.filter((order) => {
            if (hasOrderBeenShown(order)) return false;

            const status = String(order.status || order.orderStatus || "").toLowerCase();

            // Never Instant-popup while still waiting for BullMQ activation.
            if (status === "scheduled") return false;

            const isConfirmed = status === "confirmed";

            if (isConfirmed && !order.scheduledAt) return true; // ordinary confirmed fallback

            // After PRIMARY/fallback activation → placed. Same Instant popup surface.
            if (order.scheduledAt && status === "placed") {
              return true;
            }

            // Legacy remnant: created/confirmed with scheduledAt near window.
            if (
              order.scheduledAt &&
              (status === "created" || status === "confirmed")
            ) {
              const scheduledTime = new Date(order.scheduledAt).getTime();
              if (scheduledTime <= now + 15 * 60000) return true;
            }

            return false;
          });

          // Show the most recent matching order in popup
          if (
            targetOrders.length > 0 &&
            !showNewOrderPopupRef.current &&
            !newOrderRef.current
          ) {
            const orderToPopup = targetOrders[0];
            const orderId = orderToPopup.orderId || orderToPopup._id;

            // Transform order to match newOrder format (include payment so COD shows correctly)
            const orderForPopup = {
              orderId: orderToPopup.orderId,
              orderMongoId: orderToPopup._id,
              restaurantId: orderToPopup.restaurantId,
              restaurantName: orderToPopup.restaurantName,
              items: getRestaurantVisibleItems(orderToPopup.items || []),
              total: orderToPopup.pricing?.total || 0,
              customerAddress: orderToPopup.address,
              status: orderToPopup.status,
              createdAt: orderToPopup.createdAt,
              scheduledAt: orderToPopup.scheduledAt,
              estimatedDeliveryTime: orderToPopup.estimatedDeliveryTime || 30,
              note: orderToPopup.note || "",
              sendCutlery: orderToPopup.sendCutlery,
              paymentMethod:
                orderToPopup.paymentMethod ||
                orderToPopup.payment?.method ||
                null,
              payment: orderToPopup.payment,
            };

            debugLog("?? Found order ready for popup:", orderForPopup);
            markOrderAsShown({ orderId, _id: orderToPopup._id });
            setPopupOrder(orderForPopup);
            setShowNewOrderPopup(true);
            setCountdown(getInitialCountdown(orderId));
          }
        }
      } catch (error) {
        if (error.response?.status !== 401) {
          debugError("Error checking orders to popup:", error);
        }
      }
    };

    // Check once on mount, and then every minute
    checkOrdersToPopup();
    const intervalId = setInterval(checkOrdersToPopup, 60000);

    return () => clearInterval(intervalId);
  }, []);

  // Play audio when popup opens
  useEffect(() => {
    if (showNewOrderPopup && !isMuted) {
      if (audioRef.current) {
        audioRef.current.loop = true;
        audioRef.current.muted = false;
        audioRef.current.volume = 1;
        audioRef.current.currentTime = 0;
        audioRef.current
          .play()
          .catch((err) => debugLog("Audio play failed:", err));
      }
    } else if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, [showNewOrderPopup, isMuted]);

  // Countdown timer
  useEffect(() => {
    if (showNewOrderPopup) {
      if (countdown > 0) {
        const timer = setInterval(() => {
          setCountdown((prev) => prev - 1);
        }, 1000);
        return () => clearInterval(timer);
      } else {
        // Automatically reject when countdown hits 0
        handleAutoReject();
      }
    }
  }, [showNewOrderPopup, countdown]);

  useEffect(() => {
    if (!showNewOrderPopup) {
      setAcceptSwipeProgress(0);
      setIsAcceptingOrder(false);
      acceptSwipeActiveRef.current = false;
      acceptSwipeStartXRef.current = 0;
    }
  }, [showNewOrderPopup]);

  useEffect(() => {
    const handleMouseMove = (event) => {
      if (acceptSwipeActiveRef.current) {
        handleAcceptSwipeMove(event.clientX);
      }
    };

    const handleTouchMove = (event) => {
      if (acceptSwipeActiveRef.current && event.touches[0]) {
        // Prevent page scroll while swiping the slider
        if (typeof event.preventDefault === "function") event.preventDefault();
        handleAcceptSwipeMove(event.touches[0].clientX);
      }
    };

    const handlePointerEnd = () => {
      if (acceptSwipeActiveRef.current) {
        handleAcceptSwipeEnd();
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handlePointerEnd);
    // passive: false is required to allow preventDefault() during swipe
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handlePointerEnd);
    window.addEventListener("touchcancel", handlePointerEnd);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handlePointerEnd);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handlePointerEnd);
      window.removeEventListener("touchcancel", handlePointerEnd);
    };
  }, [isAcceptingOrder]);

  // Format countdown time
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const getAcceptSliderMetrics = () => {
    const sliderWidth = acceptSliderRef.current?.offsetWidth || 320;
    const handleWidth = 56;
    const horizontalPadding = 8;
    const maxTravel = Math.max(
      sliderWidth - handleWidth - horizontalPadding * 2,
      1,
    );
    return { maxTravel };
  };

  const triggerSwipeAccept = () => {
    if (isAcceptingOrder) return;
    setAcceptSwipeProgress(1);
    setTimeout(() => {
      handleAcceptOrder();
    }, 160);
  };

  const handleAcceptSwipeStart = (clientX) => {
    if (isAcceptingOrder) return;
    acceptSwipeStartXRef.current = clientX;
    acceptSwipeActiveRef.current = true;
  };

  const handleAcceptSwipeMove = (clientX) => {
    if (!acceptSwipeActiveRef.current || isAcceptingOrder) return;
    const deltaX = Math.max(clientX - acceptSwipeStartXRef.current, 0);
    const { maxTravel } = getAcceptSliderMetrics();
    setAcceptSwipeProgress(Math.min(deltaX / maxTravel, 1));
  };

  const handleAcceptSwipeEnd = () => {
    if (!acceptSwipeActiveRef.current || isAcceptingOrder) return;
    acceptSwipeActiveRef.current = false;

    if (acceptSwipeProgress >= 0.45) {
      triggerSwipeAccept();
      return;
    }

    setAcceptSwipeProgress(0);
  };

  // Handle auto reject on timeout
  const handleAutoReject = async () => {
    const orderToReject = popupOrder || newOrder;
    if (!orderToReject) return;

    const orderId = orderToReject.orderMongoId || orderToReject.orderId || orderToReject?._id;
    if (!orderId) return;

    try {
      // Use a special reason for auto-rejection
      await restaurantAPI.rejectOrder(orderId, "Order timeout - No response from restaurant");
      toast.info("Order auto-rejected due to timeout");
      clearOrderTimer(orderId);
      requestOrdersRefresh();
    } catch (error) {
      debugError("Error auto-rejecting order:", error);
    } finally {
      // Clean up UI state regardless of API success
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      setShowRejectPopup(false);
      setShowNewOrderPopup(false);
      setPopupOrder(null);
      clearNewOrder();
      setRejectReason("");
      setCountdown(240);
      setPrepTime(11);
      setAcceptSwipeProgress(0);
      setIsAcceptingOrder(false);
    }
  };

  // Handle accept order
  const handleAcceptOrder = async () => {
    if (isAcceptingOrder) return;
    setIsAcceptingOrder(true);

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    // Use popupOrder (from Socket.IO or API fallback) or newOrder (from hook)
    const orderToAccept = popupOrder || newOrder;

    // Ensure this order can't re-trigger fallback popup by using a different id key.
    markOrderAsShown(orderToAccept);

    // Accept order via API if we have a real order
    if (orderToAccept?.orderMongoId || orderToAccept?.orderId) {
      try {
        const orderId = orderToAccept.orderMongoId || orderToAccept.orderId;
        const response = await restaurantAPI.acceptOrder(orderId, prepTime);
        debugLog("? Order accepted:", orderId);
        toast.success("Order accepted successfully");
        requestOrdersRefresh();
      } catch (error) {
        debugError("? Error accepting order:", error);
        const errorMessage =
          error.response?.data?.message ||
          error.message ||
          "Failed to accept order. Please try again.";

        // Show specific error message
        if (error.response?.status === 400) {
          toast.error(errorMessage);
        } else if (error.response?.status === 404) {
          toast.error(
            "Order not found. It may have been cancelled or already processed.",
          );
        } else {
          toast.error(errorMessage);
        }
        setIsAcceptingOrder(false);
        setAcceptSwipeProgress(0);
        return;
      }
    }

    const orderId = orderToAccept?.orderMongoId || orderToAccept?.orderId || orderToAccept?._id;
    clearOrderTimer(orderId);

    setShowNewOrderPopup(false);
    setPopupOrder(null);
    clearNewOrder();
    setCountdown(240);
    setPrepTime(11);
    setAcceptSwipeProgress(0);
    setIsAcceptingOrder(false);

    // Note: PreparingOrders component will automatically refresh orders via its own useEffect
    // No need to manually refresh here as the component polls every 10 seconds
  };

  // Handle reject order
  const handleRejectClick = () => {
    setShowRejectPopup(true);
  };

  const handleRejectConfirm = async () => {
    if (!rejectReason) return;

    // Use popupOrder (from Socket.IO or API fallback) or newOrder (from hook)
    const orderToReject = popupOrder || newOrder;

    // Reject order via API if we have a real order
    if (orderToReject?.orderMongoId || orderToReject?.orderId) {
      try {
        const orderId = orderToReject.orderMongoId || orderToReject.orderId;
        await restaurantAPI.rejectOrder(orderId, rejectReason);
        debugLog("? Order rejected:", orderId);
        requestOrdersRefresh();
      } catch (error) {
        debugError("? Error rejecting order:", error);
        alert("Failed to reject order. Please try again.");
        return;
      }
    }

    const orderId = orderToReject?.orderMongoId || orderToReject?.orderId || orderToReject?._id;
    clearOrderTimer(orderId);

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setShowRejectPopup(false);
    setShowNewOrderPopup(false);
    setPopupOrder(null);
    clearNewOrder();
    setRejectReason("");
    setCountdown(240);
    setPrepTime(11);
  };

  const handleRejectCancel = () => {
    setShowRejectPopup(false);
    setShowNewOrderPopup(false);
    setPopupOrder(null);
    clearNewOrder();
    setRejectReason("");
    setCountdown(240);
  };

  // Handle cancel order (for preparing orders)
  const handleCancelClick = useCallback((order) => {
    setOrderToCancel(order);
    setShowCancelPopup(true);
  }, []);

  const handleCancelConfirm = async () => {
    if (!cancelReason.trim() || !orderToCancel) return;

    try {
      const orderId = orderToCancel.mongoId || orderToCancel.orderId;
      await restaurantAPI.rejectOrder(orderId, cancelReason.trim());
      toast.success("Order cancelled successfully");
      requestOrdersRefresh();
      setShowCancelPopup(false);
      setOrderToCancel(null);
      setCancelReason("");
    } catch (error) {
      debugError("? Error cancelling order:", error);
      toast.error(error.response?.data?.message || "Failed to cancel order");
    }
  };

  const handleCancelPopupClose = () => {
    setShowCancelPopup(false);
    setOrderToCancel(null);
    setCancelReason("");
  };

  // Toggle mute
  const toggleMute = () => {
    setIsMuted(!isMuted);
    if (audioRef.current) {
      if (!isMuted) {
        audioRef.current.pause();
      } else {
        audioRef.current.muted = false;
        audioRef.current.volume = 1;
        audioRef.current.currentTime = 0;
        audioRef.current
          .play()
          .catch((err) => debugLog("Audio play failed:", err));
      }
    }
  };

  // Handle PDF download
  const handlePrint = async () => {
    const orderToPrint = currentPopupOrder;
    if (!orderToPrint) {
      debugWarn("No order data available for PDF generation");
      return;
    }

    try {
      await generateOrderInvoice(orderToPrint);
      debugLog("? PDF generated successfully");
    } catch (error) {
      debugError("? Error generating PDF:", error);
      alert("Failed to generate PDF. Please try again.");
    }
  };

  // Handle swipe gestures with smooth animations
  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    touchEndX.current = e.touches[0].clientX;
    isSwiping.current = false;
  };

  const handleTouchMove = (e) => {
    if (!isSwiping.current) {
      const deltaX = Math.abs(e.touches[0].clientX - touchStartX.current);
      const deltaY = Math.abs(e.touches[0].clientY - touchStartY.current);

      // Determine if this is a horizontal swipe
      if (deltaX > deltaY && deltaX > 10) {
        isSwiping.current = true;
      }
    }

    if (isSwiping.current) {
      touchEndX.current = e.touches[0].clientX;
    }
  };

  const handleTouchEnd = () => {
    if (!isSwiping.current) {
      touchStartX.current = 0;
      touchEndX.current = 0;
      return;
    }

    const swipeDistance = touchStartX.current - touchEndX.current;
    const minSwipeDistance = 50;
    const swipeVelocity = Math.abs(swipeDistance);

    if (swipeVelocity > minSwipeDistance && !isTransitioning) {
      const currentIndex = filterTabs.findIndex(
        (tab) => tab.id === activeFilter,
      );
      let newIndex = currentIndex;

      if (swipeDistance > 0 && currentIndex < filterTabs.length - 1) {
        // Swipe left - go to next filter (right side)
        newIndex = currentIndex + 1;
      } else if (swipeDistance < 0 && currentIndex > 0) {
        // Swipe right - go to previous filter (left side)
        newIndex = currentIndex - 1;
      }

      if (newIndex !== currentIndex) {
        setIsTransitioning(true);

        // Smooth transition with animation
        setTimeout(() => {
          setActiveFilter(filterTabs[newIndex].id);
          scrollToFilter(newIndex);

          // Reset transition state after animation
          setTimeout(() => {
            setIsTransitioning(false);
          }, 300);
        }, 50);
      }
    }

    // Reset touch positions
    touchStartX.current = 0;
    touchEndX.current = 0;
    touchStartY.current = 0;
    isSwiping.current = false;
  };

  // Scroll filter bar to show active button with smooth animation
  const scrollToFilter = (index) => {
    if (filterBarRef.current) {
      const buttons = filterBarRef.current.querySelectorAll("button");
      if (buttons[index]) {
        const button = buttons[index];
        const container = filterBarRef.current;
        const buttonLeft = button.offsetLeft;
        const buttonWidth = button.offsetWidth;
        const containerWidth = container.offsetWidth;
        const scrollLeft = buttonLeft - containerWidth / 2 + buttonWidth / 2;

        container.scrollTo({
          left: scrollLeft,
          behavior: "smooth",
        });
      }
    }
  };

  // Scroll to active filter on change with smooth animation
  useEffect(() => {
    const index = filterTabs.findIndex((tab) => tab.id === activeFilter);
    if (index >= 0) {
      // Use requestAnimationFrame for smoother scrolling
      requestAnimationFrame(() => {
        scrollToFilter(index);
      });
    }
  }, [activeFilter]);

  const handleSelectOrder = useCallback((order) => {
    setSelectedOrder(order);
    setIsSheetOpen(true);
  }, []);

  const renderContent = () => {
    switch (activeFilter) {
      case "all":
        return (
          <AllOrders
            onSelectOrder={handleSelectOrder}
            onCancel={handleCancelClick}
            searchQuery={searchQuery}
          />
        );
      case "preparing":
        return (
          <PreparingOrders
            onSelectOrder={handleSelectOrder}
            onCancel={handleCancelClick}
            refreshToken={ordersRefreshToken}
            onStatusChanged={requestOrdersRefresh}
            searchQuery={searchQuery}
          />
        );
      case "ready":
        return (
          <ReadyOrders
            onSelectOrder={handleSelectOrder}
            refreshToken={ordersRefreshToken}
            searchQuery={searchQuery}
          />
        );
      case "out-for-delivery":
        return (
          <OutForDeliveryOrders
            onSelectOrder={handleSelectOrder}
            refreshToken={ordersRefreshToken}
            searchQuery={searchQuery}
          />
        );
      case "scheduled":
        return (
          <ScheduledOrders
            onSelectOrder={handleSelectOrder}
            refreshToken={ordersRefreshToken}
            searchQuery={searchQuery}
          />
        );
      case "completed":
        return (
          <CompletedOrders
            onSelectOrder={handleSelectOrder}
            refreshToken={ordersRefreshToken}
            searchQuery={searchQuery}
          />
        );
case "cancelled":
        return (
          <CancelledOrders
            onSelectOrder={handleSelectOrder}
            refreshToken={ordersRefreshToken}
            searchQuery={searchQuery}
          />
        );
      default:
        return <EmptyState />;
    }
  };

  const currentPopupOrder = popupOrder || newOrder;
  const popupVisibleItems = getRestaurantVisibleItems(currentPopupOrder?.items);
  const popupPrimaryItem = popupVisibleItems[0] || null;

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-100 md:bg-slate-50 md:overflow-hidden overflow-x-hidden">
      {/* Restaurant Navbar - Sticky at top (Mobile only) */}
      <div className="sticky top-0 z-50 bg-white md:hidden">
        <RestaurantNavbar showNotifications={true} />
      </div>

      {/* Desktop Header */}
      <div className="hidden md:flex items-center justify-between px-6 pt-5 pb-3 bg-white">
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">Live orders</h1>
          <p className="text-xs text-gray-500 mt-0.5">Manage incoming and active orders</p>
        </div>
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search orders, menu..."
            className="pl-11 pr-4 py-2.5 bg-white border border-gray-100 rounded-full text-sm w-80 focus:outline-none focus:border-gray-300 shadow-[0_2px_10px_rgba(0,0,0,0.02)] transition-shadow"
          />
        </div>
      </div>

      {/* Top Filter Bar - Sticky below navbar on mobile, static on desktop */}
      <div className="sticky top-[50px] md:static z-40 pb-2 md:pb-3 bg-gray-100 md:bg-white md:px-6 border-b border-gray-200/50 md:border-gray-100">
        <div
          ref={filterBarRef}
          className="flex gap-2 overflow-x-auto scrollbar-hide bg-transparent rounded-full px-3 md:px-0 py-2 mt-2 md:mt-0"
          style={{
            scrollbarWidth: "none",
            msOverflowStyle: "none",
            WebkitOverflowScrolling: "touch",
          }}>
          <style>{`
            .scrollbar-hide::-webkit-scrollbar {
              display: none;
            }
          `}</style>
          {filterTabs.map((tab, index) => {
            const isActive = activeFilter === tab.id;

            return (
              <motion.button
                key={tab.id}
                onClick={() => {
                  if (!isTransitioning) {
                    setIsTransitioning(true);
                    setActiveFilter(tab.id);
                    scrollToFilter(index);
                    setTimeout(() => setIsTransitioning(false), 300);
                  }
                }}
                className={`shrink-0 px-4 py-2 md:px-5 md:py-2.5 rounded-full font-medium text-xs md:text-[13px] whitespace-nowrap relative overflow-hidden flex items-center gap-2 ${isActive ? "text-white" : "bg-white text-gray-600 border border-gray-100/50 hover:bg-gray-50"
                  }`}
                animate={{
                  scale: isActive ? 1.05 : 1,
                  opacity: isActive ? 1 : 0.7,
                }}
                transition={{
                  duration: 0.3,
                  ease: [0.25, 0.1, 0.25, 1],
                }}
                whileTap={{ scale: 0.95 }}>
                {isActive && (
                  <motion.div
                    layoutId="activeFilterBackground"
                    className="absolute inset-0 bg-[#FF0000] rounded-full -z-10"
                    initial={false}
                    transition={{
                      type: "spring",
                      stiffness: 500,
                      damping: 30,
                    }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-1.5">
                  {tab.icon && <tab.icon className={`w-3.5 h-3.5 md:w-4 md:h-4 ${isActive ? "text-white" : "text-gray-400"}`} strokeWidth={2.5} />}
                  {tab.label}
                </span>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Main Layout Area */}
      <div className="flex-1 min-h-0 flex flex-col md:flex-row md:gap-6 px-4 md:px-6 pt-4 md:pt-6 pb-24 md:pb-6 md:overflow-hidden">
        
        {/* Left Column - Scrollable Content */}
        <div
          ref={contentRef}
          className="flex-1 min-w-0 min-h-0 overflow-y-auto content-scroll md:pr-1 overscroll-none"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onMouseDown={(e) => {
            mouseStartX.current = e.clientX;
            mouseEndX.current = e.clientX;
            isMouseDown.current = true;
            isSwiping.current = false;
          }}
          onMouseMove={(e) => {
            if (isMouseDown.current) {
              if (!isSwiping.current) {
                const deltaX = Math.abs(e.clientX - mouseStartX.current);
                if (deltaX > 10) {
                  isSwiping.current = true;
                }
              }
              if (isSwiping.current) {
                mouseEndX.current = e.clientX;
              }
            }
          }}
          onMouseUp={() => {
            if (isMouseDown.current && isSwiping.current) {
              const swipeDistance = mouseStartX.current - mouseEndX.current;
              const minSwipeDistance = 50;

              if (
                Math.abs(swipeDistance) > minSwipeDistance &&
                !isTransitioning
              ) {
                const currentIndex = filterTabs.findIndex(
                  (tab) => tab.id === activeFilter,
                );
                let newIndex = currentIndex;

                if (swipeDistance > 0 && currentIndex < filterTabs.length - 1) {
                  newIndex = currentIndex + 1;
                } else if (swipeDistance < 0 && currentIndex > 0) {
                  newIndex = currentIndex - 1;
                }

                if (newIndex !== currentIndex) {
                  setIsTransitioning(true);
                  setTimeout(() => {
                    setActiveFilter(filterTabs[newIndex].id);
                    scrollToFilter(newIndex);
                    setTimeout(() => setIsTransitioning(false), 300);
                  }, 50);
                }
              }
            }

            isMouseDown.current = false;
            isSwiping.current = false;
            mouseStartX.current = 0;
            mouseEndX.current = 0;
          }}
          onMouseLeave={() => {
            isMouseDown.current = false;
            isSwiping.current = false;
          }}>
          <style>{`
            .content-scroll {
              scrollbar-width: none;
              -ms-overflow-style: none;
            }
            .content-scroll::-webkit-scrollbar {
              display: none;
            }
          `}</style>

          {/* Verification Pending Card - Show if onboarding is complete (all 4 steps) and restaurant is not active */}
        {!restaurantStatus.isLoading &&
          !restaurantStatus.isActive &&
          restaurantStatus.onboarding?.completedSteps === 4 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className={`mt-4 mb-4 rounded-2xl shadow-sm px-6 py-4 ${restaurantStatus.rejectionReason
                ? "bg-white border border-red-200"
                : "bg-white border border-yellow-200"
                }`}>
              {restaurantStatus.rejectionReason ? (
                <>
                  <div className="flex items-start gap-3 mb-3">
                    <div className="flex-shrink-0 rounded-full p-2 bg-red-100">
                      <AlertCircle className="w-5 h-5 text-red-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-bold text-red-600 mb-2">
                        Denied Verification
                      </h3>
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
                        <p className="text-xs font-semibold text-red-800 mb-2">
                          Reason for Rejection:
                        </p>
                        <div className="text-xs text-red-700 space-y-1">
                          {restaurantStatus.rejectionReason
                            .split("\n")
                            .filter((line) => line.trim()).length > 1 ? (
                            <ul className="space-y-1 list-disc list-inside">
                              {restaurantStatus.rejectionReason
                                .split("\n")
                                .map(
                                  (point, index) =>
                                    point.trim() && (
                                      <li key={index}>{point.trim()}</li>
                                    ),
                                )}
                            </ul>
                          ) : (
                            <p className="text-red-700">
                              {restaurantStatus.rejectionReason}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-gray-700 mb-3">
                    Please correct the above issues and click "Reverify" to
                    resubmit your request for approval.
                  </p>
                  <button
                    onClick={handleReverify}
                    disabled={isReverifying}
                    className="w-full px-6 py-2.5 bg-blue-600 text-white rounded-lg font-semibold text-sm hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                    {isReverifying ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      "Reverify"
                    )}
                  </button>
                </>
              ) : (
                <>
                  <h3 className="text-lg font-bold text-gray-900 mb-1">
                    Verification Done in 24 Hours
                  </h3>
                  <p className="text-sm text-gray-600">
                    Your account is under verification. You'll be notified once
                    approved.
                  </p>
                </>
              )}
            </motion.div>
          )}

          <div className="min-h-full flex flex-col">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeFilter}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}>
                {renderContent()}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Desktop Details Pane (Right Column) */}
        <div className="hidden md:flex flex-col bg-white rounded-2xl border border-gray-100/80 shadow-sm overflow-hidden w-[380px] lg:w-[420px] shrink-0 h-full">
            {selectedOrder ? (
              <div className="flex-1 overflow-y-auto p-4 md:p-5 flex flex-col">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <p className="text-[13px] font-bold text-black">
                      Order #{selectedOrder.orderId}
                    </p>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      {selectedOrder.customerName}
                    </p>
                    <p className="text-[10px] text-gray-500 mt-0.5">
                      {selectedOrder.type}
                      {selectedOrder.tableOrToken
                        ? ` • ${selectedOrder.tableOrToken}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium border ${selectedOrder.status === "Ready"
                          ? "border-green-500 text-green-600"
                          : "border-gray-800 text-gray-900"
                        }`}>
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${selectedOrder.status === "Ready"
                            ? "bg-green-500"
                            : "bg-gray-800"
                          }`}
                      />
                      {selectedOrder.status}
                    </span>
                    <span className="text-[11px] text-gray-500">
                      {selectedOrder.timePlaced}
                    </span>
                    {(String(selectedOrder.status).toLowerCase() === "preparing" ||
                      String(selectedOrder.status).toLowerCase() === "ready") &&
                      !selectedOrder.deliveryPartnerId && (
                        <div className="mt-1">
                          <ResendNotificationButton
                            orderId={selectedOrder.orderId}
                            mongoId={selectedOrder.mongoId}
                            onSuccess={() => {}}
                          />
                        </div>
                      )}
                  </div>
                </div>

                <div className="border-t border-gray-100 my-3" />

                <div className="mb-3">
                  <p className="text-[11px] font-semibold text-gray-700 mb-1">Items</p>
                  <p className="text-xs text-gray-800 leading-relaxed">
                    {selectedOrder.itemsSummary}
                  </p>
                </div>

                <div className="flex items-center justify-between text-xs text-gray-500 mb-4 bg-gray-50 p-3 rounded-xl border border-gray-100">
                  {selectedOrder.status !== "ready" && selectedOrder.eta && (
                    <span className="flex flex-col gap-1">
                      <span className="text-[10px] uppercase font-bold text-gray-400">ETA</span>
                      <span className="font-bold text-gray-900 text-sm">
                        {selectedOrder.eta}
                      </span>
                    </span>
                  )}
                  {(() => {
                    const raw = selectedOrder.paymentMethod;
                    const normalized =
                      raw != null ? String(raw).toLowerCase().trim() : "";
                    const isCod = normalized === "cash" || normalized === "cod";
                    return (
                      <span className="flex flex-col gap-1 text-right">
                        <span className="text-[10px] uppercase font-bold text-gray-400">Payment</span>
                        <span
                          className={`font-bold text-sm ${isCod ? "text-amber-600" : "text-gray-900"}`}>
                          {isCod ? "Cash on Delivery" : "Paid online"}
                        </span>
                      </span>
                    );
                  })()}
                </div>

                {/* Delivery Partner Details in Desktop Pane */}
                {selectedOrder.deliveryPartnerId && typeof selectedOrder.deliveryPartnerId === 'object' && (
                  <div className="mb-2 pt-3 border-t border-gray-100 mt-auto">
                    <p className="text-[11px] font-bold text-gray-700 mb-2">Delivery Partner details</p>
                    <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3 flex flex-col gap-2">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#FF0000]/10 rounded-full flex items-center justify-center shrink-0">
                          <User className="w-5 h-5 text-[#FF0000]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-gray-900 truncate">
                            {selectedOrder.deliveryPartnerId.name}
                          </p>
                          {selectedOrder.deliveryPartnerId.rating > 0 && (
                            <div className="flex items-center gap-1 mt-0.5">
                              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                              <span className="text-xs font-semibold text-gray-600">
                                {selectedOrder.deliveryPartnerId.rating}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="border-t border-gray-200/60 pt-2 flex flex-col gap-2">
                        {selectedOrder.deliveryPartnerId.phone === "Hidden until photo upload" || !selectedOrder.deliveryPartnerId.phone ? (
                          <div className="flex items-start gap-1.5 bg-amber-50 border border-amber-200/50 rounded-xl p-2.5">
                            <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                            <div className="flex-1">
                              <p className="text-[11px] font-bold text-amber-800">Phone Hidden</p>
                              <p className="text-[10px] text-amber-700 leading-tight mt-0.5">
                                Phone number will be shown once rider arrives at your shop and uploads photo.
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between bg-green-50 border border-green-200/50 rounded-xl p-2.5">
                            <div className="flex items-start gap-1.5">
                              <Unlock className="w-3.5 h-3.5 text-green-600 shrink-0 mt-0.5" />
                              <div>
                                <p className="text-[11px] font-bold text-green-800">Phone Unlocked</p>
                                <p className="text-xs font-bold text-gray-900 mt-0.5">{selectedOrder.deliveryPartnerId.phone}</p>
                              </div>
                            </div>
                            <a
                              href={`tel:${selectedOrder.deliveryPartnerId.phone}`}
                              className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 bg-[#FF0000] text-white text-[11px] font-bold rounded-lg shadow-sm hover:bg-[#e04a02] transition-colors shrink-0"
                            >
                              <Phone className="w-3 h-3" />
                              Call
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center h-full">
                <div className="w-20 h-20 bg-slate-50/80 rounded-full flex items-center justify-center mb-6 border border-gray-100">
                  <Inbox className="w-8 h-8 text-slate-300" strokeWidth={1.5} />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">No order selected</h3>
                <p className="text-sm text-gray-500 max-w-[250px]">
                  Select an order from the list to view detailed information, items, and status
                </p>
              </div>
            )}
        </div>
      </div>

      {/* Audio element */}
      <audio
        ref={audioRef}
        src={notificationSound}
        preload="auto"
        aria-label="New order notification sound"
      />

      {/* New Order Popup */}
      <AnimatePresence>
        {showNewOrderPopup && (
          <>
            <motion.div
              className="fixed inset-0 z-[200] bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}>
              <motion.div
                className="w-full max-w-lg max-h-[90vh] bg-white rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-[0_-20px_60px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col"
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                onClick={(e) => e.stopPropagation()}>
                {/* Header Ribbon */}
                <div className="bg-[#FF0000] px-5 py-4 flex justify-between items-center text-white border-b border-red-600/20">
                  <div>
                    <p className="text-white/90 text-[10px] font-bold uppercase tracking-widest mb-0.5">
                      Incoming Order
                    </p>
                    <h3 className="text-xl font-bold text-white tracking-tight">
                      {currentPopupOrder?.orderId || "#Order"}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handlePrint}
                      className="p-2 hover:bg-white/20 active:scale-95 rounded-full transition-all"
                      aria-label="Print">
                      <Printer className="w-5 h-5 text-white" />
                    </button>
                    <button
                      onClick={toggleMute}
                      className="p-2 hover:bg-white/20 active:scale-95 rounded-full transition-all"
                      aria-label={isMuted ? "Unmute" : "Mute"}>
                      {isMuted ? (
                        <VolumeX className="w-5 h-5 text-white" />
                      ) : (
                        <Volume2 className="w-5 h-5 text-white" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Content */}
                <div className="px-4 pt-4 pb-3 flex-1 overflow-y-auto min-h-0 bg-gray-50 space-y-3">
                  {/* Scheduled Indicator */}
                  {currentPopupOrder?.scheduledAt && (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-3 shadow-sm">
                      <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                        <Calendar className="w-4 h-4 text-green-600" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-[#FF0000] uppercase tracking-wider">
                          Scheduled Order
                        </p>
                        <p className="text-sm font-bold text-[#FF0000]">
                          For{" "}
                          {formatScheduledAtShort(currentPopupOrder.scheduledAt) ||
                            "Scheduled time"}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Customer info & Details */}
                  <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="p-3 border-b border-gray-100 flex justify-between items-center">
                      <div>
                        <h4 className="text-base font-bold text-gray-900 tracking-tight">
                          {popupPrimaryItem?.name || "New Order"}
                        </h4>
                        <p className="text-[11px] text-gray-500 mt-0.5">
                          {currentPopupOrder?.createdAt
                            ? new Date(
                              currentPopupOrder.createdAt,
                            ).toLocaleString("en-GB", {
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                            : "Just now"}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="block text-xs font-medium text-gray-500">
                          {popupVisibleItems.length || 0} item
                          {popupVisibleItems.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => setIsDetailsExpanded(!isDetailsExpanded)}
                      className="w-full flex items-center justify-center py-2 bg-gray-50/50 hover:bg-gray-50 transition-colors">
                      <span className="text-xs font-semibold text-gray-600 mr-1">
                        {isDetailsExpanded ? "Hide Details" : "View Details"}
                      </span>
                      {isDetailsExpanded ? (
                        <ChevronUp className="w-3.5 h-3.5 text-gray-500" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
                      )}
                    </button>

                    <AnimatePresence>
                      {isDetailsExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden bg-gray-50/30">
                          <div className="px-3 py-3 space-y-2 border-t border-gray-100">
                            {popupVisibleItems.length > 0 ? popupVisibleItems.map(
                              (item, index) => (
                                <div
                                  key={index}
                                  className="flex items-start gap-2">
                                  <div
                                    className={`w-2.5 h-2.5 rounded-full mt-1 shrink-0 ${item.isVeg ? "bg-green-500" : "bg-red-500"}`}></div>
                                  <div className="flex-1">
                                    <div className="flex items-start justify-between">
                                      <p className="text-xs font-semibold text-gray-900 leading-snug">
                                        {item.quantity} × {item.name}
                                      </p>
                                      <p className="text-xs font-bold text-gray-900 ml-2 shrink-0">
                                        ₹{item.price * item.quantity}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              ),
                            ) : (
                              <p className="text-xs text-gray-500 text-center">No items</p>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Order Summary & Settings Card */}
                  <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
                    {/* Cutlery preference & Payment */}
                    <div className="flex items-center justify-between p-3 border-b border-gray-100">
                      <div className="flex items-center gap-2">
                        <Utensils className={`w-4 h-4 ${(popupOrder || newOrder)?.sendCutlery === false ? "text-red-500" : "text-gray-400"}`} />
                        <span className={`text-[11px] font-bold uppercase tracking-wider ${(popupOrder || newOrder)?.sendCutlery === false ? "text-red-600" : "text-gray-600"}`}>
                          {(popupOrder || newOrder)?.sendCutlery === false ? "No Cutlery" : "Send Cutlery"}
                        </span>
                      </div>
                      {(() => {
                        const raw = (popupOrder || newOrder)?.paymentMethod || (popupOrder || newOrder)?.payment?.method;
                        const m = raw != null ? String(raw).toLowerCase().trim() : "";
                        const isCod = m === "cash" || m === "cod";
                        return (
                          <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded border ${isCod ? "bg-amber-50 text-amber-600 border-amber-200" : "bg-green-50 text-green-600 border-green-200"}`}>
                            {isCod ? "COD" : "Paid"}
                          </span>
                        );
                      })()}
                    </div>

                    {/* Prep Time Row */}
                    <div className="flex items-center justify-between p-3 border-b border-gray-100">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-gray-400" />
                        <span className="text-sm font-semibold text-gray-700">Prep Time</span>
                      </div>
                      <div className="flex items-center gap-2 bg-gray-50 p-1 rounded-lg border border-gray-100">
                        <button
                          onClick={() => setPrepTime(Math.max(1, prepTime - 1))}
                          className="w-7 h-7 flex items-center justify-center bg-white hover:bg-gray-100 rounded shadow-sm transition-colors active:scale-95">
                          <Minus className="w-3.5 h-3.5 text-gray-700" />
                        </button>
                        <span className="text-sm font-bold text-gray-900 w-8 text-center">
                          {prepTime}m
                        </span>
                        <button
                          onClick={() => setPrepTime(prepTime + 1)}
                          className="w-7 h-7 flex items-center justify-center bg-white hover:bg-gray-100 rounded shadow-sm transition-colors active:scale-95">
                          <Plus className="w-3.5 h-3.5 text-gray-700" />
                        </button>
                      </div>
                    </div>

                    {/* Total bill */}
                    <div className="flex items-center justify-between p-3 bg-gray-50/50 rounded-b-xl">
                      <span className="text-sm font-bold text-gray-900">
                        Total Bill
                      </span>
                      <span className="text-lg font-black text-gray-900">
                        ₹{getPopupOrderTotal(popupOrder || newOrder)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-4 border-t border-gray-100 bg-white">
                  <div className="space-y-3">
                    <ActionSlider
                      label={isAcceptingOrder ? "Accepting..." : `Slide to accept (${formatTime(countdown)})`}
                      lockedLabel="Accepting..."
                      onConfirm={handleAcceptOrder}
                      disabled={isAcceptingOrder}
                      color="bg-[#FF0000]"
                      successLabel="Accepted ✓"
                      timeProgress={(countdown / 240) * 100}
                    />

                    <button
                      onClick={handleRejectClick}
                      disabled={isAcceptingOrder}
                      className="w-full py-3 bg-white border border-[#FF0000]/20 text-[#FF0000] rounded-xl font-bold text-sm hover:bg-red-50 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                      Reject Order
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Reject Order Popup */}
      <AnimatePresence>
        {showRejectPopup && (
          <>
            <motion.div
              className="fixed inset-0 z-[250] bg-black/60 flex items-center justify-center p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleRejectCancel}>
              <motion.div
                className="w-[95%] max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="px-4 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-bold text-gray-900">
                    Reject Order {(popupOrder || newOrder)?.orderId || "#Order"}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Please select a reason for rejecting this order
                  </p>
                </div>

                {/* Content */}
                <div className="px-4 py-4 max-h-[60vh] overflow-y-auto">
                  <div className="space-y-2">
                    {rejectReasons.map((reason) => (
                      <button
                        key={reason}
                        onClick={() => setRejectReason(reason)}
                        className={`w-full text-left p-4 rounded-lg border-2 transition-all ${rejectReason === reason
                          ? "border-black bg-black/5"
                          : "border-gray-200 bg-white hover:border-gray-300"
                          }`}>
                        <div className="flex items-center justify-between">
                          <span
                            className={`text-sm font-medium ${rejectReason === reason
                              ? "text-black"
                              : "text-gray-900"
                              }`}>
                            {reason}
                          </span>
                          {rejectReason === reason && (
                            <div className="w-5 h-5 rounded-full bg-black flex items-center justify-center">
                              <svg
                                className="w-3 h-3 text-white"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={3}
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                            </div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Footer */}
                <div className="px-4 py-4 bg-gray-50 border-t border-gray-200 flex gap-3">
                  <button
                    onClick={handleRejectCancel}
                    className="flex-1 bg-white border-2 border-gray-300 text-gray-700 py-3 rounded-lg font-semibold text-sm hover:bg-gray-50 transition-colors">
                    Cancel
                  </button>
                  <button
                    onClick={handleRejectConfirm}
                    disabled={!rejectReason}
                    className={`flex-1 py-3 rounded-lg font-semibold text-sm transition-colors ${rejectReason
                      ? "!bg-black !text-white"
                      : "bg-gray-200 text-gray-400 cursor-not-allowed"
                      }`}>
                    Confirm Rejection
                  </button>
                </div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Cancel Order Popup */}
      <AnimatePresence>
        {showCancelPopup && orderToCancel && (
          <>
            <motion.div
              className="fixed inset-0 z-[70] bg-black/60 flex items-center justify-center p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleCancelPopupClose}>
              <motion.div
                className="w-[95%] max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="px-4 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-bold text-gray-900">
                    Cancel Order {orderToCancel.orderId || "#Order"}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Please provide a reason for cancelling this order
                  </p>
                </div>

                {/* Content */}
                <div className="px-4 py-4">
                  <div className="space-y-3">
                    {rejectReasons.map((reason) => (
                      <button
                        key={reason}
                        type="button"
                        onClick={() => setCancelReason(reason)}
                        className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-colors ${cancelReason === reason
                          ? "border-red-500 bg-red-50"
                          : "border-gray-200 hover:border-gray-300"
                          }`}>
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${cancelReason === reason
                              ? "border-red-500 bg-red-500"
                              : "border-gray-300"
                              }`}>
                            {cancelReason === reason && (
                              <svg
                                className="w-3 h-3 text-white"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={3}
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                            )}
                          </div>
                          <span
                            className={`text-sm font-medium ${cancelReason === reason
                              ? "text-red-700"
                              : "text-gray-700"
                              }`}>
                            {reason}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Footer */}
                <div className="px-4 py-4 bg-gray-50 border-t border-gray-200 flex gap-3">
                  <button
                    onClick={handleCancelPopupClose}
                    className="flex-1 bg-white border-2 border-gray-300 text-gray-700 py-3 rounded-lg font-semibold text-sm hover:bg-gray-50 transition-colors">
                    Cancel
                  </button>
                  <button
                    onClick={handleCancelConfirm}
                    disabled={!cancelReason}
                    className={`flex-1 py-3 rounded-lg font-semibold text-sm transition-colors ${cancelReason
                      ? "!bg-red-600 !text-white hover:bg-red-700"
                      : "bg-gray-200 text-gray-400 cursor-not-allowed"
                      }`}>
                    Confirm Cancellation
                  </button>
                </div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Bottom Sheet for Order Details */}
      <AnimatePresence>
        {isSheetOpen && selectedOrder && (
          <motion.div
            className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSheetOpen(false)}>
            <motion.div
              className="w-full max-w-md mx-auto max-h-[90vh] overflow-y-auto bg-white rounded-t-3xl p-4 pb-[calc(1.25rem+env(safe-area-inset-bottom)+6rem)] shadow-lg"
              initial={{ y: 80 }}
              animate={{ y: 0 }}
              exit={{ y: 80 }}
              transition={{ duration: 0.25 }}
              onClick={(e) => e.stopPropagation()}>
              {/* Drag handle */}
              <div className="flex justify-center mb-3">
                <div className="h-1 w-10 rounded-full bg-gray-300" />
              </div>

              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <p className="text-sm font-semibold text-black">
                    Order #{selectedOrder.orderId}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {selectedOrder.customerName}
                  </p>
                  <p className="text-[11px] text-gray-500 mt-1">
                    {selectedOrder.type}
                    {selectedOrder.tableOrToken
                      ? ` • ${selectedOrder.tableOrToken}`
                      : ""}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium border ${selectedOrder.status === "Ready"
                      ? "border-green-500 text-green-600"
                      : "border-gray-800 text-gray-900"
                      }`}>
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${selectedOrder.status === "Ready"
                        ? "bg-green-500"
                        : "bg-gray-800"
                        }`}
                    />
                    {selectedOrder.status}
                  </span>
                  <span className="text-[11px] text-gray-500">
                    {selectedOrder.timePlaced}
                  </span>
                  {/* Delivery Resend Button - Only for preparing/ready orders with no partner */}
                  {(String(selectedOrder.status).toLowerCase() === "preparing" ||
                    String(selectedOrder.status).toLowerCase() === "ready") &&
                    !selectedOrder.deliveryPartnerId && (
                      <div className="mt-1">
                        <ResendNotificationButton
                          orderId={selectedOrder.orderId}
                          mongoId={selectedOrder.mongoId}
                          onSuccess={() => setIsSheetOpen(false)}
                        />
                      </div>
                    )}
                </div>
              </div>

              <div className="border-t border-gray-100 my-3" />

              <div className="mb-3">
                <p className="text-xs font-medium text-gray-700 mb-1">Items</p>
                <p className="text-xs text-gray-600">
                  {selectedOrder.itemsSummary}
                </p>
              </div>

              <div className="flex items-center justify-between text-[11px] text-gray-500 mb-4">
                {/* Hide ETA for ready orders */}
                {selectedOrder.status !== "ready" && selectedOrder.eta && (
                  <span>
                    ETA:{" "}
                    <span className="font-medium text-black">
                      {selectedOrder.eta}
                    </span>
                  </span>
                )}
                {(() => {
                  const raw = selectedOrder.paymentMethod;
                  const normalized =
                    raw != null ? String(raw).toLowerCase().trim() : "";
                  const isCod = normalized === "cash" || normalized === "cod";
                  return (
                    <span>
                      Payment:{" "}
                      <span
                        className={`font-medium ${isCod ? "text-amber-700" : "text-black"}`}>
                        {isCod ? "Cash on Delivery" : "Paid online"}
                      </span>
                    </span>
                  );
                })()}
              </div>

              {/* Delivery Partner Details in Bottom Sheet */}
              {selectedOrder.deliveryPartnerId && typeof selectedOrder.deliveryPartnerId === 'object' && (
                <div className="mb-4 pt-3 border-t border-gray-100">
                  <p className="text-xs font-bold text-gray-700 mb-2">Delivery Partner details</p>
                  <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3 flex flex-col gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center shrink-0">
                        <User className="w-4 h-4 text-[#FF0000]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-gray-900 truncate">
                          {selectedOrder.deliveryPartnerId.name}
                        </p>
                        {selectedOrder.deliveryPartnerId.rating > 0 && (
                          <div className="flex items-center gap-0.5 mt-0.5">
                            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                            <span className="text-[10px] font-semibold text-gray-600">
                              {selectedOrder.deliveryPartnerId.rating}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="border-t border-gray-200/60 pt-2 flex flex-col gap-1.5">
                      {selectedOrder.deliveryPartnerId.phone === "Hidden until photo upload" || !selectedOrder.deliveryPartnerId.phone ? (
                        <div className="flex items-start gap-2 bg-amber-50/50 border border-amber-200/50 rounded-xl p-2">
                          <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-[10px] font-bold text-amber-800">Phone Hidden</p>
                            <p className="text-[9px] text-amber-700 leading-tight mt-0.5">
                              Phone number will be shown once rider arrives at your shop and uploads photo.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between bg-green-50/50 border border-green-200/50 rounded-xl p-2">
                          <div className="flex items-start gap-2">
                            <Unlock className="w-3.5 h-3.5 text-green-600 shrink-0 mt-0.5" />
                            <div>
                              <p className="text-[10px] font-bold text-green-800">Phone Unlocked</p>
                              <p className="text-xs font-bold text-gray-900 mt-0.5">{selectedOrder.deliveryPartnerId.phone}</p>
                            </div>
                          </div>
                          <a
                            href={`tel:${selectedOrder.deliveryPartnerId.phone}`}
                            className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 bg-[#FF0000] text-white text-[10px] font-bold rounded-lg shadow-sm hover:bg-[#e04a02] transition-colors shrink-0"
                          >
                            <Phone className="w-3 h-3" />
                            Call
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <button
                className="w-full bg-black text-white py-2.5 rounded-xl text-sm font-medium"
                onClick={() => setIsSheetOpen(false)}>
                Close
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Navigation - Sticky (Mobile only) */}
      <div className="md:hidden">
        <BottomNavOrders />
      </div>
    </div>
  );
}


// Order Card Component
const OrderCard = memo(function OrderCard({
  orderId,
  mongoId,
  status,
  customerName,
  type,
  tableOrToken,
  timePlaced,
  eta,
  itemsSummary,
  paymentMethod,
  photoUrl,
  photoAlt,
  deliveryPartnerId,
  dispatchStatus,
  isFoodQuickDelivery = false,
  deliveryMode,
  onSelect,
  onCancel,
  onMarkReady,
  isMarkingReady = false,
}) {
  const normalizedStatus = String(status || "").toLowerCase();
  const isReady = normalizedStatus === "ready";
  const isPreparing = normalizedStatus === "preparing";
  const statusLabel = String(status || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className={`w-full bg-white rounded-2xl p-4 mb-3 border shadow-[0_2px_10px_rgba(0,0,0,0.01)] hover:shadow-md transition-shadow relative flex flex-col gap-3 cursor-pointer group ${isFoodQuickDelivery ? "border-emerald-300 ring-1 ring-emerald-100" : "border-gray-100/80"}`}
      onClick={() =>
        onSelect?.({
          orderId,
          mongoId,
          status,
          customerName,
          type,
          tableOrToken,
          timePlaced,
          eta,
          itemsSummary,
          paymentMethod,
          deliveryPartnerId,
          dispatchStatus,
          isFoodQuickDelivery,
          deliveryMode,
        })
      }>
      
      {/* Top Row: Order ID & Status */}
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-2 min-w-0 mr-2">
          <span className="text-sm font-bold text-gray-900 tracking-tight truncate">
            #{orderId}
          </span>
          {isFoodQuickDelivery && (
            <span className="inline-flex items-center rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider shrink-0">
              Quick · Priority
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider ${isReady ? "bg-green-50 text-green-700" : "bg-gray-50 text-gray-600"}`}>
             <span className={`w-1 h-1 rounded-full ${isReady ? "bg-green-500" : "bg-gray-400"}`} />
             {statusLabel}
          </span>
          {isPreparing && onCancel && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onCancel({ orderId, mongoId, customerName });
              }}
              className="p-1 text-red-500 bg-red-50 hover:bg-red-100 hover:text-red-600 rounded-md transition-colors"
              title="Cancel Order">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Middle Row: Content */}
      <div className="flex gap-3">
        {/* Photo */}
        <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-50 border border-gray-100 flex-shrink-0">
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={photoAlt}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-1">
              <span className="text-[9px] font-medium text-gray-400 text-center leading-tight truncate w-full">
                {photoAlt}
              </span>
            </div>
          )}
        </div>

        {/* Details */}
        <div className="flex-1 flex flex-col justify-center min-w-0">
          <p className="text-sm font-bold text-gray-900 leading-tight truncate">{customerName}</p>
          <p className="text-xs text-gray-600 mt-0.5 truncate">{itemsSummary}</p>
          <p className="text-[9px] font-semibold text-gray-400 mt-1 uppercase tracking-widest truncate">
            {type}{tableOrToken ? ` • ${tableOrToken}` : ""} • {timePlaced}
          </p>
        </div>
      </div>

      {/* Bottom Row: Actions & Assignment */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex flex-wrap items-center gap-1.5 flex-1 pr-2">
          {(isPreparing || isReady || normalizedStatus === "confirmed") && (
            <>
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${deliveryPartnerId
                  ? "bg-gray-50 text-gray-500 border border-gray-200"
                  : "bg-red-50 text-red-600 border border-red-200"
                  }`}>
                <span
                  className={`w-1.5 h-1.5 rounded-full ${deliveryPartnerId ? "bg-gray-400" : "bg-red-500 animate-pulse"
                    }`}
                />
                {deliveryPartnerId ? "Assigned" : "Not Assigned"}
              </span>
              {dispatchStatus !== "accepted" && (
                <ResendNotificationButton
                  orderId={orderId}
                  mongoId={mongoId}
                  onSuccess={() => {}}
                />
              )}
            </>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {!isReady && eta && (
            <div className="flex flex-col items-end mr-1">
              <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest leading-none">ETA</span>
              <span className="text-xs font-black text-gray-900 leading-none mt-0.5">{eta}</span>
            </div>
          )}
          {isPreparing && onMarkReady && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onMarkReady({ orderId, mongoId, customerName });
              }}
              disabled={isMarkingReady}
              className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-[#FF0000] hover:bg-red-600 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-sm">
              {isMarkingReady ? "Marking..." : "Mark Ready"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

// Preparing Orders List
function PreparingOrders({
  onSelectOrder,
  onCancel,
  refreshToken = 0,
  onStatusChanged,
  searchQuery = ""
}) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [markingReadyOrderIds, setMarkingReadyOrderIds] = useState({});

  useEffect(() => {
    let isMounted = true;

    const fetchOrders = async () => {
      try {
        // Fetch all orders and filter for 'preparing' status on frontend
        const response = await restaurantAPI.getOrders();

        if (!isMounted) return;

        if (response.data?.success && response.data.data?.orders) {
          // Filter orders with 'preparing' status only
          // 'confirmed' orders should only appear in popup notification, not in preparing list
          // After accepting, order status changes to 'preparing' and then appears here
          const preparingOrders = response.data.data.orders.filter(
            (order) => order.status === "preparing",
          );

          const transformedOrders = preparingOrders.map((order) => {
            const isFoodQuick =
              String(order.deliveryMode || "").toLowerCase() === "quick";
            const initialETA =
              order.etaPromise?.max || order.estimatedDeliveryTime || 30; // in minutes
            const preparingTimestamp = order.tracking?.preparing?.timestamp
              ? new Date(order.tracking.preparing.timestamp)
              : new Date(order.createdAt); // Fallback to createdAt if preparing timestamp not available

            return {
              orderId: order.orderId || order._id,
              mongoId: order._id,
              status: order.status || "preparing",
              customerName: order.userId?.name || "Customer",
              type:
                order.deliveryFleet === "standard"
                  ? "Home Delivery"
                  : "Express Delivery",
              tableOrToken: null,
              timePlaced: new Date(order.createdAt).toLocaleTimeString(
                "en-US",
                { hour: "2-digit", minute: "2-digit" },
              ),
              initialETA, // Store initial ETA in minutes
              preparingTimestamp, // Store when order started preparing
              itemsSummary: buildOrderItemsSummary(order.items),
              photoUrl: getOrderPreviewItem(order.items)?.image || null,
              photoAlt: getOrderPreviewItem(order.items)?.name || "Order",
              deliveryPartnerId: order.deliveryPartnerId || null,
              dispatchStatus: order.dispatch?.status || null,
              paymentMethod:
                order.paymentMethod || order.payment?.method || null,
              deliveryMode: order.deliveryMode || "basic",
              isFoodQuickDelivery: isFoodQuick,
              kitchenPriority: isFoodQuick ? 0 : 1,
            };
          }).sort((a, b) => (a.kitchenPriority ?? 1) - (b.kitchenPriority ?? 1));

          if (isMounted) {
            setOrders(transformedOrders);
            setLoading(false);
          }
        } else {
          if (isMounted) {
            setOrders([]);
            setLoading(false);
          }
        }
      } catch (error) {
        if (!isMounted) return;

        // Don't log network errors, 404, or 401 errors
        // 401 is handled by axios interceptor (token refresh/redirect)
        // 404 means no orders found (normal)
        // ERR_NETWORK means backend is down (expected in dev)
        if (
          error.code !== "ERR_NETWORK" &&
          error.response?.status !== 404 &&
          error.response?.status !== 401
        ) {
          debugError("Error fetching preparing orders:", error);
        }

        if (isMounted) {
          setOrders([]);
          setLoading(false);
        }
      }
    };

    fetchOrders();

    // Update countdown every second
    const countdownIntervalId = setInterval(() => {
      if (isMounted) {
        setCurrentTime(new Date());
      }
    }, 1000);

    return () => {
      isMounted = false;
      if (countdownIntervalId) {
        clearInterval(countdownIntervalId);
      }
    };
  }, [refreshToken]); // Re-fetch only when parent requests it

  // Track which orders have been marked as ready to avoid duplicate API calls
  const markedReadyOrdersRef = useRef(new Set());

  // Auto-mark orders as ready when ETA reaches 0
  useEffect(() => {
    if (!currentTime || orders.length === 0) return;

    const checkAndMarkReady = async () => {
      for (const order of orders) {
        const orderKey = order.mongoId || order.orderId;

        // Skip if already marked as ready
        if (markedReadyOrdersRef.current.has(orderKey)) {
          continue;
        }

        // Calculate remaining ETA
        const elapsedMs = currentTime - order.preparingTimestamp;
        const elapsedMinutes = Math.floor(elapsedMs / 60000);
        const remainingMinutes = Math.max(0, order.initialETA - elapsedMinutes);

        // If ETA has reached 0 (or slightly past), mark as ready
        if (remainingMinutes <= 0 && order.status === "preparing") {
          const elapsedSeconds = Math.floor(elapsedMs / 1000);
          const totalETASeconds = order.initialETA * 60;

          // Mark as ready when ETA time has elapsed (with 2 second buffer)
          if (elapsedSeconds >= totalETASeconds - 2) {
            try {
              debugLog(
                `?? Auto-marking order ${order.orderId} as ready (ETA reached 0)`,
              );
              markedReadyOrdersRef.current.add(orderKey); // Mark as processing
              await restaurantAPI.markOrderReady(
                order.mongoId || order.orderId,
              );
              debugLog(`? Order ${order.orderId} marked as ready`);
              onStatusChanged?.();
              // Order will be removed from preparing list on next fetch
            } catch (error) {
              const status = error.response?.status;
              const msg = (
                error.response?.data?.message ||
                error.message ||
                ""
              ).toLowerCase();
              // If 400 and message says order cannot be marked ready (e.g. already ready),
              // treat as idempotent - backend cron or another client already marked it.
              if (
                status === 400 &&
                (msg.includes("cannot be marked as ready") ||
                  msg.includes("current status"))
              ) {
                // Keep in markedReadyOrdersRef so we don't retry; order will disappear on next fetch
              } else {
                debugError(
                  `? Failed to auto-mark order ${order.orderId} as ready:`,
                  error,
                );
                markedReadyOrdersRef.current.delete(orderKey);
              }
              // Don't show error toast - it will retry on next check (for non-idempotent errors)
            }
          }
        }
      }
    };

    // Check every 2 seconds for orders that need to be marked ready
    const readyCheckInterval = setInterval(checkAndMarkReady, 2000);

    return () => {
      clearInterval(readyCheckInterval);
    };
  }, [currentTime, orders]);

  // Clear marked orders when orders list changes (orders moved to ready)
  useEffect(() => {
    const currentOrderKeys = new Set(orders.map((o) => o.mongoId || o.orderId));
    // Remove keys that are no longer in the preparing orders list
    for (const key of markedReadyOrdersRef.current) {
      if (!currentOrderKeys.has(key)) {
        markedReadyOrdersRef.current.delete(key);
      }
    }
  }, [orders]);

  const handleMarkReady = async ({ orderId, mongoId, customerName }) => {
    const orderKey = mongoId || orderId;
    if (!orderKey || markingReadyOrderIds[orderKey]) return;

    try {
      setMarkingReadyOrderIds((prev) => ({ ...prev, [orderKey]: true }));
      await restaurantAPI.markOrderReady(orderKey);
      setOrders((prev) =>
        prev.filter((order) => (order.mongoId || order.orderId) !== orderKey),
      );
      toast.success(
        `Order ${orderId} marked ready${customerName ? ` for ${customerName}` : ""}`,
      );
      onStatusChanged?.();
    } catch (error) {
      const status = error.response?.status;
      const message =
        error.response?.data?.message || "Failed to mark order as ready";
      if (
        status === 400 &&
        String(message).toLowerCase().includes("current status")
      ) {
        setOrders((prev) =>
          prev.filter((order) => (order.mongoId || order.orderId) !== orderKey),
        );
        toast.success(`Order ${orderId} is already ready`);
        onStatusChanged?.();
      } else {
        toast.error(message);
      }
    } finally {
      setMarkingReadyOrderIds((prev) => {
        const next = { ...prev };
        delete next[orderKey];
        return next;
      });
    }
  };

  if (loading) {
    return (
      <div className="pt-4 pb-6">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-base font-semibold text-black">
            Preparing orders
          </h2>
          <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
        </div>
        <div className="text-center py-8 text-gray-500 text-sm">Loading...</div>
      </div>
    );
  }

  const filteredOrders = orders.filter((o) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      String(o.orderId || o.mongoId || "").toLowerCase().includes(q) ||
      String(o.customerName || "").toLowerCase().includes(q) ||
      String(o.itemsSummary || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="pt-4 pb-6">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-base font-semibold text-black">Preparing orders</h2>
        <span className="text-xs text-gray-500">{filteredOrders.length} active</span>
      </div>
      {filteredOrders.length === 0 ? (
        <div className="text-center py-8 text-gray-500 text-sm">
          No orders in preparation
        </div>
      ) : (
        <div>
          {filteredOrders.map((order) => {
            // Calculate remaining ETA (countdown)
            const elapsedMs = currentTime - order.preparingTimestamp;
            const elapsedMinutes = Math.floor(elapsedMs / 60000);
            const remainingMinutes = Math.max(
              0,
              order.initialETA - elapsedMinutes,
            );

            // Format ETA display
            let etaDisplay = "";
            if (remainingMinutes <= 0) {
              const remainingSeconds = Math.max(
                0,
                Math.floor(order.initialETA * 60 - elapsedMs / 1000),
              );
              if (remainingSeconds > 0) {
                etaDisplay = `${remainingSeconds} secs`;
              } else {
                etaDisplay = "0 mins";
              }
            } else {
              etaDisplay = `${remainingMinutes} mins`;
            }

            return (
              <OrderCard
                key={order.orderId || order.mongoId}
                orderId={order.orderId}
                mongoId={order.mongoId}
                status={order.status}
                customerName={order.customerName}
                type={order.type}
                tableOrToken={order.tableOrToken}
                timePlaced={order.timePlaced}
                eta={etaDisplay}
                itemsSummary={order.itemsSummary}
                photoUrl={order.photoUrl}
                photoAlt={order.photoAlt}
                paymentMethod={order.paymentMethod}
                deliveryPartnerId={order.deliveryPartnerId}
                dispatchStatus={order.dispatchStatus}
                onSelect={onSelectOrder}
                onCancel={onCancel}
                onMarkReady={handleMarkReady}
                isMarkingReady={Boolean(
                  markingReadyOrderIds[order.mongoId || order.orderId],
                )}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// Ready Orders List
function ReadyOrders({ onSelectOrder, refreshToken = 0, searchQuery = "" }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetchOrders = async () => {
      try {
        // Fetch all orders and filter for 'ready' status on frontend
        const response = await restaurantAPI.getOrders();

        if (!isMounted) return;

        if (response.data?.success && response.data.data?.orders) {
          // Filter orders with 'ready' status
          const readyOrders = response.data.data.orders.filter(
            (order) => order.status === "ready",
          );

          const transformedOrders = readyOrders.map((order) => ({
            orderId: order.orderId || order._id,
            mongoId: order._id,
            status: order.status || "ready",
            customerName: order.userId?.name || "Customer",
            type:
              order.deliveryFleet === "standard"
                ? "Home Delivery"
                : "Express Delivery",
            tableOrToken: null,
            timePlaced: new Date(order.createdAt).toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
            }),
            eta: null, // Don't show ETA for ready orders
            itemsSummary: buildOrderItemsSummary(order.items),
            photoUrl: getOrderPreviewItem(order.items)?.image || null,
            photoAlt: getOrderPreviewItem(order.items)?.name || "Order",
            paymentMethod: order.paymentMethod || order.payment?.method || null,
            deliveryPartnerId: order.deliveryPartnerId || null,
            dispatchStatus: order.dispatch?.status || null,
          }));

          if (isMounted) {
            setOrders(transformedOrders);
            setLoading(false);
          }
        } else {
          if (isMounted) {
            setOrders([]);
            setLoading(false);
          }
        }
      } catch (error) {
        if (!isMounted) return;

        // Don't log network errors repeatedly - they're expected if backend is down
        if (error.code !== "ERR_NETWORK" && error.response?.status !== 404) {
          debugError("Error fetching ready orders:", error);
        }

        if (isMounted) {
          setOrders([]);
          setLoading(false);
        }
      }
    };

    fetchOrders();

    return () => {
      isMounted = false;
    };
  }, [refreshToken]); // Re-fetch only when parent requests it

  if (loading) {
    return (
      <div className="pt-4 pb-6">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-base font-semibold text-black">
            Ready for pickup
          </h2>
          <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
        </div>
        <div className="text-center py-8 text-gray-500 text-sm">Loading...</div>
      </div>
    );
  }

  const filteredOrders = orders.filter((o) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      String(o.orderId || o.mongoId || "").toLowerCase().includes(q) ||
      String(o.customerName || "").toLowerCase().includes(q) ||
      String(o.itemsSummary || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="pt-4 pb-6">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-base font-semibold text-black">Ready orders</h2>
        <span className="text-xs text-gray-500">{filteredOrders.length} active</span>
      </div>
      {filteredOrders.length === 0 ? (
        <div className="text-center py-8 text-gray-500 text-sm">
          No orders ready
        </div>
      ) : (
        <div>
          {filteredOrders.map((order) => (
            <OrderCard
              key={order.orderId || order.mongoId}
              {...order}
              onSelect={onSelectOrder}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Out for Delivery Orders List
const OutForDeliveryOrders = ({ onSelectOrder, refreshToken = 0, searchQuery = "" }) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetchOrders = async () => {
      try {
        // Fetch all orders and filter for 'out_for_delivery' status on frontend
        const response = await restaurantAPI.getOrders();

        if (!isMounted) return;

        if (response.data?.success && response.data.data?.orders) {
          // Filter orders with 'out_for_delivery' status
          const outForDeliveryOrders = response.data.data.orders.filter(
            (order) => order.status === "out_for_delivery",
          );

          const transformedOrders = outForDeliveryOrders.map((order) => ({
            orderId: order.orderId || order._id,
            mongoId: order._id,
            status: order.status || "out_for_delivery",
            customerName: order.userId?.name || "Customer",
            type:
              order.deliveryFleet === "standard"
                ? "Home Delivery"
                : "Express Delivery",
            tableOrToken: null,
            timePlaced: new Date(order.createdAt).toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
            }),
            eta: null,
            itemsSummary: buildOrderItemsSummary(order.items),
            photoUrl: getOrderPreviewItem(order.items)?.image || null,
            photoAlt: getOrderPreviewItem(order.items)?.name || "Order",
            paymentMethod: order.paymentMethod || order.payment?.method || null,
            deliveryPartnerId: order.deliveryPartnerId || null,
            dispatchStatus: order.dispatch?.status || null,
          }));

          if (isMounted) {
            setOrders(transformedOrders);
            setLoading(false);
          }
        } else {
          if (isMounted) {
            setOrders([]);
            setLoading(false);
          }
        }
      } catch (error) {
        if (!isMounted) return;

        // Don't log network errors repeatedly - they're expected if backend is down
        if (error.code !== "ERR_NETWORK" && error.response?.status !== 404) {
          debugError("Error fetching out for delivery orders:", error);
        }

        if (isMounted) {
          setOrders([]);
          setLoading(false);
        }
      }
    };

    fetchOrders();

    return () => {
      isMounted = false;
    };
  }, [refreshToken]); // Re-fetch only when parent requests it

  if (loading) {
    return (
      <div className="pt-4 pb-6">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-base font-semibold text-black">
            Out for delivery
          </h2>
          <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
        </div>
        <div className="text-center py-8 text-gray-500 text-sm">Loading...</div>
      </div>
    );
  }

  const filteredOrders = orders.filter(o => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      String(o.orderId || o.mongoId || "").toLowerCase().includes(q) ||
      String(o.customerName || "").toLowerCase().includes(q) ||
      String(o.itemsSummary || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="pt-4 pb-6">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-base font-semibold text-black">Out for delivery</h2>
        <span className="text-xs text-gray-500">{filteredOrders.length} active</span>
      </div>
      {filteredOrders.length === 0 ? (
        <div className="text-center py-8 text-gray-500 text-sm">
          No orders out for delivery
        </div>
      ) : (
        <div>
          {filteredOrders.map((order) => (
            <OrderCard
              key={order.orderId || order.mongoId}
              {...order}
              onSelect={onSelectOrder}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// Scheduled Orders List
function ScheduledOrders({ onSelectOrder, refreshToken = 0, searchQuery = "" }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetchOrders = async () => {
      try {
        const response = await restaurantAPI.getOrders();
        if (!isMounted) return;

        if (response.data?.success && response.data.data?.orders) {
          const scheduledOrders = response.data.data.orders.filter(
            (order) =>
              String(order.status || order.orderStatus || "").toLowerCase() ===
              "scheduled",
          );

          const transformedOrders = scheduledOrders.map((order) => {
            const scheduledLabel =
              formatScheduledAtShort(order.scheduledAt) || "Scheduled";
            return {
            orderId: order.orderId || order._id,
            mongoId: order._id,
            status: order.status || order.orderStatus || "scheduled",
            customerName: order.userId?.name || "Customer",
            type: order.deliveryFleet === "standard" ? "Home Delivery" : "Express Delivery",
            tableOrToken: null,
            timePlaced: `For: ${scheduledLabel}`,
            scheduledAt: order.scheduledAt,
            itemsSummary: buildOrderItemsSummary(order.items),
            photoUrl: getOrderPreviewItem(order.items)?.image || null,
            photoAlt: getOrderPreviewItem(order.items)?.name || "Order",
            paymentMethod: order.paymentMethod || order.payment?.method || null,
          };
          });

          setOrders(transformedOrders);
        } else {
          setOrders([]);
        }
      } catch (error) {
        if (error.code !== "ERR_NETWORK" && error.response?.status !== 404) {
          debugError("Error fetching scheduled orders:", error);
        }
        setOrders([]);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchOrders();
    const interval = setInterval(fetchOrders, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [refreshToken]);

  if (loading) {
    return (
      <div className="pt-4 pb-6">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-base font-semibold text-black">Scheduled orders</h2>
          <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
        </div>
        <div className="text-center py-8 text-gray-500 text-sm">Loading...</div>
      </div>
    );
  }

  const filteredOrders = orders.filter(o => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      String(o.orderId || o.mongoId || "").toLowerCase().includes(q) ||
      String(o.customerName || "").toLowerCase().includes(q) ||
      String(o.itemsSummary || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="pt-4 pb-6">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-base font-semibold text-black">Scheduled orders</h2>
        <span className="text-xs text-gray-500">{filteredOrders.length} total</span>
      </div>
      {filteredOrders.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-gray-200 flex flex-col items-center">
          <Calendar className="w-12 h-12 text-gray-300 mb-3" />
          <p className="text-gray-500 text-sm">Scheduled orders will appear here</p>
        </div>
      ) : (
        <div>
          {filteredOrders.map((order) => {
            return (
              <OrderCard
                key={order.orderId || order.mongoId}
                {...order}
                onSelect={onSelectOrder}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// Empty State Component
function EmptyState({ message = "Temporarily closed" }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] py-12">
      {/* Store Illustration */}
      <div className="mb-6">
        <svg
          width="200"
          height="200"
          viewBox="0 0 200 200"
          className="text-gray-300"
          fill="none"
          xmlns="http://www.w3.org/2000/svg">
          {/* Storefront */}
          <rect
            x="40"
            y="80"
            width="120"
            height="80"
            stroke="currentColor"
            strokeWidth="2"
            fill="white"
          />
          {/* Awning */}
          <path
            d="M30 80 L100 50 L170 80"
            stroke="currentColor"
            strokeWidth="2"
            fill="white"
          />
          {/* Doors */}
          <rect
            x="60"
            y="100"
            width="30"
            height="60"
            stroke="currentColor"
            strokeWidth="2"
            fill="white"
          />
          <rect
            x="110"
            y="100"
            width="30"
            height="60"
            stroke="currentColor"
            strokeWidth="2"
            fill="white"
          />
          {/* Laptop */}
          <rect
            x="70"
            y="140"
            width="40"
            height="25"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="white"
          />
          <text
            x="85"
            y="155"
            fontSize="8"
            fill="currentColor"
            textAnchor="middle">
            CLOSED
          </text>
          {/* Sign */}
          <rect
            x="80"
            y="170"
            width="40"
            height="20"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="white"
          />
        </svg>
      </div>

      {/* Message */}
      <h2 className="text-lg font-semibold text-gray-600 mb-4 text-center">
        {message}
      </h2>

      {/* View Status Button */}
      <button className="bg-black text-white px-6 py-3 rounded-lg font-medium hover:bg-gray-800 transition-colors">
        View status
      </button>
    </div>
  );
}
