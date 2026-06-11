import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ScrollText, TrendingUp, Clock, Activity } from "lucide-react";
import { motion } from "framer-motion";
import { getCafeBySlug } from "@/lib/cafes.functions";
import { getCafeAnalytics } from "@/lib/analytics.functions";
import { Sparkline } from "@/components/Sparkline";
import { EmptyState } from "@/components/EmptyState";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/cafe/$slug/ledger")({
  head: () => ({
    meta: [
      { title: "Ledger — CoreCade" },
      { name: "description", content: "Every cash, UPI and card movement, fully auditable." },
      { property: "og:title", content: "Ledger — CoreCade" },
      { property: "og:description", content: "Every cash, UPI and card movement, fully auditable." },
    ],
  }),
  component: LedgerPage,
});

function LedgerPage() {
  const { slug } = Route.useParams();
  const getCafe = useServerFn(getCafeBySlug);
  const { data: cafe } = useQuery({ queryKey: ["cafe", slug], queryFn: () => getCafe({ data: { slug } }) });
  const cafeId = cafe?.id;
  const fn = useServerFn(getCafeAnalytics);
  const { data } = useQuery({
    queryKey: ["analytics", cafeId],
    queryFn: () => fn({ data: { cafe_id: cafeId! } }),
    enabled: !!cafeId,
    refetchInterval: 15000,
  });

  if (!cafeId || !data) return <div className="h-40 animate-pulse rounded-2xl border border-border/40 bg-card/30" />;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile icon={TrendingUp} label="Revenue today" value={`₹${data.revenueToday.toLocaleString("en-IN")}`} accent="violet" />
        <StatTile icon={Activity} label="Sessions today" value={data.sessionsToday} accent="magenta" />
        <StatTile icon={Clock} label="Minutes played" value={data.minutesToday} accent="azure" />
        <StatTile icon={Activity} label="Active now" value={data.activeSessions} accent="magenta" hint="Live" />
      </div>

      <div className="rounded-2xl border border-border/60 bg-card/40 p-5 backdrop-blur">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Last 7 days</div>
            <div className="font-display text-xl font-bold">Revenue trend</div>
          </div>
          <div className="text-right">
            <div className="font-mono text-[10px] uppercase text-muted-foreground">Weekly</div>
            <div className="font-display text-lg font-bold text-gradient">₹{data.weekSeries.reduce((s, p) => s + p.v, 0).toLocaleString("en-IN")}</div>
          </div>
        </div>
        <div className="mt-4"><Sparkline data={data.weekSeries} accent="violet" height={84} /></div>
        <div className="mt-1 flex justify-between font-mono text-[10px] text-muted-foreground">
          {data.weekSeries.map((p) => (
            <span key={p.d}>{new Date(p.d).toLocaleDateString("en-IN", { weekday: "short" })}</span>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2">
          <ScrollText className="h-4 w-4 text-azure" />
          <h3 className="font-display text-lg font-bold">Recent sessions</h3>
        </div>
        <div className="mt-3 overflow-hidden rounded-2xl border border-border/60 bg-card/30 backdrop-blur">
          {data.recent.length === 0 ? (
            <EmptyState icon={ScrollText} title="No sessions yet" description="Start a session on the live floor to populate the ledger." />
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-border/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr><th className="p-3">When</th><th className="p-3">Customer</th><th className="p-3">Device</th><th className="p-3">Duration</th><th className="p-3 text-right">Amount</th><th className="p-3">Status</th></tr>
              </thead>
              <tbody>
                {data.recent.map((s, i) => (
                  <motion.tr key={s.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }} className="border-b border-border/30 last:border-0">
                    <td className="p-3 font-mono text-xs text-azure">{new Date(s.started_at).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                    <td className="p-3">{(s.customers as { full_name?: string } | null)?.full_name ?? "Walk-in"}</td>
                    <td className="p-3 font-mono text-xs">{(s.devices as { name?: string; type?: string } | null)?.name ?? "—"}</td>
                    <td className="p-3 font-mono text-xs">{s.duration_minutes ?? "—"}m</td>
                    <td className="p-3 text-right font-mono">{s.amount != null ? `₹${s.amount}` : "—"}</td>
                    <td className="p-3"><Badge variant={s.status === "active" ? "default" : "outline"}>{s.status}</Badge></td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function StatTile({ icon: Icon, label, value, accent, hint }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number | string; accent: "violet" | "azure" | "magenta"; hint?: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/40 p-5 backdrop-blur">
      <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full blur-2xl opacity-50" style={{ background: `oklch(var(--${accent}) / 0.5)` }} />
      <div className="relative flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
        </div>
        {hint && <span className="font-mono text-[10px] text-magenta">{hint}</span>}
      </div>
      <div className="relative mt-2 font-display text-3xl font-extrabold">{value}</div>
    </div>
  );
}
