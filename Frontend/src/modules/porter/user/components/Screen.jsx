import React from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";

export default function Screen({
  title,
  subtitle,
  onBack,
  right = null,
  children,
  className = "",
  bodyClassName = "",
  bare = false,
}) {
  const navigate = useNavigate();
  const handleBack = () => (onBack ? onBack() : navigate(-1));

  return (
    <div className={`min-h-screen bg-[#FAF7F2] dark:bg-[#0a0a0a] print:bg-white print:min-h-0 ${className}`}>
      <header className="sticky top-0 z-40 bg-white/90 dark:bg-[#1a1a1a]/90 backdrop-blur-md border-b border-gray-100 dark:border-white/10 print:static print:border-none print:bg-transparent">
        <div className="flex items-center gap-3 px-4 py-3 print:p-0">
          <button
            type="button"
            onClick={handleBack}
            aria-label="Go back"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 active:scale-95 transition print:hidden"
          >
            <ChevronLeft className="h-5 w-5" strokeWidth={2.4} />
          </button>
          <div className="min-w-0 flex-1">
            {title && <h1 className="truncate text-[15px] font-bold text-gray-900 dark:text-white">{title}</h1>}
            {subtitle && <p className="truncate text-[11px] text-gray-500 dark:text-white/60">{subtitle}</p>}
          </div>
          {right}
        </div>
      </header>
      <main className={bare ? "" : `px-4 py-4 pb-28 ${bodyClassName}`}>{children}</main>
    </div>
  );
}
