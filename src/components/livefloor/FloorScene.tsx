import { memo, useMemo, useState, type CSSProperties } from "react";
import { Cpu, Wrench, CalendarClock, PauseCircle, Play, CircleDot, LayoutGrid, MapPin } from "lucide-react";
import roomImg from "@/assets/livefloor/floor-room.jpg";
import { STATION_ART_SIZE, stationArt } from "./station-art";
import { LiveClock, TYPE_ICON, toneStyle } from "./StationCard";
import { useNow } from "@/hooks/useNow";
import {
  STATUS_META, elapsedMs, normalizeStatus, fmtTime,
  type FloorBooking, type FloorDevice, type FloorSession,
} from "@/lib/live-floor";
import type { DeviceStatus } from "@/lib/devices.functions";

const STATUS_ICON: Record<DeviceStatus, typeof Cpu> = {
  in_use: Play, available: CircleDot, reserved: CalendarClock, suspended: PauseCircle, maintenance: Wrench,
};

type StationProps = {
  device: FloorDevice;
  code: string;
  session?: FloorSession;
  booking?: FloorBooking;
  selected: boolean;
  onSelect: (id: string) => void;
};

/** Ultra-thin phosphor progress line embedded at the bottom of a running station's nameplate. */
function TagProgress({ session }: { session: FloorSession }) {
  const now = useNow();
  const planned = Number(session.planned_minutes ?? 0);
  if (!planned || !now) return null;
  const pct = Math.min(1, Math.max(0.04, elapsedMs(session, now) / (planned * 60000)));
  return (
    <span className="mt-1.5 block h-[2px] w-full overflow-hidden rounded-full bg-white/10" aria-hidden>
      <span
        className="block h-full origin-left rounded-full bg-[var(--tone)] transition-transform duration-500"
        style={{ transform: `scaleX(${pct})` }}
      />
    </span>
  );
}

/** One desk on the immersive floor: crisp HUD nameplate + 3D desk render. */
const FloorStation = memo(function FloorStation({
  device, code, session, booking, selected, onSelect,
}: StationProps) {
  const status = normalizeStatus(device.status);
  const meta = STATUS_META[status];
  const SIcon = STATUS_ICON[status];
  const TIcon = TYPE_ICON[device.type] ?? Cpu;
  const running = status === "in_use" && !!session;
  const who = session?.customers?.full_name ?? booking?.customers?.full_name ?? null;

  const sub =
    running ? who ?? "Walk-in"
    : status === "reserved" ? (booking ? `${who ?? "Guest"} · ${fmtTime(booking.scheduled_at)}` : "Held")
    : status === "maintenance" ? "Out of service"
    : status === "suspended" ? (session ? who ?? "Paused" : "Paused")
    : `₹${device.hourly_rate}/hr`;

  const stationStyle: CSSProperties = {
    ...toneStyle(status),
    ...(device.zone_color ? { ["--zone-tone" as string]: device.zone_color } : {}),
  };

  return (
    <button
      type="button"
      onClick={() => onSelect(device.id)}
      aria-pressed={selected}
      aria-label={`${code} ${device.name}, ${meta.label}${who ? `, ${who}` : ""}`}
      data-selected={selected}
      data-status={status}
      className="lf-station group"
      style={stationStyle}
    >
      {/* Floating HUD nameplate */}
      <span className="lf-tag">
        <span className="flex items-center gap-1.5">
          <span className="lf-tag-ico"><TIcon className="h-2.5 w-2.5" /></span>
          <span className="truncate font-mono text-[11px] font-bold tracking-[0.06em] text-lf-text">{code}</span>
          {running && (
            <LiveClock session={session!} className="ml-auto font-mono text-[10px] font-bold text-[var(--tone)] tabular-nums" />
          )}
        </span>

        <span className="mt-1 flex items-center justify-between gap-1 text-[10px] font-semibold text-[var(--tone)]">
          <span className="inline-flex items-center gap-1 truncate">
            <SIcon className="h-2.5 w-2.5 shrink-0" />
            <span className="truncate">{meta.label}</span>
          </span>
          {device.zone && (
            <span
              className="inline-flex max-w-[54px] items-center gap-1 truncate font-mono text-[8.5px] uppercase tracking-[0.1em]"
              style={{ color: device.zone_color || "var(--lf-dim)" }}
            >
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: device.zone_color || "var(--lf-dim)" }}
              />
              <span className="truncate">{device.zone}</span>
            </span>
          )}
        </span>

        <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[10.5px] text-lf-dim">
          <span className="lf-dot shrink-0" data-live={meta.live} style={{ width: 5, height: 5, boxShadow: "none" }} />
          <span className="truncate tabular-nums">{sub}</span>
        </span>

        {running && Number(session?.planned_minutes ?? 0) > 0 && <TagProgress session={session!} />}
      </span>

      {/* 3D station render */}
      <span className="lf-desk-wrap" data-type={device.type} aria-hidden>
        <span className="lf-desk-pad" />
        <span className="lf-desk-glow" />
        <img
          src={stationArt(device.type)}
          alt=""
          width={STATION_ART_SIZE.width}
          height={STATION_ART_SIZE.height}
          loading="lazy"
          className="lf-desk"
          draggable={false}
        />
      </span>
    </button>
  );
});

export const FloorScene = memo(function FloorScene({
  devices,
  codes,
  sessionsByDevice,
  bookingsByDevice,
  selectedId,
  floorCols,
  floorRows,
  onSelect,
}: {
  devices: FloorDevice[];
  codes: Map<string, string>;
  sessionsByDevice: Map<string, FloorSession>;
  bookingsByDevice: Map<string, FloorBooking>;
  selectedId: string | null;
  floorCols?: number | null;
  floorRows?: number | null;
  onSelect: (id: string) => void;
}) {
  const placed = useMemo(
    () => devices.filter((d) => d.pos_x != null && d.pos_y != null),
    [devices],
  );
  const unplaced = useMemo(
    () => devices.filter((d) => d.pos_x == null || d.pos_y == null),
    [devices],
  );
  const hasSpatial = placed.length > 0;
  const [layoutMode, setLayoutMode] = useState<"spatial" | "auto">("spatial");
  const useSpatial = hasSpatial && layoutMode === "spatial";

  const activeCount = useMemo(
    () => devices.filter((d) => normalizeStatus(d.status) === "in_use").length,
    [devices],
  );
  const occupancyPct = devices.length > 0 ? Math.round((activeCount / devices.length) * 100) : 0;

  const zones = useMemo(() => {
    const z = new Map<string, string>();
    for (const d of devices) {
      if (d.zone) z.set(d.zone, d.zone_color || "var(--lf-violet)");
    }
    return Array.from(z.entries()).slice(0, 5);
  }, [devices]);

  const { cols, rows, cellMap } = useMemo(() => {
    const m = new Map<string, FloorDevice>();
    let maxX = 0;
    let maxY = 0;
    for (const d of placed) {
      const x = d.pos_x!;
      const y = d.pos_y!;
      m.set(`${x},${y}`, d);
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
    const c = Math.max(maxX + 1, Math.min(floorCols ?? 8, Math.max(4, maxX + 1)));
    const r = Math.max(maxY + 1, Math.min(floorRows ?? 6, Math.max(2, maxY + 1)));
    return { cols: c, rows: r, cellMap: m };
  }, [placed, floorCols, floorRows]);

  return (
    <section className="lf-scene relative flex flex-col" aria-label="Floor map">
      <img src={roomImg} alt="" width={1920} height={1152} className="lf-scene-bg" aria-hidden />
      <div className="lf-scene-shade" aria-hidden />

      {/* Integrated Studio Floor HUD */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-black/55 px-4 py-2.5 backdrop-blur-xl">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-2 font-mono text-[11px] font-semibold tabular-nums text-lf-text">
            <span className="text-lf-run">{activeCount}</span>
            <span className="text-lf-dim">/ {devices.length} active</span>
            <span className="text-white/20" aria-hidden>·</span>
            <span className="text-lf-dim">{occupancyPct}% load</span>
          </div>
          <div className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-white/10 sm:block" aria-hidden>
            <div
              className="h-full origin-left rounded-full bg-gradient-to-r from-[var(--lf-run)] via-[var(--lf-cyan)] to-[var(--lf-magenta)] transition-transform duration-300"
              style={{ transform: `scaleX(${Math.max(0.04, occupancyPct / 100)})` }}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {zones.length > 0 && (
            <div className="hidden items-center gap-3 md:flex">
              {zones.map(([label, color]) => (
                <span key={label} className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-white/70">
                  <span className="h-2 w-2 rounded-full" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
                  {label}
                </span>
              ))}
            </div>
          )}

          {hasSpatial && (
            <div className="inline-flex rounded-[11px] border border-white/12 bg-black/55 p-0.5 text-[11px]" role="group" aria-label="Floor arrangement">
              <button
                type="button"
                onClick={() => setLayoutMode("spatial")}
                className={`inline-flex items-center gap-1.5 rounded-[8px] px-2.5 py-1 font-semibold transition-all duration-150 ${
                  layoutMode === "spatial"
                    ? "bg-white/15 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]"
                    : "text-lf-dim hover:text-white"
                }`}
              >
                <MapPin className="h-3 w-3 text-primary" /> Room map
              </button>
              <button
                type="button"
                onClick={() => setLayoutMode("auto")}
                className={`inline-flex items-center gap-1.5 rounded-[8px] px-2.5 py-1 font-semibold transition-all duration-150 ${
                  layoutMode === "auto"
                    ? "bg-white/15 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]"
                    : "text-lf-dim hover:text-white"
                }`}
              >
                <LayoutGrid className="h-3 w-3 text-lf-cyan" /> Auto grid
              </button>
            </div>
          )}
        </div>
      </div>

      {useSpatial ? (
        <div className="relative flex-1 space-y-5 p-4 sm:p-6">
          <div className="overflow-x-auto pb-2 lf-scroll">
            <div
              className="mx-auto grid items-end"
              style={{
                gridTemplateColumns: `repeat(${cols}, minmax(136px, 166px))`,
                gap: "18px 14px",
                width: "fit-content",
                minWidth: "100%",
                justifyContent: "center",
              }}
            >
              {Array.from({ length: cols * rows }).map((_, idx) => {
                const x = idx % cols;
                const y = Math.floor(idx / cols);
                const d = cellMap.get(`${x},${y}`);
                if (!d) {
                  const slotCode = `${y < 26 ? String.fromCharCode(65 + y) : `R${y + 1}`}${String(x + 1).padStart(2, "0")}`;
                  return (
                    <div
                      key={`empty-${x}-${y}`}
                      className="grid min-h-[152px] place-items-end rounded-2xl border border-dashed border-white/[0.045] bg-white/[0.01] p-2.5"
                      aria-hidden
                    >
                      <span className="font-mono text-[9px] tracking-[0.16em] text-white/[0.10]">{slotCode}</span>
                    </div>
                  );
                }
                return (
                  <FloorStation
                    key={d.id}
                    device={d}
                    code={codes.get(d.id) ?? d.name}
                    session={sessionsByDevice.get(d.id)}
                    booking={bookingsByDevice.get(d.id)}
                    selected={selectedId === d.id}
                    onSelect={onSelect}
                  />
                );
              })}
            </div>
          </div>

          {unplaced.length > 0 && (
            <div className="border-t border-white/10 pt-4">
              <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.18em] text-lf-dim">
                Unplaced rigs ({unplaced.length})
              </div>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(136px,1fr))] gap-4">
                {unplaced.map((d) => (
                  <FloorStation
                    key={d.id}
                    device={d}
                    code={codes.get(d.id) ?? d.name}
                    session={sessionsByDevice.get(d.id)}
                    booking={bookingsByDevice.get(d.id)}
                    selected={selectedId === d.id}
                    onSelect={onSelect}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="lf-scene-grid flex-1">
          {devices.map((d) => (
            <FloorStation
              key={d.id}
              device={d}
              code={codes.get(d.id) ?? d.name}
              session={sessionsByDevice.get(d.id)}
              booking={bookingsByDevice.get(d.id)}
              selected={selectedId === d.id}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </section>
  );
});
