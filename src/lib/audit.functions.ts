import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/supabase/auth-middleware";

export const listAuditLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ cafe_id: z.string().uuid(), limit: z.number().int().min(1).max(500).default(200) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { assertCafeOwnerOrAdmin } = await import("@/lib/staff-access.server");
    await assertCafeOwnerOrAdmin(context.userId, data.cafe_id, context.supabase);
    const { data: rows, error } = await context.supabase
      .from("audit_logs")
      .select("*")
      .eq("cafe_id", data.cafe_id)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
