import React, { useEffect, useState } from "react";
import { Package, Truck, Clock, AlertTriangle, ArrowRight, TrendingUp, CheckCircle, XCircle, Activity, DollarSign, Users, MapPin, Bell } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from "recharts";
import {
  PageHeader,
  StatCard,
  SectionCard,
  AdminTable,
  StatusBadge,
} from "@/shared/components/admin";
import Button from "@/shared/components/ui/Button";

import porterAdminApi from "../services/adminApi";
import {
  MOCK_CHART_DAILY_ORDERS,
  MOCK_CHART_REVENUE,
  MOCK_CHART_VEHICLE_UTILIZATION,
  MOCK_RECENT_ORDERS,
  MOCK_RECENT_DRIVERS,
  MOCK_TOP_VEHICLES
} from "../utils/mockData";

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

const Dashboard = () => {
  const [dashboard, setDashboard] = useState(null);
  const [reports, setReports] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      porterAdminApi.getDashboard(),
      porterAdminApi.getReports({ range: 'weekly' })
    ])
      .then(([dashData, repData]) => {
         setDashboard(dashData);
         setReports(repData);
      })
      .catch(() => {
         setDashboard(null);
         setReports(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const kpis = dashboard?.kpis || reports?.kpis || {};
  const recentOrders = dashboard?.recentOrders || [];
  const revenueTrend = reports?.revenueTrend || [];
  const vehicleUtilization = reports?.vehicleUtilization || [];
  const topDrivers = reports?.topDrivers || [];

  const orderColumns = [
    { header: "Order ID", key: "id", className: "font-medium" },
    { header: "Customer", key: "customer" },
    { header: "Pickup", key: "pickup", cell: (row) => <div className="max-w-[150px] truncate" title={row.pickup}>{row.pickup}</div> },
    { header: "Drop", key: "drop", cell: (row) => <div className="max-w-[150px] truncate" title={row.drop}>{row.drop}</div> },
    { header: "Driver", key: "driver" },
    { header: "Vehicle", key: "vehicle" },
    { header: "Goods", key: "goodsType" },
    { header: "Distance", key: "distance" },
    { header: "Amount", key: "amount" },
    { header: "Payment", key: "paymentStatus", cell: (row) => {
      let ps = row.paymentStatus?.toLowerCase() || "pending";
      if (ps === "pending" && row.status?.startsWith("cancelled")) {
        ps = "cancelled";
      }
      let tone = "warning";
      if (ps === "paid") tone = "success";
      else if (["refunded", "failed", "cancelled"].includes(ps)) tone = "danger";
      return <StatusBadge status={tone} label={ps} />;
    } },
    { header: "Status", key: "status", cell: (row) => <StatusBadge status={row.status === "in_transit" ? "warning" : row.status === "delivered" ? "success" : row.status === "cancelled" ? "error" : "default"} label={row.status.replace("_", " ")} /> },
    { header: "Time", key: "time", className: "text-gray-500 whitespace-nowrap" },
  ];

  const driverColumns = [
    { header: "Driver", key: "name", cell: (row) => (
        <div className="flex items-center gap-3">
          {row.image ? (
            <img src={row.image} alt={row.name} className="w-8 h-8 rounded-full bg-gray-100 object-cover" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs uppercase">
              {row.name ? row.name.substring(0, 2) : "UN"}
            </div>
          )}
          <div>
            <p className="font-medium text-sm">{row.name}</p>
            <p className="text-[10px] text-gray-500 font-mono bg-gray-50 px-1 py-0.5 rounded inline-block mt-0.5 border border-gray-100">
              {(row.id || row.driverId || "").length > 10 ? `DRV-${(row.id || row.driverId).slice(-6).toUpperCase()}` : (row.id || row.driverId)}
            </p>
          </div>
        </div>
      ) 
    },
    { header: "Phone", key: "phone" },
    { header: "Vehicle", key: "vehicle" },
    { header: "Rating", key: "rating", cell: (row) => (
       <div>
         <span className="text-yellow-600 font-medium">★ {row.rating}</span>
         {row.latestReviewText && <p className="text-[10px] text-gray-500 mt-0.5 italic max-w-[150px] truncate" title={row.latestReviewText}>{row.latestReviewText}</p>}
       </div>
    ) },
    { header: "Orders", key: "completedOrders" },
    { header: "Status", key: "status", cell: (row) => <StatusBadge status={row.status === "active" ? "success" : "default"} /> },
  ];

  const handleDownloadPDF = () => {
    window.print();
  };

  const handleDownloadCSV = () => {
    if (!recentOrders || recentOrders.length === 0) {
      return;
    }
    const headers = ["Order ID", "Customer", "Pickup", "Drop", "Driver", "Vehicle", "Goods", "Distance", "Amount", "Payment", "Status", "Time"];
    const csvRows = [headers.join(",")];
    
    recentOrders.forEach(o => {
      const values = [
        o.orderNumber || "",
        `"${o.customer || ""}"`,
        `"${o.pickup || ""}"`,
        `"${o.drop || ""}"`,
        `"${o.driver || ""}"`,
        o.vehicle || "",
        o.goodsType || "",
        o.distance || "",
        o.amount || 0,
        o.payment || "",
        o.status || "",
        o.time ? new Date(o.time).toLocaleString() : ""
      ];
      csvRows.push(values.join(","));
    });

    const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `porter_orders_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="blaze-theme-scope space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24">
      <PageHeader
        title="Porter Operations Dashboard"
        subtitle="Live tracking and analytics of logistics fleet"
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Porter", href: "/admin/porter" },
          { label: "Dashboard" },
        ]}
        actions={
          <div className="flex gap-3">
            <Button variant="outline" className="gap-2 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700" onClick={handleDownloadPDF}>
              Download PDF
            </Button>
            <Button className="gap-2 bg-green-600 hover:bg-green-700 text-white border-transparent" onClick={handleDownloadCSV}>
              Download CSV/Excel
            </Button>
          </div>
        }
      />
      
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading dashboard…</p>
      ) : (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard title="Total Orders" value={String(kpis.totalOrders ?? 0)} icon={<Package size={18} />} iconBg="bg-blue-100 text-blue-600" />
        <StatCard title="Orders Today" value={String(kpis.todayOrders ?? 0)} icon={<Clock size={18} />} iconBg="bg-orange-100 text-orange-600" />
        <StatCard title="Active Orders" value={String(kpis.activeOrders ?? 0)} icon={<Activity size={18} />} iconBg="bg-purple-100 text-purple-600" />
        <StatCard title="Delivered" value={String(kpis.deliveredOrders ?? 0)} icon={<CheckCircle size={18} />} iconBg="bg-green-100 text-green-600" />
        <StatCard title="Cancelled" value={String(kpis.cancelledOrders ?? 0)} icon={<XCircle size={18} />} iconBg="bg-red-100 text-red-600" />
        
        <StatCard title="Revenue (Today)" value={`₹${(kpis.todayRevenue ?? 0).toLocaleString("en-IN")}`} icon={<DollarSign size={18} />} iconBg="bg-yellow-100 text-yellow-600" />
        <StatCard title="Admin (Today)" value={`₹${(kpis.todayAdminEarning ?? 0).toLocaleString("en-IN")}`} icon={<DollarSign size={18} />} iconBg="bg-emerald-100 text-emerald-600" />
        <StatCard title="Revenue (Total)" value={`₹${(kpis.totalRevenue ?? 0).toLocaleString("en-IN")}`} icon={<TrendingUp size={18} />} iconBg="bg-green-100 text-green-600" />
        <StatCard title="Admin (Total)" value={`₹${(kpis.totalAdminEarning ?? 0).toLocaleString("en-IN")}`} icon={<TrendingUp size={18} />} iconBg="bg-emerald-100 text-emerald-600" />
        <StatCard title="Scheduled" value={String(kpis.scheduledOrders ?? 0)} icon={<Clock size={18} />} iconBg="bg-cyan-100 text-cyan-600" />
      </div>
      )}

      <div className="mt-6">
          <SectionCard title="Recent Orders" action={<Button variant="ghost" size="sm">View All</Button>}>
                <div className="overflow-x-auto pb-4">
                    <AdminTable columns={orderColumns} data={recentOrders.map((o) => ({
                      ...o,
                      id: o.orderNumber,
                      time: o.time ? new Date(o.time).toLocaleString() : "—",
                      amount: `₹${o.amount ?? 0}`,
                    }))} />
                </div>
          </SectionCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 mt-6">
          <SectionCard title="Daily Orders Trend">
            <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={revenueTrend} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
                        <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Line type="monotone" dataKey="orders" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} name="Orders" />
                    </LineChart>
                </ResponsiveContainer>
            </div>
          </SectionCard>
          
          <SectionCard title="Revenue Trend (Last 7 Days)">
            <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={revenueTrend} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
                        <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Bar dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} name="Revenue (₹)" />
                    </BarChart>
                </ResponsiveContainer>
            </div>
          </SectionCard>
          
          <SectionCard title="Vehicle Utilization">
            <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={vehicleUtilization} layout="vertical" margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
                        <YAxis type="category" dataKey="category" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} width={80} />
                        <Tooltip />
                        <Bar dataKey="value" fill="#3b82f6" name="Orders" />
                        <Bar dataKey="revenue" fill="#10b981" name="Revenue (₹)" />
                    </BarChart>
                </ResponsiveContainer>
            </div>
          </SectionCard>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mt-6">
        <div className="xl:col-span-2 space-y-6">
          <SectionCard 
            title="Active Drivers"
            action={<Button variant="ghost" size="sm">Manage Drivers</Button>}
          >
            <div className="overflow-x-auto pb-4">
                <AdminTable columns={driverColumns} data={topDrivers} />
            </div>
          </SectionCard>
        </div>

        <div className="xl:col-span-1 space-y-6">
            <SectionCard title="Top Performing Vehicles">
                <div className="space-y-4">
                    {vehicleUtilization.map((vehicle, index) => (
                        <div key={index} className="flex items-center justify-between border-b border-gray-50 last:border-0 pb-3 last:pb-0">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-gray-100 border border-gray-200">
                                    <Truck size={20} className="text-gray-500" />
                                </div>
                                <div>
                                    <p className="font-medium text-sm">{vehicle.category}</p>
                                    <p className="text-xs text-gray-500">{vehicle.value} Orders</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <span className="text-sm font-semibold text-green-600">₹{vehicle.revenue}</span>
                                <p className="text-[10px] text-gray-400">Revenue</p>
                            </div>
                        </div>
                    ))}
                </div>
            </SectionCard>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
