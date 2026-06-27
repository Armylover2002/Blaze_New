import React, { useMemo, useState } from "react";
import {
  Search, LifeBuoy, AlertTriangle, CheckCircle2, Clock, Eye, UserPlus,
  ArrowUp, XCircle, Send, Loader2, Paperclip,
} from "lucide-react";
import { toast } from "sonner";
import {
  PageHeader, SectionCard, StatCard, AdminTable, FilterBar,
  FormLayout, FormSection, FormRow, FormField, StatusBadge,
} from "@/shared/components/admin";
import Button from "@/shared/components/ui/Button";
import Input from "@/shared/components/ui/Input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  MOCK_SUPPORT_TICKETS, MOCK_SUPPORT_SUMMARY,
  SUPPORT_PRIORITIES, SUPPORT_STATUSES, SUPPORT_CATEGORIES,
} from "../utils/mock/supportData";
import { filterBySearch, sortItems, paginateItems, formatDateTime } from "../utils/porterTableHelpers";

const PRIORITY_TONE = { low: "neutral", medium: "info", high: "warning", critical: "danger" };
const STATUS_LABEL = { open: "Open", in_progress: "In Progress", escalated: "Escalated", resolved: "Resolved", closed: "Closed" };

const SupportDisputes = () => {
  const [tickets, setTickets] = useState(MOCK_SUPPORT_TICKETS);
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [reply, setReply] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [assignAgent, setAssignAgent] = useState("");
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    let rows = filterBySearch(tickets, search, ["id", "customer", "driverName", "orderId", "issueType", "subject"]);
    if (priorityFilter !== "all") rows = rows.filter((r) => r.priority === priorityFilter);
    if (statusFilter !== "all") rows = rows.filter((r) => r.status === statusFilter);
    if (categoryFilter !== "all") rows = rows.filter((r) => r.category === categoryFilter);
    if (dateFrom) rows = rows.filter((r) => new Date(r.createdAt) >= new Date(dateFrom));
    return sortItems(rows, "updatedAt", "desc");
  }, [tickets, search, priorityFilter, statusFilter, categoryFilter, dateFrom]);

  const { items: pageItems, total, totalPages } = useMemo(
    () => paginateItems(filtered, page, pageSize),
    [filtered, page, pageSize]
  );

  const openDetail = (row) => {
    setSelected(row);
    setReply("");
    setInternalNote(row.internalNotes || "");
    setAssignAgent(row.assignedTo === "Unassigned" ? "" : row.assignedTo);
    setDetailOpen(true);
  };

  const patchTicket = (id, patch) => {
    setTickets((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch, updatedAt: new Date().toISOString() } : t)));
    setSelected((s) => (s?.id === id ? { ...s, ...patch, updatedAt: new Date().toISOString() } : s));
  };

  const addTimeline = (ticket, label, type, message, author = "Admin") => ({
    ...ticket,
    timeline: [...ticket.timeline, { label, author, type, at: new Date().toISOString(), message }],
    updatedAt: new Date().toISOString(),
  });

  const handleReply = async () => {
    if (!reply.trim() || !selected) return;
    setSaving(true);
    await new Promise((r) => setTimeout(r, 300));
    const updated = addTimeline(selected, "Agent reply sent", "reply", reply);
    patchTicket(selected.id, { ...updated, status: selected.status === "open" ? "in_progress" : selected.status });
    setReply("");
    setSaving(false);
    toast.success("Reply sent to customer");
  };

  const handleAssign = () => {
    if (!selected || !assignAgent) return;
    const updated = addTimeline(selected, `Assigned to ${assignAgent}`, "internal", "Ticket ownership updated.");
    patchTicket(selected.id, { ...updated, assignedTo: assignAgent, status: "in_progress" });
    toast.success("Agent assigned");
  };

  const handleEscalate = () => {
    if (!selected) return;
    const updated = addTimeline(selected, "Ticket escalated", "escalation", "Escalated to senior operations.");
    patchTicket(selected.id, { ...updated, status: "escalated", priority: "critical" });
    toast.warning("Ticket escalated");
  };

  const handleResolve = () => {
    if (!selected) return;
    const updated = addTimeline(selected, "Marked resolved", "system", "Resolution shared with customer.");
    patchTicket(selected.id, { ...updated, status: "resolved", resolutionHours: 6 });
    toast.success("Ticket resolved");
  };

  const handleClose = () => {
    if (!selected) return;
    const updated = addTimeline(selected, "Ticket closed", "system", "Case closed after confirmation.");
    patchTicket(selected.id, { ...updated, status: "closed" });
    toast.success("Ticket closed");
  };

  const saveInternalNote = () => {
    if (!selected) return;
    patchTicket(selected.id, { internalNotes: internalNote });
    toast.success("Internal note saved");
  };

  const columns = [
    { key: "id", header: "Ticket ID", cell: (row) => <span className="font-semibold">{row.id}</span> },
    { key: "customer", header: "Customer" },
    { key: "driverName", header: "Driver" },
    { key: "vehicle", header: "Vehicle" },
    { key: "orderId", header: "Order" },
    { key: "issueType", header: "Issue" },
    { key: "priority", header: "Priority", cell: (row) => <StatusBadge status={PRIORITY_TONE[row.priority]} label={row.priority} /> },
    { key: "assignedTo", header: "Assigned To", cell: (row) => <span className="text-sm">{row.assignedTo}</span> },
    { key: "createdAt", header: "Created", cell: (row) => <span className="text-xs text-muted-foreground">{formatDateTime(row.createdAt)}</span> },
    { key: "updatedAt", header: "Updated", cell: (row) => <span className="text-xs text-muted-foreground">{formatDateTime(row.updatedAt)}</span> },
    { key: "status", header: "Status", cell: (row) => <StatusBadge status={row.status} label={STATUS_LABEL[row.status]} /> },
    {
      key: "actions", header: "Actions", align: "right",
      cell: (row) => <Button variant="ghost" size="sm" onClick={() => openDetail(row)}><Eye size={14} /> View</Button>,
    },
  ];

  const selectCls = "h-10 px-3 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:border-red-500 focus:ring-4 focus:ring-red-500/10";

  return (
    <div className="blaze-theme-scope space-y-6 max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24">
      <PageHeader title="Support & Disputes" description="Enterprise support center for logistics disputes and customer issues" />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard title="Open Tickets" value={String(MOCK_SUPPORT_SUMMARY.open)} icon={<LifeBuoy size={18} />} />
        <StatCard title="Resolved" value={String(MOCK_SUPPORT_SUMMARY.resolved)} icon={<CheckCircle2 size={18} />} />
        <StatCard title="Escalated" value={String(MOCK_SUPPORT_SUMMARY.escalated)} icon={<ArrowUp size={18} />} />
        <StatCard title="High Priority" value={String(MOCK_SUPPORT_SUMMARY.highPriority)} icon={<AlertTriangle size={18} />} />
        <StatCard title="Avg Resolution" value={MOCK_SUPPORT_SUMMARY.avgResolutionHours} icon={<Clock size={18} />} />
      </div>

      <SectionCard flush>
        <div className="p-4 space-y-4">
          <FilterBar
            start={
              <div className="flex flex-wrap gap-2 w-full">
                <div className="relative min-w-[200px] flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input className="pl-9" placeholder="Search tickets..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
                </div>
                <select className={selectCls} value={priorityFilter} onChange={(e) => { setPriorityFilter(e.target.value); setPage(1); }}>
                  <option value="all">All Priority</option>
                  {SUPPORT_PRIORITIES.map((p) => <option key={p} value={p} className="capitalize">{p}</option>)}
                </select>
                <select className={selectCls} value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
                  <option value="all">All Status</option>
                  {SUPPORT_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                </select>
                <select className={selectCls} value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}>
                  <option value="all">All Categories</option>
                  {SUPPORT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <Input type="date" className="w-auto" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} />
              </div>
            }
          />
          <AdminTable columns={columns} data={pageItems} getRowId={(r) => r.id}
            pagination={{ page, totalPages, total, pageSize, onPageChange: setPage, onPageSizeChange: (s) => { setPageSize(s); setPage(1); } }}
          />
        </div>
      </SectionCard>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="blaze-theme-scope sm:max-w-[700px] p-0">
          <DialogHeader className="px-6 py-4 border-b"><DialogTitle>{selected?.id} · {selected?.subject}</DialogTitle></DialogHeader>
          <div className="px-6 py-4 max-h-[85vh] overflow-y-auto">
            {selected && (
              <FormLayout>
                <div className="flex flex-wrap gap-2 mb-2">
                  <StatusBadge status={PRIORITY_TONE[selected.priority]} label={selected.priority} />
                  <StatusBadge status={selected.status} label={STATUS_LABEL[selected.status]} />
                  <StatusBadge status="info" label={selected.category} />
                </div>
                
                <FormSection title="Ticket Information">
                  <FormRow>
                    <FormField label="Customer"><div className="text-sm font-medium">{selected.customer}</div></FormField>
                    <FormField label="Driver"><div className="text-sm font-medium">{selected.driverName}</div></FormField>
                  </FormRow>
                  <FormRow>
                    <FormField label="Vehicle"><div className="text-sm font-medium">{selected.vehicle}</div></FormField>
                    <FormField label="Order ID"><div className="text-sm font-medium">{selected.orderId}</div></FormField>
                  </FormRow>
                </FormSection>
                
                <FormSection title="Issue Details">
                  <FormField label="Description">
                    <p className="text-sm text-gray-700 bg-gray-50/50 p-3 rounded-lg border">{selected.description}</p>
                  </FormField>
                  {selected.attachments?.length > 0 && (
                    <FormField label="Attachments">
                      <div className="flex flex-wrap gap-2">
                        {selected.attachments.map((a) => (
                          <span key={a.name} className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs bg-gray-50/50">
                            <Paperclip size={12} /> {a.name}
                          </span>
                        ))}
                      </div>
                    </FormField>
                  )}
                </FormSection>

                <FormSection title="Conversation Timeline">
                  <div className="space-y-4 max-h-[300px] overflow-y-auto border rounded-lg p-4 bg-gray-50/30">
                    {selected.timeline.map((step, i) => (
                      <div key={i} className="flex gap-4 relative">
                        {i !== selected.timeline.length - 1 && (
                          <div className="absolute left-[11px] top-6 bottom-[-16px] w-[2px] bg-gray-200" />
                        )}
                        <div className="relative z-10 shrink-0 mt-1">
                          {step.type === "reply" ? <Send size={24} className="text-blue-500 bg-white p-1 rounded-full border" /> :
                           step.type === "escalation" ? <ArrowUp size={24} className="text-orange-500 bg-white p-1 rounded-full border" /> :
                           step.type === "internal" ? <Eye size={24} className="text-purple-500 bg-white p-1 rounded-full border" /> :
                           <Clock size={24} className="text-gray-400 bg-white p-1 rounded-full border" />}
                        </div>
                        <div className="bg-white border rounded-lg p-3 w-full shadow-sm">
                          <div className="flex justify-between mb-1">
                            <span className="font-semibold text-sm">{step.author}</span>
                            <span className="text-xs text-muted-foreground">{formatDateTime(step.at)}</span>
                          </div>
                          <span className="text-xs font-medium text-gray-500 block mb-1">{step.label}</span>
                          <p className="text-sm text-gray-800">{step.message}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </FormSection>

                <FormSection title="Actions">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <FormField label="Reply to customer">
                        <textarea className={selectCls + " w-full h-20 py-2"} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Type your reply..." />
                      </FormField>
                      <Button size="sm" className="gap-1 w-full justify-center" onClick={handleReply} disabled={saving || !reply.trim()}>
                        {saving ? <Loader2 className="animate-spin" size={14} /> : <Send size={14} />} Send Reply
                      </Button>
                    </div>
                    <div className="space-y-3 flex flex-col justify-between">
                      <div>
                        <FormField label="Internal Notes">
                          <textarea className={selectCls + " w-full h-[3.25rem] py-1 text-sm"} value={internalNote} onChange={(e) => setInternalNote(e.target.value)} />
                        </FormField>
                        <Button variant="outline" size="sm" onClick={saveInternalNote} className="w-full mt-2">Save Note</Button>
                      </div>
                      <div>
                        <FormField label="Assign Agent">
                          <div className="flex gap-2">
                            <Input value={assignAgent} onChange={(e) => setAssignAgent(e.target.value)} placeholder="Agent name" className="flex-1" />
                            <Button variant="outline" size="sm" className="gap-1" onClick={handleAssign}><UserPlus size={14} /> Assign</Button>
                          </div>
                        </FormField>
                      </div>
                    </div>
                  </div>
                </FormSection>
              </FormLayout>
            )}
          </div>
          <div className="px-6 py-4 border-t flex flex-wrap justify-end gap-2 bg-gray-50/50">
            <Button size="sm" variant="outline" onClick={handleEscalate}><ArrowUp size={14} className="mr-1" /> Escalate</Button>
            <Button size="sm" onClick={handleResolve}><CheckCircle2 size={14} className="mr-1" /> Resolve</Button>
            <Button size="sm" variant="outline" className="text-red-600" onClick={handleClose}><XCircle size={14} className="mr-1" /> Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SupportDisputes;
