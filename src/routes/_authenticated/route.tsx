import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getCachedUser, getSupabaseUserReady } from "@/lib/auth-routing";
import { useIdleLogout } from "@/hooks/useIdleLogout";
import { BrandLockup } from "@/components/Brand";

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
    <div className="fixed inset-0 z-[100] grid place-items-center bg-[#07050f]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-96 w-96 rounded-full bg-primary/20 blur-[100px]" />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-5">
        <div className="transition-transform animate-pulse">
          <BrandLockup size={46} />
        </div>

        <div className="relative h-1.5 w-48 overflow-hidden rounded-full bg-white/10 ring-1 ring-white/15">
          <div className="absolute inset-0 w-full animate-pulse bg-gradient-to-r from-primary via-accent to-emerald-400" />
        </div>

        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.24em] text-white/60">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
          <span>Synchronizing Arena…</span>
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  pendingMs: 0,
  pendingComponent: AuthPending,
  beforeLoad: () => {
    // Already signed in this tab → resolve synchronously so section clicks
    // never flash the full-screen veil.
    const cached = getCachedUser();
    if (cached) return { user: cached };
    return (async () => {
      const user = await getSupabaseUserReady();
      if (!user) throw redirect({ to: "/auth" });
      return { user };
    })();
  },
  component: AuthenticatedLayout,
});
