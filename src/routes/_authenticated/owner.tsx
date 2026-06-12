import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  LayoutDashboard, Cpu, CalendarRange, ShoppingBag, Users, Wallet,
  Trophy, BookOpen, LineChart, Globe, BadgeCheck, Receipt, UsersRound, ArrowRight, Building2,
  Plus, TrendingUp, Activity, IndianRupee,
} from "lucide-react";
import { motion } from "framer-motion";
import { ConsoleShell } from "@/components/ConsoleShell";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { createCafe, getOwnerDashboard } from "@/lib/cafes.functions";
import { supabase } from "@/lib/supabase/client";

export const Route = createFileRoute("/_authenticated/owner")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Owner Dashboard — CoreCade" },
      { name: "description", content: "All your CoreCade cafés, revenue and consoles in one command center." },
    ],
  }),
  beforeLoad: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/auth" });
    const { data: roles } = await supabase
      .from("user_roles").select("role").eq("user_id", user.id)
      .in("role", ["cafe_owner", "super_admin"]);
    if (!roles || roles.length === 0) throw redirect({ to: "/portal" });
  },
  component: OwnerHub,
});

const SECTIONS = [
  { to: "/cafe/$slug",               label: "Overview",     icon: LayoutDashboard, color: "oklch(0.74 0.21 15)"  },
  { to: "/cafe/$slug/floor",         label: "Live Floor",   icon: BadgeCheck,      color: "oklch(0.7 0.26 335)"  },
  { to: "/cafe/$slug/devices",       label: "Devices",      icon: Cpu,             color: "oklch(0.78 0.18 200)" },
  { to: "/cafe/$slug/bookings",      label: "Bookings",     icon: CalendarRange,   color: "oklch(0.65 0.25 295)" },
  { to: "/cafe/$slug/pos",           label: "POS",          icon: ShoppingBag,     color: "oklch(0.74 0.21 15)"  },
  { to: "/cafe/$slug/menu",          label: "Menu",         icon: BookOpen,        color: "oklch(0.7 0.26 335)"  },
  { to: "/cafe/$slug/memberships",   label: "Memberships",  icon: UsersRound,      color: "oklch(0.78 0.18 200)" },
  { to: "/cafe/$slug/customers",     label: "Customers",    icon: Users,           color: "oklch(0.65 0.25 295)" },
  { to: "/cafe/$slug/wallet",        label: "Wallet",       icon: Wallet,          color: "oklch(0.74 0.21 15)"  },
  { to: "/cafe/$slug/ledger",        label: "Ledger",       icon: Receipt,         color: "oklch(0.7 0.26 335)"  },
  { to: "/cafe/$slug/tournaments",   label: "Tournaments",  icon: Trophy,          color: "oklch(0.78 0.18 200)" },
  { to: "/cafe/$slug/staff",         label: "Staff",        icon: Users,           color: "oklch(0.65 0.25 295)" },
  { to: "/cafe/$slug/page",          label: "Public Page",  icon: Globe,           color: "oklch(0.74 0.21 15)"  },
  { to: "/cafe/$slug/analytics",     label: "Analytics",    icon: LineChart,       color: "oklch(0.7 0.26 335)"  },
] as const;

function OwnerHub() {
  const fetchDash = useServerFn(getOwnerDashboard);
  const { data, isLoading } = useQuery({
    queryKey: ["owner-dashboard"],
    queryFn: () => fetchDash(),
    refetchInterval: 30_000,
  });
  const cafes = data?.cafes ?? [];
  const totals = data?.totals ?? { revenue: 0, revenueToday: 0, bookings: 0, activeSessions: 0, devices: 0, customers: 0 };

  return (
    <ConsoleShell
      badge="Owner"
      title="Your Cafés"
      subtitle="Revenue, bookings and every console section across all your cafés."
      nav={[{ label: "Owner Hub", icon: LayoutDashboard, to: "/owner", exact: true }]}
    >
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          {cafes.length} café{cafes.length === 1 ? "" : "s"} owned · {totals.activeSessions} live session{totals.activeSessions === 1 ? "" : "s"}
        </div>
        <CreateCafeButton />
      </div>

      {/* Totals strip */}
      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile icon={IndianRupee} label="Revenue today" value={`₹${totals.revenueToday.toLocaleString("en-IN")}`} accent="primary" />
        <StatTile icon={TrendingUp}  label="Revenue all-time" value={`₹${totals.revenue.toLocaleString("en-IN")}`} accent="azure" />
        <StatTile icon={CalendarRange} label="Total bookings" value={String(totals.bookings)} accent="violet" />
        <StatTile icon={Activity}    label="Active sessions" value={String(totals.activeSessions)} accent="magenta" />
      </div>

      {isLoading ? (
        <div className="h-48 animate-pulse rounded-2xl border border-border/40 bg-card/30" />
      ) : cafes.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No cafés yet"
          description="Create your first café to unlock the full console — devices, bookings, POS, memberships and more."
        />
      ) : (
        <div className="space-y-8">
          {cafes.map((cafe, idx) => (
            <motion.section
              key={cafe.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="relative overflow-hidden rounded-3xl border border-border/60 bg-card/40 p-6 backdrop-blur"
            >
              <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full blur-[80px] opacity-50"
                   style={{ background: "radial-gradient(circle, oklch(0.74 0.21 15 / 0.5), transparent 70%)" }} />
              <div className="relative flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-primary">
                    {cafe.city ?? "—"} · /{cafe.slug}
                    {!cafe.is_active && <Badge variant="destructive" className="h-4">paused</Badge>}
                  </div>
                  <h2 className="mt-1 font-display text-3xl font-extrabold tracking-tight">{cafe.name}</h2>
                </div>
                <Link
                  to="/cafe/$slug"
                  params={{ slug: cafe.slug }}
                  className="group inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold text-primary-foreground"
                  style={{ background: "var(--gradient-brand-hot)" }}
                >
                  Open console <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                </Link>
              </div>

              {/* Per-cafe stats */}
              <div className="relative mt-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
                <MiniStat label="Today" value={`₹${cafe.revenueToday.toLocaleString("en-IN")}`} />
                <MiniStat label="All-time" value={`₹${cafe.revenue.toLocaleString("en-IN")}`} />
                <MiniStat label="Bookings" value={String(cafe.bookings)} />
                <MiniStat label="Live" value={String(cafe.activeSessions)} />
                <MiniStat label="Devices" value={String(cafe.devices)} />
                <MiniStat label="Customers" value={String(cafe.customers)} />
              </div>

              <div className="relative mt-6 grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {SECTIONS.map((s) => (
                  <Link
                    key={s.label}
                    to={s.to}
                    params={{ slug: cafe.slug }}
                    className="group relative overflow-hidden rounded-2xl border border-border/60 bg-background/40 p-4 backdrop-blur transition hover:-translate-y-0.5 hover:border-primary/50 hover:bg-background/70"
                  >
                    <span
                      className="absolute -right-8 -top-8 h-20 w-20 rounded-full opacity-30 blur-2xl transition group-hover:opacity-70"
                      style={{ background: `radial-gradient(circle, ${s.color}, transparent 70%)` }}
                      aria-hidden
                    />
                    <div className="relative flex items-center justify-between">
                      <s.icon className="h-5 w-5 text-foreground/90" />
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-foreground" />
                    </div>
                    <div className="relative mt-3 font-display text-sm font-semibold">{s.label}</div>
                  </Link>
                ))}
              </div>
            </motion.section>
          ))}
        </div>
      )}
    </ConsoleShell>
  );
}

function StatTile({ icon: Icon, label, value, accent }: {
  icon: typeof Wallet; label: string; value: string;
  accent: "primary" | "azure" | "violet" | "magenta";
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card/40 p-4 backdrop-blur">
      <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full opacity-50 blur-2xl" style={{ background: `oklch(var(--${accent}) / 0.5)` }} />
      <div className="relative flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{label}</span>
      </div>
      <div className="relative mt-2 font-display text-3xl font-extrabold tabular-nums">{value}</div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/40 bg-background/40 p-3">
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-lg font-bold tabular-nums">{value}</div>
    </div>
  );
}

function CreateCafeButton() {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const create = useServerFn(createCafe);
  const m = useMutation({
    mutationFn: create,
    onSuccess: () => {
      toast.success("Café created — opening console");
      qc.invalidateQueries({ queryKey: ["owner-dashboard"] });
      qc.invalidateQueries({ queryKey: ["my-owned-cafes"] });
      setOpen(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2 text-primary-foreground" style={{ background: "var(--gradient-brand-hot)" }}>
          <Plus className="h-4 w-4" /> Create café
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Launch a new café</DialogTitle>
          <DialogDescription>You become the owner automatically. Slug must be unique (used in your public URL).</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            m.mutate({
              data: {
                name: String(fd.get("name")),
                slug: String(fd.get("slug")).toLowerCase().trim(),
                city: String(fd.get("city") || "") || null,
                state: String(fd.get("state") || "") || null,
                address: String(fd.get("address") || "") || null,
                phone: String(fd.get("phone") || "") || null,
                email: String(fd.get("email") || "") || null,
                description: String(fd.get("description") || "") || null,
                owner_email: null,
              },
            });
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1"><Label>Café name *</Label><Input name="name" required minLength={2} maxLength={120} placeholder="Pixel Arcade" /></div>
            <div className="col-span-2 space-y-1"><Label>Slug *</Label><Input name="slug" required pattern="[a-z0-9-]+" placeholder="pixel-arcade" /></div>
            <div className="space-y-1"><Label>City</Label><Input name="city" /></div>
            <div className="space-y-1"><Label>State</Label><Input name="state" /></div>
            <div className="col-span-2 space-y-1"><Label>Address</Label><Input name="address" /></div>
            <div className="space-y-1"><Label>Phone</Label><Input name="phone" /></div>
            <div className="space-y-1"><Label>Public email</Label><Input name="email" type="email" /></div>
            <div className="col-span-2 space-y-1"><Label>Description</Label><Textarea name="description" rows={2} /></div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={m.isPending} className="gap-2" style={{ background: "var(--gradient-brand-hot)" }}>
              {m.isPending ? "Creating…" : "Create café"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
