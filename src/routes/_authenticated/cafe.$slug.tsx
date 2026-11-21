import { createFileRoute, Outlet, Link, useNavigate, useRouter, type ErrorComponentProps } from "@tanstack/react-router";
import { Activity, CalendarRange, Users, Settings, Wallet, Crown, Receipt, Globe, LayoutGrid, AlertOctagon, Mail, UtensilsCrossed, LineChart, Trophy, History, BarChart3, LifeBuoy, KeyRound, LogOut, ShieldAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { ConsoleShell, type MobileTab, type NavItem } from "@/components/ConsoleShell";
import { getCafeBySlug } from "@/lib/cafes.functions";
import { listDevices } from "@/lib/devices.functions";
import { listSessions } from "@/lib/sessions.functions";
import { listBookings } from "@/lib/bookings.functions";
import { listCustomers } from "@/lib/customers.functions";
import { listMenu } from "@/lib/menu.functions";
import { listRecentOrders } from "@/lib/pos.functions";
import { listMemberships } from "@/lib/memberships.functions";
import { listTournaments } from "@/lib/tournaments.functions";
import { listStaff, staffChangePin, staffHeartbeat, isTrivialPin } from "@/lib/staff.functions";
import { listWalletTransactions, listWalletTopupRequests } from "@/lib/wallet.functions";
import { getCafePage } from "@/lib/cafe-page.functions";
import { listAuditLogs } from "@/lib/audit.functions";
import { listCafeCustomerTickets } from "@/lib/tickets.functions";
import { getPlatformMaintenance } from "@/lib/platform.functions";
import { MaintenanceBanner } from "@/components/MaintenanceBanner";
import { TrialBanner } from "@/components/TrialBanner";
import { ErrorState } from "@/components/ErrorState";
import { reportLovableError } from "@/lib/lovable-error-reporting";
import { useCafeAccess } from "@/hooks/useCafeAccess";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function CafeRouteError({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "cafe_layout_error_component" });
  }, [error]);

  const desc = import.meta.env.DEV && error instanceof Error && error.message
    ? error.message
    : "We hit a snag loading this section. Your data is safe — try again.";

  return (
    <div className="mx-auto max-w-lg py-10">
      <ErrorState
        title="This section couldn't load"
        description={desc}
        onRetry={() => {
          router.invalidate();
          reset();
        }}
      />
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/cafe/$slug")({
  head: () => ({
    meta: [
      { title: "Café Console — CoreCade" },
      { name: "description", content: "Your CoreCade café command center." },
      { property: "og:title", content: "Café Console — CoreCade" },
      { property: "og:description", content: "Your CoreCade café command center." },
    ],
  }),
  errorComponent: CafeRouteError,
  component: CafeLayout,
});

function CafeLayout() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fn = useServerFn(getCafeBySlug);
  const platFn = useServerFn(getPlatformMaintenance);
  const devicesFn = useServerFn(listDevices);
  const sessionsFn = useServerFn(listSessions);
  const bookingsFn = useServerFn(listBookings);
  const customersFn = useServerFn(listCustomers);
  const menuFn = useServerFn(listMenu);
  const ordersFn = useServerFn(listRecentOrders);
  const membershipsFn = useServerFn(listMemberships);
  const tournsFn = useServerFn(listTournaments);
  const staffFn = useServerFn(listStaff);
  const walletTxFn = useServerFn(listWalletTransactions);
  const walletReqsFn = useServerFn(listWalletTopupRequests);
  const cafePageFn = useServerFn(getCafePage);
  const auditFn = useServerFn(listAuditLogs);
  const supportFn = useServerFn(listCafeCustomerTickets);
  const heartbeatFn = useServerFn(staffHeartbeat);

  const { data: cafe, isError: cafeError, error: cafeErrorObj, refetch: refetchCafe } = useQuery({
    queryKey: ["cafe", slug],
    queryFn: () => fn({ data: { slug } }),
  });
  const { data: platform } = useQuery({
    queryKey: ["platform-maintenance"], queryFn: () => platFn(), refetchInterval: 60_000,
  });

  const cafeId = (cafe as { id?: string } | undefined)?.id;
  const access = useCafeAccess(cafeId);
  const {
    access: accessData,
    isLoading: accessLoading,
    isError: accessError,
    error: accessErrorObj,
    refetch: refetchAccess,
    isMember,
    isActive,
    isOwnerOrAdmin,
    isStaff,
    mustChangePin,
    displayName,
    username,
    isPinStaff,
    can,
  } = access;

  // Periodic staff online heartbeat (every 2 minutes)
  useEffect(() => {
    if (!cafeId || !isStaff || !isActive) return;
    void heartbeatFn({ data: { cafe_id: cafeId } }).catch(() => {});
    const iv = window.setInterval(() => {
      void heartbeatFn({ data: { cafe_id: cafeId } }).catch(() => {});
    }, 120_000);
    return () => window.clearInterval(iv);
  }, [cafeId, isStaff, isActive, heartbeatFn]);

  const canMenuPrefetch = isOwnerOrAdmin || can("generate_bills") || can("manage_menu");
  const canOrdersPrefetch = isOwnerOrAdmin || can("generate_bills");
  const canWalletPrefetch = isOwnerOrAdmin || can("manage_wallet");

  useEffect(() => {
    if (!cafeId || !isMember || !isActive || mustChangePin) return;
    // Tier 1: live floor, bookings, customers & support immediately
    void qc.prefetchQuery({ queryKey: ["devices", cafeId], queryFn: () => devicesFn({ data: { cafe_id: cafeId } }) });
    void qc.prefetchQuery({ queryKey: ["sessions", cafeId], queryFn: () => sessionsFn({ data: { cafe_id: cafeId } }) });
    void qc.prefetchQuery({ queryKey: ["bookings", cafeId], queryFn: () => bookingsFn({ data: { cafe_id: cafeId } }) });
    void qc.prefetchQuery({ queryKey: ["customers", cafeId], queryFn: () => customersFn({ data: { cafe_id: cafeId } }) });
    void qc.prefetchQuery({ queryKey: ["cafe-customer-tickets", cafeId], queryFn: () => supportFn({ data: { cafe_id: cafeId } }) });

    // Tier 2: quietly warm authorized secondary sections right after initial paint
    const timer = window.setTimeout(() => {
      if (canMenuPrefetch) {
        void qc.prefetchQuery({ queryKey: ["menu", cafeId], queryFn: () => menuFn({ data: { cafe_id: cafeId } }) });
      }
      if (canOrdersPrefetch) {
        void qc.prefetchQuery({ queryKey: ["orders", cafeId], queryFn: () => ordersFn({ data: { cafe_id: cafeId } }) });
      }
      if (canWalletPrefetch) {
        void qc.prefetchQuery({ queryKey: ["wallet-tx", cafeId], queryFn: () => walletTxFn({ data: { cafe_id: cafeId } }) });
        void qc.prefetchQuery({ queryKey: ["wallet-topup-reqs", cafeId], queryFn: () => walletReqsFn({ data: { cafe_id: cafeId } }) });
      }
      if (isOwnerOrAdmin) {
        void qc.prefetchQuery({ queryKey: ["memberships", cafeId], queryFn: () => membershipsFn({ data: { cafe_id: cafeId } }) });
        void qc.prefetchQuery({ queryKey: ["tourns", cafeId], queryFn: () => tournsFn({ data: { cafe_id: cafeId } }) });
        void qc.prefetchQuery({ queryKey: ["staff", cafeId], queryFn: () => staffFn({ data: { cafe_id: cafeId } }) });
        void qc.prefetchQuery({ queryKey: ["cafe-page", cafeId], queryFn: () => cafePageFn({ data: { cafe_id: cafeId } }) });
        void qc.prefetchQuery({ queryKey: ["audit", cafeId], queryFn: () => auditFn({ data: { cafe_id: cafeId, limit: 200 } }) });
      }
    }, 180);
    return () => window.clearTimeout(timer);
  }, [
    cafeId, isMember, isActive, mustChangePin, isOwnerOrAdmin,
    canMenuPrefetch, canOrdersPrefetch, canWalletPrefetch,
    qc, devicesFn, sessionsFn, bookingsFn, customersFn, supportFn,
    menuFn, ordersFn, membershipsFn, tournsFn, staffFn, walletTxFn, walletReqsFn, cafePageFn, auditFn,
  ]);

  const navItems: NavItem[] = useMemo(() => {
    if (isMember && !isActive) return [];
    const showAll = !cafeId || accessLoading || isOwnerOrAdmin;
    const allow = (perm?: Parameters<typeof can>[0], ownerOnly = false) => {
      if (showAll) return true;
      if (ownerOnly) return false;
      if (!perm) return isMember && isActive;
      return can(perm);
    };

    const items: NavItem[] = [
      { group: "Operations", label: "Live floor", icon: Activity, to: "/cafe/$slug", params: { slug }, exact: true },
    ];
    if (allow("manage_devices")) {
      items.push({ group: "Operations", label: "Floor builder", icon: LayoutGrid, to: "/cafe/$slug/floor", params: { slug } });
    }
    items.push({ group: "Operations", label: "Bookings", icon: CalendarRange, to: "/cafe/$slug/bookings", params: { slug } });

    if (allow("generate_bills")) {
      items.push({ group: "Revenue", label: "POS counter", icon: Receipt, to: "/cafe/$slug/pos", params: { slug } });
    }
    if (allow("manage_wallet")) {
      items.push({ group: "Revenue", label: "Wallet", icon: Wallet, to: "/cafe/$slug/wallet", params: { slug } });
    }
    if (allow("view_revenue")) {
      items.push({ group: "Revenue", label: "Reports", icon: BarChart3, to: "/cafe/$slug/reports", params: { slug } });
      items.push({ group: "Revenue", label: "Analytics", icon: LineChart, to: "/cafe/$slug/analytics", params: { slug } });
    }

    items.push({ group: "Community", label: "Customers", icon: Users, to: "/cafe/$slug/customers", params: { slug } });
    if (allow(undefined, true)) {
      items.push({ group: "Community", label: "Memberships", icon: Crown, to: "/cafe/$slug/memberships", params: { slug } });
      items.push({ group: "Community", label: "Tournaments", icon: Trophy, to: "/cafe/$slug/tournaments", params: { slug } });
      items.push({ group: "Community", label: "Staff", icon: Settings, to: "/cafe/$slug/staff", params: { slug } });
    }

    if (allow("manage_menu")) {
      items.push({ group: "Manage", label: "Menu", icon: UtensilsCrossed, to: "/cafe/$slug/menu", params: { slug } });
    }
    if (allow(undefined, true)) {
      items.push({ group: "Manage", label: "Public page", icon: Globe, to: "/cafe/$slug/page", params: { slug } });
      items.push({ group: "Manage", label: "Audit log", icon: History, to: "/cafe/$slug/audit", params: { slug } });
    }
    items.push({ group: "Manage", label: "Support", icon: LifeBuoy, to: "/cafe/$slug/support", params: { slug } });
    return items;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, cafeId, accessLoading, isMember, isActive, isOwnerOrAdmin, access.permissions]);

  const mobileTabs: MobileTab[] = useMemo(() => {
    if (isMember && !isActive) return [];
    const showAll = !cafeId || accessLoading || isOwnerOrAdmin;
    const canPos = showAll || can("generate_bills");
    const canWallet = showAll || can("manage_wallet");
    const canMoney = canPos || canWallet;
    const canDevices = showAll || can("manage_devices");

    const out: MobileTab[] = [
      { label: "Floor", icon: Activity, to: "/cafe/$slug", params: { slug }, exact: true },
      {
        label: "Ops",
        icon: CalendarRange,
        to: "/cafe/$slug/bookings",
        params: { slug },
        match: canDevices ? ["/cafe/$slug/floor"] : undefined,
      },
    ];
    if (canMoney) {
      out.push({
        label: "Money",
        icon: Receipt,
        to: canPos ? "/cafe/$slug/pos" : "/cafe/$slug/wallet",
        params: { slug },
        match: canPos && canWallet ? ["/cafe/$slug/wallet"] : undefined,
      });
    }
    out.push({
      label: "People",
      icon: Users,
      to: "/cafe/$slug/customers",
      params: { slug },
      match: showAll ? ["/cafe/$slug/staff", "/cafe/$slug/memberships"] : undefined,
    });
    out.push({ label: "More", icon: LayoutGrid, more: true });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, cafeId, accessLoading, isMember, isActive, isOwnerOrAdmin, access.permissions]);

  const restricted = !!(cafe as { restricted_message?: string | null } | undefined)?.restricted_message;
  const sub = (cafe as { subscription_status?: string | null; trial_ends_at?: string | null } | undefined);
  const trialEnded = !!(sub?.trial_ends_at && new Date(sub.trial_ends_at).getTime() < Date.now() && sub?.subscription_status !== "active");
  const locked = restricted || trialEnded;
  const lockMessage = restricted
    ? ((cafe as { restricted_message?: string }).restricted_message ?? "")
    : "Your free trial has ended. Renew your subscription to continue managing this café.";

  const blockedStaff = Boolean(
    cafe &&
      !accessLoading &&
      !accessError &&
      accessData &&
      (!isMember || (isStaff && !isActive)),
  );
  const forcePinGate = Boolean(cafe && !accessLoading && !accessError && isStaff && isActive && mustChangePin);

  const staffAccountLabel = isStaff
    ? displayName
      ? `${displayName}${username ? ` (@${username})` : ""}`
      : username
        ? `@${username}`
        : undefined
    : undefined;

  const signOutNow = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <ConsoleShell
      badge={isStaff ? "Staff Console" : "Café Console"}
      title={cafe?.name ?? "Café"}
      subtitle={cafe ? `/${cafe.slug}` : "Loading workspace…"}
      intensity="immersive"
      hideHubLink={isStaff && !isOwnerOrAdmin}
      hidePasswordLink={isPinStaff}
      userLabel={staffAccountLabel}
      banner={<TrialBanner cafe={cafe as { trial_ends_at?: string | null; subscription_status?: string | null; plan?: string | null } | null | undefined} />}
      tabs={mobileTabs}
      nav={navItems}
    >
      <div className="mb-5 space-y-3">
        <MaintenanceBanner window={platform} title="CoreCade network maintenance" />
      </div>

      {cafeError && !cafe ? (
        <ErrorState
          title="Couldn't load café"
          description={
            cafeErrorObj instanceof Error && cafeErrorObj.message
              ? import.meta.env.DEV || /permission|deactivated|not found/i.test(cafeErrorObj.message)
                ? cafeErrorObj.message
                : "We couldn't reach your café details right now."
              : "We couldn't reach your café details right now."
          }
          onRetry={() => void refetchCafe()}
        />
      ) : cafe && accessError && !accessData ? (
        <ErrorState
          title="Couldn't verify access"
          description={
            accessErrorObj instanceof Error && accessErrorObj.message
              ? accessErrorObj.message
              : "Please retry to verify your workspace access."
          }
          onRetry={() => void refetchAccess()}
        />
      ) : blockedStaff ? (
        <DeactivatedOverlay
          deactivated={isStaff && !isActive}
          onSignOut={() => void signOutNow()}
        />
      ) : forcePinGate ? (
        <ForcePinChangeGate
          cafeId={cafeId!}
          displayName={displayName}
          username={username}
          onSuccess={() => {
            void qc.invalidateQueries({ queryKey: ["cafe-access", cafeId] });
            void qc.invalidateQueries({ queryKey: ["staff", cafeId] });
          }}
        />
      ) : (
        <>
          {locked ? (
            <RestrictedOverlay
              message={lockMessage}
              trial={trialEnded && !restricted}
              canResolve={isOwnerOrAdmin || !isStaff}
            />
          ) : null}
          <div className={locked ? "pointer-events-none select-none opacity-30 blur-[2px]" : ""} aria-hidden={locked}>
            <Outlet />
          </div>
        </>
      )}
    </ConsoleShell>
  );
}

function DeactivatedOverlay({ deactivated, onSignOut }: { deactivated: boolean; onSignOut: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto my-8 max-w-lg rounded-3xl border border-destructive/40 bg-card/80 p-8 text-center shadow-pop"
    >
      <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-destructive/15 text-destructive">
        <ShieldAlert className="h-7 w-7" />
      </div>
      <h2 className="font-display text-2xl font-extrabold tracking-tight">
        {deactivated ? "Account deactivated" : "Access denied"}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {deactivated
          ? "Your staff access for this café has been deactivated by the owner. Please contact them if you believe this is a mistake."
          : "You don't have permission to access this café workspace."}
      </p>
      <Button type="button" variant="destructive" className="mt-6" onClick={onSignOut}>
        <LogOut className="mr-2 h-4 w-4" /> Sign out
      </Button>
    </motion.div>
  );
}

function ForcePinChangeGate({
  cafeId,
  displayName,
  username,
  onSuccess,
}: {
  cafeId: string;
  displayName: string | null;
  username: string | null;
  onSuccess: () => void;
}) {
  const changePinFn = useServerFn(staffChangePin);
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const mut = useMutation({
    mutationFn: async () => {
      const res = await changePinFn({ data: { new_pin: pin } });
      if (res?.access_token && res?.refresh_token) {
        const { error: sessErr } = await supabase.auth.setSession({
          access_token: res.access_token,
          refresh_token: res.refresh_token,
        });
        if (sessErr) throw sessErr;
      }
      return res;
    },
    onSuccess: () => {
      toast.success("PIN updated! Welcome to the console.");
      setPin("");
      setConfirm("");
      setErr(null);
      onSuccess();
    },
    onError: (e: unknown) => {
      setErr(e instanceof Error ? e.message : "Could not update PIN.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (!/^\d{6}$/.test(pin)) {
      setErr("Your new PIN must be exactly 6 digits.");
      return;
    }
    if (isTrivialPin(pin)) {
      setErr("Choose a stronger PIN (avoid 000000, 123456, 654321, or repeating pairs).");
      return;
    }
    if (pin !== confirm) {
      setErr("The two PINs do not match.");
      return;
    }
    mut.mutate();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto my-6 max-w-md rounded-3xl border border-primary/35 bg-card/85 p-6 sm:p-8 shadow-pop"
      data-cafe-id={cafeId}
    >
      <div className="flex items-center gap-3">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary/15 text-primary">
          <KeyRound className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary">
            Security check required
          </div>
          <h2 className="font-display text-xl font-extrabold tracking-tight">Set your personal PIN</h2>
        </div>
      </div>

      <p className="mt-3 text-sm text-muted-foreground">
        {displayName ? `Hi ${displayName}` : username ? `Hi @${username}` : "Welcome"} — you must choose a private 6-digit PIN before opening the café console.
      </p>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="force-new-pin">New 6-digit PIN</Label>
          <Input
            id="force-new-pin"
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            maxLength={6}
            placeholder="••••••"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
            className="h-11 font-mono text-lg tracking-[0.4em]"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="force-confirm-pin">Confirm 6-digit PIN</Label>
          <Input
            id="force-confirm-pin"
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            maxLength={6}
            placeholder="••••••"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value.replace(/\D/g, "").slice(0, 6))}
            className="h-11 font-mono text-lg tracking-[0.4em]"
          />
        </div>

        {err && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {err}
          </div>
        )}

        <Button
          type="submit"
          className="w-full"
          disabled={mut.isPending || pin.length !== 6 || confirm.length !== 6}
        >
          {mut.isPending ? "Saving PIN…" : "Save PIN & Enter Console"}
        </Button>
      </form>
    </motion.div>
  );
}

function RestrictedOverlay({ message, trial = false, canResolve = true }: { message: string; trial?: boolean; canResolve?: boolean }) {
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
          {canResolve ? (
            <Link
              to={trial ? "/owner/upgrade" : "/owner/help"}
              className="mt-4 inline-flex min-h-[40px] items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold text-primary-foreground shadow-md transition hover:opacity-95"
              style={{ background: "var(--gradient-brand-hot)" }}
            >
              <Mail className="h-3.5 w-3.5" /> {trial ? "Renew subscription" : "Contact support to resolve"}
            </Link>
          ) : (
            <p className="mt-3 text-xs font-medium text-muted-foreground">
              Please ask your café owner to resolve this.
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}
