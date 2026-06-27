import React from "react";
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

import {
  MOCK_DASHBOARD_KPIS,
  MOCK_CHART_DAILY_ORDERS,
  MOCK_CHART_REVENUE,
  MOCK_CHART_VEHICLE_UTILIZATION,
  MOCK_RECENT_ORDERS,
  MOCK_RECENT_DRIVERS,
  MOCK_TOP_VEHICLES,
  MOCK_NOTIFICATIONS
} from "../utils/mockData";

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

const Dashboard = () => {
  const orderColumns = [
    { header: "Order ID", key: "id", className: "font-medium" },
    { header: "Customer", key: "customer" },
    { header: "Pickup", key: "pickup" },
    { header: "Drop", key: "drop" },
    { header: "Driver", key: "driver" },
    { header: "Vehicle", key: "vehicle" },
    { header: "Goods", key: "goodsType" },
    { header: "Distance", key: "distance" },
    { header: "Amount", key: "amount" },
    { header: "Payment", key: "payment" },
    { header: "Status", key: "status", cell: (row) => <StatusBadge status={row.status === "in_transit" ? "warning" : row.status === "delivered" ? "success" : row.status === "cancelled" ? "error" : "default"} label={row.status.replace("_", " ")} /> },
    { header: "Time", key: "time", className: "text-gray-500 whitespace-nowrap" },
  ];

  const driverColumns = [
    { header: "Driver", key: "name", cell: (row) => (
        <div className="flex items-center gap-3">
          <img src={row.image} alt={row.name} className="w-8 h-8 rounded-full bg-gray-100" />
          <div>
            <p className="font-medium">{row.name}</p>
            <p className="text-xs text-gray-500">{row.id}</p>
          </div>
        </div>
      ) 
    },
    { header: "Phone", key: "phone" },
    { header: "Vehicle", key: "vehicle" },
    { header: "Rating", key: "rating", cell: (row) => <span className="text-yellow-600 font-medium">★ {row.rating}</span> },
    { header: "Orders", key: "completedOrders" },
    { header: "Status", key: "status", cell: (row) => <StatusBadge status={row.status === "active" ? "success" : "default"} /> },
  ];

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
            <Button variant="outline" className="gap-2">
              Export Data
            </Button>
            <Button className="gap-2">
              View Reports <ArrowRight size={16} />
            </Button>
          </div>
        }
      />
      
      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <StatCard title="Total Orders Today" value={MOCK_DASHBOARD_KPIS.totalOrders.value} trend={MOCK_DASHBOARD_KPIS.totalOrders.trend} trendValue={MOCK_DASHBOARD_KPIS.totalOrders.trendValue} subtitle={MOCK_DASHBOARD_KPIS.totalOrders.description} icon={<Package size={18} />} iconBg="bg-blue-100 text-blue-600" />
        <StatCard title="Active Drivers" value={MOCK_DASHBOARD_KPIS.activeDrivers.value} trend={MOCK_DASHBOARD_KPIS.activeDrivers.trend} trendValue={MOCK_DASHBOARD_KPIS.activeDrivers.trendValue} subtitle={MOCK_DASHBOARD_KPIS.activeDrivers.description} icon={<Users size={18} />} iconBg="bg-green-100 text-green-600" />
        <StatCard title="Active Vehicles" value={MOCK_DASHBOARD_KPIS.activeVehicles.value} trend={MOCK_DASHBOARD_KPIS.activeVehicles.trend} trendValue={MOCK_DASHBOARD_KPIS.activeVehicles.trendValue} subtitle={MOCK_DASHBOARD_KPIS.activeVehicles.description} icon={<Truck size={18} />} iconBg="bg-teal-100 text-teal-600" />
        <StatCard title="Revenue Today" value={MOCK_DASHBOARD_KPIS.revenueToday.value} trend={MOCK_DASHBOARD_KPIS.revenueToday.trend} trendValue={MOCK_DASHBOARD_KPIS.revenueToday.trendValue} subtitle={MOCK_DASHBOARD_KPIS.revenueToday.description} icon={<DollarSign size={18} />} iconBg="bg-yellow-100 text-yellow-600" />
        
        <StatCard title="Orders In Transit" value={MOCK_DASHBOARD_KPIS.ordersInTransit.value} trend={MOCK_DASHBOARD_KPIS.ordersInTransit.trend} trendValue={MOCK_DASHBOARD_KPIS.ordersInTransit.trendValue} subtitle={MOCK_DASHBOARD_KPIS.ordersInTransit.description} icon={<Activity size={18} />} iconBg="bg-purple-100 text-purple-600" />
        <StatCard title="Completed Orders" value={MOCK_DASHBOARD_KPIS.completedOrders.value} trend={MOCK_DASHBOARD_KPIS.completedOrders.trend} trendValue={MOCK_DASHBOARD_KPIS.completedOrders.trendValue} subtitle={MOCK_DASHBOARD_KPIS.completedOrders.description} icon={<CheckCircle size={18} />} iconBg="bg-green-100 text-green-600" />
        <StatCard title="Pending Orders" value={MOCK_DASHBOARD_KPIS.pendingOrders.value} trend={MOCK_DASHBOARD_KPIS.pendingOrders.trend} trendValue={MOCK_DASHBOARD_KPIS.pendingOrders.trendValue} subtitle={MOCK_DASHBOARD_KPIS.pendingOrders.description} icon={<Clock size={18} />} iconBg="bg-orange-100 text-orange-600" />
        <StatCard title="Cancelled Orders" value={MOCK_DASHBOARD_KPIS.cancelledOrders.value} trend={MOCK_DASHBOARD_KPIS.cancelledOrders.trend} trendValue={MOCK_DASHBOARD_KPIS.cancelledOrders.trendValue} subtitle={MOCK_DASHBOARD_KPIS.cancelledOrders.description} icon={<XCircle size={18} />} iconBg="bg-red-100 text-red-600" />
        
        <StatCard title="Avg Delivery Time" value={MOCK_DASHBOARD_KPIS.avgDeliveryTime.value} trend={MOCK_DASHBOARD_KPIS.avgDeliveryTime.trend} trendValue={MOCK_DASHBOARD_KPIS.avgDeliveryTime.trendValue} subtitle={MOCK_DASHBOARD_KPIS.avgDeliveryTime.description} icon={<Clock size={18} />} iconBg="bg-indigo-100 text-indigo-600" />
        <StatCard title="Customer Rating" value={MOCK_DASHBOARD_KPIS.customerRating.value} trend={MOCK_DASHBOARD_KPIS.customerRating.trend} trendValue={MOCK_DASHBOARD_KPIS.customerRating.trendValue} subtitle={MOCK_DASHBOARD_KPIS.customerRating.description} icon={<TrendingUp size={18} />} iconBg="bg-yellow-50 text-yellow-600" />
        <StatCard title="Pending Issues" value={MOCK_DASHBOARD_KPIS.pendingIssues.value} trend={MOCK_DASHBOARD_KPIS.pendingIssues.trend} trendValue={MOCK_DASHBOARD_KPIS.pendingIssues.trendValue} subtitle={MOCK_DASHBOARD_KPIS.pendingIssues.description} icon={<AlertTriangle size={18} />} iconBg="bg-red-100 text-red-600" />
        <StatCard title="Fleet Utilization" value={MOCK_DASHBOARD_KPIS.fleetUtilization.value} trend={MOCK_DASHBOARD_KPIS.fleetUtilization.trend} trendValue={MOCK_DASHBOARD_KPIS.fleetUtilization.trendValue} subtitle={MOCK_DASHBOARD_KPIS.fleetUtilization.description} icon={<Truck size={18} />} iconBg="bg-cyan-100 text-cyan-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          <SectionCard title="Daily Orders Trend">
            <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={MOCK_CHART_DAILY_ORDERS} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
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
                    <BarChart data={MOCK_CHART_REVENUE} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
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
                    <BarChart data={MOCK_CHART_VEHICLE_UTILIZATION} layout="vertical" margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
                        <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} width={80} />
                        <Tooltip />
                        <Bar dataKey="active" stackId="a" fill="#3b82f6" name="Active %" />
                        <Bar dataKey="idle" stackId="a" fill="#e5e7eb" name="Idle %" />
                    </BarChart>
                </ResponsiveContainer>
            </div>
          </SectionCard>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <SectionCard 
            title="Recent Orders" 
            action={<Button variant="ghost" size="sm">View All</Button>}
          >
            <div className="overflow-x-auto pb-4">
                <AdminTable columns={orderColumns} data={MOCK_RECENT_ORDERS} />
            </div>
          </SectionCard>
          
          <SectionCard 
            title="Active Drivers"
            action={<Button variant="ghost" size="sm">Manage Drivers</Button>}
          >
            <div className="overflow-x-auto pb-4">
                <AdminTable columns={driverColumns} data={MOCK_RECENT_DRIVERS} />
            </div>
          </SectionCard>
        </div>

        <div className="xl:col-span-1 space-y-6">
            <SectionCard title="Quick Actions">
                <div className="grid grid-cols-2 gap-3">
                    <Button variant="outline" className="w-full justify-center h-auto py-3 flex-col gap-1">
                        <Users size={20} className="text-blue-500" />
                        <span className="text-xs font-medium">Assign Driver</span>
                    </Button>
                    <Button variant="outline" className="w-full justify-center h-auto py-3 flex-col gap-1">
                        <Package size={20} className="text-purple-500" />
                        <span className="text-xs font-medium">Create Order</span>
                    </Button>
                    <Button variant="outline" className="w-full justify-center h-auto py-3 flex-col gap-1">
                        <Truck size={20} className="text-green-500" />
                        <span className="text-xs font-medium">Add Vehicle</span>
                    </Button>
                    <Button variant="outline" className="w-full justify-center h-auto py-3 flex-col gap-1">
                        <MapPin size={20} className="text-red-500" />
                        <span className="text-xs font-medium">Track Shipment</span>
                    </Button>
                    <Button variant="outline" className="w-full justify-center h-auto py-3 flex-col gap-1">
                        <DollarSign size={20} className="text-yellow-600" />
                        <span className="text-xs font-medium">Pricing</span>
                    </Button>
                    <Button variant="outline" className="w-full justify-center h-auto py-3 flex-col gap-1">
                        <Activity size={20} className="text-indigo-500" />
                        <span className="text-xs font-medium">Reports</span>
                    </Button>
                </div>
            </SectionCard>

            <SectionCard title="Recent Notifications">
                <div className="space-y-4">
                    {MOCK_NOTIFICATIONS.map(notification => (
                        <div key={notification.id} className="flex gap-3 items-start p-3 rounded-lg hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-100">
                            <div className={`mt-0.5 p-2 rounded-full ${
                                notification.type === 'success' ? 'bg-green-100 text-green-600' :
                                notification.type === 'warning' ? 'bg-orange-100 text-orange-600' :
                                notification.type === 'error' ? 'bg-red-100 text-red-600' :
                                'bg-blue-100 text-blue-600'
                            }`}>
                                <Bell size={14} />
                            </div>
                            <div>
                                <h4 className="text-sm font-semibold text-gray-900">{notification.title}</h4>
                                <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">{notification.message}</p>
                                <span className="text-[10px] font-medium text-gray-400 mt-1 block">{notification.time}</span>
                            </div>
                        </div>
                    ))}
                </div>
                <Button variant="ghost" className="w-full mt-4 text-sm">View All Notifications</Button>
            </SectionCard>

            <SectionCard title="Top Performing Vehicles">
                <div className="space-y-4">
                    {MOCK_TOP_VEHICLES.map((vehicle, index) => (
                        <div key={index} className="flex items-center justify-between border-b border-gray-50 last:border-0 pb-3 last:pb-0">
                            <div className="flex items-center gap-3">
                                <img src={vehicle.image} alt={vehicle.name} className="w-10 h-10 rounded-lg bg-gray-100 border border-gray-200" />
                                <div>
                                    <p className="font-medium text-sm">{vehicle.name}</p>
                                    <p className="text-xs text-gray-500">{vehicle.orders} Orders</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <span className="text-sm font-semibold text-green-600">{vehicle.availability}</span>
                                <p className="text-[10px] text-gray-400">Available</p>
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
