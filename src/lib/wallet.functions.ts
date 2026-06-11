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

export const exportWalletCSV = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ cafe_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("wallet_transactions")
      .select("created_at, amount, kind, note, customers(full_name, phone)")
      .eq("cafe_id", data.cafe_id)
      .order("created_at", { ascending: false })
      .limit(5000);
    if (error) throw new Error(error.message);
    const header = "datetime,customer,phone,amount,kind,note\n";
    const body = (rows ?? []).map((r) => {
      const c = (r.customers as { full_name?: string; phone?: string } | null) ?? {};
      const note = (r.note ?? "").toString().replace(/"/g, '""');
      return [
        new Date(r.created_at).toISOString(),
        `"${(c.full_name ?? "").replace(/"/g, '""')}"`,
        c.phone ?? "",
        r.amount,
        r.kind,
        `"${note}"`,
      ].join(",");
    }).join("\n");
    return { csv: header + body, count: rows?.length ?? 0 };
  });
