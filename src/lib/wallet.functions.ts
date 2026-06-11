import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/supabase/auth-middleware";

export const adjustWallet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      customer_id: z.string().uuid(),
      cafe_id: z.string().uuid(),
      amount: z.number().int().refine((n) => n !== 0, "Amount required"),
      kind: z.enum(["topup", "refund", "adjust", "session"]).default("topup"),
      note: z.string().max(200).optional().nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("apply_wallet_tx", {
      _customer_id: data.customer_id,
      _cafe_id: data.cafe_id,
      _amount: data.amount,
      _kind: data.kind,
      _note: data.note ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listWalletTransactions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      cafe_id: z.string().uuid().optional(),
      customer_id: z.string().uuid().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("wallet_transactions")
      .select("id, amount, kind, note, created_at, customer_id, cafe_id, customers(full_name)")
      .order("created_at", { ascending: false })
      .limit(100);
    if (data.cafe_id) q = q.eq("cafe_id", data.cafe_id);
    if (data.customer_id) q = q.eq("customer_id", data.customer_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
