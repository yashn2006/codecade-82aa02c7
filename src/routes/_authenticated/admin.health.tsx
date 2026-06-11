import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import {
  Activity, Building2, Cpu, Users, ShoppingBag, CalendarClock,
  Bell, ScrollText, FileText, Pause, CircleDot,
} from "lucide-react";
import { systemHealth } from "@/lib/admin.functions";
import { StatCard } from "@/components/StatCard";

export const Route = createFileRoute("/_authenticated/admin/health")({
  head: () => ({
    meta: [
      { title: "System health — CoreCade admin" },
      { name: "description", content: "Live platform health: cafés, devices, sessions, users and 24-hour activity deltas." },
    ],
  }),
  component: HealthPanel,
});

function HealthPanel() {
  const fn = useServerFn(systemHealth);
  const q = useQuery({ queryKey: ["admin-health"], queryFn: () => fn(), refetchInterval: 15_000 });
  const d = q.data;

  return (
    <div className="space-y-6">
      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Real-time · refreshes every 15s</div>
        <h2 className="font-display text-3xl font-extrabold">System health</h2>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Activity} label="Active sessions" value={d?.sessionsActive ?? 0} accent="magenta" hint="live" />
        <StatCard icon={CircleDot} label="Cafés live" value={d?.cafesActive ?? 0} accent="violet" delay={0.05} />
        <StatCard icon={Pause} label="Cafés paused" value={d?.cafesPaused ?? 0} accent="azure" delay={0.1} />
        <StatCard icon={Cpu} label="Devices on network" value={d?.devices ?? 0} accent="violet" delay={0.15} />
      </div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-border/60 bg-card/40 p-5 backdrop-blur">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Last 24 hours</div>
        <div className="mt-1 font-display text-xl font-bold">Activity pulse</div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Row icon={Activity} label="Sessions started" value={d?.sessions24 ?? 0} />
          <Row icon={ShoppingBag} label="Orders" value={d?.orders24 ?? 0} />
          <Row icon={CalendarClock} label="Bookings" value={d?.bookings24 ?? 0} />
          <Row icon={Users} label="New users" value={d?.users24 ?? 0} />
          <Row icon={Bell} label="Notifications sent" value={d?.notifications24 ?? 0} />
          <Row icon={ScrollText} label="Audit events" value={d?.audit24 ?? 0} />
          <Row icon={FileText} label="New leads (open)" value={d?.leadsNew ?? 0} />
          <Row icon={Building2} label="Total cafés" value={d?.cafes ?? 0} />
        </div>
      </motion.div>
    </div>
  );
}

function Row({ icon: Icon, label, value }: { icon: typeof Activity; label: string; value: number }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border/40 bg-background/40 px-3 py-2.5">
      <div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className="h-3.5 w-3.5" /> {label}</div>
      <div className="font-display text-lg font-bold">{value.toLocaleString("en-IN")}</div>
    </div>
  );
}
