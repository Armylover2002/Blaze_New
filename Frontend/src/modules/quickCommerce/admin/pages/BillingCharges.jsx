import React, { useEffect, useMemo, useState } from 'react';
import { Edit, Loader2, Plus, Save, Settings, Trash2, Truck, IndianRupee, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@shared/components/ui/Toast';
import { adminApi } from '../services/adminApi';
import { useAuth } from "@core/context/AuthContext";
import { getCurrentUser } from "@food/utils/auth";
import { canPerformAdminPermissionAction, extractAdminPermissions, extractAdminRoleId, fetchAdminRolePermissions } from "@food/utils/adminPermissions";
import Card from '@shared/components/ui/Card';
import {
  RETURN_WINDOW_DAY_PRESETS,
  hoursToReturnWindowDays,
  returnWindowDaysToHours,
} from '@/shared/utils/returnWindow';

const initialFeeSettings = {
  deliveryFee: '',
  deliveryFeeRanges: [],
  freeDeliveryThreshold: '',
  platformFee: '',
  gstRate: '',
  returnDeliveryCommission: '',
  returnsEnabled: true,
  returnWindowDays: 3,
};

const initialRuleForm = {
  name: '',
  minDistance: '0',
  maxDistance: '',
  maxDistanceUnlimited: false,
  commissionPerKm: '',
  basePayout: '',
};

const toInputValue = (value) =>
  value === null || value === undefined || Number.isNaN(Number(value)) ? '' : String(value);

const toNullableNumber = (value) => {
  if (value === '' || value === null || value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export default function BillingCharges() {
  const { showToast } = useToast();
  const { user: authUser } = useAuth();
  const currentUser = useMemo(() => authUser || getCurrentUser("admin"), [authUser]);
  const [resolvedPermissions, setResolvedPermissions] = useState({});

  useEffect(() => {
    let isMounted = true;
    const resolvePermissions = async () => {
      if (!currentUser || currentUser.role === "ADMIN") {
        if (isMounted) setResolvedPermissions({});
        return;
      }
      const existingPermissions = extractAdminPermissions(currentUser);
      if (Object.keys(existingPermissions).length > 0) {
        if (isMounted) setResolvedPermissions(existingPermissions);
        return;
      }
      const roleId = extractAdminRoleId(currentUser);
      if (!roleId) {
        if (isMounted) setResolvedPermissions({});
        return;
      }
      try {
        const rolePermissions = await fetchAdminRolePermissions(roleId);
        if (isMounted) setResolvedPermissions(rolePermissions);
      } catch {
        if (isMounted) setResolvedPermissions({});
      }
    };
    resolvePermissions();
    return () => {
      isMounted = false;
    };
  }, [currentUser]);

  const permissionKey = "quick::core_management::billing";
  const canCreate = canPerformAdminPermissionAction(currentUser, resolvedPermissions, permissionKey, "create");
  const canEdit = canPerformAdminPermissionAction(currentUser, resolvedPermissions, permissionKey, "edit");
  const canDelete = canPerformAdminPermissionAction(currentUser, resolvedPermissions, permissionKey, "delete");

  const [loading, setLoading] = useState(true);
  const [savingFeeSettings, setSavingFeeSettings] = useState(false);
  const [savingRule, setSavingRule] = useState(false);
  const [rulesLoading, setRulesLoading] = useState(true);
  const [feeSettings, setFeeSettings] = useState(initialFeeSettings);
  const [rules, setRules] = useState([]);
  const [editingRuleId, setEditingRuleId] = useState('');
  const [ruleForm, setRuleForm] = useState(initialRuleForm);

  const sortedRules = useMemo(
    () =>
      [...rules].sort(
        (a, b) => Number(a.minDistance || 0) - Number(b.minDistance || 0),
      ),
    [rules],
  );

  useEffect(() => {
    void Promise.all([loadFeeSettings(), loadRules()]);
  }, []);

  const loadFeeSettings = async () => {
    try {
      setLoading(true);
      const response = await adminApi.getFeeSettings();
      const settings = response?.data?.data?.feeSettings || response?.data?.result?.feeSettings || response?.data?.result || null;
      if (!settings) {
        setFeeSettings(initialFeeSettings);
        return;
      }
      setFeeSettings({
        deliveryFee: toInputValue(settings.deliveryFee),
        deliveryFeeRanges: Array.isArray(settings.deliveryFeeRanges) ? settings.deliveryFeeRanges : [],
        freeDeliveryThreshold: toInputValue(settings.freeDeliveryThreshold),
        platformFee: toInputValue(settings.platformFee),
        gstRate: toInputValue(settings.gstRate),
        returnDeliveryCommission: toInputValue(settings.returnDeliveryCommission),
        returnsEnabled: settings.returnsEnabled !== false,
        returnWindowDays: hoursToReturnWindowDays(settings.returnWindowHours),
      });
    } catch (error) {
      console.error('Failed to load quick fee settings', error);
      showToast('Failed to load fee settings', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadRules = async () => {
    try {
      setRulesLoading(true);
      const response = await adminApi.getDeliveryCommissionRules();
      const list =
        response?.data?.data?.commissions ||
        response?.data?.commissions ||
        [];
      setRules(Array.isArray(list) ? list : []);
    } catch (error) {
      console.error('Failed to load quick delivery commission rules', error);
      showToast('Failed to load delivery commission rules', 'error');
    } finally {
      setRulesLoading(false);
    }
  };

  const handleSaveFeeSettings = async () => {
    try {
      setSavingFeeSettings(true);
      const payload = {
        deliveryFee: toNullableNumber(feeSettings.deliveryFee),
        deliveryFeeRanges: [],
        freeDeliveryThreshold: toNullableNumber(feeSettings.freeDeliveryThreshold),
        platformFee: toNullableNumber(feeSettings.platformFee),
        gstRate: toNullableNumber(feeSettings.gstRate),
        returnDeliveryCommission: toNullableNumber(feeSettings.returnDeliveryCommission) ?? 0,
        returnsEnabled: Boolean(feeSettings.returnsEnabled),
        returnWindowHours: returnWindowDaysToHours(feeSettings.returnWindowDays),
        isActive: true,
      };
      const response = await adminApi.createOrUpdateFeeSettings(payload);
      const saved = response?.data?.data?.feeSettings;
      if (saved) {
        setFeeSettings({
          deliveryFee: toInputValue(saved.deliveryFee),
          deliveryFeeRanges: [],
          freeDeliveryThreshold: toInputValue(saved.freeDeliveryThreshold),
          platformFee: toInputValue(saved.platformFee),
          gstRate: toInputValue(saved.gstRate),
          returnDeliveryCommission: toInputValue(saved.returnDeliveryCommission),
          returnsEnabled: saved.returnsEnabled !== false,
          returnWindowDays: hoursToReturnWindowDays(saved.returnWindowHours),
        });
      }
      showToast('Quick fee settings saved successfully', 'success');
    } catch (error) {
      console.error('Failed to save quick fee settings', error);
      showToast(error?.response?.data?.message || 'Failed to save fee settings', 'error');
    } finally {
      setSavingFeeSettings(false);
    }
  };

  const resetRuleForm = () => {
    setEditingRuleId('');
    setRuleForm(initialRuleForm);
  };

  const handleEditRule = (rule) => {
    const isUnlimited = rule.maxDistance === null || rule.maxDistance === undefined;
    setEditingRuleId(rule._id);
    setRuleForm({
      name: rule.name || '',
      minDistance: toInputValue(rule.minDistance),
      maxDistance: isUnlimited ? '' : toInputValue(rule.maxDistance),
      maxDistanceUnlimited: isUnlimited,
      commissionPerKm: toInputValue(rule.commissionPerKm),
      basePayout: toInputValue(rule.basePayout),
    });
  };

  const handleSaveRule = async () => {
    const minDistance = Number(ruleForm.minDistance || 0);
    const maxDistance =
      ruleForm.maxDistanceUnlimited || ruleForm.maxDistance === ''
        ? null
        : Number(ruleForm.maxDistance);
    const commissionPerKm = Number(ruleForm.commissionPerKm || 0);

    // Non-base slabs (minDistance > 0) MUST have basePayout as 0
    const basePayout = minDistance === 0 ? Number(ruleForm.basePayout || 0) : 0;

    if (![minDistance, commissionPerKm, basePayout].every(Number.isFinite)) {
      showToast('Please fill all required commission rule fields', 'error');
      return;
    }

    try {
      setSavingRule(true);
      const payload = {
        name: ruleForm.name.trim() || `${minDistance === 0 ? 'Base' : 'Slab'} (${minDistance}${maxDistance === null ? '+' : `-${maxDistance}`} km)`,
        minDistance,
        maxDistance,
        commissionPerKm,
        basePayout,
        status: true,
      };

      if (editingRuleId) {
        await adminApi.updateDeliveryCommissionRule(editingRuleId, payload);
        showToast('Distance slab updated successfully', 'success');
      } else {
        await adminApi.createDeliveryCommissionRule(payload);
        showToast('Distance slab created successfully', 'success');
      }

      resetRuleForm();
      await loadRules();
    } catch (error) {
      console.error('Failed to save quick delivery commission rule', error);
      showToast(error?.response?.data?.message || 'Failed to save slab', 'error');
    } finally {
      setSavingRule(false);
    }
  };

  const handleDeleteRule = async (ruleId) => {
    try {
      await adminApi.deleteDeliveryCommissionRule(ruleId);
      setRules((prev) => prev.filter((rule) => rule._id !== ruleId));
      if (editingRuleId === ruleId) resetRuleForm();
      showToast('Distance slab deleted successfully', 'success');
    } catch (error) {
      console.error('Failed to delete quick delivery commission rule', error);
      showToast(error?.response?.data?.message || 'Failed to delete slab', 'error');
    }
  };

  const handleToggleRuleStatus = async (rule) => {
    try {
      await adminApi.toggleDeliveryCommissionRuleStatus(rule._id, !rule.status);
      setRules((prev) =>
        prev.map((item) =>
          item._id === rule._id ? { ...item, status: !rule.status } : item,
        ),
      );
      showToast('Slab status updated', 'success');
    } catch (error) {
      console.error('Failed to toggle quick delivery commission rule', error);
      showToast(error?.response?.data?.message || 'Failed to update status', 'error');
    }
  };

  const isBaseSlab = Number(ruleForm.minDistance || 0) === 0;

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="admin-h1">Quick Billing Settings</h1>
          <p className="admin-description mt-1">
            Food admin fee settings aur delivery commission slabs ke same quick-commerce controls.
          </p>
        </div>
      </div>

      <Card className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
              <Settings className="h-5 w-5 text-primary" />
              Fee Settings
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Order value ke hisaab se delivery fee, platform fee, GST aur return commission set karein.
            </p>
          </div>
          <button
            onClick={handleSaveFeeSettings}
            disabled={loading || savingFeeSettings}
            className={cn(
              'inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold text-white',
              savingFeeSettings ? 'bg-primary/90' : 'bg-primary hover:bg-primary/90',
            )}
          >
            {savingFeeSettings ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Settings
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
          </div>
        ) : (
          <div className="space-y-8 p-6">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
              {[
                ['deliveryFee', 'Default Delivery Fee'],
                ['freeDeliveryThreshold', 'Free Delivery Threshold'],
                ['platformFee', 'Platform Fee'],
                ['gstRate', 'GST Rate (%)'],
              ].map(([field, label]) => (
                <label key={field} className="space-y-2">
                  <span className="text-sm font-semibold text-slate-700">{label}</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={feeSettings[field]}
                    onChange={(e) =>
                      setFeeSettings((prev) => ({ ...prev, [field]: e.target.value }))
                    }
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary"
                  />
                </label>
              ))}
            </div>

            <label className="block max-w-sm space-y-2">
              <span className="text-sm font-semibold text-slate-700">Return Delivery Commission</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={feeSettings.returnDeliveryCommission}
                onChange={(e) =>
                  setFeeSettings((prev) => ({
                    ...prev,
                    returnDeliveryCommission: e.target.value,
                  }))
                }
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-500"
              />
            </label>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Return Settings</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Control whether customers can request returns and how long after delivery.
                </p>
              </div>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(feeSettings.returnsEnabled)}
                  onChange={(e) =>
                    setFeeSettings((prev) => ({ ...prev, returnsEnabled: e.target.checked }))
                  }
                  className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                />
                <span className="text-sm font-semibold text-slate-700">Enable Returns</span>
              </label>

              <div className="space-y-2">
                <span className="text-sm font-semibold text-slate-700">Return Window (Days)</span>
                <div className="flex flex-wrap gap-2">
                  {RETURN_WINDOW_DAY_PRESETS.map((days) => (
                    <button
                      key={days}
                      type="button"
                      onClick={() =>
                        setFeeSettings((prev) => ({ ...prev, returnWindowDays: days }))
                      }
                      className={cn(
                        'rounded-xl border px-4 py-2 text-sm font-bold transition-colors',
                        Number(feeSettings.returnWindowDays) === days
                          ? 'border-primary bg-primary text-white'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300',
                      )}
                    >
                      {days}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-slate-500">
                  Stored as {returnWindowDaysToHours(feeSettings.returnWindowDays)} hours (
                  {feeSettings.returnWindowDays} day{Number(feeSettings.returnWindowDays) === 1 ? '' : 's'}).
                </p>
              </div>
            </div>

            {/* Delivery Fee Ranges removed as requested */}
          </div>
        )}
      </Card>

      <Card className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-5">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <Truck className="h-5 w-5 text-sky-600" />
            Distance-Based Delivery Fee Slabs
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Define delivery fee slabs based on the delivery distance. The user will be charged the exact fee configured for their distance slab.
          </p>
        </div>

        <div className="space-y-6 p-6">
          {/* Slab Add/Edit form styled exactly as FeeSettings.jsx */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 shadow-xs">
            <div className="flex items-center gap-2 mb-3">
              <Plus className="w-4 h-4 text-green-600" />
              <h4 className="text-sm font-semibold text-slate-700">
                {editingRuleId === '' ? "Add Distance Slab" : "Edit Distance Slab"}
              </h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

              {/* Min Distance (KM) */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Min Distance (KM)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={ruleForm.minDistance}
                  onChange={(e) => {
                    const val = e.target.value;
                    setRuleForm((prev) => {
                      const newMin = Number(val || 0);
                      const isBase = newMin === 0;
                      const currentFee = Number(prev.minDistance || 0) === 0 ? prev.basePayout : prev.commissionPerKm;
                      return {
                        ...prev,
                        minDistance: val,
                        basePayout: isBase ? currentFee : '0',
                        commissionPerKm: isBase ? '0' : currentFee,
                      };
                    });
                  }}
                  placeholder="0"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none transition-all bg-white text-slate-800"
                />
              </div>

              {/* To Distance (KM) */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">To Distance (KM)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={ruleForm.maxDistance}
                  disabled={ruleForm.maxDistanceUnlimited}
                  onChange={(e) => setRuleForm((prev) => ({ ...prev, maxDistance: e.target.value }))}
                  placeholder="5"
                  className={cn(
                    "w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-green-500 outline-none transition-all text-slate-800",
                    ruleForm.maxDistanceUnlimited
                      ? "border-slate-100 bg-slate-100/50 text-slate-400 cursor-not-allowed"
                      : "border-slate-300 bg-white"
                  )}
                />
                <label className="flex items-center gap-2 mt-2 text-xs font-medium text-slate-500 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={ruleForm.maxDistanceUnlimited}
                    onChange={(e) =>
                      setRuleForm((prev) => ({
                        ...prev,
                        maxDistanceUnlimited: e.target.checked,
                        maxDistance: e.target.checked ? '' : prev.maxDistance,
                      }))
                    }
                    className="rounded border-slate-300 text-green-600 focus:ring-green-500 w-3.5 h-3.5"
                  />
                  Max distance unlimited
                </label>
              </div>

              {/* Delivery Fee (₹) */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Delivery Fee (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={Number(ruleForm.minDistance || 0) === 0 ? ruleForm.basePayout : ruleForm.commissionPerKm}
                  onChange={(e) => {
                    const val = e.target.value;
                    setRuleForm((prev) => {
                      const isBase = Number(prev.minDistance || 0) === 0;
                      return {
                        ...prev,
                        basePayout: isBase ? val : '0',
                        commissionPerKm: isBase ? '0' : val,
                      };
                    });
                  }}
                  placeholder="60"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none transition-all bg-white text-slate-800"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-4">
              {editingRuleId && canEdit && (
                <button
                  onClick={resetRuleForm}
                  className="border border-slate-300 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors bg-white shadow-xs"
                >
                  <X className="w-4 h-4" />
                  Cancel
                </button>
              )}
              {((editingRuleId && canEdit) || (!editingRuleId && canCreate)) && (
                <button
                  onClick={handleSaveRule}
                  disabled={savingRule}
                  className="bg-primary hover:bg-primary/90 text-white px-5 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors disabled:bg-primary/50 shadow-sm"
                >
                  {savingRule ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : editingRuleId ? (
                    <>
                      <Check className="w-4 h-4" />
                      Save Slab
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      Add Slab
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto mt-6">
            <table className="w-full border border-slate-200 rounded-lg">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700 border-b border-slate-200">Min Distance (KM)</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700 border-b border-slate-200">To distance (KM)</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700 border-b border-slate-200">Delivery Fee (₹)</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-slate-700 border-b border-slate-200">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rulesLoading ? (
                  <tr>
                    <td colSpan="4" className="px-4 py-8 text-center border-b border-slate-100">
                      <Loader2 className="mx-auto h-5 w-5 animate-spin text-green-600" />
                    </td>
                  </tr>
                ) : sortedRules.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="px-4 py-8 text-center text-slate-400 border-b border-slate-100">
                      No distance delivery slabs configured.
                    </td>
                  </tr>
                ) : (
                  sortedRules.map((rule) => {
                    const fee = Number(rule.minDistance) === 0 ? rule.basePayout : rule.commissionPerKm;
                    return (
                      <tr key={rule._id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3 text-sm border-b border-slate-100">{Number(rule.minDistance).toFixed(1)} KM</td>
                        <td className="px-4 py-3 text-sm border-b border-slate-100">
                          {rule.maxDistance === null || rule.maxDistance === undefined
                            ? 'Unlimited'
                            : `${Number(rule.maxDistance).toFixed(1)} KM`}
                        </td>
                        <td className="px-4 py-3 text-sm border-b border-slate-100 font-semibold text-emerald-700">₹{Number(fee || 0).toFixed(2)}</td>
                        <td className="px-4 py-3 text-center border-b border-slate-100">
                          <div className="flex items-center justify-center gap-2">
                            {canEdit && (
                              <button
                                onClick={() => handleEditRule(rule)}
                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                title="Edit"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                            )}
                            {canDelete && (
                              <button
                                onClick={() => handleDeleteRule(rule._id)}
                                className="p-1.5 text-slate-900 hover:bg-red-50 rounded transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Card>
    </div>
  );
}
