import React, { useMemo, useState, useEffect, useCallback } from "react";
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

const isPricingConfigured = (vehicle) => vehicle?.pricingConfigured === true;

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

function formatCommission(vehicle) {
  if (!isPricingConfigured(vehicle)) return NOT_CONFIGURED;
  if (vehicle.commissionType === "Fixed") return formatCurrency(vehicle.commissionValue);
  return `${vehicle.commissionValue}%`;
}

const PricingCommission = () => {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const fetchVehicles = useCallback(async () => {
    setLoading(true);
    try {
      const result = await porterAdminApi.getVehicles({ limit: 100, sortBy: "name", sortOrder: "asc" });
      setVehicles(result.records || []);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to load vehicles");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVehicles();
  }, [fetchVehicles]);

  const stats = useMemo(() => {
    const configured = vehicles.filter(isPricingConfigured).length;
    const active = vehicles.filter((v) => isPricingConfigured(v) && v.status === "active").length;
    return { total: vehicles.length, configured, pending: vehicles.length - configured, active };
  }, [vehicles]);

  const unconfiguredVehicles = useMemo(
    () => vehicles.filter((v) => !isPricingConfigured(v)),
    [vehicles]
  );

  const openAdd = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setDialogOpen(true);
  };

  const openEdit = (vehicle) => {
    const configured = isPricingConfigured(vehicle);
    setEditingId(vehicle.id);
    setForm({
      vehicleId: vehicle.id,
      enableDistanceCharges: vehicle.enableDistanceCharges ?? true,
      basePrice: configured ? String(vehicle.basePrice ?? "") : "",
      baseDistance: configured ? String(vehicle.baseDistance ?? "") : "",
      distancePrice: configured ? String(vehicle.distancePrice ?? "") : "",
      serviceTax: configured ? String(vehicle.serviceTax ?? "") : "",
      commissionType: vehicle.commissionType || "Percentage",
      commissionValue: configured ? String(vehicle.commissionValue ?? "") : "",
      status: vehicle.status || "active",
      description: vehicle.description || "",
    });
    setErrors({});
    setDialogOpen(true);
  };

  const validate = () => {
    const e = {};
    if (!form.vehicleId) e.vehicleId = "Vehicle is required";
    if (!editingId && vehicles.find((v) => v.id === form.vehicleId && isPricingConfigured(v))) {
      e.vehicleId = "Pricing already exists for this vehicle";
    }
    if (form.basePrice === "" || Number(form.basePrice) < 0) e.basePrice = "Base price is required";
    if (form.baseDistance === "" || Number(form.baseDistance) < 0) e.baseDistance = "Base distance is required";
    if (form.distancePrice === "" || Number(form.distancePrice) < 0) e.distancePrice = "Price per KM is required";
    if (!form.commissionType) e.commissionType = "Commission type is required";
    if (form.commissionValue === "" || Number(form.commissionValue) < 0) e.commissionValue = "Commission value is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        enableDistanceCharges: form.enableDistanceCharges,
        basePrice: Number(form.basePrice),
        baseDistance: Number(form.baseDistance),
        distancePrice: Number(form.distancePrice),
        serviceTax: Number(form.serviceTax) || 0,
        commissionType: form.commissionType,
        commissionValue: Number(form.commissionValue),
        status: form.status,
        description: form.description.trim(),
      };
      await porterAdminApi.upsertVehiclePricing(form.vehicleId, payload);
      setDialogOpen(false);
      const v = vehicles.find((x) => x.id === form.vehicleId);
      toast.success(`Pricing ${editingId ? "updated" : "added"} for ${v?.name || "vehicle"}`);
      fetchVehicles();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to save pricing");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (vehicle) => {
    if (!window.confirm(`Remove pricing for ${vehicle.name}?`)) return;
    try {
      await porterAdminApi.clearVehiclePricing(vehicle.id);
      toast.success("Pricing configuration removed");
      fetchVehicles();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to remove pricing");
    }
  };

  const columns = [
    {
      key: "image", header: "",
      cell: (row) => row.image
        ? <img src={row.image} alt={row.name} className="h-10 w-10 rounded-md object-contain bg-gray-50 border p-1" />
        : <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center"><Truck size={16} className="text-muted-foreground" /></div>,
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
      key: "status", header: "Status",
      cell: (row) => isPricingConfigured(row)
        ? <StatusBadge status={row.status} />
        : <StatusBadge status="neutral" label="Not Configured" />,
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

  const dialogVehicles = editingId
    ? vehicles.filter((v) => v.id === editingId)
    : unconfiguredVehicles;

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
          <AdminTable columns={columns} data={vehicles} getRowId={(r) => r.id} loading={loading} />
        </div>
      </SectionCard>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="blaze-theme-scope sm:max-w-[600px] p-0">
          <DialogHeader className="px-6 py-4 border-b">
            <DialogTitle>{editingId && isPricingConfigured(vehicles.find((v) => v.id === editingId) || {}) ? "Edit Pricing" : "Add Pricing"}</DialogTitle>
          </DialogHeader>
          <div className="px-6 py-4 max-h-[70vh] overflow-y-auto">
            <FormLayout>
              <FormField label="Vehicle" required error={errors.vehicleId}>
                <select
                  className={selectCls}
                  value={form.vehicleId}
                  disabled={!!editingId}
                  onChange={(e) => setForm({ ...form, vehicleId: e.target.value })}
                >
                  <option value="">Select vehicle</option>
                  {dialogVehicles.map((v) => (
                    <option key={v.id} value={v.id}>{v.name} — {v.category}</option>
                  ))}
                </select>
                {!editingId && unconfiguredVehicles.length === 0 && (
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
                <FormField label="Service Tax %">
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
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
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
