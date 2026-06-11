// Pure helpers — no server imports. Safe in client + SSR.

export type MaintenanceWindow = {
  starts_at: string | null;
  ends_at: string | null;
  message: string | null;
  title?: string | null;
};

export function isMaintenanceActive(w: MaintenanceWindow | null | undefined, now = new Date()): boolean {
  if (!w) return false;
  const { starts_at, ends_at } = w;
  if (!starts_at && !ends_at) return false;
  const start = starts_at ? new Date(starts_at) : null;
  const end = ends_at ? new Date(ends_at) : null;
  if (start && now < start) return false;
  if (end && now > end) return false;
  // active if at least one bound is set and we're inside
  return !!(start || end);
}

export function maintenanceCountdown(w: MaintenanceWindow | null | undefined, now = new Date()): string | null {
  if (!w) return null;
  const start = w.starts_at ? new Date(w.starts_at) : null;
  const end = w.ends_at ? new Date(w.ends_at) : null;
  if (start && now < start) {
    return `Starts ${start.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}`;
  }
  if (end && now <= end) {
    const ms = end.getTime() - now.getTime();
    const h = Math.floor(ms / 3_600_000);
    const m = Math.floor((ms % 3_600_000) / 60_000);
    if (h >= 24) return `Back in ~${Math.ceil(h / 24)}d`;
    if (h >= 1) return `Back in ${h}h ${m}m`;
    return `Back in ${Math.max(m, 1)}m`;
  }
  return null;
}
