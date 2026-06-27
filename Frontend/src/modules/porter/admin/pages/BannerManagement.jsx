import React, { useMemo, useState, useEffect, useCallback } from "react";
import {
  Plus, Search, Image as ImageIcon, Eye, Pencil, Trash2, Upload, Calendar, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import {
  PageHeader, SectionCard, StatCard, AdminTable, FilterBar,
  FormLayout, FormSection, FormRow, FormField, StatusBadge,
} from "@/shared/components/admin";
import Button from "@/shared/components/ui/Button";
import Input from "@/shared/components/ui/Input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BANNER_TYPES, BANNER_TARGETS } from "../utils/mock/bannerData";
import porterAdminApi from "../services/adminApi";
import { formatDateTime } from "../utils/porterTableHelpers";

const EMPTY = { title: "", type: "promotional", target: "Home", priority: "1", image: "", startDate: "", endDate: "", status: "active" };

const BannerManagement = () => {
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [imageFile, setImageFile] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [editing, setEditing] = useState(null);
  const [preview, setPreview] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const stats = useMemo(() => ({
    active: banners.filter((b) => b.status === "active").length,
    inactive: banners.filter((b) => b.status === "inactive").length,
    scheduled: banners.filter((b) => b.status === "scheduled").length,
    expired: banners.filter((b) => b.status === "expired").length,
  }), [banners]);

  const fetchBanners = useCallback(async () => {
    setLoading(true);
    try {
      const result = await porterAdminApi.getBanners({
        page,
        limit: pageSize,
        search: search.trim() || undefined,
        status: statusFilter !== "all" ? statusFilter : undefined,
        sortBy: "priority",
        sortOrder: "asc",
      });
      setBanners(result.records || []);
      setTotal(result.total || 0);
      setTotalPages(result.pages || 1);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to load banners");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, statusFilter]);

  useEffect(() => {
    fetchBanners();
  }, [fetchBanners]);

  const pageItems = banners;

  const openForm = (row = null) => {
    setImageFile(null);
    setEditing(row);
    if (row) {
      setForm({
        ...row,
        priority: String(row.priority),
        startDate: row.startDate.slice(0, 10),
        endDate: row.endDate.slice(0, 10),
      });
    } else setForm({ ...EMPTY, startDate: new Date().toISOString().slice(0, 10), endDate: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10) });
    setErrors({});
    setFormOpen(true);
  };

  const validate = () => {
    const e = {};
    if (!form.title.trim()) e.title = "Title required";
    if (!form.startDate) e.startDate = "Start date required";
    if (!form.endDate) e.endDate = "End date required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        priority: Number(form.priority),
        startDate: new Date(form.startDate).toISOString(),
        endDate: new Date(form.endDate + "T23:59:59").toISOString(),
      };
      if (editing?.id) {
        await porterAdminApi.updateBanner(editing.id, payload, imageFile);
        toast.success("Banner updated");
      } else {
        await porterAdminApi.createBanner(payload, imageFile);
        toast.success("Banner created");
      }
      setFormOpen(false);
      fetchBanners();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to save banner");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget?.id) return;
    try {
      await porterAdminApi.deleteBanner(deleteTarget.id);
      setDeleteTarget(null);
      toast.success("Banner deleted");
      fetchBanners();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to delete banner");
    }
  };

  const handleImageDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0] || e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setForm((f) => ({ ...f, image: URL.createObjectURL(file) }));
    }
  };

  const columns = [
    {
      key: "image", header: "Preview",
      cell: (row) => <img src={row.image} alt={row.title} className="h-12 w-28 rounded-md object-cover border" />,
    },
    { key: "title", header: "Title", cell: (row) => <span className="font-semibold">{row.title}</span> },
    { key: "priority", header: "Priority", cell: (row) => `#${row.priority}` },
    { key: "startDate", header: "Start", cell: (row) => <span className="text-xs">{formatDateTime(row.startDate).split(",")[0]}</span> },
    { key: "endDate", header: "End", cell: (row) => <span className="text-xs">{formatDateTime(row.endDate).split(",")[0]}</span> },
    { key: "status", header: "Status", cell: (row) => <StatusBadge status={row.status} /> },
    {
      key: "actions", header: "Actions", align: "right",
      cell: (row) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => { setPreview(row); setPreviewOpen(true); }}><Eye size={14} /></Button>
          <Button variant="ghost" size="sm" onClick={() => openForm(row)}><Pencil size={14} /></Button>
          <Button variant="ghost" size="sm" className="text-red-500" onClick={() => setDeleteTarget(row)}><Trash2 size={14} /></Button>
        </div>
      ),
    },
  ];

  const selectCls = "w-full h-10 px-3 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:border-red-500 focus:ring-4 focus:ring-red-500/10";

  return (
    <div className="blaze-theme-scope space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24">
      <PageHeader
        title="Banner Management"
        description="Marketing banners, promotions and scheduled campaigns"
        actions={<Button onClick={() => openForm()} className="gap-2"><Plus size={16} /> Upload Banner</Button>}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Active" value={String(stats.active)} icon={<ImageIcon size={18} />} />
        <StatCard title="Inactive" value={String(stats.inactive)} />
        <StatCard title="Scheduled" value={String(stats.scheduled)} icon={<Calendar size={18} />} />
        <StatCard title="Expired" value={String(stats.expired)} />
      </div>

      <SectionCard flush>
        <div className="p-4 space-y-4">
          <FilterBar
            start={
              <>
                <div className="relative min-w-[220px] flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input className="pl-9" placeholder="Search banners..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
                </div>
                <select className={selectCls + " w-auto"} value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="expired">Expired</option>
                </select>
              </>
            }
          />
          <AdminTable columns={columns} data={pageItems} getRowId={(r) => r.id} loading={loading}
            pagination={{ page, totalPages, total, pageSize, onPageChange: setPage, onPageSizeChange: (s) => { setPageSize(s); setPage(1); } }}
          />
        </div>
      </SectionCard>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="blaze-theme-scope sm:max-w-[600px] p-0 max-h-[90vh] overflow-y-auto">
          <DialogHeader className="px-6 py-4 border-b"><DialogTitle>{editing ? "Edit Banner" : "Upload Banner"}</DialogTitle></DialogHeader>
          <div className="px-6 py-4">
            <FormLayout>
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleImageDrop}
                className="border-2 border-dashed rounded-xl p-6 text-center mb-4 hover:border-primary/50 transition-colors"
              >
                <img src={form.image} alt="Preview" className="mx-auto h-32 w-full max-w-md object-cover rounded-lg mb-3" />
                <input type="file" id="banner-upload" className="hidden" accept="image/*" onChange={handleImageDrop} />
                <label htmlFor="banner-upload" className="cursor-pointer inline-flex items-center gap-2 text-sm border rounded-lg px-3 py-2 hover:bg-muted">
                  <Upload size={14} /> Drag & drop or click to upload
                </label>
              </div>
              <FormSection>
                <FormField label="Banner Title" required error={errors.title}>
                  <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                </FormField>

                <FormRow>
                  <FormField label="Priority"><Input type="number" min="1" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} /></FormField>
                  <FormField label="Status">
                    <select className={selectCls} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="scheduled">Scheduled</option>
                    </select>
                  </FormField>
                </FormRow>
                <FormRow>
                  <FormField label="Start Date" required error={errors.startDate}><Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></FormField>
                  <FormField label="End Date" required error={errors.endDate}><Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></FormField>
                </FormRow>
              </FormSection>
            </FormLayout>
          </div>
          <div className="px-6 py-4 border-t flex justify-end gap-2">
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? <><Loader2 className="animate-spin mr-1" size={14} /> Saving...</> : "Save Banner"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="blaze-theme-scope sm:max-w-[560px]">
          <DialogHeader><DialogTitle>Banner Preview</DialogTitle></DialogHeader>
          {preview && (
            <div className="space-y-3">
              <img src={preview.image} alt={preview.title} className="w-full rounded-xl border" />
              <h3 className="font-bold">{preview.title}</h3>
              <div className="flex gap-2"><StatusBadge status={preview.status} /></div>
              <p className="text-sm text-muted-foreground">Priority #{preview.priority}</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="blaze-theme-scope sm:max-w-[400px]">
          <DialogHeader><DialogTitle>Delete Banner</DialogTitle></DialogHeader>
          <p className="text-sm">Delete <strong>{deleteTarget?.title}</strong>?</p>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button className="bg-red-600 hover:bg-red-700" onClick={handleDelete}>Delete</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BannerManagement;
