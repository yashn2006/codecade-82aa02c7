import { createServerFn } from "@tanstack/react-start";

export const listPublicCafes = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/lib/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("cafes")
    .select("id, slug, name, city, state, description, cover_url")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return data ?? [];
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
