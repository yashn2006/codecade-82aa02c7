import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/supabase/auth-middleware";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function isSuperAdmin(ctx: { supabase: any; userId: string }) {
  const { data } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId, _role: "super_admin",
  });
  return !!data;
}

/* -------------------- Admin → Owner messaging -------------------- */

export const sendAdminMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      cafe_id: z.string().uuid(),
      subject: z.string().min(1).max(200),
      body: z.string().min(1).max(4000),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    if (!(await isSuperAdmin(context))) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/lib/supabase/client.server");
    const { data: cafe, error: cErr } = await supabaseAdmin
      .from("cafes")
      .select("id, owner_id, name")
      .eq("id", data.cafe_id)
      .single();
    if (cErr || !cafe?.owner_id) throw new Error(cErr?.message ?? "Cafe not found");

    const { error } = await supabaseAdmin.from("admin_messages").insert({
      sender_id: context.userId,
      recipient_id: cafe.owner_id,
      cafe_id: cafe.id,
      subject: data.subject,
      body: data.body,
    });
    if (error) throw new Error(error.message);

    // best-effort in-app notification
    await supabaseAdmin.from("notifications").insert({
      user_id: cafe.owner_id,
      cafe_id: cafe.id,
      kind: "admin_message",
      title: `CoreCade: ${data.subject}`,
      body: data.body.slice(0, 240),
      link: "/owner",
    });
    return { ok: true };
  });

export const broadcastAdminMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      subject: z.string().min(1).max(200),
      body: z.string().min(1).max(4000),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    if (!(await isSuperAdmin(context))) throw new Error("Forbidden");
    const { data: count, error } = await context.supabase.rpc("broadcast_admin_message", {
      _subject: data.subject, _body: data.body,
    });
    if (error) throw new Error(error.message);
    return { count: (count as number) ?? 0 };
  });

export const listMyMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("admin_messages")
      .select("id, subject, body, sent_at, read_at, cafe_id")
      .eq("recipient_id", context.userId)
      .order("sent_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const markMessageRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("admin_messages")
      .update({ read_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("recipient_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* -------------------- Trial extension -------------------- */

export const extendCafeTrial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      cafe_id: z.string().uuid(),
      add_days: z.number().int().min(1).max(3650),
      reason: z.string().max(500).optional().nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    if (!(await isSuperAdmin(context))) throw new Error("Forbidden");
    const { data: newEnds, error } = await context.supabase.rpc("extend_trial", {
      _cafe_id: data.cafe_id,
      _add_days: data.add_days,
      _reason: data.reason ?? null,
    });
    if (error) throw new Error(error.message);
    return { new_ends_at: newEnds as string };
  });

/* -------------------- Manual revenue -------------------- */

export const logManualRevenue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      cafe_id: z.string().uuid(),
      amount_rupees: z.number().min(1).max(1_000_000),
      kind: z.enum(["cash", "upi", "card", "other"]),
      source: z.enum(["session", "pos", "membership", "tournament", "other"]),
      note: z.string().max(500).optional().nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: id, error } = await context.supabase.rpc("record_revenue", {
      _cafe_id: data.cafe_id,
      _amount: Math.round(data.amount_rupees * 100),
      _kind: data.kind,
      _source: data.source,
      _note: data.note ?? null,
    });
    if (error) throw new Error(error.message);
    return { id: id as string };
  });
