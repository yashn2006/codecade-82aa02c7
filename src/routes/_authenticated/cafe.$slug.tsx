import { createFileRoute, Outlet, Link, useRouterState } from "@tanstack/react-router";
import { Activity, Cpu, CalendarRange, Users, Settings, ScrollText, Wallet, Crown, Receipt, Globe, LayoutGrid, AlertOctagon, Mail, UtensilsCrossed, Wrench, LineChart, ChevronRight, Home, LayoutDashboard, Trophy, History, BarChart3, LifeBuoy } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { ConsoleShell } from "@/components/ConsoleShell";
import { getCafeBySlug } from "@/lib/cafes.functions";
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
      subtitle={cafe ? `${cafe.city ?? ""}${cafe.city ? " · " : ""}/${cafe.slug}` : "Loading workspace…"}
      intensity="immersive"
      nav={[
        { label: "Live floor", icon: Activity, to: "/cafe/$slug", params: { slug }, exact: true },
        { label: "Analytics", icon: LineChart, to: "/cafe/$slug/analytics", params: { slug } },
        { label: "Reports", icon: BarChart3, to: "/cafe/$slug/reports", params: { slug } },
        { label: "Floor builder", icon: LayoutGrid, to: "/cafe/$slug/floor", params: { slug } },
        { label: "Menu", icon: UtensilsCrossed, to: "/cafe/$slug/menu", params: { slug } },
        { label: "POS counter", icon: Receipt, to: "/cafe/$slug/pos", params: { slug } },
        { label: "Devices", icon: Cpu, to: "/cafe/$slug/devices", params: { slug } },
        { label: "Bookings", icon: CalendarRange, to: "/cafe/$slug/bookings", params: { slug } },
        { label: "Tournaments", icon: Trophy, to: "/cafe/$slug/tournaments", params: { slug } },
        { label: "Customers", icon: Users, to: "/cafe/$slug/customers", params: { slug } },
        { label: "Wallet", icon: Wallet, to: "/cafe/$slug/wallet", params: { slug } },
        { label: "Memberships", icon: Crown, to: "/cafe/$slug/memberships", params: { slug } },
        { label: "Ledger", icon: ScrollText, to: "/cafe/$slug/ledger", params: { slug } },
        { label: "Audit log", icon: History, to: "/cafe/$slug/audit", params: { slug } },
        { label: "Public page", icon: Globe, to: "/cafe/$slug/page", params: { slug } },
        { label: "Staff", icon: Settings, to: "/cafe/$slug/staff", params: { slug } },
        { label: "Support", icon: LifeBuoy, to: "/cafe/$slug/support", params: { slug } },
      ]}
    >
      <CafeBreadcrumbs slug={slug} cafeName={cafe?.name ?? null} />
      <div className="mb-4 space-y-3">
        <MaintenanceBanner window={platform} title="CoreCade network maintenance" />
        <TrialBanner cafe={cafe as { trial_ends_at?: string | null; subscription_status?: string | null; plan?: string | null } | null | undefined} />
        {cafe && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card/30 px-4 py-2.5 backdrop-blur">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Wrench className={`h-3.5 w-3.5 ${cafeInMaint ? "text-amber-300" : ""}`} />
              {cafeInMaint
                ? <span className="text-amber-200">Maintenance active — public bookings paused.</span>
                : <span>Need to pause for an hour? Schedule maintenance so customers see why.</span>}
            </div>
            <div className="flex flex-wrap items-center gap-2">
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

const SECTION_LABELS: Record<string, { label: string; icon: typeof Activity }> = {
  analytics: { label: "Analytics", icon: LineChart },
  floor: { label: "Floor builder", icon: LayoutGrid },
  menu: { label: "Menu", icon: UtensilsCrossed },
  pos: { label: "POS counter", icon: Receipt },
  devices: { label: "Devices", icon: Cpu },
  bookings: { label: "Bookings", icon: CalendarRange },
  tournaments: { label: "Tournaments", icon: Trophy },
  customers: { label: "Customers", icon: Users },
  wallet: { label: "Wallet", icon: Wallet },
  memberships: { label: "Memberships", icon: Crown },
  ledger: { label: "Ledger", icon: ScrollText },
  audit: { label: "Audit log", icon: History },
  page: { label: "Public page", icon: Globe },
  staff: { label: "Staff", icon: Settings },
  support: { label: "Support", icon: LifeBuoy },
};

function CafeBreadcrumbs({ slug, cafeName }: { slug: string; cafeName: string | null }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const segments = pathname.split("/").filter(Boolean); // ["cafe", slug, maybeSection]
  const section = segments[2];
  const sectionMeta = section ? SECTION_LABELS[section] : null;

  return (
    <motion.nav
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      aria-label="Breadcrumb"
      className="mb-3 flex items-center gap-1.5 overflow-x-auto rounded-2xl border border-border/50 bg-card/40 px-3 py-2 text-xs font-medium text-muted-foreground backdrop-blur"
    >
      <Link to="/owner" className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 transition hover:bg-accent/40 hover:text-foreground">
        <Home className="h-3 w-3" /> Owner Hub
      </Link>
      <ChevronRight className="h-3 w-3 opacity-50" />
      <Link
        to="/cafe/$slug"
        params={{ slug }}
        className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 transition hover:bg-accent/40 hover:text-foreground"
      >
        <LayoutDashboard className="h-3 w-3" />
        <span className="max-w-[160px] truncate">{cafeName ?? slug}</span>
      </Link>
      {sectionMeta ? (
        <>
          <ChevronRight className="h-3 w-3 opacity-50" />
          <span aria-current="page" className="inline-flex items-center gap-1 rounded-md bg-primary/15 px-1.5 py-0.5 text-foreground">
            <sectionMeta.icon className="h-3 w-3" /> {sectionMeta.label}
          </span>
        </>
      ) : (
        <span aria-current="page" className="ml-1 rounded-md bg-primary/15 px-1.5 py-0.5 text-foreground">Overview</span>
      )}
      {sectionMeta && (
        <Link
          to="/cafe/$slug"
          params={{ slug }}
          className="ml-auto inline-flex items-center gap-1 rounded-full border border-border/60 px-2 py-0.5 text-[10px] uppercase tracking-wider text-foreground/80 transition hover:border-primary/50 hover:text-foreground"
        >
          <Activity className="h-3 w-3" /> Back to Overview
        </Link>
      )}
    </motion.nav>
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
