import { useNavigate } from "react-router-dom";
import { ArrowUpRight, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@food/utils/utils";

/**
 * StatCard — the one KPI/metric card for the whole admin panel.
 *
 * Reusable across Dashboard, Users, Drivers, Orders, Wallet, Reports, etc.
 *
 * Props:
 *  - title, value, helper, icon
 *  - to: route to navigate to on click (optional)
 *  - canAccess: (path) => boolean permission gate; if provided and returns
 *    false for `to`, the card renders nothing (preserves existing RBAC behavior)
 *  - onClick: custom handler (used if `to` not provided)
 *  - trend, trendDirection: optional "+12%" style indicator
 */
export default function StatCard({
  title,
  value,
  helper,
  icon,
  to,
  canAccess,
  onClick,
  trend,
  trendDirection = "up",
  className,
}) {
  const navigate = useNavigate();

  if (to && canAccess && !canAccess(to)) return null;

  const clickable = Boolean(to || onClick);
  const handleClick = () => {
    if (to) navigate(to);
    else if (onClick) onClick();
  };

  return (
    <div
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? handleClick : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleClick();
              }
            }
          : undefined
      }
      className={cn(
        "blaze-card group relative overflow-hidden p-4",
        clickable && "blaze-card-interactive cursor-pointer active:scale-[0.99]",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {title}
          </p>
          <p className="mt-2 text-2xl font-bold leading-tight tracking-tight text-foreground">
            {value}
          </p>
          {(helper || trend) && (
            <div className="mt-1 flex items-center gap-2">
              {trend && (
                <span
                  className={cn(
                    "inline-flex items-center gap-0.5 text-[11px] font-semibold",
                    trendDirection === "up"
                      ? "text-[var(--blaze-success)]"
                      : "text-[var(--blaze-danger)]"
                  )}
                >
                  {trendDirection === "up" ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : (
                    <TrendingDown className="h-3 w-3" />
                  )}
                  {trend}
                </span>
              )}
              {helper && (
                <span className="line-clamp-1 text-[11px] font-medium text-muted-foreground">
                  {helper}
                </span>
              )}
            </div>
          )}
        </div>
        {icon && (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/10 transition-all duration-200 group-hover:scale-110 group-hover:bg-primary/15">
            {icon}
          </span>
        )}
      </div>
      {clickable && (
        <div className="absolute bottom-2 right-2 translate-x-2 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100">
          <ArrowUpRight className="h-3.5 w-3.5 text-primary/60" />
        </div>
      )}
    </div>
  );
}
