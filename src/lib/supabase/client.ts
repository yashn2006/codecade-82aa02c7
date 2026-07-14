import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../supabase-config";

// Use sessionStorage so the session lives only for the current browser
// tab/session. Closing the browser (or the tab) forces a fresh sign-in —
// no more "why am I already logged in without entering my password".
// Refresh within the same tab still keeps the session, so normal in-app
// navigation is unaffected.
const authStorage =
  typeof window !== "undefined" ? window.sessionStorage : undefined;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: authStorage,
    storageKey: "cc-auth",
  },
});

