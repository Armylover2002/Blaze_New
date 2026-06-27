import { cn } from "@food/utils/utils";

/**
 * SectionCard — the one content/analytics/chart card surface.
 *
 * Use for: chart cards, analytics panels, list panels, any titled section.
 * Composes the shared `.blaze-card` surface (one radius + one shadow).
 *
 * Props:
 *  - title, subtitle, icon, action: header (omit all to render headerless)
 *  - footer: optional footer node
 *  - flush: remove body padding (for charts/tables that manage their own)
 *  - bodyClassName / className
 */
export default function SectionCard({
  title,
  subtitle,
  icon,
  action,
  footer,
  flush = false,
  children,
  className,
  bodyClassName,
}) {
  const hasHeader = title || subtitle || action || icon;

  return (
    <div className={cn("blaze-card flex min-w-0 flex-col", className)}>
      {hasHeader && (
        <div className="border-b border-border px-5 py-4 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2.5">
            {icon && (
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                {icon}
              </span>
            )}
            <div className="min-w-0 space-y-0.5">
              {title && <h2 className="blaze-section-title truncate">{title}</h2>}
              {subtitle && <p className="blaze-section-subtitle">{subtitle}</p>}
            </div>
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className={cn(flush ? "" : "p-5", "min-w-0 flex-1", bodyClassName)}>{children}</div>
      {footer && <div className="border-t border-border px-5 py-3">{footer}</div>}
    </div>
  );
}
