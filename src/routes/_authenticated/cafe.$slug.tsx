import { createFileRoute, Outlet } from "@tanstack/react-router";
import { Activity, Cpu, CalendarRange, Users, Settings, ScrollText, Wallet, Crown, UtensilsCrossed, Receipt, Trophy, Globe } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
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

  return (
    <ConsoleShell
      badge="Café Console"
      title={cafe?.name ?? "Café"}
      subtitle={cafe ? `${cafe.city ?? ""}${cafe.city ? " · " : ""}/${cafe.slug}` : "Loading workspace…"}
      nav={[
        { label: "Live floor", icon: Activity, to: "/cafe/$slug", params: { slug }, exact: true },
        { label: "POS counter", icon: Receipt, to: "/cafe/$slug/pos", params: { slug } },
        { label: "Menu", icon: UtensilsCrossed, to: "/cafe/$slug/menu", params: { slug } },
        { label: "Tournaments", icon: Trophy, to: "/cafe/$slug/tournaments", params: { slug } },
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
      <Outlet />
    </ConsoleShell>
  );
}

