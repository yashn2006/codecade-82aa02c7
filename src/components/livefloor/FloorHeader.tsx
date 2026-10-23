import { memo, useEffect, useState } from "react";
import {
  Activity, CalendarDays, Gamepad2, LayoutGrid, List, Map as MapIcon, MonitorPlay, Search, Wrench, Zap, CircleDot,
} from "lucide-react";
import { useNow } from "@/hooks/useNow";
import {
  STATUS_META, TYPE_LABEL, elapsedMs, runningBill,
  type FloorDevice, type FloorSession, type SortKey, type StatusFilter,
} from "@/lib/live-floor";
import type { DeviceStatus } from "@/lib/devices.functions";

type Counts = Record<DeviceStatus, number> & { total: number };
export type FloorView = "floor" | "grid" | "list";

function Stat({ label, value, icon: Icon, tone }: { label: string; value: number; icon: typeof Activity; tone: string }) {
  return (
    <div className="lf-stat flex items-center gap-3 px-3 py-2.5" style={{ ["--tone" as string]: tone }}>
      <span className="lf-stat-ico"><Icon className="h-4 w-4" /></span>
      <div className="min-w-0">
        <div className="truncate text-[11px] text-lf-dim">{label}</div>
        <div className="font-mono text-[22px] font-bold leading-none tabular-nums">{value}</div>
      </div>
    </div>
  );
}

/** Live running bill — the only part of the header that ticks. */
function RunningBill({ devices, sessionsByDevice }: { devices: FloorDevice[]; sessionsByDevice: Map<string, FloorSession> }) {
  const now = useNow();
  let sum = 0;
  if (now) {
    for (const d of devices) {
      const s = sessionsByDevice.get(d.id);
      if (s && s.status === "active") sum += runningBill(d.hourly_rate, elapsedMs(s, now));
    }
  }
  return <>₹{sum.toLocaleString("en-IN")}</>;
}

function ClockCard() {
  const now = useNow();
  const d = now ? new Date(now) : null;
  return (
    <div className="lf-panel flex items-center gap-3 px-3.5 py-2.5">
      <span className="lf-stat-ico" style={{ ["--tone" as string]: "var(--lf-magenta)" }}><CalendarDays className="h-4 w-4" /></span>
      <div>
        <div className="font-mono text-[11px] text-lf-magenta">
          {d ? d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
        </div>
        <div className="font-mono text-[18px] font-bold leading-tight tabular-nums">
          {d ? d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false }) : "--:--"}
        </div>
      </div>
    </div>
  );
}

export const FloorStats = memo(function FloorStats({
  counts, devices, sessionsByDevice, revenueToday, onQuickStart,
}: {
  counts: Counts;
  devices: FloorDevice[];
  sessionsByDevice: Map<string, FloorSession>;
  revenueToday: number;
  onQuickStart: () => void;
}) {
  return (
    <section className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto]">
      <div className="lf-panel grid gap-3 p-3 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-center">
        <div className="flex min-w-0 items-center gap-3 pr-2">
          <span className="lf-title-ico"><MonitorPlay className="h-6 w-6" /></span>
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 font-display text-[22px] font-extrabold leading-tight">
              Live Floor
              <span className="lf-dot" data-live={counts.in_use > 0} style={{ ["--tone" as string]: "var(--lf-run)" }} />
            </h1>
            <p className="truncate text-[12.5px] text-lf-dim">Real-time view of your gaming stations</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Total stations" value={counts.total} icon={Gamepad2} tone="var(--lf-cyan)" />
          <Stat label="Running" value={counts.in_use} icon={Activity} tone={STATUS_META.in_use.tone} />
          <Stat label="Available" value={counts.available} icon={CircleDot} tone="var(--lf-violet)" />
          <Stat label="Maintenance" value={counts.maintenance} icon={Wrench} tone={STATUS_META.maintenance.tone} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-[auto_auto_auto] xl:grid-cols-1 xl:grid-rows-[auto_auto]">
        <ClockCard />
        <div className="lf-panel flex items-center justify-between gap-4 px-3.5 py-2.5">
          <div>
            <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-lf-dim">Running bill</div>
            <div className="font-mono text-[15px] font-bold text-lf-run"><RunningBill devices={devices} sessionsByDevice={sessionsByDevice} /></div>
          </div>
          <div className="text-right">
            <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-lf-dim">Closed today</div>
            <div className="font-mono text-[15px] font-bold">₹{revenueToday.toLocaleString("en-IN")}</div>
          </div>
        </div>
        <button
          type="button"
          onClick={onQuickStart}
          disabled={counts.available === 0}
          className="lf-btn lf-btn-primary col-span-2 h-10 px-4 text-[13px] sm:col-span-1 xl:hidden"
          title={counts.available === 0 ? "No free stations" : "Start a session on a free station"}
        >
          <Zap className="h-4 w-4" /> Start session
        </button>
      </div>
    </section>
  );
});

const CHIPS: StatusFilter[] = ["all", "in_use", "available", "reserved", "suspended", "maintenance"];

export const StationToolbar = memo(function StationToolbar({
  counts, filter, onFilter, onQuery, sort, onSort, view, onView, type, onType, types, searchRef,
}: {
  counts: Counts;
  filter: StatusFilter;
  onFilter: (f: StatusFilter) => void;
  onQuery: (q: string) => void;
  sort: SortKey;
  onSort: (s: SortKey) => void;
  view: FloorView;
  onView: (v: FloorView) => void;
  type: string;
  onType: (t: string) => void;
  types: string[];
  searchRef: React.RefObject<HTMLInputElement | null>;
}) {
  const [raw, setRaw] = useState("");
  useEffect(() => {
    const t = setTimeout(() => onQuery(raw), 160);
    return () => clearTimeout(t);
  }, [raw, onQuery]);

  return (
    <section className="lf-panel flex flex-col gap-2.5 p-2.5 lg:flex-row lg:items-center">
      <div className="-mx-1 flex min-w-0 flex-1 gap-1.5 overflow-x-auto px-1 pb-0.5 lf-scroll" role="tablist" aria-label="Filter by status">
        {CHIPS.map((c) => {
          const n = c === "all" ? counts.total : counts[c];
          const tone = c === "all" ? "var(--lf-magenta)" : STATUS_META[c].tone;
          return (
            <button
              key={c}
              role="tab"
              aria-selected={filter === c}
              data-on={filter === c}
              onClick={() => onFilter(c)}
              className="lf-chip lf-chip-pill"
              style={{ ["--tone" as string]: tone }}
            >
              {c !== "all" && <span className="lf-dot" style={{ width: 6, height: 6, boxShadow: "none" }} />}
              {c === "all" ? "All" : c === "available" ? "Free" : STATUS_META[c].label}
              <span className="lf-chip-count">{n}</span>
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[160px] flex-1 lg:w-[200px] lg:flex-none">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-lf-dim" />
          <input
            ref={searchRef}
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder="Search station or player"
            aria-label="Search stations"
            className="lf-input h-9 pl-8 pr-8"
          />
          <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-lf-line px-1 font-mono text-[9px] text-lf-dim">/</kbd>
        </div>
        {types.length > 1 && (
          <select value={type} onChange={(e) => onType(e.target.value)} className="lf-input h-9 w-auto" aria-label="Device type">
            <option value="all">All types</option>
            {types.map((t) => <option key={t} value={t}>{TYPE_LABEL[t] ?? t}</option>)}
          </select>
        )}
        <select value={sort} onChange={(e) => onSort(e.target.value as SortKey)} className="lf-input h-9 w-auto" aria-label="Sort stations">
          <option value="name">Sort: Name</option>
          <option value="status">Sort: Status</option>
          <option value="price">Sort: Price</option>
        </select>
        <div className="lf-seg" role="group" aria-label="View">
          <button type="button" data-on={view === "floor"} onClick={() => onView("floor")} aria-label="Floor view" aria-pressed={view === "floor"} title="Floor view">
            <MapIcon className="h-3.5 w-3.5" />
          </button>
          <button type="button" data-on={view === "grid"} onClick={() => onView("grid")} aria-label="Grid view" aria-pressed={view === "grid"} title="Grid view">
            <LayoutGrid className="h-3.5 w-3.5" />
          </button>
          <button type="button" data-on={view === "list"} onClick={() => onView("list")} aria-label="List view" aria-pressed={view === "list"} title="List view">
            <List className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </section>
  );
});
