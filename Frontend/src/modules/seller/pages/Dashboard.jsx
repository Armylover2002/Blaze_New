import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Card from "@shared/components/ui/Card";
import PageHeader from "@shared/components/ui/PageHeader";
import Badge from "@shared/components/ui/Badge";
import StatCard from "@shared/components/ui/StatCard";
import {
  IndianRupee,
  Truck,
  Package,
  TrendingUp,
  ShoppingBag,
  Clock,
  ArrowUpRight,
  Plus,
  Eye,
} from "lucide-react";
import {
  HiOutlineTruck,
  HiOutlineXMark,
  HiOutlineMapPin,
  HiOutlinePhone,
  HiOutlineBanknotes,
  HiOutlineChevronDown,
} from "react-icons/hi2";
import { motion, AnimatePresence } from "framer-motion";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { cn } from "@/lib/utils";
import { sellerApi } from "../services/sellerApi";
import { toast } from "sonner";
import { useSellerOrders } from "../context/SellerOrdersContext";

const Dashboard = () => {
  const navigate = useNavigate();
  const {
    orders: ordersFromContext,
    ordersLoading,
    refreshOrders,
  } = useSellerOrders();
  const [loading, setLoading] = useState(true);
  const [statsData, setStatsData] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fetchStats = async () => {
      try {
        setLoading(true);
        const statsRes = await sellerApi.getStats();
        if (cancelled) return;
        if (statsRes.data.success) setStatsData(statsRes.data.result);
      } catch (error) {
        if (!cancelled) {
          console.error("Dashboard Fetch Error:", error);
          toast.error("Failed to load dashboard data");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchStats();
    return () => {
      cancelled = true;
    };
  }, []);

  const safeOrders = Array.isArray(ordersFromContext) ? ordersFromContext : [];
  const loadingOrStats = loading || ordersLoading;

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const revenueChartData = React.useMemo(() => {
    const raw = statsData?.salesTrend ?? statsData?.chartData ?? [];
    const arr = Array.isArray(raw) ? raw : [];
    if (arr.length > 0) {
      return arr.map((d) => ({
        name: d.name ?? d.date ?? "—",
        sales: Number(d.sales ?? d.revenue ?? d.total ?? 0) || 0,
      }));
    }
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return { name: dayNames[d.getDay()], sales: 0 };
    });
  }, [statsData?.salesTrend, statsData?.chartData]);
  const revenueMax = Math.max(1, ...revenueChartData.map((d) => d.sales));

  const stats = [
    {
      label: "Total Revenue",
      value: statsData?.overview?.totalSales || "₹0",
      change: "+12.5%",
      changeType: "increase",
      icon: IndianRupee,
      iconBg: "bg-emerald-50",
      iconColor: "text-emerald-600",
      description: "vs last month",
    },
    {
      label: "Total Orders",
      value: statsData?.overview?.totalOrders || "0",
      change: "+8.2%",
      changeType: "increase",
      icon: ShoppingBag,
      iconBg: "bg-red-50",
      iconColor: "text-red-600",
      description: "vs last month",
    },
    {
      label: "Avg Order Value",
      value: statsData?.overview?.avgOrderValue || "₹0",
      change: "+2",
      changeType: "increase",
      icon: Package,
      iconBg: "bg-purple-50",
      iconColor: "text-purple-600",
      description: "per order",
    },
    {
      label: "Pending Orders",
      value: safeOrders.filter((o) => o.status === "pending").length.toString(),
      change: "-3",
      changeType: "decrease",
      icon: Clock,
      iconBg: "bg-red-50",
      iconColor: "text-red-600",
      description: "need attention",
    },
  ];

  const quickActions = [
    {
      title: "Add New Product",
      description: "List a new item in your store",
      icon: Plus,
      path: "/seller/products/add",
      variant: "primary", // dark bg, white text
    },
    {
      title: "Process Orders",
      description: "View and manage pending orders",
      icon: Truck,
      path: "/seller/orders",
      variant: "outline", // white bg, border, primary accent
    },
    {
      title: "View Earnings",
      description: "Check your revenue and payouts",
      icon: IndianRupee,
      path: "/seller/earnings",
      variant: "outline-emerald", // white bg, border, emerald accent
    },
  ];

  const getStatusColor = (status) => {
    const s = (status || "").toLowerCase();
    switch (s) {
      case "pending":
        return "warning";
      case "processing":
      case "confirmed":
        return "info";
      case "packed":
        return "primary";
      case "shipped":
      case "out_for_delivery":
        return "secondary";
      case "delivered":
        return "success";
      case "cancelled":
        return "error";
      default:
        return "secondary";
    }
  };

  const resolveSellerReceivable = (order) => {
    const receivable = Number(order?.pricing?.receivable);
    if (Number.isFinite(receivable)) return receivable;

    const subtotal = Number(order?.pricing?.subtotal);
    const commission = Number(order?.pricing?.commission);
    if (Number.isFinite(subtotal) && Number.isFinite(commission)) {
      return Math.max(0, subtotal - commission);
    }

    const fallback = Number(order?.total ?? order?.pricing?.total);
    return Number.isFinite(fallback) ? fallback : 0;
  };

  const normalizeOrderForModal = (order) => {
    if (!order) return null;
    const addr = order.address;
    const addressStr = [
      addr?.line1 || addr?.address,
      addr?.line2,
      addr?.city,
      addr?.state,
      addr?.pincode || addr?.zipCode,
    ]
      .filter(Boolean)
      .join(", ");
    const items = (order.items || []).map((item) => ({
      name: item.name || item.productName || "Item",
      price:
        item.price ??
        (item.quantity
          ? Number(item.totalPrice ?? 0) / Number(item.quantity)
          : 0),
      qty: item.quantity ?? 1,
      image: item.image || "",
    }));
    return {
      id: order.orderId,
      customer: {
        name: order.customer?.name || "Customer",
        phone: order.customer?.phone || "",
      },
      address: addressStr || "—",
      items,
      total: resolveSellerReceivable(order),
      pricing: {
        subtotal: Number(order.pricing?.subtotal || 0),
        commission: Number(order.pricing?.commission || 0),
        total: Number(order.pricing?.total || 0),
        receivable: resolveSellerReceivable(order),
      },
      status: order.status || "pending",
      payment:
        order.payment?.method === "cash" || order.payment?.method === "cod"
          ? "Cash on Delivery"
          : "Online Paid",
    };
  };

  const handleStatusUpdate = async (orderId, newStatus) => {
    try {
      await sellerApi.updateOrderStatus(orderId, {
        status: newStatus.toLowerCase(),
      });
      toast.success(`Order status updated to ${newStatus}`);
      setSelectedOrder((prev) =>
        prev && prev.id === orderId ? { ...prev, status: newStatus } : prev,
      );
      if (typeof refreshOrders === "function") refreshOrders();
    } catch (error) {
      console.error("Failed to update status:", error);
      toast.error("Failed to update status");
    }
  };

  if (loadingOrStats) {
    return (
      <div className="flex items-center justify-center h-screen font-bold text-slate-600">
        Updating Dashboard...
      </div>
    );
  }

  return (
    <div className="ds-section-spacing relative">
      <PageHeader
        title="Dashboard"
        description="Welcome back! Here's what's happening with your store today."
      />

      {/* Stats Grid */}
      <div className="ds-grid-stats">
        {stats.map((stat) => (
          <StatCard
            key={stat.label}
            label={stat.label}
            value={stat.value}
            icon={stat.icon}
            trend={stat.change}
            trendDirection={stat.changeType === "increase" ? "up" : "down"}
            description={stat.description}
            color={stat.iconColor}
            bg={stat.iconBg}
          />
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {quickActions.map((action) => {
          const isPrimary = action.variant === "primary";
          const isEmerald = action.variant === "outline-emerald";
          return (
            <button
              key={action.title}
              onClick={() => navigate(action.path)}
              className={cn(
                "p-6 rounded-xl text-left transition-all duration-200 shadow-sm hover:shadow-md border-2",
                isPrimary &&
                "bg-red-500 border-red-500 text-white hover:bg-red-500/90 hover:border-red-500/90",
                action.variant === "outline" &&
                "bg-white border-slate-200 text-slate-900 hover:border-red-500 hover:bg-red-500/5",
                isEmerald &&
                "bg-white border-slate-200 text-slate-900 hover:border-emerald-500 hover:bg-emerald-50",
              )}>
              <div className="flex items-start gap-4">
                <div
                  className={cn(
                    "p-2 rounded-lg",
                    isPrimary
                      ? "bg-white/20"
                      : isEmerald
                        ? "bg-emerald-50"
                        : "bg-slate-100",
                  )}>
                  <action.icon
                    className={cn(
                      "h-5 w-5",
                      isPrimary
                        ? "text-white"
                        : isEmerald
                          ? "text-emerald-600"
                          : "text-slate-700",
                    )}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h3
                    className={cn(
                      "font-semibold text-sm",
                      isPrimary ? "text-white" : "text-slate-900",
                    )}>
                    {action.title}
                  </h3>
                  <p
                    className={cn(
                      "text-xs mt-1",
                      isPrimary ? "text-white/90" : "text-slate-600",
                    )}>
                    {action.description}
                  </p>
                </div>
                <ArrowUpRight
                  className={cn(
                    "h-4 w-4 shrink-0",
                    isPrimary ? "text-white/70" : "text-slate-600",
                  )}
                />
              </div>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Chart */}
        <Card
          title="Revenue Overview"
          subtitle="Last 7 days performance"
          className="lg:col-span-2">
          <div className="h-[300px] min-h-[280px] w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={revenueChartData}
                margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient
                    id="revenueGradient"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1">
                    <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="var(--primary)" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#f1f5f9"
                />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#475569", fontSize: 12, fontWeight: 600 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#475569", fontSize: 12, fontWeight: 600 }}
                  tickFormatter={(value) =>
                    `₹${Number(value).toLocaleString()}`
                  }
                  domain={[0, revenueMax]}
                  allowDataOverflow
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "white",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                    color: "#334155",
                  }}
                  formatter={(value) => [
                    `₹${Number(value).toLocaleString()}`,
                    "Revenue",
                  ]}
                  labelFormatter={(label) => `Day: ${label}`}
                />
                <Area
                  type="monotone"
                  dataKey="sales"
                  stroke="var(--primary)"
                  strokeWidth={2}
                  fill="url(#revenueGradient)"
                  isAnimationActive={true}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Product Performance */}
        <Card title="Top Categories" subtitle="Sales by category">
          <div className="h-[300px] min-h-[280px] w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statsData?.categoryMix || []} layout="vertical">
                <CartesianGrid
                  strokeDasharray="3 3"
                  horizontal={false}
                  stroke="#f1f5f9"
                />
                <XAxis
                  type="number"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#475569", fontSize: 12 }}
                />
                <YAxis
                  type="category"
                  dataKey="subject"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#475569", fontSize: 12 }}
                  width={80}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "white",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                    color: "#334155",
                  }}
                />
                <Bar dataKey="A" fill="var(--primary)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Recent Orders */}
      <Card
        title="Recent Orders"
        subtitle="Latest transactions from your store"
        actions={
          <button
            onClick={() => navigate("/seller/orders")}
            className="text-sm font-medium text-red-500 hover:text-red-500/80 flex items-center gap-1">
            View All
            <ArrowUpRight className="h-4 w-4" />
          </button>
        }>
        <div className="overflow-x-auto">
          <table className="ds-table">
            <thead className="ds-table-header">
              <tr>
                <th className="ds-table-header-cell text-left">
                  Order ID
                </th>
                <th className="ds-table-header-cell text-left">
                  Customer
                </th>
                <th className="ds-table-header-cell text-left">
                  Date
                </th>
                <th className="ds-table-header-cell text-left">
                  Amount
                </th>
                <th className="ds-table-header-cell text-left">
                  Status
                </th>
                <th className="ds-table-header-cell text-center">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {safeOrders.slice(0, 5).map((order) => (
                <tr
                  key={order.orderId}
                  className="ds-table-row">
                  <td className="ds-table-cell font-semibold">
                    {order.orderId}
                  </td>
                  <td className="ds-table-cell">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-semibold text-slate-600">
                        {order.customer?.name
                          ?.split(" ")
                          .map((n) => n[0])
                          .join("") || "C"}
                      </div>
                      <span className="font-semibold text-slate-700">
                        {order.customer?.name || "Customer"}
                      </span>
                    </div>
                  </td>
                  <td className="ds-table-cell">
                    {new Date(order.createdAt).toLocaleDateString()}
                  </td>
                  <td className="ds-table-cell font-semibold">
                    ₹{resolveSellerReceivable(order).toFixed(2)}
                  </td>
                  <td className="ds-table-cell">
                    <Badge
                      variant={getStatusColor(order.status)}
                      className="capitalize">
                      {order.status}
                    </Badge>
                  </td>
                  <td className="ds-table-cell text-center">
                    <button
                      onClick={() => {
                        setSelectedOrder(normalizeOrderForModal(order));
                        setIsOrderModalOpen(true);
                      }}
                      className="text-slate-600 hover:text-red-500 transition-colors p-1">
                      <Eye className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <AnimatePresence>
        {isOrderModalOpen && selectedOrder && (
          <div className="fixed inset-0 z-[100] flex items-stretch sm:items-center justify-center p-3 sm:p-6 lg:p-12">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-md"
              onClick={() => setIsOrderModalOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-lg sm:max-w-2xl relative z-10 bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              {/* Modal Header - same as Orders */}
              <div className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 border-b border-slate-100">
                <div className="flex items-center space-x-3">
                  <div className="h-10 w-10 bg-slate-900 text-white rounded-xl flex items-center justify-center shadow-lg">
                    <HiOutlineTruck className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900">
                      Order Details
                    </h3>
                    <div className="flex items-center space-x-2 mt-0.5">
                      <Badge
                        variant={getStatusColor(selectedOrder.status)}
                        className="text-[10px] font-black uppercase tracking-widest px-1.5 py-0">
                        {selectedOrder.status}
                      </Badge>
                      <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">
                        #{selectedOrder.id}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setIsOrderModalOpen(false)}
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-600">
                  <HiOutlineXMark className="h-5 w-5" />
                </button>
              </div>

              <div className="px-4 py-4 sm:px-6 sm:py-5 overflow-y-auto scrollbar-hide flex-1">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
                  <div className="space-y-3 sm:space-y-4">
                    <div>
                      <h4 className="text-xs font-black text-slate-600 uppercase tracking-widest mb-2 flex items-center gap-2">
                        <HiOutlineMapPin className="h-3 w-3 text-red-500" />{" "}
                        Delivery Address
                      </h4>
                      <p className="text-xs font-bold text-slate-800 leading-relaxed bg-slate-50 p-3 rounded-2xl border border-slate-100 shadow-sm">
                        {selectedOrder.address}
                      </p>
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-slate-600 uppercase tracking-widest mb-2 flex items-center gap-2">
                        <HiOutlinePhone className="h-3 w-3 text-emerald-500" />{" "}
                        Customer Info
                      </h4>
                      <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 shadow-sm">
                        <p className="text-xs font-bold text-slate-800">
                          {selectedOrder.customer.name}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3 sm:space-y-4">
                    <div className="bg-red-500/5 p-3 sm:p-4 rounded-3xl border border-red-500/10">
                      <h4 className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-3">
                        Order Summary
                      </h4>
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs">
                          <span className="font-bold text-slate-600">
                            Items subtotal
                          </span>
                          <span className="font-black text-slate-900">
                            ₹{(selectedOrder.pricing?.subtotal || 0).toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="font-bold text-slate-600">
                            Commission
                          </span>
                          <span className="font-black text-rose-600">
                            ₹{(selectedOrder.pricing?.commission || 0).toFixed(2)}
                          </span>
                        </div>
                        <div className="h-px bg-red-500/10 my-2" />
                        <div className="flex justify-between text-sm">
                          <span className="font-black text-slate-900">
                            Receivable
                          </span>
                          <span className="font-black text-red-500">
                            ₹{(selectedOrder.total || 0).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="bg-slate-900 p-3 sm:p-4 rounded-3xl text-white shadow-xl shadow-red-500/20">
                      <h4 className="text-xs font-black text-slate-600 uppercase tracking-widest mb-2">
                        Payment Status
                      </h4>
                      <div className="flex items-center gap-2">
                        <HiOutlineBanknotes className="h-5 w-5 text-emerald-400" />
                        <span className="text-xs font-bold tracking-tight">
                          {selectedOrder.payment}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <h4 className="text-xs font-black text-slate-600 uppercase tracking-widest mb-3 sm:mb-4">
                  Items Ordered ({selectedOrder.items.length})
                </h4>
                <div className="space-y-3 max-h-52 sm:max-h-64 overflow-y-auto pr-1">
                  {selectedOrder.items.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 bg-white ring-1 ring-slate-100 rounded-2xl group hover:shadow-md transition-all">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-xl overflow-hidden bg-slate-50 ring-1 ring-slate-200">
                          {item.image ? (
                            <img
                              src={item.image}
                              alt={item.name}
                              className="h-full w-full object-cover group-hover:scale-110 transition-transform duration-500"
                            />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center text-slate-600 text-xs font-bold">
                              —
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900">
                            {item.name}
                          </p>
                          <p className="text-[10px] font-semibold text-slate-600 mt-0.5">
                            ₹{Number(item.price).toFixed(2)} × {item.qty}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-black text-slate-900">
                          ₹{(item.price * item.qty).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Modal Footer - same as Orders */}
              <div className="px-4 py-3 sm:px-6 sm:py-4 border-t border-slate-100 bg-slate-50 flex flex-col sm:flex-row gap-3 sm:gap-0 sm:items-center justify-end">
                <div className="flex gap-2 items-center">
                  <button
                    onClick={() => setIsOrderModalOpen(false)}
                    className="px-6 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all">
                    CLOSE
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Dashboard;
