import { cn } from "@food/utils/utils";

/**
 * PageHeader — standard top-of-page header for every admin page.
 * Hierarchy: eyebrow (optional) → title → description (optional) + actions slot.
 */
export default function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  children,
  className,
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between",
        className
      )}
    >
      <div className="min-w-0">
        {eyebrow && <p className="blaze-eyebrow">{eyebrow}</p>}
        {title && <h1 className="blaze-title mt-1.5">{title}</h1>}
        {description && <p className="blaze-subtitle mt-1">{description}</p>}
      </div>
      {(actions || children) && (
        <div className="flex flex-wrap items-center gap-2.5">{actions || children}</div>
      )}
    </div>
  );
}
