import { memo, useEffect, useState, type CSSProperties } from "react";
import {
  MonitorPlay, Gamepad2, Headset, Car, Cpu, Play, CalendarPlus, Eye, Plus, LogIn, Wrench, CheckCircle2, RotateCcw,
} from "lucide-react";
import { useNow } from "@/hooks/useNow";
import {
  STATUS_META, TYPE_LABEL, normalizeStatus, elapsedMs, fmtClock, fmtTime, initials, maintenanceReason,
  type FloorDevice, type FloorSession, type FloorBooking,
} from "@/lib/live-floor";
import type { DeviceStatus } from "@/lib/devices.functions";

export const TYPE_ICON: Record<string, typeof Cpu> = {
  pc: MonitorPlay, console: Gamepad2, vr: Headset, racing: Car, other: Cpu,
};

export type StationAction = "start" | "book" | "details" | "extend" | "checkin" | "resolve" | "resume" | "maintenance";

export function toneStyle(status: DeviceStatus): CSSProperties {
  return { ["--tone" as string]: STATUS_META[status].tone } as CSSProperties;
}

export function StatusBadge({ status }: { status: DeviceStatus }) {
  const m = STATUS_META[status];
  return (
    <span className="lf-badge" style={toneStyle(status)}>
      <span className="lf-dot" data-live={m.live} />
      {m.label}
    </span>
  );
}

/** Ticks on its own — the parent card never re-renders for the clock. */
export function LiveClock({ session, className = "", mode = "auto" }: {
  session: FloorSession; className?: string; mode?: "auto" | "elapsed";
}) {
  const now = useNow();
  if (!now) return <span className={className}>--:--:--</span>;
  const played = elapsedMs(session, now);
  const planned = Number(session.planned_minutes ?? 0);
  const remaining = mode === "auto" && planned > 0 ? planned * 60000 - played : null;
  const critical = remaining !== null && remaining <= 5 * 60000;
  return (
    <span
      className={`${className} tabular-nums`}
      style={critical ? { color: "var(--lf-danger)" } : undefined}
    >
      {fmtClock(remaining !== null ? Math.max(0, remaining) : played)}
    </span>
  );
}

export function SessionProgress({ session }: { session: FloorSession }) {
  const now = useNow();
  const planned = Number(session.planned_minutes ?? 0);
  if (!planned || !now) return null;
  const pct = Math.min(1, elapsedMs(session, now) / (planned * 60000));
  return (
    <div className="lf-progress" aria-label={`${Math.round(pct * 100)}% of package used`}>
      <span style={{ transform: `scaleX(${pct})` }} />
    </div>
  );
}

export type StationPerms = {
  start?: boolean;
  end?: boolean;
  book?: boolean;
  devices?: boolean;
};

type CardProps = {
  device: FloorDevice;
  code: string;
  session?: FloorSession;
  booking?: FloorBooking;
  selected: boolean;
  perms?: StationPerms;
  onSelect: (id: string) => void;
  onAction: (id: string, action: StationAction) => void;
};

function ActionBtn({ onClick, icon: Icon, label, variant = "ghost" }: {
  onClick: () => void; icon: typeof Cpu; label: string; variant?: "ghost" | "primary" | "tone";
}) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      onKeyDown={(e) => e.stopPropagation()}
      className={`lf-btn flex-1 ${variant === "primary" ? "lf-btn-primary" : variant === "tone" ? "lf-btn-tone" : ""}`}
    >
      <Icon className="h-3.5 w-3.5" /> {label}
    </button>
  );
}

function useBookingArrived(booking?: FloorBooking): boolean {
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    setNowMs(Date.now());
    if (!booking || booking.status !== "confirmed") return;
    const start = new Date(booking.scheduled_at).getTime();
    const diff = start - Date.now();
    if (diff <= 0) return;
    const t = window.setTimeout(() => setNowMs(Date.now()), Math.min(diff + 50, 2_147_483_647));
    return () => window.clearTimeout(t);
  }, [booking?.id, booking?.status, booking?.scheduled_at]);

  if (!booking || booking.status !== "confirmed") return false;
  const start = new Date(booking.scheduled_at).getTime();
  const end = start + (booking.duration_minutes || 0) * 60_000;
  return start <= nowMs && end > nowMs;
}

export const StationCard = memo(function StationCard({
  device, code, session, booking, selected, perms, onSelect, onAction,
}: CardProps) {
  const status = normalizeStatus(device.status);
  const Icon = TYPE_ICON[device.type] ?? Cpu;
  const running = status === "in_use" && !!session;
  const who = session?.customers?.full_name ?? booking?.customers?.full_name ?? null;
  const showName = device.name.trim().toLowerCase() !== code.toLowerCase();
  const act = (a: StationAction) => onAction(device.id, a);
  const reason = status === "maintenance" ? maintenanceReason(device) : null;
  const pausedSession = status === "suspended" && !!session;
  const arrivedRaw = useBookingArrived(booking);
  const arrived = !running && !pausedSession && status !== "maintenance" && arrivedRaw;
  const p = {
    start: perms?.start ?? true,
    end: perms?.end ?? true,
    book: perms?.book ?? true,
    devices: perms?.devices ?? true,
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`${code} ${device.name}, ${STATUS_META[status].label}`}
      data-selected={selected}
      onClick={() => onSelect(device.id)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(device.id); } }}
      className="lf-card p-3.5"
      style={toneStyle(status)}
    >
      {/* identity */}
      <div className="flex items-start gap-2.5">
        <span className="lf-icon-tile"><Icon className="h-4 w-4" /></span>
        <div className="min-w-0 flex-1">
          <div className="font-mono text-[11px] font-semibold tracking-[0.12em] text-lf-text">{code}</div>
          <div className="truncate text-[12px] text-lf-dim">
            {showName ? device.name : TYPE_LABEL[device.type] ?? device.type}
          </div>
        </div>
        <StatusBadge status={status} />
      </div>

      {/* screen */}
      <div className="lf-screen mt-3 flex min-h-[78px] flex-1 flex-col justify-center px-3 py-2.5">
        {running ? (
          <>
            <div className="flex items-center gap-2">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-lf-run/15 font-mono text-[9px] font-bold text-lf-run">
                {initials(who ?? "Walk in")}
              </span>
              <span className="truncate text-[12.5px] font-semibold text-lf-text">{who ?? "Walk-in"}</span>
            </div>
            <div className="mt-1.5 flex items-end justify-between gap-2">
              <LiveClock session={session!} className="font-mono text-[22px] font-bold leading-none text-lf-run" />
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-lf-dim">
                {Number(session!.planned_minutes ?? 0) > 0 ? "left" : "played"}
              </span>
            </div>
            <div className="mt-2"><SessionProgress session={session!} /></div>
          </>
        ) : arrived && booking ? (
          <>
            <div className="font-mono text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--lf-run)" }}>
              Confirmed booking · {fmtTime(booking.scheduled_at)}
            </div>
            <div className="mt-1 truncate text-[13px] font-semibold text-lf-text">{who ?? "Reserved"}</div>
            <div className="font-mono text-[10px] text-lf-dim">{booking.duration_minutes} min</div>
          </>
        ) : status === "reserved" ? (
          <>
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-lf-dim">
              {booking ? `Booked · ${fmtTime(booking.scheduled_at)}` : "Held for a customer"}
            </div>
            <div className="mt-1 truncate text-[13px] font-semibold text-lf-text">{who ?? "Reserved"}</div>
            {booking && <div className="font-mono text-[10px] text-lf-dim">{booking.duration_minutes} min</div>}
          </>
        ) : status === "maintenance" ? (
          <>
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-lf-maint">Out of service</div>
            <div className="mt-1 line-clamp-2 text-[12px] text-lf-dim">{reason ?? "No reason recorded"}</div>
          </>
        ) : status === "suspended" ? (
          <>
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-lf-dim">
              {pausedSession ? "Session paused" : "Station paused"}
            </div>
            <div className="mt-1 truncate text-[12.5px] text-lf-text">
              {pausedSession ? who ?? "Walk-in" : device.suspend_until ? `Back at ${fmtTime(device.suspend_until)}` : "Out of rotation"}
            </div>
          </>
        ) : (
          <div className="flex items-end justify-between gap-2">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-lf-dim">Ready to play</div>
              <div className="mt-1 font-mono text-[20px] font-bold leading-none text-lf-text">
                ₹{device.hourly_rate}<span className="text-[11px] font-medium text-lf-dim">/hr</span>
              </div>
            </div>
            {device.zone && <span className="truncate font-mono text-[10px] text-lf-dim">{device.zone}</span>}
          </div>
        )}
      </div>

      {/* actions */}
      <div className="mt-3 flex gap-1.5">
        {running ? (
          <>
            <ActionBtn onClick={() => act("details")} icon={Eye} label="Session" variant="tone" />
            {p.start && <ActionBtn onClick={() => act("extend")} icon={Plus} label="30m" />}
          </>
        ) : arrived ? (
          p.start ? (
            <ActionBtn onClick={() => act("checkin")} icon={Play} label="Start session" variant="primary" />
          ) : (
            <ActionBtn onClick={() => act("details")} icon={Eye} label="Details" />
          )
        ) : status === "available" ? (
          p.start || p.book ? (
            <>
              {p.start && <ActionBtn onClick={() => act("start")} icon={Play} label="Start" variant="primary" />}
              {p.book && <ActionBtn onClick={() => act("book")} icon={CalendarPlus} label="Book" />}
            </>
          ) : (
            <ActionBtn onClick={() => act("details")} icon={Eye} label="Details" />
          )
        ) : status === "reserved" ? (
          p.start ? (
            <ActionBtn onClick={() => act("checkin")} icon={LogIn} label="Check in" variant="tone" />
          ) : (
            <ActionBtn onClick={() => act("details")} icon={Eye} label="Details" />
          )
        ) : status === "maintenance" ? (
          p.devices ? (
            <ActionBtn onClick={() => act("resolve")} icon={CheckCircle2} label="Mark available" variant="tone" />
          ) : (
            <ActionBtn onClick={() => act("details")} icon={Eye} label="Details" />
          )
        ) : pausedSession ? (
          p.start || p.end ? (
            <ActionBtn onClick={() => act("resume")} icon={RotateCcw} label="Resume" variant="tone" />
          ) : (
            <ActionBtn onClick={() => act("details")} icon={Eye} label="Session" variant="tone" />
          )
        ) : p.devices ? (
          <>
            <ActionBtn onClick={() => act("resolve")} icon={CheckCircle2} label="Available" variant="tone" />
            <ActionBtn onClick={() => act("maintenance")} icon={Wrench} label="Repair" />
          </>
        ) : (
          <ActionBtn onClick={() => act("details")} icon={Eye} label="Details" />
        )}
      </div>
    </div>
  );
});

export const StationRow = memo(function StationRow({
  device, code, session, booking, selected, perms, onSelect, onAction,
}: CardProps) {
  const status = normalizeStatus(device.status);
  const Icon = TYPE_ICON[device.type] ?? Cpu;
  const running = status === "in_use" && !!session;
  const pausedSession = status === "suspended" && !!session;
  const arrivedRaw = useBookingArrived(booking);
  const arrived = !running && !pausedSession && status !== "maintenance" && arrivedRaw;
  const who = session?.customers?.full_name ?? booking?.customers?.full_name ?? null;
  const p = {
    start: perms?.start ?? true,
    end: perms?.end ?? true,
    book: perms?.book ?? true,
    devices: perms?.devices ?? true,
  };
  const primary: { a: StationAction; label: string } =
    running ? { a: "details", label: "Session" }
    : arrived ? (p.start ? { a: "checkin", label: "Start session" } : { a: "details", label: "Details" })
    : status === "available" ? (p.start ? { a: "start", label: "Start" } : p.book ? { a: "book", label: "Book" } : { a: "details", label: "Details" })
    : status === "reserved" ? (p.start ? { a: "checkin", label: "Check in" } : { a: "details", label: "Details" })
    : status === "maintenance" ? (p.devices ? { a: "resolve", label: "Resolve" } : { a: "details", label: "Details" })
    : session ? ((p.start || p.end) ? { a: "resume", label: "Resume" } : { a: "details", label: "Session" })
    : (p.devices ? { a: "resolve", label: "Available" } : { a: "details", label: "Details" });

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      data-selected={selected}
      onClick={() => onSelect(device.id)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(device.id); } }}
      className="lf-row"
      style={toneStyle(status)}
    >
      <span className="grid h-[34px] w-[34px] place-items-center rounded-[10px] border border-lf-line text-[var(--tone)]">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <div className="font-mono text-[11px] font-semibold tracking-[0.12em]">{code}</div>
        <div className="truncate text-[12px] text-lf-dim">{device.name}</div>
      </div>
      <div className="lf-row-hide"><StatusBadge status={status} /></div>
      <div className="lf-row-hide min-w-0 truncate text-[12.5px]">
        {who ?? <span className="text-lf-dim">—</span>}
      </div>
      <div className="lf-row-hide font-mono text-[12px]">
        {running ? <LiveClock session={session!} className="text-lf-run" />
          : (status === "reserved" || arrived) && booking ? fmtTime(booking.scheduled_at)
          : <span className="text-lf-dim">—</span>}
      </div>
      <div className="lf-row-hide font-mono text-[12px] text-lf-dim">₹{device.hourly_rate}/hr</div>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onAction(device.id, primary.a); }}
        onKeyDown={(e) => e.stopPropagation()}
        className={`lf-btn ${primary.a === "start" || arrived ? "lf-btn-primary" : "lf-btn-tone"}`}
      >
        {primary.label}
      </button>
    </div>
  );
});
