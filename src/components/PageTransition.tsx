import { useEffect, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { useQueryClient, type Query } from "@tanstack/react-query";
import { Skeleton } from "@/components/LoadingSkeleton";

const isFirstLoad = (q: Query) => q.state.status === "pending" && q.state.fetchStatus === "fetching";
const MAX_GATE_MS = 5000;

/**
 * Wraps dashboard page content. When the page changes, the new page mounts
 * hidden (so its data starts loading) while a shimmering skeleton shows.
 * As soon as its first data arrives the page fades and rises in. Pages whose
 * data is already cached reveal instantly with just the fade.
 */
export function PageTransition({ routeKey, children }: { routeKey: string; children: ReactNode }) {
  const queryClient = useQueryClient();
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const gated = revealedKey !== routeKey;

  useEffect(() => {
    let done = false;
    const cache = queryClient.getQueryCache();
    const pending = () => cache.findAll({ predicate: isFirstLoad }).length;
    let unsub: (() => void) | undefined;

    const reveal = () => {
      if (done) return;
      done = true;
      unsub?.();
      setRevealedKey(routeKey);
    };

    // Give the freshly mounted page one frame to kick off its queries.
    const raf = window.requestAnimationFrame(() => {
      if (pending() === 0) return reveal();
      unsub = cache.subscribe(() => {
        if (pending() === 0) reveal();
      });
    });
    const cap = window.setTimeout(reveal, MAX_GATE_MS);

    return () => {
      done = true;
      window.cancelAnimationFrame(raf);
      window.clearTimeout(cap);
      unsub?.();
    };
  }, [routeKey, queryClient]);

  return (
    <div className="grid">
      <motion.div
        className="[grid-area:1/1] min-w-0"
        initial={false}
        animate={gated ? { opacity: 0, y: 10, filter: "blur(6px)" } : { opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={gated ? { duration: 0 } : { duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
        style={{ pointerEvents: gated ? "none" : undefined }}
        aria-busy={gated || undefined}
        onAnimationComplete={() => {
          // Drop the filter so it doesn't create a stacking context for fixed overlays.
        }}
      >
        {children}
      </motion.div>
      {gated && <ContentSkeleton />}
    </div>
  );
}

/** Dashboard-shaped skeleton: heading, stat tiles, main panel, list rows. */
export function ContentSkeleton() {
  return (
    <motion.div
      className="[grid-area:1/1] min-w-0 space-y-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.08, duration: 0.25 }}
      aria-hidden
    >
      <div className="space-y-2">
        <Skeleton className="h-7 w-52" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.05, duration: 0.3 }}
          >
            <Skeleton className="h-24" />
          </motion.div>
        ))}
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        <Skeleton className="h-64 lg:col-span-2" />
        <Skeleton className="h-64" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25 + i * 0.06, duration: 0.3 }}
          >
            <Skeleton className="h-14" />
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
