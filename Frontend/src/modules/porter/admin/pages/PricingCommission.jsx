import React, { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { Plus, Pencil, Trash2, IndianRupee, Truck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  PageHeader, SectionCard, StatCard, AdminTable,
  FormLayout, FormSection, FormRow, FormField, StatusBadge,
} from "@/shared/components/admin";
import Button from "@/shared/components/ui/Button";
import Input from "@/shared/components/ui/Input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import porterAdminApi from "../services/adminApi";
import { formatCurrency } from "../utils/porterTableHelpers";

const isPricingConfigured = (row) => row?.pricingConfigured === true;

const getVehicleId = (row) => row?.vehicleId || row?.vehicle?.id || null;

const EMPTY_FORM = {
  vehicleId: "",
  enableDistanceCharges: true,
  basePrice: "",
  baseDistance: "",
  distancePrice: "",
  serviceTax: "",
  commissionType: "Percentage",
  commissionValue: "",
  status: "active",
  description: "",
};

const selectCls = "w-full h-10 px-3 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:border-red-500 focus:ring-4 focus:ring-red-500/10";
const NOT_CONFIGURED = <span className="text-muted-foreground italic text-sm">Not Configured</span>;

function formatCommission(row) {
  if (!isPricingConfigured(row)) return NOT_CONFIGURED;
  if (row.commissionType === "Fixed") return formatCurrency(row.commissionValue);
  return `${row.commissionValue}%`;
}

const VehicleIcon = ({ src, name }) => {
  const [error, setError] = useState(false);
  const isValidUrl = src && src !== "null" && src !== "undefined";

  if (!isValidUrl || error) {
    return (
      <div className="h-14 w-14 rounded-md bg-muted flex items-center justify-center">
        <Truck size={24} className="text-muted-foreground" />
      </div>
    );
  }

  return (
    <img 
      src={src} 
      alt={name} 
      className="h-14 w-14 rounded-md object-contain bg-gray-50 border p-1 drop-shadow-sm"
      onError={() => setError(true)}
    />
  );
};

const PricingCommission = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingVehicleId, setEditingVehicleId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const submitLockRef = useRef(false);

  const fetchPricingList = useCallback(async () => {
    setLoading(true);
    try {
      const result = await porterAdminApi.getPricingList({
        limit: 100,
        sortBy: "displayOrder",
        sortOrder: "asc",
      });
      setRows(result.records || []);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to load pricing");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPricingList();
  }, [fetchPricingList]);

  const stats = useMemo(() => {
    const configured = rows.filter(isPricingConfigured).length;
    const active = rows.filter((r) => isPricingConfigured(r) && r.status === "active").length;
    return { total: rows.length, configured, pending: rows.length - configured, active };
  }, [rows]);

  const unconfiguredRows = useMemo(
    () => rows.filter((r) => !isPricingConfigured(r)),
    [rows]
  );

  const closeForm = useCallback(() => {
    setDialogOpen(false);
    setEditingVehicleId(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setSaving(false);
    submitLockRef.current = false;
  }, []);

  const openAdd = () => {
    setEditingVehicleId(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setDialogOpen(true);
  };

  const openEdit = (row) => {
    const configured = isPricingConfigured(row);
    const vehicleId = getVehicleId(row);
    setEditingVehicleId(vehicleId);
    setForm({
      vehicleId,
      enableDistanceCharges: row.enableDistanceCharges ?? true,
      basePrice: configured ? String(row.basePrice ?? "") : "",
      baseDistance: configured ? String(row.baseDistance ?? "") : "",
      distancePrice: configured ? String(row.distancePrice ?? "") : "",
      serviceTax: configured ? String(row.serviceTax ?? "") : "",
      commissionType: row.commissionType || "Percentage",
      commissionValue: configured ? String(row.commissionValue ?? "") : "",
      status: row.status || "active",
      description: row.description || "",
    });
    setErrors({});
    setDialogOpen(true);
  };

  const validate = () => {
    const e = {};
    if (!form.vehicleId) e.vehicleId = "Vehicle is required";

    if (!editingVehicleId) {
      const existing = rows.find((r) => getVehicleId(r) === form.vehicleId && isPricingConfigured(r));
      if (existing) e.vehicleId = "Pricing already exists for this vehicle";
    }

    if (form.basePrice === "" || Number(form.basePrice) < 0) e.basePrice = "Base price must be 0 or greater";
    if (form.baseDistance === "" || Number(form.baseDistance) < 0) e.baseDistance = "Base distance must be 0 or greater";
    if (form.distancePrice === "" || Number(form.distancePrice) < 0) e.distancePrice = "Price per KM must be 0 or greater";

    const tax = form.serviceTax === "" ? 0 : Number(form.serviceTax);
    if (form.serviceTax !== "" && (Number.isNaN(tax) || tax < 0 || tax > 100)) {
      e.serviceTax = "Service tax must be between 0 and 100";
    }

    if (!form.commissionType) e.commissionType = "Commission type is required";

    const commission = Number(form.commissionValue);
    if (form.commissionValue === "" || Number.isNaN(commission)) {
      e.commissionValue = "Commission value is required";
    } else if (form.commissionType === "Percentage" && (commission < 0 || commission > 100)) {
      e.commissionValue = "Commission percentage must be between 0 and 100";
    } else if (form.commissionType === "Fixed" && commission <= 0) {
      e.commissionValue = "Flat commission must be greater than 0";
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
      const payload = {
        enableDistanceCharges: form.enableDistanceCharges,
        basePrice: Number(form.basePrice),
        baseDistance: Number(form.baseDistance),
        distancePrice: Number(form.distancePrice),
        serviceTax: form.serviceTax === "" ? 0 : Number(form.serviceTax),
        commissionType: form.commissionType,
        commissionValue: Number(form.commissionValue),
        status: form.status,
        description: form.description.trim(),
      };

      await porterAdminApi.upsertVehiclePricing(form.vehicleId, payload);

      const row = rows.find((r) => getVehicleId(r) === form.vehicleId);
      const vehicleName = row?.name || row?.vehicle?.name || "vehicle";
      toast.success(`Pricing ${editingVehicleId ? "updated" : "added"} for ${vehicleName}`);

      closeForm();
      await fetchPricingList();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to save pricing");
    } finally {
      setSaving(false);
      submitLockRef.current = false;
    }
  };

  const handleDelete = async (row) => {
    const vehicleId = getVehicleId(row);
    const name = row.name || row.vehicle?.name || "vehicle";
    if (!window.confirm(`Remove pricing for ${name}?`)) return;

    try {
      await porterAdminApi.clearVehiclePricing(vehicleId);
      toast.success("Pricing configuration removed");
      await fetchPricingList();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to remove pricing");
    }
  };

  const editingRow = editingVehicleId
    ? rows.find((r) => getVehicleId(r) === editingVehicleId)
    : null;

  const dialogRows = editingVehicleId
    ? rows.filter((r) => getVehicleId(r) === editingVehicleId)
    : unconfiguredRows;

  const columns = [
    {
      key: "iconUrl", header: "",
      cell: (row) => <VehicleIcon src={row.iconUrl || row.icon} name={row.name} />
    },
    { key: "name", header: "Vehicle Name", cell: (row) => <span className="font-semibold">{row.name}</span> },
    { key: "category", header: "Category" },
    {
      key: "basePrice", header: "Base Price",
      cell: (row) => isPricingConfigured(row) ? formatCurrency(row.basePrice) : NOT_CONFIGURED,
    },
    {
      key: "baseDistance", header: "Base Distance",
      cell: (row) => isPricingConfigured(row) ? `${row.baseDistance} km` : NOT_CONFIGURED,
    },
    {
      key: "distancePrice", header: "Price / KM",
      cell: (row) => isPricingConfigured(row) ? formatCurrency(row.distancePrice) : NOT_CONFIGURED,
    },
    {
      key: "serviceTax", header: "Service Tax",
      cell: (row) => isPricingConfigured(row) ? `${row.serviceTax}%` : NOT_CONFIGURED,
    },
    { key: "commission", header: "Admin Commission", cell: (row) => formatCommission(row) },
    {
      key: "configured", header: "Configured",
      cell: (row) => isPricingConfigured(row)
        ? <StatusBadge status="active" label="Configured" />
        : <StatusBadge status="neutral" label="Not Configured" />,
    },
    {
      key: "status", header: "Status",
      cell: (row) => isPricingConfigured(row)
        ? <StatusBadge status={row.status} />
        : NOT_CONFIGURED,
    },
    {
      key: "actions", header: "Actions", align: "right",
      cell: (row) => (
        <div className="flex items-center justify-end gap-1">
          {isPricingConfigured(row) ? (
            <>
              <Button variant="ghost" size="sm" onClick={() => openEdit(row)}><Pencil size={14} /></Button>
              <Button variant="ghost" size="sm" onClick={() => handleDelete(row)}><Trash2 size={14} className="text-red-500" /></Button>
            </>
          ) : (
            <Button variant="outline" size="sm" onClick={() => openEdit(row)}>Configure</Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="blaze-theme-scope space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24">
      <PageHeader
        title="Pricing & Commission"
        description="Manage per-vehicle fare rules and admin commission"
        actions={
          <Button onClick={openAdd}>
            <Plus size={16} className="mr-1" /> Add Pricing
          </Button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Total Vehicles" value={String(stats.total)} icon={<Truck size={18} />} />
        <StatCard title="Pricing Configured" value={String(stats.configured)} icon={<IndianRupee size={18} />} />
        <StatCard title="Pending Setup" value={String(stats.pending)} />
        <StatCard title="Active Pricing" value={String(stats.active)} />
      </div>

      <SectionCard title="Pricing Rules" subtitle="One pricing configuration per vehicle" flush>
        <div className="p-4">
          <AdminTable columns={columns} data={rows} getRowId={(r) => getVehicleId(r)} loading={loading} />
        </div>
      </SectionCard>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) closeForm();
          else setDialogOpen(true);
        }}
      >
        <DialogContent className="blaze-theme-scope sm:max-w-[600px] p-0">
          <DialogHeader className="px-6 py-4 border-b">
            <DialogTitle>
              {editingVehicleId && isPricingConfigured(editingRow || {}) ? "Edit Pricing" : "Add Pricing"}
            </DialogTitle>
          </DialogHeader>
          <div className="px-6 py-4 max-h-[70vh] overflow-y-auto">
            <FormLayout>
              <FormField label="Vehicle" required error={errors.vehicleId}>
                <select
                  className={selectCls}
                  value={form.vehicleId}
                  disabled={!!editingVehicleId}
                  onChange={(e) => setForm({ ...form, vehicleId: e.target.value })}
                >
                  <option value="">Select vehicle</option>
                  {dialogRows.map((r) => {
                    const id = getVehicleId(r);
                    return (
                      <option key={id} value={id}>{r.name} — {r.category}</option>
                    );
                  })}
                </select>
                {!editingVehicleId && unconfiguredRows.length === 0 && (
                  <p className="text-xs text-muted-foreground mt-1">All vehicles already have pricing configured.</p>
                )}
              </FormField>

              <label className="flex items-center gap-3 cursor-pointer rounded-lg border p-3">
                <input
                  type="checkbox"
                  checked={form.enableDistanceCharges}
                  onChange={(e) => setForm({ ...form, enableDistanceCharges: e.target.checked })}
                />
                <span className="text-sm font-medium">Enable Distance Based Pricing</span>
              </label>

              <FormRow>
                <FormField label="Base Price" required error={errors.basePrice}>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₹</span>
                    <Input className="pl-7" type="number" min="0" value={form.basePrice} onChange={(e) => setForm({ ...form, basePrice: e.target.value })} />
                  </div>
                </FormField>
                <FormField label="Base Distance (KM)" required error={errors.baseDistance}>
                  <Input type="number" min="0" step="0.1" value={form.baseDistance} onChange={(e) => setForm({ ...form, baseDistance: e.target.value })} />
                </FormField>
              </FormRow>

              <FormRow>
                <FormField label="Price Per KM" required error={errors.distancePrice}>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₹</span>
                    <Input className="pl-7" type="number" min="0" value={form.distancePrice} onChange={(e) => setForm({ ...form, distancePrice: e.target.value })} />
                  </div>
                </FormField>
                <FormField label="Service Tax %" error={errors.serviceTax}>
                  <div className="relative">
                    <Input className="pr-8" type="number" min="0" max="100" value={form.serviceTax} onChange={(e) => setForm({ ...form, serviceTax: e.target.value })} />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                  </div>
                </FormField>
              </FormRow>

              <FormRow>
                <FormField label="Commission Type" required error={errors.commissionType}>
                  <select className={selectCls} value={form.commissionType} onChange={(e) => setForm({ ...form, commissionType: e.target.value })}>
                    <option value="Percentage">Percentage</option>
                    <option value="Fixed">Fixed</option>
                  </select>
                </FormField>
                <FormField label="Commission Value" required error={errors.commissionValue}>
                  <div className="relative">
                    {form.commissionType === "Fixed" && (
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₹</span>
                    )}
                    <Input
                      className={form.commissionType === "Fixed" ? "pl-7" : "pr-8"}
                      type="number"
                      min="0"
                      max={form.commissionType === "Percentage" ? 100 : undefined}
                      value={form.commissionValue}
                      onChange={(e) => setForm({ ...form, commissionValue: e.target.value })}
                    />
                    {form.commissionType === "Percentage" && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                    )}
                  </div>
                </FormField>
              </FormRow>

              <FormField label="Status">
                <select className={selectCls} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </FormField>

              <FormField label="Description">
                <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="resize-none" placeholder="Optional pricing notes..." />
              </FormField>
            </FormLayout>
          </div>
          <div className="px-6 py-4 border-t flex justify-end gap-2">
            <Button variant="outline" onClick={closeForm} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.vehicleId}>
              {saving ? <><Loader2 size={14} className="animate-spin mr-1" /> Saving...</> : "Save Pricing"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PricingCommission;
