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

/** Full-screen session-check veil — prevents auth-page or empty-dashboard flash. */
function AuthPending() {
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-[#0a0018]">
      <div className="flex flex-col items-center gap-4">
        <div className="animate-pulse">
          <BrandLockup size={44} />
        </div>
        <div className="h-1 w-32 overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-1/3 rounded-full bg-[linear-gradient(90deg,#ff006e,#7000ff)] [animation:sweep-x_1.1s_ease-in-out_infinite]" />
        </div>
        <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
          securing session
        </p>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  pendingMs: 0,
  pendingComponent: AuthPending,
  beforeLoad: async () => {
    const user = await getSupabaseUserReady();
    if (!user) throw redirect({ to: "/auth" });
    return { user };
  },
  component: AuthenticatedLayout,
});
