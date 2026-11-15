import { createFileRoute, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Home,
  CalendarRange,
  User as UserIcon,
  MapPin,
  Wallet,
  Crown,
  Trophy,
  Clock,
  X,
  Plus,
  ArrowRight,
  ArrowDownLeft,
  ArrowUpRight,
  RotateCcw,
  LogOut,
  KeyRound,
  Compass,
  QrCode,
  Copy,
  Monitor,
  Flame,
  Award,
  LifeBuoy,
  MessageSquare,
  Menu,
} from "lucide-react";
import { motion } from "framer-motion";
import { ConsoleShell } from "@/components/ConsoleShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmModal } from "@/components/ConfirmDialog";
import { SupportTickets, type BookingSupportPrefill } from "@/components/SupportTickets";
import { computeGamerProgression } from "@/lib/support-thread";
import { listMyBookings } from "@/lib/bookings.functions";
import { getMyRoles } from "@/lib/me.functions";
import { getMyOwnedCafes } from "@/lib/cafes.functions";
import { getPlatformMaintenance } from "@/lib/platform.functions";
import { listMyTickets, listCustomerBookingCafes } from "@/lib/tickets.functions";
import {
  getMyPortalSummary,
  cancelMyBooking,
  getMyProfile,
  updateMyProfile,
  getMyPortalHome,
  getMyWalletLedger,
  getMyTournaments,
  customerSubmitTopupProof,
} from "@/lib/portal.functions";
import { createTopupOrder, verifyTopupPayment, getRazorpayConfig } from "@/lib/razorpay.functions";
import { MaintenanceBanner } from "@/components/MaintenanceBanner";
import { supabase } from "@/lib/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type RzpOpts = {
  key: string;
  amount: number;
  currency: string;
  order_id: string;
  name: string;
  description: string;
  handler: (r: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => void;
  prefill?: { name?: string; email?: string; contact?: string };
  modal?: { ondismiss?: () => void };
  theme?: { color?: string };
};
declare global {
  interface Window {
    Razorpay?: new (o: RzpOpts) => { open: () => void };
  }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if (window.Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

export const Route = createFileRoute("/_authenticated/portal")({
  head: () => ({
    meta: [
      { title: "Gamer Portal — CoreCade" },
      { name: "description", content: "Your sessions, wallet balance, active bookings and tournaments in one cyber command center." },
      { property: "og:title", content: "Gamer Portal — CoreCade" },
      { property: "og:description", content: "Your sessions, wallet balance, active bookings and tournaments in one cyber command center." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Portal,
});

type TabKey = "home" | "bookings" | "wallet" | "tournaments" | "support" | "profile";
const TABS: { key: TabKey; label: string; icon: typeof Home }[] = [
  { key: "home", label: "Dashboard", icon: Home },
  { key: "bookings", label: "My Bookings", icon: CalendarRange },
  { key: "wallet", label: "Cyber Wallet", icon: Wallet },
  { key: "tournaments", label: "Tournaments", icon: Trophy },
  { key: "support", label: "Support", icon: LifeBuoy },
  { key: "profile", label: "Profile", icon: UserIcon },
];

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

function Portal() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const fetchRoles = useServerFn(getMyRoles);
  const fetchOwned = useServerFn(getMyOwnedCafes);
  const fetchPlat = useServerFn(getPlatformMaintenance);
  const fetchSummary = useServerFn(getMyPortalSummary);
  const fetchHome = useServerFn(getMyPortalHome);
  const fetchBookings = useServerFn(listMyBookings);
  const fetchLedger = useServerFn(getMyWalletLedger);
  const fetchTournaments = useServerFn(getMyTournaments);
  const fetchProfile = useServerFn(getMyProfile);
  const fetchTickets = useServerFn(listMyTickets);
  const fetchSupportCafes = useServerFn(listCustomerBookingCafes);

  const [supportPrefill, setSupportPrefill] = useState<BookingSupportPrefill | null>(null);

  const { data: roleData } = useQuery({ queryKey: ["my-roles"], queryFn: () => fetchRoles() });
  const { data: ownedCafes } = useQuery({ queryKey: ["my-owned-cafes"], queryFn: () => fetchOwned() });
  const { data: platform } = useQuery({ queryKey: ["platform-maintenance"], queryFn: () => fetchPlat(), refetchInterval: 60_000 });
  const { data: summary } = useQuery({ queryKey: ["portal-summary"], queryFn: () => fetchSummary(), refetchInterval: 15_000 });

  useEffect(() => {
    void qc.prefetchQuery({ queryKey: ["portal-home"], queryFn: () => fetchHome() });
    void qc.prefetchQuery({ queryKey: ["my-bookings"], queryFn: () => fetchBookings() });
    void qc.prefetchQuery({ queryKey: ["portal-wallet"], queryFn: () => fetchLedger() });
    void qc.prefetchQuery({ queryKey: ["portal-tournaments"], queryFn: () => fetchTournaments() });
    void qc.prefetchQuery({ queryKey: ["my-profile"], queryFn: () => fetchProfile() });
    void qc.prefetchQuery({ queryKey: ["my-tickets", "customer", "all"], queryFn: () => fetchTickets() });
    void qc.prefetchQuery({ queryKey: ["customer-support-cafes"], queryFn: () => fetchSupportCafes() });
  }, [qc, fetchHome, fetchBookings, fetchLedger, fetchTournaments, fetchProfile, fetchTickets, fetchSupportCafes]);

  const roles = roleData?.roles ?? [];
  const isSuper = roles.some((r) => r.role === "super_admin");
  const ownerCafe = (ownedCafes ?? [])[0];

  const hash = useRouterState({ select: (s) => (s.location.hash ?? "").replace(/^#/, "") });
  const active: TabKey = TABS.find((t) => t.key === hash)?.key ?? "home";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function openBookingSupport(booking: any) {
    const ref = `#BK-${String(booking.id).slice(0, 8).toUpperCase()}`;
    const when = new Date(booking.scheduled_at).toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });
    const cafeName = booking.cafes?.name ?? "Arena";
    const rigName = booking.devices?.name ?? "Gaming Rig";
    setSupportPrefill({
      key: Date.now(),
      cafeId: booking.cafe_id ?? booking.cafes?.id ?? null,
      cafeName,
      bookingId: booking.id,
      bookingRef: ref,
      bookingSummary: `${rigName} · ${when} (${booking.duration_minutes}m)`,
      category: "bookings",
      subject: `Booking ${ref} — update or cancellation`,
      description: `Hi ${cafeName} team, I need help with my booking ${ref} (${rigName} on ${when}).`,
    });
    void navigate({ to: "/portal", hash: "support" });
  }

  return (
    <ConsoleShell
      badge="Player Console"
      title="Gamer Portal"
      subtitle="Your live stations, wallet credits, verified bookings & tournaments."
      nav={TABS.map((t) => ({
        label: t.label,
        icon: t.icon,
        to: "/portal",
        exact: true,
        hash: t.key === "home" ? undefined : t.key,
      }))}
      tabs={[
        { label: "Home", icon: Home, to: "/portal", exact: true },
        { label: "Bookings", icon: CalendarRange, to: "/portal", hash: "bookings", exact: true },
        { label: "Wallet", icon: Wallet, to: "/portal", hash: "wallet", exact: true },
        { label: "Support", icon: LifeBuoy, to: "/portal", hash: "support", exact: true },
        { label: "Menu", icon: Menu, more: true },
      ]}
      intensity="hero"
    >
      <div className="mb-4">
        <MaintenanceBanner window={platform} title="CoreCade network maintenance" />
      </div>

      {(isSuper || ownerCafe) && (
        <div className="mb-4 flex flex-wrap gap-2">
          {isSuper && (
            <Link to="/admin">
              <Button variant="outline" size="sm" className="min-h-[40px] border-primary/40 text-xs">
                Open Super Admin →
              </Button>
            </Link>
          )}
          {ownerCafe && (
            <Link to="/owner">
              <Button variant="outline" size="sm" className="min-h-[40px] border-primary/40 text-xs">
                Open Owner Hub →
              </Button>
            </Link>
          )}
        </div>
      )}

      {/* Mobile horizontal quick-section rail (all 6 portal views) */}
      <div className="mb-5 flex w-full max-w-full flex-nowrap items-center gap-2 overflow-x-auto pb-1 lg:hidden">
        {TABS.map((t) => {
          const isTabActive = active === t.key;
          const Icon = t.icon;
          return (
            <Link
              key={t.key}
              to="/portal"
              hash={t.key === "home" ? undefined : t.key}
              className={cn(
                "flex min-h-[44px] shrink-0 snap-start items-center gap-2 rounded-2xl border px-3.5 text-xs font-semibold transition active:scale-[0.97]",
                isTabActive
                  ? "border-primary/60 bg-primary/20 text-white shadow-[0_0_20px_-6px_oklch(0.7_0.26_335/0.8)]"
                  : "border-white/10 bg-white/[0.04] text-muted-foreground hover:text-white",
              )}
            >
              <Icon className={cn("h-3.5 w-3.5", isTabActive ? "text-primary" : "text-muted-foreground")} />
              <span>{t.label}</span>
            </Link>
          );
        })}
      </div>

      <div key={active} className="page-reveal min-w-0 w-full max-w-full">
        {active === "home" && <HomeTab summary={summary} onMessageCafe={openBookingSupport} />}
        {active === "bookings" && <BookingsTab onMessageCafe={openBookingSupport} />}
        {active === "wallet" && <WalletTab />}
        {active === "tournaments" && <TournamentsTab />}
        {active === "support" && <SupportTab prefill={supportPrefill} />}
        {active === "profile" && <ProfileTab />}
      </div>
    </ConsoleShell>
  );
}

/* ══════════════════ TAB 1 — HOME DASHBOARD ══════════════════ */

function useTick(ms = 1000) {
  const [, setN] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setN((n) => n + 1), ms);
    return () => window.clearInterval(id);
  }, [ms]);
}

function HomeTab({
  summary,
  onMessageCafe,
}: {
  summary: Awaited<ReturnType<typeof getMyPortalSummary>> | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onMessageCafe: (booking: any) => void;
}) {
  const fetchHome = useServerFn(getMyPortalHome);
  const fetchProfile = useServerFn(getMyProfile);

  const { data } = useQuery({ queryKey: ["portal-home"], queryFn: () => fetchHome(), refetchInterval: 15_000 });
  const { data: profile } = useQuery({ queryKey: ["my-profile"], queryFn: () => fetchProfile() });

  const fullName = profile?.full_name || profile?.email?.split("@")[0] || "Cyber Gamer";
  const initials = fullName.slice(0, 2).toUpperCase();
  const prog = computeGamerProgression(summary);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const active = data?.activeSession as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const next = data?.nextBooking as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const memberships = (data?.memberships ?? []) as any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const activity = (data?.activity ?? []) as any[];

  return (
    <div className="space-y-6">
      {/* HOLOGRAPHIC GAMER VIP IDENTITY BANNER */}
      <div
        className="relative overflow-hidden rounded-3xl border border-white/15 bg-gradient-to-br from-[#171130] via-[#0d0919] to-[#1a0d2a] p-5 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.12)] sm:p-8"
      >
        {/* Glow orb */}
        <div
          className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full opacity-55 blur-[80px]"
          style={{ background: "radial-gradient(circle, oklch(0.7 0.26 335 / 0.6), transparent 70%)" }}
          aria-hidden
        />

        <div className="relative flex flex-wrap items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div
                className="grid h-16 w-16 place-items-center rounded-2xl font-display text-2xl font-black text-white shadow-lg"
                style={{
                  background: "var(--gradient-brand-hot)",
                  boxShadow: "0 0 25px oklch(0.7 0.26 335 / 0.5)",
                }}
              >
                {initials}
              </div>
              <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[10px] text-black font-bold">
                ✓
              </span>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-primary">
                  CoreCade Verified Gamer
                </span>
                <span className="rounded-full bg-amber-400/15 px-2 py-0.5 font-mono text-[9px] font-bold text-amber-300">
                  {prog.tier}
                </span>
              </div>
              <h2 className="mt-0.5 font-display text-2xl font-black text-white sm:text-3xl">{fullName}</h2>
              <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="font-mono">ID: #{profile?.id ? profile.id.slice(0, 8).toUpperCase() : "CC-8942"}</span>
                <span>·</span>
                <span className="tabular-nums">{summary?.totalHours ?? 0} Hours Logged</span>
              </div>
            </div>
          </div>

          {/* Quick Wallet CTA & Action in Header */}
          <div className="grid w-full grid-cols-1 sm:w-auto sm:flex sm:items-center gap-3">
            <Link
              to="/portal"
              hash="wallet"
              className="group flex min-h-[52px] items-center justify-between sm:justify-start gap-3 rounded-2xl border border-primary/35 bg-primary/12 px-5 py-3 transition hover:border-primary/65 hover:bg-primary/20"
            >
              <div>
                <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Wallet Balance</div>
                <div className="font-display text-2xl font-extrabold text-white tabular-nums">
                  {inr(summary?.walletTotal ?? 0)}
                </div>
              </div>
              <div className="rounded-xl bg-primary p-2 text-white shadow-md transition-transform group-hover:scale-110">
                <Plus className="h-4 w-4" />
              </div>
            </Link>

            <Link to="/discover" className="w-full sm:w-auto">
              <Button className="h-12 min-h-[52px] w-full sm:w-auto gap-2 text-xs font-bold text-white shadow-lg" style={{ background: "var(--gradient-brand-hot)" }}>
                <Compass className="h-4 w-4" /> Discover Arenas
              </Button>
            </Link>
          </div>
        </div>

        {/* Level & XP Progression HUD */}
        <div className="mt-5 border-t border-white/10 pt-4">
          <div className="flex items-center justify-between text-[11px] font-mono">
            <span className="flex items-center gap-1.5 font-bold text-white">
              <Award className="h-3.5 w-3.5 text-primary" /> LEVEL {prog.level} {prog.tier}
            </span>
            <span className="text-muted-foreground tabular-nums">
              {prog.xp.toLocaleString("en-IN")} / {prog.nextLevelXp.toLocaleString("en-IN")} XP ({prog.progressPct}%)
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10 ring-1 ring-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary via-accent to-emerald-400 transition-all duration-500"
              style={{ width: `${prog.progressPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* LIVE ACTIVE SESSION HUD (If playing right now) */}
      {active && <ActiveSessionCockpit session={active} />}

      {/* NEXT UPCOMING BOOKING TICKET */}
      {next && <NextBookingCyberPass booking={next} onMessageCafe={() => onMessageCafe(next)} />}

      {/* MEMBERSHIPS CARDS */}
      {memberships.length > 0 && (
        <div className="space-y-3">
          <div className="font-mono text-[10px] uppercase tracking-widest text-primary">Active Memberships</div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {memberships.map((m) => (
              <MembershipCyberCard key={m.id} m={m} />
            ))}
          </div>
        </div>
      )}

      {/* HUD STATS GRID */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <TelemetryCard icon={CalendarRange} label="Upcoming Slots" value={String(summary?.upcoming ?? 0)} color="#a855f7" />
        <TelemetryCard icon={Clock} label="Playtime Logged" value={`${summary?.totalHours ?? 0} hrs`} color="#00e5a0" />
        <TelemetryCard icon={Trophy} label="Arenas Visited" value={String(summary?.cafesVisited ?? 0)} color="#ff006e" />
        <TelemetryCard icon={Flame} label="Completed Sessions" value={String(summary?.completed ?? 0)} color="#ff9b45" />
      </div>

      {/* RECENT ACTIVITY */}
      <div className="rounded-3xl border border-white/12 bg-card/55 p-4 sm:p-5 backdrop-blur-xl">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="font-mono text-[10px] uppercase tracking-widest text-primary">Recent Transactions & Passes</div>
          <Link to="/portal" hash="wallet" className="text-xs text-primary font-semibold hover:underline">
            View Wallet →
          </Link>
        </div>

        {activity.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            No activity logged yet. Book a station or add funds to see transactions here.
          </div>
        ) : (
          <div className="space-y-2">
            {activity.slice(0, 4).map((t) => (
              <TxRow key={t.id} t={t} />
            ))}
          </div>
        )}
      </div>

      {!active && !next && (
        <EmptyState
          icon={Compass}
          title="Ready For Game Night?"
          description="Locate high-refresh RTX rigs or PS5 lounges near you and lock a seat in under 30 seconds."
          action={
            <Link to="/discover">
              <Button className="h-11 text-xs font-bold text-white shadow-lg" style={{ background: "var(--gradient-brand-hot)" }}>
                Find Your Arena Now <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </Link>
          }
        />
      )}
    </div>
  );
}

function TelemetryCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof Wallet;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/12 bg-[#110d20]/80 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur transition hover:border-white/25">
      <div className="flex items-center gap-2">
        <div className="rounded-lg p-1.5" style={{ background: `${color}22`, color }}>
          <Icon className="h-4 w-4" />
        </div>
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      </div>
      <div className="mt-2 font-display text-2xl font-black text-white tabular-nums">{value}</div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ActiveSessionCockpit({ session }: { session: any }) {
  useTick(1000);
  const started = new Date(session.started_at).getTime();
  const mins = Math.max(0, Math.floor((Date.now() - started) / 60000));
  const secs = Math.max(0, Math.floor((Date.now() - started) / 1000) % 60);
  const rate = session.devices?.hourly_rate ?? 80;
  const amount = Math.ceil((rate * mins) / 60);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative overflow-hidden rounded-3xl border border-emerald-500/40 bg-gradient-to-br from-emerald-950/30 via-[#0a140f] to-[#060b09] p-6 shadow-[0_0_50px_-10px_rgba(16,185,129,0.3)] backdrop-blur-2xl"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-500/15 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-widest text-emerald-300">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            <span>Live Station Cockpit</span>
          </div>

          <h3 className="mt-2 font-display text-xl sm:text-2xl font-extrabold text-white">
            {session.cafes?.name ?? "Arena"}
          </h3>
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <Monitor className="h-3.5 w-3.5 text-emerald-400" />
            <span>{session.devices?.name ?? "Station Rig"}</span>
            <span>·</span>
            <span className="font-mono text-emerald-400 uppercase">{session.devices?.type ?? "PC"}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 rounded-2xl border border-white/10 bg-black/30 p-3.5 sm:flex sm:items-center sm:gap-6 sm:border-0 sm:bg-transparent sm:p-0">
          <div className="sm:text-right">
            <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Elapsed Time</div>
            <div className="font-mono text-2xl sm:text-3xl font-black text-emerald-400 tabular-nums">
              {String(Math.floor(mins / 60)).padStart(2, "0")}:{String(mins % 60).padStart(2, "0")}:{String(secs).padStart(2, "0")}
            </div>
          </div>

          <div className="border-l border-white/10 pl-4 sm:pl-6 sm:text-right">
            <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Current Tab</div>
            <div className="font-display text-2xl sm:text-3xl font-black text-white tabular-nums">
              {inr(amount)}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function NextBookingCyberPass({ booking, onMessageCafe }: { booking: any; onMessageCafe: () => void }) {
  const at = new Date(booking.scheduled_at);
  const hoursLeft = Math.max(0, Math.round((at.getTime() - Date.now()) / 3600000));
  const cafe = booking.cafes;
  const device = booking.devices;

  return (
    <div className="relative overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-r from-card/60 via-card/40 to-primary/5 p-4 sm:p-5 backdrop-blur-xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary/20 text-primary">
            <CalendarRange className="h-6 w-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[10px] uppercase tracking-widest text-primary">Confirmed Seat Locked</span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(`BK-${booking.id.slice(0, 8).toUpperCase()}`);
                  toast.success("Booking ID copied to clipboard!");
                }}
                className="inline-flex min-h-[28px] items-center gap-1 rounded bg-white/10 px-2 py-0.5 font-mono text-[10px] font-bold text-white transition hover:bg-white/20"
                title="Click to copy Booking ID"
              >
                <Copy className="h-3 w-3 text-muted-foreground" />
                #BK-{booking.id.slice(0, 8).toUpperCase()}
              </button>
              <span className="rounded-full bg-amber-400/15 px-2 py-0.5 font-mono text-[9px] font-bold text-amber-300">
                In {hoursLeft <= 1 ? "Under 1 hour" : `${hoursLeft} hours`}
              </span>
            </div>
            <h4 className="mt-1 font-display text-lg font-bold text-white">{cafe?.name ?? "Café"}</h4>
            <div className="text-xs text-muted-foreground">
              {device?.name ?? "Gaming Station"} · {at.toLocaleDateString("en-IN", { weekday: "short", month: "short", day: "numeric" })} at {at.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}
            </div>
          </div>
        </div>

        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <Button size="sm" variant="outline" onClick={onMessageCafe} className="min-h-[44px] flex-1 sm:flex-initial gap-1.5 border-white/15 text-xs">
            <MessageSquare className="h-3.5 w-3.5 text-primary" /> Message Café
          </Button>
          {cafe?.city && (
            <a
              href={`https://maps.google.com/?q=${encodeURIComponent(`${cafe.name} ${cafe.city}`)}`}
              target="_blank"
              rel="noreferrer"
              className="flex-1 sm:flex-initial"
            >
              <Button size="sm" variant="outline" className="min-h-[44px] w-full border-white/15 text-xs">
                <MapPin className="mr-1 h-3.5 w-3.5 text-primary" /> Directions
              </Button>
            </a>
          )}
          <Link to="/portal" hash="bookings" className="w-full sm:w-auto">
            <Button size="sm" className="min-h-[44px] w-full text-xs font-semibold text-white" style={{ background: "var(--gradient-brand-hot)" }}>
              View Pass →
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function MembershipCyberCard({ m }: { m: any }) {
  const ends = new Date(m.ends_at).getTime();
  const starts = new Date(m.starts_at ?? Date.now()).getTime();
  const total = Math.max(1, ends - starts);
  const left = Math.max(0, ends - Date.now());
  const pct = Math.min(100, Math.max(0, (left / total) * 100));
  const days = Math.ceil(left / 86400000);

  return (
    <div className="rounded-2xl border border-amber-400/30 bg-amber-500/5 p-4 backdrop-blur">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Crown className="h-4 w-4 text-amber-400" />
          <span className="font-display text-sm font-bold text-white">{m.memberships?.name ?? "VIP Membership"}</span>
        </div>
        <span className="font-mono text-xs font-bold text-amber-400">{days}d left</span>
      </div>
      <div className="mt-2 text-[11px] text-muted-foreground">
        Valid until {new Date(m.ends_at).toLocaleDateString("en-IN", { dateStyle: "medium" })}
      </div>
      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-amber-400 transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function TxRow({ t }: { t: any }) {
  const credit = t.amount > 0;
  const Icon = t.kind === "refund" ? RotateCcw : credit ? ArrowDownLeft : ArrowUpRight;
  const label =
    t.kind === "topup"
      ? "Wallet top-up"
      : t.kind === "session"
      ? "Session payment"
      : t.kind === "refund"
      ? "Refund"
      : t.note || "Adjustment";

  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/5 bg-white/[0.02] p-3 transition hover:bg-white/[0.04]">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "grid h-9 w-9 place-items-center rounded-xl",
            credit ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/15 text-rose-400"
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <div className="text-xs font-semibold text-white">{label}</div>
          <div className="font-mono text-[10px] text-muted-foreground">
            {new Date(t.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
          </div>
        </div>
      </div>
      <div className={cn("font-mono text-sm font-bold tabular-nums", credit ? "text-emerald-400" : "text-rose-400")}>
        {credit ? "+" : "−"}{inr(Math.abs(t.amount))}
      </div>
    </div>
  );
}

/* ══════════════════ TAB 2 — MY BOOKINGS (BOARDING PASS FORMAT) ══════════════════ */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function BookingsTab({ onMessageCafe }: { onMessageCafe: (booking: any) => void }) {
  const fetchBookings = useServerFn(listMyBookings);
  const cancelFn = useServerFn(cancelMyBooking);
  const qc = useQueryClient();

  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [cancelTarget, setCancelTarget] = useState<any | null>(null);
  const { data } = useQuery({ queryKey: ["my-bookings"], queryFn: () => fetchBookings() });

  const cancelMutation = useMutation({
    mutationFn: cancelFn,
    onSuccess: () => {
      toast.success("Booking cancelled — full refund credited to your wallet.");
      qc.invalidateQueries({ queryKey: ["my-bookings"] });
      qc.invalidateQueries({ queryKey: ["portal-summary"] });
      qc.invalidateQueries({ queryKey: ["portal-home"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to cancel"),
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawList = Array.isArray(data) ? data : Array.isArray((data as any)?.data) ? (data as any).data : [];
  const all = Array.isArray(rawList) ? rawList : [];
  const now = Date.now();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const upcoming = all.filter((b: any) => b && ["pending", "confirmed"].includes(b?.status) && new Date(b?.scheduled_at).getTime() > now);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const past = all.filter((b: any) => b && !upcoming.includes(b));
  const list = tab === "upcoming" ? upcoming : past;

  return (
    <div className="space-y-6">
      {/* Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-2xl border border-white/10 bg-white/[0.03] p-1">
          {(["upcoming", "past"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              className={cn(
                "min-h-[40px] rounded-xl px-5 py-2 font-mono text-xs font-bold uppercase tracking-wider transition",
                tab === k
                  ? "bg-primary text-white shadow-md"
                  : "text-white/75 hover:text-white"
              )}
            >
              {k} ({k === "upcoming" ? upcoming.length : past.length})
            </button>
          ))}
        </div>

        <Link to="/discover">
          <Button size="sm" className="min-h-[40px] gap-1.5 text-xs font-bold text-white" style={{ background: "var(--gradient-brand-hot)" }}>
            <Plus className="h-3.5 w-3.5" /> Book New Rig
          </Button>
        </Link>
      </div>

      {list.length === 0 ? (
        <EmptyState
          icon={CalendarRange}
          title={tab === "upcoming" ? "No Active Rig Bookings" : "No Past Booking History"}
          description="Find a gaming café near you, choose your RTX or console setup, and lock your slot instantly."
          action={
            <Link to="/discover">
              <Button style={{ background: "var(--gradient-brand-hot)" }}>
                Browse Arenas <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-4">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {list.map((booking: any) => (
            <CyberBoardingPass
              key={booking.id}
              booking={booking}
              canCancel={tab === "upcoming" && (booking.status === "pending" || booking.status === "confirmed")}
              onCancel={() => setCancelTarget(booking)}
              onMessageCafe={() => onMessageCafe(booking)}
              isCancelling={cancelMutation.isPending}
            />
          ))}
        </div>
      )}

      <ConfirmModal
        open={!!cancelTarget}
        onOpenChange={(o) => !o && setCancelTarget(null)}
        title="Cancel this booking?"
        description={
          cancelTarget
            ? `Cancel #BK-${String(cancelTarget.id).slice(0, 8).toUpperCase()} at ${cancelTarget.cafes?.name ?? "this café"}? Any paid deposit is refunded back to your wallet immediately.`
            : undefined
        }
        confirmLabel="Cancel Booking"
        onConfirm={() =>
          cancelTarget
            ? cancelMutation.mutateAsync({ data: { id: cancelTarget.id } })
            : Promise.resolve()
        }
      />
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CyberBoardingPass({
  booking,
  canCancel,
  onCancel,
  onMessageCafe,
  isCancelling,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  booking: any;
  canCancel?: boolean;
  onCancel?: () => void;
  onMessageCafe?: () => void;
  isCancelling?: boolean;
}) {
  const cafe = booking.cafes;
  const device = booking.devices;
  const at = new Date(booking.scheduled_at);
  const isConfirmed = booking.status === "confirmed";
  const isPending = booking.status === "pending";
  const isCancelled = booking.status === "cancelled";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative flex flex-col justify-between overflow-hidden rounded-3xl border border-white/10 bg-[#0e0c1a] shadow-xl md:flex-row"
    >
      {/* Left Station Info Section */}
      <div className="flex-1 p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-widest text-primary">Station Pass</span>
            <span className="text-white/20">·</span>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(`BK-${booking.id.slice(0, 8).toUpperCase()}`);
                toast.success("Booking ID copied to clipboard!");
              }}
              className="inline-flex items-center gap-1 rounded bg-white/10 px-2 py-0.5 font-mono text-xs font-bold text-white transition hover:bg-white/20"
              title="Click to copy Booking ID"
            >
              <Copy className="h-3 w-3 text-muted-foreground" />
              #BK-{booking.id.slice(0, 8).toUpperCase()}
            </button>
          </div>

          <div>
            {isConfirmed ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-500/15 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Seat Locked
              </span>
            ) : isPending ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-400/15 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-amber-300 animate-pulse">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                Awaiting Café Review
              </span>
            ) : isCancelled ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/40 bg-rose-500/15 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-rose-300">
                Cancelled & Refunded
              </span>
            ) : (
              <Badge variant="secondary">{booking.status}</Badge>
            )}
          </div>
        </div>

        <h3 className="mt-3 font-display text-2xl font-black text-white">{cafe?.name ?? "Gaming Café"}</h3>

        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
          <MapPin className="h-3.5 w-3.5 text-primary" />
          <span>{cafe?.city || "India"}</span>
          <span>·</span>
          <span>{device?.name ?? "Rig"} ({(device?.type ?? "PC").toUpperCase()})</span>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-4 border-t border-white/5 pt-4 sm:grid-cols-3">
          <div>
            <div className="font-mono text-[10px] uppercase text-muted-foreground">Date</div>
            <div className="font-semibold text-sm text-white">
              {at.toLocaleDateString("en-IN", { weekday: "short", month: "short", day: "numeric" })}
            </div>
          </div>
          <div>
            <div className="font-mono text-[10px] uppercase text-muted-foreground">Slot Time</div>
            <div className="font-mono font-bold text-sm text-emerald-400">
              {at.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} ({booking.duration_minutes}m)
            </div>
          </div>
          <div>
            <div className="font-mono text-[10px] uppercase text-muted-foreground">Deposit</div>
            <div className="font-mono font-bold text-sm text-white">
              {booking.deposit_amount ? inr(booking.deposit_amount) : "₹0 (Pay at counter)"}
            </div>
          </div>
        </div>
      </div>

      {/* Perforated Divider for Desktop */}
      <div className="relative hidden w-0 border-r border-dashed border-white/20 md:block">
        <div className="absolute -top-3 -left-3 h-6 w-6 rounded-full bg-[#07060d]" />
        <div className="absolute -bottom-3 -left-3 h-6 w-6 rounded-full bg-[#07060d]" />
      </div>

      {/* Right Ticket Stub / Check-in QR */}
      <div className="flex flex-col justify-between border-t border-dashed border-white/20 bg-black/40 p-6 md:w-64 md:border-t-0">
        <div className="text-center">
          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-2xl border border-white/10 bg-white p-2">
            <QrCode className="h-full w-full text-black" />
          </div>
          <div className="mt-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Show at counter to unlock
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onMessageCafe}
            className="min-h-[38px] w-full gap-1.5 border-white/15 text-xs"
          >
            <MessageSquare className="h-3.5 w-3.5 text-primary" /> Message Café
          </Button>

          {cafe?.slug && (
            <Link to="/c/$slug" params={{ slug: cafe.slug }} className="w-full">
              <Button size="sm" variant="outline" className="min-h-[38px] w-full border-white/15 text-xs">
                Café Info &amp; Menu
              </Button>
            </Link>
          )}

          {canCancel && (
            <Button
              size="sm"
              variant="destructive"
              onClick={onCancel}
              disabled={isCancelling}
              className="min-h-[38px] w-full text-xs"
            >
              <X className="mr-1 h-3 w-3" /> Cancel Booking
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/* ══════════════════ TAB 3 — TACTILE CYBER WALLET ══════════════════ */

const QUICK_TOPUP_CHIPS = [100, 200, 500, 1000];

function WalletTab() {
  const fetchLedger = useServerFn(getMyWalletLedger);
  const fetchCfg = useServerFn(getRazorpayConfig);
  const createOrder = useServerFn(createTopupOrder);
  const verify = useServerFn(verifyTopupPayment);
  const fetchProfile = useServerFn(getMyProfile);
  const submitProof = useServerFn(customerSubmitTopupProof);
  const qc = useQueryClient();

  const { data } = useQuery({ queryKey: ["portal-wallet"], queryFn: () => fetchLedger() });
  const { data: cfg } = useQuery({ queryKey: ["rzp-config"], queryFn: () => fetchCfg() });
  const { data: profile } = useQuery({ queryKey: ["my-profile"], queryFn: () => fetchProfile() });

  const [topupModalOpen, setTopupModalOpen] = useState(false);
  const [amount, setAmount] = useState(500);
  const [customAmount, setCustomAmount] = useState("");
  const [cafeId, setCafeId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [payMethod, setPayMethod] = useState<"gateway" | "upi">("gateway");
  const [utrNumber, setUtrNumber] = useState("");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const customers = (data?.customers ?? []) as any[];
  useEffect(() => {
    if (!cafeId && customers[0]) setCafeId(customers[0].cafe_id);
  }, [customers, cafeId]);

  const selectedCustomer = customers.find((c) => c.cafe_id === cafeId) ?? customers[0];
  const cafeUpiMap = (data?.cafeUpi ?? {}) as Record<string, { upi_id: string | null; upi_qr_url: string | null }>;
  const activeCafeUpi = selectedCustomer ? cafeUpiMap[selectedCustomer.cafe_id] : undefined;
  const hasCafeUpi = Boolean(activeCafeUpi?.upi_id?.trim());
  const finalAmount = customAmount ? Math.max(0, parseInt(customAmount, 10) || 0) : amount;

  const proofMutation = useMutation({
    mutationFn: submitProof,
    onSuccess: () => {
      toast.success("Top-up proof submitted! Your wallet will be credited once the café verifies your UTR.");
      qc.invalidateQueries({ queryKey: ["portal-wallet"] });
      qc.invalidateQueries({ queryKey: ["portal-summary"] });
      setTopupModalOpen(false);
      setUtrNumber("");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Top-up failed"),
  });

  async function handleTopup() {
    if (!selectedCustomer) {
      toast.error("Visit or book at a café first to link your wallet.");
      return;
    }
    if (finalAmount < 1) {
      toast.error("Please enter a valid amount");
      return;
    }

    if (payMethod === "upi" || !cfg?.enabled) {
      if (!hasCafeUpi) {
        toast.error("This café has not enabled Direct UPI yet. Please top up at the counter.");
        return;
      }
      if (!utrNumber.trim() || utrNumber.trim().length < 6) {
        toast.error("Please enter a valid UPI UTR or Transaction Reference (min 6 characters)");
        return;
      }
      proofMutation.mutate({
        data: {
          cafe_id: selectedCustomer.cafe_id,
          customer_id: selectedCustomer.id,
          amount: finalAmount,
          utr_number: utrNumber.trim(),
        },
      });
      return;
    }

    setBusy(true);
    try {
      const ok = await loadRazorpayScript();
      if (!ok) throw new Error("Could not load payment gateway");

      const order = await createOrder({
        data: {
          cafe_id: selectedCustomer.cafe_id,
          customer_id: selectedCustomer.id,
          amount: finalAmount,
        },
      });

      const rzp = new window.Razorpay!({
        key: order.key_id,
        amount: finalAmount * 100,
        currency: "INR",
        order_id: order.order_id,
        name: "CoreCade Cyber Wallet",
        description: `Wallet top-up · ${selectedCustomer.cafes?.name ?? "Gaming Arena"}`,
        prefill: {
          name: profile?.full_name ?? undefined,
          email: profile?.email ?? undefined,
          contact: profile?.phone ?? undefined,
        },
        theme: { color: "#ff006e" },
        modal: { ondismiss: () => setBusy(false) },
        handler: async (resp) => {
          try {
            await verify({ data: { topup_id: order.topup_id, ...resp } });
            toast.success(`${inr(finalAmount)} added to your wallet!`);
            qc.invalidateQueries({ queryKey: ["portal-wallet"] });
            qc.invalidateQueries({ queryKey: ["portal-summary"] });
            setTopupModalOpen(false);
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Verification failed");
          } finally {
            setBusy(false);
          }
        },
      });
      rzp.open();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Payment failed");
      setBusy(false);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const txs = (data?.transactions ?? []) as any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const topupRequests = (data?.topupRequests ?? []) as any[];
  const cafeUpiId = activeCafeUpi?.upi_id?.trim() ?? "";
  const cafeQrImg =
    activeCafeUpi?.upi_qr_url ||
    (cafeUpiId
      ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
          `upi://pay?pa=${cafeUpiId}&pn=${encodeURIComponent(selectedCustomer?.cafes?.name ?? "Gaming Cafe")}&am=${finalAmount}&cu=INR`,
        )}`
      : null);

  return (
    <div className="space-y-8">
      {/* 3D HOLOGRAPHIC TITANIUM CYBER WALLET CARD */}
      <motion.div
        whileHover={{ y: -4, rotateX: 2 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        className="relative mx-auto max-w-xl overflow-hidden rounded-3xl border border-white/20 p-5 sm:p-8 shadow-2xl backdrop-blur-2xl"
        style={{
          background: "linear-gradient(135deg, rgba(255,0,110,0.18) 0%, rgba(123,47,255,0.25) 50%, rgba(0,229,160,0.15) 100%), #0d0a1c",
          boxShadow: "0 25px 60px -15px oklch(0.7 0.26 335 / 0.4)",
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-display text-lg font-black tracking-wider text-white">CORECADE</span>
            <span className="rounded bg-white/20 px-1.5 py-0.5 font-mono text-[9px] font-bold text-white">NFC PASS</span>
          </div>
          <Flame className="h-6 w-6 text-primary" />
        </div>

        <div className="mt-6 sm:mt-8">
          <div className="font-mono text-[10px] uppercase tracking-widest text-white/70">Available Balance</div>
          <div className="font-display text-4xl sm:text-5xl font-black tracking-tight text-white tabular-nums drop-shadow-md">
            {inr(data?.balance ?? 0)}
          </div>
        </div>

        <div className="mt-6 sm:mt-8 flex items-end justify-between">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-wider text-white/60">Cardholder</div>
            <div className="font-display text-sm font-bold text-white">{profile?.full_name || "PRO GAMER"}</div>
          </div>
          <div className="text-right">
            <div className="font-mono text-[10px] uppercase tracking-wider text-white/60">Instant Top-Up</div>
            <div className="font-mono text-xs font-semibold text-emerald-300">Zero Convenience Fee</div>
          </div>
        </div>
      </motion.div>

      {/* Action Buttons */}
      <div className="mx-auto flex max-w-xl flex-col gap-2.5 sm:flex-row sm:gap-3">
        <Button
          onClick={() => setTopupModalOpen(true)}
          disabled={customers.length === 0}
          className="h-12 flex-1 gap-2 text-xs font-bold text-white shadow-xl transition-transform hover:-translate-y-0.5"
          style={{ background: "var(--gradient-brand-hot)" }}
        >
          <Plus className="h-4 w-4" /> Add Money to Wallet
        </Button>
        <Link to="/discover" className="flex-1">
          <Button variant="outline" className="w-full h-12 text-xs font-semibold border-white/15">
            Book Arena Slot →
          </Button>
        </Link>
      </div>

      {/* Cafes Switcher if customer frequents multiple arenas */}
      {customers.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground mr-1">Arena Balance:</span>
          {customers.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCafeId(c.cafe_id)}
              className={cn(
                "min-h-[40px] rounded-xl border px-3.5 py-1.5 text-xs font-semibold transition",
                cafeId === c.cafe_id
                  ? "border-primary bg-primary/20 text-white"
                  : "border-white/10 text-muted-foreground hover:text-white"
              )}
            >
              {c.cafes?.name ?? "Café"} · {inr(c.wallet_balance ?? 0)}
            </button>
          ))}
        </div>
      )}

      {/* UPI Verification Requests */}
      {topupRequests.length > 0 && (
        <div>
          <div className="mb-3 font-mono text-[10px] uppercase tracking-widest text-primary">
            UPI Verification Status
          </div>
          <div className="space-y-2">
            {topupRequests.map((req) => {
              const utr = String(req.notes?.utr_number ?? String(req.razorpay_payment_id ?? "").replace(/^UTR:/, ""));
              const isPaid = req.status === "paid";
              const isFailed = req.status === "failed";
              return (
                <div
                  key={req.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs backdrop-blur"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-white">
                      {req.cafes?.name ?? "Gaming Café"} · <span className="font-mono tabular-nums">{inr(req.amount)}</span>
                    </div>
                    <div className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                      UTR: {utr || "—"} · {new Date(req.created_at).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </div>
                    {isFailed && req.notes?.review_note && (
                      <div className="mt-1 text-[11px] text-rose-300">{req.notes.review_note}</div>
                    )}
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      "shrink-0 font-mono text-[10px] uppercase",
                      isPaid
                        ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                        : isFailed
                        ? "border-rose-500/40 bg-rose-500/15 text-rose-300"
                        : "border-amber-500/40 bg-amber-500/15 text-amber-300",
                    )}
                  >
                    {isPaid ? "Verified & Credited" : isFailed ? "Rejected" : "Pending Verification"}
                  </Badge>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Transaction History */}
      <div>
        <div className="mb-3 font-mono text-[10px] uppercase tracking-widest text-primary">All Wallet Transactions</div>
        {txs.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="No Transactions Yet"
            description="Add money to your wallet to pay instantly at café counters and lock online slots."
          />
        ) : (
          <div className="space-y-2">
            {txs.map((t) => (
              <TxRow key={t.id} t={t} />
            ))}
          </div>
        )}
      </div>

      {/* Top-up Dialog */}
      <Dialog open={topupModalOpen} onOpenChange={setTopupModalOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto max-w-md border-white/15 bg-[#0e0c1a] text-foreground">
          <DialogTitle className="font-display text-xl font-bold text-white">Add Money to Cyber Wallet</DialogTitle>
          <div className="mt-3 space-y-4">
            {/* Café selector when player has >1 café */}
            {customers.length > 0 && (
              <div className="space-y-1.5">
                <Label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Target Gaming Café</Label>
                {customers.length > 1 ? (
                  <select
                    value={selectedCustomer?.cafe_id ?? ""}
                    onChange={(e) => setCafeId(e.target.value)}
                    className="h-11 w-full rounded-xl border border-white/15 bg-black/40 px-3 text-xs font-semibold text-white"
                  >
                    {customers.map((c) => (
                      <option key={c.id} value={c.cafe_id}>
                        {c.cafes?.name ?? "Café"} (Bal: {inr(c.wallet_balance ?? 0)})
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-xs font-semibold text-white">
                    {selectedCustomer?.cafes?.name ?? "Gaming Café"}
                  </div>
                )}
              </div>
            )}

            {/* Quick Chips */}
            <div className="grid grid-cols-4 gap-2">
              {QUICK_TOPUP_CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => {
                    setAmount(chip);
                    setCustomAmount("");
                  }}
                  className={cn(
                    "min-h-[42px] rounded-xl border py-2.5 text-xs font-bold tabular-nums transition",
                    !customAmount && amount === chip
                      ? "border-primary bg-primary/20 text-white shadow"
                      : "border-white/10 bg-white/[0.03] text-muted-foreground hover:text-white"
                  )}
                >
                  ₹{chip}
                </button>
              ))}
            </div>

            {/* Custom Input */}
            <div className="space-y-1.5">
              <Label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Custom Amount</Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₹</span>
                <Input
                  className="h-11 pl-8 font-mono text-base tabular-nums"
                  inputMode="numeric"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value.replace(/\D/g, ""))}
                  placeholder="Enter amount (e.g. 750)"
                />
              </div>
            </div>

            {/* Payment Method Switcher */}
            {cfg?.enabled && (
              <div className="flex rounded-xl border border-white/10 bg-white/[0.03] p-1">
                <button
                  type="button"
                  onClick={() => setPayMethod("gateway")}
                  className={cn(
                    "min-h-[38px] flex-1 rounded-lg py-2 text-xs font-semibold transition",
                    payMethod === "gateway" ? "bg-primary text-white shadow" : "text-muted-foreground"
                  )}
                >
                  Razorpay Instant
                </button>
                <button
                  type="button"
                  onClick={() => setPayMethod("upi")}
                  className={cn(
                    "min-h-[38px] flex-1 rounded-lg py-2 text-xs font-semibold transition",
                    payMethod === "upi" ? "bg-primary text-white shadow" : "text-muted-foreground"
                  )}
                >
                  Direct Café UPI
                </button>
              </div>
            )}

            {/* Direct UPI details */}
            {(payMethod === "upi" || !cfg?.enabled) && (
              hasCafeUpi ? (
                <div className="space-y-3 rounded-2xl border border-primary/25 bg-primary/5 p-4">
                  {cafeQrImg && (
                    <div className="mx-auto w-fit overflow-hidden rounded-xl bg-white p-2">
                      <img src={cafeQrImg} alt={`${selectedCustomer?.cafes?.name ?? "Café"} UPI QR`} className="h-36 w-36 object-contain" />
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-muted-foreground">Café UPI ID:</span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(cafeUpiId);
                        toast.success("Café UPI ID copied!");
                      }}
                      className="flex min-h-[36px] items-center gap-1.5 font-mono font-bold text-primary hover:underline"
                    >
                      <span className="truncate max-w-[180px]">{cafeUpiId}</span>
                      <Copy className="h-3.5 w-3.5 shrink-0" />
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      12-Digit UPI Reference / UTR Number *
                    </Label>
                    <Input
                      value={utrNumber}
                      onChange={(e) => setUtrNumber(e.target.value)}
                      placeholder="e.g. 431289012345"
                      className="h-11 font-mono text-sm"
                    />
                    <p className="text-[11px] leading-relaxed text-muted-foreground">
                      Transfer {inr(finalAmount)} to <span className="font-mono text-foreground">{cafeUpiId}</span>, then submit the UTR. Balance credits once verified by the café.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs leading-relaxed text-amber-200">
                  <b>{selectedCustomer?.cafes?.name ?? "This café"}</b> hasn&apos;t set up Direct UPI details yet. Please ask at the café counter to top up your wallet{cfg?.enabled ? ", or switch to Razorpay Instant above." : "."}
                </div>
              )
            )}

            <Button
              onClick={handleTopup}
              disabled={
                busy ||
                proofMutation.isPending ||
                finalAmount < 1 ||
                !selectedCustomer ||
                ((payMethod === "upi" || !cfg?.enabled) && !hasCafeUpi)
              }
              className="h-12 w-full text-xs font-bold text-white shadow-xl"
              style={{ background: "var(--gradient-brand-hot)" }}
            >
              {busy || proofMutation.isPending
                ? "Processing…"
                : payMethod === "upi" || !cfg?.enabled
                ? `Submit ${inr(finalAmount)} UPI Proof for Verification →`
                : `Pay ${inr(finalAmount)} Instantly →`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ══════════════════ TAB 4 — TOURNAMENTS ══════════════════ */

function TournamentsTab() {
  const fetchTournaments = useServerFn(getMyTournaments);
  const { data } = useQuery({ queryKey: ["portal-tournaments"], queryFn: () => fetchTournaments() });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mine = (data?.mine ?? []) as any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const upcoming = (data?.upcoming ?? []) as any[];

  return (
    <div className="space-y-8">
      <div>
        <div className="mb-3 font-mono text-[10px] uppercase tracking-widest text-primary">Registered Tournaments</div>
        {mine.length === 0 ? (
          <EmptyState
            icon={Trophy}
            title="No Active Registrations"
            description="Sign up for an arena tournament below to compete for cash prize pools and leaderboard glory."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {mine.map((r) => {
              const t = r.tournaments;
              if (!t) return null;
              return <TournamentCyberCard key={r.id} t={t} note={`Team: ${r.team_name}`} />;
            })}
          </div>
        )}
      </div>

      <div>
        <div className="mb-3 font-mono text-[10px] uppercase tracking-widest text-primary">Open Brackets & Championships</div>
        {upcoming.length === 0 ? (
          <EmptyState
            icon={Trophy}
            title="No Upcoming Brackets"
            description="Cafés post weekly Valorant, CS2, Tekken, and FIFA brackets. Check back soon."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {upcoming.map((t) => (
              <TournamentCyberCard key={t.id} t={t} register />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function TournamentCyberCard({ t, note, register }: { t: any; note?: string; register?: boolean }) {
  const cafe = t.cafes as { name?: string; slug?: string } | null;

  return (
    <div className="rounded-3xl border border-white/10 bg-card/40 p-5 backdrop-blur-xl transition hover:border-primary/40">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-widest text-primary">{t.game || "Esports"}</span>
            <span className="text-white/20">·</span>
            <span className="text-xs text-muted-foreground">{t.format || "5v5 Bracket"}</span>
          </div>
          <h4 className="mt-1 font-display text-lg font-bold text-white">{t.title}</h4>
          <div className="text-xs text-muted-foreground mt-0.5">{cafe?.name ?? "Arena"}</div>
          {note && <div className="mt-1 font-mono text-xs text-emerald-400">{note}</div>}
        </div>

        <Badge variant={t.status === "live" ? "default" : "secondary"}>
          {t.status}
        </Badge>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-3">
        <div>
          <span className="font-mono text-[10px] uppercase text-muted-foreground block">Prize Pool</span>
          <span className="font-display font-black text-amber-300 text-base">{inr(t.prize_pool ?? 0)}</span>
        </div>

        {cafe?.slug && (
          <Link to="/c/$slug/tournaments/$id" params={{ slug: cafe.slug, id: t.id }}>
            <Button size="sm" variant="outline" className="text-xs border-white/10">
              {register ? "Register Team" : "View Bracket"} →
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}

/* ══════════════════ TAB 5 — BOOKING & ARENA SUPPORT CHAT ══════════════════ */

function SupportTab({ prefill }: { prefill: BookingSupportPrefill | null }) {
  const fetchBookings = useServerFn(listMyBookings);
  const { data } = useQuery({ queryKey: ["my-bookings"], queryFn: () => fetchBookings() });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawList = Array.isArray(data) ? data : Array.isArray((data as any)?.data) ? (data as any).data : [];
  const bookings = Array.isArray(rawList) ? rawList : [];

  return (
    <div className="space-y-4">
      <SupportTickets role="customer" bookingPrefill={prefill} bookings={bookings} />
    </div>
  );
}

/* ══════════════════ TAB 6 — PROFILE & SECURITY ══════════════════ */

function ProfileTab() {
  const fetchFn = useServerFn(getMyProfile);
  const updateFn = useServerFn(updateMyProfile);
  const qc = useQueryClient();

  const { data: profile } = useQuery({ queryKey: ["my-profile"], queryFn: () => fetchFn() });
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [confirmSignout, setConfirmSignout] = useState(false);

  useEffect(() => {
    if (profile) {
      setName(profile.full_name ?? "");
      setPhone((profile.phone ?? "").replace(/^\+91/, ""));
    }
  }, [profile]);

  const updateMutation = useMutation({
    mutationFn: updateFn,
    onSuccess: () => {
      toast.success("Profile updated successfully");
      qc.invalidateQueries({ queryKey: ["my-profile"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to update profile"),
  });

  async function handleSignOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    window.location.href = "/auth";
  }

  return (
    <div className="max-w-xl space-y-6">
      <div className="rounded-3xl border border-white/10 bg-card/40 p-6 text-center backdrop-blur-xl">
        <div
          className="mx-auto grid h-20 w-20 place-items-center rounded-2xl font-display text-2xl font-black text-white shadow-xl"
          style={{ background: "var(--gradient-brand-hot)" }}
        >
          {(name || profile?.email || "P").slice(0, 2).toUpperCase()}
        </div>
        <h3 className="mt-3 font-display text-2xl font-bold text-white">{name || "Gamer"}</h3>
        <p className="text-xs text-muted-foreground font-mono">{profile?.email}</p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          updateMutation.mutate({
            data: {
              full_name: name.trim(),
              phone: phone ? `+91${phone.replace(/\D/g, "").slice(-10)}` : null,
            },
          });
        }}
        className="space-y-4 rounded-3xl border border-white/10 bg-card/40 p-6 backdrop-blur-xl"
      >
        <div className="font-mono text-[10px] uppercase tracking-widest text-primary">Identity Details</div>
        <div className="space-y-1.5">
          <Label className="text-xs">Gamer Handle / Full Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Phone Number (For Booking SMS Confirmation)</Label>
          <div className="flex items-center gap-2">
            <span className="rounded-md border border-white/10 bg-black/40 px-3 py-2 font-mono text-sm">🇮🇳 +91</span>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
              inputMode="numeric"
              placeholder="9876543210"
            />
          </div>
        </div>

        <Button
          type="submit"
          disabled={updateMutation.isPending}
          className="w-full text-xs font-bold text-white"
          style={{ background: "var(--gradient-brand-hot)" }}
        >
          {updateMutation.isPending ? "Saving Changes…" : "Update Profile"}
        </Button>
      </form>

      <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-card/40 p-4">
        <div>
          <div className="font-semibold text-sm text-white">Password & Security</div>
          <div className="text-xs text-muted-foreground">Change credentials or setup MFA</div>
        </div>
        <Link to="/reset-password">
          <Button variant="outline" size="sm" className="text-xs border-white/10">
            <KeyRound className="h-3.5 w-3.5 mr-1" /> Reset Password
          </Button>
        </Link>
      </div>

      <Button
        variant="outline"
        onClick={() => setConfirmSignout(true)}
        className="w-full border-destructive/40 text-xs text-destructive hover:bg-destructive/10"
      >
        <LogOut className="h-3.5 w-3.5 mr-1.5" /> Sign Out from CoreCade
      </Button>

      <Dialog open={confirmSignout} onOpenChange={setConfirmSignout}>
        <DialogContent className="max-w-sm border-white/15 bg-[#0e0c1a] text-foreground">
          <DialogTitle className="font-display text-lg font-bold text-white">Sign Out?</DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">
            You will need to sign in again to view your bookings and access your cyber wallet.
          </p>
          <div className="mt-4 flex gap-2">
            <Button variant="outline" className="flex-1 text-xs" onClick={() => setConfirmSignout(false)}>
              Stay Signed In
            </Button>
            <Button
              className="flex-1 text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleSignOut}
            >
              Sign Out
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
