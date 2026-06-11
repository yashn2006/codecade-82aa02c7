import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/supabase/auth-middleware";

export const listBookings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ cafe_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("bookings")
      .select("id, scheduled_at, duration_minutes, status, device_id, customer_id, customers(full_name, phone), devices(name, type)")
      .eq("cafe_id", data.cafe_id)
      .order("scheduled_at", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const updateBookingStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      status: z.enum(["pending", "confirmed", "cancelled", "completed"]),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("bookings")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const createBookingForCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      cafe_id: z.string().uuid(),
      device_id: z.string().uuid(),
      customer_id: z.string().uuid(),
      scheduled_at: z.string(),
      duration_minutes: z.number().int().min(15).max(720),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("bookings")
      .insert({
        cafe_id: data.cafe_id,
        device_id: data.device_id,
        customer_id: data.customer_id,
        scheduled_at: data.scheduled_at,
        duration_minutes: data.duration_minutes,
        status: "confirmed",
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const listMyBookings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("bookings")
      .select("id, scheduled_at, duration_minutes, status, cafes(name, slug, city), devices(name, type), customers!inner(user_id)")
      .eq("customers.user_id", context.userId)
      .order("scheduled_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const customerCreateBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      cafe_id: z.string().uuid(),
      device_type: z.string(),
      scheduled_at: z.string(),
      duration_minutes: z.number().int().min(30).max(480),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/lib/supabase/client.server");

    // Pick first matching device that's available
    const { data: device, error: de } = await supabaseAdmin
      .from("devices")
      .select("id, hourly_rate")
      .eq("cafe_id", data.cafe_id)
      .eq("type", data.device_type)
      .limit(1)
      .maybeSingle();
    if (de) throw new Error(de.message);
    if (!device) throw new Error("No device of this type available at this café");

    // Ensure a customer row exists for this user in this cafe
    const { data: profile } = await context.supabase
      .from("profiles").select("full_name, phone, email").eq("id", context.userId).single();

    let customerId: string;
    const { data: existing } = await supabaseAdmin
      .from("customers")
      .select("id")
      .eq("cafe_id", data.cafe_id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (existing) {
      customerId = existing.id;
    } else {
      const { data: newCust, error: ce } = await supabaseAdmin
        .from("customers")
        .insert({
          cafe_id: data.cafe_id,
          user_id: context.userId,
          full_name: profile?.full_name || profile?.email || "Customer",
          phone: profile?.phone ?? null,
          email: profile?.email ?? null,
        })
        .select("id")
        .single();
      if (ce) throw new Error(ce.message);
      customerId = newCust.id;
    }

    const { data: row, error } = await supabaseAdmin
      .from("bookings")
      .insert({
        cafe_id: data.cafe_id,
        device_id: device.id,
        customer_id: customerId,
        scheduled_at: data.scheduled_at,
        duration_minutes: data.duration_minutes,
        status: "pending",
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });
