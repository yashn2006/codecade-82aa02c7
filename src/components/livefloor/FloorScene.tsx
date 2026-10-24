import { memo } from "react";
import { Cpu, Wrench, CalendarClock, PauseCircle, Play, CircleDot } from "lucide-react";
import roomImg from "@/assets/livefloor/floor-room.jpg";
import { STATION_ART_SIZE, stationArt } from "./station-art";
import { LiveClock, TYPE_ICON, toneStyle } from "./StationCard";
import {
  STATUS_META, normalizeStatus, fmtTime,
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
  index: number;
  onSelect: (id: string) => void;
};

/** One desk on the immersive floor: floating neon tag + 3D desk render. */
const FloorStation = memo(function FloorStation({
  device, code, session, booking, selected, index, onSelect,
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

  return (
    <button
      type="button"
      onClick={() => onSelect(device.id)}
      aria-pressed={selected}
      aria-label={`${code} ${device.name}, ${meta.label}${who ? `, ${who}` : ""}`}
      data-selected={selected}
      data-status={status}
      className="lf-station group"
      style={{ ...toneStyle(status), animationDelay: `${Math.min(index, 20) * 30}ms` }}
    >
      {/* floating tag */}
      <span className="lf-tag">
        <span className="flex items-center gap-1.5">
          <span className="lf-tag-ico"><TIcon className="h-2.5 w-2.5" /></span>
          <span className="truncate font-mono text-[11px] font-bold tracking-[0.08em] text-lf-text">{code}</span>
          {running && (
            <LiveClock session={session!} className="ml-auto font-mono text-[10px] font-semibold text-[var(--tone)]" />
          )}
        </span>
        <span className="mt-0.5 flex items-center gap-1.5 text-[10.5px] font-semibold text-[var(--tone)]">
          <SIcon className="h-2.5 w-2.5 shrink-0" />
          {meta.label}
        </span>
        <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[10.5px] text-lf-dim">
          <span className="lf-dot shrink-0" data-live={meta.live} style={{ width: 5, height: 5, boxShadow: "none" }} />
          <span className="truncate">{sub}</span>
        </span>
      </span>

      {/* station render — matches the device type */}
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
  devices, codes, sessionsByDevice, bookingsByDevice, selectedId, onSelect,
}: {
  devices: FloorDevice[];
  codes: Map<string, string>;
  sessionsByDevice: Map<string, FloorSession>;
  bookingsByDevice: Map<string, FloorBooking>;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <section className="lf-scene" aria-label="Floor map">
      <img src={roomImg} alt="" width={1920} height={1152} className="lf-scene-bg" aria-hidden />
      <div className="lf-scene-shade" aria-hidden />
      <div className="lf-scene-grid">
        {devices.map((d, i) => (
          <FloorStation
            key={d.id}
            device={d}
            code={codes.get(d.id) ?? d.name}
            session={sessionsByDevice.get(d.id)}
            booking={bookingsByDevice.get(d.id)}
            selected={selectedId === d.id}
            index={i}
            onSelect={onSelect}
          />
        ))}
      </div>
    </section>
  );
});
