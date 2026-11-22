import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/supabase/auth-middleware";

async function assertCafeOwner(ctx: { supabase: ReturnType<typeof Object> & { from: (t: string) => unknown; rpc: (n: string, p: unknown) => unknown }; userId: string }, cafeId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = ctx.supabase as any;
  const { data: isAdmin } = await sb.rpc("has_role", { _user_id: ctx.userId, _role: "super_admin" });
  if (isAdmin) return;
  const { data: cafe } = await sb.from("cafes").select("owner_id").eq("id", cafeId).maybeSingle();
  if (!cafe || cafe.owner_id !== ctx.userId) throw new Error("Forbidden");
}

export const STAFF_PERMS = [
  "start_sessions",
  "end_sessions",
  "create_bookings",
  "register_customers",
  "manage_wallet",
  "generate_bills",
  "view_revenue",
  "manage_menu",
  "manage_devices",
] as const;
export type StaffPerm = typeof STAFF_PERMS[number];

export const STAFF_PERM_META: Record<StaffPerm, { label: string; description: string }> = {
  start_sessions: {
    label: "Start sessions",
    description: "Seat walk-ins or bookings and start live station timers.",
  },
  end_sessions: {
    label: "End sessions",
    description: "Stop running sessions and finalize playtime charges.",
  },
  create_bookings: {
    label: "Bookings",
    description: "Create reservations, confirm arrivals, and update slots.",
  },
  register_customers: {
    label: "Register customers",
    description: "Add new player profiles and update customer contact info.",
  },
  manage_wallet: {
    label: "Manage wallet",
    description: "Top up player wallets, adjust balances, and verify UPI proofs.",
  },
  generate_bills: {
    label: "Generate bills (POS)",
    description: "Create snack bar orders, settle bills, and process refunds.",
  },
  view_revenue: {
    label: "View revenue",
    description: "View daily revenue totals, analytics, and Z-reports.",
  },
  manage_menu: {
    label: "Manage menu",
    description: "Add, edit, or update stock for food and beverage items.",
  },
  manage_devices: {
    label: "Manage stations",
    description: "Add stations, adjust hourly rates, and toggle maintenance.",
  },
};

const USERNAME_REGEX = /^[a-z0-9._-]{2,32}$/;

function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isTrivialPin(pin: string): boolean {
  if (!/^\d{6}$/.test(pin)) return true;
  if (/^(\d)\1{5}$/.test(pin)) return true;
  const digits = pin.split("").map(Number);
  let asc = true;
  let desc = true;
  for (let i = 1; i < digits.length; i++) {
    if (digits[i] !== (digits[i - 1] + 1) % 10) asc = false;
    if (digits[i] !== (digits[i - 1] + 9) % 10) desc = false;
  }
  if (asc || desc) return true;
  if (/^(\d{2})\1\1$/.test(pin) || /^(\d{3})\1$/.test(pin)) return true;
  return false;
}

async function generatePin(): Promise<string> {
  const { randomInt } = await import("node:crypto");
  for (let i = 0; i < 40; i++) {
    const candidate = String(randomInt(0, 1_000_000)).padStart(6, "0");
    if (!isTrivialPin(candidate)) return candidate;
  }
  return "482917";
}

export const listStaff = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ cafe_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertCafeOwner(context, data.cafe_id);
    const { hasSupabaseAdminKey, supabaseAdmin } = await import("@/lib/supabase/client.server");
    const db = hasSupabaseAdminKey() ? supabaseAdmin : context.supabase;
    const { data: rows, error } = await db
      .from("staff_permissions")
      .select(
        "id, staff_user_id, permissions, username, login_email, display_name, must_change_pin, failed_attempts, locked_until, is_active, last_seen_at, created_at, profiles:staff_user_id(email, full_name)",
      )
      .eq("cafe_id", data.cafe_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const updateStaffPermissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      cafe_id: z.string().uuid(),
      staff_user_id: z.string().uuid(),
      permissions: z.array(z.enum(STAFF_PERMS)),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertCafeOwner(context, data.cafe_id);
    const { hasSupabaseAdminKey, supabaseAdmin } = await import("@/lib/supabase/client.server");
    const db = hasSupabaseAdminKey() ? supabaseAdmin : context.supabase;
    const { data: row } = await db
      .from("staff_permissions")
      .select("username, display_name")
      .eq("cafe_id", data.cafe_id)
      .eq("staff_user_id", data.staff_user_id)
      .maybeSingle();

    const { error } = await db
      .from("staff_permissions")
      .update({ permissions: data.permissions })
      .eq("cafe_id", data.cafe_id)
      .eq("staff_user_id", data.staff_user_id);
    if (error) throw new Error(error.message);

    const { writeAudit } = await import("@/lib/audit.server");
    await writeAudit({
      cafeId: data.cafe_id,
      actorId: context.userId,
      action: "staff.permissions_updated",
      resourceType: "staff",
      resourceId: data.staff_user_id,
      meta: {
        username: (row as { username?: string | null } | null)?.username ?? null,
        display_name: (row as { display_name?: string | null } | null)?.display_name ?? null,
        permissions: data.permissions,
      },
      supabase: context.supabase,
    });
    return { ok: true };
  });

/** Heartbeat — called by staff client every ~2 min to mark "online". */
export const staffHeartbeat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ cafe_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { hasSupabaseAdminKey, supabaseAdmin } = await import("@/lib/supabase/client.server");
    const db = hasSupabaseAdminKey() ? supabaseAdmin : context.supabase;
    await db.from("staff_permissions")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("cafe_id", data.cafe_id)
      .eq("staff_user_id", context.userId);
    return { ok: true };
  });

export const getMyCafeAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ cafe_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { resolveCafeAccess } = await import("@/lib/staff-access.server");
    const access = await resolveCafeAccess(context.userId, data.cafe_id, context.supabase);
    if (!access) {
      return {
        role: null as "super_admin" | "owner" | "staff" | null,
        isMember: false,
        isOwnerOrAdmin: false,
        permissions: [] as StaffPerm[],
        mustChangePin: false,
        isActive: false,
        displayName: null as string | null,
        username: null as string | null,
        isPinStaff: false,
      };
    }
    return {
      role: access.role,
      isMember: true,
      isOwnerOrAdmin: access.isOwnerOrAdmin,
      permissions: access.permissions,
      mustChangePin: access.mustChangePin,
      isActive: access.isActive,
      displayName: access.displayName,
      username: access.username,
      isPinStaff: access.isPinStaff,
    };
  });

export const createStaffWithPin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => {
    const parsed = z.object({
      cafe_id: z.string().uuid(),
      display_name: z.string().trim().min(1, "Display name is required").max(80),
      username: z.string().trim().min(2, "Username must be at least 2 characters").max(32),
      permissions: z.array(z.enum(STAFF_PERMS)).default([]),
    }).safeParse(d);
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message || "Invalid staff details");
    }
    return parsed.data;
  })
  .handler(async ({ data, context }) => {
    await assertCafeOwner(context, data.cafe_id);
    const username = normalizeUsername(data.username);
    if (!USERNAME_REGEX.test(username)) {
      throw new Error("Username may only contain lowercase letters, numbers, dots, underscores, or hyphens.");
    }

    const { hasSupabaseAdminKey, supabaseAdmin } = await import("@/lib/supabase/client.server");
    if (!hasSupabaseAdminKey()) {
      throw new Error("Server admin key (SUPABASE_SERVICE_ROLE_KEY) is required to create PIN staff accounts.");
    }
    const { randomUUID } = await import("node:crypto");

    const { data: cafe, error: cafeErr } = await supabaseAdmin
      .from("cafes")
      .select("id, staff_code")
      .eq("id", data.cafe_id)
      .maybeSingle();
    if (cafeErr || !cafe) throw new Error("Café not found");

    const { data: existingUsername } = await supabaseAdmin
      .from("staff_permissions")
      .select("id")
      .eq("cafe_id", data.cafe_id)
      .ilike("username", username)
      .maybeSingle();
    if (existingUsername) {
      throw new Error(`Username "@${username}" is already taken at this café.`);
    }

    const pin = await generatePin();
    const token = randomUUID().replace(/-/g, "").slice(0, 16);
    const candidateEmails = [
      `staff-${token}@staff.corecade.invalid`,
      `staff-${token}@staff.corecade.example`,
    ];

    let createdUserId: string | undefined;
    let loginEmail = candidateEmails[0];
    let lastErrMsg = "Could not create staff auth user";

    for (const candidate of candidateEmails) {
      const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email: candidate,
        password: pin,
        email_confirm: true,
        user_metadata: {
          full_name: data.display_name,
          is_pin_staff: true,
          username,
          cafe_id: data.cafe_id,
        },
      });
      if (!createErr && created.user?.id) {
        createdUserId = created.user.id;
        loginEmail = candidate;
        break;
      }
      lastErrMsg = createErr?.message || lastErrMsg;
    }

    if (!createdUserId) throw new Error(lastErrMsg);

    try {
      // Remove default customer role inserted by auth trigger for synthetic PIN-staff accounts
      await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", createdUserId)
        .eq("role", "customer");

      await supabaseAdmin
        .from("profiles")
        .update({ full_name: data.display_name })
        .eq("id", createdUserId);

      const { error: roleErr } = await supabaseAdmin
        .from("user_roles")
        .upsert(
          { user_id: createdUserId, role: "cafe_staff", cafe_id: data.cafe_id },
          { onConflict: "user_id,role,cafe_id" },
        );
      if (roleErr) throw new Error(roleErr.message);

      const { error: permErr } = await supabaseAdmin
        .from("staff_permissions")
        .insert({
          cafe_id: data.cafe_id,
          staff_user_id: createdUserId,
          username,
          login_email: loginEmail,
          display_name: data.display_name,
          permissions: data.permissions,
          must_change_pin: true,
          failed_attempts: 0,
          locked_until: null,
          is_active: true,
        });
      if (permErr) throw new Error(permErr.message);
    } catch (err) {
      // Rollback auth user on DB insert failure
      await supabaseAdmin.auth.admin.deleteUser(createdUserId).catch(() => {});
      throw err instanceof Error ? err : new Error("Failed to save staff permissions");
    }

    const { writeAudit } = await import("@/lib/audit.server");
    await writeAudit({
      cafeId: data.cafe_id,
      actorId: context.userId,
      action: "staff.added",
      resourceType: "staff",
      resourceId: createdUserId,
      meta: {
        method: "pin",
        username,
        display_name: data.display_name,
        permissions: data.permissions,
      },
    });

    return {
      staff_user_id: createdUserId,
      username,
      display_name: data.display_name,
      cafe_code: (cafe as { staff_code?: string | null }).staff_code ?? "",
      pin,
    };
  });

export const resetStaffPin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ cafe_id: z.string().uuid(), staff_user_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertCafeOwner(context, data.cafe_id);
    const { hasSupabaseAdminKey, supabaseAdmin } = await import("@/lib/supabase/client.server");
    if (!hasSupabaseAdminKey()) {
      throw new Error("Server admin key (SUPABASE_SERVICE_ROLE_KEY) is required to reset staff PINs.");
    }

    const { data: row, error: fetchErr } = await supabaseAdmin
      .from("staff_permissions")
      .select("id, username, display_name")
      .eq("cafe_id", data.cafe_id)
      .eq("staff_user_id", data.staff_user_id)
      .maybeSingle();
    if (fetchErr) throw new Error(fetchErr.message);
    if (!row) throw new Error("Staff member not found for this café.");

    const pin = await generatePin();
    const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(data.staff_user_id, {
      password: pin,
    });
    if (authErr) throw new Error(authErr.message);

    const { error: updErr } = await supabaseAdmin
      .from("staff_permissions")
      .update({
        must_change_pin: true,
        failed_attempts: 0,
        locked_until: null,
      })
      .eq("cafe_id", data.cafe_id)
      .eq("staff_user_id", data.staff_user_id);
    if (updErr) throw new Error(updErr.message);

    const { writeAudit } = await import("@/lib/audit.server");
    await writeAudit({
      cafeId: data.cafe_id,
      actorId: context.userId,
      action: "staff.pin_reset",
      resourceType: "staff",
      resourceId: data.staff_user_id,
      meta: {
        username: (row as { username?: string | null }).username ?? null,
        display_name: (row as { display_name?: string | null }).display_name ?? null,
      },
      supabase: context.supabase,
    });

    return { ok: true, pin };
  });

export const setStaffActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      cafe_id: z.string().uuid(),
      staff_user_id: z.string().uuid(),
      active: z.boolean(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertCafeOwner(context, data.cafe_id);
    const { hasSupabaseAdminKey, supabaseAdmin } = await import("@/lib/supabase/client.server");
    const hasAdmin = hasSupabaseAdminKey();
    const db = hasAdmin ? supabaseAdmin : context.supabase;

    const { data: row, error: fetchErr } = await db
      .from("staff_permissions")
      .select("id, login_email, username, display_name")
      .eq("cafe_id", data.cafe_id)
      .eq("staff_user_id", data.staff_user_id)
      .maybeSingle();
    if (fetchErr) throw new Error(fetchErr.message);
    if (!row) throw new Error("Staff member not found for this café.");

    const patch: Record<string, unknown> = { is_active: data.active };
    if (data.active) {
      patch.failed_attempts = 0;
      patch.locked_until = null;
    }

    const { error: updErr } = await db
      .from("staff_permissions")
      .update(patch)
      .eq("cafe_id", data.cafe_id)
      .eq("staff_user_id", data.staff_user_id);
    if (updErr) throw new Error(updErr.message);

    // Ban/unban auth user when service-role key is available
    if (hasAdmin) {
      const isPinStaff = Boolean((row as { login_email?: string | null }).login_email);
      let canBanGlobally = isPinStaff;
      if (!canBanGlobally) {
        const [{ count: otherStaffCount }, { count: ownedCount }] = await Promise.all([
          supabaseAdmin
            .from("staff_permissions")
            .select("id", { count: "exact", head: true })
            .eq("staff_user_id", data.staff_user_id)
            .eq("is_active", true),
          supabaseAdmin
            .from("cafes")
            .select("id", { count: "exact", head: true })
            .eq("owner_id", data.staff_user_id),
        ]);
        canBanGlobally = (otherStaffCount ?? 0) === 0 && (ownedCount ?? 0) === 0;
      }
      if (canBanGlobally || data.active) {
        const { error: banErr } = await supabaseAdmin.auth.admin.updateUserById(data.staff_user_id, {
          ban_duration: data.active ? "none" : "876000h",
        });
        if (banErr) throw new Error(banErr.message);
      }
    }

    const { writeAudit } = await import("@/lib/audit.server");
    await writeAudit({
      cafeId: data.cafe_id,
      actorId: context.userId,
      action: data.active ? "staff.activated" : "staff.deactivated",
      resourceType: "staff",
      resourceId: data.staff_user_id,
      meta: {
        username: (row as { username?: string | null }).username ?? null,
        display_name: (row as { display_name?: string | null }).display_name ?? null,
      },
      supabase: context.supabase,
    });

    return { ok: true, is_active: data.active };
  });

export const staffChangePin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => {
    const parsed = z.object({
      new_pin: z.string().regex(/^\d{6}$/, "PIN must be exactly 6 digits."),
    }).safeParse(d);
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message || "PIN must be exactly 6 digits.");
    }
    return parsed.data;
  })
  .handler(async ({ data, context }) => {
    if (isTrivialPin(data.new_pin)) {
      throw new Error("Please choose a stronger PIN (avoid 000000, 123456, 654321, or repeating patterns).");
    }
    const { hasSupabaseAdminKey, supabaseAdmin } = await import("@/lib/supabase/client.server");
    if (!hasSupabaseAdminKey()) {
      throw new Error("Server admin key (SUPABASE_SERVICE_ROLE_KEY) is required to update PIN credentials.");
    }

    const { data: staffRow, error: fetchErr } = await supabaseAdmin
      .from("staff_permissions")
      .select("id, cafe_id, is_active, username, display_name, login_email")
      .eq("staff_user_id", context.userId)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();
    if (fetchErr) throw new Error(fetchErr.message);
    if (!staffRow) throw new Error("No active staff account found.");

    const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(context.userId, {
      password: data.new_pin,
    });
    if (authErr) throw new Error(authErr.message);

    const { error: updErr } = await supabaseAdmin
      .from("staff_permissions")
      .update({
        must_change_pin: false,
        failed_attempts: 0,
        locked_until: null,
      })
      .eq("staff_user_id", context.userId);
    if (updErr) throw new Error(updErr.message);

    // Re-authenticate with the new PIN because admin password updates invalidate prior sessions
    let loginEmail = (staffRow as { login_email?: string | null }).login_email ?? null;
    if (!loginEmail) {
      const { data: authUserRes } = await supabaseAdmin.auth.admin.getUserById(context.userId);
      loginEmail = authUserRes?.user?.email ?? null;
    }

    let access_token: string | null = null;
    let refresh_token: string | null = null;
    if (loginEmail) {
      const { createClient } = await import("@supabase/supabase-js");
      const { SUPABASE_URL, SUPABASE_ANON_KEY } = await import("@/lib/supabase-config");
      const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: freshAuth } = await anon.auth.signInWithPassword({
        email: loginEmail,
        password: data.new_pin,
      });
      access_token = freshAuth.session?.access_token ?? null;
      refresh_token = freshAuth.session?.refresh_token ?? null;
    }

    const { writeAudit } = await import("@/lib/audit.server");
    await writeAudit({
      cafeId: (staffRow as { cafe_id?: string | null }).cafe_id ?? undefined,
      actorId: context.userId,
      action: "staff.pin_changed",
      resourceType: "staff",
      resourceId: context.userId,
      meta: {
        username: (staffRow as { username?: string | null }).username ?? null,
        display_name: (staffRow as { display_name?: string | null }).display_name ?? null,
      },
      supabase: context.supabase,
    });

    return { ok: true, access_token, refresh_token };
  });

export const inviteStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      cafe_id: z.string().uuid(),
      email: z.string().email(),
      permissions: z.array(z.enum(STAFF_PERMS)).default([]),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertCafeOwner(context, data.cafe_id);
    const { hasSupabaseAdminKey, supabaseAdmin } = await import("@/lib/supabase/client.server");
    const hasAdmin = hasSupabaseAdminKey();
    const db = hasAdmin ? supabaseAdmin : context.supabase;
    const { getRequestHeader } = await import("@tanstack/react-start/server");

    const cleanEmail = data.email.trim().toLowerCase();
    const { data: existing } = await db
      .from("profiles").select("id").ilike("email", cleanEmail).maybeSingle();
    let staffId = existing?.id;
    let alreadyRegistered = Boolean(staffId);

    if (!staffId) {
      if (!hasAdmin) {
        throw new Error("Server admin key (SUPABASE_SERVICE_ROLE_KEY) is required to invite unregistered email addresses.");
      }
      const originHeader = getRequestHeader("origin");
      const fwdProto = getRequestHeader("x-forwarded-proto") || "https";
      const fwdHost = getRequestHeader("x-forwarded-host") || getRequestHeader("host");
      const origin = originHeader || (fwdHost ? `${fwdProto}://${fwdHost}` : undefined);
      const redirectTo = origin ? `${origin}/reset-password` : undefined;

      const { data: inv, error: iErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(
        cleanEmail,
        redirectTo ? { redirectTo } : undefined,
      );
      if (iErr) throw new Error(iErr.message);
      staffId = inv.user?.id;
      alreadyRegistered = false;
    }
    if (!staffId) throw new Error("Could not invite");

    const { error: pErr } = await db.from("staff_permissions")
      .upsert(
        {
          cafe_id: data.cafe_id,
          staff_user_id: staffId,
          permissions: data.permissions,
          is_active: true,
          must_change_pin: false,
        },
        { onConflict: "cafe_id,staff_user_id" },
      );
    if (pErr) throw new Error(pErr.message);

    try {
      await db.from("user_roles")
        .upsert({ user_id: staffId, role: "cafe_staff", cafe_id: data.cafe_id }, { onConflict: "user_id,role,cafe_id" });
    } catch { /* non-fatal */ }

    const { writeAudit } = await import("@/lib/audit.server");
    await writeAudit({
      cafeId: data.cafe_id,
      actorId: context.userId,
      action: "staff.added",
      resourceType: "staff",
      resourceId: staffId,
      meta: { email: cleanEmail, permissions: data.permissions },
      supabase: context.supabase,
    });

    return { ok: true, alreadyRegistered };
  });

export const removeStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ cafe_id: z.string().uuid(), staff_user_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertCafeOwner(context, data.cafe_id);
    const { hasSupabaseAdminKey, supabaseAdmin } = await import("@/lib/supabase/client.server");
    const hasAdmin = hasSupabaseAdminKey();
    const db = hasAdmin ? supabaseAdmin : context.supabase;

    const { data: row } = await db
      .from("staff_permissions")
      .select("login_email, username, display_name")
      .eq("cafe_id", data.cafe_id)
      .eq("staff_user_id", data.staff_user_id)
      .maybeSingle();

    const { error: delPermErr } = await db.from("staff_permissions").delete()
      .eq("cafe_id", data.cafe_id).eq("staff_user_id", data.staff_user_id);
    if (delPermErr) throw new Error(delPermErr.message);

    try {
      await db.from("user_roles").delete()
        .eq("cafe_id", data.cafe_id).eq("user_id", data.staff_user_id).eq("role", "cafe_staff");
    } catch { /* non-fatal */ }

    if (hasAdmin && (row as { login_email?: string | null } | null)?.login_email) {
      const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(data.staff_user_id);
      if (delErr) {
        await supabaseAdmin.auth.admin.updateUserById(data.staff_user_id, {
          ban_duration: "876000h",
        }).catch(() => {});
      }
    }

    const { writeAudit } = await import("@/lib/audit.server");
    await writeAudit({
      cafeId: data.cafe_id,
      actorId: context.userId,
      action: "staff.removed",
      resourceType: "staff",
      resourceId: data.staff_user_id,
      meta: {
        username: (row as { username?: string | null } | null)?.username ?? null,
        display_name: (row as { display_name?: string | null } | null)?.display_name ?? null,
      },
      supabase: context.supabase,
    });
    return { ok: true };
  });
