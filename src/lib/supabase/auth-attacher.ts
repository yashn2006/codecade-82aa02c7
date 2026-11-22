import { createMiddleware } from "@tanstack/react-start";
import { supabase } from "./client";

// Cache the session lookup at module scope so every server-fn call in a
// burst (route preloads on first paint) waits on the SAME resolved promise
// instead of racing individual getSession() calls. Without this, the first
// preloads fire before Supabase finishes reading localStorage, ship with
// no bearer, and the 401 responses get cached — the dashboard shows empty
// until you navigate away and back.
let currentToken: string | null = null;
let tokenExpiresAt = 0;
let inFlightSession: Promise<string | null> | null = null;
let inFlightRefresh: Promise<string | null> | null = null;

function refreshSessionOnce(): Promise<string | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (!inFlightRefresh) {
    inFlightRefresh = supabase.auth
      .refreshSession()
      .then(({ data }) => {
        const token = data.session?.access_token ?? null;
        currentToken = token;
        tokenExpiresAt = data.session?.expires_at ?? 0;
        return token;
      })
      .catch(() => null)
      .finally(() => {
        inFlightRefresh = null;
      });
  }
  return inFlightRefresh;
}

function sessionReady(): Promise<string | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  const nowSec = Math.floor(Date.now() / 1000);
  if (currentToken && (!tokenExpiresAt || tokenExpiresAt - nowSec > 30)) {
    return Promise.resolve(currentToken);
  }
  if (!inFlightSession) {
    inFlightSession = supabase.auth
      .getSession()
      .then(({ data }) => {
        const session = data.session;
        const token = session?.access_token ?? null;
        if (!token) {
          currentToken = null;
          tokenExpiresAt = 0;
          return null;
        }
        const exp = session?.expires_at ?? 0;
        if (exp && exp <= Math.floor(Date.now() / 1000) + 15) {
          return refreshSessionOnce();
        }
        currentToken = token;
        tokenExpiresAt = exp;
        return token;
      })
      .catch(() => null)
      .finally(() => {
        inFlightSession = null;
      });
  }
  return inFlightSession;
}

// Refresh the cached token whenever the auth state changes so sign-in /
// sign-out / token refresh are picked up immediately.
if (typeof window !== "undefined") {
  supabase.auth.onAuthStateChange((_event, session) => {
    currentToken = session?.access_token ?? null;
    tokenExpiresAt = session?.expires_at ?? 0;
  });
}

export const attachSupabaseAuth = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    const token = await sessionReady();
    try {
      return await (token
        ? next({ headers: { Authorization: `Bearer ${token}` } })
        : next());
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (/unauthorized/i.test(msg) && typeof window !== "undefined") {
        currentToken = null;
        tokenExpiresAt = 0;
        void refreshSessionOnce();
      }
      throw err;
    }
  },
);
