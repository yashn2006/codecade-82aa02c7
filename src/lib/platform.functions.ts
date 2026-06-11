import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/supabase/auth-middleware";

// PUBLIC — anyone can read the platform maintenance banner.
export const getPlatformMaintenance = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/lib/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("platform_settings")
    .select("maintenance_starts_at, maintenance_ends_at, maintenance_message, maintenance_title")
    .eq("id", true)
    .maybeSingle();
  return {
    starts_at: data?.maintenance_starts_at ?? null,
    ends_at: data?.maintenance_ends_at ?? null,
    message: data?.maintenance_message ?? null,
    title: data?.maintenance_title ?? null,
  };
});

// SUPER ADMIN ONLY — schedule / clear network-wide maintenance.
export const setPlatformMaintenance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      starts_at: z.string().datetime().nullable(),
      ends_at: z.string().datetime().nullable(),
      title: z.string().max(120).nullable(),
      message: z.string().max(500).nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: ok } = await context.supabase.rpc("has_role", {
      _user_id: context.userId, _role: "super_admin",
    });
    if (!ok) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/lib/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("platform_settings")
      .upsert({
        id: true,
        maintenance_starts_at: data.starts_at,
        maintenance_ends_at: data.ends_at,
        maintenance_title: data.title,
        maintenance_message: data.message,
        updated_at: new Date().toISOString(),
        updated_by: context.userId,
      });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
