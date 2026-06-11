import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/supabase/auth-middleware";

export const getCafeAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ cafe_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
    const startOfWeek = new Date(Date.now() - 7 * 86400_000);

    const [today, week, ledger, active] = await Promise.all([
      context.supabase.from("sessions").select("amount, duration_minutes")
        .eq("cafe_id", data.cafe_id).gte("ended_at", startOfDay.toISOString()),
      context.supabase.from("sessions").select("amount, ended_at")
        .eq("cafe_id", data.cafe_id).gte("ended_at", startOfWeek.toISOString()).not("ended_at", "is", null),
      context.supabase.from("sessions")
        .select("id, started_at, ended_at, amount, duration_minutes, status, customers(full_name), devices(name, type)")
        .eq("cafe_id", data.cafe_id)
        .order("started_at", { ascending: false })
        .limit(15),
      context.supabase.from("sessions").select("id", { count: "exact", head: true })
        .eq("cafe_id", data.cafe_id).eq("status", "active"),
    ]);

    const revenueToday = (today.data ?? []).reduce((s, r) => s + (r.amount ?? 0), 0);
    const minutesToday = (today.data ?? []).reduce((s, r) => s + (r.duration_minutes ?? 0), 0);

    // bucket by day for the last 7 days
    const dayBuckets = new Map<string, number>();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400_000);
      const key = d.toISOString().slice(0, 10);
      dayBuckets.set(key, 0);
    }
    for (const r of week.data ?? []) {
      if (!r.ended_at) continue;
      const key = new Date(r.ended_at).toISOString().slice(0, 10);
      if (dayBuckets.has(key)) dayBuckets.set(key, (dayBuckets.get(key) ?? 0) + (r.amount ?? 0));
    }
    const weekSeries = Array.from(dayBuckets.entries()).map(([d, v]) => ({ d, v }));

    return {
      revenueToday,
      minutesToday,
      sessionsToday: today.data?.length ?? 0,
      activeSessions: active.count ?? 0,
      weekSeries,
      recent: ledger.data ?? [],
    };
  });

export const getNetworkAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "super_admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/lib/supabase/client.server");

    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
    const start7 = new Date(Date.now() - 7 * 86400_000);

    const [today, week, recentSessions, topCafes] = await Promise.all([
      supabaseAdmin.from("sessions").select("amount, duration_minutes")
        .gte("ended_at", startOfDay.toISOString()).not("ended_at", "is", null),
      supabaseAdmin.from("sessions").select("amount, ended_at")
        .gte("ended_at", start7.toISOString()).not("ended_at", "is", null),
      supabaseAdmin.from("sessions")
        .select("id, started_at, ended_at, amount, status, cafes(name, slug), devices(name, type), customers(full_name)")
        .order("started_at", { ascending: false }).limit(12),
      supabaseAdmin.from("cafes").select("id, name, slug, city, created_at").order("created_at", { ascending: false }).limit(8),
    ]);

    const revenueToday = (today.data ?? []).reduce((s, r) => s + (r.amount ?? 0), 0);
    const dayBuckets = new Map<string, number>();
    for (let i = 6; i >= 0; i--) {
      const k = new Date(Date.now() - i * 86400_000).toISOString().slice(0, 10);
      dayBuckets.set(k, 0);
    }
    for (const r of week.data ?? []) {
      if (!r.ended_at) continue;
      const k = new Date(r.ended_at).toISOString().slice(0, 10);
      if (dayBuckets.has(k)) dayBuckets.set(k, (dayBuckets.get(k) ?? 0) + (r.amount ?? 0));
    }
    return {
      revenueToday,
      sessionsToday: today.data?.length ?? 0,
      weekSeries: Array.from(dayBuckets.entries()).map(([d, v]) => ({ d, v })),
      recent: recentSessions.data ?? [],
      newCafes: topCafes.data ?? [],
    };
  });
