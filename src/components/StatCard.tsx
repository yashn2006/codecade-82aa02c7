import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { AnimatedNumber } from "./AnimatedNumber";

export function StatCard({
  icon: Icon, label, value, hint, accent = "violet", delay = 0, prefix, suffix,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  hint?: string;
  accent?: "violet" | "azure" | "magenta";
  delay?: number;
  prefix?: string;
  suffix?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}
      className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card/40 p-5 backdrop-blur hover-lift hover:border-primary/40"
    >
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full blur-2xl opacity-50 transition-opacity duration-500 group-hover:opacity-90"
        style={{ background: `oklch(var(--${accent}) / 0.5)` }}
      />
      <div className="relative flex items-start justify-between">
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border/60 bg-background/60">
          <Icon className={`h-4 w-4 text-${accent}`} />
        </div>
        {hint && (
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{hint}</span>
        )}
      </div>
      <div className="relative mt-5 font-display text-4xl font-extrabold tracking-tight">
        {prefix}<AnimatedNumber value={value} />{suffix}
      </div>
      <div className="relative mt-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
    </motion.div>
  );
}
