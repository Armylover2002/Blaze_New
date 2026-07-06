import React, { useMemo, useState, useEffect, useCallback, useRef } from "react";
import io from "socket.io-client";
import { API_BASE_URL } from "@food/api/config";
import {
  Search, Package, Eye, UserPlus, XCircle, FileText, RefreshCw, MapPin, Clock,
  CheckCircle2, Circle, Truck,
} from "lucide-react";
import {
  PageHeader, SectionCard, StatCard, AdminTable, FilterBar, StatusBadge,
  FormLayout, FormSection, FormRow, FormField,
} from "@/shared/components/admin";
import Button from "@/shared/components/ui/Button";
import Input from "@/shared/components/ui/Input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { filterBySearch, sortItems, paginateItems, formatCurrency, formatDateTime } from "../utils/porterTableHelpers";
import porterAdminApi from "../services/adminApi";

const mapApiOrder = (o) => ({
  id: String(o._id || o.id),
  orderNumber: o.orderNumber,
  customer: o.userId?.name || "Customer",
  pickup: o.pickup?.address || "",
  drop: o.delivery?.address || "",
  driverId: o.dispatch?.deliveryPartnerId?._id || o.dispatch?.deliveryPartnerId,
  driverName: o.dispatch?.deliveryPartnerId?.name || "—",
  vehicle: o.vehicleName || "—",
  goodsType: o.parcel?.parcelName || "Parcel",
  amount: o.pricing?.total ?? 0,
  deliveryStatus: o.status,
  paymentStatus: o.payment?.status,
  createdAt: o.createdAt,
  timeline: o.statusHistory || [],
});

const STATUS_LABELS = {
  pending: "Pending",
  assigned: "Assigned",
  driver_accepted: "Driver Accepted",
  picked_up: "Picked Up",
  in_transit: "In Transit",
  near_destination: "Near Destination",
  delivered: "Delivered",
  cancelled: "Cancelled",
  failed: "Failed",
  refunded: "Refunded",
};

const STATUS_TONES = {
  pending: "warning",
  assigned: "info",
  driver_accepted: "info",
  picked_up: "primary",
  in_transit: "primary",
  near_destination: "primary",
  delivered: "success",
  cancelled: "danger",
  failed: "danger",
  refunded: "danger",
  scheduled: "warning",
  searching_partner: "warning",
  partner_accepted: "info",
  at_pickup: "primary",
  at_drop: "primary",
  cancelled_by_user: "danger",
  cancelled_by_admin: "danger",
  cancelled_by_driver: "danger",
};

const ORDER_STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "searching_partner", label: "Searching" },
  { value: "partner_accepted", label: "Accepted" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled_by_user", label: "Cancelled" },
];

const ORDER_STATUS_TABS = [
  { id: "all", label: "All" },
  { id: "searching_partner", label: "Searching" },
  { id: "partner_accepted", label: "Active" },
  { id: "delivered", label: "Delivered" },
  { id: "cancelled_by_user", label: "Cancelled" },
];

const Orders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [vehicleFilter, setVehicleFilter] = useState("all");
  const [driverFilter, setDriverFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [detailOpen, setDetailOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [assignDriverId, setAssignDriverId] = useState("");
  const [assignableDrivers, setAssignableDrivers] = useState([]);
  const [actionLoading, setActionLoading] = useState(false);
  const socketRef = useRef(null);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const data = await porterAdminApi.getOrders({ limit: 200 });
      setOrders((data.records || []).map(mapApiOrder));
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  useEffect(() => {
    if (!API_BASE_URL) return undefined;
    const token = localStorage.getItem("admin_accessToken") || localStorage.getItem("accessToken");
    if (!token) return undefined;

    let backendUrl = API_BASE_URL;
    try { backendUrl = new URL(backendUrl).origin; } catch { /* keep */ }

    const socket = io(backendUrl, {
      path: "/socket.io/",
      transports: ["websocket", "polling"],
      reconnection: true,
      auth: { token },
    });
    socketRef.current = socket;
    socket.on("porter_admin_order_update", () => loadOrders());
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [loadOrders]);

  const loadAssignableDrivers = useCallback(async (orderId) => {
    if (!orderId) return;
    try {
      const drivers = await porterAdminApi.getAssignableDrivers(orderId);
      setAssignableDrivers(drivers);
    } catch {
      setAssignableDrivers([]);
    }
  }, []);

  const vehicles = useMemo(() => [...new Set(orders.map((o) => o.vehicle))], [orders]);

  const drivers = useMemo(() => {
    const map = new Map();
    orders.forEach((o) => {
      if (o.driverId && o.driverName) map.set(String(o.driverId), o.driverName);
    });
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [orders]);

  const tabCounts = useMemo(() => {
    const counts = { all: orders.length };
    for (const o of orders) counts[o.deliveryStatus] = (counts[o.deliveryStatus] || 0) + 1;
    return counts;
  }, [orders]);

  const filtered = useMemo(() => {
    let rows = filterBySearch(orders, search, ["id", "customer", "pickup", "drop", "driverName", "goodsType"]);
    if (activeTab !== "all") rows = rows.filter((r) => r.deliveryStatus === activeTab);
    if (statusFilter !== "all") rows = rows.filter((r) => r.deliveryStatus === statusFilter);
    if (vehicleFilter !== "all") rows = rows.filter((r) => r.vehicle === vehicleFilter);
    if (driverFilter !== "all") rows = rows.filter((r) => r.driverId === driverFilter);
    if (dateFrom) rows = rows.filter((r) => new Date(r.createdAt) >= new Date(dateFrom));
    if (dateTo) rows = rows.filter((r) => new Date(r.createdAt) <= new Date(dateTo + "T23:59:59"));
    return sortItems(rows, "createdAt", "desc");
  }, [orders, search, activeTab, statusFilter, vehicleFilter, driverFilter, dateFrom, dateTo]);

  const { items: pageItems, total, totalPages } = useMemo(
    () => paginateItems(filtered, page, pageSize),
    [filtered, page, pageSize]
  );

  const stats = useMemo(() => ({
    total: orders.length,
    pending: orders.filter((o) => o.deliveryStatus === "pending").length,
    inTransit: orders.filter((o) => ["assigned", "driver_accepted", "picked_up", "in_transit", "near_destination"].includes(o.deliveryStatus)).length,
    delivered: orders.filter((o) => o.deliveryStatus === "delivered").length,
    revenue: orders.filter((o) => o.deliveryStatus === "delivered").reduce((a, o) => a + o.amount, 0),
  }), [orders]);

  const openDetail = async (row) => {
    setSelected(row);
    setDetailOpen(true);
    try {
      const [order, logs] = await Promise.all([
        porterAdminApi.getOrderById(row.id),
        porterAdminApi.getOrderLogs(row.id),
      ]);
      const timeline = (logs?.statusHistory || row.timeline || []).map((s) => ({
        label: s.note || s.status,
        status: "completed",
        at: s.changedAt || s.at,
      }));
      setSelected({
        ...row,
        ...mapApiOrder(order),
        timeline,
        auditLogs: logs?.auditLogs || [],
      });
    } catch {
      // keep row data
    }
  };

  const handleAssign = async () => {
    if (!selected?.id || !assignDriverId) return;
    setActionLoading(true);
    try {
      await porterAdminApi.assignDriver(selected.id, assignDriverId);
      setAssignOpen(false);
      setAssignDriverId("");
      await loadOrders();
    } catch (err) {
      window.alert(err?.response?.data?.message || "Assign failed");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async (orderId) => {
    const reason = window.prompt("Cancellation reason:");
    if (!reason?.trim()) return;
    setActionLoading(true);
    try {
      await porterAdminApi.cancelOrder(orderId, reason.trim());
      setDetailOpen(false);
      await loadOrders();
    } catch (err) {
      window.alert(err?.response?.data?.message || "Cancel failed");
    } finally {
      setActionLoading(false);
    }
  };

  const openAssign = (row) => {
    setSelected(row);
    setAssignOpen(true);
    loadAssignableDrivers(row.id);
  };

  const columns = [
    { key: "id", header: "Order ID", cell: (row) => <span className="font-semibold">{row.id}</span> },
    { key: "customer", header: "Customer" },
    { key: "pickup", header: "Pickup", cell: (row) => <span className="text-sm">{row.pickup}</span> },
    { key: "drop", header: "Drop", cell: (row) => <span className="text-sm">{row.drop}</span> },
    { key: "driverName", header: "Driver" },
    { key: "vehicle", header: "Vehicle" },
    { key: "goodsType", header: "Goods" },
    { key: "distanceKm", header: "Distance", cell: (row) => `${row.distanceKm} km` },
    { key: "amount", header: "Amount", cell: (row) => formatCurrency(row.amount) },
    { key: "paymentStatus", header: "Payment", cell: (row) => <StatusBadge status={row.paymentStatus === "refunded" ? "danger" : "success"} label={row.paymentStatus} /> },
    { key: "deliveryStatus", header: "Status", cell: (row) => <StatusBadge tone={STATUS_TONES[row.deliveryStatus]} label={STATUS_LABELS[row.deliveryStatus]} /> },
    { key: "createdAt", header: "Created", cell: (row) => <span className="text-xs text-muted-foreground">{formatDateTime(row.createdAt)}</span> },
    {
      key: "actions", header: "Actions", align: "right",
      cell: (row) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => openDetail(row)}><Eye size={14} /></Button>
          {["searching_partner", "scheduled", "assigned"].includes(row.deliveryStatus) && (
            <Button variant="ghost" size="sm" onClick={() => openAssign(row)}><UserPlus size={14} /></Button>
          )}
          {!["delivered", "completed", "cancelled_by_user", "cancelled_by_admin", "cancelled_by_driver", "failed"].includes(row.deliveryStatus) && (
            <Button variant="ghost" size="sm" className="text-red-500" onClick={() => handleCancel(row.id)}><XCircle size={14} /></Button>
          )}
        </div>
      ),
    },
  ];

  const selectCls = "h-10 px-3 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:border-red-500 focus:ring-4 focus:ring-red-500/10";

  return (
    <div className="blaze-theme-scope space-y-6 max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24">
      <PageHeader title="Orders" description="Logistics order management, tracking and dispatch" />

      {/* Order Status sub-navigation */}
      <div className="sticky top-0 z-20 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-2 bg-[#FAF7F2]/90 backdrop-blur border-b border-[#EDE8E0]">
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {ORDER_STATUS_TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            const count = tabCounts[tab.id] || 0;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => { setActiveTab(tab.id); setPage(1); }}
                className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 border ${
                  isActive
                    ? "bg-[var(--blaze-primary)] text-white border-[var(--blaze-primary)] shadow-sm"
                    : "bg-white text-[#5C5247] border-[#EDE8E0] hover:border-[var(--blaze-primary)] hover:text-[var(--blaze-primary)]"
                }`}
              >
                {tab.label}
                <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-semibold ${
                  isActive ? "bg-white/25 text-white" : "bg-[#F4F4F5] text-[#52525B]"
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard title="Total Orders" value={String(stats.total)} icon={<Package size={18} />} />
        <StatCard title="Pending" value={String(stats.pending)} />
        <StatCard title="In Transit" value={String(stats.inTransit)} icon={<Truck size={18} />} />
        <StatCard title="Delivered" value={String(stats.delivered)} />
        <StatCard title="Revenue" value={formatCurrency(stats.revenue)} />
      </div>

      <SectionCard flush>
        <div className="p-4 space-y-4">
          <FilterBar
            start={
              <div className="flex flex-wrap gap-2 w-full">
                <div className="relative min-w-[200px] flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input className="pl-9" placeholder="Search orders..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
                </div>
                <select className={selectCls} value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
                  {ORDER_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <select className={selectCls} value={vehicleFilter} onChange={(e) => { setVehicleFilter(e.target.value); setPage(1); }}>
                  <option value="all">All Vehicles</option>
                  {vehicles.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
                <select className={selectCls} value={driverFilter} onChange={(e) => { setDriverFilter(e.target.value); setPage(1); }}>
                  <option value="all">All Drivers</option>
                  {drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                <Input type="date" className="w-auto" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} />
                <Input type="date" className="w-auto" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} />
              </div>
            }
          />
          <AdminTable columns={columns} data={pageItems} getRowId={(r) => r.id}
            pagination={{ page, totalPages, total, pageSize, onPageChange: setPage, onPageSizeChange: (s) => { setPageSize(s); setPage(1); } }}
          />
        </div>
      </SectionCard>

      {/* Order Details Drawer */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="blaze-theme-scope sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Order {selected?.id}</DialogTitle></DialogHeader>
          {selected && (
            <>
              <div className="px-6 py-4 overflow-y-auto">
                <FormLayout>
                  <div className="flex flex-wrap gap-2 mb-4">
                    <StatusBadge tone={STATUS_TONES[selected.deliveryStatus]} label={STATUS_LABELS[selected.deliveryStatus]} />
                    <StatusBadge status="info" label={selected.paymentStatus} />
                    <StatusBadge status="neutral" label={selected.goodsType} />
                  </div>

                  <FormSection title="Order Summary">
                    <FormRow>
                      <FormField label="Customer"><div className="text-sm font-medium">{selected.customer}</div></FormField>
                      <FormField label="Phone"><div className="text-sm font-medium">{selected.customerPhone}</div></FormField>
                    </FormRow>
                    <FormRow>
                      <FormField label="Driver"><div className="text-sm font-medium">{selected.driverName}</div></FormField>
                      <FormField label="Vehicle"><div className="text-sm font-medium">{selected.vehicle}</div></FormField>
                    </FormRow>
                    <FormRow>
                      <FormField label="Distance"><div className="text-sm font-medium">{selected.distanceKm} km</div></FormField>
                      <FormField label="Amount"><div className="text-sm font-medium text-emerald-600">{formatCurrency(selected.amount)}</div></FormField>
                    </FormRow>
                  </FormSection>

                  <FormSection title="Locations">
                    <div className="space-y-3">
                      <div className="flex items-start gap-3 text-sm p-3 border rounded-lg bg-gray-50/50">
                        <MapPin size={16} className="mt-0.5 text-green-600 shrink-0" />
                        <div><p className="font-semibold text-gray-900">Pickup</p><p className="text-muted-foreground">{selected.pickupAddress}</p></div>
                      </div>
                      <div className="flex items-start gap-3 text-sm p-3 border rounded-lg bg-gray-50/50">
                        <MapPin size={16} className="mt-0.5 text-red-600 shrink-0" />
                        <div><p className="font-semibold text-gray-900">Drop</p><p className="text-muted-foreground">{selected.dropAddress}</p></div>
                      </div>
                    </div>
                  </FormSection>

                  <FormSection title="Tracking Timeline">
                    <div className="space-y-4 pl-2">
                      {(selected.timeline || []).map((step, i) => (
                        <div key={i} className="flex gap-4 relative">
                          {i !== (selected.timeline || []).length - 1 && (
                            <div className="absolute left-[11px] top-6 bottom-[-16px] w-[2px] bg-gray-200" />
                          )}
                          <div className="relative z-10 shrink-0 mt-1">
                            {step.status === "completed" ? <CheckCircle2 size={24} className="text-green-600 bg-white" /> :
                             step.status === "cancelled" ? <XCircle size={24} className="text-red-500 bg-white" /> :
                             <Circle size={24} className="text-amber-500 bg-white fill-amber-50" />}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{step.label}</p>
                            {step.at && <p className="text-xs text-muted-foreground">{formatDateTime(step.at)}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </FormSection>
                </FormLayout>
              </div>
              <div className="px-6 py-4 border-t flex flex-wrap gap-2 justify-end bg-gray-50/50">
                <Button variant="outline" size="sm" className="gap-1" onClick={() => window.print()}><FileText size={14} /> Invoice</Button>
                {["searching_partner", "scheduled", "assigned"].includes(selected.deliveryStatus) && (
                  <Button size="sm" className="gap-1" onClick={() => openAssign(selected)}><UserPlus size={14} /> Assign Driver</Button>
                )}
                {!["delivered", "completed", "cancelled_by_user", "cancelled_by_admin", "cancelled_by_driver", "failed"].includes(selected.deliveryStatus) && (
                  <Button size="sm" variant="outline" className="text-red-600" disabled={actionLoading} onClick={() => handleCancel(selected.id)}>Cancel Order</Button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Assign Driver Dialog */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="blaze-theme-scope sm:max-w-[400px]">
          <DialogHeader><DialogTitle>Assign Driver</DialogTitle></DialogHeader>
          <select className={selectCls + " w-full"} value={assignDriverId} onChange={(e) => setAssignDriverId(e.target.value)}>
            <option value="">Select driver</option>
            {(assignableDrivers.length ? assignableDrivers : drivers).map((d) => (
              <option key={d.id} value={d.id}>{d.name}{d.phone ? ` · ${d.phone}` : ""}</option>
            ))}
          </select>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setAssignOpen(false)}>Cancel</Button>
            <Button onClick={handleAssign} disabled={!assignDriverId || actionLoading}>Assign</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Orders;
