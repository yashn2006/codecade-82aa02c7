import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/supabase/auth-middleware";

// List my cafes' referral codes + stats
export const getMyReferrals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: cafes, error } = await context.supabase
      .from("cafes")
      .select("id, name, slug, referral_code")
      .eq("owner_id", context.userId);
    if (error) throw new Error(error.message);

    const ids = (cafes ?? []).map((c) => c.id);
    const { data: refs } = ids.length
      ? await context.supabase
          .from("referrals")
          .select("id, referrer_cafe_id, referred_cafe_id, status, bonus_days, created_at, redeemed_at")
          .in("referrer_cafe_id", ids)
      : { data: [] as Array<{
            id: string; referrer_cafe_id: string; referred_cafe_id: string;
            status: string; bonus_days: number; created_at: string; redeemed_at: string | null;
          }> };

    return { cafes: cafes ?? [], referrals: refs ?? [] };
  });

// Apply a code to a freshly created cafe (called from owner UI after createCafe)
export const applyReferralCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ cafe_id: z.string().uuid(), code: z.string().min(4).max(16) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: rid, error } = await context.supabase.rpc("apply_referral_code", {
      _new_cafe_id: data.cafe_id,
      _code: data.code,
    });
    if (error) throw new Error(error.message);
    return { referral_id: rid as string | null };
  });
