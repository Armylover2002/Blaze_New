import React, { useMemo, useState, useEffect, useCallback } from "react";
import {
  Search, Users as UsersIcon, Eye, Star, Phone, Mail, MapPin,
  Wallet, Package, CheckCircle2, XCircle, ArrowUpDown, Loader2, User,
} from "lucide-react";
import {
  PageHeader, SectionCard, StatCard, AdminTable, FilterBar,
  FormLayout, FormSection, FormRow, FormField, StatusBadge,
} from "@/shared/components/admin";
import Button from "@/shared/components/ui/Button";
import Input from "@/shared/components/ui/Input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import porterAdminApi from "../services/adminApi";
import { formatCurrency, formatDateTime } from "../utils/porterTableHelpers";

import { toast } from "sonner";

const Users = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [cityFilter, setCityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [verifyFilter, setVerifyFilter] = useState("all");
  const [sortKey, setSortKey] = useState("name");
  const [sortDir, setSortDir] = useState("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const cities = useMemo(() => [...new Set(users.map((u) => u.city).filter(Boolean))], [users]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const result = await porterAdminApi.getUsers({
        page,
        limit: pageSize,
        search: search.trim() || undefined,
        status: statusFilter !== "all" ? statusFilter : undefined,
        verification: verifyFilter !== "all" ? verifyFilter : undefined,
        sortBy: sortKey,
        sortOrder: sortDir,
      });
      setUsers(result.records || []);
      setTotal(result.total || 0);
      setTotalPages(result.pages || 1);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, statusFilter, verifyFilter, sortKey, sortDir]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const pageItems = users;

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  const openDetail = async (row) => { 
    setSelected(row);
    setDetailOpen(true); 
    
    // Fetch full user details to get recent orders and latest wallet balance
    setLoadingDetail(true);
    try {
      const fullUser = await porterAdminApi.getUserById(row.id);
      setSelected(fullUser);
    } catch (err) {
      toast.error("Failed to load user details");
    } finally {
      setLoadingDetail(false);
    }
  };

  const sortableHeader = (label, key) => (
    <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleSort(key)}>
      {label} <ArrowUpDown size={12} />
    </button>
  );

  const columns = [
    {
      key: "name", header: sortableHeader("Customer", "name"),
      cell: (row) => (
        <div className="flex items-center gap-3">
          {row.avatar ? (
            <img src={row.avatar} alt={row.name} className="h-10 w-10 rounded-full border bg-muted object-cover" />
          ) : (
            <div className="h-10 w-10 rounded-full border bg-muted flex items-center justify-center text-muted-foreground"><User size={20} /></div>
          )}
          <div>
            <p className="font-semibold text-sm">{row.name}</p>
          </div>
        </div>
      ),
    },
    { key: "phone", header: "Phone", cell: (row) => <span className="text-sm">{row.phone}</span> },
    { key: "totalOrders", header: sortableHeader("Orders", "totalOrders"), cell: (row) => String(row.totalOrders) },
    { key: "walletBalance", header: sortableHeader("Wallet", "walletBalance"), cell: (row) => formatCurrency(row.walletBalance) },
    { key: "verification", header: "Verified", cell: (row) => <StatusBadge status={row.verification === "verified" ? "success" : "warning"} label={row.verification} /> },
    { key: "status", header: "Status", cell: (row) => <StatusBadge status={row.status} /> },
    {
      key: "actions", header: "Actions", align: "right",
      cell: (row) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => openDetail(row)}><Eye size={14} /></Button>
        </div>
      ),
    },
  ];

  const selectCls = "h-10 px-3 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:border-red-500 focus:ring-4 focus:ring-red-500/10";

  return (
    <div className="blaze-theme-scope space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24">
      <PageHeader title="Customers" description="Manage logistics customers, activity and account status" />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard title="Total Customers" value={String(users.length)} icon={<UsersIcon size={18} />} />
        <StatCard title="Active" value={String(users.filter((u) => u.status === "active").length)} />
        <StatCard title="Verified" value={String(users.filter((u) => u.verification === "verified").length)} />
      </div>

      <SectionCard flush>
        <div className="p-4 space-y-4">
          <FilterBar
            start={
              <div className="flex flex-wrap gap-2 w-full">
                <div className="relative min-w-[220px] flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input className="pl-9" placeholder="Search customers..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
                </div>
                <select className={selectCls} value={verifyFilter} onChange={(e) => { setVerifyFilter(e.target.value); setPage(1); }}>
                  <option value="all">All Verification</option>
                  <option value="verified">Verified</option>
                  <option value="pending">Pending</option>
                </select>
                <select className={selectCls} value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            }
          />
          <AdminTable columns={columns} data={pageItems} getRowId={(r) => r.id} loading={loading}
            pagination={{ page, totalPages, total, pageSize, onPageChange: setPage, onPageSizeChange: (s) => { setPageSize(s); setPage(1); } }}
          />
        </div>
      </SectionCard>

      {/* Details Drawer */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="blaze-theme-scope sm:max-w-[560px] p-0">
          <DialogHeader className="px-6 py-4 border-b"><DialogTitle>Customer Profile</DialogTitle></DialogHeader>
          <div className="px-6 py-4 max-h-[85vh] overflow-y-auto">
            {selected && (
              <FormLayout>
                <div className="flex items-center gap-4 mb-2">
                  {selected.avatar ? (
                    <img src={selected.avatar} alt={selected.name} className="h-16 w-16 rounded-full border bg-muted object-cover" />
                  ) : (
                    <div className="h-16 w-16 rounded-full border bg-muted flex items-center justify-center text-muted-foreground"><User size={32} /></div>
                  )}
                  <div>
                    <h3 className="font-bold text-lg">{selected.name}</h3>
                    <div className="flex gap-2 mt-1">
                      <StatusBadge status={selected.status} />
                      <StatusBadge status={selected.verification === "verified" ? "success" : "warning"} label={selected.verification} />
                    </div>
                  </div>
                </div>

                <FormSection title="Contact Info">
                  <FormRow>
                    <FormField label="Phone"><div className="text-sm font-medium flex items-center gap-2"><Phone size={14} className="text-muted-foreground"/> {selected.phone}</div></FormField>
                    <FormField label="Email"><div className="text-sm font-medium flex items-center gap-2"><Mail size={14} className="text-muted-foreground"/> {selected.email}</div></FormField>
                  </FormRow>
                  <FormField label="Address"><div className="text-sm font-medium flex items-center gap-2"><MapPin size={14} className="text-muted-foreground"/> {selected.address}</div></FormField>
                  <FormRow>
                    <FormField label="Wallet">
                      <div className="flex items-center gap-3">
                        <div className="text-sm font-medium flex items-center gap-2 text-emerald-600">
                          <Wallet size={14}/> {formatCurrency(selected.walletBalance)}
                        </div>
                      </div>
                    </FormField>
                  </FormRow>
                </FormSection>

                <FormSection title="Activity Summary">
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="rounded-lg border p-3 text-center bg-gray-50/50">
                      <Package size={16} className="mx-auto text-primary" />
                      <p className="text-lg font-bold mt-1">{selected.totalOrders}</p>
                      <p className="text-xs text-muted-foreground">Total Orders</p>
                    </div>
                    <div className="rounded-lg border p-3 text-center bg-gray-50/50">
                      <CheckCircle2 size={16} className="mx-auto text-green-600" />
                      <p className="text-lg font-bold mt-1">{selected.completedOrders}</p>
                      <p className="text-xs text-muted-foreground">Completed</p>
                    </div>
                    <div className="rounded-lg border p-3 text-center bg-gray-50/50">
                      <XCircle size={16} className="mx-auto text-red-500" />
                      <p className="text-lg font-bold mt-1">{selected.cancelledOrders}</p>
                      <p className="text-xs text-muted-foreground">Cancelled</p>
                    </div>
                  </div>

                  <h4 className="font-semibold text-sm mb-2 text-gray-700">Recent Orders</h4>
                  <div className="space-y-2">
                    {loadingDetail ? (
                      <div className="flex justify-center p-4"><Loader2 className="animate-spin text-muted-foreground" size={20} /></div>
                    ) : selected.recentOrders && selected.recentOrders.length > 0 ? (
                      selected.recentOrders.map((o) => (
                        <div key={o.id} className="flex items-center justify-between rounded-lg border p-2.5 text-sm bg-gray-50/30">
                          <div>
                            <span className="font-medium text-gray-900">{o.id}</span>
                            <span className="text-muted-foreground"> · {o.goodsType}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{formatCurrency(o.amount)}</span>
                            <StatusBadge status={o.status} label={o.status.replace("_", " ")} />
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-muted-foreground text-center py-2 border rounded-lg bg-gray-50/30">No recent orders</div>
                    )}
                  </div>
                </FormSection>
                <div className="pt-2 text-xs text-muted-foreground text-center">Registered on {formatDateTime(selected.registeredAt)}</div>
              </FormLayout>
            )}
          </div>
        </DialogContent>
      </Dialog>


    </div>
  );
};

export default Users;
