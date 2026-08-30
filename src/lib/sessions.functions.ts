import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/supabase/auth-middleware";

export const listSessions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ cafe_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("sessions")
      .select("*, customers(id, full_name, phone, email, wallet_balance), devices(name, hourly_rate, type)")
      .eq("cafe_id", data.cafe_id)
      .order("started_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const startSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      cafe_id: z.string().uuid(),
      device_id: z.string().uuid(),
      customer_id: z.string().uuid().optional().nullable(),
      planned_minutes: z.number().int().min(0).max(1440).optional().nullable(),
      package_name: z.string().max(60).optional().nullable(),
      amount_paid: z.number().int().min(0).max(1000000).optional().nullable(),
      payment_method: z.enum(["cash", "upi", "card", "wallet", "counter"]).optional().nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: dev } = await context.supabase
      .from("devices").select("status").eq("id", data.device_id).single();
    if (dev?.status === "in_use") throw new Error("Device already in use");

    const { data: row, error } = await context.supabase
      .from("sessions")
      .insert({
        cafe_id: data.cafe_id,
        device_id: data.device_id,
        customer_id: data.customer_id ?? null,
        status: "active",
        planned_minutes: data.planned_minutes ?? null,
        package_name: data.package_name ?? null,
        amount_paid: data.amount_paid ?? 0,
        payment_method: data.payment_method ?? null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    await context.supabase.from("devices").update({ status: "in_use" }).eq("id", data.device_id);
    return row;
  });

/** Add minutes to the booked package of a running session. */
export const extendSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), add_minutes: z.number().int().min(5).max(720) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: s, error: se } = await context.supabase
      .from("sessions")
      .select("planned_minutes")
      .eq("id", data.id)
      .single();
    if (se || !s) throw new Error(se?.message ?? "Session not found");
    const planned = ((s as { planned_minutes?: number | null }).planned_minutes ?? 0) + data.add_minutes;
    const { error } = await context.supabase
      .from("sessions").update({ planned_minutes: planned }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true, planned_minutes: planned };
  });

/** Freeze the clock — the customer's screen shows "suspended". */
export const suspendSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: s } = await context.supabase
      .from("sessions").select("paused_at, device_id").eq("id", data.id).single();
    if (!s) throw new Error("Session not found");
    if ((s as { paused_at?: string | null }).paused_at) return { ok: true };
    const { error } = await context.supabase
      .from("sessions")
      .update({ paused_at: new Date().toISOString(), status: "paused" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await context.supabase.from("devices").update({ status: "suspended" })
      .eq("id", (s as { device_id: string }).device_id);
    return { ok: true };
  });

/** Resume a suspended session — the timer continues where it stopped. */
export const resumeSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: s } = await context.supabase
      .from("sessions").select("paused_at, paused_ms, device_id").eq("id", data.id).single();
    if (!s) throw new Error("Session not found");
    const row = s as { paused_at?: string | null; paused_ms?: number | null; device_id: string };
    const extra = row.paused_at ? Date.now() - new Date(row.paused_at).getTime() : 0;
    const { error } = await context.supabase
      .from("sessions")
      .update({
        paused_at: null,
        paused_ms: Math.max(0, Number(row.paused_ms ?? 0) + extra),
        status: "active",
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await context.supabase.from("devices").update({ status: "in_use", suspend_until: null })
      .eq("id", row.device_id);
    return { ok: true };
  });

/** Internal staff note on a session. */
export const setSessionNotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), notes: z.string().max(2000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("sessions").update({ notes: data.notes }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listSessionAlerts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ session_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("session_alerts")
      .select("id, message, channel, created_at")
      .eq("session_id", data.session_id)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const logSessionAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      session_id: z.string().uuid(),
      cafe_id: z.string().uuid(),
      message: z.string().min(1).max(500),
      channel: z.enum(["whatsapp", "sms"]),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("session_alerts").insert(data);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Loyalty stats for the customer card inside the session modal. */
export const customerSessionStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ customer_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("sessions")
      .select("duration_minutes, amount, status")
      .eq("customer_id", data.customer_id)
      .limit(500);
    if (error) throw new Error(error.message);
    const list = rows ?? [];
    const visits = list.length;
    const minutes = list.reduce((s, r) => s + (Number((r as { duration_minutes?: number | null }).duration_minutes) || 0), 0);
    const spend = list.reduce((s, r) => s + (Number((r as { amount?: number | null }).amount) || 0), 0);
    return { visits, minutes, spend };
  });

export const endSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: s, error: se } = await context.supabase
      .from("sessions")
      .select("started_at, device_id, customer_id, cafe_id, paused_at, paused_ms, amount_paid, devices(hourly_rate)")
      .eq("id", data.id)
      .single();
    if (se || !s) throw new Error(se?.message ?? "Session not found");

    const row = s as unknown as {
      started_at: string; device_id: string; customer_id: string | null;
      paused_at?: string | null; paused_ms?: number | null; amount_paid?: number | null;
      devices: { hourly_rate?: number } | null;
    };

    const startedAt = new Date(row.started_at).getTime();
    const pausedMs =
      Number(row.paused_ms ?? 0) + (row.paused_at ? Date.now() - new Date(row.paused_at).getTime() : 0);
    const minutes = Math.max(1, Math.ceil((Date.now() - startedAt - pausedMs) / 60000));
    const rate = row.devices?.hourly_rate ?? 0;

    // Try auto-deduct membership minutes first
    let membershipMinutes = 0;
    if (row.customer_id) {
      const { data: consumed } = await context.supabase.rpc("consume_membership_minutes", {
        _customer_id: row.customer_id,
        _minutes: minutes,
      });
      membershipMinutes = (consumed as number) || 0;
    }
    const billableMinutes = Math.max(0, minutes - membershipMinutes);
    const amount = Math.ceil((rate * billableMinutes) / 60);
    const paid = Number(row.amount_paid ?? 0);
    const refund = Math.max(0, paid - amount);
    const due = Math.max(0, amount - paid);

    const { error } = await context.supabase
      .from("sessions")
      .update({
        ended_at: new Date().toISOString(),
        duration_minutes: minutes,
        membership_minutes_used: membershipMinutes,
        amount,
        paused_at: null,
        paused_ms: pausedMs,
        status: "completed",
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    await context.supabase.from("devices")
      .update({ status: "available", suspend_until: null }).eq("id", row.device_id);
    return { ok: true, minutes, amount, membershipMinutes, refund, due };
  });
