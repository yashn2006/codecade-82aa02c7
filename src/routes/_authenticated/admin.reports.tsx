import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useMemo } from "react";
import { Download, TrendingUp, Building2, Activity } from "lucide-react";
import { getNetworkReports } from "@/lib/reports.functions";
import { Sparkline } from "@/components/Sparkline";
import { Button } from "@/components/ui/button";
import { downloadCsv } from "@/lib/csv";

export const Route = createFileRoute("/_authenticated/admin/reports")({
  head: () => ({ meta: [{ title: "Network Reports — CoreCade" }] }),
  component: AdminReports,
});

function AdminReports() {
  const fn = useServerFn(getNetworkReports);
  const [range, setRange] = useState<"7d" | "30d" | "90d">("30d");
  const { from, to } = useMemo(() => {
    const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
    return { from: new Date(Date.now() - days * 86400_000).toISOString(), to: new Date().toISOString() };
  }, [range]);
  const { data } = useQuery({ queryKey: ["network-reports", range], queryFn: () => fn({ data: { from, to } }) });

  if (!data) return <div className="h-40 animate-pulse rounded-2xl border border-border/40 bg-card/30" />;

  const exportCafes = () => downloadCsv(`network-cafes-${range}.csv`, data.topCafes.map((c) => ({
    cafe: c.name, slug: c.slug, city: c.city ?? "", sessions: c.sessions, revenue: c.revenue,
  })));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Platform reports</div>
          <h1 className="font-display text-2xl font-black">Network performance</h1>
        </div>
        <div className="flex gap-2">
          {(["7d", "30d", "90d"] as const).map((r) => (
            <Button key={r} size="sm" variant={range === r ? "default" : "outline"} onClick={() => setRange(r)}>{r}</Button>
          ))}
          <Button size="sm" variant="outline" onClick={exportCafes} className="gap-1.5"><Download className="h-3.5 w-3.5" /> CSV</Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={TrendingUp} label="GMV" value={`₹${data.totalRevenue.toLocaleString("en-IN")}`} />
        <Stat icon={Activity} label="Sessions" value={data.sessionCount} />
        <Stat icon={Building2} label="Cafés" value={data.cafeCount} />
        <Stat icon={TrendingUp} label="Sessions revenue" value={`₹${data.breakdown.sessions.toLocaleString("en-IN")}`} />
      </div>

      <div className="rounded-2xl border border-border/60 bg-card/40 p-5 backdrop-blur">
        <div className="font-display text-lg font-bold">Daily revenue</div>
        <div className="mt-3"><Sparkline data={data.dailySeries} accent="violet" height={120} /></div>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card/40 p-5 backdrop-blur">
        <div className="font-display text-lg font-bold">Top cafés</div>
        <table className="mt-3 w-full text-sm">
          <thead className="text-left text-xs uppercase text-muted-foreground"><tr><th className="py-2">Café</th><th>City</th><th>Sessions</th><th className="text-right">Revenue</th></tr></thead>
          <tbody>{data.topCafes.map((c, i) => (
            <tr key={i} className="border-t border-border/40">
              <td className="py-2 font-medium">{c.name}</td>
              <td className="text-muted-foreground">{c.city ?? "—"}</td>
              <td>{c.sessions}</td>
              <td className="text-right font-mono text-gold">₹{c.revenue.toLocaleString("en-IN")}</td>
            </tr>
          ))}</tbody>
        </table>
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
