import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/supabase/auth-middleware";

export const createOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      cafe_id: z.string().uuid(),
      customer_id: z.string().uuid().nullable().optional(),
      session_id: z.string().uuid().nullable().optional(),
      items: z.array(z.object({
        item_id: z.string().uuid(),
        name: z.string(),
        unit_price: z.number().int().min(0),
        qty: z.number().int().min(1),
      })).min(1),
      discount_amount: z.number().int().min(0).default(0),
      gst_rate: z.number().min(0).max(50).default(0),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const subtotal = data.items.reduce((s, i) => s + i.unit_price * i.qty, 0);
    const discount = Math.min(data.discount_amount ?? 0, subtotal);
    const taxable = subtotal - discount;
    const tax = Math.round((taxable * (data.gst_rate ?? 0)) / 100);
    const total = taxable + tax;

    // Get next receipt number
    const { data: receiptNo } = await context.supabase.rpc("next_receipt_no", { _cafe_id: data.cafe_id });

    const { data: order, error } = await context.supabase
      .from("orders")
      .insert({
        cafe_id: data.cafe_id,
        customer_id: data.customer_id ?? null,
        session_id: data.session_id ?? null,
        subtotal,
        discount_amount: discount,
        tax_amount: tax,
        total_amount: total,
        gst_rate: data.gst_rate ?? 0,
        receipt_no: receiptNo ?? null,
        created_by: context.userId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    const { error: oiErr } = await context.supabase.from("order_items").insert(
      data.items.map((i) => ({ ...i, order_id: order.id })),
    );
    if (oiErr) throw new Error(oiErr.message);
    return order;
  });

export const settleOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      order_id: z.string().uuid(),
      payment_method: z.enum(["cash", "wallet", "tab"]),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("settle_order", {
      _order_id: data.order_id,
      _payment: data.payment_method,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listRecentOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ cafe_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: orders, error } = await context.supabase
      .from("orders")
      .select("*, order_items(*), customers(full_name)")
      .eq("cafe_id", data.cafe_id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return orders ?? [];
  });

export const getOrderForReceipt = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: order, error } = await context.supabase
      .from("orders")
      .select("*, order_items(*), customers(full_name, phone), cafes(name, address, city, phone, gst_no)")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    return order;
  });

export const voidOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("orders").update({ status: "void" }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const refundOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      order_id: z.string().uuid(),
      amount: z.number().int().min(1),
      reason: z.string().min(1).max(280),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("refund_order", {
      _order_id: data.order_id,
      _amount: data.amount,
      _reason: data.reason,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Daily Z-report: totals by payment method, tax, discount, refunds. */
export const dailyZReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      cafe_id: z.string().uuid(),
      date: z.string().optional(), // YYYY-MM-DD in IST; defaults to today
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    // Compute IST day boundaries
    const d = data.date ? new Date(data.date + "T00:00:00+05:30") : new Date();
    const istStart = data.date
      ? new Date(data.date + "T00:00:00+05:30")
      : new Date(d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0") + "T00:00:00+05:30");
    const istEnd = new Date(istStart.getTime() + 86400000);

    const { data: orders, error } = await context.supabase
      .from("orders")
      .select("status, payment_method, subtotal, tax_amount, discount_amount, total_amount, refund_amount, paid_at, created_at")
      .eq("cafe_id", data.cafe_id)
      .gte("created_at", istStart.toISOString())
      .lt("created_at", istEnd.toISOString());
    if (error) throw new Error(error.message);

    const rows = orders ?? [];
    const paid = rows.filter((o) => o.status === "paid" || o.status === "refunded");
    const sum = (k: string) => paid.reduce((s, o: Record<string, number>) => s + (o[k] || 0), 0);
    const byMethod: Record<string, { count: number; total: number }> = {};
    for (const o of paid) {
      const m = (o as { payment_method?: string }).payment_method || "—";
      byMethod[m] = byMethod[m] || { count: 0, total: 0 };
      byMethod[m].count++;
      byMethod[m].total += (o as { total_amount?: number; subtotal: number }).total_amount || (o as { subtotal: number }).subtotal;
    }

    const { data: sessions } = await context.supabase
      .from("sessions")
      .select("amount, status")
      .eq("cafe_id", data.cafe_id)
      .eq("status", "completed")
      .gte("ended_at", istStart.toISOString())
      .lt("ended_at", istEnd.toISOString());

    return {
      date: istStart.toISOString(),
      orderCount: rows.length,
      paidCount: paid.length,
      voidCount: rows.filter((o) => o.status === "void").length,
      gross: sum("subtotal"),
      discount: sum("discount_amount"),
      tax: sum("tax_amount"),
      refund: sum("refund_amount"),
      net: sum("total_amount") - sum("refund_amount"),
      byMethod,
      sessionRevenue: (sessions ?? []).reduce((s, x: { amount?: number }) => s + (x.amount || 0), 0),
      sessionCount: (sessions ?? []).length,
    };
  });

/**
 * Split a single open order into N child orders. Each split gets a copy of the
 * items proportional to its share (by amount). Parent order is voided.
 * Simple equal-split for v1 — each share gets share_amount as a single line.
 */
export const splitOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      order_id: z.string().uuid(),
      splits: z.array(z.object({
        label: z.string().min(1).max(40),
        amount: z.number().int().min(1),
        customer_id: z.string().uuid().nullable().optional(),
      })).min(2).max(10),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: parent, error: pe } = await context.supabase
      .from("orders")
      .select("id, cafe_id, status, subtotal, total_amount, gst_rate, session_id")
      .eq("id", data.order_id).single();
    if (pe || !parent) throw new Error(pe?.message ?? "Order not found");
    if (parent.status !== "open") throw new Error("Only open orders can be split");

    const parentTotal = parent.total_amount || parent.subtotal;
    const splitsTotal = data.splits.reduce((s, x) => s + x.amount, 0);
    if (splitsTotal !== parentTotal) {
      throw new Error(`Splits sum (₹${splitsTotal}) must equal total ₹${parentTotal}`);
    }

    const childIds: string[] = [];
    for (const sp of data.splits) {
      const { data: rno } = await context.supabase.rpc("next_receipt_no", { _cafe_id: parent.cafe_id });
      const { data: child, error: ce } = await context.supabase.from("orders").insert({
        cafe_id: parent.cafe_id,
        customer_id: sp.customer_id ?? null,
        session_id: parent.session_id,
        subtotal: sp.amount,
        discount_amount: 0,
        tax_amount: 0,
        total_amount: sp.amount,
        gst_rate: 0,
        receipt_no: rno ?? null,
        parent_order_id: parent.id,
        split_label: sp.label,
        created_by: context.userId,
      }).select("id").single();
      if (ce) throw new Error(ce.message);
      await context.supabase.from("order_items").insert({
        order_id: child.id,
        item_id: null,
        name: `Split: ${sp.label}`,
        unit_price: sp.amount,
        qty: 1,
      });
      childIds.push(child.id);
    }
    await context.supabase.from("orders").update({ status: "void", refund_reason: `Split into ${data.splits.length}` }).eq("id", parent.id);
    return { ok: true, child_ids: childIds };
  });
