import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  LayoutDashboard, Cpu, CalendarRange, ShoppingBag, Users, Wallet,
  Trophy, BookOpen, LineChart, Globe, BadgeCheck, Receipt, UsersRound, ArrowRight, Building2,
  Plus, TrendingUp, Activity, IndianRupee, LifeBuoy,
} from "lucide-react";
import { motion } from "framer-motion";
import { ConsoleShell } from "@/components/ConsoleShell";
import { EmptyState } from "@/components/EmptyState";
import { TrialBanner } from "@/components/TrialBanner";
import { OnboardingChecklist } from "@/components/OnboardingChecklist";
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
      nav={[
        { label: "Owner Hub", icon: LayoutDashboard, to: "/owner", exact: true },
        { label: "Help Center", icon: LifeBuoy, to: "/owner/help", exact: true },
      ]}
    >
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          {cafes.length} café{cafes.length === 1 ? "" : "s"} owned · {totals.activeSessions} live session{totals.activeSessions === 1 ? "" : "s"}
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/owner/help"
            className="inline-flex items-center gap-2 rounded-xl border border-border/60 bg-card/40 px-3 py-2 text-sm font-semibold backdrop-blur hover:border-primary/50 hover:bg-card"
          >
            <LifeBuoy className="h-4 w-4 text-primary" /> Help Center
          </Link>
          <CreateCafeButton />
        </div>
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
              <div className="relative">
                <TrialBanner cafe={cafe} />
                <OnboardingChecklist cafe={cafe} />
              </div>
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
  const [step, setStep] = useState(0);
  const [openDays, setOpenDays] = useState<number[]>([1, 2, 3, 4, 5, 6, 0]);
  const [openTime, setOpenTime] = useState("10:00");
  const [closeTime, setCloseTime] = useState("23:00");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");

  const qc = useQueryClient();
  const create = useServerFn(createCafe);
  const m = useMutation({
    mutationFn: create,
    onSuccess: () => {
      toast.success("🎉 Café created — welcome to CoreCade!");
      qc.invalidateQueries({ queryKey: ["owner-dashboard"] });
      qc.invalidateQueries({ queryKey: ["my-owned-cafes"] });
      setOpen(false);
      setStep(0);
      setName(""); setSlug("");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const reset = () => {
    setStep(0); setName(""); setSlug("");
    setOpenDays([1, 2, 3, 4, 5, 6, 0]); setOpenTime("10:00"); setCloseTime("23:00");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); setOpen(v); }}>
      <DialogTrigger asChild>
        <Button className="gap-2 text-primary-foreground" style={{ background: "var(--gradient-brand-hot)" }}>
          <Plus className="h-4 w-4" /> Create café
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] overflow-y-auto p-0 sm:max-w-2xl">
        {/* Header with gradient */}
        <div className="relative overflow-hidden rounded-t-lg border-b border-border/40 bg-card/60 px-6 pb-5 pt-6 backdrop-blur">
          <div
            className="pointer-events-none absolute -right-24 -top-20 h-48 w-48 rounded-full opacity-60 blur-[70px]"
            style={{ background: "radial-gradient(circle, oklch(0.7 0.26 335 / 0.7), transparent 70%)" }}
          />
          <Building2 className="pointer-events-none absolute right-4 top-3 h-24 w-24 text-primary/10" aria-hidden />
          <div className="relative">
            <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-primary">Launch a new café</div>
            <DialogTitle className="mt-1 font-display text-3xl font-extrabold tracking-tight">
              {step === 0 && <>Tell us about your <span className="text-gradient-hot">café</span></>}
              {step === 1 && <>When are you <span className="text-gradient-hot">open</span>?</>}
              {step === 2 && <>How can players <span className="text-gradient-hot">reach you</span>?</>}
            </DialogTitle>
            <DialogDescription className="mt-1 text-xs text-muted-foreground">
              Step {step + 1} of 3 · You become the owner automatically
            </DialogDescription>
            {/* Progress dots */}
            <div className="mt-4 flex gap-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                  <motion.div
                    initial={false}
                    animate={{ width: step >= i ? "100%" : "0%" }}
                    transition={{ duration: 0.35 }}
                    className="h-full"
                    style={{ background: "var(--gradient-brand-hot)" }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        <form
          className="space-y-5 px-6 py-5"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            m.mutate({
              data: {
                name: name || String(fd.get("name") || ""),
                slug: (slug || String(fd.get("slug") || "")).toLowerCase().trim(),
                city: String(fd.get("city") || "") || null,
                state: String(fd.get("state") || "") || null,
                address: String(fd.get("address") || "") || null,
                phone: String(fd.get("phone") || "") || null,
                email: String(fd.get("email") || "") || null,
                description: String(fd.get("description") || "") || null,
                open_time: openTime || null,
                close_time: closeTime || null,
                open_days: openDays.length ? openDays : null,
                owner_email: null,
              },
            });
          }}
        >
          {/* Step 0 — Identity */}
          {step === 0 && (
            <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Café name *</Label>
                <Input
                  name="name" required minLength={2} maxLength={120}
                  placeholder="Pixel Arcade"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (!slug) setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""));
                  }}
                  className="h-12 text-lg"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Public URL *</Label>
                <div className="flex items-center overflow-hidden rounded-md border border-border bg-background">
                  <span className="select-none border-r border-border bg-card/60 px-3 py-3 font-mono text-xs text-muted-foreground">corecade.app/c/</span>
                  <Input
                    name="slug" required pattern="[a-z0-9-]+"
                    placeholder="pixel-arcade"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value.toLowerCase())}
                    className="h-12 border-0 font-mono text-base focus-visible:ring-0"
                  />
                </div>
                <p className="font-mono text-[10px] text-muted-foreground">Lowercase letters, numbers, dashes. Must be unique.</p>
              </div>
              <div className="space-y-1.5">
                <Label className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Pitch line (optional)</Label>
                <Textarea name="description" rows={2} maxLength={1000}
                  placeholder="India's loudest LAN café. 32 RTX rigs, cold coffee, and a Valorant league every Saturday."
                />
              </div>
            </motion.div>
          )}

          {/* Step 1 — Hours & days */}
          {step === 1 && (
            <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} className="space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Opens at</Label>
                  <div className="relative">
                    <Input type="time" value={openTime} onChange={(e) => setOpenTime(e.target.value)} className="h-12 pl-10 font-mono text-lg" />
                    <Activity className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Closes at</Label>
                  <div className="relative">
                    <Input type="time" value={closeTime} onChange={(e) => setCloseTime(e.target.value)} className="h-12 pl-10 font-mono text-lg" />
                    <Activity className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary rotate-180" />
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-border/60 bg-card/40 p-3 text-xs text-muted-foreground">
                Closing earlier than opening is treated as overnight (e.g. 18:00 → 03:00).
              </div>
              <div className="space-y-2">
                <Label className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Days open</Label>
                <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                  {[
                    { d: 1, l: "Mon" }, { d: 2, l: "Tue" }, { d: 3, l: "Wed" }, { d: 4, l: "Thu" },
                    { d: 5, l: "Fri" }, { d: 6, l: "Sat" }, { d: 0, l: "Sun" },
                  ].map(({ d, l }) => {
                    const on = openDays.includes(d);
                    return (
                      <motion.button
                        key={d}
                        type="button"
                        whileTap={{ scale: 0.94 }}
                        onClick={() => setOpenDays((prev) => on ? prev.filter(x => x !== d) : [...prev, d])}
                        className={`relative h-16 rounded-xl border text-center transition-all ${
                          on
                            ? "border-primary bg-primary/15 text-foreground shadow-[0_0_22px_-8px_oklch(0.7_0.26_335/0.9)]"
                            : "border-border/60 bg-background/40 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                        }`}
                      >
                        <div className="font-mono text-[10px] uppercase tracking-[0.18em]">{l}</div>
                        <div className="mt-1 font-display text-lg font-bold">{on ? "●" : "○"}</div>
                      </motion.button>
                    );
                  })}
                </div>
                <div className="flex gap-2 pt-1">
                  <button type="button" onClick={() => setOpenDays([1, 2, 3, 4, 5, 6, 0])}
                    className="rounded-full border border-border/60 bg-background/40 px-3 py-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground">
                    All week
                  </button>
                  <button type="button" onClick={() => setOpenDays([1, 2, 3, 4, 5])}
                    className="rounded-full border border-border/60 bg-background/40 px-3 py-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground">
                    Weekdays
                  </button>
                  <button type="button" onClick={() => setOpenDays([6, 0])}
                    className="rounded-full border border-border/60 bg-background/40 px-3 py-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground">
                    Weekends
                  </button>
                </div>
                <p className="font-mono text-[10px] text-muted-foreground">
                  Open {openDays.length} day{openDays.length === 1 ? "" : "s"} a week · {openTime} – {closeTime}
                </p>
              </div>
            </motion.div>
          )}

          {/* Step 2 — Contact */}
          {step === 2 && (
            <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">City</Label>
                <Input name="city" placeholder="Bengaluru" className="h-11" />
              </div>
              <div className="space-y-1.5">
                <Label className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">State</Label>
                <Input name="state" placeholder="Karnataka" className="h-11" />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Address</Label>
                <Input name="address" placeholder="Shop 12, MG Road" className="h-11" />
              </div>
              <div className="space-y-1.5">
                <Label className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Phone</Label>
                <Input name="phone" placeholder="+91 98765 43210" className="h-11" />
              </div>
              <div className="space-y-1.5">
                <Label className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Public email</Label>
                <Input name="email" type="email" placeholder="hi@cafe.com" className="h-11" />
              </div>
            </motion.div>
          )}

          {/* Footer nav */}
          <DialogFooter className="flex-row gap-2 border-t border-border/40 pt-4 sm:justify-between">
            <Button
              type="button" variant="ghost"
              disabled={step === 0}
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              className="text-muted-foreground hover:bg-white/5"
            >
              Back
            </Button>
            {step < 2 ? (
              <Button
                type="button"
                disabled={step === 0 && (!name || !slug)}
                onClick={() => setStep((s) => Math.min(2, s + 1))}
                className="gap-2 text-primary-foreground"
                style={{ background: "var(--gradient-brand-hot)" }}
              >
                Continue <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="submit" disabled={m.isPending}
                className="gap-2 text-primary-foreground"
                style={{ background: "var(--gradient-brand-hot)" }}
              >
                {m.isPending ? "Launching…" : "🚀 Launch café"}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
