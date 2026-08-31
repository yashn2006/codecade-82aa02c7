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
import { listDevices, setDeviceStatus, updateDevice, type DeviceStatus } from "@/lib/devices.functions";
import { listSessions, startSession, endSession } from "@/lib/sessions.functions";
import { listCustomers, createCustomer } from "@/lib/customers.functions";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/EmptyState";
import { StationModal } from "@/components/StationModal";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogIcon } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
  planned_minutes?: number | null; package_name?: string | null;
  amount_paid?: number | null; paused_ms?: number | null;
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
  device, session, now, index = 0, onOpen, onStart, onExtend, onEnd,
}: {
  device: DeviceRow;
  session?: SessionRow;
  now: number;
  index?: number;
  onOpen: () => void;
  onStart: () => void;
  onExtend?: () => void;
  onEnd?: () => void;
}) {
  const status = (device.status as DeviceStatus) ?? "available";
  const Icon = TYPE_ICON[device.type] ?? Cpu;
  const live = status === "in_use" && !!session;
  const booked = status === "reserved";
  const broken = status === "maintenance";
  const paused = status === "suspended";

  const tone = live
    ? { hex: "#00ff88", rgb: "0,255,136", label: "Live" }
    : booked
      ? { hex: "#ffaa00", rgb: "255,170,0", label: "Reserved" }
      : paused
        ? { hex: "#94a3b8", rgb: "148,163,184", label: "Suspended" }
        : broken
          ? { hex: "#ff5470", rgb: "255,84,112", label: "Maintenance" }
          : { hex: "#00d4ff", rgb: "0,212,255", label: "Available" };

  // Live timing
  const elapsedMs = live ? Math.max(0, now - new Date(session!.started_at).getTime() - Number(session!.paused_ms ?? 0)) : 0;
  const plannedMin = live ? Number(session!.planned_minutes ?? 0) : 0;
  const remainingMs = plannedMin > 0 ? plannedMin * 60000 - elapsedMs : null;
  const critical = remainingMs !== null && remainingMs <= 5 * 60000;
  const warning = remainingMs !== null && !critical && remainingMs <= 10 * 60000;
  const progress = plannedMin > 0 ? Math.min(100, (elapsedMs / (plannedMin * 60000)) * 100) : null;
  const clockColor = critical ? "#ff5470" : warning ? "#ffaa00" : tone.hex;
  const clockText = remainingMs !== null ? fmtClock(Math.max(0, remainingMs)) : fmtClock(elapsedMs);

  const name = session?.customers?.full_name ?? "Walk-in";

  return (
    <motion.div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } }}
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", damping: 22, stiffness: 280, delay: Math.min(index, 12) * 0.035 }}
      className={`pod group relative flex min-h-[228px] cursor-pointer select-none flex-col overflow-hidden rounded-[22px] p-4 text-left ${live ? "pod-live" : status === "available" ? "pod-free" : ""}`}
      style={{
        background: `linear-gradient(160deg, rgba(${tone.rgb},0.10) 0%, rgba(255,255,255,0.022) 42%, rgba(0,0,0,0.18) 100%)`,
        border: `1px solid rgba(${tone.rgb},0.28)`,
        boxShadow: `0 0 0 1px rgba(255,255,255,0.02) inset, 0 18px 40px -24px rgba(${tone.rgb},0.9)`,
        backdropFilter: "blur(14px)",
      }}
      aria-label={`${device.name} — ${status}`}
    >
      {/* top accent + sheen */}
      <span className="absolute inset-x-0 top-0 h-[3px]" style={{ background: `linear-gradient(90deg, transparent, ${tone.hex}, transparent)` }} aria-hidden />
      <span className="pod-sheen" aria-hidden />

      {/* header row */}
      <div className="relative flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {live ? (
            <span
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-[12px] font-black text-black/85"
              style={{ background: avatarGradient(name) }}
            >
              {initials(name)}
            </span>
          ) : (
            <span
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border"
              style={{ borderColor: `rgba(${tone.rgb},0.35)`, background: `rgba(${tone.rgb},0.10)` }}
            >
              <Icon className="h-4 w-4" style={{ color: tone.hex }} />
            </span>
          )}
          <div className="min-w-0">
            <div className="truncate text-[14px] font-bold leading-tight">{device.name}</div>
            <div className="truncate font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
              {device.type} · ₹{device.hourly_rate}/hr
            </div>
          </div>
        </div>
        <span
          className="shrink-0 rounded-full px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.16em]"
          style={{ background: `rgba(${tone.rgb},0.14)`, color: tone.hex, border: `1px solid rgba(${tone.rgb},0.3)` }}
        >
          <span
            className={`mr-1 inline-block h-1.5 w-1.5 rounded-full align-middle ${live ? "animate-dot-pulse" : ""}`}
            style={{ background: tone.hex }}
          />
          {tone.label}
        </span>
      </div>

      {/* body */}
      {live ? (
        <div className="relative mt-3 flex flex-1 flex-col">
          <div className="truncate text-[15px] font-bold text-foreground">{name}</div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {session?.package_name && (
              <span className="rounded-full border border-white/12 bg-white/5 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-foreground/75">
                {session.package_name}
              </span>
            )}
            <span className="rounded-full border border-white/12 bg-white/5 px-2 py-0.5 font-mono text-[9px] text-foreground/75">
              paid ₹{Number(session?.amount_paid ?? 0).toLocaleString("en-IN")}
            </span>
          </div>

          <div className="mt-auto pt-3">
            <div
              className={`font-mono text-[30px] font-black leading-none tabular-nums ${critical ? "animate-pulse-soft" : ""}`}
              style={{ color: clockColor, textShadow: `0 0 18px rgba(${tone.rgb},0.35)` }}
            >
              {clockText}
            </div>
            <div className="mt-1 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
              <span>{remainingMs !== null ? "remaining" : "elapsed"}</span>
              <span className="text-[13px] font-bold text-foreground tabular-nums">
                ₹{billed(session!.started_at, device.hourly_rate, now)}
              </span>
            </div>
            {progress !== null && (
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/8">
                <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${progress}%`, background: `linear-gradient(90deg, ${clockColor}, ${tone.hex})` }} />
              </div>
            )}
          </div>

          {/* hover quick actions */}
          <div className="pod-actions pointer-events-none absolute inset-x-0 bottom-0 flex gap-1.5 rounded-b-[22px] bg-gradient-to-t from-black/75 to-transparent p-2 pt-6 opacity-0">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onExtend?.(); }}
              className="pointer-events-auto flex-1 rounded-lg border border-emerald-400/40 bg-emerald-400/12 py-1.5 text-[11px] font-bold text-emerald-200 transition hover:bg-emerald-400/25"
            >
              +30m
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onOpen(); }}
              className="pointer-events-auto flex-1 rounded-lg border border-amber-400/40 bg-amber-400/12 py-1.5 text-[11px] font-bold text-amber-200 transition hover:bg-amber-400/25"
            >
              Alert
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onEnd?.(); }}
              className="pointer-events-auto flex-1 rounded-lg border border-rose-400/40 bg-rose-400/12 py-1.5 text-[11px] font-bold text-rose-200 transition hover:bg-rose-400/25"
            >
              End
            </button>
          </div>
        </div>
      ) : booked ? (
        <div className="relative mt-3 flex flex-1 flex-col">
          <div className="grid flex-1 place-items-center text-center">
            <div>
              <div className="truncate text-[14px] font-semibold text-foreground/90">
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
        <div className="relative mt-3 flex flex-1 flex-col">
          <div className="grid flex-1 place-items-center text-center">
            <div className="text-[11px] text-muted-foreground">
              {paused
                ? device.suspend_until
                  ? `Back at ${new Date(device.suspend_until).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`
                  : "Temporarily out of rotation"
                : "Under repair — not bookable"}
            </div>
          </div>
          <span className="inline-flex w-full items-center justify-center rounded-xl border border-white/12 py-2 text-[12px] font-semibold text-foreground/70">
            Manage
          </span>
        </div>
      ) : (
        <div className="relative mt-3 flex flex-1 flex-col">
          <div className="grid flex-1 place-items-center py-2">
            <Icon
              className="h-11 w-11 transition-transform duration-200 group-hover:scale-110"
              style={{ color: tone.hex, filter: `drop-shadow(0 0 14px rgba(${tone.rgb},0.5))` }}
            />
          </div>
          <div className="space-y-1.5">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onStart(); }}
              className="inline-flex h-9 w-full items-center justify-center rounded-xl text-[12px] font-bold text-primary-foreground transition hover:brightness-110"
              style={{ background: "var(--gradient-brand-hot)" }}
            >
              Start session
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
  const updateDev = useServerFn(updateDevice);
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
  const updateM = useMutation({
    mutationFn: updateDev,
    onSuccess: () => { toast.success("Station saved"); invalidate(); },
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


      {/* ===== STATION CENTER MODAL ===== */}
      {selected && (
        <StationModal
          device={selected}
          session={selectedSession}
          now={now}
          customers={customers as never}
          onClose={() => setPanel(null)}
          starting={startM.isPending}
          ending={endM.isPending}
          saving={updateM.isPending}
          onStart={(customerId) =>
            startM.mutate({ data: { cafe_id: cafeId, device_id: selected.id, customer_id: customerId } })
          }
          onEnd={() => selectedSession && endM.mutate({ data: { id: selectedSession.id } })}
          onSetStatus={(status, opts) =>
            statusM.mutate({ data: { id: selected.id, status, ...(opts ?? {}) } })
          }
          onSaveEdit={(patch) => updateM.mutate({ data: { id: selected.id, patch } })}
        />
      )}


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

