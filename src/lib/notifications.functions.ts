import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/supabase/auth-middleware";

export const listNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("notifications")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(40);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const markAllRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", context.userId)
      .is("read_at", null);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const pushNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      user_id: z.string().uuid(),
      cafe_id: z.string().uuid().optional().nullable(),
      kind: z.string().max(40),
      title: z.string().max(120),
      body: z.string().max(400).optional().nullable(),
      link: z.string().max(400).optional().nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/lib/supabase/client.server");
    // verify caller is owner/admin of cafe (or super_admin)
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "super_admin" });
    if (!isAdmin && data.cafe_id) {
      const { data: cafe } = await context.supabase.from("cafes").select("owner_id").eq("id", data.cafe_id).maybeSingle();
      if (cafe?.owner_id !== context.userId) throw new Error("Forbidden");
    } else if (!isAdmin) {
      throw new Error("Forbidden");
    }
    const { error } = await supabaseAdmin.from("notifications").insert(data);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
