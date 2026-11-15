import { type ReactNode } from "react";
import { Skeleton } from "@/components/LoadingSkeleton";

/**
 * Wraps dashboard page content with a crisp, zero-overhead 75ms CSS compositor reveal.
 * Automatically instant when "Fast" (reduced motion) mode is enabled.
 */
export function PageTransition({ routeKey, children }: { routeKey: string; children: ReactNode }) {
  return (
    <div key={routeKey} className="page-reveal min-w-0 w-full max-w-full overflow-x-hidden">
      {children}
    </div>
  );
}

/** Optional dashboard-shaped skeleton helper. */
export function ContentSkeleton() {
  return (
    <div className="min-w-0 space-y-5" aria-hidden>
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56 rounded-xl ring-1 ring-white/10" />
          <Skeleton className="h-4 w-72 max-w-full rounded-lg ring-1 ring-white/5" />
        </div>
        <Skeleton className="hidden h-10 w-32 rounded-xl ring-1 ring-white/10 sm:block" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-2xl ring-1 ring-white/10" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-72 rounded-3xl ring-1 ring-white/10 lg:col-span-2" />
        <Skeleton className="h-72 rounded-3xl ring-1 ring-white/10" />
      </div>
    </div>
  );
}
