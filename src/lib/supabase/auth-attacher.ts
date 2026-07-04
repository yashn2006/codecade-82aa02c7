import { createMiddleware } from "@tanstack/react-start";
import { supabase } from "./client";

// Cache the session lookup at module scope so every server-fn call in a
// burst (route preloads on first paint) waits on the SAME resolved promise
// instead of racing individual getSession() calls. Without this, the first
// preloads fire before Supabase finishes reading localStorage, ship with
// no bearer, and the 401 responses get cached — the dashboard shows empty
// until you navigate away and back.
let sessionReadyPromise: Promise<string | null> | null = null;

function sessionReady(): Promise<string | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (!sessionReadyPromise) {
    sessionReadyPromise = supabase.auth
      .getSession()
      .then(({ data }) => data.session?.access_token ?? null)
      .catch(() => null);
  }
  return sessionReadyPromise;
}

// Refresh the cached token whenever the auth state changes so sign-in /
// sign-out / token refresh are picked up immediately.
if (typeof window !== "undefined") {
  supabase.auth.onAuthStateChange((_event, session) => {
    sessionReadyPromise = Promise.resolve(session?.access_token ?? null);
  });
}

export const attachSupabaseAuth = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    const token = await sessionReady();
    if (!token) return next();
    return next({ headers: { Authorization: `Bearer ${token}` } });
  },
);
