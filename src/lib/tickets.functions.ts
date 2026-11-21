import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/supabase/auth-middleware";
import {
  appendThreadMessage,
  encodeTicketThread,
  formatTicketRef,
  type ThreadRole,
} from "@/lib/support-thread";

const STATUS_ENUM = z.enum(["open", "waiting", "in_progress", "resolved", "closed"]);

const TicketInput = z.object({
  subject: z.string().trim().min(2).max(200),
  description: z.string().trim().min(2).max(4000),
  category: z.enum(["general", "billing", "bookings", "hardware", "account", "bug", "feature"]).default("general"),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  role: z.enum(["owner", "customer"]).default("owner"),
  cafe_id: z.string().uuid().optional().nullable(),
  booking_id: z.string().uuid().optional().nullable(),
  booking_ref: z.string().trim().max(40).optional().nullable(),
  booking_summary: z.string().trim().max(240).optional().nullable(),
});

async function isSuperAdmin(supa: { rpc: any }, userId: string): Promise<boolean> {
  const { data } = await supa.rpc("has_role", { _user_id: userId, _role: "super_admin" });
  return Boolean(data);
}

async function canManageCafeTickets(
  supabaseAdmin: any,
  userId: string,
  cafeId: string,
): Promise<{ ok: boolean; cafe: { id: string; name: string; slug: string; owner_id: string } | null }> {
  const { data: cafe } = await supabaseAdmin
    .from("cafes")
    .select("id, name, slug, owner_id")
    .eq("id", cafeId)
    .maybeSingle();
  if (!cafe) return { ok: false, cafe: null };
  if (cafe.owner_id === userId) return { ok: true, cafe };
  const { data: staff } = await supabaseAdmin
    .from("staff_permissions")
    .select("id")
    .eq("cafe_id", cafeId)
    .eq("staff_user_id", userId)
    .eq("is_active", true)
    .maybeSingle();
  return { ok: Boolean(staff), cafe };
}

export const createTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => TicketInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin, hasSupabaseAdminKey } = await import("@/lib/supabase/client.server");
    const hasAdmin = hasSupabaseAdminKey();
    const db = hasAdmin ? supabaseAdmin : context.supabase;

    const [{ data: profile }, cafeRes] = await Promise.all([
      db.from("profiles").select("full_name, email").eq("id", context.userId).maybeSingle(),
      data.cafe_id
        ? db.from("cafes").select("id, name, slug, owner_id").eq("id", data.cafe_id).maybeSingle()
        : Promise.resolve({ data: null as { id: string; name: string; slug: string; owner_id: string } | null }),
    ]);

    const cafe = cafeRes.data;
    const creatorName = profile?.full_name?.trim() || profile?.email || (data.role === "customer" ? "Player" : "Café Owner");
    const hasBookingMeta = Boolean(data.booking_id || data.booking_ref || data.booking_summary);

    const initialThread = hasBookingMeta
      ? encodeTicketThread({
          bookingId: data.booking_id ?? undefined,
          bookingRef: data.booking_ref ?? undefined,
          bookingSummary: data.booking_summary ?? undefined,
          cafeName: cafe?.name ?? undefined,
          messages: [
            {
              id: `open-${Date.now()}`,
              senderId: context.userId,
              senderRole: data.role,
              senderName: creatorName,
              body: data.description,
              createdAt: new Date().toISOString(),
            },
          ],
        })
      : null;

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
        ...(initialThread ? { admin_reply: initialThread } : {}),
      })
      .select("id, status, created_at")
      .single();
    if (error) throw new Error(error.message);

    const ref = formatTicketRef(row.id);

    // Push live notifications to recipient(s)
    try {
      if (!hasAdmin) {
        // Service role required to notify other users cross-tenant
      } else if (data.role === "customer" && cafe?.owner_id && cafe.owner_id !== context.userId) {
        await supabaseAdmin.from("notifications").insert({
          user_id: cafe.owner_id,
          cafe_id: cafe.id,
          kind: "booking_support",
          title: `Booking support ${ref} from ${creatorName}`,
          body: `${data.booking_ref ? `${data.booking_ref} · ` : ""}${data.subject}`,
          link: `/cafe/${cafe.slug}/support`,
        });
      } else if (data.role === "owner") {
        const { data: admins } = await supabaseAdmin
          .from("user_roles")
          .select("user_id")
          .eq("role", "super_admin");
        const adminIds = Array.from(new Set((admins ?? []).map((a) => a.user_id).filter((id) => id !== context.userId)));
        if (adminIds.length > 0) {
          await supabaseAdmin.from("notifications").insert(
            adminIds.map((uid) => ({
              user_id: uid,
              cafe_id: data.cafe_id ?? null,
              kind: "support_ticket",
              title: `New owner ticket ${ref}`,
              body: `${cafe ? `${cafe.name} · ` : ""}${data.subject}`,
              link: "/admin/support",
            })),
          );
        }
      }
    } catch {
      // Non-fatal if notification delivery fails
    }

    return row;
  });

export const listMyTickets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin, hasSupabaseAdminKey } = await import("@/lib/supabase/client.server");
    const db = hasSupabaseAdminKey() ? supabaseAdmin : context.supabase;
    const { data, error } = await context.supabase
      .from("support_tickets")
      .select("id, user_id, role, subject, description, category, priority, status, admin_reply, replied_at, created_at, cafe_id")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);

    const rows = data ?? [];
    const cafeIds = Array.from(new Set(rows.map((t) => t.cafe_id).filter(Boolean) as string[]));
    const { data: cafes } = cafeIds.length
      ? await db.from("cafes").select("id, name, slug").in("id", cafeIds)
      : { data: [] as { id: string; name: string; slug: string }[] };
    const cafeMap = new Map((cafes ?? []).map((c) => [c.id, c]));

    return rows.map((t) => ({
      ...t,
      cafe: t.cafe_id ? cafeMap.get(t.cafe_id) ?? null : null,
    }));
  });

export const listCustomerBookingCafes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin, hasSupabaseAdminKey } = await import("@/lib/supabase/client.server");
    const db = hasSupabaseAdminKey() ? supabaseAdmin : context.supabase;
    const [{ data: myCustomers }, { data: activeCafes }] = await Promise.all([
      db
        .from("customers")
        .select("cafe_id, cafes(id, name, slug, city)")
        .eq("user_id", context.userId),
      db
        .from("cafes")
        .select("id, name, slug, city")
        .eq("is_active", true)
        .order("name")
        .limit(50),
    ]);

    const seen = new Set<string>();
    const out: { id: string; name: string; slug: string; city: string | null; visited: boolean }[] = [];

    for (const row of myCustomers ?? []) {
      const c = row.cafes as unknown as { id: string; name: string; slug: string; city: string | null } | null;
      if (c && !seen.has(c.id)) {
        seen.add(c.id);
        out.push({ ...c, visited: true });
      }
    }
    for (const c of activeCafes ?? []) {
      if (!seen.has(c.id)) {
        seen.add(c.id);
        out.push({ ...c, visited: false });
      }
    }
    return out;
  });

export const listCafeCustomerTickets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ cafe_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/lib/supabase/client.server");
    const superAdmin = await isSuperAdmin(context.supabase, context.userId);
    const { ok, cafe } = await canManageCafeTickets(supabaseAdmin, context.userId, data.cafe_id);
    if (!superAdmin && !ok) throw new Error("Forbidden");

    const { data: rows, error } = await supabaseAdmin
      .from("support_tickets")
      .select("id, user_id, role, subject, description, category, priority, status, admin_reply, replied_at, created_at, cafe_id")
      .eq("cafe_id", data.cafe_id)
      .eq("role", "customer")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);

    const list = rows ?? [];
    const userIds = Array.from(new Set(list.map((t) => t.user_id)));
    const { data: profiles } = userIds.length
      ? await supabaseAdmin.from("profiles").select("id, email, full_name, phone").in("id", userIds)
      : { data: [] as { id: string; email: string | null; full_name: string | null; phone: string | null }[] };
    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

    return list.map((t) => ({
      ...t,
      user: profileMap.get(t.user_id) ?? null,
      cafe: cafe ? { id: cafe.id, name: cafe.name, slug: cafe.slug } : null,
    }));
  });

export const listAdminTickets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!(await isSuperAdmin(context.supabase, context.userId))) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/lib/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("support_tickets")
      .select("id, user_id, role, subject, description, category, priority, status, admin_reply, replied_at, created_at, cafe_id")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);

    const userIds = Array.from(new Set((data ?? []).map((t) => t.user_id)));
    const cafeIds = Array.from(new Set((data ?? []).map((t) => t.cafe_id).filter(Boolean) as string[]));
    const [{ data: profiles }, { data: cafes }] = await Promise.all([
      userIds.length
        ? supabaseAdmin.from("profiles").select("id, email, full_name, phone").in("id", userIds)
        : Promise.resolve({ data: [] as { id: string; email: string | null; full_name: string | null; phone: string | null }[] }),
      cafeIds.length
        ? supabaseAdmin.from("cafes").select("id, name, slug").in("id", cafeIds)
        : Promise.resolve({ data: [] as { id: string; name: string; slug: string }[] }),
    ]);
    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
    const cafeMap = new Map((cafes ?? []).map((c) => [c.id, c]));
    return (data ?? []).map((t) => ({
      ...t,
      user: profileMap.get(t.user_id) ?? null,
      cafe: t.cafe_id ? cafeMap.get(t.cafe_id) ?? null : null,
    }));
  });

export const sendTicketMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      ticket_id: z.string().uuid(),
      body: z.string().trim().min(1).max(4000),
      status: STATUS_ENUM.optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/lib/supabase/client.server");
    const { data: ticket, error: te } = await supabaseAdmin
      .from("support_tickets")
      .select("id, user_id, role, cafe_id, subject, description, status, admin_reply, replied_at, created_at")
      .eq("id", data.ticket_id)
      .maybeSingle();
    if (te) throw new Error(te.message);
    if (!ticket) throw new Error("Ticket not found");

    const [{ data: profile }, superAdmin] = await Promise.all([
      supabaseAdmin.from("profiles").select("full_name, email").eq("id", context.userId).maybeSingle(),
      isSuperAdmin(context.supabase, context.userId),
    ]);

    const cafeCheck = ticket.cafe_id
      ? await canManageCafeTickets(supabaseAdmin, context.userId, ticket.cafe_id)
      : { ok: false, cafe: null };

    const isCreator = ticket.user_id === context.userId;
    const isCafeDesk = ticket.role === "customer" && cafeCheck.ok;

    if (!superAdmin && !isCafeDesk && !isCreator) {
      throw new Error("Forbidden");
    }

    let senderRole: ThreadRole;
    let senderName: string;
    if (superAdmin && !isCreator) {
      senderRole = "admin";
      senderName = profile?.full_name?.trim() || "CoreCade Support";
    } else if (isCafeDesk && !isCreator) {
      senderRole = "owner";
      senderName = cafeCheck.cafe?.name || profile?.full_name?.trim() || "Café Desk";
    } else {
      senderRole = ticket.role === "customer" ? "customer" : "owner";
      senderName = profile?.full_name?.trim() || profile?.email || (senderRole === "customer" ? "Player" : "Café Owner");
    }

    const { data: creatorProfile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, email")
      .eq("id", ticket.user_id)
      .maybeSingle();

    const encoded = appendThreadMessage(
      {
        ...ticket,
        userName: creatorProfile?.full_name || creatorProfile?.email || null,
        cafeName: cafeCheck.cafe?.name ?? null,
      },
      {
        senderId: context.userId,
        senderRole,
        senderName,
        body: data.body,
      },
    );

    const nextStatus =
      data.status ??
      (senderRole === "admin" || (senderRole === "owner" && ticket.role === "customer")
        ? ticket.status === "open" || ticket.status === "waiting"
          ? "in_progress"
          : ticket.status
        : ticket.status === "resolved" || ticket.status === "closed" || ticket.status === "waiting"
          ? "open"
          : ticket.status);

    const nowIso = new Date().toISOString();
    const { error: ue } = await supabaseAdmin
      .from("support_tickets")
      .update({
        admin_reply: encoded,
        replied_at: nowIso,
        status: nextStatus,
      })
      .eq("id", ticket.id);
    if (ue) throw new Error(ue.message);

    // Notify counterparty
    const ref = formatTicketRef(ticket.id);
    try {
      if (isCreator) {
        if (ticket.role === "customer" && cafeCheck.cafe?.owner_id && cafeCheck.cafe.owner_id !== context.userId) {
          await supabaseAdmin.from("notifications").insert({
            user_id: cafeCheck.cafe.owner_id,
            cafe_id: cafeCheck.cafe.id,
            kind: "booking_support",
            title: `Reply on ${ref} from ${senderName}`,
            body: data.body.slice(0, 140),
            link: `/cafe/${cafeCheck.cafe.slug}/support`,
          });
        } else if (ticket.role === "owner") {
          const { data: admins } = await supabaseAdmin
            .from("user_roles")
            .select("user_id")
            .eq("role", "super_admin");
          const adminIds = Array.from(new Set((admins ?? []).map((a) => a.user_id).filter((id) => id !== context.userId)));
          if (adminIds.length > 0) {
            await supabaseAdmin.from("notifications").insert(
              adminIds.map((uid) => ({
                user_id: uid,
                cafe_id: ticket.cafe_id ?? null,
                kind: "support_ticket",
                title: `Owner reply on ${ref}`,
                body: data.body.slice(0, 140),
                link: "/admin/support",
              })),
            );
          }
        }
      } else {
        await supabaseAdmin.from("notifications").insert({
          user_id: ticket.user_id,
          cafe_id: ticket.cafe_id ?? null,
          kind: "support_reply",
          title: `${senderName} replied on ${ref}`,
          body: data.body.slice(0, 140),
          link:
            ticket.role === "customer"
              ? "/portal#support"
              : cafeCheck.cafe?.slug
                ? `/cafe/${cafeCheck.cafe.slug}/support`
                : "/owner/help",
        });
      }
    } catch {
      // Non-fatal notification error
    }

    return { ok: true, admin_reply: encoded, status: nextStatus, replied_at: nowIso };
  });

export const updateTicketStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      status: STATUS_ENUM,
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/lib/supabase/client.server");
    const { data: ticket, error: te } = await supabaseAdmin
      .from("support_tickets")
      .select("id, user_id, role, cafe_id")
      .eq("id", data.id)
      .maybeSingle();
    if (te) throw new Error(te.message);
    if (!ticket) throw new Error("Ticket not found");

    const superAdmin = await isSuperAdmin(context.supabase, context.userId);
    const cafeCheck = ticket.cafe_id
      ? await canManageCafeTickets(supabaseAdmin, context.userId, ticket.cafe_id)
      : { ok: false, cafe: null };
    const isCreator = ticket.user_id === context.userId;
    const isCafeDesk = ticket.role === "customer" && cafeCheck.ok;

    if (!superAdmin && !isCafeDesk && !isCreator) {
      throw new Error("Forbidden");
    }

    const { error } = await supabaseAdmin
      .from("support_tickets")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    return { ok: true, status: data.status };
  });

export const replyTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      admin_reply: z.string().trim().max(4000),
      status: STATUS_ENUM.optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    if (!(await isSuperAdmin(context.supabase, context.userId))) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/lib/supabase/client.server");

    if (!data.admin_reply.trim()) {
      const { error } = await supabaseAdmin
        .from("support_tickets")
        .update({ status: data.status ?? "in_progress" })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true };
    }

    const { data: ticket } = await supabaseAdmin
      .from("support_tickets")
      .select("id, user_id, role, cafe_id, description, admin_reply, replied_at, created_at")
      .eq("id", data.id)
      .maybeSingle();

    const encoded = ticket
      ? appendThreadMessage(ticket, {
          senderId: context.userId,
          senderRole: "admin",
          senderName: "CoreCade Support",
          body: data.admin_reply.trim(),
        })
      : data.admin_reply.trim();

    const { error } = await supabaseAdmin
      .from("support_tickets")
      .update({
        admin_reply: encoded,
        replied_at: new Date().toISOString(),
        status: data.status ?? "in_progress",
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
