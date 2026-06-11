import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/supabase/auth-middleware";

const MembershipInput = z.object({
  cafe_id: z.string().uuid(),
  name: z.string().min(1).max(80),
  hours_included: z.number().int().min(0).max(10000),
  price: z.number().int().min(0).max(10_000_000),
  validity_days: z.number().int().min(1).max(3650),
  is_active: z.boolean().optional(),
});

export const listMemberships = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ cafe_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("memberships")
      .select("*")
      .eq("cafe_id", data.cafe_id)
      .order("price", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createMembership = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => MembershipInput.parse(d))
  .handler(async ({ data, context }) => {
    const { error, data: row } = await context.supabase
      .from("memberships").insert(data).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateMembership = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), patch: MembershipInput.partial() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("memberships").update(data.patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteMembership = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("memberships").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const grantMembership = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      customer_id: z.string().uuid(),
      membership_id: z.string().uuid(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: m, error: mErr } = await context.supabase
      .from("memberships").select("hours_included, validity_days").eq("id", data.membership_id).single();
    if (mErr || !m) throw new Error(mErr?.message ?? "Membership not found");
    const ends = new Date(Date.now() + m.validity_days * 86400_000).toISOString();
    const { error } = await context.supabase.from("customer_memberships").insert({
      customer_id: data.customer_id,
      membership_id: data.membership_id,
      ends_at: ends,
      hours_remaining: m.hours_included,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
