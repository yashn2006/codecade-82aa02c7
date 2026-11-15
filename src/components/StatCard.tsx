import { useEffect, useState } from "react";
import { motion, useMotionTemplate, useMotionValue, useSpring, useTransform } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { AnimatedNumber } from "./AnimatedNumber";

export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  accent = "violet",
  delay = 0,
  prefix,
  suffix,
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
  const [canHover, setCanHover] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    setCanHover(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setCanHover(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rx = useSpring(useTransform(my, [-50, 50], [8, -8]), { stiffness: 220, damping: 18 });
  const ry = useSpring(useTransform(mx, [-50, 50], [-8, 8]), { stiffness: 220, damping: 18 });
  const sx = useSpring(useTransform(mx, [-100, 100], ["0%", "100%"]), {
    stiffness: 220,
    damping: 24,
  });
  const sy = useSpring(useTransform(my, [-100, 100], ["0%", "100%"]), {
    stiffness: 220,
    damping: 24,
  });
  const spotlightBg = useMotionTemplate`radial-gradient(220px circle at ${sx} ${sy}, oklch(var(--${accent}) / 0.18), transparent 60%)`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      onPointerMove={
        canHover
          ? (e) => {
              const r = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
              mx.set(e.clientX - r.left - r.width / 2);
              my.set(e.clientY - r.top - r.height / 2);
            }
          : undefined
      }
      onPointerLeave={
        canHover
          ? () => {
              mx.set(0);
              my.set(0);
            }
          : undefined
      }
      style={canHover ? { rotateX: rx, rotateY: ry, transformPerspective: 1000 } : undefined}
      whileHover={canHover ? { scale: 1.02 } : undefined}
      className="group relative min-w-0 w-full overflow-hidden rounded-2xl border border-border/50 bg-card/40 p-4 sm:p-5 backdrop-blur transition-colors hover:border-primary/40"
    >
      {/* Cursor spotlight (desktop hover only) */}
      {canHover && (
        <motion.div
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{ background: spotlightBg }}
        />
      )}
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full blur-2xl opacity-50 transition-opacity duration-500 group-hover:opacity-90"
        style={{ background: `oklch(var(--${accent}) / 0.5)` }}
      />
      <div
        className="relative flex items-start justify-between gap-2"
        style={canHover ? { transform: "translateZ(40px)" } : undefined}
      >
        <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-background/60 shadow-sm">
          <Icon className={`h-4 w-4 text-${accent}`} />
        </div>
        {hint && (
          <span className="truncate font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            {hint}
          </span>
        )}
      </div>
      <div
        className="relative mt-4 sm:mt-5 truncate font-display text-3xl sm:text-4xl font-extrabold tracking-tight tabular-nums"
        style={canHover ? { transform: "translateZ(60px)" } : undefined}
      >
        {prefix}
        <AnimatedNumber value={value} />
        {suffix}
      </div>
      <div
        className="relative mt-1 truncate text-[11px] uppercase tracking-[0.18em] text-muted-foreground"
        style={canHover ? { transform: "translateZ(30px)" } : undefined}
      >
        {label}
      </div>
    </motion.div>
  );
}
