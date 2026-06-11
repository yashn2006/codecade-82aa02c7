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
    const { data: cafes, error } = await supabaseAdmin
      .from("cafes")
      .select("id, slug, name, city, state, is_active, restricted_message, maintenance_starts_at, maintenance_ends_at, maintenance_message, owner_id, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const rows = cafes ?? [];
    const ownerIds = Array.from(new Set(rows.map((c) => c.owner_id).filter(Boolean)));
    let ownerMap = new Map<string, { email: string | null; full_name: string | null }>();
    if (ownerIds.length) {
      const { data: owners } = await supabaseAdmin
        .from("profiles")
        .select("id, email, full_name")
        .in("id", ownerIds);
      ownerMap = new Map((owners ?? []).map((o) => [o.id, { email: o.email, full_name: o.full_name }]));
    }
    return rows.map((c) => ({ ...c, profiles: ownerMap.get(c.owner_id) ?? null }));
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

export const adminCreateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      email: z.string().email().max(200),
      full_name: z.string().max(120).optional().nullable(),
      password: z.string().min(8).max(120).optional().nullable(),
      role: z.enum(["super_admin", "cafe_owner", "cafe_staff", "customer"]).optional(),
      cafe_id: z.string().uuid().optional().nullable(),
      send_invite: z.boolean().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/lib/supabase/client.server");

    // Reuse if profile exists
    const { data: existing } = await supabaseAdmin
      .from("profiles").select("id").eq("email", data.email).maybeSingle();
    let userId = existing?.id as string | undefined;

    if (!userId) {
      if (data.send_invite) {
        const { data: inv, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, {
          data: { full_name: data.full_name ?? null },
        });
        if (error) throw new Error(error.message);
        userId = inv.user?.id;
      } else {
        const { data: cr, error } = await supabaseAdmin.auth.admin.createUser({
          email: data.email,
          password: data.password ?? crypto.randomUUID(),
          email_confirm: true,
          user_metadata: { full_name: data.full_name ?? null },
        });
        if (error) throw new Error(error.message);
        userId = cr.user?.id;
      }
    }
    if (!userId) throw new Error("Could not create user");

    if (data.full_name) {
      await supabaseAdmin.from("profiles").update({ full_name: data.full_name }).eq("id", userId);
    }
    if (data.role) {
      await supabaseAdmin.from("user_roles").insert({
        user_id: userId, role: data.role, cafe_id: data.cafe_id ?? null,
      });
    }
    return { ok: true, user_id: userId };
  });

// ───────────────────────────────────────────────────────────────────
// Phase 6 — Super-admin command center expansions
// ───────────────────────────────────────────────────────────────────

export const deleteCafe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/lib/supabase/client.server");
    const { error } = await supabaseAdmin.from("cafes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ user_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    if (data.user_id === context.userId) throw new Error("You cannot delete your own account here.");
    const { supabaseAdmin } = await import("@/lib/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ user_id: z.string().uuid(), password: z.string().min(8).max(120) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/lib/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
      password: data.password,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const generateRecoveryLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ email: z.string().email() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/lib/supabase/client.server");
    const { data: link, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: data.email,
    });
    if (error) throw new Error(error.message);
    return { url: link?.properties?.action_link ?? null };
  });

export const cafeDeepStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ cafe_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/lib/supabase/client.server");
    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
    const [devices, customers, staff, sessTotal, sessToday, revAll] = await Promise.all([
      supabaseAdmin.from("devices").select("id", { count: "exact", head: true }).eq("cafe_id", data.cafe_id),
      supabaseAdmin.from("customers").select("id", { count: "exact", head: true }).eq("cafe_id", data.cafe_id),
      supabaseAdmin.from("user_roles").select("user_id", { count: "exact", head: true }).eq("cafe_id", data.cafe_id).eq("role", "cafe_staff"),
      supabaseAdmin.from("sessions").select("id", { count: "exact", head: true }).eq("cafe_id", data.cafe_id),
      supabaseAdmin.from("sessions").select("amount").eq("cafe_id", data.cafe_id).gte("started_at", startOfDay.toISOString()),
      supabaseAdmin.from("sessions").select("amount").eq("cafe_id", data.cafe_id).not("amount", "is", null),
    ]);
    const revenueToday = (sessToday.data ?? []).reduce((s, r) => s + (r.amount ?? 0), 0);
    const revenueAll = (revAll.data ?? []).reduce((s, r) => s + (r.amount ?? 0), 0);
    return {
      devices: devices.count ?? 0,
      customers: customers.count ?? 0,
      staff: staff.count ?? 0,
      sessionsTotal: sessTotal.count ?? 0,
      sessionsToday: sessToday.data?.length ?? 0,
      revenueToday,
      revenueAll,
    };
  });

export const networkBroadcast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ title: z.string().max(120).nullable(), message: z.string().max(500).nullable() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/lib/supabase/client.server");
    const { error } = await supabaseAdmin.from("platform_settings").upsert({
      id: true,
      maintenance_title: data.title,
      maintenance_message: data.message,
      updated_at: new Date().toISOString(),
      updated_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });



// ============ Platform-wide revenue analytics ============
export const platformRevenueAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/lib/supabase/client.server");
    const since = new Date(Date.now() - 30 * 86400_000).toISOString();

    const [{ data: orders }, { data: sessions }, { data: topCafes }] = await Promise.all([
      supabaseAdmin.from("orders").select("cafe_id, total_amount, subtotal, refund_amount, created_at, status").gte("created_at", since),
      supabaseAdmin.from("sessions").select("cafe_id, amount, duration_minutes, ended_at").not("ended_at", "is", null).gte("ended_at", since),
      supabaseAdmin.from("cafes").select("id, name, slug, city").order("created_at", { ascending: false }).limit(100),
    ]);

    const cafeMap = new Map((topCafes ?? []).map((c) => [c.id, c]));
    const daily = new Map<string, { date: string; orders: number; sessions: number; revenue: number }>();
    const byCafe = new Map<string, { cafe_id: string; name: string; city: string | null; orders: number; sessions: number; revenue: number }>();

    for (const o of orders ?? []) {
      if (o.status === "void") continue;
      const day = new Date(o.created_at).toISOString().slice(0, 10);
      const dd = daily.get(day) ?? { date: day, orders: 0, sessions: 0, revenue: 0 };
      const rev = (o.total_amount || o.subtotal || 0) - (o.refund_amount || 0);
      dd.orders++; dd.revenue += rev;
      daily.set(day, dd);
      const c = cafeMap.get(o.cafe_id);
      if (c) {
        const e = byCafe.get(o.cafe_id) ?? { cafe_id: o.cafe_id, name: c.name, city: c.city, orders: 0, sessions: 0, revenue: 0 };
        e.orders++; e.revenue += rev; byCafe.set(o.cafe_id, e);
      }
    }
    for (const s of sessions ?? []) {
      const day = new Date(s.ended_at!).toISOString().slice(0, 10);
      const dd = daily.get(day) ?? { date: day, orders: 0, sessions: 0, revenue: 0 };
      dd.sessions++; dd.revenue += s.amount || 0;
      daily.set(day, dd);
      const c = cafeMap.get(s.cafe_id);
      if (c) {
        const e = byCafe.get(s.cafe_id) ?? { cafe_id: s.cafe_id, name: c.name, city: c.city, orders: 0, sessions: 0, revenue: 0 };
        e.sessions++; e.revenue += s.amount || 0; byCafe.set(s.cafe_id, e);
      }
    }

    const totalRevenue = Array.from(daily.values()).reduce((s, d) => s + d.revenue, 0);
    return {
      totalRevenue,
      totalOrders: (orders ?? []).filter((o) => o.status !== "void").length,
      totalSessions: (sessions ?? []).length,
      daily: Array.from(daily.values()).sort((a, b) => a.date.localeCompare(b.date)),
      topCafes: Array.from(byCafe.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 12),
    };
  });
