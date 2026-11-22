import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  X, Wrench, CalendarPlus, CheckCircle2, Plus, Pause, Play, Square, LogIn, Ban, Loader2, Cpu,
  Save, Clock, IndianRupee, SlidersHorizontal, Gamepad2, MonitorPlay, Headset, Car,
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

const RIG_TYPES = [
  { value: "pc", label: "PC", icon: MonitorPlay },
  { value: "console", label: "Console", icon: Gamepad2 },
  { value: "vr", label: "VR", icon: Headset },
  { value: "racing", label: "Sim", icon: Car },
  { value: "other", label: "Other", icon: Cpu },
] as const;

const ZONE_SWATCHES = [
  { name: "Violet", value: "#a78bfa" },
  { name: "Azure", value: "#7dd3fc" },
  { name: "Magenta", value: "#ef4fb6" },
  { name: "Amber", value: "#f5b042" },
  { name: "Emerald", value: "#22d3a8" },
  { name: "Rose", value: "#f87171" },
];

export type StationSettingsPatch = {
  name: string;
  type: "pc" | "console" | "vr" | "racing" | "other";
  hourly_rate: number;
  zone: string | null;
  zone_color: string | null;
  notes: string | null;
  specs: Record<string, unknown> | null;
};

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
  onSaveSettings?: (patch: StationSettingsPatch) => Promise<void> | void;
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

function specStr(specs: Record<string, unknown> | null | undefined, key: string): string {
  const v = specs?.[key];
  return typeof v === "string" ? v : "";
}

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
  /** customer id -> station code where they're currently playing */
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

  const [tab, setTab] = useState<"controls" | "settings">("controls");
  const [picked, setPicked] = useState<FloorCustomer | null>(null);
  const [minutes, setMinutes] = useState(60);
  const [tried, setTried] = useState(false);

  // In-place rig settings state
  const [cfgName, setCfgName] = useState(device.name);
  const [cfgType, setCfgType] = useState<"pc" | "console" | "vr" | "racing" | "other">(
    (RIG_TYPES.some((t) => t.value === device.type) ? device.type : "pc") as "pc" | "console" | "vr" | "racing" | "other",
  );
  const [cfgRate, setCfgRate] = useState(String(device.hourly_rate));
  const [cfgZone, setCfgZone] = useState(device.zone ?? "");
  const [cfgColor, setCfgColor] = useState(device.zone_color ?? ZONE_SWATCHES[0].value);
  const [cfgGpu, setCfgGpu] = useState(specStr(device.specs, "gpu"));
  const [cfgCpu, setCfgCpu] = useState(specStr(device.specs, "cpu"));
  const [cfgDisplay, setCfgDisplay] = useState(specStr(device.specs, "display"));
  const [cfgRam, setCfgRam] = useState(specStr(device.specs, "ram"));
  const [cfgNotes, setCfgNotes] = useState(device.notes ?? "");

  useEffect(() => {
    setCfgName(device.name);
    setCfgType((RIG_TYPES.some((t) => t.value === device.type) ? device.type : "pc") as "pc" | "console" | "vr" | "racing" | "other");
    setCfgRate(String(device.hourly_rate));
    setCfgZone(device.zone ?? "");
    setCfgColor(device.zone_color ?? ZONE_SWATCHES[0].value);
    setCfgGpu(specStr(device.specs, "gpu"));
    setCfgCpu(specStr(device.specs, "cpu"));
    setCfgDisplay(specStr(device.specs, "display"));
    setCfgRam(specStr(device.specs, "ram"));
    setCfgNotes(device.notes ?? "");
  }, [device]);

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

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!handlers.onSaveSettings || busy) return;
    const nextSpecs: Record<string, string> = {};
    if (cfgGpu.trim()) nextSpecs.gpu = cfgGpu.trim();
    if (cfgCpu.trim()) nextSpecs.cpu = cfgCpu.trim();
    if (cfgDisplay.trim()) nextSpecs.display = cfgDisplay.trim();
    if (cfgRam.trim()) nextSpecs.ram = cfgRam.trim();
    await handlers.onSaveSettings({
      name: cfgName.trim() || device.name,
      type: cfgType,
      hourly_rate: Math.max(0, Math.round(Number(cfgRate) || 0)),
      zone: cfgZone.trim() || null,
      zone_color: cfgZone.trim() ? cfgColor : device.zone_color ?? null,
      notes: cfgNotes.trim() || null,
      specs: Object.keys(nextSpecs).length > 0 ? nextSpecs : null,
    });
  };

  const specSummary = [
    specStr(device.specs, "gpu"),
    specStr(device.specs, "cpu"),
    specStr(device.specs, "display"),
    specStr(device.specs, "ram"),
  ].filter(Boolean);

  const tone = STATUS_META[status].tone;

  return (
    <aside className="lf-side flex flex-col overflow-hidden" style={toneStyle(status)} aria-label={`${code} details`}>
      {/* Header */}
      <div className="flex items-center gap-2.5 p-4 pb-3">
        <span className="lf-side-ico"><Icon className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-[19px] font-extrabold leading-tight tracking-[0.04em] text-white">
            {code}
          </div>
          <div className="truncate text-[11.5px] text-lf-dim">
            {device.name} · {TYPE_LABEL[device.type] ?? device.type}
          </div>
        </div>
        <StatusBadge status={status} />
        <button type="button" onClick={handlers.onClose} className="lf-btn h-8 w-8 px-0" aria-label="Close details">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* iOS-style Segmented Tab Bar (Controls | Rig Settings) */}
      {p.devices && handlers.onSaveSettings && (
        <div className="px-4 pb-3">
          <div className="lf-tabs" role="tablist" aria-label="Station inspector tabs">
            <button
              type="button"
              role="tab"
              aria-selected={tab === "controls"}
              data-on={tab === "controls"}
              onClick={() => setTab("controls")}
              className="inline-flex items-center justify-center gap-1.5"
            >
              <Play className="h-3 w-3" /> Controls
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "settings"}
              data-on={tab === "settings"}
              onClick={() => setTab("settings")}
              className="inline-flex items-center justify-center gap-1.5"
            >
              <SlidersHorizontal className="h-3 w-3" /> Rig settings
            </button>
          </div>
        </div>
      )}

      {tab === "settings" && p.devices && handlers.onSaveSettings ? (
        <form onSubmit={saveSettings} className="space-y-3.5 px-4 pb-4">
          <div className="grid grid-cols-5 gap-1">
            {RIG_TYPES.map((t) => {
              const TIcon = t.icon;
              const active = cfgType === t.value;
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setCfgType(t.value)}
                  className={`flex flex-col items-center gap-1 rounded-xl border py-2 text-[10px] font-semibold transition-colors ${
                    active
                      ? "border-primary/60 bg-primary/18 text-white"
                      : "border-white/10 bg-white/[0.03] text-lf-dim hover:border-white/20 hover:text-white"
                  }`}
                >
                  <TIcon className="h-3.5 w-3.5" />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <label className="space-y-1">
              <span className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-lf-dim">Station name</span>
              <input
                value={cfgName}
                onChange={(e) => setCfgName(e.target.value)}
                required
                className="lf-input h-9 text-xs"
              />
            </label>
            <label className="space-y-1">
              <span className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-lf-dim">Rate (₹/hr)</span>
              <input
                type="number"
                min={0}
                value={cfgRate}
                onChange={(e) => setCfgRate(e.target.value)}
                required
                className="lf-input h-9 font-mono text-xs tabular-nums"
              />
            </label>
          </div>

          <div className="space-y-2">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
              <label className="space-y-1">
                <span className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-lf-dim">Zone label</span>
                <input
                  value={cfgZone}
                  onChange={(e) => setCfgZone(e.target.value)}
                  placeholder="e.g. Esports Arena, VIP Pod"
                  className="lf-input h-9 text-xs"
                />
              </label>
              <div className="flex items-center gap-1 pb-1.5">
                {ZONE_SWATCHES.map((sw) => (
                  <button
                    key={sw.value}
                    type="button"
                    onClick={() => setCfgColor(sw.value)}
                    title={sw.name}
                    aria-label={`${sw.name} zone color`}
                    className="h-5 w-5 rounded-full transition-transform hover:scale-110"
                    style={{
                      background: sw.value,
                      boxShadow: cfgColor === sw.value ? `0 0 0 2px #090714, 0 0 0 3.5px ${sw.value}` : "none",
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-1.5 rounded-xl border border-white/10 bg-black/30 p-2.5">
            <div className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-lf-dim">
              Hardware specs
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                value={cfgGpu}
                onChange={(e) => setCfgGpu(e.target.value)}
                placeholder="GPU (e.g. RTX 4070)"
                className="lf-input h-8 text-xs"
              />
              <input
                value={cfgCpu}
                onChange={(e) => setCfgCpu(e.target.value)}
                placeholder="CPU (e.g. i7-14700K)"
                className="lf-input h-8 text-xs"
              />
              <input
                value={cfgDisplay}
                onChange={(e) => setCfgDisplay(e.target.value)}
                placeholder="Monitor (e.g. 240Hz OLED)"
                className="lf-input h-8 text-xs"
              />
              <input
                value={cfgRam}
                onChange={(e) => setCfgRam(e.target.value)}
                placeholder="RAM (e.g. 32GB DDR5)"
                className="lf-input h-8 text-xs"
              />
            </div>
          </div>

          <label className="block space-y-1">
            <span className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-lf-dim">Notes</span>
            <textarea
              value={cfgNotes}
              onChange={(e) => setCfgNotes(e.target.value)}
              rows={2}
              maxLength={280}
              placeholder="Peripherals, installed games, quirks…"
              className="lf-input h-auto resize-none py-2 text-xs"
            />
          </label>

          <div className="flex items-center gap-2 pt-1">
            <Link
              to="/cafe/$slug/floor"
              params={{ slug }}
              className="lf-btn h-10 flex-1 text-xs"
            >
              Floor Builder
            </Link>
            <button
              type="submit"
              disabled={busy}
              className="lf-btn lf-btn-primary h-10 flex-[1.5] text-xs"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              {busy ? "Saving…" : "Save rig settings"}
            </button>
          </div>
        </form>
      ) : (
        <>
          {/* Hero */}
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
                  <div className="min-w-0">
                    <div className="truncate font-mono text-[11px] font-semibold text-lf-text">
                      {(status === "reserved" || arrivedBooking) && booking
                        ? `Booked for ${fmtTime(booking.scheduled_at)}`
                        : device.zone ?? "Main floor"}
                    </div>
                    {specSummary.length > 0 && (
                      <div className="mt-0.5 truncate font-mono text-[9.5px] text-white/70">
                        {specSummary.join(" · ")}
                      </div>
                    )}
                  </div>
                )}
                <div className="shrink-0 text-right">
                  <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-lf-dim">{hasSession && p.revenue ? "Bill" : "Rate"}</div>
                  <div className="font-mono text-[15px] font-bold tabular-nums text-lf-text">
                    {hasSession && p.revenue ? <RunningBill session={session!} rate={device.hourly_rate} /> : `₹${device.hourly_rate}/hr`}
                  </div>
                </div>
              </div>
            </div>
            {hasSession && <div className="mt-2"><SessionProgress session={session!} /></div>}
          </div>

          {/* Actions */}
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

          {/* Current user */}
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

          {/* Assign */}
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
                    {PACKAGES.map((pkg) => (
                      <button
                        key={pkg.label}
                        type="button"
                        data-on={minutes === pkg.minutes}
                        onClick={() => setMinutes(pkg.minutes)}
                        className="lf-chip justify-center px-0"
                        style={{ ["--tone" as string]: "var(--lf-violet)" }}
                      >
                        {pkg.label}
                      </button>
                    ))}
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[11.5px] text-lf-dim">
                    <span>{minutes > 0 ? `${minutes} min package` : "Open session — billed when it ends"}</span>
                    {estimate !== null && (
                      <span className="inline-flex items-center font-mono text-[13px] font-bold tabular-nums text-lf-text">
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
        </>
      )}
    </aside>
  );
}
