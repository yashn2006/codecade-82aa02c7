import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useMemo, useRef } from "react";
import { Activity, TrendingUp, Flame, Sparkles, Zap, Trophy } from "lucide-react";

type Session = {
  id: string;
  started_at: string;
  ended_at: string | null;
  amount: number | null;
  device_id: string;
  status: string;
};

type Device = { id: string; name: string };

/**
 * A cinematic live-analytics hero strip for the café owner dashboard:
 * — 3D cursor-tilt card
 * — animated revenue sparkline (built from real sessions)
 * — 24h hourly heatmap
 * — top-stations leaderboard
 */
export function LiveAnalyticsPanel({
  sessions,
  devices,
  activeCount,
}: {
  sessions: Session[];
  devices: Device[];
  activeCount: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 90, damping: 18 });
  const sy = useSpring(my, { stiffness: 90, damping: 18 });
  const rotY = useTransform(sx, [-1, 1], [-5, 5]);
  const rotX = useTransform(sy, [-1, 1], [4, -4]);

  function onMove(e: React.MouseEvent) {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    mx.set(((e.clientX - r.left) / r.width - 0.5) * 2);
    my.set(((e.clientY - r.top) / r.height - 0.5) * 2);
  }
  function onLeave() { mx.set(0); my.set(0); }

  // — Derived metrics
  const { hourly, todayRevenue, weekPath, weekArea, top, peakHour } = useMemo(() => {
    const today = new Date();
    const todayKey = today.toDateString();
    const hourly = new Array(24).fill(0);
    const dayTotals = new Array(7).fill(0);

    for (const s of sessions) {
      const t = s.ended_at ? new Date(s.ended_at) : new Date(s.started_at);
      const amt = s.amount ?? 0;
      const dayDiff = Math.floor((today.getTime() - t.getTime()) / 86_400_000);
      if (dayDiff >= 0 && dayDiff < 7) dayTotals[6 - dayDiff] += amt;
      if (t.toDateString() === todayKey) hourly[t.getHours()] += amt;
    }
    const todayRevenue = sessions
      .filter((s) => s.ended_at && new Date(s.ended_at).toDateString() === todayKey)
      .reduce((sum, s) => sum + (s.amount ?? 0), 0);

    // Sparkline path from 7-day totals
    const max = Math.max(1, ...dayTotals);
    const W = 320, H = 60;
    const pts = dayTotals.map((v, i) => {
      const x = (i / (dayTotals.length - 1)) * W;
      const y = H - (v / max) * (H - 6) - 3;
      return [x, y] as const;
    });
    const weekPath = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
    const weekArea = `${weekPath} L ${W} ${H} L 0 ${H} Z`;

    // Top stations
    const byDev = new Map<string, number>();
    for (const s of sessions) byDev.set(s.device_id, (byDev.get(s.device_id) ?? 0) + (s.amount ?? 0));
    const nameOf = new Map(devices.map((d) => [d.id, d.name]));
    const top = [...byDev.entries()]
      .map(([id, v]) => ({ name: nameOf.get(id) ?? "—", v }))
      .sort((a, b) => b.v - a.v)
      .slice(0, 4);
    const topMax = Math.max(1, ...top.map((t) => t.v));

    let peakHour = 0, peakVal = -1;
    hourly.forEach((v, i) => { if (v > peakVal) { peakVal = v; peakHour = i; } });

    return { hourly, todayRevenue, weekPath, weekArea, top: top.map((t) => ({ ...t, pct: t.v / topMax })), peakHour };
  }, [sessions, devices]);

  const hourlyMax = Math.max(1, ...hourly);

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      style={{ rotateX: rotX, rotateY: rotY, transformStyle: "preserve-3d", perspective: 1400 }}
      className="relative overflow-hidden rounded-3xl border border-border/60 bg-card/40 p-5 backdrop-blur-xl"
    >
      {/* Aurora bloom */}
      <div className="pointer-events-none absolute -left-20 -top-24 h-72 w-72 rounded-full bg-magenta/30 blur-3xl animate-pulse-soft" />
      <div className="pointer-events-none absolute -right-20 -bottom-24 h-72 w-72 rounded-full bg-violet/30 blur-3xl animate-pulse-soft" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
          maskImage: "radial-gradient(ellipse at 50% 0%, black 30%, transparent 80%)",
        }}
      />
      {/* Top conic border accent */}
      <div className="pointer-events-none absolute inset-x-6 top-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, oklch(0.7 0.26 335 / 0.6), oklch(0.78 0.18 220 / 0.6), transparent)" }}
      />

      <div className="relative grid gap-4 lg:grid-cols-[1.4fr_1fr_1fr]" style={{ transform: "translateZ(30px)" }}>
        {/* === Revenue card with sparkline === */}
        <div className="relative overflow-hidden rounded-2xl border border-white/5 bg-background/40 p-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                <Activity className="h-3 w-3 text-magenta" />
                Revenue · last 7 days
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="font-display text-4xl font-extrabold tabular-nums text-gradient-hot">
                  ₹{todayRevenue.toLocaleString("en-IN")}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-emerald-300/90">
                  <TrendingUp className="mr-1 inline h-3 w-3" /> today
                </span>
              </div>
            </div>
            <span className="rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em] text-emerald-300">
              ● live
            </span>
          </div>
          <svg viewBox="0 0 320 60" className="mt-4 h-20 w-full">
            <defs>
              <linearGradient id="rev-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="oklch(0.7 0.26 335)" stopOpacity="0.7" />
                <stop offset="100%" stopColor="oklch(0.7 0.26 335)" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="rev-stroke" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="oklch(0.78 0.22 285)" />
                <stop offset="100%" stopColor="oklch(0.78 0.22 335)" />
              </linearGradient>
            </defs>
            <motion.path
              d={weekArea}
              fill="url(#rev-grad)"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              transition={{ delay: 0.7, duration: 0.6 }}
            />
            <motion.path
              d={weekPath}
              fill="none"
              stroke="url(#rev-stroke)"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.6, ease: "easeOut" }}
            />
          </svg>
          <div className="mt-1 flex justify-between font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground/60">
            {["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map((d) => <span key={d}>{d}</span>)}
          </div>
        </div>

        {/* === Hourly heatmap === */}
        <div className="relative overflow-hidden rounded-2xl border border-white/5 bg-background/40 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              <Flame className="h-3 w-3 text-amber-400" /> 24h pulse
            </div>
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-amber-300/80">
              peak · {String(peakHour).padStart(2, "0")}:00
            </div>
          </div>
          <div className="mt-4 grid grid-cols-12 gap-1">
            {hourly.map((v, h) => {
              const intensity = v / hourlyMax;
              return (
                <motion.div
                  key={h}
                  initial={{ scaleY: 0, opacity: 0 }}
                  animate={{ scaleY: 1, opacity: 1 }}
                  transition={{ delay: 0.4 + h * 0.018, duration: 0.4 }}
                  style={{
                    transformOrigin: "bottom",
                    background: intensity > 0
                      ? `linear-gradient(180deg, oklch(0.78 0.22 ${335 - intensity * 60}) , oklch(0.55 0.22 285))`
                      : "oklch(1 0 0 / 0.05)",
                    boxShadow: intensity > 0.5 ? `0 0 12px -2px oklch(0.7 0.26 335 / ${intensity})` : undefined,
                  }}
                  className="h-10 rounded-sm"
                  title={`${String(h).padStart(2, "0")}:00 · ₹${Math.round(v)}`}
                />
              );
            })}
          </div>
          <div className="mt-2 flex justify-between font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground/60">
            <span>00</span><span>06</span><span>12</span><span>18</span><span>23</span>
          </div>
        </div>

        {/* === Top stations leaderboard === */}
        <div className="relative overflow-hidden rounded-2xl border border-white/5 bg-background/40 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              <Trophy className="h-3 w-3 text-amber-300" /> Top stations
            </div>
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-violet-300/80">
              <Zap className="mr-1 inline h-3 w-3" /> {activeCount} live
            </span>
          </div>
          <div className="mt-4 space-y-2.5">
            {top.length === 0 ? (
              <div className="flex h-24 items-center justify-center font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                <Sparkles className="mr-2 h-3 w-3" /> awaiting first session
              </div>
            ) : top.map((t, i) => (
              <div key={t.name + i} className="space-y-1">
                <div className="flex items-baseline justify-between text-xs">
                  <span className="font-mono text-muted-foreground">
                    <span className="mr-1.5 inline-flex h-4 w-4 items-center justify-center rounded text-[9px] font-bold"
                      style={{
                        background: i === 0 ? "oklch(0.7 0.26 335 / 0.2)" : "oklch(1 0 0 / 0.05)",
                        color: i === 0 ? "oklch(0.78 0.22 335)" : undefined,
                      }}
                    >{i + 1}</span>
                    {t.name}
                  </span>
                  <span className="font-display font-bold tabular-nums">₹{Math.round(t.v).toLocaleString("en-IN")}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${t.pct * 100}%` }}
                    transition={{ delay: 0.5 + i * 0.1, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                    className="h-full rounded-full"
                    style={{ background: "var(--gradient-brand-hot)" }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
