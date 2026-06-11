import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { TrendingUp, Building2, Activity, IndianRupee } from "lucide-react";
import { motion } from "framer-motion";
import { platformRevenueAnalytics } from "@/lib/admin.functions";
import { StatCard } from "@/components/StatCard";
import { Sparkline } from "@/components/Sparkline";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/admin/revenue")({
  head: () => ({
    meta: [
      { title: "Revenue analytics — CoreCade admin" },
      { name: "description", content: "Network-wide revenue, top cafés, and daily breakdown." },
    ],
  }),
  component: AdminRevenue,
});

function AdminRevenue() {
  const fn = useServerFn(platformRevenueAnalytics);
  const q = useQuery({ queryKey: ["admin-revenue"], queryFn: () => fn(), refetchInterval: 60_000 });
  const d = q.data;

  return (
    <div className="space-y-6">
      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Last 30 days · platform-wide</div>
        <h2 className="font-display text-3xl font-extrabold">Revenue analytics</h2>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={IndianRupee} label="Total revenue" value={d?.totalRevenue ?? 0} accent="magenta" delay={0} hint="₹" />
        <StatCard icon={Activity} label="Sessions" value={d?.totalSessions ?? 0} accent="azure" delay={0.05} />
        <StatCard icon={TrendingUp} label="Orders" value={d?.totalOrders ?? 0} accent="violet" delay={0.1} />
        <StatCard icon={Building2} label="Active cafés" value={d?.topCafes.length ?? 0} accent="violet" delay={0.15} />
      </div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-border/60 bg-card/40 p-5 backdrop-blur">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Daily revenue · last 30 days</div>
            <div className="font-display text-xl font-bold">Trend</div>
          </div>
          <Badge variant="outline">{d?.daily.length ?? 0} days</Badge>
        </div>
        {(d?.daily.length ?? 0) === 0
          ? <div className="grid h-40 place-items-center text-sm text-muted-foreground">No data yet</div>
          : <Sparkline data={d!.daily.map((x) => x.revenue)} className="h-40 w-full" />}
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-border/60 bg-card/40 p-5 backdrop-blur">
        <div className="mb-3 font-display text-xl font-bold">Top cafés by revenue</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr><th className="py-2">Café</th><th>City</th><th>Sessions</th><th>Orders</th><th className="text-right">Revenue</th></tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {(d?.topCafes ?? []).map((c, i) => (
                <tr key={c.cafe_id} className="hover:bg-accent/30">
                  <td className="py-2.5 font-medium">{i + 1}. {c.name}</td>
                  <td className="text-muted-foreground">{c.city ?? "—"}</td>
                  <td className="font-mono">{c.sessions}</td>
                  <td className="font-mono">{c.orders}</td>
                  <td className="text-right font-display font-bold text-gradient">₹{c.revenue.toLocaleString("en-IN")}</td>
                </tr>
              ))}
              {(d?.topCafes ?? []).length === 0 && (
                <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">No revenue activity in the last 30 days.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
