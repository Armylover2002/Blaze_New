import React, { useMemo } from "react";
import { ArrowLeft, Clock, Heart, Minus, Plus, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  getMedicineMeta,
  formatPharmacyDate,
  getVariantDisplayLabel,
  getVariantKey,
} from "./pharmacyProductMeta";

const InfoRow = ({ label, value }) => {
  if (!value || value === "—") return null;
  return (
    <div className="flex flex-col gap-1 py-3 border-b border-slate-100 last:border-0">
      <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
        {label}
      </span>
      <span className="text-base font-semibold text-slate-800">{value}</span>
    </div>
  );
};

const SectionCard = ({ title, children }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-6 shadow-sm">
    <h2 className="text-sm font-black uppercase tracking-[0.2em] text-red-600 mb-4">
      {title}
    </h2>
    <div className="divide-y divide-slate-50">{children}</div>
  </div>
);

const PharmacyProductDetailsView = ({
  product,
  meta: metaProp,
  selectedVariant,
  onVariantChange,
  activeImage,
  onImageSelect,
  quantity,
  isWishlisted,
  onToggleWishlist,
  onAddToCart,
  onIncrement,
  onDecrement,
  onBack,
  stock,
}) => {
  const meta = useMemo(
    () => metaProp || getMedicineMeta(product, selectedVariant),
    [metaProp, product, selectedVariant],
  );

  const showVariantSelector = meta.variants.length > 1;

  const discountPercent = meta.hasDiscount
    ? Math.round(((meta.mrp - meta.sellingPrice) / meta.mrp) * 100)
    : 0;

  return (
    <div className="relative z-10 mx-auto w-full max-w-[1920px] animate-in px-4 py-4 fade-in duration-700 md:px-[50px] md:py-8">
      <button
        onClick={onBack}
        className="group mb-6 inline-flex items-center gap-2 font-bold text-slate-500 transition-colors hover:text-red-600"
      >
        <ArrowLeft size={20} className="transition-transform group-hover:-translate-x-1" />
        Back
      </button>

      <div className="flex flex-col gap-8 lg:flex-row lg:gap-12">
        {/* Gallery */}
        <div className="space-y-3 lg:w-[42%]">
          <div className="relative aspect-square overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
            <img
              src={activeImage || meta.image}
              alt={meta.brandName}
              className="h-full w-full object-contain p-6"
            />
            <button
              onClick={onToggleWishlist}
              className={cn(
                "absolute right-4 top-4 rounded-full p-3 shadow-lg transition-all",
                isWishlisted
                  ? "bg-red-50 text-red-500"
                  : "bg-white text-slate-400",
              )}
            >
              <Heart size={20} fill={isWishlisted ? "currentColor" : "none"} />
            </button>
            <span
              className={cn(
                "absolute left-4 top-4 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase",
                meta.rxOtc === "Rx"
                  ? "bg-violet-100 text-violet-700"
                  : "bg-sky-100 text-sky-700",
              )}
            >
              {meta.rxOtc}
            </span>
          </div>
          {product?.images?.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {product.images.map((image, index) => (
                <button
                  key={`${image}-${index}`}
                  onClick={() => onImageSelect(image)}
                  className={cn(
                    "h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl border-2",
                    activeImage === image
                      ? "border-red-600"
                      : "border-transparent opacity-70",
                  )}
                >
                  <img src={image} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Summary + actions */}
        <div className="space-y-5 lg:w-[58%]">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-red-600 mb-1">
              Medicine
            </p>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 leading-tight">
              {meta.brandName}
            </h1>
            {meta.genericName && (
              <p className="mt-1 text-base font-medium text-slate-500">
                {meta.genericName}
              </p>
            )}
            {meta.manufacturer && (
              <p className="mt-1 text-sm font-semibold text-slate-600">
                {meta.manufacturer}
              </p>
            )}
            {meta.strengthDosageLine && (
              <p className="mt-2 text-sm font-bold text-slate-700">
                {meta.strengthDosageLine}
              </p>
            )}
            {meta.packLine && (
              <p className="text-sm text-slate-500">{meta.packLine}</p>
            )}
          </div>

          {showVariantSelector && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-3">
                Select Pack
              </h3>
              <div className="flex flex-wrap gap-2">
                {meta.variants.map((variant, index) => {
                  const isSelected =
                    getVariantKey(variant) === getVariantKey(selectedVariant);
                  const label = getVariantDisplayLabel(variant, product);
                  const variantSale = Number(variant.salePrice || 0);
                  const variantPrice = Number(variant.price || 0);
                  const displayPrice =
                    variantSale > 0 ? variantSale : variantPrice;

                  return (
                    <button
                      key={getVariantKey(variant) || index}
                      type="button"
                      onClick={() => onVariantChange?.(variant)}
                      className={cn(
                        "rounded-xl border-2 px-3 py-2 text-left transition-all min-w-[120px]",
                        isSelected
                          ? "border-red-600 bg-red-50 shadow-sm"
                          : "border-slate-200 bg-white hover:border-red-300",
                      )}
                    >
                      <span
                        className={cn(
                          "block text-xs font-bold leading-snug",
                          isSelected ? "text-red-800" : "text-slate-800",
                        )}
                      >
                        {label}
                      </span>
                      {displayPrice > 0 && (
                        <span className="mt-0.5 block text-[11px] font-semibold text-red-600">
                          ₹{displayPrice.toLocaleString("en-IN")}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex items-baseline gap-3 flex-wrap">
            <span className="text-3xl font-black text-red-600">
              ₹{meta.sellingPrice.toLocaleString("en-IN")}
            </span>
            {meta.hasDiscount && (
              <>
                <span className="text-lg text-slate-400 line-through font-bold">
                  ₹{meta.mrp.toLocaleString("en-IN")}
                </span>
                <span className="rounded-lg bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-700">
                  {discountPercent}% OFF
                </span>
              </>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 flex flex-col sm:flex-row items-center gap-4">
            <div className="w-full sm:w-64">
              {quantity > 0 ? (
                <div className="flex h-14 w-full items-center rounded-xl bg-red-600 px-2 text-white">
                  <button
                    onClick={onDecrement}
                    className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-white/15"
                  >
                    <Minus size={22} strokeWidth={3} />
                  </button>
                  <span className="flex-1 text-center text-lg font-black">{quantity}</span>
                  <button
                    disabled={quantity >= stock}
                    onClick={onIncrement}
                    className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-white/15 disabled:opacity-40"
                  >
                    <Plus size={22} strokeWidth={3} />
                  </button>
                </div>
              ) : (
                <Button
                  onClick={onAddToCart}
                  className="h-14 w-full rounded-xl bg-red-600 text-base font-black hover:bg-red-700"
                >
                  <Plus className="mr-2" size={20} strokeWidth={3} />
                  ADD TO CART
                </Button>
              )}
            </div>
            <div className="text-center sm:text-left text-sm text-slate-500">
              <span className="flex items-center justify-center sm:justify-start gap-1 font-semibold text-red-600">
                <ShieldCheck size={14} />
                {stock > 0 ? `${stock} in stock` : "Out of stock"}
              </span>
              {product?.deliveryTime && (
                <span className="flex items-center justify-center sm:justify-start gap-1 mt-1">
                  <Clock size={14} />
                  {product.deliveryTime}
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SectionCard title="Basic Information">
              <InfoRow label="Product Name" value={meta.brandName} />
              <InfoRow label="Generic Name" value={meta.genericName || "—"} />
              <InfoRow label="Manufacturer" value={meta.manufacturer || "—"} />
            </SectionCard>

            <SectionCard title="Medicine Information">
              <InfoRow label="Composition" value={meta.composition || "—"} />
              <InfoRow label="Strength" value={meta.strength || "—"} />
              <InfoRow label="Dosage Form" value={meta.dosageFormLabel || "—"} />
              <InfoRow label="Pack Type" value={meta.packTypeLabel || "—"} />
              <InfoRow
                label="Pack Quantity"
                value={meta.packQuantity !== "" && meta.packQuantity != null ? String(meta.packQuantity) : "—"}
              />
              <InfoRow label="Unit" value={meta.unitLabel || meta.unit || "—"} />
            </SectionCard>

            <SectionCard title="Regulatory Information">
              <InfoRow label="Rx / OTC" value={meta.rxOtc} />
              <InfoRow
                label="Drug Classification"
                value={meta.drugClassificationLabel || meta.drugClassification || "—"}
              />
            </SectionCard>

            <SectionCard title="Storage Information">
              <InfoRow label="Storage Condition" value={meta.storageCondition || "—"} />
            </SectionCard>

            <SectionCard title="Batch Information">
              <InfoRow label="Batch Number" value={meta.batchNumber || "—"} />
              <InfoRow label="Manufacturing Date" value={formatPharmacyDate(meta.mfgDate)} />
              <InfoRow label="Expiry Date" value={formatPharmacyDate(meta.expDate)} />
            </SectionCard>

            <SectionCard title="Pricing">
              <InfoRow label="MRP" value={`₹${meta.mrp.toLocaleString("en-IN")}`} />
              <InfoRow
                label="Selling Price"
                value={`₹${meta.sellingPrice.toLocaleString("en-IN")}`}
              />
            </SectionCard>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PharmacyProductDetailsView;
