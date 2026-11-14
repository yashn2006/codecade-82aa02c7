import { createFileRoute, Outlet, Link } from "@tanstack/react-router";
import { Activity, CalendarRange, Users, Settings, ScrollText, Wallet, Crown, Receipt, Globe, LayoutGrid, AlertOctagon, Mail, UtensilsCrossed, Wrench, LineChart, Trophy, History, BarChart3, LifeBuoy } from "lucide-react";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { ConsoleShell } from "@/components/ConsoleShell";
import { getCafeBySlug } from "@/lib/cafes.functions";
import { listDevices } from "@/lib/devices.functions";
import { listBookings } from "@/lib/bookings.functions";
import { listCafeCustomerTickets } from "@/lib/tickets.functions";
import { getPlatformMaintenance } from "@/lib/platform.functions";
import { MaintenanceScheduler } from "@/components/MaintenanceScheduler";
import { MaintenanceBanner } from "@/components/MaintenanceBanner";
import { TrialBanner } from "@/components/TrialBanner";
import { isMaintenanceActive } from "@/lib/maintenance";
import { Button } from "@/components/ui/button";
import { DeleteCafeButton } from "@/components/DeleteCafeButton";
import { OwnerInbox } from "@/components/OwnerInbox";
import { OwnerMessageAdmin } from "@/components/OwnerMessageAdmin";
import { LogRevenueButton } from "@/components/LogRevenueButton";

export const Route = createFileRoute("/_authenticated/cafe/$slug")({
  head: () => ({
    meta: [
      { title: "Café Console — CoreCade" },
      { name: "description", content: "Your CoreCade café command center." },
      { property: "og:title", content: "Café Console — CoreCade" },
      { property: "og:description", content: "Your CoreCade café command center." },
    ],
  }),
  component: CafeLayout,
});

function CafeLayout() {
  const { slug } = Route.useParams();
  const qc = useQueryClient();
  const fn = useServerFn(getCafeBySlug);
  const platFn = useServerFn(getPlatformMaintenance);
  const devicesFn = useServerFn(listDevices);
  const bookingsFn = useServerFn(listBookings);
  const supportFn = useServerFn(listCafeCustomerTickets);

  const { data: cafe, refetch } = useQuery({
    queryKey: ["cafe", slug],
    queryFn: () => fn({ data: { slug } }),
  });
  const { data: platform } = useQuery({
    queryKey: ["platform-maintenance"], queryFn: () => platFn(), refetchInterval: 60_000,
  });

  const cafeId = (cafe as { id?: string } | undefined)?.id;
  useEffect(() => {
    if (!cafeId) return;
    void qc.prefetchQuery({ queryKey: ["devices", cafeId], queryFn: () => devicesFn({ data: { cafe_id: cafeId } }) });
    void qc.prefetchQuery({ queryKey: ["bookings", cafeId], queryFn: () => bookingsFn({ data: { cafe_id: cafeId } }) });
    void qc.prefetchQuery({ queryKey: ["cafe-customer-tickets", cafeId], queryFn: () => supportFn({ data: { cafe_id: cafeId } }) });
  }, [cafeId, qc, devicesFn, bookingsFn, supportFn]);

  const restricted = !!(cafe as { restricted_message?: string | null } | undefined)?.restricted_message;
  const sub = (cafe as { subscription_status?: string | null; trial_ends_at?: string | null } | undefined);
  const trialEnded = !!(sub?.trial_ends_at && new Date(sub.trial_ends_at).getTime() < Date.now() && sub?.subscription_status !== "active");
  const locked = restricted || trialEnded;
  const lockMessage = restricted
    ? ((cafe as { restricted_message?: string }).restricted_message ?? "")
    : "Your free trial has ended. Renew your subscription to continue managing this café.";
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
      subtitle={cafe ? `/${cafe.slug}` : "Loading workspace…"}
      intensity="immersive"
      banner={<TrialBanner cafe={cafe as { trial_ends_at?: string | null; subscription_status?: string | null; plan?: string | null } | null | undefined} />}
      tabs={[
        { label: "Floor", icon: Activity, to: "/cafe/$slug", params: { slug }, exact: true },
        { label: "Ops", icon: CalendarRange, to: "/cafe/$slug/bookings", params: { slug }, match: ["/cafe/$slug/floor"] },
        { label: "Money", icon: Receipt, to: "/cafe/$slug/pos", params: { slug }, match: ["/cafe/$slug/wallet", "/cafe/$slug/ledger"] },
        { label: "People", icon: Users, to: "/cafe/$slug/customers", params: { slug }, match: ["/cafe/$slug/staff", "/cafe/$slug/memberships"] },
        { label: "More", icon: LayoutGrid, more: true },
      ]}
      nav={[
        { group: "Operations", label: "Live floor", icon: Activity, to: "/cafe/$slug", params: { slug }, exact: true },
        { group: "Operations", label: "Floor builder", icon: LayoutGrid, to: "/cafe/$slug/floor", params: { slug } },
        { group: "Operations", label: "Bookings", icon: CalendarRange, to: "/cafe/$slug/bookings", params: { slug } },

        { group: "Revenue", label: "POS counter", icon: Receipt, to: "/cafe/$slug/pos", params: { slug } },
        { group: "Revenue", label: "Wallet", icon: Wallet, to: "/cafe/$slug/wallet", params: { slug } },
        { group: "Revenue", label: "Ledger", icon: ScrollText, to: "/cafe/$slug/ledger", params: { slug } },
        { group: "Revenue", label: "Reports", icon: BarChart3, to: "/cafe/$slug/reports", params: { slug } },
        { group: "Revenue", label: "Analytics", icon: LineChart, to: "/cafe/$slug/analytics", params: { slug } },

        { group: "Community", label: "Customers", icon: Users, to: "/cafe/$slug/customers", params: { slug } },
        { group: "Community", label: "Memberships", icon: Crown, to: "/cafe/$slug/memberships", params: { slug } },
        { group: "Community", label: "Tournaments", icon: Trophy, to: "/cafe/$slug/tournaments", params: { slug } },
        { group: "Community", label: "Staff", icon: Settings, to: "/cafe/$slug/staff", params: { slug } },

        { group: "Manage", label: "Menu", icon: UtensilsCrossed, to: "/cafe/$slug/menu", params: { slug } },
        { group: "Manage", label: "Public page", icon: Globe, to: "/cafe/$slug/page", params: { slug } },
        { group: "Manage", label: "Audit log", icon: History, to: "/cafe/$slug/audit", params: { slug } },
        { group: "Manage", label: "Support", icon: LifeBuoy, to: "/cafe/$slug/support", params: { slug } },
      ]}
    >
      <div className="mb-4 space-y-3">
        <MaintenanceBanner window={platform} title="CoreCade network maintenance" />
        {cafe && (
          <div className="liquid-glass-card rounded-2xl p-3 px-4 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3 border border-white/10 shadow-lg">
            <div className="flex min-w-0 items-center gap-2.5 text-xs text-muted-foreground">
              <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${cafeInMaint ? "bg-amber-400/20 text-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.4)]" : "bg-white/5 text-muted-foreground"}`}>
                <Wrench className="h-3.5 w-3.5" />
              </span>
              {cafeInMaint
                ? <span className="font-semibold text-amber-200">Maintenance active — public bookings paused.</span>
                : <span className="text-foreground/80">Need to pause for an hour? Schedule maintenance so customers see why.</span>}
            </div>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <MaintenanceScheduler
                scope={{ kind: "cafe", cafeId: (cafe as { id: string }).id, cafeName: cafe.name }}
                current={cafeMaint}
                onSaved={() => refetch()}
                trigger={
                  <Button size="sm" variant={cafeInMaint ? "destructive" : "outline"} className="gap-1.5 h-8 text-xs font-semibold rounded-xl border-white/10 hover:bg-white/10">
                    <Wrench className="h-3.5 w-3.5" />
                    {cafeInMaint ? "Edit maintenance" : "Schedule maintenance"}
                  </Button>
                }
              />
              {!locked && <LogRevenueButton cafeId={(cafe as { id: string }).id} />}
              <OwnerInbox />
              <OwnerMessageAdmin cafeId={(cafe as { id: string }).id} />
              <DeleteCafeButton cafeId={(cafe as { id: string }).id} slug={cafe.slug} name={cafe.name} />
            </div>
          </div>
        )}
      </div>

      {locked ? <RestrictedOverlay message={lockMessage} trial={trialEnded && !restricted} /> : null}
      <div className={locked ? "pointer-events-none select-none opacity-30 blur-[2px]" : ""} aria-hidden={locked}>
        <Outlet />
      </div>
    </ConsoleShell>
  );
}

function RestrictedOverlay({ message, trial = false }: { message: string; trial?: boolean }) {
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
            {trial ? "Trial ended" : "Service restricted by CoreCade admin"}
          </div>
          <h2 className="mt-1 font-display text-xl font-extrabold tracking-tight sm:text-2xl">
            {trial ? "Your free trial has ended" : "Your café console has been temporarily suspended"}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-foreground/80">
            {message}
          </p>
          <Link
            to="/portal"
            className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/40 px-3 py-1.5 text-xs text-foreground transition hover:border-primary/40"
          >
            <Mail className="h-3 w-3" /> {trial ? "Renew subscription" : "Contact support to resolve"}
          </Link>
        </div>
      </div>
    </motion.div>
  );
}
