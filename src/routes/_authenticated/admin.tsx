import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { Shield, Building2, Users, FileText, Settings as SettingsIcon, TrendingUp, Megaphone, Activity, ScrollText, SlidersHorizontal, BarChart3, LifeBuoy, CalendarClock, IndianRupee } from "lucide-react";
import { ConsoleShell } from "@/components/ConsoleShell";
import { useAdminRealtime } from "@/hooks/useAdminRealtime";
import { supabase } from "@/lib/supabase/client";
import { guardRoute, isSuperAdmin } from "@/lib/auth-routing";


export const Route = createFileRoute("/_authenticated/admin")({
  ssr: false,
  head: () => ({ meta: [{ title: "Super Admin — CoreCade" }] }),
  beforeLoad: () => guardRoute((user, roles) => (isSuperAdmin(user, roles) ? null : "/portal")),
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
        { label: "Revenue", icon: TrendingUp, to: "/admin/revenue" },
        { label: "Subscriptions", icon: CalendarClock, to: "/admin/subscriptions" },
        { label: "Billing", icon: IndianRupee, to: "/admin/billing" },
        { label: "Reports", icon: BarChart3, to: "/admin/reports" },

        { label: "Health", icon: Activity, to: "/admin/health" },
        { label: "Cafés", icon: Building2, to: "/admin/cafes" },
        { label: "Users & roles", icon: Users, to: "/admin/users" },
        { label: "Audit log", icon: ScrollText, to: "/admin/audit" },
        { label: "Announcements", icon: Megaphone, to: "/admin/announcements" },
        { label: "Config", icon: SlidersHorizontal, to: "/admin/config" },
        { label: "Leads", icon: FileText, to: "/admin/leads" },
        { label: "Support", icon: LifeBuoy, to: "/admin/support" },
        { label: "Settings", icon: SettingsIcon, to: "/admin/settings" },
      ]}
    >
      <Outlet />
    </ConsoleShell>
  );
}
