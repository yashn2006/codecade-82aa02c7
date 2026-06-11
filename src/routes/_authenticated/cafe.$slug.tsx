import { createFileRoute, Outlet, Link } from "@tanstack/react-router";
import { Activity, Cpu, CalendarRange, Users, Settings, ScrollText, Wallet, Crown, Receipt, Globe, LayoutGrid, AlertOctagon, Mail, UtensilsCrossed } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { ConsoleShell } from "@/components/ConsoleShell";
import { getCafeBySlug } from "@/lib/cafes.functions";

export const Route = createFileRoute("/_authenticated/cafe/$slug")({
  head: () => ({ meta: [{ title: "Café Console — CoreCade" }] }),
  component: CafeLayout,
});

function CafeLayout() {
  const { slug } = Route.useParams();
  const fn = useServerFn(getCafeBySlug);
  const { data: cafe } = useQuery({
    queryKey: ["cafe", slug],
    queryFn: () => fn({ data: { slug } }),
  });

  const restricted = !!(cafe as { restricted_message?: string | null } | undefined)?.restricted_message;

  return (
    <ConsoleShell
      badge="Café Console"
      title={cafe?.name ?? "Café"}
      subtitle={cafe ? `${cafe.city ?? ""}${cafe.city ? " · " : ""}/${cafe.slug}` : "Loading workspace…"}
      nav={[
        { label: "Live floor", icon: Activity, to: "/cafe/$slug", params: { slug }, exact: true },
        { label: "Floor builder", icon: LayoutGrid, to: "/cafe/$slug/floor", params: { slug } },
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
