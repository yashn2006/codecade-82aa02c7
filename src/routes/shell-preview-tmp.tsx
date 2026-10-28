import { createFileRoute } from "@tanstack/react-router";
import { LayoutGrid, CalendarDays, Users, Wallet, BarChart3, Settings, Monitor, Coffee, Trophy } from "lucide-react";
import { ConsoleShell, type NavItem } from "@/components/ConsoleShell";

export const Route = createFileRoute("/shell-preview-tmp")({
  ssr: false,
  component: Preview,
});

const nav: NavItem[] = [
  { label: "Live Floor", icon: LayoutGrid, to: "/shell-preview-tmp", exact: true, group: "Operate" },
  { label: "Bookings", icon: CalendarDays, to: "/discover", group: "Operate" },
  { label: "Customers", icon: Users, to: "/features", group: "Operate" },
  { label: "Wallet", icon: Wallet, to: "/privacy", group: "Money" },
  { label: "Analytics", icon: BarChart3, to: "/terms", group: "Money" },
  { label: "Devices", icon: Monitor, to: "/auth", group: "Setup" },
  { label: "Menu", icon: Coffee, to: "/login", group: "Setup" },
  { label: "Tournaments", icon: Trophy, to: "/signup", group: "Setup" },
  { label: "Settings", icon: Settings, to: "/setup", group: "Setup" },
];

function Preview() {
  return (
    <ConsoleShell badge="Café console" title="Neon Arena" subtitle="Pune" nav={nav}>
      <div className="space-y-3">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="h-24 rounded-2xl border border-border bg-card/60 p-4 text-sm">Card {i + 1}</div>
        ))}
      </div>
    </ConsoleShell>
  );
}
