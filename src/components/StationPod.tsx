import { memo, useEffect, useState } from "react";
import {
  Cpu,
  Gamepad2,
  Headset,
  Car,
  MonitorPlay,
  Lock,
  Pause,
  Wrench,
  Sparkles,
} from "lucide-react";
import type { DeviceStatus } from "@/lib/devices.functions";

type DeviceType = "pc" | "console" | "vr" | "racing" | "other";

const TYPE_ICON: Record<DeviceType, typeof Cpu> = {
  pc: MonitorPlay,
  console: Gamepad2,
  vr: Headset,
  racing: Car,
  other: Cpu,
};

const STATUS_THEME: Record<
  DeviceStatus,
  { ring: string; glow: string; chip: string; label: string; pulse: boolean }
> = {
  available: {
    ring: "#22d3a8",
    glow: "rgba(34,211,168,0.45)",
    chip: "READY",
    label: "available",
    pulse: false,
  },
  in_use: {
    ring: "#ef4fb6",
    glow: "rgba(239,79,182,0.65)",
    chip: "LIVE",
    label: "in use",
    pulse: true,
  },
  reserved: {
    ring: "#f5b042",
    glow: "rgba(245,176,66,0.55)",
    chip: "BOOKED",
    label: "reserved",
    pulse: false,
  },
  suspended: {
    ring: "#94a3b8",
    glow: "rgba(148,163,184,0.38)",
    chip: "PAUSED",
    label: "suspended",
    pulse: false,
  },
  maintenance: {
    ring: "#f87171",
    glow: "rgba(248,113,113,0.48)",
    chip: "REPAIR",
    label: "maintenance",
    pulse: false,
  },
};

const STATUS_GLYPH: Record<DeviceStatus, typeof Cpu> = {
  available: Sparkles,
  in_use: MonitorPlay,
  reserved: Lock,
  suspended: Pause,
  maintenance: Wrench,
};

function hexToRgba(hex: string, alpha = 1): string {
  if (!hex.startsWith("#")) return hex;
  let h = hex.slice(1);
  if (h.length === 3) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  }
  const num = parseInt(h, 16);
  if (!Number.isFinite(num)) return hex;
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export type StationPodProps = {
  name: string;
  type: DeviceType;
  status: DeviceStatus;
  hourlyRate: number;
  overlay?: React.ReactNode;
  caption?: React.ReactNode;
  zone?: string | null;
  selected?: boolean;
  index?: number;
  onClick?: () => void;
  onContextMenu?: React.MouseEventHandler<HTMLDivElement>;
  title?: string;
  className?: string;
  /** Optional zone color — tints the desk pad and subtle zone indicator; screen reflects live status. */
  accent?: string | null;
  /** Optional compact top-right quick controls (e.g., move / edit in Floor Builder). */
  controls?: React.ReactNode;
};

/**
 * High-contrast, GPU-composited hardware station pod with a sculpted OLED
 * monitor bezel, CNC stand, status underglow, and live screen telemetry.
 */
export const StationPod = memo(function StationPod({
  name,
  type,
  status,
  hourlyRate,
  overlay,
  caption,
  zone,
  selected = false,
  onClick,
  onContextMenu,
  title,
  className,
  accent,
  controls,
}: StationPodProps) {
  const Icon = TYPE_ICON[type] ?? Cpu;
  const Glyph = STATUS_GLYPH[status];
  const statusTheme = STATUS_THEME[status];
  const screenRing = statusTheme.ring;
  const screenGlow = statusTheme.glow;
  const padAccent = accent || statusTheme.ring;

  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      onContextMenu={onContextMenu}
      title={title}
      aria-label={`${name} — ${statusTheme.label}`}
      className={`group relative block w-full select-none text-left outline-none transition-transform duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 active:scale-[0.985] focus-visible:ring-2 focus-visible:ring-primary/70 rounded-[20px] ${
        onClick ? "cursor-pointer" : ""
      } ${className ?? ""}`}
    >
      {/* Ambient floor aura */}
      <div
        className="pointer-events-none -z-10 absolute -bottom-2 left-1/2 h-5 w-[78%] -translate-x-1/2 rounded-full opacity-45 blur-xl transition-opacity duration-200 group-hover:opacity-85"
        style={{ background: screenGlow }}
        aria-hidden
      />

      {/* Pod shell */}
      <div
        className="relative overflow-hidden rounded-[20px] border p-3 transition-[border-color,box-shadow] duration-150"
        style={{
          borderColor: selected
            ? screenRing
            : accent
              ? `${accent}50`
              : "rgba(255,255,255,0.10)",
          background: accent
            ? `linear-gradient(165deg, ${hexToRgba(accent, 0.12)} 0%, rgba(15,11,28,0.92) 48%, rgba(8,6,18,0.98) 100%)`
            : `linear-gradient(165deg, rgba(255,255,255,0.055) 0%, rgba(14,10,26,0.94) 48%, rgba(8,6,18,0.98) 100%)`,
          boxShadow: selected
            ? `0 0 0 1px ${screenRing}, 0 18px 42px -18px ${screenGlow}, inset 0 1px 0 rgba(255,255,255,0.18)`
            : `0 14px 32px -20px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.12)`,
        }}
      >
        {/* Top specular highlight */}
        <div
          className="pointer-events-none absolute inset-x-4 top-0 h-px opacity-70"
          style={{
            background: `linear-gradient(90deg, transparent, ${padAccent}99, transparent)`,
          }}
          aria-hidden
        />

        {/* Header: Icon + Name + Rate/Zone */}
        <div className="relative flex items-start justify-between gap-1.5">
          <div className="flex min-w-0 items-center gap-2">
            <div
              className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border transition-transform duration-150 group-hover:scale-105"
              style={{
                borderColor: `${padAccent}44`,
                background: `linear-gradient(135deg, ${padAccent}26, rgba(0,0,0,0.25))`,
                color: padAccent,
              }}
            >
              <Icon className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0">
              <div className="truncate font-display text-[13px] font-bold leading-tight text-foreground">
                {name}
              </div>
              <div className="mt-0.5 flex items-center gap-1 truncate font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground tabular-nums">
                <span>{type}</span>
                <span aria-hidden="true">·</span>
                <span>₹{hourlyRate}/hr</span>
              </div>
            </div>
          </div>

          {controls ? (
            <div
              className="relative z-10 flex shrink-0 items-center gap-1"
              onClick={(e) => e.stopPropagation()}
            >
              {controls}
            </div>
          ) : (
            <Glyph
              className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-80"
              style={{ color: screenRing }}
            />
          )}
        </div>

        {/* Sculpted OLED Monitor Bezel + Screen */}
        <div className="relative mt-2.5">
          <div
            className="relative rounded-[13px] p-[3px] pb-[5px]"
            style={{
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.04) 55%, rgba(0,0,0,0.65) 100%)",
              boxShadow:
                "0 10px 22px -12px rgba(0,0,0,0.95), inset 0 1px 0 rgba(255,255,255,0.16)",
            }}
          >
            {/* Camera/sensor pinhole */}
            <div className="mx-auto mb-[2px] h-[2px] w-[2px] rounded-full bg-white/30" />

            {/* OLED Display */}
            <div
              className="relative aspect-[16/9] w-full overflow-hidden rounded-[9px] border"
              style={{
                borderColor: `${screenRing}38`,
                background:
                  status === "in_use"
                    ? `radial-gradient(125% 85% at 50% 0%, ${screenRing}55 0%, #090714 72%)`
                    : status === "available"
                      ? `radial-gradient(120% 85% at 50% 100%, ${screenRing}30 0%, #070712 80%)`
                      : status === "reserved"
                        ? `radial-gradient(120% 85% at 50% 0%, ${screenRing}35 0%, #080713 78%)`
                        : status === "suspended"
                          ? "linear-gradient(145deg, #161722 0%, #080810 100%)"
                          : "repeating-linear-gradient(45deg, #1b0c12 0 7px, #09060d 7px 14px)",
                boxShadow: `inset 0 0 24px -6px ${screenRing}45`,
              }}
            >
              {/* Crisp scanline texture */}
              <div
                className="pointer-events-none absolute inset-0 opacity-25"
                style={{
                  backgroundImage:
                    "repeating-linear-gradient(0deg, rgba(255,255,255,0.06) 0 1px, transparent 1px 3px)",
                }}
                aria-hidden
              />

              {/* Subtle glass diagonal reflection */}
              <div
                className="pointer-events-none absolute inset-0 opacity-30"
                style={{
                  background:
                    "linear-gradient(125deg, rgba(255,255,255,0.14) 0%, transparent 42%)",
                }}
                aria-hidden
              />

              {/* Phosphor sweep when running or hovered */}
              <div
                className={`pointer-events-none absolute -inset-y-2 left-0 w-1/3 ${
                  status === "in_use"
                    ? "opacity-45 animate-sweep-x"
                    : "opacity-0 group-hover:opacity-35 group-hover:animate-sweep-x"
                }`}
                style={{
                  background: `linear-gradient(90deg, transparent, ${screenRing}66, transparent)`,
                }}
                aria-hidden
              />

              {/* Screen HUD top strip */}
              <div className="relative flex items-center justify-between px-2 pt-1.5">
                <span
                  className="inline-flex items-center gap-1 font-mono text-[8.5px] font-bold uppercase tracking-[0.16em]"
                  style={{ color: screenRing }}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${statusTheme.pulse ? "animate-pulse" : ""}`}
                    style={{ background: screenRing, boxShadow: `0 0 6px ${screenRing}` }}
                  />
                  {statusTheme.chip}
                </span>

                {status === "in_use" ? (
                  <span className="flex h-2.5 items-end gap-[2px]" aria-hidden>
                    <span className="animate-eq-1 h-full w-[2px] rounded-full" style={{ background: screenRing }} />
                    <span className="animate-eq-2 h-full w-[2px] rounded-full" style={{ background: screenRing }} />
                    <span className="animate-eq-3 h-full w-[2px] rounded-full" style={{ background: screenRing }} />
                  </span>
                ) : zone ? (
                  <span
                    className="max-w-[65%] truncate font-mono text-[8px] uppercase tracking-[0.14em]"
                    style={{ color: padAccent }}
                  >
                    {zone}
                  </span>
                ) : null}
              </div>

              {/* Screen centerpiece */}
              <div className="absolute inset-0 flex flex-col items-center justify-center px-2 pt-3 text-center">
                {caption ? (
                  <div className="w-full truncate font-mono text-[11px] font-bold tracking-tight text-white tabular-nums drop-shadow">
                    {caption}
                  </div>
                ) : (
                  <Glyph
                    className="h-5 w-5 opacity-85 transition-transform duration-150 group-hover:scale-110"
                    style={{
                      color: screenRing,
                      filter: `drop-shadow(0 0 10px ${screenGlow})`,
                    }}
                  />
                )}
              </div>
            </div>

            {/* Chin power LED */}
            <div className="mt-[3px] flex justify-center">
              <span
                className="h-[2px] w-4 rounded-full opacity-90"
                style={{
                  background: screenRing,
                  boxShadow: `0 0 8px ${screenRing}`,
                }}
              />
            </div>
          </div>

          {/* CNC Monitor Neck + Desk Foot */}
          <div className="mx-auto h-1.5 w-3 bg-gradient-to-b from-white/20 to-white/5" />
          <div
            className="mx-auto h-[3px] w-11 rounded-full border-t border-white/25"
            style={{
              background: "linear-gradient(90deg, rgba(255,255,255,0.06), rgba(255,255,255,0.22), rgba(255,255,255,0.06))",
              boxShadow: `0 2px 10px -1px ${screenGlow}`,
            }}
          />
        </div>

        {/* Footer metadata line (unboxed, clean) */}
        {(overlay || zone) && (
          <div className="relative mt-2 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
            {zone ? (
              <span className="inline-flex min-w-0 items-center gap-1.5 truncate font-mono text-[9.5px] uppercase tracking-[0.14em]">
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: padAccent }}
                />
                <span className="truncate" style={{ color: padAccent }}>
                  {zone}
                </span>
              </span>
            ) : (
              <span />
            )}
            {overlay && <div className="min-w-0 truncate">{overlay}</div>}
          </div>
        )}
      </div>
    </div>
  );
});

/** Tiny live countdown for suspended stations. */
export function SuspendCountdown({ until }: { until: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const ms = Math.max(0, new Date(until).getTime() - now);
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return (
    <span className="font-mono tabular-nums">
      {String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
    </span>
  );
}
