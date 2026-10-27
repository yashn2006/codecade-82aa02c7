import type { User } from "@supabase/supabase-js";
import { redirect } from "@tanstack/react-router";
import { supabase } from "@/lib/supabase/client";

export type DashboardPath = "/admin" | "/owner" | "/portal";

const SUPER_ADMIN_EMAILS = ["giganexa2026@gmail.com", "yashnandi77@gmail.com"];
const ROLE_TTL_MS = 5 * 60_000;

/* ------------------------------------------------------------------ */
/* In-tab caches. Route guards run on EVERY navigation; without these */
/* each sidebar click waited on a session lookup + a roles query,     */
/* which made section switches feel sticky and flashed the veil.      */
/* ------------------------------------------------------------------ */
let cachedUser: User | null = null;
const roleCache = new Map<string, { roles: Set<string>; at: number }>();

if (typeof window !== "undefined") {
  supabase.auth.onAuthStateChange((_event, session) => {
    const next = session?.access_token && session.user ? session.user : null;
    if (!next || (cachedUser && cachedUser.id !== next.id)) roleCache.clear();
    cachedUser = next;
  });
}

/** Synchronous: the signed-in user for this tab, if already confirmed. */
export function getCachedUser(): User | null {
  return cachedUser;
}

export function getCachedRoles(userId: string): Set<string> | null {
  const hit = roleCache.get(userId);
  if (!hit || Date.now() - hit.at > ROLE_TTL_MS) return null;
  return hit.roles;
}

export async function getUserRoles(userId: string): Promise<Set<string>> {
  const cached = getCachedRoles(userId);
  if (cached) return cached;
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const roles = new Set((data ?? []).map((r) => r.role as string));
  if (!error) roleCache.set(userId, { roles, at: Date.now() });
  return roles;
}

export async function getSupabaseUserReady(timeoutMs = 1600): Promise<User | null> {
  if (cachedUser) return cachedUser;
  // CRITICAL: require an access_token, not just a user. The bearer-attacher
  // middleware reads getSession() per server-fn call; if we let the route
  // render before the token is hydrated, the first wave of dashboard queries
  // fires unauthenticated, errors silently, and the cached empty state sticks.
  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData.session?.access_token && sessionData.session.user) {
    cachedUser = sessionData.session.user;
    return cachedUser;
  }

  if (typeof window === "undefined") return null;

  return new Promise((resolve) => {
    let settled = false;
    let subscription: { unsubscribe: () => void } | undefined;

    const finish = (user: User | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      subscription?.unsubscribe();
      resolve(user);
    };

    const timer = window.setTimeout(async () => {
      // Last-ditch: ask Supabase to validate whatever's in storage.
      const { data } = await supabase.auth.getUser();
      finish(data.user ?? null);
    }, timeoutMs);

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.access_token && session.user) finish(session.user);
    });
    subscription = data.subscription;
  });
}

export function dashboardPathFor(user: User, roles: Set<string>): DashboardPath {
  const email = user.email?.toLowerCase() ?? "";
  if (SUPER_ADMIN_EMAILS.includes(email) && roles.has("super_admin")) return "/admin";
  if (roles.has("cafe_owner")) return "/owner";
  return "/portal";
}

export async function getDashboardPathForUser(user: User): Promise<DashboardPath> {
  return dashboardPathFor(user, await getUserRoles(user.id));
}

export function isSuperAdmin(user: User, roles: Set<string>) {
  return !!user.email && SUPER_ADMIN_EMAILS.includes(user.email.toLowerCase()) && roles.has("super_admin");
}

type GuardTarget = "/auth" | "/portal" | null;

/**
 * Route guard for beforeLoad. Returns synchronously (no pending state, no
 * flicker) when the user and roles are already known in this tab; falls back
 * to an async check on a cold load.
 */
export function guardRoute(check: (user: User, roles: Set<string>) => GuardTarget): void | Promise<void> {
  const user = getCachedUser();
  const roles = user ? getCachedRoles(user.id) : null;
  if (user && roles) {
    const to = check(user, roles);
    if (to) throw redirect({ to });
    return;
  }
  return (async () => {
    const u = await getSupabaseUserReady();
    if (!u) throw redirect({ to: "/auth" });
    const r = await getUserRoles(u.id);
    const to = check(u, r);
    if (to) throw redirect({ to });
  })();
}
