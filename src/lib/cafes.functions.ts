import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/supabase/auth-middleware";

const CafeInput = z.object({
  name: z.string().min(2).max(120),
  slug: z.string().min(2).max(60).regex(/^[a-z0-9-]+$/, "lowercase letters, numbers, dashes only"),
  city: z.string().max(80).optional().nullable(),
  state: z.string().max(80).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  email: z.string().email().max(200).optional().nullable().or(z.literal("")),
  description: z.string().max(1000).optional().nullable(),
  // Optional — only super admins may set a different owner. Café owners auto-own.
  owner_email: z.string().email().max(200).optional().nullable(),
});

export const listMyCafes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("cafes")
      .select("id, slug, name, city, is_active, owner_id, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getMyOwnedCafes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("cafes")
      .select("id, slug, name, city, is_active")
      .eq("owner_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const toggleCafeActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), is_active: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("cafes").update({ is_active: data.is_active }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Owner OR super admin can schedule maintenance for a cafe.
// Pass nulls to clear the maintenance window.
export const setCafeMaintenance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      starts_at: z.string().datetime().nullable(),
      ends_at: z.string().datetime().nullable(),
      message: z.string().max(500).nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    // RLS on cafes already restricts to owner; super admin bypasses via has_role policy.
    const { error } = await context.supabase
      .from("cafes")
      .update({
        maintenance_starts_at: data.starts_at,
        maintenance_ends_at: data.ends_at,
        maintenance_message: data.message,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getCafeMaintenance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("cafes")
      .select("maintenance_starts_at, maintenance_ends_at, maintenance_message")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row;
  });

export const getCafeBySlug = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ slug: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: cafe, error } = await context.supabase
      .from("cafes")
      .select("*")
      .eq("slug", data.slug)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!cafe) throw new Error("Café not found");
    return cafe;
  });

export const createCafe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CafeInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId, _role: "super_admin",
    });
    const { data: isOwner } = await context.supabase.rpc("has_role", {
      _user_id: context.userId, _role: "cafe_owner",
    });
    if (!isAdmin && !isOwner) throw new Error("Forbidden — only café owners or admins can create cafés.");

    const { supabaseAdmin } = await import("@/lib/supabase/client.server");

    // Resolve owner. Café owners always own their own cafés.
    let ownerId: string | undefined;
    if (isAdmin && data.owner_email) {
      const { data: profile } = await supabaseAdmin
        .from("profiles").select("id").eq("email", data.owner_email).maybeSingle();
      ownerId = profile?.id;
      if (!ownerId) {
        const { data: invited, error: invErr } =
          await supabaseAdmin.auth.admin.inviteUserByEmail(data.owner_email);
        if (invErr) throw new Error(invErr.message);
        ownerId = invited.user?.id;
      }
    } else {
      ownerId = context.userId;
    }
    if (!ownerId) throw new Error("Could not resolve owner");

    // Unique slug guard
    const { data: clash } = await supabaseAdmin
      .from("cafes").select("id").eq("slug", data.slug).maybeSingle();
    if (clash) throw new Error("That slug is taken — pick another.");

    const { data: cafe, error } = await supabaseAdmin
      .from("cafes")
      .insert({
        owner_id: ownerId,
        slug: data.slug,
        name: data.name,
        city: data.city || null,
        state: data.state || null,
        address: data.address || null,
        phone: data.phone || null,
        email: data.email || null,
        description: data.description || null,
      })
      .select().single();
    if (error) throw new Error(error.message);

    // Ensure cafe_owner role exists (scoped + global) — ignore duplicates
    await supabaseAdmin.from("user_roles")
      .insert({ user_id: ownerId, role: "cafe_owner", cafe_id: cafe.id });
    await supabaseAdmin.from("user_roles")
      .insert({ user_id: ownerId, role: "cafe_owner", cafe_id: null });

    return cafe;
  });

export const updateCafe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      patch: z.object({
        name: z.string().min(2).max(120).optional(),
        city: z.string().max(80).optional().nullable(),
        state: z.string().max(80).optional().nullable(),
        address: z.string().max(500).optional().nullable(),
        phone: z.string().max(20).optional().nullable(),
        email: z.string().max(200).optional().nullable(),
        description: z.string().max(1000).optional().nullable(),
        is_active: z.boolean().optional(),
        floor_cols: z.number().int().min(4).max(40).optional(),
        floor_rows: z.number().int().min(3).max(30).optional(),
        latitude: z.number().min(-90).max(90).nullable().optional(),
        longitude: z.number().min(-180).max(180).nullable().optional(),
        gst_no: z.string().max(40).nullable().optional(),
        default_gst_rate: z.number().min(0).max(50).optional(),
      }),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("cafes")
      .update(data.patch)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
