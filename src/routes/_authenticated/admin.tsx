import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { Shield, Building2, Users, FileText, Settings as SettingsIcon, TrendingUp, Megaphone, Activity, ScrollText, SlidersHorizontal, BarChart3 } from "lucide-react";
import { ConsoleShell } from "@/components/ConsoleShell";
import { useAdminRealtime } from "@/hooks/useAdminRealtime";
import { supabase } from "@/lib/supabase/client";
import { getSupabaseUserReady } from "@/lib/auth-routing";

const SUPER_ADMIN_EMAILS = ["giganexa2026@gmail.com", "yashnandi77@gmail.com"];

export const Route = createFileRoute("/_authenticated/admin")({
  ssr: false,
  head: () => ({ meta: [{ title: "Super Admin — CoreCade" }] }),
  beforeLoad: async () => {
    const user = await getSupabaseUserReady();
    if (!user) throw redirect({ to: "/auth" });
    if (!user.email || !SUPER_ADMIN_EMAILS.includes(user.email.toLowerCase())) {
      throw redirect({ to: "/portal" });
    }
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "super_admin")
      .limit(1);
    if (!roles || roles.length === 0) {
      throw redirect({ to: "/portal" });
    }
  },
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
        { label: "Reports", icon: BarChart3, to: "/admin/reports" },
        { label: "Health", icon: Activity, to: "/admin/health" },
        { label: "Cafés", icon: Building2, to: "/admin/cafes" },
        { label: "Users & roles", icon: Users, to: "/admin/users" },
        { label: "Audit log", icon: ScrollText, to: "/admin/audit" },
        { label: "Announcements", icon: Megaphone, to: "/admin/announcements" },
        { label: "Config", icon: SlidersHorizontal, to: "/admin/config" },
        { label: "Leads", icon: FileText, to: "/admin/leads" },
        { label: "Settings", icon: SettingsIcon, to: "/admin/settings" },
      ]}
    >
      <Outlet />
    </ConsoleShell>
  );
}
