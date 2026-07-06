import React, { useState, useEffect } from "react";
import {
  IndianRupee, Package, TrendingUp, Truck, Download, FileText, FileSpreadsheet,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import {
  PageHeader, SectionCard, StatCard, AdminTable, BLAZE_CHART,
} from "@/shared/components/admin";
import Button from "@/shared/components/ui/Button";
import Input from "@/shared/components/ui/Input";
import { formatCurrency } from "../utils/porterTableHelpers";
import porterAdminApi from "../services/adminApi";

const PIE_COLORS = BLAZE_CHART?.series || ["#FF0000", "#2563EB", "#2E7D32", "#F59E0B", "#7C3AED", "#DC2626"];

const Reports = () => {
  const [range, setRange] = useState("monthly");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    porterAdminApi.getReports({ range })
      .then((res) => { if (!cancelled) setData(res); })
      .catch(() => { if (!cancelled) setData(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [range]);

  const kpis = data?.kpis || { totalRevenue: "₹0", totalOrders: "0", avgOrderValue: "₹0", fleetUtilization: "0%" };
  const revenueData = data?.revenueTrend || [];
  const vehicleUtilization = data?.vehicleUtilization || [];
  const zonePerformance = data?.zonePerformance || [];
  const topDrivers = (data?.topDrivers || []).map((d, i) => ({
    name: `Driver ${i + 1}`,
    orders: d.trips,
    rating: "—",
    earnings: d.earnings,
  }));
  const topVehicles = vehicleUtilization.map((v) => ({
    name: v.name,
    orders: v.value,
    revenue: v.revenue,
  }));

  const exportCsv = () => {
    const headers = ["Period", "Revenue", "Orders"];
    const rows = revenueData.map((r) => [r.name, r.revenue, r.orders]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "porter-report.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const driverColumns = [
    { key: "name", header: "Driver", cell: (row) => <span className="font-medium">{row.name}</span> },
    { key: "orders", header: "Orders", cell: (row) => String(row.orders) },
    { key: "rating", header: "Rating", cell: (row) => <span className="text-amber-600">★ {row.rating}</span> },
    { key: "earnings", header: "Earnings", align: "right", cell: (row) => formatCurrency(row.earnings) },
  ];
  const vehicleColumns = [
    { key: "name", header: "Vehicle", cell: (row) => <span className="font-medium">{row.name}</span> },
    { key: "orders", header: "Orders", cell: (row) => String(row.orders) },
    { key: "availability", header: "Availability", align: "right" },
  ];

  const selectCls = "h-10 px-3 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:border-red-500 focus:ring-4 focus:ring-red-500/10";

  return (
    <div className="blaze-theme-scope space-y-6 max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24">
      <PageHeader
        title="Reports & Analytics"
        description="Operational and financial insights across the logistics network"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="gap-2" onClick={() => window.print()}><FileText size={16} /> Export PDF</Button>
            <Button className="gap-2" onClick={exportCsv}><FileSpreadsheet size={16} /> Export Excel</Button>
          </div>
        }
      />

      {/* Date range controls */}
      <SectionCard flush>
        <div className="p-4 flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-muted-foreground">Date Range:</span>
          <select className={selectCls} value={range} onChange={(e) => setRange(e.target.value)}>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
          <Input type="date" className="w-auto" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          <span className="text-muted-foreground">to</span>
          <Input type="date" className="w-auto" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          <Button variant="outline" size="sm" className="gap-1 ml-auto" onClick={exportCsv}><Download size={14} /> Download Report</Button>
        </div>
      </SectionCard>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Total Revenue" value={kpis.totalRevenue} icon={<IndianRupee size={18} />} />
        <StatCard title="Total Orders" value={kpis.totalOrders} icon={<Package size={18} />} />
        <StatCard title="Avg Order Value" value={kpis.avgOrderValue} icon={<TrendingUp size={18} />} />
        <StatCard title="Fleet Utilization" value={kpis.fleetUtilization} icon={<Truck size={18} />} />
      </div>

      {/* Revenue + Orders trend */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <SectionCard title="Revenue Trend" subtitle={`${range} revenue`} className="lg:col-span-2" flush>
          <div className="h-72 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueData}>
                <defs>
                  <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={BLAZE_CHART.primary} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={BLAZE_CHART.primary} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={BLAZE_CHART.grid} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip {...BLAZE_CHART.tooltip} />
                <Area type="monotone" dataKey="revenue" stroke={BLAZE_CHART.primary} strokeWidth={2} fill="url(#revFill)" name="Revenue" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard title="Vehicle Utilization" subtitle="Active fleet mix" flush>
          <div className="h-72 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={vehicleUtilization} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {vehicleUtilization.map((entry, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip {...BLAZE_CHART.tooltip} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </div>

      {/* Orders trend + Driver performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title="Orders Trend" flush>
          <div className="h-64 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={BLAZE_CHART.grid} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip {...BLAZE_CHART.tooltip} />
                <Line type="monotone" dataKey="orders" stroke={BLAZE_CHART.info} strokeWidth={2} name="Orders" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard title="Driver Performance" subtitle="Completed vs cancelled" flush>
          <div className="h-64 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={BLAZE_CHART.grid} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip {...BLAZE_CHART.tooltip} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="orders" fill={BLAZE_CHART.success} radius={[4, 4, 0, 0]} name="Orders" />
                <Bar dataKey="revenue" fill={BLAZE_CHART.primary} radius={[4, 4, 0, 0]} name="Revenue" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </div>

      {/* Zone performance */}
      <SectionCard title="Zone Performance" subtitle="Orders and revenue by zone" flush>
        <div className="h-72 p-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={zonePerformance.map((z) => ({ name: z.zoneId?.slice(-6) || "Zone", orders: z.orders }))} layout="vertical" margin={{ left: 30 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={BLAZE_CHART.grid} />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={100} />
              <Tooltip {...BLAZE_CHART.tooltip} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="orders" fill={BLAZE_CHART.primary} radius={[0, 4, 4, 0]} name="Orders" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>

      {/* Top tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title="Top Drivers"><AdminTable columns={driverColumns} data={topDrivers} getRowId={(r) => r.name} /></SectionCard>
        <SectionCard title="Top Vehicles"><AdminTable columns={vehicleColumns} data={topVehicles} getRowId={(r) => r.name} /></SectionCard>
      </div>
    </div>
  );
};

export default Reports;
