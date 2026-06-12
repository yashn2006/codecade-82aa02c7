import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/supabase/auth-middleware";

const rangeSchema = z.object({
  cafe_id: z.string().uuid().optional(),
  from: z.string(), // ISO date
  to: z.string(),
});

export const getCafeReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    cafe_id: z.string().uuid(),
    from: z.string(),
    to: z.string(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { cafe_id, from, to } = data;
    const [sessions, pos, memberships, tournaments, customers, devices] = await Promise.all([
      context.supabase.from("sessions")
        .select("id, amount, duration_minutes, started_at, ended_at, customer_id, device_id, devices(name, type), customers(full_name)")
        .eq("cafe_id", cafe_id).gte("started_at", from).lte("started_at", to),
      context.supabase.from("pos_orders").select("id, total_amount, created_at").eq("cafe_id", cafe_id).gte("created_at", from).lte("created_at", to),
      context.supabase.from("customer_memberships").select("id, amount_paid, created_at").eq("cafe_id", cafe_id).gte("created_at", from).lte("created_at", to),
      context.supabase.from("tournament_registrations").select("id, entry_fee_paid, tournaments!inner(cafe_id)").eq("tournaments.cafe_id", cafe_id),
      context.supabase.from("customers").select("id, full_name, total_spent, total_sessions").eq("cafe_id", cafe_id).order("total_spent", { ascending: false }).limit(10),
      context.supabase.from("devices").select("id, name, type").eq("cafe_id", cafe_id),
    ]);

    const sessionRows = sessions.data ?? [];
    const sessionsRevenue = sessionRows.reduce((s, r) => s + (r.amount ?? 0), 0);
    const fnbRevenue = (pos.data ?? []).reduce((s, r) => s + (r.total_amount ?? 0), 0);
    const membershipsRevenue = (memberships.data ?? []).reduce((s, r) => s + (r.amount_paid ?? 0), 0);
    const tournamentsRevenue = (tournaments.data ?? []).reduce((s, r) => s + (r.entry_fee_paid ?? 0), 0);
    const totalRevenue = sessionsRevenue + fnbRevenue + membershipsRevenue + tournamentsRevenue;

    // Peak-hour heatmap (24x7)
    const heatmap: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    for (const r of sessionRows) {
      if (!r.started_at) continue;
      const d = new Date(r.started_at);
      heatmap[d.getDay()][d.getHours()] += 1;
    }

    // Top devices
    const deviceMap = new Map<string, { name: string; type: string; sessions: number; revenue: number }>();
    for (const d of devices.data ?? []) deviceMap.set(d.id, { name: d.name, type: d.type, sessions: 0, revenue: 0 });
    for (const s of sessionRows) {
      if (!s.device_id) continue;
      const dv = deviceMap.get(s.device_id);
      if (dv) { dv.sessions += 1; dv.revenue += s.amount ?? 0; }
    }
    const topDevices = Array.from(deviceMap.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 8);

    // Daily series
    const dayMap = new Map<string, number>();
    for (const r of sessionRows) {
      if (!r.started_at) continue;
      const k = r.started_at.slice(0, 10);
      dayMap.set(k, (dayMap.get(k) ?? 0) + (r.amount ?? 0));
    }
    const dailySeries = Array.from(dayMap.entries()).sort().map(([d, v]) => ({ d, v }));

    return {
      totalRevenue,
      breakdown: {
        sessions: sessionsRevenue,
        fnb: fnbRevenue,
        memberships: membershipsRevenue,
        tournaments: tournamentsRevenue,
      },
      sessionCount: sessionRows.length,
      heatmap,
      topDevices,
      topCustomers: customers.data ?? [],
      dailySeries,
      sessionsRaw: sessionRows,
    };
  });

export const getNetworkReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ from: z.string(), to: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "super_admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/lib/supabase/client.server");

    const [sessions, pos, memberships, cafes] = await Promise.all([
      supabaseAdmin.from("sessions").select("id, amount, cafe_id, started_at, cafes(name, slug)").gte("started_at", data.from).lte("started_at", data.to),
      supabaseAdmin.from("pos_orders").select("total_amount, cafe_id, created_at").gte("created_at", data.from).lte("created_at", data.to),
      supabaseAdmin.from("customer_memberships").select("amount_paid, cafe_id, created_at").gte("created_at", data.from).lte("created_at", data.to),
      supabaseAdmin.from("cafes").select("id, name, slug, city, status"),
    ]);

    const sessionsRevenue = (sessions.data ?? []).reduce((s, r) => s + (r.amount ?? 0), 0);
    const fnbRevenue = (pos.data ?? []).reduce((s, r) => s + (r.total_amount ?? 0), 0);
    const membershipsRevenue = (memberships.data ?? []).reduce((s, r) => s + (r.amount_paid ?? 0), 0);

    const cafeMap = new Map<string, { name: string; slug: string; city: string | null; revenue: number; sessions: number }>();
    for (const c of cafes.data ?? []) cafeMap.set(c.id, { name: c.name, slug: c.slug, city: c.city, revenue: 0, sessions: 0 });
    for (const s of sessions.data ?? []) {
      if (!s.cafe_id) continue;
      const c = cafeMap.get(s.cafe_id);
      if (c) { c.revenue += s.amount ?? 0; c.sessions += 1; }
    }
    for (const p of pos.data ?? []) {
      if (!p.cafe_id) continue;
      const c = cafeMap.get(p.cafe_id);
      if (c) c.revenue += p.total_amount ?? 0;
    }
    const topCafes = Array.from(cafeMap.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 10);

    const dayMap = new Map<string, number>();
    for (const r of sessions.data ?? []) {
      if (!r.started_at) continue;
      const k = r.started_at.slice(0, 10);
      dayMap.set(k, (dayMap.get(k) ?? 0) + (r.amount ?? 0));
    }
    const dailySeries = Array.from(dayMap.entries()).sort().map(([d, v]) => ({ d, v }));

    return {
      totalRevenue: sessionsRevenue + fnbRevenue + membershipsRevenue,
      breakdown: { sessions: sessionsRevenue, fnb: fnbRevenue, memberships: membershipsRevenue },
      sessionCount: sessions.data?.length ?? 0,
      cafeCount: cafes.data?.length ?? 0,
      topCafes,
      dailySeries,
    };
  });
