import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  LayoutDashboard, Cpu, CalendarRange, ShoppingBag, Users, Wallet,
  Trophy, BookOpen, LineChart, Globe, BadgeCheck, Receipt, UsersRound, ArrowRight, Building2,
} from "lucide-react";
import { motion } from "framer-motion";
import { ConsoleShell } from "@/components/ConsoleShell";
import { EmptyState } from "@/components/EmptyState";
import { getMyOwnedCafes } from "@/lib/cafes.functions";
import { supabase } from "@/lib/supabase/client";

export const Route = createFileRoute("/_authenticated/owner")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Owner Dashboard — CoreCade" },
      { name: "description", content: "Open your café consoles — floor, devices, bookings, POS, memberships, analytics and more." },
      { property: "og:title", content: "Owner Dashboard — CoreCade" },
      { property: "og:description", content: "All your CoreCade cafés in one command center." },
    ],
  }),
  beforeLoad: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/auth" });
    // Gate: must have cafe_owner (or super_admin) role
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["cafe_owner", "super_admin"]);
    if (!roles || roles.length === 0) {
      throw redirect({ to: "/portal" });
    }
    // Auto-redirect single-café owners straight into their console
    try {
      const { data } = await supabase
        .from("cafes")
        .select("slug")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: true })
        .limit(2);
      if (data && data.length === 1) {
        throw redirect({ to: "/cafe/$slug", params: { slug: data[0].slug } });
      }
    } catch (e) {
      if (e && typeof e === "object" && "to" in e) throw e;
    }
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
  const fetchOwned = useServerFn(getMyOwnedCafes);
  const { data: cafes, isLoading } = useQuery({
    queryKey: ["my-owned-cafes"],
    queryFn: () => fetchOwned(),
  });

  return (
    <ConsoleShell
      badge="Owner"
      title="Your Cafés"
      subtitle="Open any section of any café console — every page is one click away."
      nav={[{ label: "Owner Hub", icon: LayoutDashboard, to: "/owner", exact: true }]}
    >
      {isLoading ? (
        <div className="h-48 animate-pulse rounded-2xl border border-border/40 bg-card/30" />
      ) : !cafes || cafes.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No cafés yet"
          description="Once your café is provisioned it will appear here with deep-links into every console section."
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
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary">
                    {cafe.city ?? "—"} · /{cafe.slug}
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
                    <div className="relative mt-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                      /cafe/{cafe.slug}{s.to.replace("/cafe/$slug", "")}
                    </div>
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
