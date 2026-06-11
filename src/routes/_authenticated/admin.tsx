import { createFileRoute, Outlet } from "@tanstack/react-router";
import { Shield, Building2, Users, FileText, Settings as SettingsIcon, TrendingUp } from "lucide-react";
import { ConsoleShell } from "@/components/ConsoleShell";
import { useAdminRealtime } from "@/hooks/useAdminRealtime";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Super Admin — CoreCade" }] }),
  component: AdminLayout,
});

function AdminLayout() {
  useAdminRealtime();
  return (
    <ConsoleShell
      badge="Super Admin"
      title="Network command center"
      subtitle="Cafés, users, leads — the whole platform from one console."
      intensity="hero"
      nav={[
        { label: "Overview", icon: Shield, to: "/admin", exact: true },
        { label: "Cafés", icon: Building2, to: "/admin/cafes" },
        { label: "Users & roles", icon: Users, to: "/admin/users" },
        { label: "Leads", icon: FileText, to: "/admin/leads" },
        { label: "Settings", icon: SettingsIcon, to: "/admin/settings" },
      ]}
    >
      <Outlet />
    </ConsoleShell>
  );
}
