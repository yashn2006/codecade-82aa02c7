import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/supabase/auth-middleware";

async function assertCafeOwner(ctx: { supabase: ReturnType<typeof Object> & { from: (t: string) => unknown; rpc: (n: string, p: unknown) => unknown }; userId: string }, cafeId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = ctx.supabase as any;
  const { data: isAdmin } = await sb.rpc("has_role", { _user_id: ctx.userId, _role: "super_admin" });
  if (isAdmin) return;
  const { data: cafe } = await sb.from("cafes").select("owner_id").eq("id", cafeId).maybeSingle();
  if (!cafe || cafe.owner_id !== ctx.userId) throw new Error("Forbidden");
}

export const listStaff = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ cafe_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertCafeOwner(context, data.cafe_id);
    const { supabaseAdmin } = await import("@/lib/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("staff_permissions")
      .select("id, staff_user_id, permissions, created_at, profiles:staff_user_id(email, full_name)")
      .eq("cafe_id", data.cafe_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const inviteStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      cafe_id: z.string().uuid(),
      email: z.string().email(),
      permissions: z.array(z.string()).default([]),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertCafeOwner(context, data.cafe_id);
    const { supabaseAdmin } = await import("@/lib/supabase/client.server");

    const { data: existing } = await supabaseAdmin
      .from("profiles").select("id").eq("email", data.email).maybeSingle();
    let staffId = existing?.id;
    if (!staffId) {
      const { data: inv, error: iErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email);
      if (iErr) throw new Error(iErr.message);
      staffId = inv.user?.id;
    }
    if (!staffId) throw new Error("Could not invite");

    const { error: pErr } = await supabaseAdmin.from("staff_permissions")
      .upsert({ cafe_id: data.cafe_id, staff_user_id: staffId, permissions: data.permissions }, { onConflict: "cafe_id,staff_user_id" });
    if (pErr) throw new Error(pErr.message);

    await supabaseAdmin.from("user_roles")
      .insert({ user_id: staffId, role: "cafe_staff", cafe_id: data.cafe_id })
      .select();

    return { ok: true };
  });

export const removeStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ cafe_id: z.string().uuid(), staff_user_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertCafeOwner(context, data.cafe_id);
    const { supabaseAdmin } = await import("@/lib/supabase/client.server");
    await supabaseAdmin.from("staff_permissions").delete()
      .eq("cafe_id", data.cafe_id).eq("staff_user_id", data.staff_user_id);
    await supabaseAdmin.from("user_roles").delete()
      .eq("cafe_id", data.cafe_id).eq("user_id", data.staff_user_id).eq("role", "cafe_staff");
    return { ok: true };
  });
