import { createServerFn } from "@tanstack/react-start";

export const listPublicCafes = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/lib/supabase/client.server");
  const { data: cafes, error } = await supabaseAdmin
    .from("cafes")
    .select("id, slug, name, city, state, address, description, cover_url, open_time, close_time")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  if (!cafes || cafes.length === 0) return [];

  const cafeIds = cafes.map((c) => c.id);

  const [devicesRes, sessionsRes] = await Promise.all([
    supabaseAdmin.from("devices").select("cafe_id, type, hourly_rate, status").in("cafe_id", cafeIds),
    supabaseAdmin.from("sessions").select("cafe_id, device_id, status").in("cafe_id", cafeIds).eq("status", "active"),
  ]);

  const devicesByCafe = new Map<string, { total: number; min_rate: number; types: Set<string> }>();
  for (const d of devicesRes.data ?? []) {
    const curr = devicesByCafe.get(d.cafe_id) ?? { total: 0, min_rate: 999999, types: new Set<string>() };
    curr.total += 1;
    if (d.hourly_rate && d.hourly_rate > 0) {
      curr.min_rate = Math.min(curr.min_rate, d.hourly_rate);
    }
    if (d.type) curr.types.add(d.type);
    devicesByCafe.set(d.cafe_id, curr);
  }

  const activeSessionsByCafe = new Map<string, number>();
  for (const s of sessionsRes.data ?? []) {
    activeSessionsByCafe.set(s.cafe_id, (activeSessionsByCafe.get(s.cafe_id) ?? 0) + 1);
  }

  return cafes.map((c) => {
    const dev = devicesByCafe.get(c.id);
    const active = activeSessionsByCafe.get(c.id) ?? 0;
    const total = dev?.total ?? 0;
    return {
      ...c,
      min_rate: dev && dev.min_rate < 999999 ? dev.min_rate : 80,
      device_count: total,
      active_sessions: active,
      free_count: Math.max(0, total - active),
      device_types: dev && dev.types.size > 0 ? Array.from(dev.types) : ["PC", "PS5"],
    };
  });
});

export const cafeDeviceTypes = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => {
    if (!d || typeof d !== "object" || !("cafe_id" in d)) throw new Error("cafe_id required");
    return { cafe_id: String((d as { cafe_id: unknown }).cafe_id) };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/lib/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("devices")
      .select("type, hourly_rate")
      .eq("cafe_id", data.cafe_id);
    if (error) throw new Error(error.message);
    const grouped = new Map<string, { type: string; count: number; min_rate: number }>();
    for (const r of rows ?? []) {
      const g = grouped.get(r.type) ?? { type: r.type, count: 0, min_rate: r.hourly_rate };
      g.count += 1;
      g.min_rate = Math.min(g.min_rate, r.hourly_rate);
      grouped.set(r.type, g);
    }
    return Array.from(grouped.values());
  });
