import React, { useMemo, useState, useEffect, useCallback, useRef } from "react";
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
import {
  BANNER_TYPES, BANNER_TARGETS, BANNER_TYPE_LABELS, BANNER_TARGET_LABELS,
} from "../utils/mock/bannerData";
import porterAdminApi from "../services/adminApi";
import { formatDateTime } from "../utils/porterTableHelpers";

const EMPTY_BANNER = {
  title: "",
  type: "promotional",
  target: "porter",
  priority: "1",
  startDate: "",
  endDate: "",
  status: "active",
};

const toDateInput = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

const mapBannerToForm = (row) => ({
  title: row.title || "",
  type: BANNER_TYPES.includes(row.type) ? row.type : "promotional",
  target: BANNER_TARGETS.includes(row.target) ? row.target : "porter",
  priority: String(row.priority ?? 1),
  startDate: toDateInput(row.startDate),
  endDate: toDateInput(row.endDate),
  status: row.status || "active",
});

const buildBannerPayload = (form) => ({
  title: form.title.trim(),
  type: form.type,
  target: form.target,
  priority: Number(form.priority),
  startDate: new Date(form.startDate).toISOString(),
  endDate: new Date(`${form.endDate}T23:59:59`).toISOString(),
  status: form.status,
});

const BannerManagement = () => {
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [editing, setEditing] = useState(null);
  const [preview, setPreview] = useState(null);
  const [form, setForm] = useState(EMPTY_BANNER);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [stats, setStats] = useState({ active: 0, inactive: 0, scheduled: 0, expired: 0, total: 0 });

  const submitLockRef = useRef(false);
  const previewUrlRef = useRef(null);

  const clearPreviewUrl = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const data = await porterAdminApi.getBannerStats();
      setStats({
        active: data.active || 0,
        inactive: data.inactive || 0,
        scheduled: data.scheduled || 0,
        expired: data.expired || 0,
        total: data.total || 0,
      });
    } catch {
      // Non-blocking
    }
  }, []);

  const fetchBanners = useCallback(async () => {
    setLoading(true);
    try {
      const result = await porterAdminApi.getBanners({
        page,
        limit: pageSize,
        search: search.trim() || undefined,
        status: statusFilter !== "all" ? statusFilter : undefined,
        type: typeFilter !== "all" ? typeFilter : undefined,
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
  }, [page, pageSize, search, statusFilter, typeFilter]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchBanners();
  }, [fetchBanners]);

  useEffect(() => () => clearPreviewUrl(), [clearPreviewUrl]);

  const closeForm = useCallback(() => {
    setFormOpen(false);
    setEditing(null);
    setForm({ ...EMPTY_BANNER });
    setImageFile(null);
    clearPreviewUrl();
    setImagePreview("");
    setErrors({});
    submitLockRef.current = false;
  }, [clearPreviewUrl]);

  const openForm = (row = null) => {
    clearPreviewUrl();
    setImageFile(null);
    setEditing(row);
    if (row) {
      setForm(mapBannerToForm(row));
      setImagePreview(row.image || "");
    } else {
      const today = new Date().toISOString().slice(0, 10);
      const end = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
      setForm({ ...EMPTY_BANNER, startDate: today, endDate: end });
      setImagePreview("");
    }
    setErrors({});
    submitLockRef.current = false;
    setFormOpen(true);
  };

  const handleImageSelect = (e) => {
    const file = e.dataTransfer?.files?.[0] || e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }
    clearPreviewUrl();
    const objectUrl = URL.createObjectURL(file);
    previewUrlRef.current = objectUrl;
    setImageFile(file);
    setImagePreview(objectUrl);
  };

  const validate = () => {
    const e = {};
    if (!form.title.trim()) e.title = "Title is required";
    if (!form.priority || Number(form.priority) < 1) e.priority = "Priority must be at least 1";
    if (!form.startDate) e.startDate = "Start date is required";
    if (!form.endDate) e.endDate = "End date is required";
    if (form.startDate && form.endDate && new Date(form.endDate) <= new Date(form.startDate)) {
      e.endDate = "End date must be after start date";
    }
    if (!editing && !imageFile) e.image = "Banner image is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (submitLockRef.current || saving) return;
    if (!validate()) return;

    submitLockRef.current = true;
    setSaving(true);
    try {
      const payload = buildBannerPayload(form);
      if (editing?.id) {
        await porterAdminApi.updateBanner(editing.id, payload, imageFile);
        toast.success("Banner updated successfully");
      } else {
        await porterAdminApi.createBanner(payload, imageFile);
        toast.success("Banner created successfully");
      }
      closeForm();
      await Promise.all([fetchBanners(), fetchStats()]);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to save banner");
      submitLockRef.current = false;
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget?.id || deleting) return;
    setDeleting(true);
    try {
      await porterAdminApi.deleteBanner(deleteTarget.id);
      setDeleteTarget(null);
      toast.success("Banner deleted");
      await Promise.all([fetchBanners(), fetchStats()]);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to delete banner");
    } finally {
      setDeleting(false);
    }
  };

  const columns = useMemo(() => [
    {
      key: "image",
      header: "Preview",
      cell: (row) => row.image
        ? <img src={row.image} alt={row.title} className="h-12 w-28 rounded-md object-cover border" />
        : <div className="h-12 w-28 rounded-md border bg-muted flex items-center justify-center"><ImageIcon size={16} className="text-muted-foreground" /></div>,
    },
    { key: "title", header: "Title", cell: (row) => <span className="font-semibold">{row.title}</span> },
    { key: "type", header: "Type", cell: (row) => <StatusBadge status="info" label={BANNER_TYPE_LABELS[row.type] || row.type} /> },
    { key: "target", header: "Target", cell: (row) => <span className="text-sm capitalize">{BANNER_TARGET_LABELS[row.target] || row.target}</span> },
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
  ], []);

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
                  <Input className="pl-9" placeholder="Search by title or type..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
                </div>
                <select className={selectCls + " w-auto"} value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}>
                  <option value="all">All Types</option>
                  {BANNER_TYPES.map((type) => <option key={type} value={type}>{BANNER_TYPE_LABELS[type]}</option>)}
                </select>
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
          <AdminTable columns={columns} data={banners} getRowId={(r) => r.id} loading={loading}
            pagination={{ page, totalPages, total, pageSize, onPageChange: setPage, onPageSizeChange: (s) => { setPageSize(s); setPage(1); } }}
          />
        </div>
      </SectionCard>

      <Dialog open={formOpen} onOpenChange={(open) => { if (!open) closeForm(); else setFormOpen(true); }}>
        <DialogContent className="blaze-theme-scope sm:max-w-[600px] p-0 max-h-[90vh] overflow-y-auto">
          <DialogHeader className="px-6 py-4 border-b"><DialogTitle>{editing ? "Edit Banner" : "Upload Banner"}</DialogTitle></DialogHeader>
          <div className="px-6 py-4">
            <FormLayout onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleImageSelect}
                className={"border-2 border-dashed rounded-xl p-6 text-center mb-4 hover:border-primary/50 transition-colors " + (errors.image ? "border-red-300" : "")}
              >
                {imagePreview ? (
                  <img src={imagePreview} alt="Preview" className="mx-auto h-32 w-full max-w-md object-cover rounded-lg mb-3" />
                ) : (
                  <div className="mx-auto h-32 w-full max-w-md rounded-lg mb-3 bg-muted flex items-center justify-center">
                    <ImageIcon className="h-10 w-10 text-muted-foreground" />
                  </div>
                )}
                <input type="file" id="banner-upload" className="hidden" accept="image/*" onChange={handleImageSelect} disabled={saving} />
                <label htmlFor="banner-upload" className="cursor-pointer inline-flex items-center gap-2 text-sm border rounded-lg px-3 py-2 hover:bg-muted">
                  <Upload size={14} /> {editing ? "Replace image" : "Drag & drop or click to upload"}
                </label>
                {errors.image && <p className="text-xs text-red-500 mt-2">{errors.image}</p>}
              </div>

              <FormSection>
                <FormField label="Banner Title" required error={errors.title}>
                  <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} disabled={saving} />
                </FormField>

                <FormRow>
                  <FormField label="Banner Type">
                    <select className={selectCls} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} disabled={saving}>
                      {BANNER_TYPES.map((type) => <option key={type} value={type}>{BANNER_TYPE_LABELS[type]}</option>)}
                    </select>
                  </FormField>
                  <FormField label="Target Screen">
                    <select className={selectCls} value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} disabled={saving}>
                      {BANNER_TARGETS.map((target) => <option key={target} value={target}>{BANNER_TARGET_LABELS[target]}</option>)}
                    </select>
                  </FormField>
                </FormRow>

                <FormRow>
                  <FormField label="Priority" error={errors.priority}>
                    <Input type="number" min="1" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} disabled={saving} />
                  </FormField>
                  <FormField label="Status">
                    <select className={selectCls} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} disabled={saving}>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="scheduled">Scheduled</option>
                      <option value="expired">Expired</option>
                    </select>
                  </FormField>
                </FormRow>

                <FormRow>
                  <FormField label="Start Date" required error={errors.startDate}>
                    <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} disabled={saving} />
                  </FormField>
                  <FormField label="End Date" required error={errors.endDate}>
                    <Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} disabled={saving} />
                  </FormField>
                </FormRow>
              </FormSection>
            </FormLayout>
          </div>
          <div className="px-6 py-4 border-t flex justify-end gap-2">
            <Button variant="outline" onClick={closeForm} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <><Loader2 className="animate-spin mr-1" size={14} /> Saving...</> : editing ? "Update Banner" : "Save Banner"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="blaze-theme-scope sm:max-w-[600px] p-0 overflow-hidden bg-white">
          <DialogHeader className="px-6 py-4 border-b border-gray-100 bg-gray-50">
            <DialogTitle className="text-lg font-bold text-gray-900">Banner Preview</DialogTitle>
          </DialogHeader>
          {preview && (
            <div className="p-6 space-y-6">
              <div className="w-full bg-gray-100 rounded-xl overflow-hidden border border-gray-200 shadow-sm relative aspect-[21/9]">
                {preview.image
                  ? <img src={preview.image} alt={preview.title} className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center"><ImageIcon className="h-10 w-10 text-muted-foreground" /></div>}
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-1">{preview.title}</h3>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <StatusBadge status={preview.status} />
                    <span className="text-sm font-medium px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                      {BANNER_TYPE_LABELS[preview.type] || preview.type}
                    </span>
                    <span className="text-sm font-medium px-2.5 py-0.5 rounded-full bg-gray-50 text-gray-700 border border-gray-100">
                      {BANNER_TARGET_LABELS[preview.target] || preview.target}
                    </span>
                    <span className="text-sm font-medium px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-100">
                      Priority #{preview.priority}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100">
                    <Calendar className="w-5 h-5 text-gray-500" />
                    <div>
                      <p className="text-xs text-gray-500 font-medium">Start Date</p>
                      <p className="text-sm font-semibold text-gray-900">{formatDateTime(preview.startDate).split(",")[0]}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100">
                    <Calendar className="w-5 h-5 text-gray-500" />
                    <div>
                      <p className="text-xs text-gray-500 font-medium">End Date</p>
                      <p className="text-sm font-semibold text-gray-900">{formatDateTime(preview.endDate).split(",")[0]}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end">
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent className="blaze-theme-scope sm:max-w-[425px] p-0 overflow-hidden bg-white">
          <DialogHeader className="px-6 py-4 border-b border-gray-100 bg-gray-50">
            <DialogTitle className="text-red-600 font-bold">Delete Banner</DialogTitle>
          </DialogHeader>
          <div className="p-6">
            <p className="text-sm text-gray-600 leading-relaxed mb-6">
              Are you sure you want to permanently delete the banner <strong className="text-gray-900">{deleteTarget?.title}</strong>? This action cannot be undone and will remove it from the database.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
              <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={handleDelete}>
                {deleting ? <><Loader2 className="animate-spin mr-1" size={14} /> Deleting...</> : "Delete"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BannerManagement;
