/**
 * Pure helpers for the Live Floor: status vocabulary, station codes,
 * counting, filtering and sorting. No React, no I/O — safe to unit test.
 */
import type { DeviceStatus } from "@/lib/devices.functions";

export type FloorDevice = {
  id: string;
  name: string;
  type: string;
  hourly_rate: number;
  status: string;
  zone?: string | null;
  zone_color?: string | null;
  suspend_until?: string | null;
  notes?: string | null;
};

export type FloorSession = {
  id: string;
  device_id: string;
  started_at: string;
  status: string;
  planned_minutes?: number | null;
  package_name?: string | null;
  amount_paid?: number | null;
  payment_method?: string | null;
  paused_ms?: number | null;
  paused_at?: string | null;
  notes?: string | null;
  customer_id?: string | null;
  customers?: {
    id?: string;
    full_name?: string | null;
    phone?: string | null;
    email?: string | null;
    wallet_balance?: number | null;
  } | null;
};

export type FloorBooking = {
  id: string;
  device_id: string;
  customer_id: string | null;
  scheduled_at: string;
  duration_minutes: number;
  status: string;
  customers?: { full_name?: string | null; phone?: string | null } | null;
};

export const FLOOR_STATUSES: DeviceStatus[] = ["in_use", "available", "reserved", "suspended", "maintenance"];

export const STATUS_META: Record<DeviceStatus, { label: string; tone: string; live: boolean }> = {
  in_use:      { label: "Running",     tone: "var(--lf-run)",    live: true },
  available:   { label: "Available",   tone: "var(--lf-free)",   live: false },
  reserved:    { label: "Booked",      tone: "var(--lf-booked)", live: false },
  suspended:   { label: "Paused",      tone: "var(--lf-paused)", live: false },
  maintenance: { label: "Maintenance", tone: "var(--lf-maint)",  live: false },
};

export const TYPE_LABEL: Record<string, string> = {
  pc: "Gaming PC", console: "Console", vr: "VR station", racing: "Racing sim", other: "Station",
};
const TYPE_PREFIX: Record<string, string> = {
  pc: "PC", console: "CON", vr: "VR", racing: "SIM", other: "ST",
};

export function normalizeStatus(s: string | null | undefined): DeviceStatus {
  return (FLOOR_STATUSES as string[]).includes(s ?? "") ? (s as DeviceStatus) : "available";
}

/** Stable station IDs like PC-01, CON-02, VR-01 — numbered per type in name order. */
export function stationCodes(devices: FloorDevice[]): Map<string, string> {
  const byType = new Map<string, FloorDevice[]>();
  for (const d of devices) {
    const list = byType.get(d.type) ?? [];
    list.push(d);
    byType.set(d.type, list);
  }
  const out = new Map<string, string>();
  for (const [type, list] of byType) {
    const prefix = TYPE_PREFIX[type] ?? "ST";
    [...list]
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }) || a.id.localeCompare(b.id))
      .forEach((d, i) => out.set(d.id, `${prefix}-${String(i + 1).padStart(2, "0")}`));
  }
  return out;
}

export function countByStatus(devices: FloorDevice[]): Record<DeviceStatus, number> & { total: number } {
  const c = { total: devices.length, available: 0, in_use: 0, reserved: 0, suspended: 0, maintenance: 0 };
  for (const d of devices) c[normalizeStatus(d.status)] += 1;
  return c;
}

export type StatusFilter = "all" | DeviceStatus;
export type SortKey = "name" | "status" | "price";

const STATUS_ORDER: Record<DeviceStatus, number> = { in_use: 0, reserved: 1, available: 2, suspended: 3, maintenance: 4 };

export function filterStations(
  devices: FloorDevice[],
  opts: {
    status: StatusFilter;
    type: string;
    query: string;
    codes: Map<string, string>;
    sessionsByDevice?: Map<string, FloorSession>;
  },
): FloorDevice[] {
  const q = opts.query.trim().toLowerCase();
  return devices.filter((d) => {
    if (opts.status !== "all" && normalizeStatus(d.status) !== opts.status) return false;
    if (opts.type !== "all" && d.type !== opts.type) return false;
    if (!q) return true;
    const who = opts.sessionsByDevice?.get(d.id)?.customers?.full_name ?? "";
    return (
      d.name.toLowerCase().includes(q) ||
      (opts.codes.get(d.id) ?? "").toLowerCase().includes(q) ||
      (TYPE_LABEL[d.type] ?? d.type).toLowerCase().includes(q) ||
      (d.zone ?? "").toLowerCase().includes(q) ||
      who.toLowerCase().includes(q)
    );
  });
}

export function sortStations(list: FloorDevice[], key: SortKey, codes: Map<string, string>): FloorDevice[] {
  const byName = (a: FloorDevice, b: FloorDevice) =>
    a.name.localeCompare(b.name, undefined, { numeric: true }) ||
    (codes.get(a.id) ?? "").localeCompare(codes.get(b.id) ?? "");
  const out = [...list];
  if (key === "name") out.sort(byName);
  else if (key === "status")
    out.sort((a, b) => STATUS_ORDER[normalizeStatus(a.status)] - STATUS_ORDER[normalizeStatus(b.status)] || byName(a, b));
  else out.sort((a, b) => b.hourly_rate - a.hourly_rate || byName(a, b));
  return out;
}

/** Played time for a session, excluding paused time. */
export function elapsedMs(session: FloorSession, now: number): number {
  const paused = Number(session.paused_ms ?? 0) + (session.paused_at ? now - new Date(session.paused_at).getTime() : 0);
  return Math.max(0, now - new Date(session.started_at).getTime() - paused);
}

/** Same rounding the server uses at end-of-session: ceil(rate × minutes / 60), minimum 1 minute. */
export function runningBill(hourlyRate: number, playedMs: number): number {
  const minutes = Math.max(1, Math.ceil(playedMs / 60000));
  return Math.ceil((hourlyRate * minutes) / 60);
}

export function fmtClock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

export function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

export function initials(text: string): string {
  return text.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
}

/** Show only the last 4 digits of a phone number. */
export function maskPhone(phone: string | null | undefined): string {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length < 4) return "—";
  return `•••• ${digits.slice(-4)}`;
}

/** Two bookings [aStart, aStart+aMin) and [bStart, bStart+bMin) overlap? */
export function overlaps(aStart: number, aMin: number, bStart: number, bMin: number): boolean {
  return aStart < bStart + bMin * 60000 && bStart < aStart + aMin * 60000;
}

/** Live (pending/confirmed) bookings for a device that collide with the requested window. */
export function findBookingConflict(
  bookings: FloorBooking[],
  deviceId: string,
  startMs: number,
  minutes: number,
): FloorBooking | null {
  for (const b of bookings) {
    if (b.device_id !== deviceId) continue;
    if (b.status !== "pending" && b.status !== "confirmed") continue;
    if (overlaps(startMs, minutes, new Date(b.scheduled_at).getTime(), b.duration_minutes)) return b;
  }
  return null;
}

/** Maintenance reasons are stored in device notes with this prefix so they can be cleared on resolve. */
export const MAINT_PREFIX = "Maintenance: ";
export function maintenanceReason(d: FloorDevice): string | null {
  const n = d.notes ?? "";
  return n.startsWith(MAINT_PREFIX) ? n.slice(MAINT_PREFIX.length) : n || null;
}
