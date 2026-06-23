import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import process from "node:process";
import { SUPABASE_URL } from "../supabase-config";

// Server-only admin client. NEVER import from client-reachable modules at
// module scope. Load inside server function handlers via:
//   const { supabaseAdmin } = await import("@/lib/supabase/client.server");
//
// Lazy init so a missing secret only fails the specific handler that needs
// it (instead of crashing the whole Worker at boot).
let cached: SupabaseClient | null = null;

function build(): SupabaseClient {
  const serviceKey =
    process.env.EXTERNAL_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error(
      "EXTERNAL_SUPABASE_SERVICE_ROLE_KEY is not set. " +
        "Add it as a secret in Cloudflare (Workers & Pages → your project → " +
        "Settings → Variables and Secrets) using the Supabase service_role key " +
        "from Supabase → Project Settings → API.",
    );
  }
  return createClient(SUPABASE_URL, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const supabaseAdmin: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_t, prop) {
    if (!cached) cached = build();
    // @ts-expect-error dynamic proxy
    const v = cached[prop];
    return typeof v === "function" ? v.bind(cached) : v;
  },
});
