import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useMemo } from "react";
import { Download, TrendingUp, Calendar, Activity, Users } from "lucide-react";
import { getCafeBySlug } from "@/lib/cafes.functions";
import { getCafeReports } from "@/lib/reports.functions";
import { Sparkline } from "@/components/Sparkline";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/EmptyState";
import { downloadCsv } from "@/lib/csv";

export const Route = createFileRoute("/_authenticated/cafe/$slug/reports")({
  head: () => ({ meta: [{ title: "Reports — CoreCade" }] }),
  component: ReportsPage,
});

function ReportsPage() {
  const { slug } = Route.useParams();
  const getCafe = useServerFn(getCafeBySlug);
  const getReports = useServerFn(getCafeReports);
  const { data: cafe } = useQuery({ queryKey: ["cafe", slug], queryFn: () => getCafe({ data: { slug } }) });

  const [range, setRange] = useState<"7d" | "30d" | "90d">("30d");
  const { from, to } = useMemo(() => {
    const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
    const to = new Date();
    const from = new Date(Date.now() - days * 86400_000);
    return { from: from.toISOString(), to: to.toISOString() };
  }, [range]);

  const cafeId = cafe?.id as string | undefined;
  const { data } = useQuery({
    queryKey: ["reports", cafeId, range],
    queryFn: () => getReports({ data: { cafe_id: cafeId!, from, to } }),
    enabled: !!cafeId,
  });

  if (!cafeId || !data) return <div className="h-40 animate-pulse rounded-2xl border border-border/40 bg-card/30" />;

  const exportSessions = () => {
    downloadCsv(`${slug}-sessions-${range}.csv`, data.sessionsRaw.map((s: any) => ({
      started_at: s.started_at,
      ended_at: s.ended_at,
      customer: s.customers?.full_name ?? "",
      device: s.devices?.name ?? "",
      type: s.devices?.type ?? "",
      duration_minutes: s.duration_minutes ?? 0,
      amount: s.amount ?? 0,
    })));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Reports</div>
          <h1 className="font-display text-2xl font-black">Performance &amp; revenue</h1>
        </div>
        <div className="flex gap-2">
          {(["7d", "30d", "90d"] as const).map((r) => (
            <Button key={r} size="sm" variant={range === r ? "default" : "outline"} onClick={() => setRange(r)}>
              {r}
            </Button>
          ))}
          <Button size="sm" variant="outline" onClick={exportSessions} className="gap-1.5">
            <Download className="h-3.5 w-3.5" /> CSV
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={TrendingUp} label="Total revenue" value={`₹${data.totalRevenue.toLocaleString("en-IN")}`} />
        <Stat icon={Activity} label="Sessions" value={data.sessionCount} />
        <Stat icon={Calendar} label="F&B" value={`₹${data.breakdown.fnb.toLocaleString("en-IN")}`} />
        <Stat icon={Users} label="Memberships" value={`₹${data.breakdown.memberships.toLocaleString("en-IN")}`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-border/60 bg-card/40 p-5 backdrop-blur lg:col-span-2">
          <div className="font-display text-lg font-bold">Revenue trend</div>
          <div className="mt-3"><Sparkline data={data.dailySeries} accent="violet" height={100} /></div>
        </div>
        <div className="rounded-2xl border border-border/60 bg-card/40 p-5 backdrop-blur">
          <div className="font-display text-lg font-bold">Revenue mix</div>
          <div className="mt-3 space-y-2 text-sm">
            <Row label="Sessions" value={data.breakdown.sessions} total={data.totalRevenue} color="bg-primary" />
            <Row label="F&B" value={data.breakdown.fnb} total={data.totalRevenue} color="bg-gold" />
            <Row label="Memberships" value={data.breakdown.memberships} total={data.totalRevenue} color="bg-azure" />
            <Row label="Tournaments" value={data.breakdown.tournaments} total={data.totalRevenue} color="bg-magenta" />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card/40 p-5 backdrop-blur">
        <div className="flex items-center justify-between">
          <div className="font-display text-lg font-bold">Peak-hour heatmap</div>
          <div className="text-xs text-muted-foreground">Sessions by day × hour</div>
        </div>
        <div className="mt-4 overflow-x-auto">
          <Heatmap data={data.heatmap} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border/60 bg-card/40 p-5 backdrop-blur">
          <div className="font-display text-lg font-bold">Top devices</div>
          {data.topDevices.length === 0 ? (
            <EmptyState icon={Activity} title="No device activity" />
          ) : (
            <table className="mt-3 w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground"><tr><th className="py-2">Device</th><th>Sessions</th><th className="text-right">Revenue</th></tr></thead>
              <tbody>{data.topDevices.map((d, i) => (
                <tr key={i} className="border-t border-border/40"><td className="py-2">{d.name} <span className="text-muted-foreground">· {d.type}</span></td><td>{d.sessions}</td><td className="text-right font-mono text-gold">₹{d.revenue.toLocaleString("en-IN")}</td></tr>
              ))}</tbody>
            </table>
          )}
        </div>
        <div className="rounded-2xl border border-border/60 bg-card/40 p-5 backdrop-blur">
          <div className="font-display text-lg font-bold">Top customers</div>
          {data.topCustomers.length === 0 ? (
            <EmptyState icon={Users} title="No customers yet" />
          ) : (
            <table className="mt-3 w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground"><tr><th className="py-2">Name</th><th>Sessions</th><th className="text-right">Spent</th></tr></thead>
              <tbody>{data.topCustomers.map((c: any, i: number) => (
                <tr key={i} className="border-t border-border/40"><td className="py-2">{c.full_name}</td><td>{c.total_sessions ?? 0}</td><td className="text-right font-mono text-gold">₹{(c.total_spent ?? 0).toLocaleString("en-IN")}</td></tr>
              ))}</tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/40 p-4 backdrop-blur">
      <div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className="h-3.5 w-3.5" />{label}</div>
      <div className="mt-2 font-display text-2xl font-black text-gradient">{value}</div>
    </div>
  );
}

function Row({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div>
      <div className="flex justify-between text-xs"><span>{label}</span><span className="font-mono">₹{value.toLocaleString("en-IN")} · {pct.toFixed(0)}%</span></div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary"><div className={`h-full ${color}`} style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

function Heatmap({ data }: { data: number[][] }) {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const max = Math.max(1, ...data.flat());
  return (
    <div className="min-w-[600px]">
      <div className="ml-10 grid grid-cols-24 gap-0.5 text-[9px] text-muted-foreground" style={{ gridTemplateColumns: "repeat(24, minmax(0, 1fr))" }}>
        {Array.from({ length: 24 }).map((_, h) => <div key={h} className="text-center">{h}</div>)}
      </div>
      {data.map((row, di) => (
        <div key={di} className="mt-0.5 flex items-center gap-1">
          <div className="w-10 text-xs text-muted-foreground">{days[di]}</div>
          <div className="grid flex-1 gap-0.5" style={{ gridTemplateColumns: "repeat(24, minmax(0, 1fr))" }}>
            {row.map((v, hi) => (
              <div key={hi} className="aspect-square rounded-sm" style={{ background: `oklch(0.7 0.26 335 / ${0.08 + (v / max) * 0.85})` }} title={`${days[di]} ${hi}:00 · ${v} sessions`} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
