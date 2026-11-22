import { createMiddleware } from "@tanstack/react-start";
import { getRequestHeader, setResponseStatus } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../supabase-config";

export const requireSupabaseAuth = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const authHeader = getRequestHeader("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      setResponseStatus(401);
      throw new Error("Unauthorized: No authorization header provided");
    }
    const token = authHeader.slice(7);

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      setResponseStatus(401);
      throw new Error("Unauthorized");
    }

    return next({
      context: { supabase, userId: data.user.id, claims: data.user },
    });
  },
);
