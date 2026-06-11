import { createFileRoute, Outlet, Link } from "@tanstack/react-router";
import { Activity, Cpu, CalendarRange, Users, Settings, ScrollText, Wallet, Crown, Receipt, Globe, LayoutGrid, AlertOctagon, Mail, UtensilsCrossed, Wrench } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { ConsoleShell } from "@/components/ConsoleShell";
import { getCafeBySlug } from "@/lib/cafes.functions";
import { getPlatformMaintenance } from "@/lib/platform.functions";
import { MaintenanceScheduler } from "@/components/MaintenanceScheduler";
import { MaintenanceBanner } from "@/components/MaintenanceBanner";
import { isMaintenanceActive } from "@/lib/maintenance";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/cafe/$slug")({
  head: () => ({ meta: [{ title: "Café Console — CoreCade" }] }),
  component: CafeLayout,
});

function CafeLayout() {
  const { slug } = Route.useParams();
  const fn = useServerFn(getCafeBySlug);
  const platFn = useServerFn(getPlatformMaintenance);
  const { data: cafe, refetch } = useQuery({
    queryKey: ["cafe", slug],
    queryFn: () => fn({ data: { slug } }),
  });
  const { data: platform } = useQuery({
    queryKey: ["platform-maintenance"], queryFn: () => platFn(), refetchInterval: 60_000,
  });

  const restricted = !!(cafe as { restricted_message?: string | null } | undefined)?.restricted_message;
  const cafeMaint = cafe ? {
    starts_at: (cafe as { maintenance_starts_at?: string | null }).maintenance_starts_at ?? null,
    ends_at: (cafe as { maintenance_ends_at?: string | null }).maintenance_ends_at ?? null,
    message: (cafe as { maintenance_message?: string | null }).maintenance_message ?? null,
  } : null;
  const cafeInMaint = isMaintenanceActive(cafeMaint);

  return (
    <ConsoleShell
      badge="Café Console"
      title={cafe?.name ?? "Café"}
      subtitle={cafe ? `${cafe.city ?? ""}${cafe.city ? " · " : ""}/${cafe.slug}` : "Loading workspace…"}
      intensity="immersive"
      nav={[
        { label: "Live floor", icon: Activity, to: "/cafe/$slug", params: { slug }, exact: true },
        { label: "Floor builder", icon: LayoutGrid, to: "/cafe/$slug/floor", params: { slug } },
        { label: "Menu", icon: UtensilsCrossed, to: "/cafe/$slug/menu", params: { slug } },
        { label: "POS counter", icon: Receipt, to: "/cafe/$slug/pos", params: { slug } },
        { label: "Devices", icon: Cpu, to: "/cafe/$slug/devices", params: { slug } },
        { label: "Bookings", icon: CalendarRange, to: "/cafe/$slug/bookings", params: { slug } },
        { label: "Customers", icon: Users, to: "/cafe/$slug/customers", params: { slug } },
        { label: "Wallet", icon: Wallet, to: "/cafe/$slug/wallet", params: { slug } },
        { label: "Memberships", icon: Crown, to: "/cafe/$slug/memberships", params: { slug } },
        { label: "Ledger", icon: ScrollText, to: "/cafe/$slug/ledger", params: { slug } },
        { label: "Public page", icon: Globe, to: "/cafe/$slug/page", params: { slug } },
        { label: "Staff", icon: Settings, to: "/cafe/$slug/staff", params: { slug } },
      ]}
    >
      <div className="mb-4 space-y-3">
        <MaintenanceBanner window={platform} title="CoreCade network maintenance" />
        {cafe && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card/30 px-4 py-2.5 backdrop-blur">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Wrench className={`h-3.5 w-3.5 ${cafeInMaint ? "text-amber-300" : ""}`} />
              {cafeInMaint
                ? <span className="text-amber-200">Maintenance active — public bookings paused.</span>
                : <span>Need to pause for an hour? Schedule maintenance so customers see why.</span>}
            </div>
            <MaintenanceScheduler
              scope={{ kind: "cafe", cafeId: (cafe as { id: string }).id, cafeName: cafe.name }}
              current={cafeMaint}
              onSaved={() => refetch()}
              trigger={
                <Button size="sm" variant={cafeInMaint ? "destructive" : "outline"} className="gap-1.5">
                  <Wrench className="h-3.5 w-3.5" />
                  {cafeInMaint ? "Edit maintenance" : "Schedule maintenance"}
                </Button>
              }
            />
          </div>
        )}
      </div>
      {restricted ? <RestrictedOverlay message={(cafe as { restricted_message?: string }).restricted_message ?? ""} /> : null}
      <div className={restricted ? "pointer-events-none select-none opacity-30 blur-[2px]" : ""} aria-hidden={restricted}>
        <Outlet />
      </div>
    </ConsoleShell>
  );
}

function RestrictedOverlay({ message }: { message: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6 overflow-hidden rounded-3xl border border-destructive/40 bg-gradient-to-br from-destructive/20 via-card to-rose/10 p-6 shadow-pop"
    >
      <div className="flex items-start gap-4">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-destructive/20 text-destructive">
          <AlertOctagon className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-destructive">
            Service restricted by CoreCade admin
          </div>
          <h2 className="mt-1 font-display text-xl font-extrabold tracking-tight sm:text-2xl">
            Your café console has been temporarily suspended
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-foreground/80">
            {message}
          </p>
          <Link
            to="/portal"
            className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/40 px-3 py-1.5 text-xs text-foreground transition hover:border-primary/40"
          >
            <Mail className="h-3 w-3" /> Contact support to resolve
          </Link>
        </div>
      </div>
    </motion.div>
  );
}
