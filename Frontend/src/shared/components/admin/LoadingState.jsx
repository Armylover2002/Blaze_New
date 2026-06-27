import { Skeleton } from "@food/components/ui/skeleton";
import { TableSkeleton } from "@food/components/ui/loading-skeletons";
import { cn } from "@food/utils/utils";

/**
 * Loading states for the Blaze admin system. Composes the existing Skeleton
 * primitive + the existing TableSkeleton (re-exported) so there is one
 * shimmer language across every page.
 */

export function KpiCardSkeleton({ className }) {
  return (
    <div className={cn("blaze-card p-4", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="w-full space-y-3">
          <Skeleton className="h-3 w-24 rounded-full" />
          <Skeleton className="h-7 w-28 rounded-lg" />
          <Skeleton className="h-3 w-32 rounded-full" />
        </div>
        <Skeleton className="h-10 w-10 rounded-xl" />
      </div>
    </div>
  );
}

export function KpiGridSkeleton({ count = 8, className }) {
  return (
    <div className={cn("grid gap-4 sm:grid-cols-2 xl:grid-cols-4", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <KpiCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function CardSkeleton({ lines = 4, className }) {
  return (
    <div className={cn("blaze-card p-5", className)}>
      <Skeleton className="mb-4 h-5 w-40 rounded-full" />
      <div className="space-y-3">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} className={cn("h-4 rounded-full", i === lines - 1 ? "w-2/3" : "w-full")} />
        ))}
      </div>
    </div>
  );
}

export function ChartSkeleton({ height = 320, className }) {
  return (
    <div className={cn("blaze-card p-5", className)}>
      <Skeleton className="mb-4 h-5 w-48 rounded-full" />
      <Skeleton className="w-full rounded-2xl" style={{ height }} />
    </div>
  );
}

export { TableSkeleton };
