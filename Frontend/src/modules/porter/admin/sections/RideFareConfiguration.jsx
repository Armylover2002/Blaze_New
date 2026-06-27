import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import { Calculator, RotateCcw, Save, Info } from "lucide-react";
import {
  SectionCard, FormLayout, FormSection, FormRow, FormField, StatusBadge,
} from "@/shared/components/admin";
import Button from "@/shared/components/ui/Button";
import Input from "@/shared/components/ui/Input";
import {
  RIDE_VEHICLE_TYPES, RIDE_TYPES, VEHICLE_CATEGORIES, COUPON_APPLIES_ON,
  DEFAULT_RIDE_FARE_CONFIG, getRideFareConfigForVehicle,
} from "../utils/mock/rideFareConfig";
import { calculateRideFarePreview, validateRideFareConfig } from "../utils/rideFareCalculations";
import { formatCurrency } from "../utils/porterTableHelpers";

const selectCls = "w-full h-10 px-3 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:border-red-500 focus:ring-4 focus:ring-red-500/10";

function CurrencyInput({ value, onChange, ...props }) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₹</span>
      <Input className="pl-7" type="number" min="0" value={value} onChange={onChange} {...props} />
    </div>
  );
}

function PercentInput({ value, onChange, ...props }) {
  return (
    <div className="relative">
      <Input className="pr-8" type="number" min="0" max="100" value={value} onChange={onChange} {...props} />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
    </div>
  );
}

function ToggleField({ label, checked, onChange, hint }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer rounded-lg border p-3 hover:bg-muted/30 transition-colors">
      <input type="checkbox" className="mt-1" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <div>
        <span className="text-sm font-medium">{label}</span>
        {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
      </div>
    </label>
  );
}

function Hint({ children }) {
  return <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1"><Info size={12} />{children}</p>;
}

export default function RideFareConfiguration() {
  const [config, setConfig] = useState(() => JSON.parse(JSON.stringify(DEFAULT_RIDE_FARE_CONFIG)));
  const [errors, setErrors] = useState({});
  const [dirty, setDirty] = useState(false);
  const [preview, setPreview] = useState({
    distanceKm: 8, rideTimeMinutes: 25, waitingMinutes: 5,
    applyPeak: false, applyNight: false, couponDiscount: 0,
  });

  const set = (section, field, value) => {
    setConfig((prev) => ({ ...prev, [section]: { ...prev[section], [field]: value } }));
    setDirty(true);
  };

  const handleVehicleChange = (vehicle) => {
    setConfig(getRideFareConfigForVehicle(vehicle));
    setDirty(true);
    setErrors({});
  };

  const breakdown = useMemo(() => calculateRideFarePreview(config, preview), [config, preview]);

  const handleSave = () => {
    const e = validateRideFareConfig(config);
    setErrors(e);
    if (Object.keys(e).length) {
      toast.error("Please fix validation errors before saving");
      return;
    }
    toast.success(`Ride fare configuration saved for ${config.vehicle}`);
    setDirty(false);
  };

  const handleReset = () => {
    setConfig(getRideFareConfigForVehicle(config.vehicle));
    setErrors({});
    setDirty(false);
    toast.info("Unsaved changes discarded");
  };

  const handleRestoreDefault = () => {
    setConfig(JSON.parse(JSON.stringify(DEFAULT_RIDE_FARE_CONFIG)));
    setErrors({});
    setDirty(true);
    toast.info("Restored to default Bike configuration");
  };

  return (
    <>
      <SectionCard
        title="Ride Fare Configuration"
        subtitle="Configure all fare rules that will be applied automatically on every Porter ride."
        icon={<Calculator size={18} />}
      >
        <div className="space-y-6">
          {/* Vehicle selector */}
          <FormField label="Vehicle" required error={errors.vehicle}>
            <select className={selectCls} value={config.vehicle} onChange={(e) => handleVehicleChange(e.target.value)}>
              {RIDE_VEHICLE_TYPES.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
            <Hint>Select a vehicle to load its fare preset. All fields are editable.</Hint>
          </FormField>

          <FormSection title="Basic Fare">
            <FormRow>
              <FormField label="Base Fare" required error={errors.baseFare}>
                <CurrencyInput value={config.basicFare.baseFare} onChange={(e) => set("basicFare", "baseFare", Number(e.target.value))} />
              </FormField>
              <FormField label="Ride Type">
                <select className={selectCls} value={config.basicFare.rideType} onChange={(e) => set("basicFare", "rideType", e.target.value)}>
                  {RIDE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </FormField>
            </FormRow>
            <FormRow>
              <FormField label="Vehicle Category">
                <select className={selectCls} value={config.basicFare.vehicleCategory} onChange={(e) => set("basicFare", "vehicleCategory", e.target.value)}>
                  {VEHICLE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </FormField>
              <FormField label="Minimum Fare">
                <CurrencyInput value={config.basicFare.minimumFare} onChange={(e) => set("basicFare", "minimumFare", Number(e.target.value))} />
              </FormField>
            </FormRow>
            <FormRow>
              <FormField label="Maximum Fare (Optional)">
                <CurrencyInput value={config.basicFare.maximumFare} onChange={(e) => set("basicFare", "maximumFare", e.target.value)} placeholder="No limit" />
              </FormField>
              <FormField label="Currency">
                <Input value="INR (₹)" readOnly className="bg-muted/50 cursor-not-allowed" />
              </FormField>
            </FormRow>
          </FormSection>

          <FormSection title="Distance Pricing">
            <ToggleField label="Enable Distance Based Pricing" checked={config.distancePricing.enabled} onChange={(v) => set("distancePricing", "enabled", v)} hint="Bill extra KM beyond included distance" />
            <FormRow cols={3}>
              <FormField label="Base Distance (KM)"><Input type="number" min="0" value={config.distancePricing.baseDistanceKm} onChange={(e) => set("distancePricing", "baseDistanceKm", Number(e.target.value))} /></FormField>
              <FormField label="Included Distance" hint="Free KM included in base fare"><Input type="number" min="0" value={config.distancePricing.includedDistanceKm} onChange={(e) => set("distancePricing", "includedDistanceKm", Number(e.target.value))} /></FormField>
              <FormField label="Price Per KM" required error={errors.pricePerKm}><CurrencyInput value={config.distancePricing.pricePerKm} onChange={(e) => set("distancePricing", "pricePerKm", Number(e.target.value))} /></FormField>
            </FormRow>
            <FormRow>
              <FormField label="Minimum Distance"><Input type="number" min="0" value={config.distancePricing.minimumDistanceKm} onChange={(e) => set("distancePricing", "minimumDistanceKm", Number(e.target.value))} /></FormField>
              <FormField label="Maximum Distance"><Input type="number" min="0" value={config.distancePricing.maximumDistanceKm} onChange={(e) => set("distancePricing", "maximumDistanceKm", Number(e.target.value))} /></FormField>
            </FormRow>
          </FormSection>

          <FormSection title="Time Pricing">
            <FormRow cols={3}>
              <FormField label="Price Per Minute"><CurrencyInput value={config.timePricing.pricePerMinute} onChange={(e) => set("timePricing", "pricePerMinute", Number(e.target.value))} /></FormField>
              <FormField label="Waiting Charge / Min"><CurrencyInput value={config.timePricing.waitingChargePerMinute} onChange={(e) => set("timePricing", "waitingChargePerMinute", Number(e.target.value))} /></FormField>
              <FormField label="Loading Time Free (Min)"><Input type="number" min="0" value={config.timePricing.loadingTimeFreeMinutes} onChange={(e) => set("timePricing", "loadingTimeFreeMinutes", Number(e.target.value))} /></FormField>
            </FormRow>
            <FormRow cols={3}>
              <FormField label="Loading Charge / Min"><CurrencyInput value={config.timePricing.loadingChargePerMinute} onChange={(e) => set("timePricing", "loadingChargePerMinute", Number(e.target.value))} /></FormField>
              <FormField label="Unloading Time Free"><Input type="number" min="0" value={config.timePricing.unloadingTimeFreeMinutes} onChange={(e) => set("timePricing", "unloadingTimeFreeMinutes", Number(e.target.value))} /></FormField>
              <FormField label="Unloading Charge / Min"><CurrencyInput value={config.timePricing.unloadingChargePerMinute} onChange={(e) => set("timePricing", "unloadingChargePerMinute", Number(e.target.value))} /></FormField>
            </FormRow>
          </FormSection>

          <FormSection title="Driver Earnings">
            <FormRow cols={3}>
              <FormField label="Minimum Driver Earning"><CurrencyInput value={config.driverEarnings.minimumDriverEarning} onChange={(e) => set("driverEarnings", "minimumDriverEarning", Number(e.target.value))} /></FormField>
              <FormField label="Guaranteed Driver Earnings"><CurrencyInput value={config.driverEarnings.guaranteedDriverEarnings} onChange={(e) => set("driverEarnings", "guaranteedDriverEarnings", Number(e.target.value))} /></FormField>
              <FormField label="Surge Share %"><PercentInput value={config.driverEarnings.surgeSharePercent} onChange={(e) => set("driverEarnings", "surgeSharePercent", Number(e.target.value))} /></FormField>
            </FormRow>
            <FormRow cols={3}>
              <FormField label="Night Bonus"><CurrencyInput value={config.driverEarnings.nightBonus} onChange={(e) => set("driverEarnings", "nightBonus", Number(e.target.value))} /></FormField>
              <FormField label="Peak Bonus"><CurrencyInput value={config.driverEarnings.peakBonus} onChange={(e) => set("driverEarnings", "peakBonus", Number(e.target.value))} /></FormField>
              <FormField label="Incentive"><CurrencyInput value={config.driverEarnings.incentive} onChange={(e) => set("driverEarnings", "incentive", Number(e.target.value))} /></FormField>
            </FormRow>
          </FormSection>

          <FormSection title="Admin Earnings">
            <FormRow>
              <FormField label="Admin Commission Type" required error={errors.commission}>
                <select className={selectCls} value={config.adminEarnings.commissionType} onChange={(e) => set("adminEarnings", "commissionType", e.target.value)}>
                  <option value="percentage">Percentage</option>
                  <option value="fixed">Fixed</option>
                  <option value="hybrid">Hybrid</option>
                </select>
              </FormField>
              {(config.adminEarnings.commissionType === "percentage" || config.adminEarnings.commissionType === "hybrid") && (
                <FormField label="Commission %"><PercentInput value={config.adminEarnings.commissionPercentage} onChange={(e) => set("adminEarnings", "commissionPercentage", Number(e.target.value))} /></FormField>
              )}
              {(config.adminEarnings.commissionType === "fixed" || config.adminEarnings.commissionType === "hybrid") && (
                <FormField label="Commission Value (₹)"><CurrencyInput value={config.adminEarnings.commissionFlat} onChange={(e) => set("adminEarnings", "commissionFlat", Number(e.target.value))} /></FormField>
              )}
            </FormRow>
            <FormRow cols={3}>
              <FormField label="Platform Fee"><CurrencyInput value={config.adminEarnings.platformFee} onChange={(e) => set("adminEarnings", "platformFee", Number(e.target.value))} /></FormField>
              <FormField label="Convenience Fee"><CurrencyInput value={config.adminEarnings.convenienceFee} onChange={(e) => set("adminEarnings", "convenienceFee", Number(e.target.value))} /></FormField>
              <FormField label="Technology Fee"><CurrencyInput value={config.adminEarnings.technologyFee} onChange={(e) => set("adminEarnings", "technologyFee", Number(e.target.value))} /></FormField>
            </FormRow>
            <FormRow cols={3}>
              <FormField label="Insurance Fee"><CurrencyInput value={config.adminEarnings.insuranceFee} onChange={(e) => set("adminEarnings", "insuranceFee", Number(e.target.value))} /></FormField>
              <FormField label="Service Tax (%)"><PercentInput value={config.adminEarnings.serviceTaxPercent} onChange={(e) => set("adminEarnings", "serviceTaxPercent", Number(e.target.value))} /></FormField>
              <FormField label="GST (%)" error={errors.gst}><PercentInput value={config.adminEarnings.gstPercent} onChange={(e) => set("adminEarnings", "gstPercent", Number(e.target.value))} /></FormField>
            </FormRow>
            <ToggleField label="Round Off Fare" checked={config.adminEarnings.roundOffFare} onChange={(v) => set("adminEarnings", "roundOffFare", v)} hint="Round final payable to nearest rupee" />
          </FormSection>

          <FormSection title="Peak Hour Pricing">
            <ToggleField label="Enable Peak Pricing" checked={config.peakHour.enabled} onChange={(v) => set("peakHour", "enabled", v)} />
            {config.peakHour.enabled && (
              <>
                <FormRow>
                  <FormField label="Morning Peak Start"><Input type="time" value={config.peakHour.morningStart} onChange={(e) => set("peakHour", "morningStart", e.target.value)} /></FormField>
                  <FormField label="Morning Peak End"><Input type="time" value={config.peakHour.morningEnd} onChange={(e) => set("peakHour", "morningEnd", e.target.value)} /></FormField>
                </FormRow>
                <FormRow>
                  <FormField label="Evening Peak Start"><Input type="time" value={config.peakHour.eveningStart} onChange={(e) => set("peakHour", "eveningStart", e.target.value)} /></FormField>
                  <FormField label="Evening Peak End"><Input type="time" value={config.peakHour.eveningEnd} onChange={(e) => set("peakHour", "eveningEnd", e.target.value)} /></FormField>
                </FormRow>
                <FormField label="Peak Multiplier" error={errors.peakMultiplier}>
                  <select className={selectCls} value={config.peakHour.peakMultiplier} onChange={(e) => set("peakHour", "peakMultiplier", Number(e.target.value))}>
                    <option value={1.2}>1.2x</option>
                    <option value={1.3}>1.3x</option>
                    <option value={1.5}>1.5x</option>
                    <option value={2}>2x</option>
                  </select>
                  <Hint>Applied to ride subtotal during peak hours</Hint>
                </FormField>
              </>
            )}
          </FormSection>

          <FormSection title="Night Charges">
            <ToggleField label="Enable Night Charges" checked={config.nightCharges.enabled} onChange={(v) => set("nightCharges", "enabled", v)} />
            {config.nightCharges.enabled && (
              <FormRow cols={3}>
                <FormField label="Night Start"><Input type="time" value={config.nightCharges.nightStart} onChange={(e) => set("nightCharges", "nightStart", e.target.value)} /></FormField>
                <FormField label="Night End"><Input type="time" value={config.nightCharges.nightEnd} onChange={(e) => set("nightCharges", "nightEnd", e.target.value)} /></FormField>
                <FormField label="Night Charge %" error={errors.nightCharge}><PercentInput value={config.nightCharges.nightChargePercent} onChange={(e) => set("nightCharges", "nightChargePercent", Number(e.target.value))} /></FormField>
                <FormField label="Flat Night Fee"><CurrencyInput value={config.nightCharges.flatNightFee} onChange={(e) => set("nightCharges", "flatNightFee", Number(e.target.value))} /></FormField>
              </FormRow>
            )}
          </FormSection>

          <FormSection title="Weekend Pricing">
            <ToggleField label="Enable Weekend Pricing" checked={config.weekendPricing.enabled} onChange={(v) => set("weekendPricing", "enabled", v)} />
            {config.weekendPricing.enabled && (
              <FormRow cols={3}>
                <FormField label="Saturday Multiplier"><Input type="number" step="0.05" min="1" value={config.weekendPricing.saturdayMultiplier} onChange={(e) => set("weekendPricing", "saturdayMultiplier", Number(e.target.value))} /></FormField>
                <FormField label="Sunday Multiplier"><Input type="number" step="0.05" min="1" value={config.weekendPricing.sundayMultiplier} onChange={(e) => set("weekendPricing", "sundayMultiplier", Number(e.target.value))} /></FormField>
                <FormField label="Holiday Multiplier"><Input type="number" step="0.05" min="1" value={config.weekendPricing.holidayMultiplier} onChange={(e) => set("weekendPricing", "holidayMultiplier", Number(e.target.value))} /></FormField>
              </FormRow>
            )}
          </FormSection>

          <FormSection title="Cancellation Charges">
            <FormRow cols={3}>
              <FormField label="Customer Cancellation Fee"><CurrencyInput value={config.cancellation.customerCancellationFee} onChange={(e) => set("cancellation", "customerCancellationFee", Number(e.target.value))} /></FormField>
              <FormField label="Driver Cancellation Penalty"><CurrencyInput value={config.cancellation.driverCancellationPenalty} onChange={(e) => set("cancellation", "driverCancellationPenalty", Number(e.target.value))} /></FormField>
              <FormField label="Free Cancellation Time (Min)"><Input type="number" min="0" value={config.cancellation.freeCancellationTimeMinutes} onChange={(e) => set("cancellation", "freeCancellationTimeMinutes", Number(e.target.value))} /></FormField>
            </FormRow>
            <FormField label="Late Cancellation Fee"><CurrencyInput value={config.cancellation.lateCancellationFee} onChange={(e) => set("cancellation", "lateCancellationFee", Number(e.target.value))} /></FormField>
          </FormSection>

          <FormSection title="Extra Charges">
            <FormRow cols={3}>
              <FormField label="Toll Charges"><CurrencyInput value={config.extraCharges.tollCharges} onChange={(e) => set("extraCharges", "tollCharges", Number(e.target.value))} /></FormField>
              <FormField label="Parking Charges"><CurrencyInput value={config.extraCharges.parkingCharges} onChange={(e) => set("extraCharges", "parkingCharges", Number(e.target.value))} /></FormField>
              <FormField label="State Tax"><CurrencyInput value={config.extraCharges.stateTax} onChange={(e) => set("extraCharges", "stateTax", Number(e.target.value))} /></FormField>
            </FormRow>
            <FormRow cols={3}>
              <FormField label="Intercity Charge"><CurrencyInput value={config.extraCharges.intercityCharge} onChange={(e) => set("extraCharges", "intercityCharge", Number(e.target.value))} /></FormField>
              <FormField label="Outstation Charge"><CurrencyInput value={config.extraCharges.outstationCharge} onChange={(e) => set("extraCharges", "outstationCharge", Number(e.target.value))} /></FormField>
              <FormField label="Return Trip Charge"><CurrencyInput value={config.extraCharges.returnTripCharge} onChange={(e) => set("extraCharges", "returnTripCharge", Number(e.target.value))} /></FormField>
            </FormRow>
            <FormRow>
              <FormField label="Extra Stop Charge"><CurrencyInput value={config.extraCharges.extraStopCharge} onChange={(e) => set("extraCharges", "extraStopCharge", Number(e.target.value))} /></FormField>
              <FormField label="Extra Stop Price"><CurrencyInput value={config.extraCharges.extraStopPrice} onChange={(e) => set("extraCharges", "extraStopPrice", Number(e.target.value))} /></FormField>
            </FormRow>
          </FormSection>

          <FormSection title="Coupon Support">
            <ToggleField label="Allow Coupons" checked={config.couponSupport.allowCoupons} onChange={(v) => set("couponSupport", "allowCoupons", v)} hint="Frontend preview only — no API" />
            {config.couponSupport.allowCoupons && (
              <FormRow cols={3}>
                <FormField label="Maximum Discount"><CurrencyInput value={config.couponSupport.maximumDiscount} onChange={(e) => set("couponSupport", "maximumDiscount", Number(e.target.value))} /></FormField>
                <FormField label="Minimum Ride Amount"><CurrencyInput value={config.couponSupport.minimumRideAmount} onChange={(e) => set("couponSupport", "minimumRideAmount", Number(e.target.value))} /></FormField>
                <FormField label="Coupon Applies On">
                  <select className={selectCls} value={config.couponSupport.couponAppliesOn} onChange={(e) => set("couponSupport", "couponAppliesOn", e.target.value)}>
                    {COUPON_APPLIES_ON.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </FormField>
              </FormRow>
            )}
          </FormSection>

          {/* Fare Preview Calculator */}
          <div className="rounded-xl border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent p-5 space-y-4 transition-all duration-300">
            <div className="flex items-center gap-2">
              <Calculator size={20} className="text-primary" />
              <h3 className="font-semibold text-base">Fare Preview Calculator</h3>
              <StatusBadge status="active" label="Live" />
            </div>
            <FormRow cols={3}>
              <FormField label="Distance (km)"><Input type="number" min="0" value={preview.distanceKm} onChange={(e) => setPreview({ ...preview, distanceKm: Number(e.target.value) })} /></FormField>
              <FormField label="Ride Time (min)"><Input type="number" min="0" value={preview.rideTimeMinutes} onChange={(e) => setPreview({ ...preview, rideTimeMinutes: Number(e.target.value) })} /></FormField>
              <FormField label="Waiting (min)"><Input type="number" min="0" value={preview.waitingMinutes} onChange={(e) => setPreview({ ...preview, waitingMinutes: Number(e.target.value) })} /></FormField>
            </FormRow>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={preview.applyPeak} onChange={(e) => setPreview({ ...preview, applyPeak: e.target.checked })} /> Peak</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={preview.applyNight} onChange={(e) => setPreview({ ...preview, applyNight: e.target.checked })} /> Night</label>
              <FormField label="Coupon Discount (₹)" className="max-w-[180px]">
                <CurrencyInput value={preview.couponDiscount} onChange={(e) => setPreview({ ...preview, couponDiscount: Number(e.target.value) })} />
              </FormField>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5 text-sm">
                {[
                  ["Base Fare", breakdown.baseFare],
                  ["Distance Fare", breakdown.distanceFare],
                  ["Time Fare", breakdown.timeFare],
                  ["Waiting Charge", breakdown.waitingCharge],
                  ["Platform Fee", breakdown.platformFee],
                  ["Admin Commission", breakdown.adminCommission],
                  ["Taxes (GST + Service)", breakdown.taxes],
                  ["Discount", -breakdown.discount],
                ].map(([label, val]) => (
                  <div key={label} className="flex justify-between py-0.5">
                    <span className="text-muted-foreground">{label}</span>
                    <span className={val < 0 ? "text-green-600" : ""}>{formatCurrency(Math.abs(val))}{val < 0 ? " off" : ""}</span>
                  </div>
                ))}
              </div>
              <div className="rounded-lg bg-white border p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="font-semibold">Final Payable</span>
                  <span className="text-2xl font-bold text-primary">{formatCurrency(breakdown.finalPayable)}</span>
                </div>
                <div className="border-t pt-3 space-y-1.5 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Driver Earnings</span><span className="font-semibold text-green-700">{formatCurrency(breakdown.driverEarnings)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Admin Earnings</span><span className="font-semibold">{formatCurrency(breakdown.adminEarnings)}</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* Sticky Save Bar */}
      <div className={`fixed bottom-0 left-0 right-0 z-40 border-t bg-white/95 backdrop-blur px-4 py-3 shadow-lg transition-transform duration-300 ${dirty ? "translate-y-0" : "translate-y-0"}`}>
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {dirty ? "You have unsaved fare configuration changes" : `Configuring fare for ${config.vehicle}`}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleRestoreDefault}><RotateCcw size={14} className="mr-1" /> Restore Default</Button>
            <Button variant="outline" size="sm" onClick={handleReset} disabled={!dirty}>Reset</Button>
            <Button size="sm" onClick={handleSave}><Save size={14} className="mr-1" /> Save Configuration</Button>
          </div>
        </div>
      </div>
    </>
  );
}
