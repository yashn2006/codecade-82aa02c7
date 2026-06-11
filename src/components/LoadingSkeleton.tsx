import { motion } from "framer-motion";

export function Skeleton({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={`skeleton ${className}`} style={style} aria-hidden />;
}

/** Standard page-load skeleton block — cards in a soft pulse */
export function PageSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-4"
      aria-busy
      aria-live="polite"
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-28" />
      ))}
    </motion.div>
  );
}

/** Card-grid skeleton */
export function GridSkeleton({ count = 6, height = 180 }: { count?: number; height?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} style={{ height }} />
      ))}
    </div>
  );
}
