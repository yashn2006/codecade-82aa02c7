import { createFileRoute, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Compass, CalendarRange, User as UserIcon, Gamepad2, MapPin, Wallet,
  Sparkles, Trophy, Clock, Flame, X, Search,
} from "lucide-react";
import { motion } from "framer-motion";
import { ConsoleShell } from "@/components/ConsoleShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/EmptyState";
import { BookingFlow } from "@/components/BookingFlow";
import { listPublicCafes } from "@/lib/discover.functions";
import { listMyBookings } from "@/lib/bookings.functions";
import { getMyRoles } from "@/lib/me.functions";
import { getMyOwnedCafes } from "@/lib/cafes.functions";
import { getPlatformMaintenance } from "@/lib/platform.functions";
import { getMyPortalSummary, cancelMyBooking, getMyProfile, updateMyProfile } from "@/lib/portal.functions";
import { MaintenanceBanner } from "@/components/MaintenanceBanner";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/portal")({
  head: () => ({ meta: [{ title: "Portal — CoreCade" }] }),
  component: Portal,
});

type TabKey = "discover" | "bookings" | "wallets" | "profile";
const TABS: { key: TabKey; label: string; icon: typeof Compass }[] = [
  { key: "discover", label: "Discover", icon: Compass },
  { key: "bookings", label: "My Bookings", icon: CalendarRange },
  { key: "wallets",  label: "Wallets",    icon: Wallet },
  { key: "profile",  label: "Profile",    icon: UserIcon },
];

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

  // Drive the active tab from the URL hash so the sidebar/menubar links
  // (which are real anchors) select the right panel.
  const hash = useRouterState({ select: (s) => (s.location.hash ?? "").replace(/^#/, "") });
  const active: TabKey = (TABS.find((t) => t.key === hash)?.key ?? "discover");

  return (
    <ConsoleShell
      badge="Customer"
      title="Your Arcade"
      subtitle="Discover cafés. Book rigs. Earn streaks."
      nav={TABS.map((t) => ({
        label: t.label,
        icon: t.icon,
        to: "/portal",
        exact: true,
        hash: t.key === "discover" ? "" : t.key,
      }))}
      intensity="hero"
    >
      <div className="mb-4"><MaintenanceBanner window={platform} title="CoreCade network maintenance" /></div>
      {(isSuper || ownerCafe) && (
        <div className="mb-6 flex flex-wrap gap-2">
          {isSuper && <Link to="/admin"><Button variant="outline" size="sm">Open Super Admin →</Button></Link>}
          {ownerCafe && <Link to="/owner"><Button variant="outline" size="sm">Open Owner Dashboard →</Button></Link>}
          {ownerCafe && <Link to="/cafe/$slug" params={{ slug: ownerCafe.slug }}><Button variant="outline" size="sm">Open {ownerCafe.name} console →</Button></Link>}
        </div>
      )}

      {/* Stats bento */}
      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile icon={Wallet} label="Wallet credit" value={`₹${summary?.walletTotal ?? 0}`} hint={`${summary?.wallets?.length ?? 0} café${(summary?.wallets?.length ?? 0) === 1 ? "" : "s"}`} accent="primary" />
        <StatTile icon={CalendarRange} label="Upcoming" value={String(summary?.upcoming ?? 0)} hint="active bookings" accent="azure" />
        <StatTile icon={Clock} label="Hours played" value={String(summary?.totalHours ?? 0)} hint={`${summary?.completed ?? 0} sessions`} accent="violet" />
        <StatTile icon={Trophy} label="Cafés visited" value={String(summary?.cafesVisited ?? 0)} hint="explored" accent="magenta" />
      </div>

      <PortalSectionHeader active={active} />
      <motion.div
        key={active}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
      >
        {active === "discover" && <DiscoverPanel />}
        {active === "bookings" && <MyBookingsPanel />}
        {active === "wallets"  && <WalletsPanel summary={summary} />}
        {active === "profile"  && <ProfilePanel />}
      </motion.div>
    </ConsoleShell>
  );
}

function PortalSectionHeader({ active }: { active: TabKey }) {
  const meta = TABS.find((t) => t.key === active)!;
  const Icon = meta.icon;
  return (
    <div className="mb-4 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
      <Icon className="h-3.5 w-3.5 text-primary" /> {meta.label}
    </div>
  );
}


function StatTile({ icon: Icon, label, value, hint, accent }: {
  icon: typeof Wallet; label: string; value: string; hint?: string;
  accent: "primary" | "azure" | "violet" | "magenta";
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card/40 p-4 backdrop-blur hover:border-primary/40 transition"
    >
      <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full opacity-50 blur-2xl transition group-hover:opacity-80" style={{ background: `oklch(var(--${accent}) / 0.5)` }} />
      <div className="relative">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" />
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{label}</span>
        </div>
        <div className="mt-2 font-display text-3xl font-extrabold tabular-nums">{value}</div>
        {hint && <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{hint}</div>}
      </div>
    </motion.div>
  );
}

function DiscoverPanel() {
  const fn = useServerFn(listPublicCafes);
  const { data, isLoading } = useQuery({ queryKey: ["public-cafes"], queryFn: () => fn() });
  const [city, setCity] = useState("");
  const filtered = (data ?? []).filter((c) =>
    !city ||
    (c.city ?? "").toLowerCase().includes(city.toLowerCase()) ||
    c.name.toLowerCase().includes(city.toLowerCase()),
  );

  return (
    <div>
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search by city or name…" value={city} onChange={(e) => setCity(e.target.value)} className="pl-9" />
      </div>
      <div className="mt-4">
        {isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-44 animate-pulse rounded-2xl border border-border/40 bg-card/30" />)}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={Gamepad2} title="No cafés found" description="Try a different search." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((c, i) => <CafeCard key={c.id} cafe={c} index={i} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function CafeCard({ cafe, index }: { cafe: { id: string; slug: string; name: string; city: string | null; description: string | null }; index: number }) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const accents = ["violet", "azure", "magenta"] as const;
  const accent = accents[index % 3];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }}
      whileHover={{ y: -4 }}
      className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card/40 p-5 backdrop-blur transition hover:border-primary/50 hover:shadow-[0_20px_60px_-20px_oklch(0.7_0.26_335/0.4)]"
    >
      <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full blur-2xl opacity-60 transition group-hover:opacity-100" style={{ background: `oklch(var(--${accent}) / 0.5)` }} />
      <div className="relative">
        <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          <MapPin className="h-3 w-3" />{cafe.city ?? "—"}
        </div>
        <h3 className="mt-1 font-display text-xl font-bold">{cafe.name}</h3>
        {cafe.description && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{cafe.description}</p>}
        <div className="mt-4 flex gap-2">
          <Button size="sm" className="flex-1" style={{ background: "var(--gradient-brand-hot)" }} onClick={() => setOpen(true)}>
            <Sparkles className="h-3.5 w-3.5" /> Book
          </Button>
          <Link to="/c/$slug" params={{ slug: cafe.slug }} className="flex">
            <Button size="sm" variant="outline">View</Button>
          </Link>
        </div>
      </div>
      <BookingFlow open={open} onOpenChange={setOpen} cafe={cafe} onBooked={() => qc.invalidateQueries({ queryKey: ["my-bookings"] })} />
    </motion.div>
  );
}

function MyBookingsPanel() {
  const fn = useServerFn(listMyBookings);
  const cancelFn = useServerFn(cancelMyBooking);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["my-bookings"], queryFn: () => fn() });
  const cancel = useMutation({
    mutationFn: cancelFn,
    onSuccess: () => {
      toast.success("Booking cancelled");
      qc.invalidateQueries({ queryKey: ["my-bookings"] });
      qc.invalidateQueries({ queryKey: ["portal-summary"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  if (isLoading) return <div className="h-40 animate-pulse rounded-2xl border border-border/40 bg-card/30" />;
  if (!data || data.length === 0) {
    return <EmptyState icon={CalendarRange} title="No bookings yet" description="Pick a café in Discover and book your first session." />;
  }

  const now = Date.now();
  const upcoming = data.filter((b) => ["pending", "confirmed"].includes(b.status) && new Date(b.scheduled_at).getTime() > now);
  const past = data.filter((b) => !upcoming.includes(b));

  return (
    <div className="space-y-6">
      {upcoming.length > 0 && (
        <Section title="Upcoming" icon={Flame}>
          {upcoming.map((b) => (
            <BookingCard key={b.id} b={b} canCancel onCancel={() => cancel.mutate({ data: { id: b.id } })} pending={cancel.isPending} />
          ))}
        </Section>
      )}
      {past.length > 0 && (
        <Section title="History" icon={Clock}>
          {past.map((b) => <BookingCard key={b.id} b={b} />)}
        </Section>
      )}
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: typeof Flame; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
        <Icon className="h-3.5 w-3.5 text-primary" /> {title}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function BookingCard({ b, canCancel, onCancel, pending }: {
  b: { id: string; scheduled_at: string; duration_minutes: number; status: string; cafes: unknown; devices: unknown };
  canCancel?: boolean; onCancel?: () => void; pending?: boolean;
}) {
  const cafe = b.cafes as { name?: string; city?: string } | null;
  const device = b.devices as { name?: string; type?: string } | null;
  const at = new Date(b.scheduled_at);
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card/40 p-4 backdrop-blur hover:border-primary/30 transition"
    >
      <div className="pointer-events-none absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-primary via-accent to-azure" />
      <div className="flex flex-wrap items-center justify-between gap-3 pl-3">
        <div>
          <div className="font-display text-lg font-bold">{cafe?.name ?? "—"}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-azure">
            <span><Clock className="mr-1 inline h-3 w-3" />{at.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</span>
            <span>· {b.duration_minutes}m</span>
            {device?.type && <span>· <Gamepad2 className="mr-1 inline h-3 w-3" />{device.type.toUpperCase()}</span>}
            {cafe?.city && <span>· <MapPin className="mr-1 inline h-3 w-3" />{cafe.city}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant={b.status === "confirmed" ? "default" : b.status === "cancelled" || b.status === "no_show" ? "destructive" : "secondary"}
            className={cn(b.status === "confirmed" && "shadow-[0_0_18px_oklch(0.7_0.18_160/0.6)] bg-emerald-500/20 text-emerald-200 border-emerald-500/40")}
          >
            {b.status}
          </Badge>
          {canCancel && (
            <Button size="sm" variant="outline" onClick={onCancel} disabled={pending} className="text-destructive hover:bg-destructive/10">
              <X className="h-3.5 w-3.5" /> Cancel
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function WalletsPanel({ summary }: { summary: Awaited<ReturnType<typeof getMyPortalSummary>> | undefined }) {
  if (!summary || summary.wallets.length === 0) {
    return <EmptyState icon={Wallet} title="No wallets yet" description="Top up at any café you visit — your credits show up here." />;
  }
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-primary/40 bg-gradient-to-br from-primary/10 via-card/40 to-accent/10 p-6">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Total wallet credit</div>
        <div className="mt-1 font-display text-5xl font-extrabold text-gradient-hot tabular-nums">₹{summary.walletTotal}</div>
        <div className="mt-1 font-mono text-[11px] uppercase text-muted-foreground">across {summary.wallets.length} café{summary.wallets.length === 1 ? "" : "s"}</div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {summary.wallets.map((w) => {
          const c = w.cafes as { name?: string; city?: string; slug?: string } | null;
          return (
            <div key={w.id} className="group rounded-2xl border border-border/60 bg-card/40 p-4 backdrop-blur hover:border-primary/40 transition">
              <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                <MapPin className="h-3 w-3" /> {c?.city ?? "—"}
              </div>
              <div className="mt-1 font-display text-lg font-bold">{c?.name ?? "—"}</div>
              <div className="mt-3 font-display text-3xl font-extrabold text-azure tabular-nums">₹{w.wallet_balance}</div>
              <div className="font-mono text-[10px] uppercase text-muted-foreground">credit balance</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ProfilePanel() {
  const fetchFn = useServerFn(getMyProfile);
  const updateFn = useServerFn(updateMyProfile);
  const qc = useQueryClient();
  const { data: profile } = useQuery({ queryKey: ["my-profile"], queryFn: () => fetchFn() });
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  useEffect(() => {
    if (profile) { setName(profile.full_name ?? ""); setPhone(profile.phone ?? ""); }
  }, [profile]);
  const m = useMutation({
    mutationFn: updateFn,
    onSuccess: () => { toast.success("Profile saved"); qc.invalidateQueries({ queryKey: ["my-profile"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <div className="max-w-2xl space-y-4">
      <div className="rounded-2xl border border-border/60 bg-card/40 p-6 backdrop-blur">
        <div className="flex items-center gap-4">
          <div className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-primary to-accent font-display text-2xl font-bold text-primary-foreground shadow-[0_0_30px_oklch(0.7_0.26_335/0.6)]">
            {(name[0] ?? profile?.email?.[0] ?? "?").toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="font-display text-xl font-bold">{name || "Gamer"}</div>
            <div className="truncate font-mono text-xs text-muted-foreground">{profile?.email}</div>
          </div>
        </div>
        <form
          className="mt-6 space-y-4"
          onSubmit={(e) => { e.preventDefault(); m.mutate({ data: { full_name: name, phone: phone || null } }); }}
        >
          <div className="space-y-1.5">
            <Label>Display name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} />
          </div>
          <div className="space-y-1.5">
            <Label>Phone</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91…" maxLength={20} />
          </div>
          <Button type="submit" disabled={m.isPending} style={{ background: "var(--gradient-brand-hot)" }}>
            {m.isPending ? "Saving…" : "Save profile"}
          </Button>
        </form>
      </div>
    </div>
  );
}
