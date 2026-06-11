import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { motion } from "framer-motion";

export function EmptyState({
  icon: Icon, title, description, action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl border border-dashed border-border bg-card/60 p-10 text-center backdrop-blur"
    >
      <div className="pointer-events-none absolute inset-0 opacity-60"
        style={{ background: "radial-gradient(60% 60% at 50% 0%, oklch(0.55 0.26 292 / 0.08), transparent 70%)" }} aria-hidden />
      <motion.div
        animate={{ y: [0, -4, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        className="relative mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-card shadow-soft"
      >
        <Icon className="h-6 w-6 text-primary" />
      </motion.div>
      <h3 className="relative mt-5 font-display text-xl font-bold">{title}</h3>
      {description && <p className="relative mx-auto mt-2 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="relative mt-6">{action}</div>}
    </motion.div>
  );
}
