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

// ---------- Customer portal: home / wallet / tournaments ----------

async function myCustomerIds(supa: { from: (t: string) => any }, userId: string) {
  const { data } = await supa.from("customers").select("id, cafe_id, wallet_balance, cafes(name, slug, city)").eq("user_id", userId);
  return (data ?? []) as { id: string; cafe_id: string; wallet_balance: number; cafes: { name?: string; slug?: string; city?: string } | null }[];
}

export const getMyPortalHome = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/lib/supabase/client.server");
    const customers = await myCustomerIds(context.supabase, context.userId);
    const ids = customers.map((c) => c.id);
    const empty = { customers, activeSession: null, nextBooking: null, memberships: [], activity: [] as any[] };
    if (!ids.length) return empty;

    const [{ data: sessions }, { data: bookings }, { data: memberships }, { data: txs }] = await Promise.all([
      supabaseAdmin.from("sessions")
        .select("id, cafe_id, started_at, amount, status, devices(name, type, hourly_rate), cafes(name, slug)")
        .in("customer_id", ids).eq("status", "active").order("started_at", { ascending: false }).limit(1),
      supabaseAdmin.from("bookings")
        .select("id, cafe_id, scheduled_at, duration_minutes, status, deposit_amount, devices(name, type), cafes(name, slug, address)")
        .in("customer_id", ids).in("status", ["pending", "confirmed"])
        .gte("scheduled_at", new Date().toISOString()).order("scheduled_at", { ascending: true }).limit(1),
      supabaseAdmin.from("customer_memberships")
        .select("id, customer_id, starts_at, ends_at, hours_remaining, memberships(name, hours_included, price)")
        .in("customer_id", ids).gt("ends_at", new Date().toISOString()).order("ends_at", { ascending: true }),
      supabaseAdmin.from("wallet_transactions")
        .select("id, amount, kind, note, created_at, cafe_id")
        .in("customer_id", ids).order("created_at", { ascending: false }).limit(5),
    ]);

    return {
      customers,
      activeSession: (sessions ?? [])[0] ?? null,
      nextBooking: (bookings ?? [])[0] ?? null,
      memberships: memberships ?? [],
      activity: txs ?? [],
    };
  });

export const getMyWalletLedger = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/lib/supabase/client.server");
    const customers = await myCustomerIds(context.supabase, context.userId);
    const ids = customers.map((c) => c.id);
    const cafeIds = Array.from(new Set(customers.map((c) => c.cafe_id).filter(Boolean)));

    if (!ids.length) {
      return {
        customers,
        transactions: [] as any[],
        topupRequests: [] as any[],
        cafeUpi: {} as Record<string, { upi_id: string | null; upi_qr_url: string | null }>,
        balance: 0,
      };
    }

    const [{ data: transactions }, { data: pages }, { data: topups }] = await Promise.all([
      supabaseAdmin
        .from("wallet_transactions")
        .select("id, amount, kind, note, created_at, cafe_id, customer_id")
        .in("customer_id", ids)
        .order("created_at", { ascending: false })
        .limit(100),
      cafeIds.length
        ? supabaseAdmin
            .from("cafe_pages")
            .select("cafe_id, upi_id, upi_qr_url")
            .in("cafe_id", cafeIds)
        : Promise.resolve({ data: [] as { cafe_id: string; upi_id: string | null; upi_qr_url: string | null }[] }),
      supabaseAdmin
        .from("wallet_topups")
        .select("id, cafe_id, customer_id, amount, status, razorpay_payment_id, notes, created_at, paid_at, cafes(name, slug)")
        .in("customer_id", ids)
        .order("created_at", { ascending: false })
        .limit(30),
    ]);

    const cafeUpi: Record<string, { upi_id: string | null; upi_qr_url: string | null }> = {};
    for (const p of (pages ?? []) as { cafe_id: string; upi_id: string | null; upi_qr_url: string | null }[]) {
      cafeUpi[p.cafe_id] = { upi_id: p.upi_id ?? null, upi_qr_url: p.upi_qr_url ?? null };
    }

    const topupRequests = (topups ?? []).filter(
      (t: any) => t.notes?.method === "upi_proof" || String(t.razorpay_payment_id ?? "").startsWith("UTR:"),
    );

    const balance = customers.reduce((s, c) => s + (c.wallet_balance ?? 0), 0);
    return {
      customers,
      transactions: transactions ?? [],
      topupRequests,
      cafeUpi,
      balance,
    };
  });

export const getMyTournaments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/lib/supabase/client.server");
    const { data: profile } = await context.supabase
      .from("profiles").select("email, phone").eq("id", context.userId).maybeSingle();
    const contacts = [profile?.email, profile?.phone].filter(Boolean) as string[];

    let mine: any[] = [];
    if (contacts.length) {
      const { data } = await supabaseAdmin
        .from("tournament_registrations")
        .select("id, team_name, contact, paid, tournaments(id, title, game, format, prize_pool, entry_fee, starts_at, status, cafe_id, cafes(name, slug))")
        .in("contact", contacts).order("created_at", { ascending: false }).limit(30);
      mine = data ?? [];
    }

    const { data: upcoming } = await supabaseAdmin
      .from("tournaments")
      .select("id, title, game, format, prize_pool, entry_fee, starts_at, status, cafes(name, slug, city)")
      .eq("status", "upcoming").gte("starts_at", new Date().toISOString())
      .order("starts_at", { ascending: true }).limit(10);

    return { mine, upcoming: upcoming ?? [] };
  });

export const customerSubmitTopupProof = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      cafe_id: z.string().uuid(),
      customer_id: z.string().uuid(),
      amount: z.number().int().min(1).max(100000),
      utr_number: z.string().trim().min(6, "Enter a valid UPI UTR / reference (at least 6 characters)").max(60),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/lib/supabase/client.server");
    const utr = data.utr_number.trim();
    if (!/^[A-Za-z0-9._-]{6,60}$/.test(utr)) {
      throw new Error("UTR / transaction reference can only contain letters, numbers, dots or dashes.");
    }

    const { data: customer } = await supabaseAdmin
      .from("customers")
      .select("id, user_id, cafe_id, full_name")
      .eq("id", data.customer_id)
      .eq("cafe_id", data.cafe_id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!customer) throw new Error("Customer record not found for this café");

    const [{ data: cafe }, { data: cafePage }] = await Promise.all([
      supabaseAdmin.from("cafes").select("id, name, slug, owner_id").eq("id", data.cafe_id).maybeSingle(),
      supabaseAdmin.from("cafe_pages").select("upi_id").eq("cafe_id", data.cafe_id).maybeSingle(),
    ]);
    if (!cafe) throw new Error("Café not found");
    if (!cafePage?.upi_id) {
      throw new Error("This café has not enabled Direct UPI yet. Please pay at the counter.");
    }

    const { data: dup } = await supabaseAdmin
      .from("wallet_topups")
      .select("id, status")
      .eq("cafe_id", data.cafe_id)
      .eq("razorpay_payment_id", `UTR:${utr}`)
      .in("status", ["created", "paid"])
      .limit(1)
      .maybeSingle();
    if (dup) {
      throw new Error("This UTR reference has already been submitted.");
    }

    const { data: row, error } = await supabaseAdmin
      .from("wallet_topups")
      .insert({
        cafe_id: data.cafe_id,
        customer_id: data.customer_id,
        amount: data.amount,
        currency: "INR",
        status: "created",
        razorpay_payment_id: `UTR:${utr}`,
        notes: {
          method: "upi_proof",
          utr_number: utr,
          submitted_by: context.userId,
          customer_name: customer.full_name,
          submitted_at: new Date().toISOString(),
        },
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    if (cafe.owner_id) {
      await supabaseAdmin.from("notifications").insert({
        user_id: cafe.owner_id,
        cafe_id: cafe.id,
        kind: "wallet_topup",
        title: `UPI top-up proof · ₹${data.amount}`,
        body: `${customer.full_name ?? "A player"} submitted UTR ${utr}. Verify in Wallet to credit.`,
        link: `/cafe/${cafe.slug}/wallet`,
      });
    }

    return { ok: true, status: "pending" as const, topup_id: row.id };
  });
