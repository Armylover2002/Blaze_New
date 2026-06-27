import React, { useState } from "react";
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
import {
  MOCK_REPORT_KPIS, MOCK_REVENUE_TREND, MOCK_WEEKLY_REVENUE, MOCK_DAILY_REVENUE,
  MOCK_VEHICLE_UTILIZATION, MOCK_ZONE_PERFORMANCE, MOCK_TOP_DRIVERS,
  MOCK_TOP_VEHICLES, MOCK_DRIVER_PERFORMANCE,
} from "../utils/mock/reports";
import { formatCurrency } from "../utils/porterTableHelpers";

const PIE_COLORS = BLAZE_CHART?.series || ["#FF0000", "#2563EB", "#2E7D32", "#F59E0B", "#7C3AED", "#DC2626"];

const Reports = () => {
  const [range, setRange] = useState("monthly");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const revenueData = range === "weekly" ? MOCK_WEEKLY_REVENUE : range === "daily" ? MOCK_DAILY_REVENUE : MOCK_REVENUE_TREND;

  const exportCsv = () => {
    const headers = ["Period", "Revenue", "Orders"];
    const rows = MOCK_REVENUE_TREND.map((r) => [r.name, r.revenue, r.orders]);
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
        <StatCard title="Total Revenue" value={MOCK_REPORT_KPIS.totalRevenue} icon={<IndianRupee size={18} />} trend="+12%" trendDirection="up" />
        <StatCard title="Total Orders" value={MOCK_REPORT_KPIS.totalOrders} icon={<Package size={18} />} trend="+8%" trendDirection="up" />
        <StatCard title="Avg Order Value" value={MOCK_REPORT_KPIS.avgOrderValue} icon={<TrendingUp size={18} />} />
        <StatCard title="Fleet Utilization" value={MOCK_REPORT_KPIS.fleetUtilization} icon={<Truck size={18} />} trend="+5%" trendDirection="up" />
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
                <Pie data={MOCK_VEHICLE_UTILIZATION} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {MOCK_VEHICLE_UTILIZATION.map((entry, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
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
              <LineChart data={MOCK_REVENUE_TREND}>
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
              <BarChart data={MOCK_DRIVER_PERFORMANCE}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={BLAZE_CHART.grid} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip {...BLAZE_CHART.tooltip} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="completed" fill={BLAZE_CHART.success} radius={[4, 4, 0, 0]} name="Completed" />
                <Bar dataKey="cancelled" fill={BLAZE_CHART.danger} radius={[4, 4, 0, 0]} name="Cancelled" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </div>

      {/* Zone performance */}
      <SectionCard title="Zone Performance" subtitle="Orders and revenue by zone" flush>
        <div className="h-72 p-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={MOCK_ZONE_PERFORMANCE} layout="vertical" margin={{ left: 30 }}>
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
        <SectionCard title="Top Drivers"><AdminTable columns={driverColumns} data={MOCK_TOP_DRIVERS} getRowId={(r) => r.name} /></SectionCard>
        <SectionCard title="Top Vehicles"><AdminTable columns={vehicleColumns} data={MOCK_TOP_VEHICLES} getRowId={(r) => r.name} /></SectionCard>
      </div>
    </div>
  );
};

export default Reports;
