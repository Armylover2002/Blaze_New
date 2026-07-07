import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Search, Wallet as WalletIcon, IndianRupee, TrendingUp, Loader2, RefreshCw, Clock,
} from "lucide-react";
import {
  PageHeader, SectionCard, StatCard, AdminTable, FilterBar, StatusBadge,
} from "@/shared/components/admin";
import Input from "@/shared/components/ui/Input";
import Button from "@/shared/components/ui/Button";
import porterAdminApi from "../services/adminApi";
import { filterBySearch, sortItems, paginateItems, formatCurrency, formatDateTime } from "../utils/porterTableHelpers";

const EMPTY_SUMMARY = { availableBalance: 0, todayEarnings: 0, totalEarnings: 0, pendingSettlement: 0, totalDrivers: 0 };

const Wallet = () => {
  const [wallets, setWallets] = useState([]);
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortKey, setSortKey] = useState("walletBalance");
  const [sortDir, setSortDir] = useState("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const loadWallets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await porterAdminApi.getWallets();
      setWallets(Array.isArray(data?.records) ? data.records : []);
      setSummary({ ...EMPTY_SUMMARY, ...(data?.summary || {}) });
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load wallet data");
      setWallets([]);
      setSummary(EMPTY_SUMMARY);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadWallets(); }, [loadWallets]);

  const filtered = useMemo(() => {
    let rows = filterBySearch(wallets, search, ["driverName", "driverId", "vehicle"]);
    if (statusFilter !== "all") rows = rows.filter((r) => r.status === statusFilter);
    return sortItems(rows, sortKey, sortDir, {
      walletBalance: (r) => r.walletBalance,
      todayEarnings: (r) => r.todayEarnings,
      pending: (r) => r.pending,
      completed: (r) => r.completed,
    });
  }, [wallets, search, statusFilter, sortKey, sortDir]);

  const { items: pageItems, total, totalPages } = useMemo(
    () => paginateItems(filtered, page, pageSize),
    [filtered, page, pageSize]
  );

  const columns = [
    {
      key: "driverName", header: "Driver",
      cell: (row) => (
        <div className="flex items-center gap-3">
          {row.photo ? (
            <img src={row.photo} alt={row.driverName} className="h-9 w-9 rounded-full border object-cover" />
          ) : (
            <div className="h-9 w-9 rounded-full border bg-red-50 text-red-600 flex items-center justify-center text-sm font-bold">
              {String(row.driverName || "?").charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <p className="font-semibold text-sm">{row.driverName}</p>
            <p className="text-xs text-muted-foreground">{row.vehicle}</p>
          </div>
        </div>
      ),
    },
    { key: "walletBalance", header: "Wallet", cell: (row) => <span className="font-semibold">{formatCurrency(row.walletBalance)}</span> },
    { key: "todayEarnings", header: "Today", cell: (row) => formatCurrency(row.todayEarnings) },
    { key: "totalTrips", header: "Trips", cell: (row) => <span className="text-sm">{row.totalTrips ?? 0}</span> },
    { key: "pending", header: "Cash in Hand", cell: (row) => <span className={row.pending > 0 ? "text-amber-600 font-medium" : "text-muted-foreground"}>{formatCurrency(row.pending)}</span> },
    { key: "completed", header: "Total Earned", cell: (row) => formatCurrency(row.completed) },
    { key: "lastSettlement", header: "Last Settlement", cell: (row) => <span className="text-xs text-muted-foreground">{row.lastSettlement ? formatDateTime(row.lastSettlement) : "—"}</span> },
    { key: "status", header: "Status", cell: (row) => <StatusBadge status={row.status} /> },
  ];

  const selectCls = "h-10 px-3 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:border-red-500 focus:ring-4 focus:ring-red-500/10";

  return (
    <div className="blaze-theme-scope space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24">
      <PageHeader
        title="Wallet"
        description="Driver earnings, wallet balances and cash-in-hand settlements"
        actions={
          <Button variant="outline" size="sm" className="gap-2" onClick={loadWallets} disabled={loading}>
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard title="Wallet Balance (All Drivers)" value={formatCurrency(summary.availableBalance)} icon={<WalletIcon size={18} />} />
        <StatCard title="Today's Earnings" value={formatCurrency(summary.todayEarnings)} icon={<TrendingUp size={18} />} />
        <StatCard title="Total Earnings" value={formatCurrency(summary.totalEarnings)} icon={<IndianRupee size={18} />} />
        <StatCard title="Cash Pending Settlement" value={formatCurrency(summary.pendingSettlement)} icon={<Clock size={18} />} />
      </div>

      <SectionCard title={`Driver Wallets${summary.totalDrivers ? ` (${summary.totalDrivers})` : ""}`} flush>
        <div className="p-4 space-y-4">
          <FilterBar
            start={
              <>
                <div className="relative min-w-[220px] flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input className="pl-9" placeholder="Search drivers..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
                </div>
                <select className={selectCls + " w-auto"} value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
                  <option value="all">All Status</option>
                  <option value="pending">Cash Pending</option>
                  <option value="settled">Settled</option>
                </select>
                <select className={selectCls + " w-auto"} value={`${sortKey}:${sortDir}`} onChange={(e) => { const [k, d] = e.target.value.split(":"); setSortKey(k); setSortDir(d); }}>
                  <option value="walletBalance:desc">Balance (High-Low)</option>
                  <option value="walletBalance:asc">Balance (Low-High)</option>
                  <option value="completed:desc">Total Earned (High-Low)</option>
                  <option value="pending:desc">Cash in Hand (High-Low)</option>
                  <option value="todayEarnings:desc">Today (High-Low)</option>
                </select>
              </>
            }
          />

          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading driver wallets…
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-sm text-red-600">{error}</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={loadWallets}>Retry</Button>
            </div>
          ) : (
            <AdminTable columns={columns} data={pageItems} getRowId={(r) => r.id}
              emptyState={{ title: "No driver earnings yet", description: "Driver wallets appear here once Porter deliveries are completed." }}
              pagination={{ page, totalPages, total, pageSize, onPageChange: setPage, onPageSizeChange: (s) => { setPageSize(s); setPage(1); } }}
            />
          )}
        </div>
      </SectionCard>
    </div>
  );
};

export default Wallet;
