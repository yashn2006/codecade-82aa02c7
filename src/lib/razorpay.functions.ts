import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createHmac } from "node:crypto";
import { requireSupabaseAuth } from "@/lib/supabase/auth-middleware";

// Expose only the public key id to the browser.
export const getRazorpayConfig = createServerFn({ method: "GET" }).handler(async () => {
  return { keyId: process.env.RAZORPAY_KEY_ID ?? "", enabled: !!process.env.RAZORPAY_KEY_ID };
});

// Create a Razorpay order + DB row. Returns { order_id, amount, currency, topup_id }.
export const createTopupOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      cafe_id: z.string().uuid(),
      customer_id: z.string().uuid(),
      amount: z.number().int().min(1).max(500000), // rupees
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) throw new Error("Razorpay is not configured");

    // Insert pending row first (RLS verifies caller owns/staffs the café)
    const { data: row, error: insErr } = await context.supabase
      .from("wallet_topups")
      .insert({
        cafe_id: data.cafe_id,
        customer_id: data.customer_id,
        amount: data.amount,
        currency: "INR",
        status: "created",
      })
      .select("id")
      .single();
    if (insErr) throw new Error(insErr.message);

    const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
    const res = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Basic ${auth}` },
      body: JSON.stringify({
        amount: data.amount * 100,
        currency: "INR",
        receipt: row.id,
        notes: { topup_id: row.id, cafe_id: data.cafe_id, customer_id: data.customer_id },
      }),
    });
    const json = await res.json() as { id?: string; error?: { description?: string } };
    if (!res.ok || !json.id) {
      await context.supabase.from("wallet_topups").update({ status: "failed" }).eq("id", row.id);
      throw new Error(json.error?.description ?? "Razorpay order create failed");
    }

    const { error: updErr } = await context.supabase
      .from("wallet_topups").update({ razorpay_order_id: json.id }).eq("id", row.id);
    if (updErr) throw new Error(updErr.message);

    return { topup_id: row.id, order_id: json.id, amount: data.amount, currency: "INR", key_id: keyId };
  });

// Verify Razorpay payment signature and credit wallet via apply_wallet_tx.
export const verifyTopupPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      topup_id: z.string().uuid(),
      razorpay_order_id: z.string(),
      razorpay_payment_id: z.string(),
      razorpay_signature: z.string(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) throw new Error("Razorpay is not configured");

    const expected = createHmac("sha256", keySecret)
      .update(`${data.razorpay_order_id}|${data.razorpay_payment_id}`)
      .digest("hex");
    if (expected !== data.razorpay_signature) {
      await context.supabase.from("wallet_topups").update({ status: "failed" }).eq("id", data.topup_id);
      throw new Error("Invalid payment signature");
    }

    const { data: row, error: getErr } = await context.supabase
      .from("wallet_topups")
      .select("id, cafe_id, customer_id, amount, status")
      .eq("id", data.topup_id)
      .single();
    if (getErr) throw new Error(getErr.message);
    if (row.status === "paid") return { ok: true, already: true };

    // Mark paid first to avoid double credit on retries
    const { error: updErr } = await context.supabase
      .from("wallet_topups")
      .update({
        status: "paid",
        razorpay_payment_id: data.razorpay_payment_id,
        razorpay_signature: data.razorpay_signature,
        paid_at: new Date().toISOString(),
      })
      .eq("id", row.id)
      .eq("status", "created");
    if (updErr) throw new Error(updErr.message);

    const { error: rpcErr } = await context.supabase.rpc("apply_wallet_tx", {
      _customer_id: row.customer_id,
      _cafe_id: row.cafe_id,
      _amount: row.amount,
      _kind: "topup",
      _note: `Razorpay ${data.razorpay_payment_id}`,
    });
    if (rpcErr) throw new Error(rpcErr.message);

    // Receipt notification (best-effort — never fail the payment on this)
    try {
      await context.supabase.rpc("insert_payment_receipt", {
        _user_id: context.userId,
        _cafe_id: row.cafe_id,
        _amount: row.amount,
        _kind: "topup",
        _reference: data.razorpay_payment_id,
      });
    } catch { /* ignore */ }

    return { ok: true, already: false };
  });


// ---------- Booking payment (full prepayment) ----------
export const createBookingOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ booking_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) throw new Error("Razorpay is not configured");

    const { data: b, error } = await context.supabase
      .from("bookings")
      .select("id, cafe_id, customer_id, deposit_amount, razorpay_order_id, paid_at")
      .eq("id", data.booking_id)
      .single();
    if (error) throw new Error(error.message);
    if (b.paid_at) throw new Error("Already paid");
    const amount = b.deposit_amount ?? 0;
    if (amount <= 0) throw new Error("Invalid amount");

    const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
    const res = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Basic ${auth}` },
      body: JSON.stringify({
        amount: amount * 100,
        currency: "INR",
        receipt: b.id,
        notes: { booking_id: b.id, cafe_id: b.cafe_id, customer_id: b.customer_id },
      }),
    });
    const json = await res.json() as { id?: string; error?: { description?: string } };
    if (!res.ok || !json.id) throw new Error(json.error?.description ?? "Razorpay order create failed");

    await context.supabase.from("bookings").update({ razorpay_order_id: json.id }).eq("id", b.id);
    return { order_id: json.id, amount, currency: "INR", key_id: keyId, booking_id: b.id };
  });

export const verifyBookingPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      booking_id: z.string().uuid(),
      razorpay_order_id: z.string(),
      razorpay_payment_id: z.string(),
      razorpay_signature: z.string(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) throw new Error("Razorpay is not configured");

    const expected = createHmac("sha256", keySecret)
      .update(`${data.razorpay_order_id}|${data.razorpay_payment_id}`)
      .digest("hex");
    if (expected !== data.razorpay_signature) throw new Error("Invalid payment signature");

    const { data: bk, error } = await context.supabase
      .from("bookings")
      .update({
        status: "confirmed",
        deposit_paid: true,
        razorpay_payment_id: data.razorpay_payment_id,
        razorpay_signature: data.razorpay_signature,
        paid_at: new Date().toISOString(),
      })
      .eq("id", data.booking_id)
      .eq("razorpay_order_id", data.razorpay_order_id)
      .select("cafe_id, deposit_amount")
      .single();
    if (error) throw new Error(error.message);

    try {
      await context.supabase.rpc("insert_payment_receipt", {
        _user_id: context.userId,
        _cafe_id: bk.cafe_id,
        _amount: bk.deposit_amount ?? 0,
        _kind: "booking",
        _reference: data.razorpay_payment_id,
      });
    } catch { /* ignore */ }

    return { ok: true };
  });

