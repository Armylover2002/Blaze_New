import React, { useMemo, useState } from "react";
import {
  Search, Bell, BellOff, AlertTriangle, AlertCircle, Megaphone, Info, Eye,
  CheckCheck, Trash2, Plus, Send, Loader2,
} from "lucide-react";
import {
  PageHeader, SectionCard, StatCard, AdminTable, FilterBar,
  FormLayout, FormSection, FormRow, FormField, StatusBadge,
} from "@/shared/components/admin";
import Button from "@/shared/components/ui/Button";
import Input from "@/shared/components/ui/Input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MOCK_NOTIFICATIONS, NOTIFICATION_TEMPLATES, NOTIFICATION_TYPES } from "../utils/mock/notifications";
import { filterBySearch, sortItems, paginateItems, formatDateTime } from "../utils/porterTableHelpers";

const TYPE_META = {
  critical: { icon: AlertCircle, tone: "danger", label: "Critical" },
  warning: { icon: AlertTriangle, tone: "warning", label: "Warning" },
  announcement: { icon: Megaphone, tone: "info", label: "Announcement" },
  info: { icon: Info, tone: "neutral", label: "Info" },
};

const Notifications = () => {
  const [items, setItems] = useState(MOCK_NOTIFICATIONS);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [detailOpen, setDetailOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ type: "info", title: "", description: "", recipient: "All Drivers" });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const stats = useMemo(() => ({
    unread: items.filter((n) => n.status === "unread").length,
    read: items.filter((n) => n.status === "read").length,
    critical: items.filter((n) => n.type === "critical").length,
    warnings: items.filter((n) => n.type === "warning").length,
    announcements: items.filter((n) => n.type === "announcement").length,
  }), [items]);

  const filtered = useMemo(() => {
    let rows = filterBySearch(items, search, ["id", "title", "description", "recipient"]);
    if (typeFilter !== "all") rows = rows.filter((r) => r.type === typeFilter);
    if (statusFilter !== "all") rows = rows.filter((r) => r.status === statusFilter);
    return sortItems(rows, "createdAt", "desc");
  }, [items, search, typeFilter, statusFilter]);

  const { items: pageItems, total, totalPages } = useMemo(
    () => paginateItems(filtered, page, pageSize),
    [filtered, page, pageSize]
  );

  const openDetail = (row) => {
    setSelected(row);
    setItems((prev) => prev.map((n) => (n.id === row.id ? { ...n, status: "read" } : n)));
    setDetailOpen(true);
  };

  const markAllRead = () => setItems((prev) => prev.map((n) => ({ ...n, status: "read" })));
  const handleDelete = (id) => setItems((prev) => prev.filter((n) => n.id !== id));

  const applyTemplate = (tplId) => {
    const tpl = NOTIFICATION_TEMPLATES.find((t) => t.id === tplId);
    if (tpl) setForm((f) => ({ ...f, type: tpl.type, title: tpl.title, description: tpl.description }));
  };

  const validate = () => {
    const e = {};
    if (!form.title.trim()) e.title = "Title is required";
    if (!form.description.trim()) e.description = "Description is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSend = async () => {
    if (!validate()) return;
    setSaving(true);
    await new Promise((r) => setTimeout(r, 500));
    setItems((prev) => [{
      id: `NTF-${String(8100 + prev.length)}`,
      type: form.type,
      title: form.title,
      description: form.description,
      recipient: form.recipient,
      createdAt: new Date().toISOString(),
      status: "unread",
    }, ...prev]);
    setSaving(false);
    setSendOpen(false);
    setForm({ type: "info", title: "", description: "", recipient: "All Drivers" });
  };

  const columns = [
    {
      key: "type", header: "Type",
      cell: (row) => {
        const meta = TYPE_META[row.type] || TYPE_META.info;
        const Icon = meta.icon;
        return <span className="inline-flex items-center gap-1.5"><Icon size={15} className="text-muted-foreground" /><StatusBadge status={meta.tone} label={meta.label} /></span>;
      },
    },
    { key: "title", header: "Title", cell: (row) => <span className="font-semibold">{row.title}</span> },
    { key: "description", header: "Description", cell: (row) => <span className="text-sm text-muted-foreground line-clamp-1 max-w-[280px]">{row.description}</span> },
    { key: "recipient", header: "Recipient", cell: (row) => <span className="text-sm">{row.recipient}</span> },
    { key: "createdAt", header: "Created", cell: (row) => <span className="text-xs text-muted-foreground">{formatDateTime(row.createdAt)}</span> },
    { key: "status", header: "Status", cell: (row) => <StatusBadge status={row.status === "unread" ? "warning" : "success"} label={row.status} /> },
    {
      key: "actions", header: "Actions", align: "right",
      cell: (row) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => openDetail(row)}><Eye size={14} /></Button>
          <Button variant="ghost" size="sm" className="text-red-500" onClick={() => handleDelete(row.id)}><Trash2 size={14} /></Button>
        </div>
      ),
    },
  ];

  const selectCls = "h-10 px-3 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:border-red-500 focus:ring-4 focus:ring-red-500/10";

  return (
    <div className="blaze-theme-scope space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24">
      <PageHeader
        title="Notification Center"
        description="Manage system alerts, announcements and broadcasts"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" onClick={markAllRead}><CheckCheck size={16} /> Mark All Read</Button>
            <Button className="gap-2" onClick={() => setSendOpen(true)}><Plus size={16} /> Send Notification</Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard title="Unread" value={String(stats.unread)} icon={<Bell size={18} />} />
        <StatCard title="Read" value={String(stats.read)} icon={<BellOff size={18} />} />
        <StatCard title="Critical" value={String(stats.critical)} icon={<AlertCircle size={18} />} />
        <StatCard title="Warnings" value={String(stats.warnings)} icon={<AlertTriangle size={18} />} />
        <StatCard title="Announcements" value={String(stats.announcements)} icon={<Megaphone size={18} />} />
      </div>

      <SectionCard flush>
        <div className="p-4 space-y-4">
          <FilterBar
            start={
              <>
                <div className="relative min-w-[220px] flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input className="pl-9" placeholder="Search notifications..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
                </div>
                <select className={selectCls + " w-auto"} value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}>
                  <option value="all">All Types</option>
                  {NOTIFICATION_TYPES.map((t) => <option key={t} value={t} className="capitalize">{t}</option>)}
                </select>
                <select className={selectCls + " w-auto"} value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
                  <option value="all">All Status</option>
                  <option value="unread">Unread</option>
                  <option value="read">Read</option>
                </select>
              </>
            }
          />
          <AdminTable columns={columns} data={pageItems} getRowId={(r) => r.id}
            pagination={{ page, totalPages, total, pageSize, onPageChange: setPage, onPageSizeChange: (s) => { setPageSize(s); setPage(1); } }}
          />
        </div>
      </SectionCard>

      {/* Details Drawer */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="blaze-theme-scope sm:max-w-[500px] p-0">
          <DialogHeader className="px-6 py-4 border-b"><DialogTitle>Notification Details</DialogTitle></DialogHeader>
          <div className="px-6 py-4 max-h-[85vh] overflow-y-auto">
            {selected && (
              <FormLayout>
                <div className="flex items-center gap-2 mb-2">
                  <StatusBadge status={(TYPE_META[selected.type] || TYPE_META.info).tone} label={(TYPE_META[selected.type] || TYPE_META.info).label} />
                  <StatusBadge status={selected.status === "unread" ? "warning" : "success"} label={selected.status} />
                </div>
                
                <FormSection title="Message">
                  <FormField label="Title">
                    <h3 className="font-bold text-lg text-gray-900">{selected.title}</h3>
                  </FormField>
                  <FormField label="Description">
                    <p className="text-sm text-gray-700 bg-gray-50/50 p-3 rounded-lg border">{selected.description}</p>
                  </FormField>
                </FormSection>

                <FormSection title="Delivery Info">
                  <FormRow>
                    <FormField label="Recipient"><div className="text-sm font-medium">{selected.recipient}</div></FormField>
                    <FormField label="Notification ID"><div className="text-sm font-medium">{selected.id}</div></FormField>
                  </FormRow>
                  <FormField label="Created At"><div className="text-sm font-medium">{formatDateTime(selected.createdAt)}</div></FormField>
                </FormSection>
              </FormLayout>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Send Notification Dialog */}
      <Dialog open={sendOpen} onOpenChange={setSendOpen}>
        <DialogContent className="blaze-theme-scope sm:max-w-[560px] p-0">
          <DialogHeader className="px-6 py-4 border-b"><DialogTitle>Send Notification</DialogTitle></DialogHeader>
          <div className="px-6 py-4 max-h-[70vh] overflow-y-auto">
            <FormLayout>
              <FormSection title="Quick Templates">
                <div className="flex flex-wrap gap-2">
                  {NOTIFICATION_TEMPLATES.map((t) => (
                    <button key={t.id} type="button" onClick={() => applyTemplate(t.id)}
                      className="rounded-full border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors">
                      {t.name}
                    </button>
                  ))}
                </div>
              </FormSection>
              <FormSection title="Message">
                <FormRow>
                  <FormField label="Type">
                    <select className={selectCls + " w-full"} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                      {NOTIFICATION_TYPES.map((t) => <option key={t} value={t} className="capitalize">{t}</option>)}
                    </select>
                  </FormField>
                  <FormField label="Recipient">
                    <select className={selectCls + " w-full"} value={form.recipient} onChange={(e) => setForm({ ...form, recipient: e.target.value })}>
                      <option>All Drivers</option>
                      <option>All Customers</option>
                      <option>Operations Team</option>
                      <option>Finance Team</option>
                      <option>Zone Managers</option>
                    </select>
                  </FormField>
                </FormRow>
                <FormField label="Title" required error={errors.title}>
                  <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Notification title" />
                </FormField>
                <FormField label="Description" required error={errors.description}>
                  <textarea className={selectCls + " w-full h-24 py-2"} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Notification message" />
                </FormField>
              </FormSection>
            </FormLayout>
          </div>
          <div className="px-6 py-4 border-t flex justify-end gap-2">
            <Button variant="outline" onClick={() => setSendOpen(false)}>Cancel</Button>
            <Button onClick={handleSend} disabled={saving} className="gap-1">{saving ? <><Loader2 className="animate-spin" size={14} /> Sending...</> : <><Send size={14} /> Send</>}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Notifications;
