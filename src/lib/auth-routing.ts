import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";

export type DashboardPath = "/admin" | "/owner" | "/portal";

const SUPER_ADMIN_EMAILS = ["giganexa2026@gmail.com", "yashnandi77@gmail.com"];

export async function getSupabaseUserReady(timeoutMs = 1600): Promise<User | null> {
  // CRITICAL: require an access_token, not just a user. The bearer-attacher
  // middleware reads getSession() per server-fn call; if we let the route
  // render before the token is hydrated, the first wave of dashboard queries
  // fires unauthenticated, errors silently, and the cached empty state sticks
  // until the user navigates away and back. Wait for the real token here.
  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData.session?.access_token && sessionData.session.user) {
    return sessionData.session.user;
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

export async function getDashboardPathForUser(user: User): Promise<DashboardPath> {
  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  const roleSet = new Set((roles ?? []).map((r) => r.role));
  const email = user.email?.toLowerCase() ?? "";
  if (SUPER_ADMIN_EMAILS.includes(email) && roleSet.has("super_admin")) return "/admin";
  if (roleSet.has("cafe_owner")) return "/owner";
  return "/portal";
}
