import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getSupabaseUserReady } from "@/lib/auth-routing";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const user = await getSupabaseUserReady();
    if (!user) throw redirect({ to: "/auth" });
    return { user };
  },
  component: () => <Outlet />,
});
