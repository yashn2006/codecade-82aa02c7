import { createFileRoute, Link, useRouterState } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Home, CalendarRange, User as UserIcon, Gamepad2, MapPin, Wallet, Crown,
  Trophy, Clock, X, Plus, ArrowRight, ArrowDownLeft, ArrowUpRight, RotateCcw,
  LogOut, KeyRound, Compass, Zap,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { ConsoleShell } from "@/components/ConsoleShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/EmptyState";
import { PageSkeleton, Skeleton } from "@/components/LoadingSkeleton";
import { listMyBookings } from "@/lib/bookings.functions";
import { getMyRoles } from "@/lib/me.functions";
import { getMyOwnedCafes } from "@/lib/cafes.functions";
import { getPlatformMaintenance } from "@/lib/platform.functions";
import {
  getMyPortalSummary, cancelMyBooking, getMyProfile, updateMyProfile,
  getMyPortalHome, getMyWalletLedger, getMyTournaments,
} from "@/lib/portal.functions";
import { createTopupOrder, verifyTopupPayment, getRazorpayConfig } from "@/lib/razorpay.functions";
import { MaintenanceBanner } from "@/components/MaintenanceBanner";
import { supabase } from "@/lib/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type RzpOpts = {
  key: string; amount: number; currency: string; order_id: string; name: string; description: string;
  handler: (r: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => void;
  prefill?: { name?: string; email?: string; contact?: string };
  modal?: { ondismiss?: () => void }; theme?: { color?: string };
};
declare global { interface Window { Razorpay?: new (o: RzpOpts) => { open: () => void } } }

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
      { title: "My Portal — CoreCade" },
      { name: "description", content: "Your bookings, wallet, memberships and tournaments across every CoreCade café." },
      { property: "og:title", content: "My Portal — CoreCade" },
      { property: "og:description", content: "Your bookings, wallet, memberships and tournaments across every CoreCade café." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Portal,
});

type TabKey = "home" | "bookings" | "wallet" | "tournaments" | "profile";
const TABS: { key: TabKey; label: string; icon: typeof Home }[] = [
  { key: "home", label: "Home", icon: Home },
  { key: "bookings", label: "Bookings", icon: CalendarRange },
  { key: "wallet", label: "Wallet", icon: Wallet },
  { key: "tournaments", label: "Tournaments", icon: Trophy },
  { key: "profile", label: "Profile", icon: UserIcon },
];

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

function Portal() {
  const fetchRoles = useServerFn(getMyRoles);
  const fetchOwned = useServerFn(getMyOwnedCafes);
  const fetchPlat = useServerFn(getPlatformMaintenance);
  const fetchSummary = useServerFn(getMyPortalSummary);
  const { data: roleData } = useQuery({ queryKey: ["my-roles"], queryFn: () => fetchRoles() });
  const { data: ownedCafes } = useQuery({ queryKey: ["my-owned-cafes"], queryFn: () => fetchOwned() });
  const { data: platform } = useQuery({ queryKey: ["platform-maintenance"], queryFn: () => fetchPlat(), refetchInterval: 60_000 });
  const { data: summary } = useQuery({ queryKey: ["portal-summary"], queryFn: () => fetchSummary() });
  const roles = roleData?.roles ?? [];
  const isSuper = roles.some((r) => r.role === "super_admin");
  const ownerCafe = (ownedCafes ?? [])[0];

  const hash = useRouterState({ select: (s) => (s.location.hash ?? "").replace(/^#/, "") });
  const active: TabKey = TABS.find((t) => t.key === hash)?.key ?? "home";

  return (
    <ConsoleShell
      badge="Customer"
      title="Your Arcade"
      subtitle="Sessions, wallet, tournaments — all in one place."
      nav={TABS.map((t) => ({
        label: t.label,
        icon: t.icon,
        to: "/portal",
        exact: true,
        hash: t.key === "home" ? "" : t.key,
      }))}
      intensity="hero"
    >
      <div className="mb-4"><MaintenanceBanner window={platform} title="CoreCade network maintenance" /></div>
      {(isSuper || ownerCafe) && (
        <div className="mb-6 flex flex-wrap gap-2">
          {isSuper && <Link to="/admin"><Button variant="outline" size="sm">Open Super Admin →</Button></Link>}
          {ownerCafe && <Link to="/owner"><Button variant="outline" size="sm">Open Owner Dashboard →</Button></Link>}
        </div>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={active}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
        >
          {active === "home" && <HomeTab summary={summary} />}
          {active === "bookings" && <BookingsTab />}
          {active === "wallet" && <WalletTab />}
          {active === "tournaments" && <TournamentsTab />}
          {active === "profile" && <ProfileTab />}
        </motion.div>
      </AnimatePresence>
    </ConsoleShell>
  );
}

/* ══════════════════ TAB 1 — HOME ══════════════════ */

function useTick(ms = 1000) {
  const [, setN] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setN((n) => n + 1), ms);
    return () => window.clearInterval(id);
  }, [ms]);
}

function HomeTab({ summary }: { summary: Awaited<ReturnType<typeof getMyPortalSummary>> | undefined }) {
  const fetchHome = useServerFn(getMyPortalHome);
  const fetchProfile = useServerFn(getMyProfile);
  const { data, isLoading } = useQuery({ queryKey: ["portal-home"], queryFn: () => fetchHome(), refetchInterval: 30_000 });
  const { data: profile } = useQuery({ queryKey: ["my-profile"], queryFn: () => fetchProfile() });

  const firstName = (profile?.full_name || profile?.email || "Gamer").split(" ")[0].split("@")[0];
  const initials = firstName.slice(0, 2).toUpperCase();

  if (isLoading) return <PageSkeleton rows={2} />;

  const active = data?.activeSession as any;
  const next = data?.nextBooking as any;
  const memberships = (data?.memberships ?? []) as any[];
  const activity = (data?.activity ?? []) as any[];

  return (
    <div className="space-y-4">
      {/* Greeting */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="grid h-[52px] w-[52px] place-items-center rounded-full font-display text-lg font-black text-white"
            style={{ background: "linear-gradient(135deg,#ff006e,#7b2fff)", border: "2px solid rgba(255,0,110,0.3)" }}
          >
            {initials}
          </div>
          <h2 className="font-display text-2xl font-bold">Hey, {firstName} 👋</h2>
        </div>
        <Link
          to="/portal" hash="wallet"
          className="inline-flex items-center gap-3 rounded-full px-4 py-2"
          style={{ background: "rgba(255,0,110,0.1)", border: "1px solid rgba(255,0,110,0.2)" }}
        >
          <span className="font-display text-lg font-bold tabular-nums">{inr(summary?.walletTotal ?? 0)}</span>
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary"><Plus className="h-3 w-3" /> Top Up</span>
        </Link>
      </div>

      {active && <ActiveSessionCard s={active} />}
      {next && <NextBookingCard b={next} />}
      {memberships.map((m) => <MembershipCard key={m.id} m={m} />)}

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniStat icon={CalendarRange} label="Upcoming" value={String(summary?.upcoming ?? 0)} />
        <MiniStat icon={Clock} label="Hours played" value={String(summary?.totalHours ?? 0)} />
        <MiniStat icon={Trophy} label="Cafés visited" value={String(summary?.cafesVisited ?? 0)} />
        <MiniStat icon={Zap} label="Sessions" value={String(summary?.completed ?? 0)} />
      </div>

      {/* Recent activity */}
      <div className="rounded-2xl border border-border/60 bg-card/40 p-4 backdrop-blur">
        <div className="mb-3 flex items-center justify-between">
          <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Recent activity</div>
          <Link to="/portal" hash="wallet" className="text-xs text-primary hover:underline">View all</Link>
        </div>
        {activity.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Nothing yet — your sessions and top-ups land here.</p>
        ) : (
          <div className="space-y-2">{activity.slice(0, 3).map((t) => <TxRow key={t.id} t={t} />)}</div>
        )}
      </div>

      {(!active && !next) && (
        <EmptyState
          icon={Compass} title="Ready to play?"
          description="Find an arena near you and lock a rig in under a minute."
          action={<Link to="/discover"><Button style={{ background: "var(--gradient-brand-hot)" }}>Find a Café <ArrowRight className="ml-1 h-4 w-4" /></Button></Link>}
        />
      )}
    </div>
  );
}

function MiniStat({ icon: Icon, label, value }: { icon: typeof Wallet; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/40 p-4 backdrop-blur">
      <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        <Icon className="h-3.5 w-3.5 text-primary" /> {label}
      </div>
      <div className="mt-1.5 font-display text-2xl font-extrabold tabular-nums">{value}</div>
    </div>
  );
}

function ActiveSessionCard({ s }: { s: any }) {
  useTick(1000);
  const started = new Date(s.started_at).getTime();
  const mins = Math.max(0, Math.floor((Date.now() - started) / 60000));
  const secs = Math.max(0, Math.floor((Date.now() - started) / 1000) % 60);
  const rate = s.devices?.hourly_rate ?? 0;
  const amount = Math.ceil((rate * mins) / 60);
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-[20px] p-5"
      style={{ background: "rgba(0,255,100,0.04)", border: "1px solid rgba(0,255,100,0.3)", boxShadow: "0 0 40px rgba(0,255,100,0.08)" }}
    >
      <motion.div
        aria-hidden className="pointer-events-none absolute inset-0"
        animate={{ opacity: [0.25, 0.5, 0.25] }} transition={{ duration: 3, repeat: Infinity }}
        style={{ background: "radial-gradient(60% 60% at 50% 0%, rgba(0,255,100,0.10), transparent 70%)" }}
      />
      <div className="relative">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-emerald-300">
          🟢 Live session
        </span>
        <div className="mt-3 font-display text-lg font-bold">{s.cafes?.name ?? "Café"}</div>
        <div className="font-mono text-xs text-muted-foreground">
          <Gamepad2 className="mr-1 inline h-3 w-3" />{s.devices?.name ?? "Station"} · {(s.devices?.type ?? "").toUpperCase()}
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-6">
          <div className="font-mono text-[36px] font-bold leading-none text-emerald-400 tabular-nums">
            {String(Math.floor(mins / 60)).padStart(2, "0")}:{String(mins % 60).padStart(2, "0")}:{String(secs).padStart(2, "0")}
          </div>
          <div className="font-display text-2xl font-bold text-primary tabular-nums">{inr(amount)}</div>
        </div>
      </div>
    </motion.div>
  );
}

function NextBookingCard({ b }: { b: any }) {
  const at = new Date(b.scheduled_at);
  const hrs = Math.max(0, Math.round((at.getTime() - Date.now()) / 3600000));
  return (
    <div className="rounded-2xl border border-border/60 bg-card/40 p-4 backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <CalendarRange className="mt-0.5 h-5 w-5 text-primary" />
          <div>
            <div className="font-display text-base font-bold">{b.cafes?.name ?? "Café"}</div>
            <div className="font-mono text-xs text-muted-foreground">
              {b.devices?.name ?? b.devices?.type ?? "Station"} · {at.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })} · {Math.round(b.duration_minutes / 60 * 10) / 10}h
            </div>
            <div className="mt-1 font-mono text-xs text-amber-400">In {hrs < 1 ? "less than an hour" : `${hrs} hour${hrs === 1 ? "" : "s"}`}</div>
          </div>
        </div>
        <Link to="/portal" hash="bookings" className="text-xs text-primary hover:underline">View all</Link>
      </div>
    </div>
  );
}

function MembershipCard({ m }: { m: any }) {
  const ends = new Date(m.ends_at).getTime();
  const starts = new Date(m.starts_at ?? Date.now()).getTime();
  const total = Math.max(1, ends - starts);
  const left = Math.max(0, ends - Date.now());
  const pct = Math.min(100, Math.max(0, (left / total) * 100));
  const days = Math.ceil(left / 86400000);
  return (
    <div className="rounded-2xl border border-amber-400/30 bg-amber-500/5 p-4 backdrop-blur">
      <div className="flex items-center gap-2">
        <Crown className="h-4 w-4 text-amber-400" />
        <span className="font-display text-base font-bold">{m.memberships?.name ?? "Membership"}</span>
        {m.hours_remaining != null && (
          <Badge variant="secondary" className="ml-auto">{m.hours_remaining}h left</Badge>
        )}
      </div>
      <div className="mt-1 font-mono text-[11px] text-muted-foreground">
        Valid until {new Date(m.ends_at).toLocaleDateString("en-IN", { dateStyle: "medium" })} · {days} day{days === 1 ? "" : "s"} remaining
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-amber-400" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function TxRow({ t }: { t: any }) {
  const credit = t.amount > 0;
  const Icon = t.kind === "refund" ? RotateCcw : credit ? ArrowDownLeft : ArrowUpRight;
  const label =
    t.kind === "topup" ? "Wallet top-up"
      : t.kind === "session" ? "Session payment"
        : t.kind === "refund" ? "Refund"
          : t.note || "Adjustment";
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-background/40 p-3">
      <div className={cn("grid h-9 w-9 place-items-center rounded-full", credit ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/15 text-rose-400")}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm">{label}</div>
        <div className="font-mono text-[11px] text-muted-foreground">{new Date(t.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</div>
      </div>
      <div className={cn("font-mono text-sm font-bold tabular-nums", credit ? "text-emerald-400" : "text-rose-400")}>
        {credit ? "+" : "−"}{inr(Math.abs(t.amount))}
      </div>
    </div>
  );
}

/* ══════════════════ TAB 2 — BOOKINGS ══════════════════ */

function BookingsTab() {
  const fn = useServerFn(listMyBookings);
  const cancelFn = useServerFn(cancelMyBooking);
  const qc = useQueryClient();
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const { data, isLoading } = useQuery({ queryKey: ["my-bookings"], queryFn: () => fn() });
  const cancel = useMutation({
    mutationFn: cancelFn,
    onSuccess: () => {
      toast.success("Booking cancelled");
      qc.invalidateQueries({ queryKey: ["my-bookings"] });
      qc.invalidateQueries({ queryKey: ["portal-summary"] });
      qc.invalidateQueries({ queryKey: ["portal-home"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  if (isLoading) return <PageSkeleton rows={3} />;

  const now = Date.now();
  const all = data ?? [];
  const upcoming = all.filter((b) => ["pending", "confirmed"].includes(b.status) && new Date(b.scheduled_at).getTime() > now);
  const past = all.filter((b) => !upcoming.includes(b));
  const list = tab === "upcoming" ? upcoming : past;

  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-full border border-border/60 bg-card/40 p-1">
        {(["upcoming", "past"] as const).map((k) => (
          <button
            key={k} type="button" onClick={() => setTab(k)}
            className={cn(
              "rounded-full px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] transition",
              tab === k ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {k}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <EmptyState
          icon={CalendarRange}
          title={tab === "upcoming" ? "No upcoming bookings" : "No past bookings"}
          description="Book a rig at any CoreCade arena and it shows up here."
          action={<Link to="/discover"><Button style={{ background: "var(--gradient-brand-hot)" }}>Find a Café <ArrowRight className="ml-1 h-4 w-4" /></Button></Link>}
        />
      ) : (
        <div className="space-y-2">
          {list.map((b) => (
            <BookingRow
              key={b.id} b={b as any}
              canCancel={tab === "upcoming" && b.status === "confirmed" && new Date(b.scheduled_at).getTime() - now > 2 * 3600_000}
              onCancel={() => cancel.mutate({ data: { id: b.id } })}
              pending={cancel.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function BookingRow({ b, canCancel, onCancel, pending }: {
  b: any; canCancel?: boolean; onCancel?: () => void; pending?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const cafe = b.cafes as { name?: string; city?: string; slug?: string } | null;
  const device = b.devices as { name?: string; type?: string } | null;
  const at = new Date(b.scheduled_at);
  const accent = b.status === "confirmed" ? "#00e58a" : b.status === "pending" ? "#ffb020" : "#ff4d6d";

  return (
    <motion.div layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl border p-4 backdrop-blur"
      style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.07)" }}
    >
      <div className="absolute left-0 top-0 h-full w-[3px]" style={{ background: accent }} />
      <button type="button" onClick={() => setOpen((v) => !v)} className="w-full pl-3 text-left">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-display text-[15px] font-bold">{cafe?.name ?? "—"}</div>
            <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">
              {device?.name ?? device?.type ?? "Station"} · {at.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })} · {b.duration_minutes}m
            </div>
          </div>
          <div className="flex items-center gap-2">
            {b.deposit_amount ? <span className="font-mono text-xs text-primary">{inr(b.deposit_amount)}</span> : null}
            <Badge variant={b.status === "confirmed" ? "default" : b.status === "cancelled" || b.status === "no_show" ? "destructive" : "secondary"}>
              {b.status}
            </Badge>
          </div>
        </div>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden pl-3"
          >
            <div className="mt-3 space-y-2 border-t border-border/50 pt-3 text-sm text-muted-foreground">
              {cafe?.city && <div className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> {cafe.city}</div>}
              <div className="flex flex-wrap gap-2">
                {cafe?.slug && (
                  <Link to="/c/$slug" params={{ slug: cafe.slug }}>
                    <Button size="sm" variant="outline">Café page</Button>
                  </Link>
                )}
                {cafe?.city && (
                  <a href={`https://maps.google.com/?q=${encodeURIComponent(`${cafe.name} ${cafe.city}`)}`} target="_blank" rel="noreferrer">
                    <Button size="sm" variant="outline">Get directions</Button>
                  </a>
                )}
                {canCancel && (
                  <Button size="sm" variant="outline" onClick={onCancel} disabled={pending} className="text-destructive hover:bg-destructive/10">
                    <X className="h-3.5 w-3.5" /> Cancel
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ══════════════════ TAB 3 — WALLET ══════════════════ */

const QUICK = [100, 200, 500, 1000];

function WalletTab() {
  const fetchLedger = useServerFn(getMyWalletLedger);
  const fetchCfg = useServerFn(getRazorpayConfig);
  const createOrder = useServerFn(createTopupOrder);
  const verify = useServerFn(verifyTopupPayment);
  const fetchProfile = useServerFn(getMyProfile);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["portal-wallet"], queryFn: () => fetchLedger() });
  const { data: cfg } = useQuery({ queryKey: ["rzp-config"], queryFn: () => fetchCfg() });
  const { data: profile } = useQuery({ queryKey: ["my-profile"], queryFn: () => fetchProfile() });

  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(500);
  const [custom, setCustom] = useState("");
  const [cafeId, setCafeId] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const customers = (data?.customers ?? []) as any[];
  useEffect(() => { if (!cafeId && customers[0]) setCafeId(customers[0].cafe_id); }, [customers, cafeId]);
  const selected = customers.find((c) => c.cafe_id === cafeId);
  const finalAmount = custom ? Math.max(0, parseInt(custom, 10) || 0) : amount;

  async function pay() {
    if (!selected) { toast.error("Visit a café first to open a wallet"); return; }
    if (finalAmount < 1) { toast.error("Enter an amount"); return; }
    if (!cfg?.enabled) { toast.error("Online payments are not enabled yet"); return; }
    setBusy(true);
    try {
      const ok = await loadRazorpayScript();
      if (!ok) throw new Error("Could not load payment gateway");
      const order = await createOrder({ data: { cafe_id: selected.cafe_id, customer_id: selected.id, amount: finalAmount } });
      const rzp = new window.Razorpay!({
        key: order.key_id, amount: finalAmount * 100, currency: "INR", order_id: order.order_id,
        name: "CoreCade", description: `Wallet top-up · ${selected.cafes?.name ?? "Café"}`,
        prefill: { name: profile?.full_name ?? undefined, email: profile?.email ?? undefined, contact: profile?.phone ?? undefined },
        theme: { color: "#ff006e" },
        modal: { ondismiss: () => setBusy(false) },
        handler: async (resp) => {
          try {
            await verify({ data: { topup_id: order.topup_id, ...resp } });
            toast.success(`${inr(finalAmount)} added to wallet!`);
            qc.invalidateQueries({ queryKey: ["portal-wallet"] });
            qc.invalidateQueries({ queryKey: ["portal-summary"] });
            setOpen(false);
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Verification failed");
          } finally { setBusy(false); }
        },
      });
      rzp.open();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Payment failed");
      setBusy(false);
    }
  }

  if (isLoading) return <PageSkeleton rows={3} />;
  const txs = (data?.transactions ?? []) as any[];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card/40 to-accent/10 p-8 text-center">
        <div className="font-display text-[52px] font-extrabold leading-none tabular-nums">{inr(data?.balance ?? 0)}</div>
        <div className="mt-1 text-sm text-muted-foreground">Available balance</div>
        <Button
          onClick={() => setOpen(true)}
          className="mx-auto mt-5 h-12 w-full max-w-xs border-0 text-white"
          style={{ background: "var(--gradient-brand-hot)" }}
        >
          <Plus className="mr-1 h-4 w-4" /> Add Money
        </Button>
      </div>

      {customers.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {customers.map((c) => (
            <button
              key={c.id} type="button" onClick={() => setCafeId(c.cafe_id)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs transition",
                cafeId === c.cafe_id ? "border-primary/60 bg-primary/15 text-primary" : "border-border/60 text-muted-foreground hover:text-foreground",
              )}
            >
              {c.cafes?.name ?? "Café"} · {inr(c.wallet_balance ?? 0)}
            </button>
          ))}
        </div>
      )}

      <div>
        <div className="mb-3 font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Transactions</div>
        {txs.length === 0 ? (
          <EmptyState icon={Wallet} title="No transactions yet" description="Top up your wallet to skip the counter queue." />
        ) : (
          <div className="space-y-2">{txs.map((t) => <TxRow key={t.id} t={t} />)}</div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogTitle>Add money</DialogTitle>
          <div className="mt-2 space-y-4">
            <div className="grid grid-cols-4 gap-2">
              {QUICK.map((q) => (
                <button
                  key={q} type="button"
                  onClick={() => { setAmount(q); setCustom(""); }}
                  className={cn(
                    "rounded-full border py-2 text-sm font-semibold transition",
                    !custom && amount === q ? "border-primary bg-primary/15 text-primary" : "border-border/60 text-muted-foreground hover:text-foreground",
                  )}
                >
                  ₹{q}
                </button>
              ))}
            </div>
            <div className="space-y-1.5">
              <Label>Or enter amount</Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₹</span>
                <Input className="pl-7" inputMode="numeric" value={custom} onChange={(e) => setCustom(e.target.value.replace(/\D/g, ""))} placeholder="Custom amount" />
              </div>
            </div>
            {selected && <p className="text-xs text-muted-foreground">Credited to your <b>{selected.cafes?.name}</b> wallet.</p>}
            <Button onClick={pay} disabled={busy || finalAmount < 1} className="h-12 w-full border-0 text-white" style={{ background: "var(--gradient-brand-hot)" }}>
              {busy ? "Opening…" : `Pay ${inr(finalAmount)} via UPI/Card →`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ══════════════════ TAB 4 — TOURNAMENTS ══════════════════ */

function TournamentsTab() {
  const fn = useServerFn(getMyTournaments);
  const { data, isLoading } = useQuery({ queryKey: ["portal-tournaments"], queryFn: () => fn() });
  if (isLoading) return <PageSkeleton rows={2} />;
  const mine = (data?.mine ?? []) as any[];
  const upcoming = (data?.upcoming ?? []) as any[];

  return (
    <div className="space-y-8">
      <div>
        <div className="mb-3 font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">My tournaments</div>
        {mine.length === 0 ? (
          <EmptyState icon={Trophy} title="No registrations yet" description="Join an upcoming tournament below to compete." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {mine.map((r) => {
              const t = r.tournaments;
              if (!t) return null;
              return <TournamentCard key={r.id} t={t} note={`Team: ${r.team_name}`} />;
            })}
          </div>
        )}
      </div>
      <div>
        <div className="mb-3 font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Discover tournaments</div>
        {upcoming.length === 0 ? (
          <EmptyState icon={Trophy} title="No upcoming tournaments" description="Check back soon — cafés post new brackets weekly." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {upcoming.map((t) => <TournamentCard key={t.id} t={t} register />)}
          </div>
        )}
      </div>
    </div>
  );
}

function TournamentCard({ t, note, register }: { t: any; note?: string; register?: boolean }) {
  const cafe = t.cafes as { name?: string; slug?: string } | null;
  return (
    <div className="rounded-2xl border border-border/60 bg-card/40 p-4 backdrop-blur transition hover:border-primary/40">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-display text-base font-bold">{t.title}</div>
          <div className="font-mono text-[11px] text-muted-foreground">{t.game} · {t.format} · {cafe?.name ?? "—"}</div>
          <div className="font-mono text-[11px] text-muted-foreground">{new Date(t.starts_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</div>
          {note && <div className="mt-1 text-xs text-primary">{note}</div>}
        </div>
        <Badge variant={t.status === "live" ? "default" : "secondary"} className={cn(t.status === "live" && "animate-pulse")}>{t.status}</Badge>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <span className="rounded-full border border-amber-400/30 bg-amber-500/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-amber-300">
          Prize {inr(t.prize_pool ?? 0)}
        </span>
        {cafe?.slug && (
          <Link to="/c/$slug/tournaments/$id" params={{ slug: cafe.slug, id: t.id }}>
            <Button size="sm" variant="outline">{register ? "Register" : "View bracket"} →</Button>
          </Link>
        )}
      </div>
    </div>
  );
}

/* ══════════════════ TAB 5 — PROFILE ══════════════════ */

function ProfileTab() {
  const fetchFn = useServerFn(getMyProfile);
  const updateFn = useServerFn(updateMyProfile);
  const fetchHome = useServerFn(getMyPortalHome);
  const qc = useQueryClient();
  const { data: profile, isLoading } = useQuery({ queryKey: ["my-profile"], queryFn: () => fetchFn() });
  const { data: home } = useQuery({ queryKey: ["portal-home"], queryFn: () => fetchHome() });
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [confirmOut, setConfirmOut] = useState(false);

  useEffect(() => {
    if (profile) { setName(profile.full_name ?? ""); setPhone((profile.phone ?? "").replace(/^\+91/, "")); }
  }, [profile]);

  const m = useMutation({
    mutationFn: updateFn,
    onSuccess: () => { toast.success("Profile saved"); qc.invalidateQueries({ queryKey: ["my-profile"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const memberships = (home?.memberships ?? []) as any[];
  const initials = useMemo(() => (name || profile?.email || "?").slice(0, 2).toUpperCase(), [name, profile?.email]);

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    window.location.href = "/auth";
  }

  if (isLoading) return <PageSkeleton rows={2} />;

  return (
    <div className="max-w-2xl space-y-4">
      <div className="rounded-2xl border border-border/60 bg-card/40 p-6 text-center backdrop-blur">
        <div
          className="mx-auto grid h-[72px] w-[72px] place-items-center rounded-full font-display text-2xl font-black text-white"
          style={{ background: "linear-gradient(135deg,#ff006e,#7b2fff)", border: "2px solid rgba(255,0,110,0.3)" }}
        >
          {initials}
        </div>
        <div className="mt-3 font-display text-[22px] font-bold">{name || "Gamer"}</div>
        <div className="text-sm text-muted-foreground">{profile?.email}</div>
      </div>

      <form
        className="space-y-4 rounded-2xl border border-border/60 bg-card/40 p-6 backdrop-blur"
        onSubmit={(e) => {
          e.preventDefault();
          m.mutate({ data: { full_name: name, phone: phone ? `+91${phone.replace(/\D/g, "").slice(-10)}` : null } });
        }}
      >
        <div className="space-y-1.5">
          <Label>Full name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} />
        </div>
        <div className="space-y-1.5">
          <Label>Phone</Label>
          <div className="flex items-center gap-2">
            <span className="rounded-md border border-border/60 px-3 py-2 font-mono text-sm">🇮🇳 +91</span>
            <Input value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} inputMode="numeric" placeholder="9876543210" />
          </div>
        </div>
        <Button type="submit" disabled={m.isPending} className="border-0 text-white" style={{ background: "var(--gradient-brand-hot)" }}>
          {m.isPending ? "Saving…" : "Save changes"}
        </Button>
      </form>

      {memberships.length > 0 && (
        <div className="rounded-2xl border border-border/60 bg-card/40 p-6 backdrop-blur">
          <div className="mb-3 font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Memberships</div>
          <div className="space-y-2">{memberships.map((mm) => <MembershipCard key={mm.id} m={mm} />)}</div>
        </div>
      )}

      <div className="rounded-2xl border border-border/60 bg-card/40 p-6 backdrop-blur">
        <div className="mb-3 font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Security</div>
        <Link to="/reset-password">
          <Button variant="outline" size="sm"><KeyRound className="mr-1 h-3.5 w-3.5" /> Change password</Button>
        </Link>
      </div>

      <Button variant="outline" onClick={() => setConfirmOut(true)} className="w-full border-destructive/50 text-destructive hover:bg-destructive/10">
        <LogOut className="mr-1 h-4 w-4" /> Sign out
      </Button>

      <Dialog open={confirmOut} onOpenChange={setConfirmOut}>
        <DialogContent className="max-w-sm">
          <DialogTitle>Sign out of CoreCade?</DialogTitle>
          <p className="text-sm text-muted-foreground">You'll need to sign in again to see your bookings and wallet.</p>
          <div className="mt-4 flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setConfirmOut(false)}>Stay</Button>
            <Button className="flex-1 bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={signOut}>Sign out</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export { Skeleton };
