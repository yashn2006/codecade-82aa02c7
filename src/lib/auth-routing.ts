import type { User } from "@supabase/supabase-js";
import { redirect } from "@tanstack/react-router";
import { supabase } from "@/lib/supabase/client";

export type DashboardPath = "/admin" | "/owner" | "/portal" | `/cafe/${string}`;

const SUPER_ADMIN_EMAILS = ["giganexa2026@gmail.com", "yashnandi77@gmail.com"];
const ROLE_TTL_MS = 5 * 60_000;
const OAUTH_PENDING_KEY = "cc_oauth_pending";
const OAUTH_PENDING_TTL_MS = 10 * 60_000;

function readOAuthParams(searchStr: string, hashStr: string) {
  const sp = new URLSearchParams(searchStr.startsWith("?") ? searchStr.slice(1) : searchStr);
  const hp = new URLSearchParams(hashStr.startsWith("#") ? hashStr.slice(1) : hashStr);
  const hasToken =
    sp.has("code") ||
    hp.has("access_token") ||
    hp.has("refresh_token");
  const errorMessage =
    sp.get("error_description") ||
    hp.get("error_description") ||
    sp.get("error") ||
    hp.get("error") ||
    null;
  return { hasToken, errorMessage };
}

// Capture at module load BEFORE Supabase detectSessionInUrl strips query/hash.
const INITIAL_OAUTH =
  typeof window !== "undefined"
    ? readOAuthParams(window.location.search, window.location.hash)
    : { hasToken: false, errorMessage: null };

export function markOAuthPending(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(OAUTH_PENDING_KEY, String(Date.now()));
  } catch {
    /* ignore storage errors */
  }
}

export function clearOAuthPending(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(OAUTH_PENDING_KEY);
  } catch {
    /* ignore storage errors */
  }
}

export function hasPendingOAuth(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.sessionStorage.getItem(OAUTH_PENDING_KEY);
    if (!raw) return false;
    const ts = Number(raw);
    if (!Number.isFinite(ts) || Date.now() - ts > OAUTH_PENDING_TTL_MS) {
      window.sessionStorage.removeItem(OAUTH_PENDING_KEY);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function getOAuthErrorFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const live = readOAuthParams(window.location.search, window.location.hash);
  return live.errorMessage || INITIAL_OAUTH.errorMessage;
}

export function isOAuthReturn(): boolean {
  if (typeof window === "undefined") return false;
  const live = readOAuthParams(window.location.search, window.location.hash);
  return live.hasToken || INITIAL_OAUTH.hasToken || hasPendingOAuth();
}

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
    const subRef: { current?: { unsubscribe: () => void } } = {};

    const finish = (user: User | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      subRef.current?.unsubscribe();
      resolve(user);
    };

    const timer = window.setTimeout(async () => {
      // Last-ditch: ask Supabase to validate whatever's in storage.
      const [{ data: userData }, { data: sessionData }] = await Promise.all([
        supabase.auth.getUser(),
        supabase.auth.getSession(),
      ]);
      const validUser =
        userData.user && sessionData.session?.access_token ? userData.user : null;
      if (validUser) cachedUser = validUser;
      finish(validUser);
    }, timeoutMs);

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.access_token && session.user) finish(session.user);
    });
    subRef.current = data.subscription;
  });
}

export function dashboardPathFor(user: User, roles: Set<string>): DashboardPath {
  const email = user.email?.toLowerCase() ?? "";
  if (SUPER_ADMIN_EMAILS.includes(email) && roles.has("super_admin")) return "/admin";
  if (roles.has("cafe_owner")) return "/owner";
  return "/portal";
}

export async function getDashboardPathForUser(user: User): Promise<DashboardPath> {
  const roles = await getUserRoles(user.id);
  const base = dashboardPathFor(user, roles);
  if (base !== "/portal") return base;

  const { data: staffRow } = await supabase
    .from("staff_permissions")
    .select("cafe_id, cafes!inner(slug)")
    .eq("staff_user_id", user.id)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const slug = (staffRow?.cafes as { slug?: string } | null)?.slug;
  if (slug) return `/cafe/${slug}`;
  return "/portal";
}

export function isSuperAdmin(user: User, roles: Set<string>) {
  return (
    !!user.email &&
    SUPER_ADMIN_EMAILS.includes(user.email.toLowerCase()) &&
    roles.has("super_admin")
  );
}

type GuardTarget = DashboardPath | "/auth" | null;

/**
 * Route guard for beforeLoad. Returns synchronously (no pending state, no
 * flicker) when the user and roles are already known in this tab; falls back
 * to an async check on a cold load.
 */
export function guardRoute(
  check: (user: User, roles: Set<string>) => GuardTarget | Promise<GuardTarget>,
): void | Promise<void> {
  const user = getCachedUser();
  const roles = user ? getCachedRoles(user.id) : null;
  if (user && roles) {
    const res = check(user, roles);
    if (res instanceof Promise) {
      return res.then((to) => {
        if (to) throw redirect({ to: to as never });
      });
    }
    if (res) throw redirect({ to: res as never });
    return;
  }
  return (async () => {
    const u = await getSupabaseUserReady();
    if (!u) throw redirect({ to: "/auth" });
    const r = await getUserRoles(u.id);
    const to = await check(u, r);
    if (to) throw redirect({ to: to as never });
  })();
}
