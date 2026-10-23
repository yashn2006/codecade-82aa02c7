import { memo, useMemo } from "react";
import { BarChart3, HeartPulse, Gamepad2 } from "lucide-react";
import type { DeviceStatus } from "@/lib/devices.functions";
import type { FloorSession } from "@/lib/live-floor";

type Counts = Record<DeviceStatus, number> & { total: number };

/** Sessions started per hour over the last 12 hours. */
function hourlyStarts(sessions: FloorSession[], now: number): number[] {
  const buckets = Array.from({ length: 12 }, () => 0);
  const hour = 3600000;
  const end = Math.ceil(now / hour) * hour;
  for (const s of sessions) {
    const t = new Date(s.started_at).getTime();
    const idx = 11 - Math.floor((end - t) / hour);
    if (idx >= 0 && idx < 12) buckets[idx] += 1;
  }
  return buckets;
}

function Wave({ values }: { values: number[] }) {
  const max = Math.max(1, ...values);
  const w = 200, h = 44;
  const step = w / (values.length - 1);
  const pts = values.map((v, i) => [i * step, h - 4 - (v / max) * (h - 10)] as const);
  const d = pts.map(([x, y], i) => {
    if (i === 0) return `M${x},${y}`;
    const [px, py] = pts[i - 1];
    const cx = (px + x) / 2;
    return `C${cx},${py} ${cx},${y} ${x},${y}`;
  }).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="block h-11 w-full" aria-hidden>
      <defs>
        <linearGradient id="lf-wave-stroke" x1="0" x2="1">
          <stop offset="0%" stopColor="var(--lf-magenta)" />
          <stop offset="100%" stopColor="var(--lf-cyan)" />
        </linearGradient>
        <linearGradient id="lf-wave-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--lf-violet)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--lf-violet)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${d} L${w},${h} L0,${h} Z`} fill="url(#lf-wave-fill)" />
      <path d={d} fill="none" stroke="url(#lf-wave-stroke)" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export const FloorFooter = memo(function FloorFooter({
  counts, sessions, healthy, now,
}: {
  counts: Counts;
  sessions: FloorSession[];
  healthy: boolean;
  now: number;
}) {
  const values = useMemo(() => hourlyStarts(sessions, now || Date.now()), [sessions, now]);
  const started = values.reduce((a, b) => a + b, 0);
  return (
    <section className="grid gap-3 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,0.8fr)]">
      <div className="lf-panel flex items-center gap-3 px-4 py-3">
        <span className="lf-stat-ico" style={{ ["--tone" as string]: "var(--lf-magenta)" }}><BarChart3 className="h-4 w-4" /></span>
        <div className="min-w-0">
          <div className="text-[13px] font-bold">Live activity</div>
          <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11.5px] text-lf-dim">
            <span><b className="text-lf-run">{counts.in_use}</b> running</span>
            <span><b className="text-lf-cyan">{counts.available}</b> available</span>
            <span><b className="text-lf-maint">{counts.maintenance}</b> maintenance</span>
            <span><b className="text-lf-booked">{counts.reserved}</b> booked</span>
          </div>
        </div>
      </div>
      <div className="lf-panel flex items-center gap-3 px-4 py-2">
        <div className="min-w-0 flex-1">
          <Wave values={values} />
          <div className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-lf-dim">{started} sessions · last 12h</div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[10.5px] text-lf-dim">Total stations</div>
          <div className="flex items-center justify-end gap-1 font-mono text-[20px] font-bold">
            <Gamepad2 className="h-4 w-4 text-lf-violet" /> {counts.total}
          </div>
        </div>
      </div>
      <div className="lf-panel flex items-center gap-3 px-4 py-3" style={{ ["--tone" as string]: healthy ? "var(--lf-run)" : "var(--lf-maint)" }}>
        <span className="lf-stat-ico"><HeartPulse className="h-4 w-4" /></span>
        <div className="min-w-0">
          <div className="text-[13px] font-bold">System health</div>
          <div className="truncate text-[11.5px]" style={{ color: "var(--tone)" }}>
            {healthy ? "All systems operational" : "Reconnecting — showing last known state"}
          </div>
        </div>
      </div>
    </section>
  );
});
