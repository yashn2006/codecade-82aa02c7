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
      .select("id, slug, name, city, state, is_active, restricted_message, maintenance_starts_at, maintenance_ends_at, maintenance_message, owner_id, trial_ends_at, created_at")
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

    // Look up an existing auth user by email (profile row may be stale / missing)
    let userId: string | undefined;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: list } = await (supabaseAdmin.auth.admin as any).listUsers({
        page: 1, perPage: 200,
      });
      const match = (list?.users ?? []).find(
        (u: { email?: string | null }) =>
          (u.email ?? "").toLowerCase() === data.email.toLowerCase(),
      );
      if (match) userId = match.id;
    } catch {
      /* ignore — fall through to create */
    }

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
    } else if (data.password) {
      // User already existed — apply admin-typed password and confirm email
      const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: data.password,
        email_confirm: true,
        user_metadata: { full_name: data.full_name ?? undefined },
      });
      if (updErr) throw new Error(updErr.message);
    }
    if (!userId) throw new Error("Could not create user");

    // Ensure a profile row exists (in case the signup trigger didn't fire)
    await supabaseAdmin.from("profiles").upsert(
      { id: userId, email: data.email, full_name: data.full_name ?? null },
      { onConflict: "id" },
    );

    if (data.role) {
      const { error: roleErr } = await supabaseAdmin.from("user_roles").insert({
        user_id: userId, role: data.role, cafe_id: data.cafe_id ?? null,
      });
      if (roleErr && !roleErr.message.toLowerCase().includes("duplicate")) {
        throw new Error(roleErr.message);
      }
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


// ─── Global audit logs (super-admin only) ───
export const adminListAuditLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      cafe_id: z.string().uuid().optional().nullable(),
      action: z.string().max(60).optional().nullable(),
      q: z.string().max(120).optional().nullable(),
      limit: z.number().int().min(1).max(500).default(200),
    }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/lib/supabase/client.server");
    let q = supabaseAdmin
      .from("audit_logs")
      .select("*, cafes(name, slug)")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.cafe_id) q = q.eq("cafe_id", data.cafe_id);
    if (data.action) q = q.eq("action", data.action);
    if (data.q) q = q.ilike("actor_email", `%${data.q}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// ─── Broadcast announcement to many users via notifications ───
export const broadcastAnnouncement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      audience: z.enum(["all", "owners", "staff", "customers"]),
      title: z.string().min(1).max(120),
      body: z.string().max(400).optional().nullable(),
      link: z.string().max(400).optional().nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/lib/supabase/client.server");
    let userIds: string[] = [];
    if (data.audience === "all") {
      const { data: rows } = await supabaseAdmin.from("profiles").select("id");
      userIds = (rows ?? []).map((r) => r.id);
    } else {
      const roleMap = { owners: "cafe_owner", staff: "cafe_staff", customers: "customer" } as const;
      const { data: rows } = await supabaseAdmin
        .from("user_roles").select("user_id").eq("role", roleMap[data.audience]);
      userIds = Array.from(new Set((rows ?? []).map((r) => r.user_id)));
    }
    if (userIds.length === 0) return { ok: true, count: 0 };
    const payload = userIds.map((uid) => ({
      user_id: uid,
      cafe_id: null,
      kind: "announcement",
      title: data.title,
      body: data.body ?? null,
      link: data.link ?? null,
    }));
    for (let i = 0; i < payload.length; i += 500) {
      const { error } = await supabaseAdmin.from("notifications").insert(payload.slice(i, i + 500));
      if (error) throw new Error(error.message);
    }
    return { ok: true, count: userIds.length };
  });

// ─── System health snapshot ───
export const systemHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/lib/supabase/client.server");
    const since = new Date(Date.now() - 86400_000).toISOString();
    const [
      cafes, devices, sessionsActive, sessions24, users, users24,
      orders24, bookings24, leadsNew, notif24, audit24,
      cafesActive, cafesPaused,
    ] = await Promise.all([
      supabaseAdmin.from("cafes").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("devices").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("sessions").select("id", { count: "exact", head: true }).eq("status", "active"),
      supabaseAdmin.from("sessions").select("id", { count: "exact", head: true }).gte("started_at", since),
      supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", since),
      supabaseAdmin.from("orders").select("id", { count: "exact", head: true }).gte("created_at", since),
      supabaseAdmin.from("bookings").select("id", { count: "exact", head: true }).gte("created_at", since),
      supabaseAdmin.from("contacts").select("id", { count: "exact", head: true }).eq("status", "new"),
      supabaseAdmin.from("notifications").select("id", { count: "exact", head: true }).gte("created_at", since),
      supabaseAdmin.from("audit_logs").select("id", { count: "exact", head: true }).gte("created_at", since),
      supabaseAdmin.from("cafes").select("id", { count: "exact", head: true }).eq("is_active", true),
      supabaseAdmin.from("cafes").select("id", { count: "exact", head: true }).eq("is_active", false),
    ]);
    return {
      cafes: cafes.count ?? 0,
      cafesActive: cafesActive.count ?? 0,
      cafesPaused: cafesPaused.count ?? 0,
      devices: devices.count ?? 0,
      sessionsActive: sessionsActive.count ?? 0,
      sessions24: sessions24.count ?? 0,
      users: users.count ?? 0,
      users24: users24.count ?? 0,
      orders24: orders24.count ?? 0,
      bookings24: bookings24.count ?? 0,
      leadsNew: leadsNew.count ?? 0,
      notifications24: notif24.count ?? 0,
      audit24: audit24.count ?? 0,
    };
  });

// Lightweight list of cafés for filter dropdowns
export const adminCafeOptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/lib/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("cafes").select("id, name, slug").order("name");
    if (error) throw new Error(error.message);
    return data ?? [];
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

// ─── Platform config (fees, tax, branding, signup) ───
export const getPlatformConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/lib/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("platform_settings")
      .select("platform_fee_pct, default_tax_pct, currency, support_email, support_phone, brand_name, brand_tagline, signup_enabled, new_cafes_require_approval")
      .eq("id", true).maybeSingle();
    if (error) throw new Error(error.message);
    return data ?? {};
  });

export const savePlatformConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      platform_fee_pct: z.number().min(0).max(100),
      default_tax_pct: z.number().min(0).max(100),
      currency: z.string().min(2).max(8),
      support_email: z.string().email().max(200).nullable().optional(),
      support_phone: z.string().max(40).nullable().optional(),
      brand_name: z.string().max(80).nullable().optional(),
      brand_tagline: z.string().max(160).nullable().optional(),
      signup_enabled: z.boolean(),
      new_cafes_require_approval: z.boolean(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/lib/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("platform_settings")
      .update({ ...data, updated_at: new Date().toISOString(), updated_by: context.userId })
      .eq("id", true);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ─── Per-user activity summary ───
export const userActivity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ user_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/lib/supabase/client.server");
    const { data: summary, error } = await supabaseAdmin
      .rpc("user_activity_summary", { _user_id: data.user_id });
    if (error) throw new Error(error.message);
    // Recent audit (as actor)
    const { data: audit } = await supabaseAdmin
      .from("audit_logs")
      .select("id, created_at, action, resource_type, cafes(name, slug)")
      .eq("actor_id", data.user_id)
      .order("created_at", { ascending: false })
      .limit(20);
    return { summary: summary ?? {}, audit: audit ?? [] };
  });

// ─── Export full dataset (super-admin only) ───
export const exportDataset = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ kind: z.enum(["cafes", "users", "orders", "sessions", "bookings", "leads"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/lib/supabase/client.server");
    const cfg: Record<string, { table: string; select: string; order: string }> = {
      cafes:    { table: "cafes",    select: "id, name, slug, city, state, owner_id, is_active, restricted_message, created_at", order: "created_at" },
      users:    { table: "profiles", select: "id, email, full_name, created_at",                                                   order: "created_at" },
      orders:   { table: "orders",   select: "id, cafe_id, customer_id, subtotal, total_amount, refund_amount, status, payment_method, created_at", order: "created_at" },
      sessions: { table: "sessions", select: "id, cafe_id, device_id, customer_id, started_at, ended_at, duration_minutes, amount, status", order: "started_at" },
      bookings: { table: "bookings", select: "id, cafe_id, customer_id, start_at, end_at, deposit_amount, status, created_at",     order: "start_at" },
      leads:    { table: "contacts", select: "id, name, email, phone, message, status, created_at",                                 order: "created_at" },
    };
    const c = cfg[data.kind];
    const { data: rows, error } = await supabaseAdmin
      .from(c.table).select(c.select).order(c.order, { ascending: false }).limit(10000);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });


// ─── Phase 7 — Deep user inspector & moderation ───
// Lists every user from auth.users (paginated) and joins profile + roles.
export const adminListUsersFull = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      q: z.string().max(120).optional().nullable(),
      page: z.number().int().min(1).max(50).default(1),
      perPage: z.number().int().min(10).max(200).default(100),
    }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/lib/supabase/client.server");

    const { data: page, error } = await supabaseAdmin.auth.admin.listUsers({
      page: data.page,
      perPage: data.perPage,
    });
    if (error) throw new Error(error.message);
    const authUsers = page?.users ?? [];

    const ids = authUsers.map((u) => u.id);
    const [{ data: profiles }, { data: roles }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, email, full_name, created_at").in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
      supabaseAdmin.from("user_roles").select("user_id, role, cafe_id").in("user_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
    ]);
    const pMap = new Map((profiles ?? []).map((p) => [p.id, p]));
    const rMap = new Map<string, Array<{ role: string; cafe_id: string | null }>>();
    for (const r of roles ?? []) {
      const arr = rMap.get(r.user_id) ?? [];
      arr.push({ role: r.role, cafe_id: r.cafe_id });
      rMap.set(r.user_id, arr);
    }

    const merged = authUsers.map((u) => {
      const p = pMap.get(u.id);
      const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
      return {
        id: u.id,
        email: u.email ?? p?.email ?? null,
        phone: u.phone ?? null,
        full_name: p?.full_name ?? (typeof meta.full_name === "string" ? meta.full_name : null),
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at ?? null,
        email_confirmed_at: u.email_confirmed_at ?? null,
        banned_until: (u as { banned_until?: string | null }).banned_until ?? null,
        providers: (u.identities ?? []).map((i) => i.provider),
        user_roles: rMap.get(u.id) ?? [],
      };
    });

    const q = (data.q ?? "").trim().toLowerCase();
    const filtered = q
      ? merged.filter((u) =>
          (u.email ?? "").toLowerCase().includes(q) ||
          (u.full_name ?? "").toLowerCase().includes(q) ||
          u.id.toLowerCase().includes(q))
      : merged;

    return {
      users: filtered,
      page: data.page,
      perPage: data.perPage,
      total: filtered.length,
    };
  });

// Deep per-user detail: auth record, profile, roles, recent audit, owned cafés.
export const userDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ user_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/lib/supabase/client.server");

    const { data: au, error: aErr } = await supabaseAdmin.auth.admin.getUserById(data.user_id);
    if (aErr) throw new Error(aErr.message);
    const u = au.user;

    const [{ data: profile }, { data: roles }, { data: ownedCafes }, { data: audit }] = await Promise.all([
      supabaseAdmin.from("profiles").select("*").eq("id", data.user_id).maybeSingle(),
      supabaseAdmin.from("user_roles").select("role, cafe_id, cafes(name, slug)").eq("user_id", data.user_id),
      supabaseAdmin.from("cafes").select("id, name, slug, city, is_active, created_at").eq("owner_id", data.user_id),
      supabaseAdmin.from("audit_logs")
        .select("id, created_at, action, resource_type, resource_id, meta, cafes(name, slug)")
        .eq("actor_id", data.user_id)
        .order("created_at", { ascending: false })
        .limit(40),
    ]);

    return {
      auth: u ? {
        id: u.id,
        email: u.email,
        phone: u.phone,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
        email_confirmed_at: u.email_confirmed_at,
        phone_confirmed_at: (u as { phone_confirmed_at?: string | null }).phone_confirmed_at ?? null,
        banned_until: (u as { banned_until?: string | null }).banned_until ?? null,
        is_anonymous: (u as { is_anonymous?: boolean }).is_anonymous ?? false,
        user_metadata: u.user_metadata ?? {},
        app_metadata: u.app_metadata ?? {},
        identities: (u.identities ?? []).map((i) => ({
          provider: i.provider,
          email: (i.identity_data as { email?: string } | null)?.email ?? null,
          created_at: i.created_at,
          last_sign_in_at: i.last_sign_in_at,
        })),
      } : null,
      profile: profile ?? null,
      roles: roles ?? [],
      ownedCafes: ownedCafes ?? [],
      audit: audit ?? [],
    };
  });

// Restrict / un-restrict a user (uses Supabase ban duration).
export const setUserBan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      user_id: z.string().uuid(),
      // "none" = unban; otherwise a Postgres interval like "24h", "7d", "876000h" (~100y permanent)
      duration: z.enum(["none", "1h", "24h", "7d", "30d", "permanent"]),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    if (data.user_id === context.userId) throw new Error("You cannot ban yourself.");
    const { supabaseAdmin } = await import("@/lib/supabase/client.server");
    const map = { none: "none", "1h": "1h", "24h": "24h", "7d": "168h", "30d": "720h", permanent: "876000h" } as const;
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
      ban_duration: map[data.duration],
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
