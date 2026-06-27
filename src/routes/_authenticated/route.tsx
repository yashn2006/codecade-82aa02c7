import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getSupabaseUserReady } from "@/lib/auth-routing";
import { useIdleLogout } from "@/hooks/useIdleLogout";

function AuthenticatedLayout() {
  useIdleLogout(30 * 60 * 1000);
  return <Outlet />;
}

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const user = await getSupabaseUserReady();
    if (!user) throw redirect({ to: "/auth" });
    return { user };
  },
  component: AuthenticatedLayout,
});
