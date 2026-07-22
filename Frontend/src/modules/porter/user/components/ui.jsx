import React from "react";
import { motion } from "framer-motion";

export function PrimaryButton({ children, className = "", variant = "primary", ...props }) {
  const styles =
    variant === "primary"
      ? "bg-[#2563EB] text-white shadow-[0_8px_24px_rgba(37,99,235,0.25)] hover:bg-[#1D4ED8]"
      : variant === "outline"
      ? "border border-gray-200 bg-white text-gray-900 hover:bg-gray-50"
      : "bg-gray-900 text-white hover:bg-black";
  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      className={`flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-[15px] font-bold transition-colors disabled:opacity-50 ${styles} ${className}`}
      {...props}
    >
      {children}
    </motion.button>
  );
}

export function StickyBar({ children }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-100 bg-white/95 dark:bg-[#1a1a1a]/95 backdrop-blur-md px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+12px)] shadow-[0_-8px_30px_rgba(0,0,0,0.06)]">
      {children}
    </div>
  );
}

export function FareRow({ label, value, strong, accent, free }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-[13px]">
      <span className={strong ? "font-bold text-gray-900" : "text-gray-500"}>{label}</span>
      <span
        className={
          free ? "font-bold text-[#2e7d32]" : accent ? "font-bold text-[#2563EB]" : strong ? "text-[15px] font-extrabold text-gray-900" : "font-semibold text-gray-800"
        }
      >
        {value}
      </span>
    </div>
  );
}

export function SectionLabel({ children, className = "" }) {
  return <h2 className={`mb-2 text-[15px] font-semibold text-[#1c1c1e] dark:text-white md:text-xl tracking-tight ${className}`}>{children}</h2>;
}

export const inr = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
