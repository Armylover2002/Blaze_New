import React, { useMemo, useState } from "react";
import {
  Search, Wallet as WalletIcon, IndianRupee, Clock, TrendingUp, Send, Loader2, History,
} from "lucide-react";
import {
  PageHeader, SectionCard, StatCard, AdminTable, FilterBar,
  FormLayout, FormSection, FormRow, FormField, StatusBadge,
} from "@/shared/components/admin";
import Button from "@/shared/components/ui/Button";
import Input from "@/shared/components/ui/Input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MOCK_WALLETS, MOCK_WALLET_SUMMARY } from "../utils/mock/wallets";
import { filterBySearch, sortItems, paginateItems, formatCurrency, formatDateTime } from "../utils/porterTableHelpers";

const Wallet = () => {
  const [wallets, setWallets] = useState(MOCK_WALLETS);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortKey, setSortKey] = useState("walletBalance");
  const [sortDir, setSortDir] = useState("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const filtered = useMemo(() => {
    let rows = filterBySearch(wallets, search, ["driverName", "driverId", "vehicle"]);
    if (statusFilter !== "all") rows = rows.filter((r) => r.status === statusFilter);
    return sortItems(rows, sortKey, sortDir, {
      walletBalance: (r) => r.walletBalance,
      todayEarnings: (r) => r.todayEarnings,
      pending: (r) => r.pending,
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
          <img src={row.photo} alt={row.driverName} className="h-9 w-9 rounded-full border object-cover" />
          <div>
            <p className="font-semibold text-sm">{row.driverName}</p>
            <p className="text-xs text-muted-foreground">{row.vehicle}</p>
          </div>
        </div>
      ),
    },
    { key: "walletBalance", header: "Wallet", cell: (row) => <span className="font-semibold">{formatCurrency(row.walletBalance)}</span> },
    { key: "todayEarnings", header: "Today", cell: (row) => formatCurrency(row.todayEarnings) },
    { key: "pending", header: "Pending", cell: (row) => <span className={row.pending > 0 ? "text-amber-600 font-medium" : ""}>{formatCurrency(row.pending)}</span> },
    { key: "completed", header: "Completed", cell: (row) => formatCurrency(row.completed) },
    { key: "lastSettlement", header: "Last Settlement", cell: (row) => <span className="text-xs text-muted-foreground">{formatDateTime(row.lastSettlement)}</span> },
    { key: "status", header: "Status", cell: (row) => <StatusBadge status={row.status} /> },
  ];

  const historyColumns = [];
  const selectCls = "h-10 px-3 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:border-red-500 focus:ring-4 focus:ring-red-500/10";

  return (
    <div className="blaze-theme-scope space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24">
      <PageHeader title="Wallet" description="Manage driver earnings and settlements" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard title="Available Balance" value={formatCurrency(MOCK_WALLET_SUMMARY.availableBalance)} icon={<WalletIcon size={18} />} />
        <StatCard title="Today's Earnings" value={formatCurrency(MOCK_WALLET_SUMMARY.todayEarnings)} icon={<TrendingUp size={18} />} trend="+8%" trendDirection="up" />
        <StatCard title="Total Earnings" value={formatCurrency(MOCK_WALLET_SUMMARY.totalEarnings)} icon={<IndianRupee size={18} />} />
      </div>

      <SectionCard title="Driver Wallets" flush>
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
                  <option value="pending">Pending</option>
                  <option value="settled">Settled</option>
                </select>
                <select className={selectCls + " w-auto"} value={`${sortKey}:${sortDir}`} onChange={(e) => { const [k, d] = e.target.value.split(":"); setSortKey(k); setSortDir(d); }}>
                  <option value="walletBalance:desc">Balance (High-Low)</option>
                  <option value="walletBalance:asc">Balance (Low-High)</option>
                  <option value="pending:desc">Pending (High-Low)</option>
                  <option value="todayEarnings:desc">Today (High-Low)</option>
                </select>
              </>
            }
          />
          <AdminTable columns={columns} data={pageItems} getRowId={(r) => r.id}
            pagination={{ page, totalPages, total, pageSize, onPageChange: setPage, onPageSizeChange: (s) => { setPageSize(s); setPage(1); } }}
          />
        </div>
      </SectionCard>


    </div>
  );
};

export default Wallet;
