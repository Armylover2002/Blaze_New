import { useEffect, useMemo, useState, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@food/components/ui/select"
import {
  PageHeader,
  SectionCard,
  StatCard,
  EmptyState,
  KpiGridSkeleton,
  BLAZE_CHART,
} from "@/shared/components/admin"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Activity, ShoppingBag, CreditCard, Truck, Receipt, IndianRupee, Store, UserCheck, Package, UserCircle, Clock, CheckCircle, Plus, XCircle } from "lucide-react"
import { adminAPI } from "@food/api"
import { useAuth } from "@core/context/AuthContext"
import { getCurrentUser } from "@food/utils/auth"
import { canAccessAdminPath, extractAdminPermissions, extractAdminRoleId, fetchAdminRolePermissions } from "@food/utils/adminPermissions"
const debugLog = () => { }
const debugError = () => { }

const INR_SYMBOL = "\u20B9"

function formatCurrency(amount, options = {}) {
  const numericAmount = Number(amount || 0)
  const formattedAmount = numericAmount.toLocaleString("en-IN", options)
  return `${INR_SYMBOL}${formattedAmount}`
}


export default function AdminHome() {
  const navigate = useNavigate()
  const { user: authUser } = useAuth()
  const user = useMemo(() => authUser || getCurrentUser("admin"), [authUser])
  const [selectedZone, setSelectedZone] = useState("all")
  const [selectedPeriod, setSelectedPeriod] = useState("overall")
  const [isLoading, setIsLoading] = useState(true)
  const [dashboardData, setDashboardData] = useState(null)
  const [zones, setZones] = useState([])
  const [resolvedPermissions, setResolvedPermissions] = useState({})

  useEffect(() => {
    let isMounted = true

    const resolvePermissions = async () => {
      if (!user || user.role === "ADMIN") {
        if (isMounted) setResolvedPermissions({})
        return
      }

      const existingPermissions = extractAdminPermissions(user)
      if (Object.keys(existingPermissions).length > 0) {
        if (isMounted) setResolvedPermissions(existingPermissions)
        return
      }

      const roleId = extractAdminRoleId(user)
      if (!roleId) {
        if (isMounted) setResolvedPermissions({})
        return
      }

      try {
        const rolePermissions = await fetchAdminRolePermissions(roleId)
        if (isMounted) setResolvedPermissions(rolePermissions)
      } catch {
        if (isMounted) setResolvedPermissions({})
      }
    }

    resolvePermissions()
    return () => {
      isMounted = false
    }
  }, [user])

  const canAccessPath = useCallback(
    (path) => canAccessAdminPath(user, resolvedPermissions, path),
    [user, resolvedPermissions]
  );



  // Fetch zone list for filter
  useEffect(() => {
    const fetchZones = async () => {
      try {
        const response = await adminAPI.getZones({ page: 1, limit: 1000 })
        const list = response?.data?.data?.zones || []
        setZones(Array.isArray(list) ? list : [])
      } catch (error) {
        debugError("Error fetching zones:", error)
        setZones([])
      }
    }

    fetchZones()
  }, [])

  // Fetch dashboard stats from backend when filters change
  useEffect(() => {
    const fetchDashboardStats = async () => {
      try {
        setIsLoading(true)
        const params = {
          period: selectedPeriod,
          ...(selectedZone !== "all" ? { zoneId: selectedZone } : {}),
        }
        const response = await adminAPI.getDashboardStats(params)
        if (response.data?.success && response.data?.data) {
          setDashboardData(response.data.data)
          debugLog("Dashboard stats fetched:", response.data.data)
        } else {
          setDashboardData(null)
          debugError("Invalid dashboard response format:", response.data)
        }
      } catch (error) {
        setDashboardData(null)
        debugError("Error fetching dashboard stats:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchDashboardStats()
  }, [selectedZone, selectedPeriod])

  // Get order stats from real data
  const orderStats = useMemo(() => {
    if (!dashboardData?.orders?.byStatus) {
      return [
        { label: "Delivered", value: 0, color: BLAZE_CHART.success },
        { label: "Cancelled", value: 0, color: BLAZE_CHART.danger },
        { label: "Refunded", value: 0, color: BLAZE_CHART.warning },
        { label: "Pending", value: 0, color: BLAZE_CHART.info },
      ]
    }

    const byStatus = dashboardData.orders.byStatus
    return [
      { label: "Delivered", value: byStatus.delivered || 0, color: BLAZE_CHART.success },
      { label: "Processing", value: byStatus.processing || 0, color: BLAZE_CHART.info },
      { label: "Cancelled", value: byStatus.cancelled || 0, color: BLAZE_CHART.danger },
      { label: "Pending", value: byStatus.pending || 0, color: BLAZE_CHART.warning },
    ]
  }, [dashboardData]);

  // Get monthly data from real data
  const monthlyData = useMemo(() => {
    if (!dashboardData?.monthlyData || dashboardData.monthlyData.length === 0) {
      // Return empty data structure if no data
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      return monthNames.map(month => ({ month, commission: 0, revenue: 0, orders: 0 }))
    }

    // Use real monthly data from backend
    return dashboardData.monthlyData.map(item => ({
      month: item.month,
      commission: item.commission || 0,
      revenue: item.revenue || 0,
      orders: item.orders || 0
    }))
  }, [dashboardData]);

  // Calculate totals from real data
  const revenueTotal = dashboardData?.revenue?.total || 0
  const ordersTotal = dashboardData?.orders?.total || 0
  const platformFeeTotal = dashboardData?.platformFee?.total || 0
  const deliveryFeeTotal = dashboardData?.deliveryFee?.total || 0
  const gstTotal = dashboardData?.gst?.total || 0
  const totalAdminEarnings = dashboardData?.totalAdminEarnings || 0

  // Additional stats
  const totalRestaurants = dashboardData?.restaurants?.total || 0
  const pendingRestaurantRequests = dashboardData?.restaurants?.pendingRequests || 0
  const totalDeliveryBoys = dashboardData?.deliveryBoys?.total || 0
  const pendingDeliveryBoyRequests = dashboardData?.deliveryBoys?.pendingRequests || 0
  const totalFoods = dashboardData?.foods?.total || 0
  const totalAddons = dashboardData?.addons?.total || 0
  const totalCustomers = dashboardData?.customers?.total || 0
  const pendingOrders = dashboardData?.orderStats?.pending || 0
  const processingOrders = dashboardData?.orderStats?.processing || 0
  const completedOrders = dashboardData?.orderStats?.completed || 0
  const activeOrdersTotal = processingOrders

  const pieData = useMemo(() => {
    return orderStats.map((item) => ({
      name: item.label,
      value: item.value,
      fill: item.color,
    }));
  }, [orderStats]);

  const deliveryProfit = dashboardData?.deliveryProfit || 0
  const periodLabel = selectedPeriod === "overall" ? "Overall" :
    selectedPeriod === "today" ? "Today's" :
      `This ${selectedPeriod}'s`

  const activityFeed = dashboardData?.liveSignals || []
  const totalRevenueHelper = [
    `Platform: ${formatCurrency(platformFeeTotal)}`,
    `Delivery Net: ${formatCurrency(deliveryProfit)}`,
    `GST: ${formatCurrency(gstTotal)}`,
  ].join(" + ")

  const showInitialSkeleton = isLoading && !dashboardData

  const orderRoutes = {
    Delivered: "/admin/food/orders/delivered",
    Processing: "/admin/food/orders/processing",
    Cancelled: "/admin/food/orders/canceled",
    Pending: "/admin/food/orders/pending",
  }

  return (
    <div className="blaze-theme-scope min-h-full bg-background">
      <div className="mx-auto w-full px-4 py-6 sm:px-6 lg:px-8 max-w-[1600px]">
        <div className="space-y-6">
      <PageHeader
        eyebrow="Admin Overview"
        title="Operations Command"
        description={`${periodLabel} performance across your marketplace`}
        actions={
          <>
            {isLoading && (
              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm">
                <span className="h-2 w-2 animate-ping rounded-full bg-primary/70" />
                Updating metrics…
              </span>
            )}
            <Select value={selectedZone} onValueChange={setSelectedZone}>
              <SelectTrigger className="h-10 min-w-[160px] rounded-xl border-border bg-card text-foreground shadow-sm">
                <SelectValue placeholder="All zones" />
              </SelectTrigger>
              <SelectContent className="border-border bg-card text-foreground">
                <SelectItem value="all">All zones</SelectItem>
                {zones.map((zone) => (
                  <SelectItem key={zone._id} value={zone._id}>
                    {zone.zoneName || zone.name || "Unnamed Zone"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="h-10 min-w-[140px] rounded-xl border-border bg-card text-foreground shadow-sm">
                <SelectValue placeholder="Overall" />
              </SelectTrigger>
              <SelectContent className="border-border bg-card text-foreground">
                <SelectItem value="overall">Overall</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">This week</SelectItem>
                <SelectItem value="month">This month</SelectItem>
                <SelectItem value="year">This year</SelectItem>
              </SelectContent>
            </Select>
          </>
        }
      />

      {/* KPI grid */}
      {showInitialSkeleton ? (
        <KpiGridSkeleton count={8} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Gross revenue"
            value={formatCurrency(revenueTotal)}
            helper={`${periodLabel} transaction volume`}
            icon={<ShoppingBag className="h-5 w-5" />}
            to="/admin/food/transaction-report"
            canAccess={canAccessPath}
          />
          <StatCard
            title="Orders processed"
            value={activeOrdersTotal.toLocaleString("en-IN")}
            helper="Orders currently being processed"
            icon={<Activity className="h-5 w-5" />}
            to="/admin/food/orders/processing"
            canAccess={canAccessPath}
          />
          <StatCard
            title="Platform fee"
            value={formatCurrency(platformFeeTotal)}
            helper={`Platform service fees: ${periodLabel}`}
            icon={<CreditCard className="h-5 w-5" />}
            to="/admin/food/fee-settings"
            canAccess={canAccessPath}
          />
          <StatCard
            title="Delivery fee"
            value={formatCurrency(deliveryFeeTotal)}
            helper={`Total delivery fees: ${periodLabel}`}
            icon={<Truck className="h-5 w-5" />}
            to="/admin/food/transaction-report"
            canAccess={canAccessPath}
          />
          <StatCard
            title="GST"
            value={formatCurrency(gstTotal)}
            helper={`Total tax collected: ${periodLabel}`}
            icon={<Receipt className="h-5 w-5" />}
            to="/admin/food/tax-report"
            canAccess={canAccessPath}
          />
          <StatCard
            title="Platform Total"
            value={formatCurrency(totalAdminEarnings, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            helper={totalRevenueHelper}
            icon={<IndianRupee className="h-5 w-5" />}
            to="/admin/food/transaction-report"
            canAccess={canAccessPath}
          />
          <StatCard
            title="Total restaurants"
            value={totalRestaurants.toLocaleString("en-IN")}
            helper="Approved restaurants"
            icon={<Store className="h-5 w-5" />}
            to="/admin/food/restaurants"
            canAccess={canAccessPath}
          />
          <StatCard
            title="Restaurant request pending"
            value={pendingRestaurantRequests.toLocaleString("en-IN")}
            helper="Awaiting approval"
            icon={<UserCheck className="h-5 w-5" />}
            to="/admin/food/restaurants/joining-request"
            canAccess={canAccessPath}
          />
          <StatCard
            title="Total delivery boy"
            value={totalDeliveryBoys.toLocaleString("en-IN")}
            helper="Approved delivery partners"
            icon={<Truck className="h-5 w-5" />}
            to="/admin/food/delivery-partners"
            canAccess={canAccessPath}
          />
          <StatCard
            title="Delivery boy request pending"
            value={pendingDeliveryBoyRequests.toLocaleString("en-IN")}
            helper="Awaiting verification"
            icon={<Clock className="h-5 w-5" />}
            to="/admin/food/delivery-partners/join-request"
            canAccess={canAccessPath}
          />
          <StatCard
            title="Total foods"
            value={totalFoods.toLocaleString("en-IN")}
            helper="Approved menu items"
            icon={<Package className="h-5 w-5" />}
            to="/admin/food/foods"
            canAccess={canAccessPath}
          />
          <StatCard
            title="Total addons"
            value={totalAddons.toLocaleString("en-IN")}
            helper="Approved addon items"
            icon={<Plus className="h-5 w-5" />}
            to="/admin/food/addons"
            canAccess={canAccessPath}
          />
          <StatCard
            title="Total customers"
            value={totalCustomers.toLocaleString("en-IN")}
            helper="Registered users"
            icon={<UserCircle className="h-5 w-5" />}
            to="/admin/food/customers"
            canAccess={canAccessPath}
          />
          <StatCard
            title="Pending orders"
            value={pendingOrders.toLocaleString("en-IN")}
            helper="Orders awaiting processing"
            icon={<Clock className="h-5 w-5" />}
            to="/admin/food/orders/pending"
            canAccess={canAccessPath}
          />
          <StatCard
            title="Completed orders"
            value={completedOrders.toLocaleString("en-IN")}
            helper="Successfully delivered"
            icon={<CheckCircle className="h-5 w-5" />}
            to="/admin/food/orders/delivered"
            canAccess={canAccessPath}
          />
        </div>
      )}

      {/* Revenue + order mix */}
      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard
          className="lg:col-span-2"
          title="Revenue trajectory"
          subtitle="Commission and gross revenue with monthly order volume"
        >
          <div className="h-80 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <AreaChart data={monthlyData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <defs>
                  <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={BLAZE_CHART.primary} stopOpacity={0.22} />
                    <stop offset="95%" stopColor={BLAZE_CHART.primary} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" stroke={BLAZE_CHART.grid} vertical={false} />
                <XAxis dataKey="month" stroke={BLAZE_CHART.axis} tickLine={false} axisLine={false} fontSize={12} />
                <YAxis stroke={BLAZE_CHART.axis} tickLine={false} axisLine={false} fontSize={12} width={48} />
                <Tooltip
                  cursor={BLAZE_CHART.tooltip.cursor}
                  contentStyle={BLAZE_CHART.tooltip.contentStyle}
                  labelStyle={BLAZE_CHART.tooltip.labelStyle}
                  itemStyle={BLAZE_CHART.tooltip.itemStyle}
                />
                <Legend iconType="circle" formatter={legendFormatter} />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke={BLAZE_CHART.primary}
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#revFill)"
                  name="Gross revenue"
                />
                <Bar
                  dataKey="orders"
                  fill={BLAZE_CHART.info}
                  radius={[6, 6, 0, 0]}
                  name="Orders"
                  barSize={10}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard
          title="Order mix"
          subtitle="Distribution by state"
          action={
            <span className="shrink-0 rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">
              {orderStats.reduce((s, o) => s + o.value, 0)} orders
            </span>
          }
        >
          <div className="h-72 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={4}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={index} fill={entry.fill} stroke="none" />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={BLAZE_CHART.tooltip.contentStyle}
                  labelStyle={BLAZE_CHART.tooltip.labelStyle}
                  itemStyle={BLAZE_CHART.tooltip.itemStyle}
                />
                <Legend iconType="circle" formatter={legendFormatter} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {orderStats.map((item) => (
              <div
                key={item.label}
                onClick={() => navigate(orderRoutes[item.label] || "/admin/food/orders/all")}
                className="group flex cursor-pointer items-center justify-between rounded-xl border border-border bg-card px-3 py-2 transition-all hover:border-primary/30 hover:bg-secondary/60"
              >
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full transition-transform group-hover:scale-125" style={{ background: item.color }} />
                  <p className="text-sm text-foreground">{item.label}</p>
                </div>
                <p className="text-sm font-semibold text-foreground">{item.value}</p>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      {/* Momentum + live signals + order states */}
      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard
          title="Momentum snapshot"
          action={<span className="text-xs text-muted-foreground">Summary: {ordersTotal} Orders</span>}
        >
          <div className="h-64 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart data={monthlyData.slice(-6)} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="4 4" stroke={BLAZE_CHART.grid} vertical={false} />
                <XAxis dataKey="month" stroke={BLAZE_CHART.axis} tickLine={false} axisLine={false} fontSize={12} />
                <YAxis stroke={BLAZE_CHART.axis} tickLine={false} axisLine={false} fontSize={12} width={40} />
                <Tooltip
                  cursor={BLAZE_CHART.tooltip.cursor}
                  contentStyle={BLAZE_CHART.tooltip.contentStyle}
                  labelStyle={BLAZE_CHART.tooltip.labelStyle}
                  itemStyle={BLAZE_CHART.tooltip.itemStyle}
                />
                <Legend iconType="circle" formatter={legendFormatter} />
                <Bar dataKey="orders" fill={BLAZE_CHART.primary} radius={[8, 8, 0, 0]} name="Orders" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard title="Live signals" subtitle="Ops notes and service health" flush>
          <div className="blaze-scroll h-[300px] space-y-3 overflow-y-auto p-5">
            {activityFeed.length === 0 ? (
              <EmptyState
                icon={<Activity className="h-10 w-10" />}
                title="No recent signals"
                description="Live operational updates will appear here as they happen."
              />
            ) : (
              activityFeed.map((item, idx) => {
                const getIcon = (type) => {
                  switch (type) {
                    case "order_pending":
                      return <Clock className="h-4 w-4 text-[var(--blaze-warning)]" />
                    case "order_delivered":
                      return <CheckCircle className="h-4 w-4 text-[var(--blaze-success)]" />
                    case "order_cancelled":
                      return <XCircle className="h-4 w-4 text-[var(--blaze-danger)]" />
                    case "restaurant":
                      return <Store className="h-4 w-4 text-[var(--blaze-info)]" />
                    case "delivery":
                      return <Truck className="h-4 w-4 text-primary" />
                    case "customer":
                      return <UserCircle className="h-4 w-4 text-[var(--blaze-info)]" />
                    default:
                      return <Activity className="h-4 w-4 text-muted-foreground" />
                  }
                }

                return (
                  <div
                    key={idx}
                    className="flex items-start gap-3 rounded-xl border border-border bg-card px-3 py-3 transition-all hover:border-primary/30 hover:bg-secondary/50"
                  >
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                      {getIcon(item.type)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-foreground">{item.title}</p>
                        <span className="whitespace-nowrap text-[10px] text-muted-foreground">{item.time}</span>
                      </div>
                      <p className="line-clamp-1 text-xs text-muted-foreground">{item.detail}</p>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </SectionCard>

        <SectionCard title="Order states" subtitle="Quick glance by status">
          <div className="grid gap-3">
            {orderStats.map((item) => (
              <div
                key={item.label}
                onClick={() => navigate(orderRoutes[item.label] || "/admin/food/orders/all")}
                className="group flex cursor-pointer items-center justify-between rounded-xl border border-border bg-card px-3 py-3 transition-all hover:border-primary/30 hover:bg-secondary/50"
              >
                <div className="flex items-center gap-3">
                  <span
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-sm font-semibold transition-transform group-hover:scale-110"
                    style={{ background: `${item.color}1A`, color: item.color }}
                  >
                    {item.label.slice(0, 2).toUpperCase()}
                  </span>
                  <div>
                    <p className="text-sm text-foreground group-hover:font-medium">{item.label}</p>
                    <p className="text-xs text-muted-foreground">Tracked in {selectedPeriod}</p>
                  </div>
                </div>
                <p className="text-sm font-semibold text-foreground">{item.value}</p>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
        </div>
      </div>
    </div>
  )
}

function legendFormatter(value) {
  return <span style={{ color: "#1A1A1A", fontSize: 12 }}>{value}</span>
}
