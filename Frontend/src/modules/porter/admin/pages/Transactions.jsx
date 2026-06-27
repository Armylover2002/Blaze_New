import React, { useMemo, useState } from "react";
import {
  Search, Download, IndianRupee, Percent, Receipt, FileText, Eye, Wallet,
} from "lucide-react";
import {
  PageHeader, SectionCard, StatCard, AdminTable, FilterBar, StatusBadge,
  FormLayout, FormSection, FormRow, FormField,
} from "@/shared/components/admin";
import Button from "@/shared/components/ui/Button";
import Input from "@/shared/components/ui/Input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MOCK_TRANSACTIONS, MOCK_TXN_SUMMARY, PAYMENT_METHODS, TXN_STATUSES } from "../utils/mock/transactions";
import { filterBySearch, sortItems, paginateItems, formatCurrency, formatDateTime } from "../utils/porterTableHelpers";

const Transactions = () => {
  const [txns] = useState(MOCK_TRANSACTIONS);
  const [search, setSearch] = useState("");
  const [methodFilter, setMethodFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  const filtered = useMemo(() => {
    let rows = filterBySearch(txns, search, ["id", "orderId", "driverName", "customer"]);
    if (methodFilter !== "all") rows = rows.filter((r) => r.paymentMethod === methodFilter);
    if (statusFilter !== "all") rows = rows.filter((r) => r.status === statusFilter);
    if (dateFrom) rows = rows.filter((r) => new Date(r.createdAt) >= new Date(dateFrom));
    if (dateTo) rows = rows.filter((r) => new Date(r.createdAt) <= new Date(dateTo + "T23:59:59"));
    return sortItems(rows, "createdAt", "desc");
  }, [txns, search, methodFilter, statusFilter, dateFrom, dateTo]);

  const { items: pageItems, total, totalPages } = useMemo(
    () => paginateItems(filtered, page, pageSize),
    [filtered, page, pageSize]
  );

  const exportCsv = () => {
    const headers = ["Transaction ID", "Order ID", "Driver", "Customer", "Amount", "Commission", "Tax", "Net Payout", "Method", "Gateway", "Status", "Created"];
    const rows = filtered.map((t) => [t.id, t.orderId, t.driverName, t.customer, t.amount, t.commission, t.tax, t.netPayout, t.paymentMethod, t.gateway, t.status, formatDateTime(t.createdAt)]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "porter-transactions.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const openDetail = (row) => { setSelected(row); setDetailOpen(true); };

  const columns = [
    { key: "id", header: "Transaction ID", cell: (row) => <span className="font-semibold">{row.id}</span> },
    { key: "orderId", header: "Order ID" },
    { key: "driverName", header: "Driver" },
    { key: "customer", header: "Customer" },
    { key: "amount", header: "Amount", cell: (row) => <span className="font-medium">{formatCurrency(row.amount)}</span> },
    { key: "commission", header: "Commission", cell: (row) => formatCurrency(row.commission) },
    { key: "tax", header: "Tax", cell: (row) => formatCurrency(row.tax) },
    { key: "paymentMethod", header: "Method" },
    { key: "gateway", header: "Gateway", cell: (row) => <span className="text-sm text-muted-foreground">{row.gateway}</span> },
    { key: "status", header: "Status", cell: (row) => <StatusBadge status={row.status} /> },
    { key: "createdAt", header: "Created", cell: (row) => <span className="text-xs text-muted-foreground">{formatDateTime(row.createdAt)}</span> },
    {
      key: "actions", header: "Actions", align: "right",
      cell: (row) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => openDetail(row)}><Eye size={14} /></Button>
          <Button variant="ghost" size="sm" onClick={() => window.print()}><FileText size={14} /></Button>
        </div>
      ),
    },
  ];

  const selectCls = "h-10 px-3 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:border-red-500 focus:ring-4 focus:ring-red-500/10";

  return (
    <div className="blaze-theme-scope space-y-6 max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24">
      <PageHeader
        title="Transactions"
        description="Financial transactions, commissions and gateway settlements"
        actions={<Button onClick={exportCsv} className="gap-2"><Download size={16} /> Export</Button>}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Gross Revenue" value={formatCurrency(MOCK_TXN_SUMMARY.grossRevenue)} icon={<IndianRupee size={18} />} />
        <StatCard title="Total Commission" value={formatCurrency(MOCK_TXN_SUMMARY.totalCommission)} icon={<Percent size={18} />} />
        <StatCard title="Total Tax" value={formatCurrency(MOCK_TXN_SUMMARY.totalTax)} icon={<Receipt size={18} />} />
        <StatCard title="Net Payout" value={formatCurrency(MOCK_TXN_SUMMARY.netPayout)} icon={<Wallet size={18} />} />
      </div>

      <SectionCard flush>
        <div className="p-4 space-y-4">
          <FilterBar
            start={
              <div className="flex flex-wrap gap-2 w-full">
                <div className="relative min-w-[200px] flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input className="pl-9" placeholder="Search transactions..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
                </div>
                <select className={selectCls} value={methodFilter} onChange={(e) => { setMethodFilter(e.target.value); setPage(1); }}>
                  <option value="all">All Methods</option>
                  {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
                <select className={selectCls} value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
                  <option value="all">All Status</option>
                  {TXN_STATUSES.map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}
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

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="blaze-theme-scope sm:max-w-[500px] p-0">
          <DialogHeader className="px-6 py-4 border-b"><DialogTitle>Transaction {selected?.id}</DialogTitle></DialogHeader>
          <div className="px-6 py-4 max-h-[85vh] overflow-y-auto">
            {selected && (
              <FormLayout>
                <div className="flex items-center justify-between mb-2">
                  <StatusBadge status={selected.status} />
                  <span className="text-sm text-muted-foreground">{formatDateTime(selected.createdAt)}</span>
                </div>
                
                <FormSection title="Transaction Details">
                  <FormRow>
                    <FormField label="Order ID"><div className="text-sm font-medium">{selected.orderId}</div></FormField>
                    <FormField label="Customer"><div className="text-sm font-medium">{selected.customer}</div></FormField>
                  </FormRow>
                  <FormRow>
                    <FormField label="Driver"><div className="text-sm font-medium">{selected.driverName}</div></FormField>
                    <FormField label="Gateway"><div className="text-sm font-medium">{selected.gateway}</div></FormField>
                  </FormRow>
                  <FormField label="Payment Method"><div className="text-sm font-medium">{selected.paymentMethod}</div></FormField>
                </FormSection>
                
                <FormSection title="Financial Breakdown">
                  <div className="rounded-lg bg-gray-50/50 p-4 space-y-3 text-sm border">
                    <div className="flex justify-between"><span>Gross Amount</span><span className="font-medium">{formatCurrency(selected.amount)}</span></div>
                    <div className="flex justify-between text-muted-foreground"><span>Commission</span><span>- {formatCurrency(selected.commission)}</span></div>
                    <div className="flex justify-between text-muted-foreground"><span>Tax</span><span>- {formatCurrency(selected.tax)}</span></div>
                    <div className="flex justify-between font-bold border-t pt-3 mt-1 text-emerald-600"><span>Net Payout</span><span>{formatCurrency(selected.netPayout)}</span></div>
                  </div>
                </FormSection>
              </FormLayout>
            )}
          </div>
          <div className="px-6 py-4 border-t bg-gray-50/50">
            <Button variant="outline" className="w-full gap-2" onClick={() => window.print()}><FileText size={14} /> Download Invoice</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Transactions;
