import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Monitor, Gamepad2, Headphones, RotateCcw, Zap, Wrench, CalendarClock,
  Play, Square, ArrowRight, X, Check, LayoutDashboard, Grid3X3, CalendarDays,
  ShoppingCart, Users, BarChart3, Plus, Minus,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const NAV = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "floor", label: "Live Floor", icon: Grid3X3 },
  { key: "bookings", label: "Bookings", icon: CalendarDays },
  { key: "pos", label: "POS", icon: ShoppingCart },
  { key: "customers", label: "Customers", icon: Users },
  { key: "analytics", label: "Analytics", icon: BarChart3 },
] as const;
type NavKey = (typeof NAV)[number]["key"];


type DemoStatus = "available" | "in_use" | "reserved" | "maintenance";
type DemoDevice = {
  id: number; name: string; type: "pc" | "console" | "vr"; status: DemoStatus; rate: number;
  customer?: string; timer_start?: number; starts_in?: string; reason?: string;
};

const INITIAL: DemoDevice[] = [
  { id: 1, name: "PC-1", type: "pc", status: "in_use", rate: 100, customer: "Aarav K.", timer_start: Date.now() - 5412000 },
  { id: 2, name: "PC-2", type: "pc", status: "available", rate: 100 },
  { id: 3, name: "PC-3", type: "pc", status: "reserved", rate: 100, customer: "Rahul M.", starts_in: "00:23:00" },
  { id: 4, name: "CONSOLE-1", type: "console", status: "in_use", rate: 120, customer: "Priya S.", timer_start: Date.now() - 1800000 },
  { id: 5, name: "CONSOLE-2", type: "console", status: "available", rate: 120 },
  { id: 6, name: "VR-1", type: "vr", status: "maintenance", rate: 200, reason: "Headset calibration" },
];

const ICONS = { pc: Monitor, console: Gamepad2, vr: Headphones } as const;
const FILTERS = ["all", "pc", "console", "vr"] as const;

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const hhmmss = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((n) => String(n).padStart(2, "0")).join(":");
};
const earned = (d: DemoDevice, now: number) =>
  d.timer_start ? Math.ceil((d.rate * ((now - d.timer_start) / 3600000))) : 0;

export function DemoFloor() {
  const [devices, setDevices] = useState<DemoDevice[]>(() => INITIAL.map((d) => ({ ...d })));
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [openId, setOpenId] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const shown = useMemo(() => devices.filter((d) => filter === "all" || d.type === filter), [devices, filter]);
  const live = devices.filter((d) => d.status === "in_use");
  const revenue = live.reduce((s, d) => s + earned(d, now), 0);
  const open = devices.find((d) => d.id === openId) ?? null;

  const patch = (id: number, p: Partial<DemoDevice>) =>
    setDevices((ds) => ds.map((d) => (d.id === id ? { ...d, ...p } : d)));

  return (
    <section id="demo" className="relative px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-[1180px]">
        <div className="text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.22em] text-primary">
            • Live demo
          </span>
          <h2 className="mt-4 font-display text-4xl font-black sm:text-[52px]">The real dashboard.</h2>
          <p className="mt-2 text-base text-muted-foreground">
            A working café owner console — click around, start sessions, take orders. Nothing is saved.
          </p>
        </div>

        <div
          className="mt-10 overflow-hidden rounded-3xl border"
          style={{
            borderColor: "rgba(255,255,255,0.1)",
            boxShadow: "0 40px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05)",
            background:
              "radial-gradient(ellipse at 20% 0%, rgba(120,0,255,0.20), transparent 50%), radial-gradient(ellipse at 80% 100%, rgba(255,0,150,0.15), transparent 50%), #04000e",
          }}
        >
          {/* browser chrome */}
          <div className="flex items-center gap-3 border-b border-white/10 bg-black/30 px-4 py-2.5">
            <div className="flex gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
            </div>
            <div className="flex-1 truncate rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1 text-center font-mono text-[10px] text-white/45">
              corecade.app/cafe/neon-arena/{tab}
            </div>
            <span className="hidden rounded-full border border-amber-400/40 bg-amber-500/10 px-2.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.2em] text-amber-300 sm:inline">
              Demo mode
            </span>
          </div>

          <div className="flex min-h-[560px]">
            {/* sidebar */}
            <aside className="hidden w-[196px] shrink-0 flex-col border-r border-white/10 bg-black/25 p-3 md:flex">
              <div className="flex items-center gap-2 px-2 py-2">
                <div className="grid h-8 w-8 place-items-center rounded-xl" style={{ background: "linear-gradient(135deg,#ff006e,#7b2fff)" }}>
                  <Zap className="h-4 w-4 text-white" />
                </div>
                <div className="min-w-0">
                  <div className="truncate font-display text-sm font-bold text-white">Neon Arena</div>
                  <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-emerald-400">● online</div>
                </div>
              </div>
              <nav className="mt-3 space-y-1">
                {NAV.map((n) => {
                  const I = n.icon;
                  const on = tab === n.key;
                  return (
                    <button
                      key={n.key} type="button" onClick={() => setTab(n.key)}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13px] transition",
                        on ? "bg-fuchsia-500/15 text-white shadow-[inset_0_0_0_1px_rgba(244,114,232,0.35)]" : "text-white/55 hover:bg-white/5 hover:text-white",
                      )}
                    >
                      <I className="h-4 w-4" style={on ? { color: "#f472e8" } : undefined} />
                      {n.label}
                    </button>
                  );
                })}
              </nav>
              <div className="mt-auto rounded-xl border border-amber-400/25 bg-amber-500/10 p-3">
                <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-amber-300">Trial</div>
                <div className="mt-1 text-xs text-white/70">12 of 15 days left</div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-emerald-400" style={{ width: "80%" }} />
                </div>
              </div>
            </aside>

            {/* main */}
            <div className="min-w-0 flex-1">
              {/* topbar */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-2.5">
                <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/45">
                  Neon Arena <span className="mx-1.5 text-fuchsia-400">/</span> {NAV.find((n) => n.key === tab)?.label}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm" variant="outline"
                    className="h-8 border-white/20 bg-transparent text-xs text-white hover:bg-white/10"
                    onClick={() => { setDevices(INITIAL.map((d) => ({ ...d }))); setOpenId(null); toast.success("Demo reset"); }}
                  >
                    <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reset
                  </Button>
                  <div className="grid h-8 w-8 place-items-center rounded-full bg-fuchsia-500/20 font-display text-xs font-bold text-fuchsia-200">NA</div>
                </div>
              </div>

              {/* mobile nav */}
              <div className="flex gap-2 overflow-x-auto border-b border-white/10 px-3 py-2 md:hidden">
                {NAV.map((n) => (
                  <button
                    key={n.key} type="button" onClick={() => setTab(n.key)}
                    className={cn(
                      "shrink-0 rounded-full border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] transition",
                      tab === n.key ? "border-fuchsia-500/60 bg-fuchsia-500/15 text-fuchsia-300" : "border-white/12 text-white/50",
                    )}
                  >
                    {n.label}
                  </button>
                ))}
              </div>

              {/* HUD */}
              <div className="grid grid-cols-2 gap-3 px-4 py-4 sm:grid-cols-4">
                <Hud label="Live now" value={String(live.length)} tone="emerald" />
                <Hud label="Available" value={String(devices.filter((d) => d.status === "available").length)} tone="teal" />
                <Hud label="Reserved" value={String(devices.filter((d) => d.status === "reserved").length)} tone="amber" />
                <Hud label="Running ₹" value={inr(revenue)} tone="magenta" pulse />
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={tab}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18 }}
                >
                  {tab === "overview" && <DemoOverview live={live.length} revenue={revenue} />}

                  {tab === "floor" && (
                    <>
                      <div className="flex flex-wrap gap-2 px-4 pb-3">
                        {FILTERS.map((f) => (
                          <button
                            key={f} type="button" onClick={() => setFilter(f)}
                            className={cn(
                              "rounded-full border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] transition",
                              filter === f ? "border-fuchsia-500/60 bg-fuchsia-500/15 text-fuchsia-300" : "border-white/12 text-white/50 hover:text-white",
                            )}
                          >
                            {f}
                          </button>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 gap-3 p-4 pt-0 sm:grid-cols-3">
                        {shown.map((d, i) => (
                          <Pod key={d.id} d={d} now={now} index={i} onClick={() => setOpenId(d.id)} />
                        ))}
                      </div>
                    </>
                  )}

                  {tab === "bookings" && <DemoBookings />}
                  {tab === "pos" && <DemoPos />}
                  {tab === "customers" && <DemoCustomers />}
                  {tab === "analytics" && <DemoAnalytics />}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>


        {/* conversion */}
        <div className="mt-12 text-center">
          <h3 className="font-display text-[28px] font-bold">Ready to run your café like this?</h3>
          <p className="mt-2 text-base text-muted-foreground">Start your 15-day free trial. Setup takes 5 minutes.</p>
          <Link to="/signup" className="mt-6 inline-block">
            <Button
              className="group/l relative h-14 w-[200px] overflow-hidden border-0 text-white"
              style={{ background: "linear-gradient(135deg,#ff006e,#7b2fff)", boxShadow: "0 0 44px rgba(255,0,110,0.45)" }}
            >
              <span className="relative z-10 inline-flex items-center">Launch Your Café <ArrowRight className="ml-2 h-4 w-4" /></span>
              <span aria-hidden className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/35 to-transparent transition-transform duration-700 group-hover/l:translate-x-full" />
            </Button>
          </Link>
          <p className="mt-4 text-xs text-muted-foreground">✓ No card required · ✓ Cancel anytime · ✓ Setup in 5 min</p>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <DemoModal
            d={open} now={now}
            onClose={() => setOpenId(null)}
            patch={(p) => patch(open.id, p)}
          />
        )}
      </AnimatePresence>
    </section>
  );
}

function Hud({ label, value, tone, pulse }: { label: string; value: string; tone: string; pulse?: boolean }) {
  const color = tone === "emerald" ? "#00e58a" : tone === "teal" ? "#2dd4bf" : tone === "amber" ? "#ffb020" : "#ff006e";
  return (
    <motion.div
      animate={pulse ? { boxShadow: [`0 0 0px ${color}00`, `0 0 24px ${color}55`, `0 0 0px ${color}00`] } : undefined}
      transition={{ duration: 2.4, repeat: Infinity }}
      className="rounded-2xl border border-white/10 bg-white/[0.03] p-3"
    >
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/45">{label}</div>
      <div className="mt-1 font-display text-2xl font-extrabold tabular-nums" style={{ color }}>{value}</div>
    </motion.div>
  );
}

function Pod({ d, now, index, onClick }: { d: DemoDevice; now: number; index: number; onClick: () => void }) {
  const Icon = ICONS[d.type];
  const live = d.status === "in_use";
  const tone =
    live ? "#00e58a" : d.status === "reserved" ? "#ffb020" : d.status === "maintenance" ? "#8b8b9a" : "#2dd4bf";

  return (
    <motion.button
      type="button" onClick={onClick}
      initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
      transition={{ delay: index * 0.05 }}
      whileHover={{ y: -3 }} whileTap={{ scale: 0.98 }}
      className="relative overflow-hidden rounded-2xl border p-4 text-left"
      style={{
        borderColor: `${tone}55`,
        background: `linear-gradient(180deg, ${tone}12, rgba(255,255,255,0.02))`,
        boxShadow: live ? `0 0 30px ${tone}33` : undefined,
      }}
    >
      <div className="absolute inset-x-0 top-0 h-[3px]" style={{ background: tone }} />
      <div className="flex items-start justify-between">
        <div>
          <div className="font-display text-lg font-black text-white">{d.name}</div>
          <div className="font-mono text-[10px] uppercase tracking-[0.2em]" style={{ color: tone }}>
            {d.status.replace("_", " ")}
          </div>
        </div>
        <Icon className="h-6 w-6" style={{ color: tone }} />
      </div>

      <div className="mt-4 min-h-[54px]">
        {live && (
          <>
            <div className="font-semibold text-fuchsia-400">{d.customer}</div>
            <div className="flex items-end justify-between">
              <span className="font-mono text-[22px] font-bold tabular-nums text-emerald-400">{hhmmss(now - (d.timer_start ?? now))}</span>
              <span className="font-display text-lg font-bold text-white">{inr(earned(d, now))}</span>
            </div>
          </>
        )}
        {d.status === "reserved" && (
          <>
            <div className="font-semibold text-amber-300">{d.customer}</div>
            <div className="font-mono text-lg tabular-nums text-amber-300">starts in {d.starts_in}</div>
          </>
        )}
        {d.status === "maintenance" && <div className="text-sm text-white/50">{d.reason}</div>}
        {d.status === "available" && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-white/50">{inr(d.rate)}/hr</span>
            <span className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white" style={{ background: "linear-gradient(135deg,#ff006e,#7b2fff)" }}>
              START
            </span>
          </div>
        )}
      </div>
    </motion.button>
  );
}

function DemoModal({ d, now, onClose, patch }: {
  d: DemoDevice; now: number; onClose: () => void; patch: (p: Partial<DemoDevice>) => void;
}) {
  const [name, setName] = useState("Walk-in");
  const [reason, setReason] = useState("");
  const [resName, setResName] = useState("");
  const [resTime, setResTime] = useState("00:30:00");
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [receipt, setReceipt] = useState<number | null>(null);
  const Icon = ICONS[d.type];

  return (
    <motion.div
      className="fixed inset-0 z-[80] grid place-items-center p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ background: "rgba(2,0,8,0.7)", backdropFilter: "blur(10px)" }}
      onClick={onClose}
    >
      <motion.div
        onClick={(e) => e.stopPropagation()}
        initial={{ scale: 0.94, y: 18, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 26 }}
        className="w-full max-w-md overflow-hidden rounded-[28px] border p-6"
        style={{ borderColor: "rgba(255,255,255,0.1)", background: "rgba(8,2,20,0.97)" }}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white/5"><Icon className="h-5 w-5 text-fuchsia-400" /></div>
            <div>
              <div className="font-display text-xl font-black text-white">{d.name}</div>
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/45">{d.status.replace("_", " ")} · {inr(d.rate)}/hr</div>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-white/50 hover:bg-white/10 hover:text-white"><X className="h-4 w-4" /></button>
        </div>

        <div className="mt-6 space-y-3">
          {receipt !== null && (
            <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-center">
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-emerald-300">Receipt</div>
              <div className="font-display text-3xl font-black text-white">{inr(receipt)}</div>
            </div>
          )}

          {d.status === "available" && (
            <>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Customer name" className="bg-white/5" />
              <Button
                className="h-12 w-full border-0 text-white"
                style={{ background: "linear-gradient(135deg,#ff006e,#7b2fff)" }}
                onClick={() => {
                  patch({ status: "in_use", customer: name || "Walk-in", timer_start: Date.now() });
                  setReceipt(null);
                  toast.success("Session started! ⚡");
                }}
              >
                <Play className="mr-1.5 h-4 w-4" /> Start session
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" className="border-white/15 bg-transparent text-white hover:bg-white/10"
                  onClick={() => { patch({ status: "reserved", customer: resName || "Guest", starts_in: resTime }); toast.success("Slot reserved!"); }}>
                  <CalendarClock className="mr-1.5 h-4 w-4" /> Reserve
                </Button>
                <Button variant="outline" className="border-white/15 bg-transparent text-white hover:bg-white/10"
                  onClick={() => { patch({ status: "maintenance", reason: reason || "Scheduled maintenance" }); toast("Marked for maintenance"); }}>
                  <Wrench className="mr-1.5 h-4 w-4" /> Maintenance
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input value={resName} onChange={(e) => setResName(e.target.value)} placeholder="Reserve for…" className="bg-white/5" />
                <Input value={resTime} onChange={(e) => setResTime(e.target.value)} placeholder="00:30:00" className="bg-white/5 font-mono" />
              </div>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Maintenance reason" className="bg-white/5" />
            </>
          )}

          {d.status === "in_use" && (
            <>
              <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/5 p-5 text-center">
                <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/45">{d.customer}</div>
                <div className="mt-1 font-mono text-[40px] font-bold leading-none tabular-nums text-emerald-400">
                  {hhmmss(now - (d.timer_start ?? now))}
                </div>
                <div className="mt-2 font-display text-3xl font-black text-fuchsia-400">{inr(earned(d, now))}</div>
              </div>
              {confirmEnd ? (
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1 border-white/15 bg-transparent text-white" onClick={() => setConfirmEnd(false)}>Keep running</Button>
                  <Button
                    className="flex-1 border-0 text-white" style={{ background: "linear-gradient(135deg,#ff006e,#7b2fff)" }}
                    onClick={() => {
                      const amt = earned(d, now);
                      setReceipt(amt); setConfirmEnd(false);
                      patch({ status: "available", customer: undefined, timer_start: undefined });
                      toast.success(`Session ended — ${inr(amt)} collected`);
                    }}
                  >
                    <Check className="mr-1.5 h-4 w-4" /> Confirm end
                  </Button>
                </div>
              ) : (
                <Button className="h-12 w-full border-0 text-white" style={{ background: "linear-gradient(135deg,#ff006e,#7b2fff)" }} onClick={() => setConfirmEnd(true)}>
                  <Square className="mr-1.5 h-4 w-4" /> End session
                </Button>
              )}
              <Button variant="outline" className="w-full border-white/15 bg-transparent text-white hover:bg-white/10"
                onClick={() => { patch({ timer_start: (d.timer_start ?? Date.now()) - 30 * 60000 }); toast.success("+30 min added"); }}>
                <Zap className="mr-1.5 h-4 w-4" /> +30 min
              </Button>
            </>
          )}

          {(d.status === "reserved" || d.status === "maintenance") && (
            <>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-center text-white/70">
                {d.status === "reserved" ? <>Reserved for <b className="text-amber-300">{d.customer}</b> · starts in {d.starts_in}</> : d.reason}
              </div>
              <Button className="h-12 w-full border-0 text-white" style={{ background: "linear-gradient(135deg,#ff006e,#7b2fff)" }}
                onClick={() => { patch({ status: "available", customer: undefined, reason: undefined, starts_in: undefined }); toast.success("Station is free"); }}>
                Mark free
              </Button>
            </>
          )}
        </div>

        <p className="mt-5 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-white/30">Demo only · nothing is saved</p>
      </motion.div>
    </motion.div>
  );
}
