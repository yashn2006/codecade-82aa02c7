import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/supabase/auth-middleware";

export const listBookings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ cafe_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("bookings")
      .select("id, scheduled_at, duration_minutes, status, device_id, customer_id, deposit_amount, deposit_paid, no_show_at, customers(full_name, phone), devices(name, type)")
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
      status: z.enum(["pending", "confirmed", "cancelled", "completed", "no_show"]),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const patch: Record<string, unknown> = { status: data.status };
    if (data.status === "no_show") patch.no_show_at = new Date().toISOString();
    const { error } = await context.supabase
      .from("bookings")
      .update(patch)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const markBookingDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      deposit_amount: z.number().int().min(0),
      deposit_paid: z.boolean(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("bookings")
      .update({ deposit_amount: data.deposit_amount, deposit_paid: data.deposit_paid })
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
    // authorize: owner/staff/super_admin
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "super_admin" });
    const { data: cafe } = await context.supabase.from("cafes").select("owner_id").eq("id", data.cafe_id).single();
    const { data: staff } = await context.supabase.from("staff_permissions").select("id").eq("cafe_id", data.cafe_id).eq("staff_user_id", context.userId).maybeSingle();
    if (!isAdmin && cafe?.owner_id !== context.userId && !staff) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/lib/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
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

    const start = new Date(data.scheduled_at);
    const end = new Date(start.getTime() + data.duration_minutes * 60_000);

    // Find candidate devices of the requested type; then pick the first one
    // whose schedule doesn't collide with the requested window.
    const { data: candidates, error: de } = await supabaseAdmin
      .from("devices")
      .select("id, hourly_rate, status")
      .eq("cafe_id", data.cafe_id)
      .eq("type", data.device_type);
    if (de) throw new Error(de.message);
    const usable = (candidates ?? []).filter((d) => d.status !== "maintenance");
    if (usable.length === 0) throw new Error("No device of this type available at this café");

    const deviceIds = usable.map((d) => d.id);
    const { data: overlapping, error: oe } = await supabaseAdmin
      .from("bookings")
      .select("device_id, scheduled_at, duration_minutes")
      .in("device_id", deviceIds)
      .in("status", ["pending", "confirmed"])
      .gte("scheduled_at", new Date(start.getTime() - 8 * 3600_000).toISOString())
      .lte("scheduled_at", new Date(end.getTime() + 8 * 3600_000).toISOString());
    if (oe) throw new Error(oe.message);

    const busy = new Set<string>();
    for (const b of overlapping ?? []) {
      const bs = new Date(b.scheduled_at).getTime();
      const be = bs + b.duration_minutes * 60_000;
      if (bs < end.getTime() && be > start.getTime()) busy.add(b.device_id);
    }
    const device = usable.find((d) => !busy.has(d.id));
    if (!device) throw new Error("That slot is already booked. Try a different time.");

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

    const amount = Math.ceil((device.hourly_rate * data.duration_minutes) / 60);
    const { data: row, error } = await supabaseAdmin
      .from("bookings")
      .insert({
        cafe_id: data.cafe_id,
        device_id: device.id,
        customer_id: customerId,
        scheduled_at: start.toISOString(),
        duration_minutes: data.duration_minutes,
        status: "pending",
        deposit_amount: amount,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const payBookingDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), amount: z.number().int().min(1) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("pay_booking_deposit", {
      _booking_id: data.id, _amount: data.amount,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const refundBookingDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("refund_booking_deposit", { _booking_id: data.id });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const cancelBookingWithRefund = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    // Refund first (no-op if not paid)
    await context.supabase.rpc("refund_booking_deposit", { _booking_id: data.id });
    const { error } = await context.supabase
      .from("bookings").update({ status: "cancelled" }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const extendBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), add_minutes: z.number().int().min(5).max(240) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: b, error: e1 } = await context.supabase.from("bookings").select("duration_minutes").eq("id", data.id).single();
    if (e1) throw new Error(e1.message);
    const next = (b?.duration_minutes ?? 0) + data.add_minutes;
    const { error } = await context.supabase.from("bookings").update({ duration_minutes: next }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true, duration_minutes: next };
  });

export const endBookingEarly = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("bookings").update({ status: "completed" }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });


export const runNoShowSweep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId, _role: "super_admin",
    });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/lib/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("auto_flag_no_shows");
    if (error) throw new Error(error.message);
    return { flagged: data as number };
  });
