import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import {
  Activity, Play, Square, Filter, Download, Flame, Sparkles, Clock, TrendingUp, Star,
} from "lucide-react";
import { getCafeBySlug } from "@/lib/cafes.functions";
import { listDevices } from "@/lib/devices.functions";
import { listSessions } from "@/lib/sessions.functions";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/EmptyState";

export const Route = createFileRoute("/_authenticated/cafe/$slug/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — CoreCade" },
      { name: "description", content: "Activity feed, attendance heatmap and session quality." },
      { property: "og:title", content: "Analytics — CoreCade" },
      { property: "og:description", content: "Activity feed, attendance heatmap and session quality." },
    ],
  }),
  component: AnalyticsPage,
});

const IST = "Asia/Kolkata";
const RANGES = [
  { id: "24h", label: "Last 24h", hours: 24 },
  { id: "7d", label: "Last 7 days", hours: 24 * 7 },
  { id: "30d", label: "Last 30 days", hours: 24 * 30 },
] as const;
type RangeId = (typeof RANGES)[number]["id"];

type SessionRow = {
  id: string;
  device_id: string;
  customer_id: string | null;
  started_at: string;
  ended_at: string | null;
  duration_minutes: number | null;
  amount: number | null;
  status: string;
  customers: { full_name?: string } | null;
  devices: { name?: string; hourly_rate?: number; type?: string } | null;
};

function AnalyticsPage() {
  const { slug } = getRouteApi("/_authenticated/cafe/$slug/analytics").useParams();
  const getCafe = useServerFn(getCafeBySlug);
  const lDev = useServerFn(listDevices);
  const lSes = useServerFn(listSessions);

  const { data: cafe } = useQuery({ queryKey: ["cafe", slug], queryFn: () => getCafe({ data: { slug } }) });
  const cafeId = cafe?.id;
  const { data: devices = [] } = useQuery({
    queryKey: ["devices", cafeId], queryFn: () => lDev({ data: { cafe_id: cafeId! } }), enabled: !!cafeId,
  });
  const { data: sessions = [] } = useQuery({
    queryKey: ["sessions", cafeId], queryFn: () => lSes({ data: { cafe_id: cafeId! } }),
    enabled: !!cafeId, refetchInterval: 5000,
  });

  const [range, setRange] = useState<RangeId>("7d");
  const [deviceFilter, setDeviceFilter] = useState<string>("all");

  const cutoffMs = Date.now() - (RANGES.find((r) => r.id === range)!.hours * 3_600_000);

  const filtered = useMemo(() => {
    return (sessions as SessionRow[]).filter((s) => {
      const ts = new Date(s.ended_at ?? s.started_at).getTime();
      if (ts < cutoffMs) return false;
      if (deviceFilter !== "all" && s.device_id !== deviceFilter) return false;
      return true;
    });
  }, [sessions, cutoffMs, deviceFilter]);

  return (
    <div className="space-y-6">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card/40 p-3 backdrop-blur">
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <Select value={range} onValueChange={(v) => setRange(v as RangeId)}>
            <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {RANGES.map((r) => <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={deviceFilter} onValueChange={setDeviceFilter}>
            <SelectTrigger className="h-8 w-[170px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All devices</SelectItem>
              {devices.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            {filtered.length} events · timezone IST (UTC+5:30)
          </span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <AttendanceHeatmap sessions={filtered} />
        <ActivityFeed sessions={filtered} />
      </div>

      <QualityAnalytics sessions={filtered} cafeName={cafe?.name ?? "cafe"} />
    </div>
  );
}

// ============================================================
// 1) ACTIVITY FEED — check-ins, session start/end, ticket events
// ============================================================
function ActivityFeed({ sessions }: { sessions: SessionRow[] }) {
  // Build event stream
  const events = useMemo(() => {
    const out: { id: string; kind: "start" | "end"; at: number; label: string; meta: string }[] = [];
    for (const s of sessions) {
      const who = s.customers?.full_name ?? "Walk-in";
      const dev = s.devices?.name ?? "device";
      out.push({
        id: `${s.id}-s`, kind: "start", at: new Date(s.started_at).getTime(),
        label: `${who} checked in on ${dev}`, meta: "session start",
      });
      if (s.ended_at) {
        out.push({
          id: `${s.id}-e`, kind: "end", at: new Date(s.ended_at).getTime(),
          label: `${who} ended on ${dev}`,
          meta: `${s.duration_minutes ?? 0}m · ₹${s.amount ?? 0}`,
        });
      }
    }
    return out.sort((a, b) => b.at - a.at).slice(0, 80);
  }, [sessions]);

  const fmt = (t: number) => new Date(t).toLocaleString("en-IN", {
    timeZone: IST, hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short",
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-3xl border border-border/60 bg-card/40 p-5 backdrop-blur-xl"
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            <Activity className="h-3 w-3 text-violet-300" /> Live activity feed
          </div>
          <div className="mt-1 font-display text-2xl font-extrabold tracking-tight">Floor pulse</div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-400/5 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.2em] text-emerald-300">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
          </span>
          streaming
        </span>
      </div>

      <div className="mt-4 max-h-[460px] space-y-0 overflow-y-auto pr-2">
        {events.length === 0 ? (
          <EmptyState icon={Activity} title="No activity yet" description="Check-ins will appear here in real time." />
        ) : events.map((e, i) => (
          <motion.div
            key={e.id}
            initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
            transition={{ delay: Math.min(i * 0.015, 0.4) }}
            className="group relative flex items-start gap-3 border-l-2 py-2.5 pl-4 transition hover:bg-white/[0.02]"
            style={{ borderColor: e.kind === "start" ? "oklch(0.7 0.22 285)" : "oklch(0.7 0.26 335)" }}
          >
            <div
              className="absolute -left-[7px] top-3 h-3 w-3 rounded-full ring-2 ring-background"
              style={{ background: e.kind === "start" ? "oklch(0.7 0.22 285)" : "oklch(0.7 0.26 335)" }}
            />
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/10 bg-background/40">
              {e.kind === "start"
                ? <Play className="h-3.5 w-3.5 text-violet-300" />
                : <Square className="h-3.5 w-3.5 text-magenta" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm text-foreground/90">{e.label}</div>
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                {e.meta} · {fmt(e.at)}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

// ============================================================
// 2) ATTENDANCE HEATMAP — day × hour grid, IST
// ============================================================
function AttendanceHeatmap({ sessions }: { sessions: SessionRow[] }) {
  const matrix = useMemo(() => {
    // 7 days (Mon..Sun) × 24 hours
    const grid: number[][] = Array.from({ length: 7 }, () => new Array(24).fill(0));
    for (const s of sessions) {
      const d = new Date(s.started_at);
      // IST hour
      const istParts = new Intl.DateTimeFormat("en-GB", {
        timeZone: IST, weekday: "short", hour: "2-digit", hour12: false,
      }).formatToParts(d);
      const wk = istParts.find((p) => p.type === "weekday")?.value ?? "Mon";
      const hr = parseInt(istParts.find((p) => p.type === "hour")?.value ?? "0", 10) % 24;
      const dayIdx = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(wk);
      if (dayIdx >= 0) grid[dayIdx][hr] += 1;
    }
    return grid;
  }, [sessions]);

  const max = Math.max(1, ...matrix.flat());
  const totalSessions = matrix.flat().reduce((a, b) => a + b, 0);
  const [hover, setHover] = useState<{ d: number; h: number; v: number } | null>(null);

  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-3xl border border-border/60 bg-card/40 p-5 backdrop-blur-xl"
    >
      <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-magenta/20 blur-3xl" />
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            <Flame className="h-3 w-3 text-amber-400" /> Attendance heatmap · day × hour
          </div>
          <div className="mt-1 font-display text-2xl font-extrabold tracking-tight">When the floor lights up</div>
          <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            {totalSessions} sessions · IST (UTC+5:30)
          </div>
        </div>
        <div className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
          cold
          <div className="ml-1 flex gap-0.5">
            {[0.05, 0.2, 0.4, 0.65, 0.9].map((v) => (
              <div key={v} className="h-3 w-3 rounded-sm" style={{ background: cellColor(v) }} />
            ))}
          </div>
          hot
        </div>
      </div>

      <div className="relative mt-5 overflow-x-auto">
        <div className="min-w-[640px]">
          {/* Hours header */}
          <div className="grid grid-cols-[40px_repeat(24,minmax(0,1fr))] gap-1">
            <div />
            {Array.from({ length: 24 }).map((_, h) => (
              <div key={h} className={`text-center font-mono text-[8px] uppercase tracking-[0.15em] text-muted-foreground/60 ${h % 3 === 0 ? "" : "opacity-0"}`}>
                {String(h).padStart(2, "0")}
              </div>
            ))}
          </div>

          {/* Rows */}
          {matrix.map((row, di) => (
            <div key={di} className="mt-1 grid grid-cols-[40px_repeat(24,minmax(0,1fr))] gap-1">
              <div className="self-center font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                {days[di]}
              </div>
              {row.map((v, h) => {
                const intensity = v / max;
                return (
                  <motion.div
                    key={h}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: (di * 24 + h) * 0.003, duration: 0.3 }}
                    whileHover={{ scale: 1.4, zIndex: 2 }}
                    onMouseEnter={() => setHover({ d: di, h, v })}
                    onMouseLeave={() => setHover(null)}
                    className="aspect-square cursor-pointer rounded-[3px] ring-1 ring-white/5"
                    style={{
                      background: cellColor(intensity),
                      boxShadow: intensity > 0.5 ? `0 0 8px -1px oklch(0.7 0.26 335 / ${intensity})` : undefined,
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>

        {hover && (
          <div className="pointer-events-none mt-3 inline-flex items-center gap-2 rounded-md border border-border/60 bg-background/80 px-3 py-1.5 font-mono text-[11px] backdrop-blur">
            <Clock className="h-3 w-3 text-amber-300" />
            <span className="text-foreground">{days[hover.d]} · {String(hover.h).padStart(2, "0")}:00 IST</span>
            <span className="text-muted-foreground">→</span>
            <span className="text-magenta">{hover.v} sessions</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function cellColor(intensity: number) {
  if (intensity <= 0) return "oklch(1 0 0 / 0.04)";
  // Cool→hot gradient via hue shift
  const hue = 285 - intensity * 50; // 285 (violet) → 235 (deep magenta)
  const chroma = 0.12 + intensity * 0.14;
  const light = 0.45 + intensity * 0.25;
  return `oklch(${light} ${chroma} ${hue})`;
}

// ============================================================
// 3) SESSION QUALITY — score + chart + CSV export
// ============================================================
function QualityAnalytics({ sessions, cafeName }: { sessions: SessionRow[]; cafeName: string }) {
  const completed = useMemo(
    () => sessions.filter((s) => s.ended_at && s.duration_minutes && s.duration_minutes > 0),
    [sessions],
  );

  // Peak hours derived from this dataset (top-third busiest hours, IST)
  const { peakSet, scored, avg, peakLabel } = useMemo(() => {
    const hours = new Array(24).fill(0);
    for (const s of completed) {
      const h = parseInt(new Intl.DateTimeFormat("en-GB", { timeZone: IST, hour: "2-digit", hour12: false }).format(new Date(s.started_at)), 10) % 24;
      hours[h] += 1;
    }
    const sorted = [...hours.map((c, h) => ({ h, c }))].sort((a, b) => b.c - a.c);
    const peakSet = new Set(sorted.slice(0, 8).filter((x) => x.c > 0).map((x) => x.h));

    const scored = completed.map((s) => {
      const dur = s.duration_minutes ?? 0;
      const h = parseInt(new Intl.DateTimeFormat("en-GB", { timeZone: IST, hour: "2-digit", hour12: false }).format(new Date(s.started_at)), 10) % 24;
      const isPeak = peakSet.has(h);
      // Duration score: optimal ~ 60-120 min
      const durScore = dur < 15 ? 30
        : dur < 30 ? 55
        : dur < 60 ? 75
        : dur <= 120 ? 92
        : dur <= 180 ? 85
        : 72;
      // Peak weighting (sessions during peak count more — full-floor utilization)
      const peakBonus = isPeak ? 8 : 0;
      // Revenue per minute signal (₹/min)
      const rpm = (s.amount ?? 0) / Math.max(1, dur);
      const rpmScore = Math.min(100, rpm * 12); // ~₹8/min = 96
      const score = Math.round(Math.min(100, durScore * 0.55 + rpmScore * 0.35 + peakBonus));
      return {
        id: s.id,
        device: s.devices?.name ?? "—",
        customer: s.customers?.full_name ?? "Walk-in",
        started: s.started_at,
        ended: s.ended_at ?? "",
        duration: dur,
        amount: s.amount ?? 0,
        peak: isPeak ? "peak" : "off-peak",
        rpm: Math.round(rpm * 100) / 100,
        score,
      };
    });
    const avg = scored.length ? Math.round(scored.reduce((a, b) => a + b.score, 0) / scored.length) : 0;
    const peakLabel = [...peakSet].sort((a, b) => a - b).map((h) => String(h).padStart(2, "0")).join(", ") || "—";
    return { peakSet, scored, avg, peakLabel };
  }, [completed]);

  // Buckets for histogram
  const buckets = useMemo(() => {
    const b = [0, 0, 0, 0, 0]; // 0-40, 40-60, 60-75, 75-90, 90-100
    for (const r of scored) {
      const s = r.score;
      if (s < 40) b[0]++;
      else if (s < 60) b[1]++;
      else if (s < 75) b[2]++;
      else if (s < 90) b[3]++;
      else b[4]++;
    }
    return b;
  }, [scored]);
  const maxB = Math.max(1, ...buckets);
  const bucketLabels = ["<40", "40-60", "60-75", "75-90", "90+"];
  const bucketColors = ["#94a3b8", "#a78bfa", "#7dd3fc", "#f5b042", "#ef4fb6"];

  function downloadCSV() {
    const head = ["session_id", "device", "customer", "started_ist", "ended_ist", "duration_min", "amount_rs", "rs_per_min", "peak_offpeak", "quality_score"];
    const lines = [head.join(",")];
    const fmt = (iso: string) => iso ? new Date(iso).toLocaleString("en-GB", { timeZone: IST }) : "";
    for (const r of scored) {
      lines.push([
        r.id, esc(r.device), esc(r.customer), esc(fmt(r.started)), esc(fmt(r.ended)),
        r.duration, r.amount, r.rpm, r.peak, r.score,
      ].join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${cafeName.toLowerCase().replace(/\s+/g, "-")}-session-quality-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-3xl border border-border/60 bg-card/40 p-6 backdrop-blur-xl"
    >
      <div className="pointer-events-none absolute -left-20 -bottom-24 h-72 w-72 rounded-full bg-violet/20 blur-3xl" />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            <Star className="h-3 w-3 text-amber-300" /> Session quality · scored
          </div>
          <div className="mt-1 font-display text-2xl font-extrabold tracking-tight">How healthy are your sessions?</div>
          <div className="mt-1 max-w-xl text-xs text-muted-foreground">
            Score blends real duration, revenue per minute, and peak-hour weighting (IST). 0 = walk-out, 100 = perfect session.
          </div>
        </div>
        <Button onClick={downloadCSV} variant="outline" size="sm" className="gap-1.5" disabled={scored.length === 0}>
          <Download className="h-3.5 w-3.5" /> Export CSV
        </Button>
      </div>

      <div className="mt-6 grid gap-5 md:grid-cols-[260px_1fr]">
        {/* Big score ring */}
        <div className="relative grid place-items-center">
          <svg viewBox="0 0 120 120" className="h-48 w-48 -rotate-90">
            <defs>
              <linearGradient id="q-grad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="oklch(0.78 0.22 285)" />
                <stop offset="100%" stopColor="oklch(0.7 0.26 335)" />
              </linearGradient>
            </defs>
            <circle cx="60" cy="60" r="50" fill="none" stroke="oklch(1 0 0 / 0.08)" strokeWidth="10" />
            <motion.circle
              cx="60" cy="60" r="50" fill="none" stroke="url(#q-grad)"
              strokeWidth="10" strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 50}
              initial={{ strokeDashoffset: 2 * Math.PI * 50 }}
              animate={{ strokeDashoffset: 2 * Math.PI * 50 * (1 - avg / 100) }}
              transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
              style={{ filter: "drop-shadow(0 0 8px oklch(0.7 0.26 335 / 0.6))" }}
            />
          </svg>
          <div className="absolute inset-0 grid place-items-center">
            <div className="text-center">
              <div className="font-display text-5xl font-extrabold tabular-nums text-gradient-hot">{avg}</div>
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">quality / 100</div>
            </div>
          </div>
        </div>

        {/* Histogram + insights */}
        <div className="flex flex-col">
          <div className="grid grid-cols-5 gap-2 rounded-2xl border border-white/5 bg-background/30 p-4">
            {buckets.map((v, i) => (
              <div key={i} className="flex flex-col items-center justify-end gap-2">
                <div className="flex h-32 w-full items-end">
                  <motion.div
                    initial={{ height: 0 }} animate={{ height: `${(v / maxB) * 100}%` }}
                    transition={{ delay: 0.1 + i * 0.08, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                    className="w-full rounded-md"
                    style={{
                      background: `linear-gradient(180deg, ${bucketColors[i]}, ${bucketColors[i]}55)`,
                      boxShadow: `0 0 18px -4px ${bucketColors[i]}`,
                    }}
                    title={`${v} sessions in ${bucketLabels[i]} range`}
                  />
                </div>
                <div className="text-center">
                  <div className="font-display text-base font-bold tabular-nums">{v}</div>
                  <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">{bucketLabels[i]}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Insight icon={TrendingUp} label="Sessions scored" value={String(scored.length)} tone="violet" />
            <Insight icon={Flame} label="Peak hours IST" value={peakLabel} tone="amber" small />
            <Insight icon={Sparkles} label="≥90 score" value={`${buckets[4]}`} tone="magenta" />
          </div>
        </div>
      </div>

      {scored.length === 0 && (
        <div className="mt-6">
          <EmptyState icon={Star} title="No completed sessions yet" description="End a session to start scoring." />
        </div>
      )}
    </motion.div>
  );
}

function Insight({ icon: Icon, label, value, tone, small }: {
  icon: typeof Star; label: string; value: string; tone: "violet" | "amber" | "magenta"; small?: boolean;
}) {
  const color = tone === "violet" ? "oklch(0.78 0.22 285)" : tone === "amber" ? "oklch(0.82 0.16 75)" : "oklch(0.7 0.26 335)";
  return (
    <div className="rounded-xl border border-white/5 bg-background/30 p-3">
      <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        <Icon className="h-3 w-3" style={{ color }} /> {label}
      </div>
      <div className={`mt-1 font-display font-extrabold tabular-nums ${small ? "text-sm" : "text-2xl"}`} style={{ color }}>
        {value}
      </div>
    </div>
  );
}

function esc(s: string | number) {
  const str = String(s ?? "");
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}
