import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/supabase/auth-middleware";

// PUBLIC — fetches café + page + devices + menu + tournaments for the public landing.
// Uses admin client to bypass RLS for read-only public projection (filtered to active café).
export const getPublicCafe = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ slug: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/lib/supabase/client.server");
    const { data: cafe, error } = await supabaseAdmin
      .from("cafes")
      .select("id, slug, name, city, state, address, phone, email, description, logo_url, cover_url, latitude, longitude, gst_no, maintenance_starts_at, maintenance_ends_at, maintenance_message")
      .eq("slug", data.slug)
      .eq("is_active", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!cafe) throw new Error("Café not found");

    const [page, devices, menuItems, menuCats, tournaments, platform] = await Promise.all([
      supabaseAdmin.from("cafe_pages").select("*").eq("cafe_id", cafe.id).maybeSingle(),
      supabaseAdmin.from("devices").select("id,name,type,hourly_rate,status,specs").eq("cafe_id", cafe.id),
      supabaseAdmin.from("menu_items").select("*").eq("cafe_id", cafe.id).eq("is_active", true),
      supabaseAdmin.from("menu_categories").select("*").eq("cafe_id", cafe.id).order("sort_order"),
      supabaseAdmin.from("tournaments").select("*").eq("cafe_id", cafe.id)
        .in("status", ["upcoming", "live"]).order("starts_at").limit(10),
      supabaseAdmin.from("platform_settings")
        .select("maintenance_starts_at, maintenance_ends_at, maintenance_message, maintenance_title")
        .eq("id", true).maybeSingle(),
    ]);

    const liveSessions = await supabaseAdmin
      .from("sessions").select("device_id", { count: "exact", head: false })
      .eq("cafe_id", cafe.id).eq("status", "active");

    return {
      cafe,
      page: page.data,
      devices: devices.data ?? [],
      menu: { items: menuItems.data ?? [], categories: menuCats.data ?? [] },
      tournaments: tournaments.data ?? [],
      activeDeviceIds: (liveSessions.data ?? []).map((s) => s.device_id),
      platform: platform.data ? {
        starts_at: platform.data.maintenance_starts_at,
        ends_at: platform.data.maintenance_ends_at,
        message: platform.data.maintenance_message,
        title: platform.data.maintenance_title,
      } : null,
    };
  });

export const updateCafePage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      cafe_id: z.string().uuid(),
      tagline: z.string().max(200).nullable().optional(),
      hero_url: z.string().url().nullable().optional(),
      about: z.string().max(4000).nullable().optional(),
      hours: z.record(z.string(), z.string()).optional(),
      socials: z.record(z.string(), z.string()).optional(),
      gallery: z.array(z.string().url()).optional(),
      theme: z.object({
        accent: z.string().max(20).optional(),
        bg: z.string().max(20).optional(),
        font: z.string().max(40).optional(),
        mode: z.enum(["dark", "neon", "minimal", "arcade"]).optional(),
        logo: z.string().url().max(800).optional().or(z.literal("")),
      }).passthrough().optional(),
      map_url: z.string().url().max(800).nullable().optional(),
      upi_id: z.string().max(120).nullable().optional(),
      upi_qr_url: z.string().url().max(800).nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("cafe_pages").upsert({
      ...data,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getCafePage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ cafe_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("cafe_pages").select("*").eq("cafe_id", data.cafe_id).maybeSingle();
    return row;
  });
