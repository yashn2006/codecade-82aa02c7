import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/lib/supabase/auth-middleware";

export const getMyRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("user_roles")
      .select("role, cafe_id")
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { roles: data ?? [], userId: context.userId };
  });
