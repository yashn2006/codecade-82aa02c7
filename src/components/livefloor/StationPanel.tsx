import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  X, Wrench, CalendarPlus, CheckCircle2, Plus, Pause, Play, Square, LogIn, Ban, Loader2, Cpu,
  Save, Clock, IndianRupee,
} from "lucide-react";
import heroImg from "@/assets/livefloor/station-hero.jpg";
import { STATION_ART_SIZE, stationArt } from "./station-art";
import { LiveClock, SessionProgress, StatusBadge, TYPE_ICON, toneStyle } from "./StationCard";
import { CustomerSelector, type FloorCustomer } from "./CustomerSelector";
import { useNow } from "@/hooks/useNow";
import {
  STATUS_META, TYPE_LABEL, elapsedMs, fmtTime, initials, maintenanceReason, maskPhone, normalizeStatus, runningBill,
  type FloorBooking, type FloorDevice, type FloorSession,
} from "@/lib/live-floor";

const PACKAGES: { label: string; minutes: number }[] = [
  { label: "Open", minutes: 0 },
  { label: "30m", minutes: 30 },
  { label: "1h", minutes: 60 },
  { label: "2h", minutes: 120 },
  { label: "3h", minutes: 180 },
];

export type PanelHandlers = {
  onClose: () => void;
  onStart: (customer: FloorCustomer | null, minutes: number) => void;
  onAssign: (customer: FloorCustomer) => void;
  onExtend: () => void;
  onPause: () => void;
  onResume: () => void;
  onEnd: () => void;
  onBook: () => void;
  onMaintenance: () => void;
  onAvailable: () => void;
  onCheckIn: () => void;
  onCancelBooking: () => void;
};

function RunningBill({ session, rate }: { session: FloorSession; rate: number }) {
  const now = useNow();
  if (!now) return <>₹0</>;
  return <>₹{runningBill(rate, elapsedMs(session, now)).toLocaleString("en-IN")}</>;
}

function PanelAction({ icon: Icon, label, onClick, tone, disabled }: {
  icon: typeof Cpu; label: string; onClick: () => void; tone: string; disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="lf-panel-action"
      style={{ ["--tone" as string]: tone }}
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </button>
  );
}

export type PanelPerms = {
  start?: boolean;
  end?: boolean;
  book?: boolean;
  devices?: boolean;
  customers?: boolean;
  revenue?: boolean;
};

export function StationPanel({
  cafeId, slug, device, code, session, booking, customers, playingOn, busy, perms, handlers,
}: {
  cafeId: string;
  slug: string;
  device: FloorDevice;
  code: string;
  session?: FloorSession;
  booking?: FloorBooking;
  customers: FloorCustomer[];
  /** customer id → station code where they're currently playing */
  playingOn: Map<string, string>;
  busy: boolean;
  perms?: PanelPerms;
  handlers: PanelHandlers;
}) {
  const p = {
    start: perms?.start ?? true,
    end: perms?.end ?? true,
    book: perms?.book ?? true,
    devices: perms?.devices ?? true,
    customers: perms?.customers ?? true,
    revenue: perms?.revenue ?? true,
  };
  const status = normalizeStatus(device.status);
  const Icon = TYPE_ICON[device.type] ?? Cpu;
  const running = status === "in_use" && !!session;
  const pausedSession = status === "suspended" && !!session;
  const hasSession = running || pausedSession;
  const canAssign = (status === "available" || hasSession) && p.start;
  const who = session?.customers ?? booking?.customers ?? null;

  const [picked, setPicked] = useState<FloorCustomer | null>(null);
  const [minutes, setMinutes] = useState(60);
  const [tried, setTried] = useState(false);

  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    setNowMs(Date.now());
    if (!booking || booking.status !== "confirmed") return;
    const target = new Date(booking.scheduled_at).getTime();
    const diff = target - Date.now();
    if (diff <= 0) return;
    const t = window.setTimeout(() => setNowMs(Date.now()), Math.min(diff + 50, 2_147_483_647));
    return () => window.clearTimeout(t);
  }, [booking]);

  const arrivedBooking =
    !hasSession &&
    status !== "maintenance" &&
    !!booking &&
    booking.status === "confirmed" &&
    new Date(booking.scheduled_at).getTime() <= nowMs;

  const assignError = hasSession && !picked ? "Pick or add a customer first." : null;
  const estimate = minutes > 0 ? Math.ceil((device.hourly_rate * minutes) / 60) : null;

  const save = () => {
    setTried(true);
    if (busy || assignError) return;
    if (status === "available") handlers.onStart(picked, minutes);
    else if (hasSession && picked) handlers.onAssign(picked);
  };

  const tone = STATUS_META[status].tone;

  return (
    <aside className="lf-side flex flex-col" style={toneStyle(status)} aria-label={`${code} details`}>
      {/* header */}
      <div className="flex items-center gap-2.5 p-4 pb-3">
        <span className="lf-side-ico"><Icon className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-[19px] font-extrabold leading-tight tracking-[0.04em]">{code}</div>
          <div className="truncate text-[11.5px] text-lf-dim">{device.name} · {TYPE_LABEL[device.type] ?? device.type}</div>
        </div>
        <StatusBadge status={status} />
        <button type="button" onClick={handlers.onClose} className="lf-btn h-8 w-8 px-0" aria-label="Close details">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* hero */}
      <div className="px-4">
        <div className="lf-side-hero">
          {device.type === "pc" || device.type === "other" ? (
            <img src={heroImg} alt={`${device.name} station`} width={1088} height={608} loading="lazy" />
          ) : (
            <div className="lf-side-hero-art">
              <img
                src={stationArt(device.type)}
                alt={`${device.name} station`}
                width={STATION_ART_SIZE.width}
                height={STATION_ART_SIZE.height}
                loading="lazy"
              />
            </div>
          )}
          <div className="lf-side-hero-shade" />
          <div className="absolute inset-x-3 bottom-2.5 flex items-end justify-between gap-2">
            {hasSession ? (
              <div>
                <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-lf-dim">
                  {pausedSession ? "Paused at" : Number(session!.planned_minutes ?? 0) > 0 ? "Time left" : "Played"}
                </div>
                <LiveClock session={session!} className="font-mono text-[24px] font-bold leading-none text-[var(--tone)]" />
              </div>
            ) : (
              <div className="font-mono text-[11px] text-lf-text">
                {(status === "reserved" || arrivedBooking) && booking ? `Booked for ${fmtTime(booking.scheduled_at)}` : device.zone ?? "Main floor"}
              </div>
            )}
            <div className="text-right">
              <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-lf-dim">{hasSession && p.revenue ? "Bill" : "Rate"}</div>
              <div className="font-mono text-[15px] font-bold text-lf-text">
                {hasSession && p.revenue ? <RunningBill session={session!} rate={device.hourly_rate} /> : `₹${device.hourly_rate}/hr`}
              </div>
            </div>
          </div>
        </div>
        {hasSession && <div className="mt-2"><SessionProgress session={session!} /></div>}
      </div>

      {/* actions */}
      <div className="grid grid-cols-3 gap-2 px-4 pt-3">
        {running ? (
          <>
            {p.start && <PanelAction icon={Plus} label="+30 min" tone="var(--lf-run)" onClick={handlers.onExtend} disabled={busy} />}
            {p.end && <PanelAction icon={Pause} label="Pause" tone="var(--lf-paused)" onClick={handlers.onPause} disabled={busy} />}
            {p.end && <PanelAction icon={Square} label="End session" tone="var(--lf-danger)" onClick={handlers.onEnd} disabled={busy} />}
          </>
        ) : pausedSession ? (
          <>
            {(p.start || p.end) && <PanelAction icon={Play} label="Resume" tone="var(--lf-run)" onClick={handlers.onResume} disabled={busy} />}
            {p.end && <PanelAction icon={Square} label="End session" tone="var(--lf-danger)" onClick={handlers.onEnd} disabled={busy} />}
            {p.devices && <PanelAction icon={Wrench} label="Maintenance" tone="var(--lf-maint)" onClick={handlers.onMaintenance} disabled={busy} />}
          </>
        ) : status === "reserved" || arrivedBooking ? (
          <>
            {p.start && <PanelAction icon={arrivedBooking ? Play : LogIn} label={arrivedBooking ? "Start session" : "Check in"} tone="var(--lf-run)" onClick={handlers.onCheckIn} disabled={busy} />}
            {p.book && <PanelAction icon={Ban} label={booking ? "Cancel booking" : "Release"} tone="var(--lf-danger)" onClick={handlers.onCancelBooking} disabled={busy} />}
            {p.devices && <PanelAction icon={Wrench} label="Maintenance" tone="var(--lf-maint)" onClick={handlers.onMaintenance} disabled={busy} />}
          </>
        ) : status === "maintenance" ? (
          p.devices ? (
            <>
              <PanelAction icon={Wrench} label="In repair" tone="var(--lf-maint)" onClick={handlers.onMaintenance} disabled />
              <PanelAction icon={CalendarPlus} label="Mark as booked" tone="var(--lf-booked)" onClick={handlers.onBook} disabled />
              <PanelAction icon={CheckCircle2} label="Mark available" tone="var(--lf-run)" onClick={handlers.onAvailable} disabled={busy} />
            </>
          ) : null
        ) : status === "suspended" ? (
          <>
            {p.devices && <PanelAction icon={Wrench} label="Maintenance" tone="var(--lf-maint)" onClick={handlers.onMaintenance} disabled={busy} />}
            {p.book && <PanelAction icon={CalendarPlus} label="Mark as booked" tone="var(--lf-booked)" onClick={handlers.onBook} disabled={busy} />}
            {p.devices && <PanelAction icon={CheckCircle2} label="Mark available" tone="var(--lf-run)" onClick={handlers.onAvailable} disabled={busy} />}
          </>
        ) : (
          <>
            {p.devices && <PanelAction icon={Wrench} label="Maintenance" tone="var(--lf-maint)" onClick={handlers.onMaintenance} disabled={busy} />}
            {p.book && <PanelAction icon={CalendarPlus} label="Mark as booked" tone="var(--lf-booked)" onClick={handlers.onBook} disabled={busy} />}
            {p.devices && <PanelAction icon={Pause} label="Pause station" tone="var(--lf-paused)" onClick={handlers.onPause} disabled={busy} />}
          </>
        )}
      </div>

      {/* current user */}
      <div className="mt-4 border-t border-lf-line px-4 pt-3.5">
        <div className="text-[13px] font-bold">Current user</div>
        {who && (hasSession || status === "reserved" || arrivedBooking) ? (
          <div className="mt-2 flex items-center gap-3 rounded-xl border border-lf-line bg-lf-bg/60 p-2.5">
            <span className="lf-avatar" style={{ ["--tone" as string]: tone }}>{initials(who.full_name ?? "?")}</span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-semibold">{who.full_name ?? "Customer"}</div>
              <div className="font-mono text-[10.5px] text-lf-dim">{maskPhone(who.phone)}</div>
            </div>
            <Link to="/cafe/$slug/customers" params={{ slug }} className="lf-btn lf-btn-tone h-7 px-2.5 text-[11px]" style={{ ["--tone" as string]: "var(--lf-booked)" }}>
              View profile
            </Link>
          </div>
        ) : (
          <div className="mt-2 rounded-xl border border-dashed border-lf-line px-3 py-2.5 text-[12px] text-lf-dim">
            {hasSession ? "Walk-in — no customer attached yet."
              : status === "maintenance" ? maintenanceReason(device) ?? "Out of service."
              : status === "reserved" ? "Held without a named customer."
              : "No one on this station."}
          </div>
        )}
      </div>

      {/* assign */}
      {canAssign && (
        <div className="mt-4 flex min-h-0 flex-1 flex-col border-t border-lf-line px-4 pt-3.5">
          <div className="mb-2 text-[13px] font-bold">{hasSession ? "Change / assign user" : "Assign user & start"}</div>

          <CustomerSelector
            cafeId={cafeId}
            customers={customers}
            value={picked}
            onChange={setPicked}
            playingOn={playingOn}
            canCreateCustomer={p.customers}
            listClassName="max-h-[210px]"
          />

          {status === "available" && (
            <div className="mt-3">
              <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-lf-dim">
                <Clock className="h-3 w-3" /> Package
              </div>
              <div className="mt-1.5 grid grid-cols-5 gap-1.5">
                {PACKAGES.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    data-on={minutes === p.minutes}
                    onClick={() => setMinutes(p.minutes)}
                    className="lf-chip justify-center px-0"
                    style={{ ["--tone" as string]: "var(--lf-violet)" }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="mt-2 flex items-center justify-between text-[11.5px] text-lf-dim">
                <span>{minutes > 0 ? `${minutes} min package` : "Open session — billed when it ends"}</span>
                {estimate !== null && (
                  <span className="inline-flex items-center font-mono text-[13px] font-bold text-lf-text">
                    <IndianRupee className="h-3 w-3" />{estimate.toLocaleString("en-IN")}
                  </span>
                )}
              </div>
            </div>
          )}

          {tried && assignError && (
            <div role="alert" className="mt-2 text-[11.5px] text-lf-danger">{assignError}</div>
          )}

          <div className="mt-auto pb-4 pt-3">
            <button type="button" onClick={save} disabled={busy || (hasSession && !picked)} className="lf-btn lf-btn-primary lf-save h-11 w-full text-[13px]">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : status === "available" ? <Play className="h-4 w-4" /> : <Save className="h-4 w-4" />}
              {busy ? "Working…" : status === "available" ? (picked ? "Start session" : "Start as walk-in") : "Save changes"}
            </button>
          </div>
        </div>
      )}
      {!canAssign && <div className="pb-4" />}
    </aside>
  );
}
