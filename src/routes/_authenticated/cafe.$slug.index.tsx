import { createFileRoute } from "@tanstack/react-router";
import { memo, useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import {
  Gamepad2, Play, Square, Zap, MonitorPlay, Headset, Car, Cpu, Pause, Wrench,
  Check, Lock, IndianRupee, ArrowRight, Search, Printer, ArrowLeftRight,
  Clock3,
} from "lucide-react";
import { getCafeBySlug } from "@/lib/cafes.functions";
import { listDevices, setDeviceStatus, type DeviceStatus } from "@/lib/devices.functions";
import { listSessions, startSession, endSession } from "@/lib/sessions.functions";
import { listCustomers, createCustomer } from "@/lib/customers.functions";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/EmptyState";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogIcon } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/cafe/$slug/")({
  head: () => ({
    meta: [
      { title: "Live Floor — CoreCade" },
      { name: "description", content: "Mission-control view of every station, live session and rupee on your café floor." },
      { property: "og:title", content: "Live Floor — CoreCade" },
      { property: "og:description", content: "Mission-control view of every station, live session and rupee on your café floor." },
    ],
  }),
  component: LiveFloor,
});

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

const TYPE_ICON: Record<string, typeof Cpu> = {
  pc: MonitorPlay, console: Gamepad2, vr: Headset, racing: Car, other: Cpu,
};

const FILTERS: { id: "all" | DeviceStatus; label: string }[] = [
  { id: "all", label: "All" },
  { id: "in_use", label: "Live" },
  { id: "available", label: "Free" },
  { id: "reserved", label: "Booked" },
  { id: "suspended", label: "Suspended" },
  { id: "maintenance", label: "Maintenance" },
];

function fmtClock(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}
function billed(startedAt: string, rate: number, now: number) {
  const minutes = Math.max(1, Math.ceil((now - new Date(startedAt).getTime()) / 60000));
  return Math.ceil((rate * minutes) / 60);
}
function initials(text: string) {
  return text.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
}
function avatarGradient(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360;
  return `linear-gradient(135deg, hsl(${h} 85% 58%), hsl(${(h + 60) % 360} 85% 52%))`;
}

type SessionRow = {
  id: string; device_id: string; started_at: string; status: string;
  customers?: { full_name?: string } | null;
};
type DeviceRow = {
  id: string; name: string; type: string; hourly_rate: number; status: string;
  zone?: string | null; zone_color?: string | null; suspend_until?: string | null;
};

/* ------------------------------------------------------------------ */
/* Station pod (memoised)                                              */
/* ------------------------------------------------------------------ */

const Pod = memo(function Pod({
  device, session, now, index = 0, onOpen, onStart,
}: {
  device: DeviceRow;
  session?: SessionRow;
  now: number;
  index?: number;
  onOpen: () => void;
  onStart: () => void;
}) {
  const status = (device.status as DeviceStatus) ?? "available";
  const Icon = TYPE_ICON[device.type] ?? Cpu;
  const live = status === "in_use" && !!session;
  const booked = status === "reserved";
  const broken = status === "maintenance";
  const paused = status === "suspended";

  const skin = live
    ? { bg: "rgba(0,255,100,0.025)", border: "1px solid rgba(0,255,100,0.3)", bar: "linear-gradient(90deg,#00ff88,#00d4aa)" }
    : booked
      ? { bg: "rgba(255,170,0,0.03)", border: "1px solid rgba(255,170,0,0.3)", bar: "linear-gradient(90deg,#ffaa00,#ff6a00)" }
      : paused
        ? { bg: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,50,50,0.2)", bar: "linear-gradient(90deg,#94a3b8,#64748b)" }
        : broken
          ? { bg: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,50,50,0.2)", bar: "linear-gradient(90deg,#ff3232,#b91c1c)" }
          : { bg: "rgba(255,255,255,0.025)", border: "1px solid rgba(0,212,255,0.18)", bar: "linear-gradient(90deg,#00d4ff,#0080ff)" };

  return (
    <motion.div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } }}
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", damping: 20, stiffness: 260, delay: Math.min(index, 12) * 0.05 }}
      className={`pod group relative flex min-h-[220px] cursor-pointer flex-col overflow-hidden rounded-[20px] p-4 text-left active:scale-[0.99] ${live ? "pod-live" : status === "available" ? "pod-free" : ""}`}
      style={{ background: skin.bg, border: skin.border, backdropFilter: "blur(12px)" }}
      aria-label={`${device.name} — ${status}`}
    >
      <span className="absolute inset-x-0 top-0 h-[3px]" style={{ background: skin.bar }} aria-hidden />


      {live ? (
        <div className="relative flex flex-1 flex-col">
          <div className="flex items-start justify-between gap-2">
            <span className="min-w-0 truncate text-[14px] font-bold">{device.name}</span>
            <span className="shrink-0 rounded-full bg-[rgba(0,255,100,0.15)] px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em] text-emerald-300">
              ● Live
            </span>
          </div>
          <div className="mt-1.5 truncate text-[18px] font-bold text-primary">
            {session?.customers?.full_name ?? "Walk-in"}
          </div>
          <span className="mt-1 inline-flex w-fit rounded-full border border-white/12 bg-white/5 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.16em] text-foreground/70">
            {session?.customers?.full_name ? "Member" : "Walk-in"}
          </span>
          <div className="mt-auto pt-3">
            <div className="font-mono text-[28px] font-bold leading-none tabular-nums text-emerald-400">
              {fmtClock(now - new Date(session!.started_at).getTime())}
            </div>
            <div className="mt-1 text-[20px] font-bold tabular-nums">
              ₹{billed(session!.started_at, device.hourly_rate, now)}
            </div>
            <span className="mt-2.5 inline-flex w-full items-center justify-center gap-1 rounded-xl border border-emerald-400/40 bg-emerald-400/5 py-2 text-[12px] font-semibold text-emerald-300 transition group-hover:bg-emerald-400/12">
              Details <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </div>
        </div>
      ) : booked ? (
        <div className="relative flex flex-1 flex-col">
          <div className="truncate text-[14px] font-bold">{device.name}</div>
          <div className="mt-3 grid flex-1 place-items-center text-center">
            <div>
              <div className="rounded-full border border-amber-400/40 bg-amber-400/12 px-3 py-1 font-mono text-[12px] font-bold uppercase tracking-[0.16em] text-amber-300">
                ✦ Reserved
              </div>
              <div className="mt-2 truncate text-[13px] font-semibold text-foreground/90">
                {session?.customers?.full_name ?? "Held station"}
              </div>
              <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">₹{device.hourly_rate}/hr</div>
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onStart(); }}
            className="mt-2 inline-flex w-full items-center justify-center gap-1 rounded-xl border border-amber-400/50 bg-amber-400/15 py-2 text-[12px] font-bold text-amber-200 transition hover:bg-amber-400/25"
          >
            Check in
          </button>
        </div>
      ) : paused || broken ? (
        <div className="relative flex flex-1 flex-col">
          <div className="truncate text-[14px] font-bold">{device.name}</div>
          <div className="grid flex-1 place-items-center text-center">
            <div>
              <div className={`font-mono text-[13px] font-bold uppercase tracking-[0.16em] ${paused ? "text-slate-300" : "text-rose-300"}`}>
                {paused ? "⏸ Suspended" : "✖ Maintenance"}
              </div>
              <div className="mt-1.5 text-[11px] text-muted-foreground">
                {paused
                  ? device.suspend_until
                    ? `Back at ${new Date(device.suspend_until).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`
                    : "Temporarily out of rotation"
                  : "Under repair — not bookable"}
              </div>
            </div>
          </div>
          <span className="inline-flex w-full items-center justify-center rounded-xl border border-white/12 py-2 text-[12px] font-semibold text-foreground/70">
            Manage
          </span>
        </div>
      ) : (
        <div className="relative flex flex-1 flex-col">
          <div className="flex items-start justify-between gap-2">
            <span className="min-w-0 truncate text-[28px] font-bold leading-none">{device.name}</span>
          </div>
          <div className="grid flex-1 place-items-center py-3">
            <div className="text-center">
              <Icon
                className="mx-auto h-12 w-12 text-[#22d3a8] transition-all duration-150 group-hover:scale-105"
                style={{ filter: "drop-shadow(0 0 10px rgba(0,212,255,0.45))" }}
              />
              <div className="mt-2 font-mono text-[12px] text-muted-foreground">₹{device.hourly_rate}/hr</div>
              <span className="mt-2 inline-flex rounded-full border border-[rgba(0,212,255,0.35)] bg-[rgba(0,212,255,0.1)] px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em] text-[#5ee9ff]">
                Available
              </span>
            </div>
          </div>
          <div className="space-y-1.5">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onStart(); }}
              className="inline-flex h-9 w-full items-center justify-center rounded-xl text-[12px] font-bold text-primary-foreground transition hover:brightness-110"
              style={{ background: "var(--gradient-brand-hot)" }}
            >
              Start
            </button>
            <span className="inline-flex h-8 w-full items-center justify-center rounded-xl border border-white/15 text-[12px] font-semibold text-foreground/80">
              Book
            </span>
          </div>
        </div>
      )}
    </motion.div>

  );
});

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

function LiveFloor() {
  const { slug } = Route.useParams();
  const isMobile = useIsMobile();
  const getCafe = useServerFn(getCafeBySlug);
  const { data: cafe } = useQuery({ queryKey: ["cafe", slug], queryFn: () => getCafe({ data: { slug } }) });
  const cafeId = cafe?.id;

  const lDev = useServerFn(listDevices);
  const lSes = useServerFn(listSessions);
  const lCus = useServerFn(listCustomers);

  const devicesQ = useQuery({
    queryKey: ["devices", cafeId], queryFn: () => lDev({ data: { cafe_id: cafeId! } }),
    enabled: !!cafeId, refetchInterval: 8000,
  });
  const sessionsQ = useQuery({
    queryKey: ["sessions", cafeId], queryFn: () => lSes({ data: { cafe_id: cafeId! } }),
    enabled: !!cafeId, refetchInterval: 8000,
  });
  const customersQ = useQuery({
    queryKey: ["customers", cafeId], queryFn: () => lCus({ data: { cafe_id: cafeId! } }),
    enabled: !!cafeId,
  });

  const qc = useQueryClient();
  const start = useServerFn(startSession);
  const end = useServerFn(endSession);
  const setStatus = useServerFn(setDeviceStatus);
  const addCust = useServerFn(createCustomer);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["devices", cafeId] });
    qc.invalidateQueries({ queryKey: ["sessions", cafeId] });
  };

  const startM = useMutation({
    mutationFn: start,
    onSuccess: () => { toast.success("Session started"); invalidate(); setPanel(null); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const endM = useMutation({
    mutationFn: end,
    onSuccess: (r) => { toast.success(`Session ended · ${r.minutes}m · ₹${r.amount}`); invalidate(); setPanel(null); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const statusM = useMutation({
    mutationFn: setStatus,
    onSuccess: () => { toast.success("Station updated"); invalidate(); setPanel(null); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [panel, setPanel] = useState<string | null>(null);       // device id
  const [walkInOpen, setWalkInOpen] = useState(false);
  const [search, setSearch] = useState("");

  // Single ticker for the whole floor.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const devices = (devicesQ.data ?? []) as unknown as DeviceRow[];
  const sessions = (sessionsQ.data ?? []) as unknown as SessionRow[];
  const customers = customersQ.data ?? [];

  const activeByDevice = useMemo(
    () => new Map(sessions.filter((s) => s.status === "active").map((s) => [s.device_id, s])),
    [sessions],
  );

  const counts = useMemo(() => {
    const c: Record<DeviceStatus, number> = { available: 0, in_use: 0, reserved: 0, suspended: 0, maintenance: 0 };
    for (const d of devices) {
      const s = (d.status as DeviceStatus) ?? "available";
      if (c[s] !== undefined) c[s] += 1;
    }
    return c;
  }, [devices]);

  const runningTotal = useMemo(() => {
    let sum = 0;
    for (const d of devices) {
      const s = activeByDevice.get(d.id);
      if (s) sum += billed(s.started_at, d.hourly_rate, now);
    }
    return sum;
  }, [devices, activeByDevice, now]);

  const revenueToday = useMemo(() => {
    const today = new Date().toDateString();
    return (sessionsQ.data ?? []).reduce(
      (sum, s) => sum + ((s as { ended_at?: string | null; amount?: number | null }).ended_at &&
        new Date((s as { ended_at: string }).ended_at).toDateString() === today
        ? ((s as { amount?: number | null }).amount ?? 0) : 0),
      0,
    );
  }, [sessionsQ.data]);

  const filtered = filter === "all" ? devices : devices.filter((d) => d.status === filter);
  const selected = devices.find((d) => d.id === panel) ?? null;
  const selectedSession = selected ? activeByDevice.get(selected.id) : undefined;

  const filteredCustomers = customers.filter((c) =>
    !search || (c.full_name ?? "").toLowerCase().includes(search.toLowerCase()) || (c.phone ?? "").includes(search),
  );

  if (!cafeId || devicesQ.isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-[52px] animate-pulse rounded-2xl border border-white/8 bg-white/[0.03]" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton h-[200px] rounded-2xl border border-white/8" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="console-atmos space-y-4">
      <div className="orb-a" aria-hidden />
      <div className="orb-b" aria-hidden />
      {/* ===== HUD BAR ===== */}
      <div
        className="sticky top-[52px] z-20 -mx-3 flex h-[56px] items-center gap-2.5 overflow-x-auto px-3 sm:mx-0 sm:rounded-2xl"
        style={{
          background: "rgba(10,0,20,0.9)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,0.07)",
        }}
      >
        <div className="flex shrink-0 items-center gap-2 font-mono text-[11px] tabular-nums">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-1 text-emerald-300">
            <span className={`h-1.5 w-1.5 rounded-full bg-emerald-400 ${counts.in_use > 0 ? "animate-pulse" : ""}`} />
            {counts.in_use} LIVE
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-400/25 bg-sky-400/10 px-2.5 py-1 text-sky-300">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
            {counts.available} FREE
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/25 bg-amber-400/10 px-2.5 py-1 text-amber-300">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
            {counts.reserved} BOOKED
          </span>
        </div>
        <span className="h-6 w-px shrink-0 bg-white/10" />
        <div className="flex shrink-0 items-center gap-3 font-mono text-[12px] tabular-nums text-muted-foreground">
          <span className={`font-bold text-foreground ${counts.in_use > 0 ? "animate-pulse-soft ticker-glow" : ""}`}>
            ⚡ ₹{runningTotal.toLocaleString("en-IN")} running
          </span>
          <span>₹{revenueToday.toLocaleString("en-IN")} today</span>
        </div>
        <Button
          onClick={() => setWalkInOpen(true)}
          disabled={counts.available === 0}
          className="btn-glow-magenta ml-auto h-9 shrink-0 gap-1.5 text-primary-foreground"
          style={{ background: "var(--gradient-brand-hot)" }}
        >
          <Zap className="h-4 w-4" /> Session
        </Button>
      </div>

      {/* ===== FILTER PILLS ===== */}
      <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 sm:mx-0 sm:px-0">
        {FILTERS.map((f) => {
          const n = f.id === "all" ? devices.length : counts[f.id as DeviceStatus];
          const active = filter === f.id;
          return (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] ${active ? "pill-on" : "pill-off"}`}
            >
              {f.label}
              <span className={`ml-1.5 rounded-full px-1.5 ${active ? "bg-black/30" : "bg-white/10"}`}>{n}</span>
            </button>
          );
        })}
      </div>

      {/* ===== STATION GRID ===== */}
      {devices.length === 0 ? (
        <EmptyState
          icon={Gamepad2}
          title="No stations yet"
          description="Head to Devices to add your first PC, console, or VR rig."
        />
      ) : (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-5"
        >
          {filtered.map((d, i) => (
            <Pod
              key={d.id}
              device={d}
              session={activeByDevice.get(d.id)}
              now={now}
              index={i}
              onOpen={() => setPanel(d.id)}
              onStart={() => setPanel(d.id)}
            />
          ))}
        </motion.div>
      )}


      {/* ===== STATION PANEL ===== */}
      <Sheet open={!!panel} onOpenChange={(v) => !v && setPanel(null)}>
        <SheetContent
          side={isMobile ? "bottom" : "right"}
          className={isMobile
            ? "max-h-[92vh] overflow-y-auto rounded-t-[28px] border-t border-[rgba(255,100,200,0.2)] bg-[rgba(10,0,20,0.97)] p-5 backdrop-blur-[24px]"
            : "w-full overflow-y-auto border-l border-[rgba(255,100,200,0.2)] bg-[rgba(10,0,20,0.97)] p-6 backdrop-blur-[24px] sm:max-w-[400px]"}
        >
          {selected && (
            <div className="space-y-5">
              {/* header */}
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                  {selected.name}
                </span>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em] ${
                    selectedSession
                      ? "bg-[rgba(0,255,100,0.15)] text-emerald-300"
                      : "border border-white/15 bg-white/5 text-foreground/70"
                  }`}
                >
                  {selectedSession ? "● Live" : selected.status.replace("_", " ")}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <div
                  className="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-full font-display text-base font-black text-black/80"
                  style={{ background: avatarGradient(selectedSession?.customers?.full_name ?? selected.name) }}
                >
                  {initials(selectedSession?.customers?.full_name ?? selected.name)}
                </div>
                <div className="min-w-0">
                  <div className="truncate font-display text-[24px] font-extrabold leading-tight">
                    {selectedSession?.customers?.full_name ?? selected.name}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2">
                    <span className="rounded-full border border-white/12 bg-white/5 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.16em] text-foreground/70">
                      {selectedSession ? (selectedSession.customers?.full_name ? "Member" : "Walk-in") : `₹${selected.hourly_rate}/hr`}
                    </span>
                    {selected.zone && (
                      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                        {selected.zone}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="h-px bg-white/8" />

              {selectedSession ? (
                <>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-center">
                    <div className="font-mono text-[44px] font-bold leading-none tabular-nums text-emerald-400">
                      {fmtClock(now - new Date(selectedSession.started_at).getTime())}
                    </div>
                    <div className="mt-2 font-display text-[36px] font-extrabold leading-none tabular-nums text-primary">
                      ₹{billed(selectedSession.started_at, selected.hourly_rate, now)}
                    </div>
                    <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                      running total · ₹{selected.hourly_rate}/hr
                    </div>
                  </div>

                  <div className="h-px bg-white/8" />

                  <Button
                    onClick={() => endM.mutate({ data: { id: selectedSession.id } })}
                    disabled={endM.isPending}
                    className="h-12 w-full gap-2 rounded-xl text-[15px] font-bold text-primary-foreground"
                    style={{ background: "var(--gradient-brand-hot)" }}
                  >
                    <Square className="h-4 w-4" /> {endM.isPending ? "Ending…" : "End session"}
                  </Button>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" className="h-11 gap-1.5 rounded-xl"
                      onClick={() => statusM.mutate({ data: { id: selected.id, status: "suspended", suspend_minutes: 15 } })}>
                      <Pause className="h-3.5 w-3.5" /> Pause
                    </Button>
                    <Button variant="outline" className="h-11 gap-1.5 rounded-xl"
                      onClick={() => statusM.mutate({ data: { id: selected.id, status: "suspended", suspend_minutes: 30 } })}>
                      <Clock3 className="h-3.5 w-3.5" /> +30 min
                    </Button>
                    <Button variant="outline" className="h-11 gap-1.5 rounded-xl"
                      onClick={() => statusM.mutate({ data: { id: selected.id, status: "maintenance" } })}>
                      <ArrowLeftRight className="h-3.5 w-3.5" /> Maintenance
                    </Button>
                    <Button variant="outline" className="h-11 gap-1.5 rounded-xl" onClick={() => window.print()}>
                      <Printer className="h-3.5 w-3.5" /> Receipt
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label>Find customer</Label>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name or phone…" className="pl-9" />
                    </div>
                    <div className="max-h-52 overflow-y-auto rounded-xl border border-white/10">
                      {filteredCustomers.length === 0 ? (
                        <div className="p-4 text-center text-xs text-muted-foreground">No customers matched</div>
                      ) : filteredCustomers.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => startM.mutate({ data: { cafe_id: cafeId, device_id: selected.id, customer_id: c.id } })}
                          className="flex w-full items-center gap-3 border-b border-white/5 px-3 py-2 text-left text-sm last:border-0 hover:bg-white/5"
                        >
                          <span
                            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[11px] font-bold text-black/80"
                            style={{ background: avatarGradient(c.full_name ?? "?") }}
                          >
                            {initials(c.full_name ?? "?")}
                          </span>
                          <span className="min-w-0 flex-1 truncate">{c.full_name}</span>
                          <span className="shrink-0 font-mono text-xs text-muted-foreground">{c.phone}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <Button
                    onClick={() => startM.mutate({ data: { cafe_id: cafeId, device_id: selected.id } })}
                    disabled={startM.isPending}
                    className="cta-shimmer h-[52px] w-full gap-2 rounded-xl text-[15px] font-bold text-primary-foreground"
                    style={{ background: "var(--gradient-brand-hot)" }}
                  >
                    <Play className="h-4 w-4" /> {startM.isPending ? "Starting…" : "Start walk-in session →"}
                  </Button>

                  <div className="grid grid-cols-3 gap-2">
                    <Button size="sm" variant="outline" className="h-11 gap-1.5 rounded-xl"
                      onClick={() => statusM.mutate({ data: { id: selected.id, status: "reserved" } })}>
                      <Lock className="h-3.5 w-3.5" /> Reserve
                    </Button>
                    <Button size="sm" variant="outline" className="h-11 gap-1.5 rounded-xl"
                      onClick={() => statusM.mutate({ data: { id: selected.id, status: "maintenance" } })}>
                      <Wrench className="h-3.5 w-3.5" /> Fix
                    </Button>
                    <Button size="sm" variant="outline" className="h-11 gap-1.5 rounded-xl"
                      onClick={() => statusM.mutate({ data: { id: selected.id, status: "available" } })}>
                      <Check className="h-3.5 w-3.5" /> Free
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* ===== WALK-IN ===== */}
      <Dialog open={walkInOpen} onOpenChange={setWalkInOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogIcon><Zap className="h-5 w-5" /></DialogIcon>
            <DialogTitle>New session</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const fullName = String(fd.get("full_name") || "").trim();
              const phone = String(fd.get("phone") || "").trim();
              const deviceId = String(fd.get("device_id") || "");
              try {
                let customerId: string | undefined;
                if (fullName || phone) {
                  const cust = await addCust({
                    data: { cafe_id: cafeId, full_name: fullName || "Walk-in", phone: phone || null, email: null },
                  });
                  customerId = cust?.id;
                  qc.invalidateQueries({ queryKey: ["customers", cafeId] });
                }
                startM.mutate({ data: { cafe_id: cafeId, device_id: deviceId, customer_id: customerId } });
                setWalkInOpen(false);
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Failed");
              }
            }}
          >
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Name (optional)</Label>
                <Input name="full_name" placeholder="Walk-in" autoFocus />
              </div>
              <div className="space-y-1.5">
                <Label>Phone (optional)</Label>
                <Input name="phone" type="tel" inputMode="tel" placeholder="+91…" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Allot a station</Label>
              <select
                name="device_id"
                required
                defaultValue={devices.find((d) => d.status === "available")?.id ?? ""}
                className="field-select"
              >
                <option value="" disabled>Choose…</option>
                {devices.filter((d) => d.status === "available").map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} · {d.type.toUpperCase()} · ₹{d.hourly_rate}/hr
                  </option>
                ))}
              </select>
            </div>
            <DialogFooter className="pt-1">
              <Button type="submit" disabled={counts.available === 0 || startM.isPending}
                className="h-12 w-full gap-1.5 rounded-xl text-[15px] font-bold text-primary-foreground"
                style={{ background: "var(--gradient-brand-hot)" }}>
                <IndianRupee className="h-4 w-4" /> {startM.isPending ? "Processing…" : "Seat & start"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

