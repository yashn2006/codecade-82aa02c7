import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Public (no auth) — fetch tournament detail + cafe + registration count for landing page.
export const getPublicTournament = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z.object({ slug: z.string().min(1), id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/lib/supabase/client.server");
    const { data: cafe, error: ce } = await supabaseAdmin
      .from("cafes")
      .select("id, slug, name, city, address, phone, logo_url, cover_url")
      .eq("slug", data.slug).eq("is_active", true).maybeSingle();
    if (ce) throw new Error(ce.message);
    if (!cafe) throw new Error("Café not found");

    const { data: tournament, error: te } = await supabaseAdmin
      .from("tournaments")
      .select("id, title, game, format, entry_fee, prize_pool, capacity, starts_at, status, banner_url, rules, winner_team, paid_out_at")
      .eq("id", data.id).eq("cafe_id", cafe.id).maybeSingle();
    if (te) throw new Error(te.message);
    if (!tournament) throw new Error("Tournament not found");

    const { count } = await supabaseAdmin
      .from("tournament_registrations")
      .select("id", { count: "exact", head: true })
      .eq("tournament_id", tournament.id);

    return { cafe, tournament, registered: count ?? 0 };
  });

// Public — anonymous registration. RLS policy enforces capacity + upcoming status.
export const publicRegisterTournament = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      tournament_id: z.string().uuid(),
      team_name: z.string().min(2).max(80),
      contact: z.string().min(5).max(80),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/lib/supabase/client.server");

    // Defense-in-depth: re-check tournament state from server.
    const { data: t, error: te } = await supabaseAdmin
      .from("tournaments")
      .select("id, status, capacity")
      .eq("id", data.tournament_id).maybeSingle();
    if (te) throw new Error(te.message);
    if (!t || t.status !== "upcoming") throw new Error("Registration closed");

    const { count } = await supabaseAdmin
      .from("tournament_registrations")
      .select("id", { count: "exact", head: true })
      .eq("tournament_id", t.id);
    if ((count ?? 0) >= t.capacity) throw new Error("Tournament is full");

    const { error } = await supabaseAdmin.from("tournament_registrations").insert({
      tournament_id: data.tournament_id,
      team_name: data.team_name,
      contact: data.contact,
      paid: false,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
