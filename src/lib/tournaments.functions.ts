import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/supabase/auth-middleware";

export const listTournaments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ cafe_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("tournaments").select("*, tournament_registrations(count)").eq("cafe_id", data.cafe_id)
      .order("starts_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const upsertTournament = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid().optional(),
      cafe_id: z.string().uuid(),
      title: z.string().min(2).max(120),
      game: z.string().min(1).max(80),
      format: z.enum(["solo", "duo", "squad"]).default("solo"),
      entry_fee: z.number().int().min(0).default(0),
      prize_pool: z.number().int().min(0).default(0),
      capacity: z.number().int().min(1).default(16),
      starts_at: z.string(),
      status: z.enum(["upcoming", "live", "completed", "cancelled"]).default("upcoming"),
      banner_url: z.string().url().nullable().optional(),
      rules: z.string().max(2000).nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("tournaments").upsert(data);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteTournament = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("tournaments").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listRegistrations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ tournament_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("tournament_registrations").select("*").eq("tournament_id", data.tournament_id)
      .order("created_at");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const registerForTournament = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      tournament_id: z.string().uuid(),
      team_name: z.string().min(1).max(80),
      contact: z.string().max(80).optional(),
      customer_id: z.string().uuid().nullable().optional(),
      paid: z.boolean().default(false),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("tournament_registrations").insert(data);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
