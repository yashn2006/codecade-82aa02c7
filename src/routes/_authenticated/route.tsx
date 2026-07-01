import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getSupabaseUserReady } from "@/lib/auth-routing";
import { useIdleLogout } from "@/hooks/useIdleLogout";

function AuthenticatedLayout() {
  useIdleLogout(30 * 60 * 1000);
  const queryClient = useQueryClient();
  const primed = useRef(false);

  // Belt-and-suspenders: on first mount after sign-in, force a single
  // invalidation. Fixes "dashboard empty until I click another tab and come
  // back" — some queries preload during route intent-preload before the
  // Supabase bearer is attached, silently cache empty, and stick.
  useEffect(() => {
    if (primed.current) return;
    primed.current = true;
    const t = window.setTimeout(() => {
      queryClient.invalidateQueries();
    }, 50);
    return () => window.clearTimeout(t);
  }, [queryClient]);

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
