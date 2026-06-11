import { createClient } from "@supabase/supabase-js";
import process from "node:process";
import { SUPABASE_URL } from "../supabase-config";

// Server-only admin client. NEVER import from client-reachable modules at
// module scope. Load inside server function handlers via:
//   const { supabaseAdmin } = await import("@/lib/supabase/client.server");
const serviceKey = process.env.EXTERNAL_SUPABASE_SERVICE_ROLE_KEY;
if (!serviceKey) {
  throw new Error("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY is not set");
}

export const supabaseAdmin = createClient(SUPABASE_URL, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
