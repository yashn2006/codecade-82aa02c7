import { memo, useEffect, useState } from "react";
import {
  Activity, ArrowDownAZ, ArrowUpDown, CalendarDays, Check, ChevronDown, CircleDot,
  Gamepad2, IndianRupee, LayoutGrid, List, Map as MapIcon, MonitorPlay, Search,
  SlidersHorizontal, Wrench, X, Zap,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
    <div className="lf-stat flex items-center gap-3 px-3.5 py-2.5" style={{ ["--tone" as string]: tone }}>
      <span className="lf-stat-ico"><Icon className="h-4 w-4" /></span>
      <div className="min-w-0">
        <div className="truncate text-[11px] font-medium text-lf-dim">{label}</div>
        <div className="mt-0.5 font-mono text-[22px] font-bold leading-none tabular-nums text-white">{value}</div>
      </div>
    </div>
  );
}

/** Live running bill — isolated tick leaf. */
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
    <div className="lf-panel flex items-center justify-between gap-3 px-3.5 py-2.5">
      <div className="flex items-center gap-2.5">
        <span className="lf-stat-ico" style={{ ["--tone" as string]: "var(--lf-magenta)" }}>
          <CalendarDays className="h-4 w-4" />
        </span>
        <div>
          <div className="font-mono text-[10.5px] font-medium text-lf-magenta">
            {d ? d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
          </div>
          <div className="font-mono text-[19px] font-bold leading-tight tabular-nums text-white">
            {d ? d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false }) : "--:--"}
          </div>
        </div>
      </div>
      <span className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-lf-dim">IST</span>
    </div>
  );
}

export const FloorStats = memo(function FloorStats({
  counts, devices, sessionsByDevice, revenueToday, canViewRevenue = true, canQuickStart = true, onQuickStart,
}: {
  counts: Counts;
  devices: FloorDevice[];
  sessionsByDevice: Map<string, FloorSession>;
  revenueToday: number;
  canViewRevenue?: boolean;
  canQuickStart?: boolean;
  onQuickStart: () => void;
}) {
  const loadPct = counts.total > 0 ? Math.round((counts.in_use / counts.total) * 100) : 0;

  return (
    <section className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_272px]">
      <div className="lf-panel relative flex flex-col justify-between gap-3.5 overflow-hidden p-3.5 sm:p-4">
        {/* Subtle studio radial highlight */}
        <div
          className="pointer-events-none absolute -left-20 -top-24 h-52 w-72 rounded-full opacity-30 blur-3xl"
          style={{ background: "radial-gradient(circle, var(--lf-magenta), transparent 70%)" }}
          aria-hidden
        />

        <div className="relative flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="lf-title-ico"><MonitorPlay className="h-6 w-6" /></span>
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                <h1 className="font-display text-[22px] font-extrabold tracking-tight text-white">
                  Live Floor
                </h1>
                {counts.in_use > 0 && (
                  <span className="inline-flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-lf-run">
                    <span className="lf-dot" data-live="true" style={{ ["--tone" as string]: "var(--lf-run)", width: 6, height: 6 }} />
                    {counts.in_use} Live
                  </span>
                )}
              </div>
              <p className="truncate text-[12.5px] text-lf-dim">
                Real-time rig telemetry, active players &amp; quick station controls
              </p>
            </div>
          </div>

          {/* Live floor capacity meter */}
          <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/35 px-3 py-2">
            <div>
              <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-lf-dim">Floor Load</div>
              <div className="font-mono text-[13px] font-bold tabular-nums text-white">
                {loadPct}% <span className="text-[10.5px] font-normal text-lf-dim">({counts.in_use}/{counts.total})</span>
              </div>
            </div>
            <div className="h-2 w-20 overflow-hidden rounded-full bg-white/10" aria-hidden>
              <div
                className="h-full origin-left rounded-full bg-gradient-to-r from-[var(--lf-run)] via-[var(--lf-cyan)] to-[var(--lf-magenta)] transition-transform duration-300"
                style={{ transform: `scaleX(${Math.max(0.04, loadPct / 100)})` }}
              />
            </div>
          </div>
        </div>

        <div className="relative grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <Stat label="Total rigs" value={counts.total} icon={Gamepad2} tone="var(--lf-cyan)" />
          <Stat label="Running" value={counts.in_use} icon={Activity} tone={STATUS_META.in_use.tone} />
          <Stat label="Available" value={counts.available} icon={CircleDot} tone="var(--lf-violet)" />
          <Stat label="Maintenance" value={counts.maintenance} icon={Wrench} tone={STATUS_META.maintenance.tone} />
        </div>
      </div>

      <div className="grid gap-2.5 sm:grid-cols-[1fr_1fr_auto] xl:grid-cols-1">
        <ClockCard />
        {canViewRevenue && (
          <div className="lf-panel flex items-center justify-between gap-4 border border-white/10 px-3.5 py-2.5">
            <div>
              <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-lf-dim">Live Bill</div>
              <div className="font-mono text-[17px] font-extrabold tabular-nums text-lf-run drop-shadow-[0_0_10px_rgba(0,229,160,0.45)]">
                <RunningBill devices={devices} sessionsByDevice={sessionsByDevice} />
              </div>
            </div>
            <div className="h-7 w-px bg-white/10" aria-hidden />
            <div className="text-right">
              <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-lf-dim">Closed Today</div>
              <div className="font-mono text-[17px] font-extrabold tabular-nums text-white">
                ₹{revenueToday.toLocaleString("en-IN")}
              </div>
            </div>
          </div>
        )}
        {canQuickStart && (
          <button
            type="button"
            onClick={onQuickStart}
            disabled={counts.available === 0}
            className="group relative flex h-11 w-full items-center justify-center gap-2 overflow-hidden rounded-xl px-4 text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-pink-500/20 transition-transform duration-150 hover:scale-[1.01] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40"
            style={{ background: "var(--gradient-brand-hot)" }}
            title={counts.available === 0 ? "No free stations" : "Select an available rig to start"}
          >
            <Zap className="h-4 w-4 transition-transform duration-150 group-hover:scale-110" />
            <span>Quick Start ({counts.available} Free)</span>
          </button>
        )}
      </div>
    </section>
  );
});

const CHIPS: StatusFilter[] = ["all", "in_use", "available", "reserved", "suspended", "maintenance"];

const SORT_OPTIONS: {
  key: SortKey;
  label: string;
  hint: string;
  icon: typeof ArrowDownAZ;
}[] = [
  { key: "name",   label: "Name",   hint: "A–Z station code",   icon: ArrowDownAZ },
  { key: "status", label: "Status", hint: "Live & booked first", icon: Activity },
  { key: "price",  label: "Price",  hint: "Highest ₹/hr first",  icon: IndianRupee },
];

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
    const t = setTimeout(() => onQuery(raw), 140);
    return () => clearTimeout(t);
  }, [raw, onQuery]);

  const activeSort = SORT_OPTIONS.find((s) => s.key === sort) ?? SORT_OPTIONS[0];

  return (
    <section className="lf-panel flex flex-col gap-2.5 p-2.5 xl:flex-row xl:items-center xl:justify-between">
      {/* Status filter pills */}
      <div className="-mx-1 flex min-w-0 flex-1 gap-1.5 overflow-x-auto px-1 py-0.5 lf-scroll" role="tablist" aria-label="Filter by status">
        {CHIPS.map((c) => {
          const n = c === "all" ? counts.total : counts[c];
          const tone = c === "all" ? "var(--lf-magenta)" : STATUS_META[c].tone;
          return (
            <button
              key={c}
              type="button"
              role="tab"
              aria-selected={filter === c}
              data-on={filter === c}
              onClick={() => onFilter(c)}
              className="lf-chip lf-chip-pill shrink-0"
              style={{ ["--tone" as string]: tone }}
            >
              {c !== "all" && <span className="lf-dot" style={{ width: 6, height: 6, boxShadow: "none" }} />}
              <span>{c === "all" ? "All" : c === "available" ? "Free" : STATUS_META[c].label}</span>
              <span className="lf-chip-count">{n}</span>
            </button>
          );
        })}
      </div>

      {/* Right controls: Spotlight Search + Frosted iOS Dropdowns + Segmented View */}
      <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
        {/* iOS Spotlight Search Field */}
        <div className="relative min-w-[190px] flex-1 sm:w-[235px] sm:flex-none">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-lf-dim" />
          <input
            ref={searchRef}
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder="Search station or player"
            aria-label="Search stations"
            className="lf-input h-9 pl-9 pr-8 text-[13px]"
          />
          {raw ? (
            <button
              type="button"
              onClick={() => {
                setRaw("");
                onQuery("");
                searchRef.current?.focus();
              }}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 grid h-5 w-5 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-lf-dim transition-colors hover:bg-white/20 hover:text-white"
            >
              <X className="h-3 w-3" />
            </button>
          ) : (
            <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md border border-white/15 bg-white/[0.05] px-1.5 py-0.5 font-mono text-[9.5px] leading-none text-lf-dim">
              /
            </kbd>
          )}
        </div>

        {/* Frosted Type Filter Dropdown (shown when multiple rig types exist) */}
        {types.length > 1 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Filter by station type"
                className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[11px] border border-white/12 bg-black/45 px-3 text-xs font-semibold text-white/90 shadow-inner transition-colors hover:border-white/25 hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
              >
                <SlidersHorizontal className="h-3.5 w-3.5 text-lf-cyan" />
                <span className="whitespace-nowrap">
                  {type === "all" ? "All rigs" : TYPE_LABEL[type] ?? type}
                </span>
                <ChevronDown className="h-3.5 w-3.5 text-lf-dim" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="lf-ios-menu w-52 p-1.5">
              <DropdownMenuLabel className="px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-lf-dim">
                Hardware Type
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="my-1 bg-white/10" />
              <DropdownMenuItem
                onClick={() => onType("all")}
                className={`rounded-xl px-2.5 py-2 text-xs font-medium ${
                  type === "all" ? "bg-white/12 text-white" : "text-white/80 focus:bg-white/10 focus:text-white"
                }`}
              >
                <Gamepad2 className="h-3.5 w-3.5 text-lf-cyan" />
                <span className="flex-1">All station types</span>
                {type === "all" && <Check className="h-3.5 w-3.5 text-primary" />}
              </DropdownMenuItem>
              {types.map((t) => (
                <DropdownMenuItem
                  key={t}
                  onClick={() => onType(t)}
                  className={`rounded-xl px-2.5 py-2 text-xs font-medium ${
                    type === t ? "bg-white/12 text-white" : "text-white/80 focus:bg-white/10 focus:text-white"
                  }`}
                >
                  <MonitorPlay className="h-3.5 w-3.5 text-lf-violet" />
                  <span className="flex-1">{TYPE_LABEL[t] ?? t}</span>
                  {type === t && <Check className="h-3.5 w-3.5 text-primary" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* iOS-Style Frosted Sort Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Sort stations"
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[11px] border border-white/12 bg-black/45 px-3 text-xs font-semibold text-white/90 shadow-inner transition-colors hover:border-white/25 hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
            >
              <ArrowUpDown className="h-3.5 w-3.5 text-primary" />
              <span className="text-lf-dim font-medium">Sort</span>
              <span className="whitespace-nowrap text-white">{activeSort.label}</span>
              <ChevronDown className="h-3.5 w-3.5 text-lf-dim" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="lf-ios-menu w-56 p-1.5">
            <DropdownMenuLabel className="px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-lf-dim">
              Sort Stations By
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="my-1 bg-white/10" />
            {SORT_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const active = sort === opt.key;
              return (
                <DropdownMenuItem
                  key={opt.key}
                  onClick={() => onSort(opt.key)}
                  className={`rounded-xl px-2.5 py-2 transition-colors ${
                    active
                      ? "bg-primary/18 text-white"
                      : "text-white/80 focus:bg-white/10 focus:text-white"
                  }`}
                >
                  <span
                    className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg border ${
                      active
                        ? "border-primary/40 bg-primary/20 text-primary"
                        : "border-white/10 bg-white/[0.04] text-lf-dim"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold leading-tight">{opt.label}</span>
                    <span className="block text-[10.5px] text-lf-dim">{opt.hint}</span>
                  </span>
                  {active && <Check className="h-4 w-4 shrink-0 text-primary" />}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Segmented View Control */}
        <div className="lf-seg shrink-0" role="group" aria-label="View mode">
          <button
            type="button"
            data-on={view === "floor"}
            onClick={() => onView("floor")}
            aria-label="Floor map view"
            aria-pressed={view === "floor"}
            title="Floor map"
          >
            <MapIcon className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            data-on={view === "grid"}
            onClick={() => onView("grid")}
            aria-label="Grid cards view"
            aria-pressed={view === "grid"}
            title="Rig cards"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            data-on={view === "list"}
            onClick={() => onView("list")}
            aria-label="List rows view"
            aria-pressed={view === "list"}
            title="List view"
          >
            <List className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </section>
  );
});
