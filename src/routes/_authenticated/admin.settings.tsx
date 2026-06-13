import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Shield, Globe, Mail, Database, KeyRound, ExternalLink, Wrench, Building2 } from "lucide-react";
import { MaintenanceScheduler } from "@/components/MaintenanceScheduler";
import { MaintenanceBanner } from "@/components/MaintenanceBanner";
import { getPlatformMaintenance } from "@/lib/platform.functions";
import { listAllCafes } from "@/lib/admin.functions";
import { isMaintenanceActive, maintenanceCountdown } from "@/lib/maintenance";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";


export const Route = createFileRoute("/_authenticated/admin/settings")({
  component: SettingsPanel,
});

function SettingsPanel() {
  const fn = useServerFn(getPlatformMaintenance);
  const cafesFn = useServerFn(listAllCafes);
  const { data, refetch } = useQuery({ queryKey: ["platform-maintenance"], queryFn: () => fn() });
  const { data: cafes } = useQuery({ queryKey: ["admin-cafes"], queryFn: () => cafesFn() });
  const [selectedCafeId, setSelectedCafeId] = useState<string>("");
  const active = isMaintenanceActive(data);
  const countdown = maintenanceCountdown(data);

  const selectedCafe = useMemo(
    () => (cafes ?? []).find((c) => c.id === selectedCafeId) ?? null,
    [cafes, selectedCafeId],
  );
  const selectedCafeWindow = selectedCafe
    ? {
        starts_at: selectedCafe.maintenance_starts_at ?? null,
        ends_at: selectedCafe.maintenance_ends_at ?? null,
        message: selectedCafe.maintenance_message ?? null,
        title: null,
      }
    : null;
  const selectedActive = isMaintenanceActive(selectedCafeWindow);


  const sections = [
    { icon: Shield, title: "Security", desc: "Roles, super-admin grants, audit log.", to: "/admin/users" as const, cta: "Manage roles" },
    { icon: Globe, title: "Public landing", desc: "Hero stats, testimonials and the marketing page.", to: "/" as const, cta: "View landing" },
    { icon: Mail, title: "Lead inbox", desc: "Inbound contacts from the marketing site.", to: "/admin/leads" as const, cta: "Open inbox" },
    { icon: Database, title: "Data & backups", desc: "Database snapshots and exports — coming soon.", cta: "Coming soon" },
    { icon: KeyRound, title: "API keys", desc: "Issue and rotate API tokens — coming soon.", cta: "Coming soon" },
  ];

  return (
    <div className="space-y-6">
      <MaintenanceBanner window={data} />

      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-card/60 to-rose-500/10 p-5 backdrop-blur"
      >
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-amber-500/20 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Wrench className="h-4 w-4 text-amber-300" />
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-amber-300">Network-wide maintenance</div>
            </div>
            <h3 className="mt-1 font-display text-xl font-bold">
              {active ? "Maintenance scheduled" : "Schedule a maintenance window"}
            </h3>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              When active, every café public page and the portal show a banner with your message.
              You can also schedule it in advance — it activates automatically.
            </p>
            {active && (
              <div className="mt-2 text-xs">
                <div className="font-mono text-amber-200">{countdown}</div>
                {data?.title && <div className="mt-1 font-medium">{data.title}</div>}
                {data?.message && <div className="text-muted-foreground">{data.message}</div>}
              </div>
            )}
          </div>
          <MaintenanceScheduler
            scope={{ kind: "platform" }}
            current={data ?? null}
            onSaved={() => refetch()}
            trigger={
              <Button className="gap-2" style={{ background: "var(--gradient-brand-hot)" }}>
                <Wrench className="h-4 w-4" />
                {active ? "Edit schedule" : "Schedule maintenance"}
              </Button>
            }
          />
        </div>
      </motion.div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {sections.map((s, i) => (
          <motion.div
            key={s.title}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/40 p-5 backdrop-blur hover-lift"
          >
            <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-violet/20 blur-2xl" />
            <s.icon className="relative h-5 w-5 text-primary" />
            <h3 className="relative mt-3 font-display text-lg font-bold">{s.title}</h3>
            <p className="relative mt-1 text-sm text-muted-foreground">{s.desc}</p>
            <div className="relative mt-4">
              {s.to ? (
                <Link to={s.to} className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">
                  {s.cta} <ExternalLink className="h-3 w-3" />
                </Link>
              ) : (
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{s.cta}</span>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
