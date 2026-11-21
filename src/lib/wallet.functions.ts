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
    const { assertCafeAccess } = await import("@/lib/staff-access.server");
    await assertCafeAccess(context.userId, data.cafe_id, "manage_wallet");
    const { error } = await context.supabase.rpc("apply_wallet_tx", {
      _customer_id: data.customer_id,
      _cafe_id: data.cafe_id,
      _amount: data.amount,
      _kind: data.kind,
      _note: data.note ?? null,
    });
    if (error) throw new Error(error.message);

    const { writeAudit } = await import("@/lib/audit.server");
    await writeAudit({
      cafeId: data.cafe_id,
      actorId: context.userId,
      action: data.kind === "topup" && data.amount > 0 ? "wallet.topped_up" : "wallet.adjusted",
      resourceType: "customer",
      resourceId: data.customer_id,
      meta: {
        amount: data.amount,
        kind: data.kind,
        note: data.note ?? null,
      },
    });
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
    const { assertCafeAccess } = await import("@/lib/staff-access.server");
    if (data.cafe_id) {
      await assertCafeAccess(context.userId, data.cafe_id, "manage_wallet");
    } else if (data.customer_id) {
      const { supabaseAdmin } = await import("@/lib/supabase/client.server");
      const { data: cust } = await supabaseAdmin
        .from("customers")
        .select("cafe_id, user_id")
        .eq("id", data.customer_id)
        .maybeSingle();
      if (!cust) throw new Error("Customer not found");
      if (cust.user_id !== context.userId) {
        await assertCafeAccess(context.userId, cust.cafe_id, "manage_wallet");
      }
    } else {
      throw new Error("You don't have permission");
    }
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
    const { assertCafeAccess } = await import("@/lib/staff-access.server");
    await assertCafeAccess(context.userId, data.cafe_id, "manage_wallet");
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

export const listWalletTopupRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ cafe_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { assertCafeAccess } = await import("@/lib/staff-access.server");
    await assertCafeAccess(context.userId, data.cafe_id, "manage_wallet");
    const { supabaseAdmin } = await import("@/lib/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("wallet_topups")
      .select("id, cafe_id, customer_id, amount, status, razorpay_payment_id, notes, created_at, paid_at, customers(id, full_name, phone, user_id)")
      .eq("cafe_id", data.cafe_id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return (rows ?? []).filter(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (r: any) => r.notes?.method === "upi_proof" || String(r.razorpay_payment_id ?? "").startsWith("UTR:"),
    );
  });

export const reviewWalletTopupRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      cafe_id: z.string().uuid(),
      action: z.enum(["approve", "reject"]),
      review_note: z.string().max(240).optional().nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { assertCafeAccess } = await import("@/lib/staff-access.server");
    await assertCafeAccess(context.userId, data.cafe_id, "manage_wallet");
    const { supabaseAdmin } = await import("@/lib/supabase/client.server");
    const { data: cafe } = await supabaseAdmin
      .from("cafes")
      .select("id, owner_id, name, slug")
      .eq("id", data.cafe_id)
      .maybeSingle();
    if (!cafe) throw new Error("Café not found");

    const { data: reqRow, error: getErr } = await supabaseAdmin
      .from("wallet_topups")
      .select("id, cafe_id, customer_id, amount, status, razorpay_payment_id, notes, customers(id, full_name, user_id)")
      .eq("id", data.id)
      .eq("cafe_id", data.cafe_id)
      .maybeSingle();
    if (getErr) throw new Error(getErr.message);
    if (!reqRow) throw new Error("Top-up request not found");
    if (reqRow.status !== "created") {
      throw new Error(`Request was already ${reqRow.status === "paid" ? "approved" : reqRow.status}.`);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const notesObj = ((reqRow as any).notes ?? {}) as Record<string, unknown>;
    const utr = String(notesObj.utr_number ?? String(reqRow.razorpay_payment_id ?? "").replace(/^UTR:/, ""));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const customer = (reqRow as any).customers as { id: string; full_name?: string; user_id?: string | null } | null;

    if (data.action === "approve") {
      const { data: claimed, error: updErr } = await supabaseAdmin
        .from("wallet_topups")
        .update({
          status: "paid",
          paid_at: new Date().toISOString(),
          notes: { ...notesObj, reviewed_by: context.userId, reviewed_at: new Date().toISOString() },
        })
        .eq("id", reqRow.id)
        .eq("status", "created")
        .select("id")
        .maybeSingle();
      if (updErr) throw new Error(updErr.message);
      if (!claimed) throw new Error("Request was already processed.");

      const { error: txErr } = await supabaseAdmin.rpc("apply_wallet_tx", {
        _customer_id: reqRow.customer_id,
        _cafe_id: reqRow.cafe_id,
        _amount: reqRow.amount,
        _kind: "topup",
        _note: `Verified UPI Top-up (UTR: ${utr})`,
      });
      if (txErr) throw new Error(txErr.message);

      if (customer?.user_id) {
        await supabaseAdmin.from("notifications").insert({
          user_id: customer.user_id,
          cafe_id: cafe.id,
          kind: "wallet_topup",
          title: `₹${reqRow.amount} added to your ${cafe.name} wallet`,
          body: `Your UPI payment (UTR: ${utr}) was verified.`,
          link: "/portal#wallet",
        });
      }
      const { writeAudit } = await import("@/lib/audit.server");
      await writeAudit({
        cafeId: cafe.id,
        actorId: context.userId,
        action: "wallet.topped_up",
        resourceType: "wallet_topup",
        resourceId: reqRow.id,
        meta: {
          customer_id: reqRow.customer_id,
          customer: customer?.full_name ?? null,
          amount: reqRow.amount,
          utr,
          method: "upi_proof",
        },
      });
      return { ok: true, status: "paid" as const };
    }

    const { error: rejErr } = await supabaseAdmin
      .from("wallet_topups")
      .update({
        status: "failed",
        notes: {
          ...notesObj,
          reviewed_by: context.userId,
          reviewed_at: new Date().toISOString(),
          review_note: data.review_note ?? "Could not match UTR with bank statement",
        },
      })
      .eq("id", reqRow.id)
      .eq("status", "created");
    if (rejErr) throw new Error(rejErr.message);

    if (customer?.user_id) {
      await supabaseAdmin.from("notifications").insert({
        user_id: customer.user_id,
        cafe_id: cafe.id,
        kind: "wallet_topup",
        title: `UPI top-up not verified · ${cafe.name}`,
        body: data.review_note ?? `UTR ${utr} could not be matched. Contact the café counter.`,
        link: "/portal#wallet",
      });
    }
    const { writeAudit } = await import("@/lib/audit.server");
    await writeAudit({
      cafeId: cafe.id,
      actorId: context.userId,
      action: "wallet.topup_rejected",
      resourceType: "wallet_topup",
      resourceId: reqRow.id,
      meta: {
        customer_id: reqRow.customer_id,
        customer: customer?.full_name ?? null,
        amount: reqRow.amount,
        utr,
        review_note: data.review_note ?? null,
      },
    });
    return { ok: true, status: "failed" as const };
  });
