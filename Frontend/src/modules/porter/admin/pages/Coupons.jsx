import React, { useMemo, useState, useEffect, useCallback, useRef } from "react";
import {
  Plus, Search, Ticket, Eye, Pencil, Trash2, Percent, IndianRupee, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import {
  PageHeader, SectionCard, StatCard, AdminTable, FilterBar,
  FormLayout, FormSection, FormRow, FormField, StatusBadge,
} from "@/shared/components/admin";
import Button from "@/shared/components/ui/Button";
import Input from "@/shared/components/ui/Input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DISCOUNT_TYPES } from "../utils/mock/coupons";
import porterAdminApi from "../services/adminApi";
import { formatCurrency, formatDateTime } from "../utils/porterTableHelpers";

const EMPTY_COUPON = {
  code: "",
  name: "",
  description: "",
  discountType: "percentage",
  discountValue: 10,
  maxDiscount: 100,
  minOrderValue: 100,
  maxUses: 1000,
  perUserLimit: 1,
  validFrom: "",
  validUntil: "",
  firstOrderOnly: false,
  newCustomerOnly: false,
  autoApply: false,
  status: "active",
  zoneIds: [],
  vehicleIds: [],
};

const toLocalDateTime = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
};

const extractRelationIds = (items = []) => (
  (items || []).map((item) => (typeof item === "object" ? item.id : item)).filter(Boolean)
);

const mapCouponToForm = (row) => ({
  code: row.code || "",
  name: row.name || "",
  description: row.description || "",
  discountType: row.discountType || "percentage",
  discountValue: row.discountValue ?? 10,
  maxDiscount: row.maxDiscount ?? 0,
  minOrderValue: row.minOrderValue ?? 0,
  maxUses: row.maxUses ?? 1,
  perUserLimit: row.perUserLimit ?? 1,
  validFrom: toLocalDateTime(row.validFrom),
  validUntil: toLocalDateTime(row.validUntil),
  firstOrderOnly: Boolean(row.firstOrderOnly),
  newCustomerOnly: Boolean(row.newCustomerOnly),
  autoApply: Boolean(row.autoApply),
  status: row.status === "inactive" ? "inactive" : "active",
  zoneIds: extractRelationIds(row.zones),
  vehicleIds: extractRelationIds(row.vehicles),
});

const buildCouponPayload = (form) => {
  const payload = {
    code: form.code.trim(),
    name: form.name.trim(),
    description: (form.description || "").trim(),
    discountType: form.discountType,
    discountValue: Number(form.discountValue),
    maxDiscount: Number(form.maxDiscount || 0),
    minOrderValue: Number(form.minOrderValue || 0),
    maxUses: Number(form.maxUses),
    perUserLimit: Number(form.perUserLimit),
    validFrom: new Date(form.validFrom).toISOString(),
    validUntil: new Date(form.validUntil).toISOString(),
    firstOrderOnly: Boolean(form.firstOrderOnly),
    newCustomerOnly: Boolean(form.newCustomerOnly),
    autoApply: Boolean(form.autoApply),
    zoneIds: form.zoneIds || [],
    vehicleIds: form.vehicleIds || [],
  };

  if (form.status === "inactive") {
    payload.status = "inactive";
  }

  return payload;
};

const formatZoneLabel = (zoneIds = [], zoneOptions = []) => {
  if (!zoneIds.length) return "All Zones";
  return zoneIds
    .map((id) => zoneOptions.find((z) => z.id === id)?.name || id)
    .join(", ");
};

const formatVehicleLabel = (vehicleIds = [], vehicleOptions = []) => {
  if (!vehicleIds.length) return "All Vehicles";
  return vehicleIds
    .map((id) => vehicleOptions.find((v) => v.id === id)?.category || id)
    .join(", ");
};

const Coupons = () => {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sortKey, setSortKey] = useState("code");
  const [sortDir, setSortDir] = useState("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [detail, setDetail] = useState(null);
  const [form, setForm] = useState(EMPTY_COUPON);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [zoneOptions, setZoneOptions] = useState([]);
  const [vehicleOptions, setVehicleOptions] = useState([]);
  const [summary, setSummary] = useState({
    total: 0,
    active: 0,
    scheduled: 0,
    expired: 0,
    inactive: 0,
    totalRedemption: 0,
    totalDiscountGiven: 0,
    campaignRevenue: 0,
  });

  const submitLockRef = useRef(false);

  useEffect(() => {
    let active = true;
    Promise.all([
      porterAdminApi.getZoneDropdown(),
      porterAdminApi.getVehicleDropdown(),
    ])
      .then(([zones, vehicles]) => {
        if (!active) return;
        setZoneOptions((zones || []).map((z) => ({ id: z.id, name: z.name })));
        setVehicleOptions((vehicles || []).map((v) => ({
          id: v.id,
          category: v.category,
        })));
      })
      .catch(() => {
        if (active) {
          setZoneOptions([]);
          setVehicleOptions([]);
        }
      });
    return () => { active = false; };
  }, []);


  const fetchCoupons = useCallback(async () => {
    setLoading(true);
    try {
      const [result, summaryData] = await Promise.all([
        porterAdminApi.getCoupons({
          page,
          limit: pageSize,
          search: search.trim() || undefined,
          status: statusFilter !== "all" ? statusFilter : undefined,
          discountType: typeFilter !== "all" ? typeFilter : undefined,
          sortBy: sortKey,
          sortOrder: sortDir,
        }),
        porterAdminApi.getCouponSummary().catch(() => null)
      ]);
      
      setCoupons(result.records || []);
      setTotal(result.total || 0);
      setTotalPages(result.pages || 1);
      
      if (summaryData) {
        setSummary({
          total: summaryData.total || 0,
          active: summaryData.active || 0,
          scheduled: summaryData.scheduled || 0,
          expired: summaryData.expired || 0,
          inactive: summaryData.inactive || 0,
          totalRedemption: summaryData.totalRedemption || 0,
          totalDiscountGiven: summaryData.totalDiscountGiven || 0,
          campaignRevenue: summaryData.campaignRevenue || 0,
        });
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to load coupons");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, statusFilter, typeFilter, sortKey, sortDir]);

  useEffect(() => {
    fetchCoupons();
  }, [fetchCoupons]);

  const closeForm = useCallback(() => {
    setFormOpen(false);
    setEditing(null);
    setForm({ ...EMPTY_COUPON });
    setErrors({});
    submitLockRef.current = false;
  }, []);

  const resolveFormRelations = (row, mapped) => {
    const next = { ...mapped };
    if (!next.zoneIds.length && row.zones?.length) {
      next.zoneIds = row.zones
        .map((zone) => zone.id || zoneOptions.find((option) => option.name === zone.name)?.id)
        .filter(Boolean);
    }
    if (!next.vehicleIds.length && row.vehicles?.length) {
      next.vehicleIds = row.vehicles
        .map((vehicle) => vehicle.id || vehicleOptions.find((option) => option.category === vehicle.category)?.id)
        .filter(Boolean);
    }
    return next;
  };

  const openForm = (row = null) => {
    setEditing(row);
    if (row) {
      setForm(resolveFormRelations(row, mapCouponToForm(row)));
    } else {
      setForm({ ...EMPTY_COUPON });
    }
    setErrors({});
    submitLockRef.current = false;
    setFormOpen(true);
  };

  const openDetail = (row) => {
    setDetail(row);
    setDetailOpen(true);
  };

  const toggleZone = (zoneId) => {
    setForm((prev) => {
      const current = Array.isArray(prev.zoneIds) ? prev.zoneIds : [];
      const next = current.includes(zoneId)
        ? current.filter((id) => id !== zoneId)
        : [...current, zoneId];
      return { ...prev, zoneIds: next };
    });
  };

  const selectAllZones = () => {
    setForm((prev) => ({ ...prev, zoneIds: [] }));
  };

  const toggleVehicle = (vehicleId) => {
    setForm((prev) => {
      const current = Array.isArray(prev.vehicleIds) ? prev.vehicleIds : [];
      const next = current.includes(vehicleId)
        ? current.filter((id) => id !== vehicleId)
        : [...current, vehicleId];
      return { ...prev, vehicleIds: next };
    });
  };

  const selectAllVehicles = () => {
    setForm((prev) => ({ ...prev, vehicleIds: [] }));
  };

  const validate = () => {
    const e = {};
    if (!form.code.trim()) e.code = "Coupon code is required";
    if (!form.name.trim()) e.name = "Coupon name is required";
    if (!form.discountValue || Number(form.discountValue) <= 0) e.discountValue = "Valid discount required";
    if (form.discountType === "percentage" && Number(form.discountValue) > 100) {
      e.discountValue = "Percentage cannot exceed 100";
    }
    if (form.discountType === "percentage" && (!form.maxDiscount || Number(form.maxDiscount) <= 0)) {
      e.maxDiscount = "Maximum discount is required for percentage coupons";
    }
    if (form.discountType === "flat") {
      if (Number(form.discountValue) > Number(form.minOrderValue)) {
        e.discountValue = "Flat discount cannot exceed minimum order value";
      }
    }
    if (!form.maxUses || Number(form.maxUses) < 1) e.maxUses = "Usage limit must be at least 1";
    if (!form.perUserLimit || Number(form.perUserLimit) < 1) e.perUserLimit = "Per user limit must be at least 1";
    if (!form.validFrom) e.validFrom = "Start date required";
    if (!form.validUntil) e.validUntil = "End date required";
    if (form.validFrom && form.validUntil && new Date(form.validUntil) <= new Date(form.validFrom)) {
      e.validUntil = "End date must be after start date";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (submitLockRef.current || saving) return;
    if (!validate()) return;

    submitLockRef.current = true;
    setSaving(true);
    try {
      const payload = buildCouponPayload(form);
      if (editing?.id) {
        await porterAdminApi.updateCoupon(editing.id, payload);
        toast.success("Coupon updated successfully");
      } else {
        await porterAdminApi.createCoupon(payload);
        toast.success("Coupon created successfully");
      }
      closeForm();
      await fetchCoupons();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to save coupon");
      submitLockRef.current = false;
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget?.id || deletingId) return;

    setDeletingId(deleteTarget.id);
    try {
      await porterAdminApi.deleteCoupon(deleteTarget.id);
      toast.success("Coupon deleted");
      await fetchCoupons();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to delete coupon");
    } finally {
      setDeletingId(null);
      setDeleteTarget(null);
    }
  };

  const columns = useMemo(() => [
    { key: "code", header: "Coupon Code", cell: (row) => <span className="font-mono font-semibold text-primary">{row.code}</span> },
    { key: "name", header: "Coupon Name", cell: (row) => <span className="font-medium">{row.name}</span> },
    { key: "discountType", header: "Discount Type", cell: (row) => <StatusBadge status={row.discountType === "percentage" ? "info" : "primary"} label={row.discountType} /> },
    { key: "discountValue", header: "Discount Value", cell: (row) => row.discountType === "percentage" ? `${row.discountValue}%` : formatCurrency(row.discountValue) },
    { key: "minOrderValue", header: "Min Order", cell: (row) => formatCurrency(row.minOrderValue) },
    { key: "maxDiscount", header: "Max Discount", cell: (row) => formatCurrency(row.maxDiscount) },
    { key: "maxUses", header: "Usage Limit", cell: (row) => row.maxUses.toLocaleString() },
    { key: "usedCount", header: "Used", cell: (row) => row.usedCount.toLocaleString() },
    { key: "remaining", header: "Remaining", cell: (row) => Math.max(0, row.maxUses - row.usedCount).toLocaleString() },
    { key: "validFrom", header: "Valid From", cell: (row) => formatDateTime(row.validFrom) },
    { key: "validUntil", header: "Valid Until", cell: (row) => formatDateTime(row.validUntil) },
    { key: "status", header: "Status", cell: (row) => <StatusBadge status={row.status} /> },
    {
      key: "actions", header: "Actions", align: "right",
      cell: (row) => (
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => openDetail(row)}><Eye size={14} /></Button>
          <Button variant="ghost" size="sm" onClick={() => openForm(row)}><Pencil size={14} /></Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={deletingId === row.id}
            onClick={() => setDeleteTarget(row)}
          >
            {deletingId === row.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} className="text-red-500" />}
          </Button>
        </div>
      ),
    },
  ], [deletingId]);

  const selectCls = "w-full h-10 px-3 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:border-red-500 focus:ring-4 focus:ring-red-500/10";

  return (
    <div className="blaze-theme-scope space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24">
      <PageHeader
        title="Coupons & Offers"
        description="Create and manage discount coupons, track redemptions and campaign performance"
        actions={<Button onClick={() => openForm()}><Plus size={16} className="mr-1" /> Create Coupon</Button>}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <StatCard title="Total Coupons" value={String(summary.total)} icon={<Ticket size={18} />} />
        <StatCard title="Active" value={String(summary.active)} />
        <StatCard title="Expired" value={String(summary.expired)} />
        <StatCard title="Scheduled" value={String(summary.scheduled)} />
        <StatCard title="Total Redemption" value={summary.totalRedemption.toLocaleString()} />
        <StatCard title="Discount Given" value={formatCurrency(summary.totalDiscountGiven)} icon={<Percent size={18} />} />
        <StatCard title="Campaign Revenue" value={formatCurrency(summary.campaignRevenue)} icon={<IndianRupee size={18} />} />
      </div>

      <SectionCard title="Coupon Management" flush>
        <div className="p-4 space-y-4">
          <FilterBar
            start={
              <>
                <div className="relative min-w-[220px] flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input className="pl-9" placeholder="Search coupons..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
                </div>
                <select className={selectCls + " w-auto"} value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="expired">Expired</option>
                  <option value="inactive">Inactive</option>
                </select>
                <select className={selectCls + " w-auto"} value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}>
                  <option value="all">All Types</option>
                  <option value="percentage">Percentage</option>
                  <option value="flat">Flat Amount</option>
                </select>
              </>
            }
          />
          <AdminTable columns={columns} data={coupons} getRowId={(r) => r.id} loading={loading}
            pagination={{ page, totalPages, total, pageSize, onPageChange: setPage, onPageSizeChange: (s) => { setPageSize(s); setPage(1); } }}
          />
        </div>
      </SectionCard>

      <Dialog open={formOpen} onOpenChange={(open) => { if (!open) closeForm(); else setFormOpen(true); }}>
        <DialogContent className="blaze-theme-scope sm:max-w-[700px] p-0">
          <DialogHeader className="px-6 py-4 border-b"><DialogTitle>{editing ? "Edit Coupon" : "Create Coupon"}</DialogTitle></DialogHeader>
          <div className="px-6 py-4 max-h-[70vh] overflow-y-auto">
            <FormLayout onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
              <FormSection title="Basic Details">
                <FormRow>
                  <FormField label="Coupon Code" required error={errors.code}>
                    <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="BLAZE50" disabled={saving} />
                  </FormField>
                  <FormField label="Coupon Name" required error={errors.name}>
                    <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} disabled={saving} />
                  </FormField>
                </FormRow>
                <FormField label="Description">
                  <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} disabled={saving} />
                </FormField>
              </FormSection>
              <FormSection title="Discount Configuration">
                <FormRow>
                  <FormField label="Discount Type">
                    <select className={selectCls} value={form.discountType} onChange={(e) => setForm({ ...form, discountType: e.target.value })} disabled={saving}>
                      {DISCOUNT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </FormField>
                  <FormField label="Discount Value" required error={errors.discountValue}>
                    <Input type="number" value={form.discountValue} onChange={(e) => setForm({ ...form, discountValue: e.target.value })} disabled={saving} />
                  </FormField>
                </FormRow>
                <FormRow>
                  <FormField label="Maximum Discount" error={errors.maxDiscount}><Input type="number" value={form.discountType === 'flat' ? form.discountValue : form.maxDiscount} onChange={(e) => setForm({ ...form, maxDiscount: e.target.value })} disabled={saving || form.discountType === 'flat'} /></FormField>
                  <FormField label="Minimum Order Value"><Input type="number" value={form.minOrderValue} onChange={(e) => setForm({ ...form, minOrderValue: e.target.value })} disabled={saving} /></FormField>
                </FormRow>
                <FormRow>
                  <FormField label="Maximum Uses" error={errors.maxUses}><Input type="number" value={form.maxUses} onChange={(e) => setForm({ ...form, maxUses: e.target.value })} disabled={saving} /></FormField>
                  <FormField label="Per User Limit" error={errors.perUserLimit}><Input type="number" value={form.perUserLimit} onChange={(e) => setForm({ ...form, perUserLimit: e.target.value })} disabled={saving} /></FormField>
                </FormRow>
              </FormSection>
              <FormSection title="Validity & Rules">
                <FormRow>
                  <FormField label="Valid From" required error={errors.validFrom}><Input type="datetime-local" value={form.validFrom} onChange={(e) => setForm({ ...form, validFrom: e.target.value })} disabled={saving} /></FormField>
                  <FormField label="Valid To" required error={errors.validUntil}><Input type="datetime-local" value={form.validUntil} onChange={(e) => setForm({ ...form, validUntil: e.target.value })} disabled={saving} /></FormField>
                </FormRow>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.firstOrderOnly} onChange={(e) => setForm({ ...form, firstOrderOnly: e.target.checked })} disabled={saving} /> First Order Only</label>
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.newCustomerOnly} onChange={(e) => setForm({ ...form, newCustomerOnly: e.target.checked })} disabled={saving} /> New Customer Only</label>
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.autoApply} onChange={(e) => setForm({ ...form, autoApply: e.target.checked })} disabled={saving} /> Auto Apply</label>
                </div>
              </FormSection>
              <FormSection title="Applicability">
                <FormField label="Applicable Zones" hint="Empty selection means the coupon applies to all zones.">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={selectAllZones}
                      disabled={saving}
                      className={
                        "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors " +
                        (!form.zoneIds.length
                          ? "border-red-500 bg-red-50 text-red-600"
                          : "border-gray-200 bg-white text-gray-600 hover:border-gray-300")
                      }
                    >
                      All Zones
                    </button>
                    {zoneOptions.map((zone) => {
                      const selected = form.zoneIds.includes(zone.id);
                      return (
                        <button
                          key={zone.id}
                          type="button"
                          onClick={() => toggleZone(zone.id)}
                          disabled={saving}
                          className={
                            "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors " +
                            (selected
                              ? "border-red-500 bg-red-50 text-red-600"
                              : "border-gray-200 bg-white text-gray-600 hover:border-gray-300")
                          }
                        >
                          {zone.name}
                        </button>
                      );
                    })}
                    {!zoneOptions.length && (
                      <span className="text-sm text-muted-foreground">No active zones available.</span>
                    )}
                  </div>
                </FormField>
                <FormField label="Applicable Vehicles" hint="Empty selection means the coupon applies to all vehicles.">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={selectAllVehicles}
                      disabled={saving}
                      className={
                        "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors " +
                        (!form.vehicleIds.length
                          ? "border-red-500 bg-red-50 text-red-600"
                          : "border-gray-200 bg-white text-gray-600 hover:border-gray-300")
                      }
                    >
                      All Vehicles
                    </button>
                    {vehicleOptions.map((vehicle) => {
                      const selected = form.vehicleIds.includes(vehicle.id);
                      return (
                        <button
                          key={vehicle.id}
                          type="button"
                          onClick={() => toggleVehicle(vehicle.id)}
                          disabled={saving}
                          className={
                            "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors " +
                            (selected
                              ? "border-red-500 bg-red-50 text-red-600"
                              : "border-gray-200 bg-white text-gray-600 hover:border-gray-300")
                          }
                        >
                          {vehicle.category}
                        </button>
                      );
                    })}
                    {!vehicleOptions.length && (
                      <span className="text-sm text-muted-foreground">No active vehicles available.</span>
                    )}
                  </div>
                </FormField>
                <FormField label="Status" hint="Lifecycle (Scheduled / Active / Expired) is managed automatically from validity dates.">
                  <select className={selectCls} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} disabled={saving}>
                    <option value="active">Enabled</option>
                    <option value="inactive">Disabled (Inactive)</option>
                  </select>
                </FormField>
              </FormSection>
              <FormSection title="Coupon Preview">
                <div className="rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 p-4">
                  <p className="font-mono text-lg font-bold text-primary">{form.code || "CODE"}</p>
                  <p className="font-semibold mt-1">{form.name || "Coupon Name"}</p>
                  <p className="text-sm text-muted-foreground mt-1">{form.description || "Description"}</p>
                  <p className="text-sm mt-2 font-medium">
                    {form.discountType === "percentage" ? `${form.discountValue || 0}% off` : `${formatCurrency(form.discountValue || 0)} off`}
                    {form.minOrderValue ? ` · Min order ${formatCurrency(form.minOrderValue)}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Zones: {formatZoneLabel(form.zoneIds, zoneOptions)} · Vehicles: {formatVehicleLabel(form.vehicleIds, vehicleOptions)}
                  </p>
                </div>
              </FormSection>
            </FormLayout>
          </div>
          <div className="px-6 py-4 border-t flex justify-end gap-2">
            <Button variant="outline" onClick={closeForm} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <><Loader2 size={14} className="animate-spin mr-1" /> Saving...</> : editing ? "Update Coupon" : "Save Coupon"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="blaze-theme-scope sm:max-w-[650px] p-0">
          <DialogHeader className="px-6 py-4 border-b"><DialogTitle>Coupon Details — {detail?.code}</DialogTitle></DialogHeader>
          {detail && (
            <div className="px-6 py-4 max-h-[70vh] overflow-y-auto space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-xs text-muted-foreground">Name</p><p className="font-semibold">{detail.name}</p></div>
                <div><p className="text-xs text-muted-foreground">Status</p><StatusBadge status={detail.status} /></div>
                <div><p className="text-xs text-muted-foreground">Discount</p><p className="font-semibold">{detail.discountType === "percentage" ? `${detail.discountValue}%` : formatCurrency(detail.discountValue)}</p></div>
                <div><p className="text-xs text-muted-foreground">Used / Limit</p><p className="font-semibold">{detail.usedCount} / {detail.maxUses}</p></div>
                <div><p className="text-xs text-muted-foreground">Zones</p><p className="font-semibold">{detail.zones?.length ? detail.zones.map((z) => z.name).join(", ") : "All Zones"}</p></div>
                <div><p className="text-xs text-muted-foreground">Vehicles</p><p className="font-semibold">{detail.vehicles?.length ? detail.vehicles.map((v) => v.category).join(", ") : "All Vehicles"}</p></div>
                <div><p className="text-xs text-muted-foreground">Campaign Revenue</p><p className="font-semibold">{formatCurrency(detail.campaignRevenue)}</p></div>
                <div><p className="text-xs text-muted-foreground">Total Discount Given</p><p className="font-semibold">{formatCurrency(detail.totalDiscountGiven)}</p></div>
              </div>
              <SectionCard title="Campaign Performance">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="rounded-lg bg-muted/50 p-3"><p className="text-xs text-muted-foreground">Redemption Rate</p><p className="text-lg font-bold">{detail.maxUses ? ((detail.usedCount / detail.maxUses) * 100).toFixed(1) : "0.0"}%</p></div>
                  <div className="rounded-lg bg-muted/50 p-3"><p className="text-xs text-muted-foreground">Avg Order Value</p><p className="text-lg font-bold">{detail.usedCount ? formatCurrency(Math.round(detail.campaignRevenue / detail.usedCount)) : "—"}</p></div>
                  <div className="rounded-lg bg-muted/50 p-3"><p className="text-xs text-muted-foreground">ROI</p><p className="text-lg font-bold">{detail.totalDiscountGiven ? `${((detail.campaignRevenue / detail.totalDiscountGiven) * 100).toFixed(0)}%` : "—"}</p></div>
                </div>
              </SectionCard>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent className="blaze-theme-scope sm:max-w-[425px] p-0 overflow-hidden bg-white">
          <DialogHeader className="px-6 py-4 border-b border-gray-100 bg-gray-50">
            <DialogTitle className="text-red-600 font-bold">Delete Coupon</DialogTitle>
          </DialogHeader>
          <div className="p-6">
            <p className="text-sm text-gray-600 leading-relaxed mb-6">
              Are you sure you want to permanently delete the coupon <strong className="text-gray-900">{deleteTarget?.code}</strong>? This action cannot be undone and will remove it from the database.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={!!deletingId}>Cancel</Button>
              <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={handleDelete} disabled={!!deletingId}>
                {deletingId ? <><Loader2 className="animate-spin mr-1" size={14} /> Deleting...</> : "Delete"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Coupons;
