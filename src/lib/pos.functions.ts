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
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const subtotal = data.items.reduce((s, i) => s + i.unit_price * i.qty, 0);
    const { data: order, error } = await context.supabase
      .from("orders")
      .insert({
        cafe_id: data.cafe_id,
        customer_id: data.customer_id ?? null,
        session_id: data.session_id ?? null,
        subtotal,
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
      .select("*, order_items(*)")
      .eq("cafe_id", data.cafe_id)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return orders ?? [];
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
