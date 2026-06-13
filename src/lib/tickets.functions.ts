import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/supabase/auth-middleware";

const TicketInput = z.object({
  subject: z.string().trim().min(2).max(200),
  description: z.string().trim().min(2).max(4000),
  category: z.enum(["general", "billing", "bookings", "hardware", "account", "bug", "feature"]).default("general"),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  role: z.enum(["owner", "customer"]).default("owner"),
  cafe_id: z.string().uuid().optional().nullable(),
});

export const createTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => TicketInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("support_tickets")
      .insert({
        user_id: context.userId,
        role: data.role,
        cafe_id: data.cafe_id ?? null,
        subject: data.subject,
        description: data.description,
        category: data.category,
        priority: data.priority,
      })
      .select("id, status, created_at")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const listMyTickets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("support_tickets")
      .select("id, subject, description, category, priority, status, admin_reply, replied_at, created_at, cafe_id")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listAdminTickets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId, _role: "super_admin",
    });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/lib/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("support_tickets")
      .select("id, user_id, role, subject, description, category, priority, status, admin_reply, replied_at, created_at, cafe_id")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);

    const userIds = Array.from(new Set((data ?? []).map(t => t.user_id)));
    const cafeIds = Array.from(new Set((data ?? []).map(t => t.cafe_id).filter(Boolean) as string[]));
    const [{ data: profiles }, { data: cafes }] = await Promise.all([
      userIds.length
        ? supabaseAdmin.from("profiles").select("id, email, full_name").in("id", userIds)
        : Promise.resolve({ data: [] as { id: string; email: string | null; full_name: string | null }[] }),
      cafeIds.length
        ? supabaseAdmin.from("cafes").select("id, name").in("id", cafeIds)
        : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    ]);
    const profileMap = new Map((profiles ?? []).map(p => [p.id, p]));
    const cafeMap = new Map((cafes ?? []).map(c => [c.id, c]));
    return (data ?? []).map(t => ({
      ...t,
      user: profileMap.get(t.user_id) ?? null,
      cafe: t.cafe_id ? cafeMap.get(t.cafe_id) ?? null : null,
    }));
  });

export const replyTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      admin_reply: z.string().trim().min(1).max(4000),
      status: z.enum(["open", "waiting", "in_progress", "resolved", "closed"]).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId, _role: "super_admin",
    });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/lib/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("support_tickets")
      .update({
        admin_reply: data.admin_reply,
        replied_at: new Date().toISOString(),
        status: data.status ?? "in_progress",
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
