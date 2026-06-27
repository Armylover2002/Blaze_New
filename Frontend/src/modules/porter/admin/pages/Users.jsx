import React, { useMemo, useState } from "react";
import {
  Search, Users as UsersIcon, Eye, Pencil, Trash2, Star, Phone, Mail, MapPin,
  Wallet, Package, CheckCircle2, XCircle, ArrowUpDown, Loader2,
} from "lucide-react";
import {
  PageHeader, SectionCard, StatCard, AdminTable, FilterBar,
  FormLayout, FormSection, FormRow, FormField, StatusBadge,
} from "@/shared/components/admin";
import Button from "@/shared/components/ui/Button";
import Input from "@/shared/components/ui/Input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MOCK_USERS } from "../utils/mock/users";
import { filterBySearch, sortItems, paginateItems, formatCurrency, formatDateTime } from "../utils/porterTableHelpers";

const Users = () => {
  const [users, setUsers] = useState(MOCK_USERS);
  const [search, setSearch] = useState("");
  const [cityFilter, setCityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [verifyFilter, setVerifyFilter] = useState("all");
  const [sortKey, setSortKey] = useState("name");
  const [sortDir, setSortDir] = useState("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({});
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const cities = useMemo(() => [...new Set(users.map((u) => u.city))], [users]);

  const filtered = useMemo(() => {
    let rows = filterBySearch(users, search, ["id", "name", "email", "phone", "city", "zone"]);
    if (cityFilter !== "all") rows = rows.filter((r) => r.city === cityFilter);
    if (statusFilter !== "all") rows = rows.filter((r) => r.status === statusFilter);
    if (verifyFilter !== "all") rows = rows.filter((r) => r.verification === verifyFilter);
    return sortItems(rows, sortKey, sortDir, {
      totalOrders: (r) => r.totalOrders,
      walletBalance: (r) => r.walletBalance,
      rating: (r) => Number(r.rating),
    });
  }, [users, search, cityFilter, statusFilter, verifyFilter, sortKey, sortDir]);

  const { items: pageItems, total, totalPages } = useMemo(
    () => paginateItems(filtered, page, pageSize),
    [filtered, page, pageSize]
  );

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  const openDetail = (row) => { setSelected(row); setDetailOpen(true); };
  const openEdit = (row) => { setSelected(row); setForm({ ...row }); setErrors({}); setEditOpen(true); };

  const validate = () => {
    const e = {};
    if (!form.name?.trim()) e.name = "Name is required";
    if (!form.email?.trim()) e.email = "Email is required";
    if (!form.phone?.trim()) e.phone = "Phone is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    await new Promise((r) => setTimeout(r, 400));
    setUsers((prev) => prev.map((u) => (u.id === selected.id ? { ...u, ...form } : u)));
    setSaving(false);
    setEditOpen(false);
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    setUsers((prev) => prev.filter((u) => u.id !== deleteTarget.id));
    setDeleteTarget(null);
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
          <img src={row.avatar} alt={row.name} className="h-10 w-10 rounded-full border bg-muted object-cover" />
          <div>
            <p className="font-semibold text-sm">{row.name}</p>
            <p className="text-xs text-muted-foreground">{row.id}</p>
          </div>
        </div>
      ),
    },
    { key: "phone", header: "Phone", cell: (row) => <span className="text-sm">{row.phone}</span> },
    { key: "city", header: "City" },
    { key: "totalOrders", header: sortableHeader("Orders", "totalOrders"), cell: (row) => String(row.totalOrders) },
    { key: "walletBalance", header: sortableHeader("Wallet", "walletBalance"), cell: (row) => formatCurrency(row.walletBalance) },
    { key: "rating", header: sortableHeader("Rating", "rating"), cell: (row) => <span className="text-amber-600 font-medium">★ {row.rating}</span> },
    { key: "verification", header: "Verified", cell: (row) => <StatusBadge status={row.verification === "verified" ? "success" : "warning"} label={row.verification} /> },
    { key: "status", header: "Status", cell: (row) => <StatusBadge status={row.status} /> },
    {
      key: "actions", header: "Actions", align: "right",
      cell: (row) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => openDetail(row)}><Eye size={14} /></Button>
          <Button variant="ghost" size="sm" onClick={() => openEdit(row)}><Pencil size={14} /></Button>
          <Button variant="ghost" size="sm" className="text-red-500" onClick={() => setDeleteTarget(row)}><Trash2 size={14} /></Button>
        </div>
      ),
    },
  ];

  const selectCls = "h-10 px-3 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:border-red-500 focus:ring-4 focus:ring-red-500/10";

  return (
    <div className="blaze-theme-scope space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24">
      <PageHeader title="Customers" description="Manage logistics customers, activity and account status" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Total Customers" value={String(users.length)} icon={<UsersIcon size={18} />} />
        <StatCard title="Active" value={String(users.filter((u) => u.status === "active").length)} />
        <StatCard title="Verified" value={String(users.filter((u) => u.verification === "verified").length)} />
        <StatCard title="Avg Rating" value={(users.reduce((a, u) => a + Number(u.rating), 0) / users.length).toFixed(1)} icon={<Star size={18} />} />
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
                <select className={selectCls} value={cityFilter} onChange={(e) => { setCityFilter(e.target.value); setPage(1); }}>
                  <option value="all">All Cities</option>
                  {cities.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
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
          <AdminTable columns={columns} data={pageItems} getRowId={(r) => r.id}
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
                  <img src={selected.avatar} alt={selected.name} className="h-16 w-16 rounded-full border bg-muted" />
                  <div>
                    <h3 className="font-bold text-lg">{selected.name}</h3>
                    <p className="text-sm text-muted-foreground">{selected.id}</p>
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
                    <FormField label="Rating"><div className="text-sm font-medium flex items-center gap-2 text-amber-600"><Star size={14}/> {selected.rating} rating</div></FormField>
                    <FormField label="Wallet"><div className="text-sm font-medium flex items-center gap-2 text-emerald-600"><Wallet size={14}/> {formatCurrency(selected.walletBalance)}</div></FormField>
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
                    {selected.recentOrders.map((o) => (
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
                    ))}
                  </div>
                </FormSection>
                <div className="pt-2 text-xs text-muted-foreground text-center">Registered on {formatDateTime(selected.registeredAt)}</div>
              </FormLayout>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="blaze-theme-scope sm:max-w-[560px] p-0">
          <DialogHeader className="px-6 py-4 border-b"><DialogTitle>Edit Customer</DialogTitle></DialogHeader>
          <div className="px-6 py-4">
            <FormLayout>
              <FormSection>
                <FormRow>
                  <FormField label="Full Name" required error={errors.name}><Input value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} /></FormField>
                  <FormField label="Phone" required error={errors.phone}><Input value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></FormField>
                </FormRow>
                <FormField label="Email" required error={errors.email}><Input value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} /></FormField>
                <FormField label="Address"><Input value={form.address || ""} onChange={(e) => setForm({ ...form, address: e.target.value })} /></FormField>
                <FormRow>
                  <FormField label="Verification">
                    <select className={selectCls + " w-full"} value={form.verification || "pending"} onChange={(e) => setForm({ ...form, verification: e.target.value })}>
                      <option value="verified">Verified</option>
                      <option value="pending">Pending</option>
                    </select>
                  </FormField>
                  <FormField label="Status">
                    <select className={selectCls + " w-full"} value={form.status || "active"} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </FormField>
                </FormRow>
              </FormSection>
            </FormLayout>
          </div>
          <div className="px-6 py-4 border-t flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? <><Loader2 className="animate-spin mr-1" size={14} /> Saving...</> : "Save"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="blaze-theme-scope sm:max-w-[400px]">
          <DialogHeader><DialogTitle>Delete Customer</DialogTitle></DialogHeader>
          <p className="text-sm">Delete <strong>{deleteTarget?.name}</strong>? This action cannot be undone.</p>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button className="bg-red-600 hover:bg-red-700" onClick={handleDelete}>Delete</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Users;
