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

// ============ Brackets ============
export const listMatches = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ tournament_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("tournament_matches").select("*")
      .eq("tournament_id", data.tournament_id)
      .order("round").order("match_index");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

/** Generate single-elimination bracket from current registrations. Wipes existing. */
export const generateBracket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ tournament_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: regs, error: re } = await context.supabase
      .from("tournament_registrations").select("team_name").eq("tournament_id", data.tournament_id);
    if (re) throw new Error(re.message);
    const teams = (regs ?? []).map((r) => r.team_name);
    if (teams.length < 2) throw new Error("Need at least 2 teams");

    // pad to next pow2 with BYEs
    let n = 2; while (n < teams.length) n *= 2;
    const padded = [...teams];
    while (padded.length < n) padded.push("BYE");
    // shuffle (Fisher-Yates)
    for (let i = padded.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [padded[i], padded[j]] = [padded[j], padded[i]];
    }

    await context.supabase.from("tournament_matches").delete().eq("tournament_id", data.tournament_id);

    const matches: { tournament_id: string; round: number; match_index: number; team_a: string; team_b: string; winner: string | null }[] = [];
    // Round 1
    for (let i = 0; i < padded.length; i += 2) {
      const a = padded[i]; const b = padded[i + 1];
      const winner = a === "BYE" ? b : b === "BYE" ? a : null;
      matches.push({ tournament_id: data.tournament_id, round: 1, match_index: i / 2, team_a: a, team_b: b, winner });
    }
    // Subsequent empty rounds
    let prev = padded.length / 2;
    let round = 2;
    while (prev >= 2) {
      for (let i = 0; i < prev / 2; i++) {
        matches.push({ tournament_id: data.tournament_id, round, match_index: i, team_a: "", team_b: "", winner: null });
      }
      prev /= 2; round++;
    }

    const { error } = await context.supabase.from("tournament_matches").insert(matches);
    if (error) throw new Error(error.message);
    return { ok: true, rounds: round - 1, teams: teams.length };
  });

export const setMatchResult = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      match_id: z.string().uuid(),
      score_a: z.number().int().min(0).optional(),
      score_b: z.number().int().min(0).optional(),
      winner: z.enum(["a", "b"]),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: m, error: me } = await context.supabase
      .from("tournament_matches").select("*").eq("id", data.match_id).single();
    if (me || !m) throw new Error(me?.message ?? "Match not found");
    const winnerName = data.winner === "a" ? m.team_a : m.team_b;

    await context.supabase.from("tournament_matches").update({
      score_a: data.score_a ?? null,
      score_b: data.score_b ?? null,
      winner: winnerName,
    }).eq("id", data.match_id);

    // Advance winner into next round
    const { data: next } = await context.supabase
      .from("tournament_matches")
      .select("id, team_a, team_b")
      .eq("tournament_id", m.tournament_id)
      .eq("round", m.round + 1)
      .eq("match_index", Math.floor(m.match_index / 2))
      .maybeSingle();
    if (next) {
      const slot = m.match_index % 2 === 0 ? "team_a" : "team_b";
      await context.supabase.from("tournament_matches").update({ [slot]: winnerName }).eq("id", next.id);
    }
    return { ok: true };
  });

/** Pay out tournament prize from cafe → winner's customer wallet. */
export const payoutTournament = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      tournament_id: z.string().uuid(),
      customer_id: z.string().uuid(),
      winner_team: z.string().min(1).max(80),
      amount: z.number().int().min(1).max(10_000_000),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("payout_tournament", {
      _tournament_id: data.tournament_id,
      _customer_id: data.customer_id,
      _winner_team: data.winner_team,
      _amount: data.amount,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
