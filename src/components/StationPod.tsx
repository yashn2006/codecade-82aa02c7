import { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { Cpu, Gamepad2, Headset, Car, MonitorPlay, Lock, Pause, Wrench, Sparkles } from "lucide-react";
import type { DeviceStatus } from "@/lib/devices.functions";

type DeviceType = "pc" | "console" | "vr" | "racing" | "other";

const TYPE_ICON: Record<DeviceType, typeof Cpu> = {
  pc: MonitorPlay,
  console: Gamepad2,
  vr: Headset,
  racing: Car,
  other: Cpu,
};

const STATUS_THEME: Record<DeviceStatus, { ring: string; glow: string; chip: string; label: string; pulse: boolean }> = {
  available:   { ring: "#22d3a8", glow: "rgba(34,211,168,0.55)",  chip: "EMPTY · READY",   label: "available",   pulse: false },
  in_use:      { ring: "#ef4fb6", glow: "rgba(239,79,182,0.7)",   chip: "● LIVE SESSION",  label: "in use",      pulse: true  },
  reserved:    { ring: "#f5b042", glow: "rgba(245,176,66,0.6)",   chip: "✦ RESERVED",      label: "reserved",    pulse: false },
  suspended:   { ring: "#94a3b8", glow: "rgba(148,163,184,0.45)", chip: "⏸ SUSPENDED",     label: "suspended",   pulse: false },
  maintenance: { ring: "#f87171", glow: "rgba(248,113,113,0.55)", chip: "✖ MAINTENANCE",  label: "maintenance", pulse: false },
};

const STATUS_GLYPH: Record<DeviceStatus, typeof Cpu> = {
  available: Sparkles,
  in_use: MonitorPlay,
  reserved: Lock,
  suspended: Pause,
  maintenance: Wrench,
};

export type StationPodProps = {
  name: string;
  type: DeviceType;
  status: DeviceStatus;
  hourlyRate: number;
  overlay?: React.ReactNode; // e.g. timer, customer name
  caption?: React.ReactNode; // small line under chip
  index?: number;
  onClick?: () => void;
};

/**
 * A 3D-styled gaming station tile: tilted monitor + base, screen mock with
 * scanlines, animated status ring, pointer-tilt parallax, ambient glow.
 */
export function StationPod({
  name, type, status, hourlyRate, overlay, caption, index = 0, onClick,
}: StationPodProps) {
  const Icon = TYPE_ICON[type] ?? Cpu;
  const Glyph = STATUS_GLYPH[status];
  const theme = STATUS_THEME[status];

  const rotateX = useMotionValue(0);
  const rotateY = useMotionValue(0);
  const rx = useSpring(rotateX, { stiffness: 200, damping: 18 });
  const ry = useSpring(rotateY, { stiffness: 200, damping: 18 });
  const liftZ = useTransform([rx, ry], ([x, y]) => 1 - (Math.abs(x as number) + Math.abs(y as number)) / 60);

  const ref = useRef<HTMLButtonElement>(null);
  const [hover, setHover] = useState(false);

  const onMove = (e: React.PointerEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    rotateY.set(px * 14);
    rotateX.set(-py * 12);
  };
  const reset = () => { rotateX.set(0); rotateY.set(0); setHover(false); };

  return (
    <motion.button
      ref={ref}
      type="button"
      onClick={onClick}
      onPointerMove={onMove}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={reset}
      initial={{ opacity: 0, y: 18, rotateX: -20 }}
      animate={{ opacity: 1, y: 0, rotateX: 0 }}
      transition={{ delay: index * 0.04, type: "spring", stiffness: 160, damping: 18 }}
      style={{ perspective: 900 }}
      className="group relative block text-left focus:outline-none"
      aria-label={`${name} — ${theme.label}`}
    >
      <motion.div
        style={{ rotateX: rx, rotateY: ry, transformStyle: "preserve-3d" }}
        className="relative rounded-[22px]"
      >
        {/* Floor shadow */}
        <motion.div
          style={{ opacity: useTransform(liftZ, [0, 1], [0.65, 0.35]) }}
          className="pointer-events-none absolute -bottom-4 left-1/2 h-6 w-[80%] -translate-x-1/2 rounded-full blur-2xl"
          aria-hidden
        >
          <div className="h-full w-full rounded-full" style={{ background: theme.glow }} />
        </motion.div>

        {/* Outer halo ring */}
        <div
          className="pointer-events-none absolute -inset-px rounded-[22px] opacity-70 transition-opacity duration-500 group-hover:opacity-100"
          style={{ boxShadow: `0 0 0 1px ${theme.ring}33, 0 30px 80px -28px ${theme.glow}` }}
        />

        {/* Main pod body */}
        <div
          className="relative overflow-hidden rounded-[22px] border border-border bg-card p-4 shadow-soft"
          style={{ backgroundImage: `linear-gradient(180deg, oklch(0.99 0.005 78) 0%, oklch(0.96 0.015 78) 100%)` }}
        >
          {/* Grid floor (perspective) */}
          <div
            className="pointer-events-none absolute inset-0 opacity-50"
            style={{
              backgroundImage:
                `linear-gradient(${theme.ring}22 1px, transparent 1px), linear-gradient(90deg, ${theme.ring}22 1px, transparent 1px)`,
              backgroundSize: "22px 22px",
              maskImage: "linear-gradient(180deg, transparent 30%, black 100%)",
              WebkitMaskImage: "linear-gradient(180deg, transparent 30%, black 100%)",
              transform: "perspective(500px) rotateX(60deg) translateY(35%) scale(1.4)",
            }}
            aria-hidden
          />

          {/* Top row */}
          <div className="relative flex items-start justify-between">
            <div className="flex items-center gap-2">
              <div
                className="grid h-8 w-8 place-items-center rounded-lg border border-white/10"
                style={{ background: `linear-gradient(135deg, ${theme.ring}33, transparent)` }}
              >
                <Icon className="h-4 w-4" style={{ color: theme.ring }} />
              </div>
              <div className="min-w-0">
                <div className="truncate font-display text-sm font-bold leading-none text-foreground">{name}</div>
                <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
                  {type} · ₹{hourlyRate}/hr
                </div>
              </div>
            </div>
            <Glyph className="h-3.5 w-3.5 opacity-80" style={{ color: theme.ring }} />
          </div>

          {/* 3D Monitor */}
          <div className="relative mt-4 [transform:translateZ(20px)]">
            <div
              className="relative mx-auto aspect-[16/9] w-full overflow-hidden rounded-md border border-ink/20"
              style={{
                background:
                  status === "in_use"
                    ? `radial-gradient(120% 80% at 50% 0%, ${theme.ring}88 0%, #0a0a16 70%)`
                    : status === "available"
                    ? `radial-gradient(120% 80% at 50% 100%, ${theme.ring}55 0%, #0a0a16 80%)`
                    : status === "reserved"
                    ? `linear-gradient(135deg, ${theme.ring}33, #0a0a16)`
                    : status === "suspended"
                    ? "linear-gradient(135deg, #1a1a24, #0a0a16)"
                    : "repeating-linear-gradient(45deg, #1a0d12 0 8px, #0a0a16 8px 16px)",
                boxShadow: `inset 0 0 30px ${theme.ring}33`,
              }}
            >
              {/* Scanlines */}
              <div
                className="pointer-events-none absolute inset-0 opacity-30 mix-blend-overlay"
                style={{
                  backgroundImage:
                    "repeating-linear-gradient(0deg, rgba(255,255,255,0.06) 0 1px, transparent 1px 3px)",
                }}
                aria-hidden
              />
              {/* Sweep */}
              {(status === "in_use" || hover) && (
                <div
                  className="pointer-events-none absolute -inset-y-2 left-0 w-1/3 opacity-50"
                  style={{
                    background:
                      `linear-gradient(90deg, transparent, ${theme.ring}66, transparent)`,
                    animation: "sweep-x 2.6s linear infinite",
                  }}
                  aria-hidden
                />
              )}
              {/* Center icon */}
              <div className="absolute inset-0 grid place-items-center">
                {theme.pulse ? (
                  <motion.div
                    animate={{ scale: [1, 1.18, 1], opacity: [0.7, 1, 0.7] }}
                    transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                  >
                    <Glyph className="h-7 w-7" style={{ color: theme.ring, filter: `drop-shadow(0 0 14px ${theme.glow})` }} />
                  </motion.div>
                ) : (
                  <Glyph className="h-7 w-7 opacity-90" style={{ color: theme.ring, filter: `drop-shadow(0 0 10px ${theme.glow})` }} />
                )}
              </div>
            </div>

            {/* Monitor neck + base */}
            <div className="mx-auto mt-1 h-2 w-3 rounded-b-sm bg-ink/30" />
            <div className="mx-auto h-[3px] w-12 rounded-full bg-ink/20" />
          </div>

          {/* Status chip */}
          <div className="relative mt-3 flex items-center justify-between">
            <span
              className="rounded-md border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em]"
              style={{ borderColor: `${theme.ring}55`, color: theme.ring, background: `${theme.ring}11` }}
            >
              {theme.chip}
            </span>
            {caption && (
              <span className="font-mono text-[10px] text-muted-foreground">{caption}</span>
            )}
          </div>

          {/* Overlay (timer, customer name…) */}
          {overlay && <div className="relative mt-2">{overlay}</div>}
        </div>
      </motion.div>

      {/* keyframes (scoped) */}
      <style>{`@keyframes sweep-x{0%{transform:translateX(-30%)}100%{transform:translateX(330%)}}`}</style>
    </motion.button>
  );
}

/** Tiny live countdown for suspended stations. */
export function SuspendCountdown({ until }: { until: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const ms = Math.max(0, new Date(until).getTime() - now);
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return (
    <span className="font-mono tabular-nums">
      {String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
    </span>
  );
}
