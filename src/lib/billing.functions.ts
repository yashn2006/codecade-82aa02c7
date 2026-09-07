import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/supabase/auth-middleware";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function isSuperAdmin(ctx: { supabase: any; userId: string }) {
  const { data } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "super_admin" });
  return !!data;
}

export type SubscriptionRow = {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  owner_email: string | null;
  owner_name: string | null;
  trial_ends_at: string | null;
  subscription_status: string | null;
  days_left: number;
  last_extension: { added_days: number; created_at: string; source: string } | null;
  pending_invoices: number;
};

function daysLeft(endsAt: string | null): number {
  if (!endsAt) return 0;
  return Math.max(0, Math.ceil((new Date(endsAt).getTime() - Date.now()) / 86_400_000));
}

/* ------------------------- ADMIN: subscriptions ------------------------- */

export const adminListSubscriptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SubscriptionRow[]> => {
    if (!(await isSuperAdmin(context))) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/lib/supabase/client.server");

    const { data: cafes, error } = await supabaseAdmin
      .from("cafes")
      .select("id, name, slug, city, owner_id, trial_ends_at, subscription_status")
      .order("trial_ends_at", { ascending: true, nullsFirst: true });
    if (error) throw new Error(error.message);
    const rows = cafes ?? [];
    if (!rows.length) return [];

    const ownerIds = Array.from(new Set(rows.map((c) => c.owner_id).filter(Boolean)));
    const ids = rows.map((c) => c.id);
    const [ownersRes, eventsRes, invRes] = await Promise.all([
      ownerIds.length
        ? supabaseAdmin.from("profiles").select("id, email, full_name").in("id", ownerIds)
        : Promise.resolve({ data: [] as { id: string; email: string | null; full_name: string | null }[] }),
      supabaseAdmin.from("subscription_events").select("cafe_id, added_days, created_at, source").in("cafe_id", ids).order("created_at", { ascending: false }),
      supabaseAdmin.from("cafe_invoices").select("cafe_id, status").in("cafe_id", ids),
    ]);

    const owners = new Map((ownersRes.data ?? []).map((o) => [o.id, o]));
    const lastEvent = new Map<string, { added_days: number; created_at: string; source: string }>();
    for (const e of (eventsRes.data ?? []) as { cafe_id: string; added_days: number; created_at: string; source: string }[]) {
      if (!lastEvent.has(e.cafe_id)) lastEvent.set(e.cafe_id, { added_days: e.added_days, created_at: e.created_at, source: e.source });
    }
    const pending = new Map<string, number>();
    for (const i of (invRes.data ?? []) as { cafe_id: string; status: string }[]) {
      if (i.status === "pending" || i.status === "submitted") pending.set(i.cafe_id, (pending.get(i.cafe_id) ?? 0) + 1);
    }

    return rows.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      city: c.city ?? null,
      owner_email: owners.get(c.owner_id)?.email ?? null,
      owner_name: owners.get(c.owner_id)?.full_name ?? null,
      trial_ends_at: c.trial_ends_at ?? null,
      subscription_status: c.subscription_status ?? null,
      days_left: daysLeft(c.trial_ends_at ?? null),
      last_extension: lastEvent.get(c.id) ?? null,
      pending_invoices: pending.get(c.id) ?? 0,
    }));
  });

export const adminExtendSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      cafe_id: z.string().uuid(),
      add_days: z.number().int().min(1).max(3650),
      reason: z.string().max(500).nullable().optional(),
      amount_rupees: z.number().min(0).max(1_000_000).nullable().optional(),
      source: z.enum(["manual", "payment"]).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    if (!(await isSuperAdmin(context))) throw new Error("Forbidden");
    const { data: newEnds, error } = await context.supabase.rpc("extend_subscription", {
      _cafe_id: data.cafe_id,
      _add_days: data.add_days,
      _reason: data.reason ?? null,
      _amount_paise: data.amount_rupees != null ? Math.round(data.amount_rupees * 100) : null,
      _source: data.source ?? "manual",
    });
    if (error) throw new Error(error.message);

    // Notify the owner in-app (best effort).
    const { supabaseAdmin } = await import("@/lib/supabase/client.server");
    const { data: cafe } = await supabaseAdmin.from("cafes").select("owner_id, name").eq("id", data.cafe_id).maybeSingle();
    if (cafe?.owner_id) {
      await supabaseAdmin.from("notifications").insert({
        user_id: cafe.owner_id,
        kind: "subscription",
        title: `Subscription extended by ${data.add_days} days`,
        body: `${cafe.name}: active until ${new Date(newEnds as string).toDateString()}.`,
        link: "/owner",
      });
    }
    return { new_ends_at: newEnds as string };
  });

/* ------------------------- ADMIN: billing details ------------------------- */

export const getBillingDetails = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/lib/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("platform_settings")
      .select("billing_upi_id, billing_qr_url, billing_note, billing_monthly_price_paise")
      .eq("id", true)
      .maybeSingle();
    return {
      upi_id: data?.billing_upi_id ?? null,
      qr_url: data?.billing_qr_url ?? null,
      note: data?.billing_note ?? null,
      monthly_price_rupees: Math.round((data?.billing_monthly_price_paise ?? 99900) / 100),
    };
  });

export const setBillingDetails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      upi_id: z.string().max(120).nullable(),
      qr_url: z.string().max(600).nullable(),
      note: z.string().max(600).nullable(),
      monthly_price_rupees: z.number().min(0).max(1_000_000),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    if (!(await isSuperAdmin(context))) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/lib/supabase/client.server");
    const { error } = await supabaseAdmin.from("platform_settings").upsert({
      id: true,
      billing_upi_id: data.upi_id,
      billing_qr_url: data.qr_url,
      billing_note: data.note,
      billing_monthly_price_paise: Math.round(data.monthly_price_rupees * 100),
      updated_at: new Date().toISOString(),
      updated_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ------------------------- ADMIN: invoices ------------------------- */

export type InvoiceRow = {
  id: string;
  cafe_id: string;
  cafe_name: string | null;
  cafe_slug: string | null;
  amount_paise: number;
  days: number;
  status: string;
  note: string | null;
  txn_ref: string | null;
  proof_url: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string;
};

export const adminListInvoices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<InvoiceRow[]> => {
    if (!(await isSuperAdmin(context))) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/lib/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("cafe_invoices")
      .select("*, cafes(name, slug)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data ?? []).map((r: any) => ({
      id: r.id, cafe_id: r.cafe_id,
      cafe_name: r.cafes?.name ?? null, cafe_slug: r.cafes?.slug ?? null,
      amount_paise: r.amount_paise, days: r.days, status: r.status,
      note: r.note, txn_ref: r.txn_ref, proof_url: r.proof_url,
      submitted_at: r.submitted_at, reviewed_at: r.reviewed_at, review_note: r.review_note,
      created_at: r.created_at,
    }));
  });

export const adminCreateInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      cafe_id: z.string().uuid(),
      amount_rupees: z.number().min(1).max(1_000_000),
      days: z.number().int().min(1).max(3650),
      note: z.string().max(500).nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    if (!(await isSuperAdmin(context))) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/lib/supabase/client.server");
    const { error } = await supabaseAdmin.from("cafe_invoices").insert({
      cafe_id: data.cafe_id,
      amount_paise: Math.round(data.amount_rupees * 100),
      days: data.days,
      note: data.note ?? null,
      created_by: context.userId,
    });
    if (error) throw new Error(error.message);

    const { data: cafe } = await supabaseAdmin.from("cafes").select("owner_id, name").eq("id", data.cafe_id).maybeSingle();
    if (cafe?.owner_id) {
      await supabaseAdmin.from("notifications").insert({
        user_id: cafe.owner_id,
        kind: "billing",
        title: `New charge · ₹${data.amount_rupees.toLocaleString("en-IN")}`,
        body: `${data.days} days of subscription for ${cafe.name}. Pay and submit your transaction ID.`,
        link: "/owner",
      });
    }
    return { ok: true };
  });

export const adminReviewInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      action: z.enum(["approve", "reject"]),
      review_note: z.string().max(500).nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    if (!(await isSuperAdmin(context))) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/lib/supabase/client.server");
    const { data: inv, error: e1 } = await supabaseAdmin
      .from("cafe_invoices").select("*").eq("id", data.id).maybeSingle();
    if (e1) throw new Error(e1.message);
    if (!inv) throw new Error("Invoice not found");
    if (inv.status === "approved") throw new Error("Already approved");

    let newEnds: string | null = null;
    if (data.action === "approve") {
      const { data: ends, error } = await context.supabase.rpc("extend_subscription", {
        _cafe_id: inv.cafe_id,
        _add_days: inv.days,
        _reason: `Payment approved · ₹${Math.round(inv.amount_paise / 100)}${inv.txn_ref ? ` · ${inv.txn_ref}` : ""}`,
        _amount_paise: inv.amount_paise,
        _source: "payment",
      });
      if (error) throw new Error(error.message);
      newEnds = ends as string;
    }

    const { error: e2 } = await supabaseAdmin.from("cafe_invoices").update({
      status: data.action === "approve" ? "approved" : "rejected",
      reviewed_at: new Date().toISOString(),
      reviewed_by: context.userId,
      review_note: data.review_note ?? null,
    }).eq("id", data.id);
    if (e2) throw new Error(e2.message);

    const { data: cafe } = await supabaseAdmin.from("cafes").select("owner_id, name").eq("id", inv.cafe_id).maybeSingle();
    if (cafe?.owner_id) {
      await supabaseAdmin.from("notifications").insert({
        user_id: cafe.owner_id,
        kind: "billing",
        title: data.action === "approve" ? "Payment approved — subscription resumed" : "Payment could not be verified",
        body: data.action === "approve"
          ? `${inv.days} days added. Active until ${newEnds ? new Date(newEnds).toDateString() : "—"}.`
          : (data.review_note ?? "Please check your transaction details and submit again."),
        link: "/owner",
      });
    }
    return { ok: true, new_ends_at: newEnds };
  });

/* ------------------------- OWNER side ------------------------- */

export const myBilling = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/lib/supabase/client.server");
    const { data: cafes } = await supabaseAdmin
      .from("cafes")
      .select("id, name, slug, trial_ends_at, subscription_status")
      .eq("owner_id", context.userId)
      .order("created_at", { ascending: true });
    const list = cafes ?? [];
    const ids = list.map((c) => c.id);

    const [evRes, invRes, payRes] = await Promise.all([
      ids.length ? supabaseAdmin.from("subscription_events").select("*").in("cafe_id", ids).order("created_at", { ascending: false }).limit(50) : Promise.resolve({ data: [] }),
      ids.length ? supabaseAdmin.from("cafe_invoices").select("*").in("cafe_id", ids).order("created_at", { ascending: false }).limit(50) : Promise.resolve({ data: [] }),
      supabaseAdmin.from("platform_settings").select("billing_upi_id, billing_qr_url, billing_note, billing_monthly_price_paise").eq("id", true).maybeSingle(),
    ]);

    return {
      cafes: list.map((c) => ({
        id: c.id, name: c.name, slug: c.slug,
        trial_ends_at: c.trial_ends_at ?? null,
        subscription_status: c.subscription_status ?? null,
        days_left: daysLeft(c.trial_ends_at ?? null),
      })),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      events: (evRes.data ?? []) as any[],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      invoices: (invRes.data ?? []) as any[],
      payTo: {
        upi_id: payRes.data?.billing_upi_id ?? null,
        qr_url: payRes.data?.billing_qr_url ?? null,
        note: payRes.data?.billing_note ?? null,
        monthly_price_rupees: Math.round((payRes.data?.billing_monthly_price_paise ?? 99900) / 100),
      },
    };
  });

export const submitInvoiceProof = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      invoice_id: z.string().uuid(),
      txn_ref: z.string().min(3).max(120),
      proof_url: z.string().max(600).nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/lib/supabase/client.server");
    const { data: inv } = await supabaseAdmin
      .from("cafe_invoices").select("id, cafe_id").eq("id", data.invoice_id).maybeSingle();
    if (!inv) throw new Error("Invoice not found");
    const { data: cafe } = await supabaseAdmin
      .from("cafes").select("id, name").eq("id", inv.cafe_id).eq("owner_id", context.userId).maybeSingle();
    if (!cafe) throw new Error("Not your café");

    const { error } = await supabaseAdmin.from("cafe_invoices").update({
      status: "submitted",
      txn_ref: data.txn_ref,
      proof_url: data.proof_url ?? null,
      submitted_at: new Date().toISOString(),
    }).eq("id", data.invoice_id);
    if (error) throw new Error(error.message);

    const { data: admins } = await supabaseAdmin.from("user_roles").select("user_id").eq("role", "super_admin");
    if (admins?.length) {
      await supabaseAdmin.from("notifications").insert(
        admins.map((a: { user_id: string }) => ({
          user_id: a.user_id,
          kind: "billing",
          title: `Payment proof submitted — ${cafe.name}`,
          body: `Transaction ${data.txn_ref}. Review and approve to resume the subscription.`,
          link: "/admin/billing",
        })),
      );
    }
    return { ok: true };
  });
