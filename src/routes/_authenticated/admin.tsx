import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Shield, Building2, Users, FileText, Settings as SettingsIcon, TrendingUp, Megaphone, Activity, ScrollText, SlidersHorizontal, BarChart3, LifeBuoy, CalendarClock, IndianRupee } from "lucide-react";
import { ConsoleShell } from "@/components/ConsoleShell";
import { useAdminRealtime } from "@/hooks/useAdminRealtime";
import { guardRoute, isSuperAdmin } from "@/lib/auth-routing";
import { adminOverview, listAllCafes, listContacts, adminListUsersFull } from "@/lib/admin.functions";
import { getNetworkAnalytics } from "@/lib/analytics.functions";
import { adminListSubscriptions, adminListInvoices, getBillingDetails } from "@/lib/billing.functions";
import { listAdminTickets } from "@/lib/tickets.functions";


export const Route = createFileRoute("/_authenticated/admin")({
  ssr: false,
  head: () => ({ meta: [{ title: "Super Admin — CoreCade" }] }),
  beforeLoad: () => guardRoute((user, roles) => (isSuperAdmin(user, roles) ? null : "/portal")),
  component: AdminLayout,
});

function AdminLayout() {
  useAdminRealtime();
  const qc = useQueryClient();
  const ovFn = useServerFn(adminOverview);
  const anFn = useServerFn(getNetworkAnalytics);
  const cafesFn = useServerFn(listAllCafes);
  const subsFn = useServerFn(adminListSubscriptions);
  const invFn = useServerFn(adminListInvoices);
  const billFn = useServerFn(getBillingDetails);
  const leadsFn = useServerFn(listContacts);
  const usersFn = useServerFn(adminListUsersFull);
  const ticketsFn = useServerFn(listAdminTickets);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void qc.prefetchQuery({ queryKey: ["admin-overview"], queryFn: () => ovFn() });
      void qc.prefetchQuery({ queryKey: ["admin-analytics"], queryFn: () => anFn() });
      void qc.prefetchQuery({ queryKey: ["admin-cafes"], queryFn: () => cafesFn() });
      void qc.prefetchQuery({ queryKey: ["admin-subscriptions"], queryFn: () => subsFn() });
      void qc.prefetchQuery({ queryKey: ["admin-invoices"], queryFn: () => invFn() });
      void qc.prefetchQuery({ queryKey: ["billing-details"], queryFn: () => billFn() });
      void qc.prefetchQuery({ queryKey: ["admin-leads"], queryFn: () => leadsFn() });
      void qc.prefetchQuery({ queryKey: ["admin-users-full", ""], queryFn: () => usersFn({ data: { search: "" } }) });
      void qc.prefetchQuery({ queryKey: ["admin-tickets"], queryFn: () => ticketsFn() });
    }, 150);
    return () => window.clearTimeout(t);
  }, [qc, ovFn, anFn, cafesFn, subsFn, invFn, billFn, leadsFn, usersFn, ticketsFn]);

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
