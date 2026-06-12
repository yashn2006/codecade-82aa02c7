import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/supabase/auth-middleware";

// PUBLIC — devices for a café (used by booking flow)
export const getCafeDevicesPublic = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ cafe_id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/lib/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("devices")
      .select("id, name, type, hourly_rate, status, specs")
      .eq("cafe_id", data.cafe_id)
      .order("type")
      .order("name");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// PUBLIC — busy windows for a device on a given local date (YYYY-MM-DD)
export const getDeviceSchedule = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z.object({
      cafe_id: z.string().uuid(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/lib/supabase/client.server");
    const dayStart = new Date(`${data.date}T00:00:00`);
    const dayEnd = new Date(`${data.date}T23:59:59`);
    const { data: rows, error } = await supabaseAdmin
      .from("bookings")
      .select("device_id, scheduled_at, duration_minutes, status")
      .eq("cafe_id", data.cafe_id)
      .gte("scheduled_at", dayStart.toISOString())
      .lte("scheduled_at", dayEnd.toISOString())
      .in("status", ["pending", "confirmed"]);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// AUTH — direct device booking with conflict check
export const customerBookDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      device_id: z.string().uuid(),
      scheduled_at: z.string(),
      duration_minutes: z.number().int().min(30).max(480),
      payment_method: z.enum(["pay_online", "pay_at_cafe", "cash"]).default("pay_at_cafe"),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/lib/supabase/client.server");
    const { data: device, error: de } = await supabaseAdmin
      .from("devices").select("id, cafe_id, hourly_rate, name").eq("id", data.device_id).maybeSingle();
    if (de) throw new Error(de.message);
    if (!device) throw new Error("Device not found");

    // conflict window check
    const start = new Date(data.scheduled_at);
    const end = new Date(start.getTime() + data.duration_minutes * 60_000);
    const { data: conflicts } = await supabaseAdmin
      .from("bookings")
      .select("scheduled_at, duration_minutes")
      .eq("device_id", data.device_id)
      .in("status", ["pending", "confirmed"])
      .gte("scheduled_at", new Date(start.getTime() - 8 * 3600_000).toISOString())
      .lte("scheduled_at", new Date(end.getTime() + 8 * 3600_000).toISOString());
    for (const b of conflicts ?? []) {
      const bs = new Date(b.scheduled_at).getTime();
      const be = bs + b.duration_minutes * 60_000;
      if (bs < end.getTime() && be > start.getTime()) {
        throw new Error("This slot just got booked. Pick another time.");
      }
    }

    // ensure customer row
    const { data: profile } = await context.supabase
      .from("profiles").select("full_name, phone, email").eq("id", context.userId).single();
    let customerId: string;
    const { data: existing } = await supabaseAdmin
      .from("customers").select("id").eq("cafe_id", device.cafe_id).eq("user_id", context.userId).maybeSingle();
    if (existing) customerId = existing.id;
    else {
      const { data: nc, error: ce } = await supabaseAdmin
        .from("customers")
        .insert({
          cafe_id: device.cafe_id,
          user_id: context.userId,
          full_name: profile?.full_name || profile?.email || "Customer",
          phone: profile?.phone ?? null,
          email: profile?.email ?? null,
        })
        .select("id").single();
      if (ce) throw new Error(ce.message);
      customerId = nc.id;
    }

    const amount = Math.ceil((device.hourly_rate * data.duration_minutes) / 60);
    const { data: row, error } = await supabaseAdmin
      .from("bookings")
      .insert({
        cafe_id: device.cafe_id,
        device_id: device.id,
        customer_id: customerId,
        scheduled_at: start.toISOString(),
        duration_minutes: data.duration_minutes,
        status: "pending",
        payment_method: data.payment_method,
        deposit_amount: amount,
      })
      .select().single();
    if (error) throw new Error(error.message);
    return { ...row, amount, cafe_id: device.cafe_id, customer_id: customerId };
  });


export const getMyPortalSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: customers } = await context.supabase
      .from("customers")
      .select("id, cafe_id, wallet_balance, cafes(name, slug, city)")
      .eq("user_id", context.userId);
    const customerIds = (customers ?? []).map((c) => c.id);

    let bookings: { id: string; status: string; duration_minutes: number; scheduled_at: string; cafe_id: string }[] = [];
    if (customerIds.length) {
      const { data } = await context.supabase
        .from("bookings")
        .select("id, status, duration_minutes, scheduled_at, cafe_id")
        .in("customer_id", customerIds);
      bookings = data ?? [];
    }
    const totalHours = bookings.reduce((s, b) => s + (b.duration_minutes ?? 0), 0) / 60;
    const completed = bookings.filter((b) => b.status === "completed").length;
    const upcoming = bookings.filter(
      (b) => ["pending", "confirmed"].includes(b.status) && new Date(b.scheduled_at) > new Date(),
    ).length;
    const walletTotal = (customers ?? []).reduce((s, c) => s + (c.wallet_balance ?? 0), 0);

    // "Cafés visited" = distinct cafés the user has actually booked at (not just signed up at)
    const visitedSet = new Set(
      bookings
        .filter((b) => ["confirmed", "completed"].includes(b.status))
        .map((b) => b.cafe_id),
    );

    // Wallets — only show cafés where the user actually has activity OR a non-zero balance
    const activeWallets = (customers ?? []).filter(
      (c) => (c.wallet_balance ?? 0) > 0 || bookings.some((b) => b.cafe_id === c.cafe_id),
    );

    return {
      wallets: activeWallets,
      walletTotal,
      totalBookings: bookings.length,
      totalHours: Math.round(totalHours * 10) / 10,
      completed,
      upcoming,
      cafesVisited: visitedSet.size,
    };
  });

export const cancelMyBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: b } = await context.supabase
      .from("bookings")
      .select("id, status, scheduled_at, customers!inner(user_id)")
      .eq("id", data.id).single();
    if (!b) throw new Error("Not found");
    const cust = b.customers as unknown as { user_id: string } | null;
    if (!cust || cust.user_id !== context.userId) throw new Error("Forbidden");
    if (!["pending", "confirmed"].includes(b.status)) throw new Error("Cannot cancel this booking");

    await context.supabase.rpc("refund_booking_deposit", { _booking_id: data.id });
    const { error } = await context.supabase
      .from("bookings").update({ status: "cancelled" }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("profiles").select("id, email, full_name, phone, avatar_url").eq("id", context.userId).maybeSingle();
    return data;
  });

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      full_name: z.string().min(1).max(120),
      phone: z.string().max(20).nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update({ full_name: data.full_name, phone: data.phone ?? null })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
