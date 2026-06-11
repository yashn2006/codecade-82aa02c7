import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { Shield, Users, Building2, FileText, Activity, TrendingUp, ArrowUpRight } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { EmptyState } from "@/components/EmptyState";
import { Sparkline } from "@/components/Sparkline";
import { Badge } from "@/components/ui/badge";
import { adminOverview } from "@/lib/admin.functions";
import { getNetworkAnalytics } from "@/lib/analytics.functions";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: OverviewPanel,
});

function OverviewPanel() {
  const ovFn = useServerFn(adminOverview);
  const anFn = useServerFn(getNetworkAnalytics);
  const ov = useQuery({ queryKey: ["admin-overview"], queryFn: () => ovFn(), refetchInterval: 15000 });
  const an = useQuery({ queryKey: ["admin-analytics"], queryFn: () => anFn(), refetchInterval: 15000 });
  const s = ov.data ?? { cafes: 0, users: 0, activeSessions: 0, newLeads: 0 };
  const a = an.data;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Building2} label="Cafés" value={s.cafes} accent="violet" delay={0} />
        <StatCard icon={Users} label="Users" value={s.users} accent="azure" delay={0.05} />
        <StatCard icon={Activity} label="Active sessions" value={s.activeSessions} accent="magenta" delay={0.1} hint="Live" />
        <StatCard icon={FileText} label="New leads" value={s.newLeads} accent="violet" delay={0.15} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/40 p-5 backdrop-blur">
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-violet/30 blur-3xl" />
          <div className="relative flex items-start justify-between">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Network pulse · last 7 days</div>
              <div className="font-display text-2xl font-extrabold">Revenue trend</div>
            </div>
            <div className="text-right">
              <div className="flex items-center justify-end gap-1 font-mono text-[10px] text-azure"><TrendingUp className="h-3 w-3" /> TODAY</div>
              <div className="font-display text-2xl font-extrabold text-gradient">₹{(a?.revenueToday ?? 0).toLocaleString("en-IN")}</div>
              <div className="font-mono text-[10px] text-muted-foreground">{a?.sessionsToday ?? 0} sessions</div>
            </div>
          </div>
          <div className="relative mt-4">
            <Sparkline data={a?.weekSeries ?? []} accent="violet" height={96} />
          </div>
          <div className="relative mt-1 flex justify-between font-mono text-[10px] text-muted-foreground">
            {(a?.weekSeries ?? []).map((p) => (
              <span key={p.d}>{new Date(p.d).toLocaleDateString("en-IN", { weekday: "short" })}</span>
            ))}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="rounded-2xl border border-border/60 bg-card/40 p-5 backdrop-blur">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Newest cafés</div>
          <div className="mt-1 font-display text-xl font-bold">On the network</div>
          <div className="mt-3 space-y-1.5">
            {(a?.newCafes ?? []).length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/40 p-6 text-center text-xs text-muted-foreground">No cafés yet.</div>
            ) : (a?.newCafes ?? []).map((c) => (
              <Link key={c.id} to="/cafe/$slug" params={{ slug: c.slug }} className="flex items-center justify-between rounded-xl border border-border/40 px-3 py-2 text-sm transition hover:border-primary/40 hover:bg-background/40">
                <div>
                  <div className="font-medium">{c.name}</div>
                  <div className="font-mono text-[10px] text-muted-foreground">{c.city ?? "—"} · /{c.slug}</div>
                </div>
                <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
              </Link>
            ))}
          </div>
        </motion.div>
      </div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <div className="flex items-center justify-between">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Live feed</div>
            <h3 className="font-display text-xl font-bold">Recent sessions across the network</h3>
          </div>
        </div>
        <div className="mt-3 overflow-hidden rounded-2xl border border-border/60 bg-card/30 backdrop-blur">
          {(a?.recent ?? []).length === 0 ? (
            <EmptyState icon={Activity} title="No sessions yet" description="When cafés go live, you'll see their pulse here." />
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-border/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr><th className="p-3">When</th><th className="p-3">Café</th><th className="p-3">Device</th><th className="p-3">Customer</th><th className="p-3 text-right">Amount</th><th className="p-3">Status</th></tr>
              </thead>
              <tbody>
                {(a?.recent ?? []).map((sess, i) => (
                  <motion.tr key={sess.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }} className="border-b border-border/30 last:border-0">
                    <td className="p-3 font-mono text-xs text-azure">{new Date(sess.started_at).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                    <td className="p-3">{(sess.cafes as { name?: string } | null)?.name ?? "—"}</td>
                    <td className="p-3 font-mono text-xs">{(sess.devices as { name?: string } | null)?.name ?? "—"}</td>
                    <td className="p-3">{(sess.customers as { full_name?: string } | null)?.full_name ?? "Walk-in"}</td>
                    <td className="p-3 text-right font-mono">{sess.amount != null ? `₹${sess.amount}` : "—"}</td>
                    <td className="p-3"><Badge variant={sess.status === "active" ? "default" : "outline"}>{sess.status}</Badge></td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </motion.div>

      {/* Quick links */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { to: "/admin/cafes", icon: Building2, label: "Manage cafés", desc: "Onboard, suspend or restrict" },
          { to: "/admin/users", icon: Users, label: "Users & roles", desc: "Grant or revoke access" },
          { to: "/admin/leads", icon: FileText, label: "Leads inbox", desc: "Reply to interest forms" },
          { to: "/admin/settings", icon: Shield, label: "Platform settings", desc: "Networks-wide config" },
        ].map((q) => (
          <Link key={q.to} to={q.to} className="group rounded-2xl border border-border/60 bg-card/40 p-4 backdrop-blur transition hover:border-primary/40 hover:bg-card/60">
            <q.icon className="h-5 w-5 text-primary" />
            <div className="mt-2 font-display text-sm font-bold">{q.label}</div>
            <div className="text-xs text-muted-foreground">{q.desc}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
