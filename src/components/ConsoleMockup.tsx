import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useRef, useEffect, useState } from "react";
import { Activity, Cpu, IndianRupee, Wifi, Users, ArrowUpRight } from "lucide-react";

/**
 * A 3D, perspective-tilted "console" mockup that follows the cursor and
 * shows a live-feeling cafe dashboard. Used in the hero in place of a
 * static logo. Pure CSS / framer — no images, no canvas.
 */
export function ConsoleMockup() {
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 80, damping: 14 });
  const sy = useSpring(my, { stiffness: 80, damping: 14 });
  const rotateY = useTransform(sx, [-1, 1], [-14, 14]);
  const rotateX = useTransform(sy, [-1, 1], [10, -10]);

  function onMove(e: React.MouseEvent) {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    mx.set(((e.clientX - r.left) / r.width - 0.5) * 2);
    my.set(((e.clientY - r.top) / r.height - 0.5) * 2);
  }
  function onLeave() { mx.set(0); my.set(0); }

  // Animate the "Today's revenue" counter to feel live
  const [rev, setRev] = useState(18420);
  useEffect(() => {
    const t = setInterval(() => setRev((v) => v + Math.floor(Math.random() * 90)), 1800);
    return () => clearInterval(t);
  }, []);

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className="relative w-full"
      style={{ perspective: 1400 }}
    >
      {/* Glow underbed */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-6 -z-10 rounded-[2rem] blur-3xl opacity-70"
        style={{ background: "var(--gradient-brand-hot)" }}
      />
      <motion.div
        style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
        className="border-conic glass-strong relative rounded-2xl p-1.5 shadow-[0_40px_120px_-30px_oklch(0.6_0.28_335/0.6)]"
      >
        <div className="rounded-[14px] bg-[oklch(0.09_0.02_285)]/95 overflow-hidden">
          {/* Window chrome */}
          <div className="flex items-center justify-between border-b border-white/5 px-4 py-2.5">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
            </div>
            <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-white/40">
              corecade.os · /cafe/andheri-west · live
            </div>
            <div className="flex items-center gap-1 font-mono text-[10px] text-emerald-300">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </span>
              ONLINE
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr] lg:grid-cols-[140px_1fr] min-h-[300px] sm:min-h-[360px]">
            {/* Sidebar — hidden on mobile */}
            <div className="hidden sm:block border-r border-white/5 bg-white/[0.02] p-3 text-[11px] text-white/70">
              <div className="mb-2 px-2 font-mono text-[9px] uppercase tracking-[0.25em] text-white/30">Console</div>
              {[
                { l: "Overview", a: true },
                { l: "Devices", a: false },
                { l: "Bookings", a: false },
                { l: "Customers", a: false },
                { l: "POS", a: false },
                { l: "Ledger", a: false },
                { l: "Memberships", a: false },
                { l: "Tournaments", a: false },
              ].map((i) => (
                <div
                  key={i.l}
                  className={`mb-0.5 rounded-md px-2 py-1.5 transition ${
                    i.a
                      ? "bg-[oklch(0.6_0.28_335/0.18)] text-white ring-1 ring-[oklch(0.6_0.28_335/0.4)]"
                      : "hover:bg-white/5"
                  }`}
                >
                  {i.l}
                </div>
              ))}
            </div>

            {/* Body */}
            <div className="p-4">
              {/* KPI row */}
              <div className="grid grid-cols-4 gap-2">
                {[
                  { l: "Active", v: "24", i: Cpu, c: "text-violet-300" },
                  { l: "Revenue", v: `₹${rev.toLocaleString("en-IN")}`, i: IndianRupee, c: "text-rose-300" },
                  { l: "Devices", v: "30/30", i: Wifi, c: "text-sky-300" },
                  { l: "Members", v: "612", i: Users, c: "text-amber-300" },
                ].map((k) => (
                  <div key={k.l} className="rounded-lg border border-white/5 bg-white/[0.03] p-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[8px] uppercase tracking-[0.2em] text-white/40">{k.l}</span>
                      <k.i className={`h-3 w-3 ${k.c}`} />
                    </div>
                    <div className={`mt-1 font-mono text-sm font-bold ${k.c}`}>{k.v}</div>
                  </div>
                ))}
              </div>

              {/* Sparkline + breakdown */}
              <div className="mt-3 grid grid-cols-[1.6fr_1fr] gap-2">
                <div className="rounded-lg border border-white/5 bg-white/[0.03] p-3">
                  <div className="flex items-center justify-between">
                    <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-white/40">Revenue · 7d</div>
                    <div className="flex items-center gap-1 font-mono text-[10px] text-emerald-300">
                      <ArrowUpRight className="h-3 w-3" /> +18.2%
                    </div>
                  </div>
                  <svg viewBox="0 0 200 64" className="mt-2 h-16 w-full">
                    <defs>
                      <linearGradient id="cm-grad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="oklch(0.7 0.26 335)" stopOpacity="0.7" />
                        <stop offset="100%" stopColor="oklch(0.7 0.26 335)" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <motion.path
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 1.6, ease: "easeOut" }}
                      d="M0 48 L28 38 L56 42 L84 24 L112 30 L140 14 L168 18 L200 6"
                      fill="none"
                      stroke="oklch(0.78 0.22 335)"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                    <path
                      d="M0 48 L28 38 L56 42 L84 24 L112 30 L140 14 L168 18 L200 6 L200 64 L0 64 Z"
                      fill="url(#cm-grad)"
                    />
                  </svg>
                </div>
                <div className="rounded-lg border border-white/5 bg-white/[0.03] p-3">
                  <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-white/40">Floor map</div>
                  <div className="mt-2 grid grid-cols-6 gap-1">
                    {Array.from({ length: 30 }).map((_, i) => {
                      const states = ["bg-emerald-400/70", "bg-rose-400/70", "bg-sky-400/70", "bg-white/10"];
                      const s = states[(i * 7) % states.length];
                      return (
                        <motion.div
                          key={i}
                          initial={{ scale: 0.6, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ delay: 0.02 * i, duration: 0.25 }}
                          className={`h-3.5 rounded-sm ${s}`}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Live feed */}
              <div className="mt-3 rounded-lg border border-white/5 bg-white/[0.03]">
                <div className="flex items-center justify-between border-b border-white/5 px-3 py-2">
                  <div className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.22em] text-white/40">
                    <Activity className="h-3 w-3 text-violet-300" /> Live sessions
                  </div>
                  <div className="font-mono text-[9px] text-white/30">auto · 1s</div>
                </div>
                <div className="divide-y divide-white/5">
                  {[
                    { d: "PC-07", c: "Aarav K.", t: "00:42:18", a: "₹212" },
                    { d: "PS5-02", c: "Walk-in", t: "00:18:02", a: "₹96" },
                    { d: "PC-14", c: "Riya M.", t: "01:24:55", a: "₹408" },
                  ].map((r, i) => (
                    <motion.div
                      key={r.d}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.7 + i * 0.12 }}
                      className="grid grid-cols-[60px_1fr_72px_60px] items-center gap-2 px-3 py-1.5 text-[11px]"
                    >
                      <span className="font-mono text-violet-300">{r.d}</span>
                      <span className="truncate text-white/80">{r.c}</span>
                      <span className="font-mono text-white/50">{r.t}</span>
                      <span className="text-right font-mono text-emerald-300">{r.a}</span>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
