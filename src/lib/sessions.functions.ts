import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/supabase/auth-middleware";

export const listSessions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ cafe_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("sessions")
      .select("id, device_id, customer_id, started_at, ended_at, duration_minutes, amount, status, membership_minutes_used, no_show, customers(full_name), devices(name, hourly_rate, type)")
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
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    await context.supabase.from("devices").update({ status: "in_use" }).eq("id", data.device_id);
    return row;
  });

export const endSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: s, error: se } = await context.supabase
      .from("sessions")
      .select("started_at, device_id, customer_id, cafe_id, devices(hourly_rate)")
      .eq("id", data.id)
      .single();
    if (se || !s) throw new Error(se?.message ?? "Session not found");

    const startedAt = new Date(s.started_at).getTime();
    const minutes = Math.max(1, Math.ceil((Date.now() - startedAt) / 60000));
    const rate = (s.devices as { hourly_rate?: number } | null)?.hourly_rate ?? 0;

    // Try auto-deduct membership minutes first
    let membershipMinutes = 0;
    if (s.customer_id) {
      const { data: consumed } = await context.supabase.rpc("consume_membership_minutes", {
        _customer_id: s.customer_id,
        _minutes: minutes,
      });
      membershipMinutes = (consumed as number) || 0;
    }
    const billableMinutes = Math.max(0, minutes - membershipMinutes);
    const amount = Math.ceil((rate * billableMinutes) / 60);

    const { error } = await context.supabase
      .from("sessions")
      .update({
        ended_at: new Date().toISOString(),
        duration_minutes: minutes,
        membership_minutes_used: membershipMinutes,
        amount,
        status: "completed",
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    await context.supabase.from("devices").update({ status: "available" }).eq("id", s.device_id);
    return { ok: true, minutes, amount, membershipMinutes };
  });
