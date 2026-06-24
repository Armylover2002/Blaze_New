import React from "react";
import { cn } from "@/lib/utils";
import { getMedicineMeta } from "./pharmacyProductMeta";

const Line = ({ children, className }) => {
  if (!children) return null;
  return (
    <p className={cn("text-[11px] md:text-xs text-slate-600 leading-snug", className)}>
      {children}
    </p>
  );
};

/**
 * Compact medicine metadata lines for cards and list rows.
 */
const PharmacyMetaLines = React.memo(({
  product,
  meta: metaProp,
  showGeneric = true,
  showManufacturer = false,
  showStrengthDosage = true,
  showPack = true,
  className,
}) => {
  const meta = metaProp || getMedicineMeta(product);

  return (
    <div className={cn("space-y-0.5", className)}>
      {showGeneric && meta.genericName && (
        <Line className="text-slate-500 font-medium">{meta.genericName}</Line>
      )}
      {showManufacturer && meta.manufacturer && (
        <Line className="text-slate-400 text-[10px]">{meta.manufacturer}</Line>
      )}
      {showStrengthDosage && meta.strengthDosageLine && (
        <Line className="font-semibold text-slate-700">{meta.strengthDosageLine}</Line>
      )}
      {showPack && meta.packLine && (
        <Line className="text-slate-500">{meta.packLine}</Line>
      )}
    </div>
  );
});

PharmacyMetaLines.displayName = "PharmacyMetaLines";

export default PharmacyMetaLines;
