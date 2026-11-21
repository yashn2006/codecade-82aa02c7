import { createFileRoute, Outlet, redirect, useRouter, type ErrorComponentProps } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getCachedRoles, getCachedUser, getSupabaseUserReady, getUserRoles } from "@/lib/auth-routing";
import { useIdleLogout } from "@/hooks/useIdleLogout";
import { BrandLockup } from "@/components/Brand";
import { ErrorState } from "@/components/ErrorState";
import { reportLovableError } from "@/lib/lovable-error-reporting";

function isStaffOnlyRoles(roles: Set<string> | null) {
  return Boolean(roles && roles.has("cafe_staff") && !roles.has("cafe_owner") && !roles.has("super_admin"));
}

function AuthenticatedLayout() {
  const [staffIdle, setStaffIdle] = useState(() => {
    const u = getCachedUser();
    const r = u ? getCachedRoles(u.id) : null;
    return isStaffOnlyRoles(r);
  });

  useEffect(() => {
    let active = true;
    void (async () => {
      const u = await getSupabaseUserReady();
      if (!u || !active) return;
      const roles = await getUserRoles(u.id);
      if (active) setStaffIdle(isStaffOnlyRoles(roles));
    })();
    return () => {
      active = false;
    };
  }, []);

  useIdleLogout(staffIdle ? 8 * 60 * 60 * 1000 : 30 * 60 * 1000);
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
      queryClient.invalidateQueries({ predicate: (q) => q.state.status === "error" });
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

function AuthErrorComponent({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "authenticated_route_error_component" });
  }, [error]);

  const desc = import.meta.env.DEV && error instanceof Error && error.message
    ? error.message
    : "We couldn't finish loading this section. Please try again.";

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg items-center justify-center px-4">
      <div className="w-full">
        <ErrorState
          title="This section couldn't load"
          description={desc}
          onRetry={() => {
            router.invalidate();
            reset();
          }}
        />
      </div>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  pendingMs: 0,
  pendingComponent: AuthPending,
  errorComponent: AuthErrorComponent,
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
