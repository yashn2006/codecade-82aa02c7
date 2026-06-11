import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/supabase/auth-middleware";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function assertSuperAdmin(ctx: { supabase: any; userId: string }) {
  const { data: ok } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId, _role: "super_admin",
  });
  if (!ok) throw new Error("Forbidden");
}

export const adminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/lib/supabase/client.server");
    const [cafes, users, sessions, leads] = await Promise.all([
      supabaseAdmin.from("cafes").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("sessions").select("id", { count: "exact", head: true }).eq("status", "active"),
      supabaseAdmin.from("contacts").select("id", { count: "exact", head: true }).eq("status", "new"),
    ]);
    return {
      cafes: cafes.count ?? 0,
      users: users.count ?? 0,
      activeSessions: sessions.count ?? 0,
      newLeads: leads.count ?? 0,
    };
  });

export const listAllCafes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/lib/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("cafes")
      .select("id, slug, name, city, state, is_active, restricted_message, owner_id, created_at, profiles:owner_id(email, full_name)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const setCafeRestriction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      restricted_message: z.string().max(500).nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/lib/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("cafes")
      .update({ restricted_message: data.restricted_message })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });


export const listContacts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/lib/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("contacts").select("*").order("created_at", { ascending: false }).limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const setContactStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), status: z.enum(["new", "resolved"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/lib/supabase/client.server");
    await supabaseAdmin.from("contacts").update({ status: data.status }).eq("id", data.id);
    return { ok: true };
  });

export const searchUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ q: z.string().max(120).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/lib/supabase/client.server");
    let query = supabaseAdmin
      .from("profiles")
      .select("id, email, full_name, created_at, user_roles(role, cafe_id)")
      .order("created_at", { ascending: false })
      .limit(50);
    if (data.q) query = query.ilike("email", `%${data.q}%`);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const grantRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      user_id: z.string().uuid(),
      role: z.enum(["super_admin", "cafe_owner", "cafe_staff", "customer"]),
      cafe_id: z.string().uuid().optional().nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/lib/supabase/client.server");
    const { error } = await supabaseAdmin.from("user_roles").insert({
      user_id: data.user_id,
      role: data.role,
      cafe_id: data.cafe_id ?? null,
    });
    if (error && !error.message.includes("duplicate")) throw new Error(error.message);
    return { ok: true };
  });

export const revokeRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      user_id: z.string().uuid(),
      role: z.enum(["super_admin", "cafe_owner", "cafe_staff", "customer"]),
      cafe_id: z.string().uuid().optional().nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/lib/supabase/client.server");
    let q = supabaseAdmin.from("user_roles").delete()
      .eq("user_id", data.user_id).eq("role", data.role);
    if (data.cafe_id) q = q.eq("cafe_id", data.cafe_id);
    else q = q.is("cafe_id", null);
    const { error } = await q;
    if (error) throw new Error(error.message);
    return { ok: true };
  });
