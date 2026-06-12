import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
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
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rx = useSpring(useTransform(my, [-50, 50], [8, -8]), { stiffness: 220, damping: 18 });
  const ry = useSpring(useTransform(mx, [-50, 50], [-8, 8]), { stiffness: 220, damping: 18 });
  const sx = useSpring(useTransform(mx, [-100, 100], ["0%", "100%"]), { stiffness: 220, damping: 24 });
  const sy = useSpring(useTransform(my, [-100, 100], ["0%", "100%"]), { stiffness: 220, damping: 24 });

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}
      onPointerMove={(e) => {
        const r = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
        mx.set(e.clientX - r.left - r.width / 2);
        my.set(e.clientY - r.top - r.height / 2);
      }}
      onPointerLeave={() => { mx.set(0); my.set(0); }}
      style={{ rotateX: rx, rotateY: ry, transformPerspective: 1000 }}
      whileHover={{ scale: 1.02 }}
      className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card/40 p-5 backdrop-blur transition-colors hover:border-primary/40 will-change-transform"
    >
      {/* Cursor spotlight */}
      <motion.div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: `radial-gradient(220px circle at ${sx.get() ?? "50%"} ${sy.get() ?? "50%"}, oklch(var(--${accent}) / 0.18), transparent 60%)`,
        }}
      />
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full blur-2xl opacity-50 transition-opacity duration-500 group-hover:opacity-90"
        style={{ background: `oklch(var(--${accent}) / 0.5)` }}
      />
      <div className="relative flex items-start justify-between" style={{ transform: "translateZ(40px)" }}>
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border/60 bg-background/60 shadow-sm">
          <Icon className={`h-4 w-4 text-${accent}`} />
        </div>
        {hint && (
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{hint}</span>
        )}
      </div>
      <div className="relative mt-5 font-display text-4xl font-extrabold tracking-tight" style={{ transform: "translateZ(60px)" }}>
        {prefix}<AnimatedNumber value={value} />{suffix}
      </div>
      <div className="relative mt-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground" style={{ transform: "translateZ(30px)" }}>{label}</div>
    </motion.div>
  );
}
