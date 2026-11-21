import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const ATTEMPT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS_PER_IP = 20;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes
const MAX_FAILED_ATTEMPTS = 5;

const ipAttempts = new Map<string, number[]>();

function checkAndRecordIpAttempt(ip: string): boolean {
  const now = Date.now();
  const cutoff = now - ATTEMPT_WINDOW_MS;

  if (ipAttempts.size > 2000) {
    for (const [key, times] of ipAttempts.entries()) {
      const fresh = times.filter((t) => t > cutoff);
      if (fresh.length === 0) ipAttempts.delete(key);
      else ipAttempts.set(key, fresh);
    }
  }

  const recent = (ipAttempts.get(ip) ?? []).filter((t) => t > cutoff);
  if (recent.length >= MAX_ATTEMPTS_PER_IP) {
    ipAttempts.set(ip, recent);
    return false;
  }
  recent.push(now);
  ipAttempts.set(ip, recent);
  return true;
}

const GENERIC_ERR = "Invalid café code, username or PIN";

export const staffLogin = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      cafe_code: z.string().trim().min(1).max(16),
      username: z.string().trim().min(1).max(40),
      pin: z.string().regex(/^\d{6}$/, GENERIC_ERR),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { getRequestHeader } = await import("@tanstack/react-start/server");
    const { createClient } = await import("@supabase/supabase-js");
    const { SUPABASE_URL, SUPABASE_ANON_KEY } = await import("@/lib/supabase-config");
    const { supabaseAdmin } = await import("@/lib/supabase/client.server");

    const forwardedFor = getRequestHeader("x-forwarded-for");
    const clientIp =
      getRequestHeader("cf-connecting-ip") ||
      (forwardedFor ? forwardedFor.split(",")[0]?.trim() : null) ||
      getRequestHeader("x-real-ip") ||
      "unknown";

    if (!checkAndRecordIpAttempt(clientIp)) {
      throw new Error("Too many login attempts from this network. Please wait 10 minutes and try again.");
    }

    const cafeCode = data.cafe_code.trim().toUpperCase();
    const username = data.username.trim().toLowerCase();

    const { data: cafe, error: cafeErr } = await supabaseAdmin
      .from("cafes")
      .select("id, slug, name")
      .eq("staff_code", cafeCode)
      .maybeSingle();

    if (cafeErr || !cafe) {
      throw new Error(GENERIC_ERR);
    }

    const { data: staff, error: staffErr } = await supabaseAdmin
      .from("staff_permissions")
      .select(
        "id, staff_user_id, username, display_name, login_email, must_change_pin, failed_attempts, locked_until, is_active",
      )
      .eq("cafe_id", cafe.id)
      .eq("username", username)
      .maybeSingle();

    if (staffErr || !staff || !staff.login_email) {
      throw new Error(GENERIC_ERR);
    }

    if (!staff.is_active) {
      throw new Error("This staff account is deactivated. Contact your café owner.");
    }

    if (staff.locked_until && new Date(staff.locked_until).getTime() > Date.now()) {
      throw new Error("Account temporarily locked after too many wrong PINs. Try again in 15 minutes or ask your owner to reset your PIN.");
    }

    const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: authData, error: authErr } = await anon.auth.signInWithPassword({
      email: staff.login_email,
      password: data.pin,
    });

    if (authErr || !authData.session) {
      const nextAttempts = (staff.failed_attempts ?? 0) + 1;
      const shouldLock = nextAttempts >= MAX_FAILED_ATTEMPTS;
      const lockedUntil = shouldLock ? new Date(Date.now() + LOCKOUT_MS).toISOString() : null;

      await supabaseAdmin
        .from("staff_permissions")
        .update({
          failed_attempts: nextAttempts,
          ...(shouldLock ? { locked_until: lockedUntil } : {}),
        })
        .eq("id", staff.id);

      if (shouldLock) {
        const { writeAudit } = await import("@/lib/audit.server");
        await writeAudit({
          cafeId: cafe.id,
          actorId: staff.staff_user_id,
          action: "staff.login_failed_locked",
          resourceType: "staff",
          resourceId: staff.staff_user_id,
          meta: {
            username: staff.username,
            display_name: staff.display_name,
            failed_attempts: nextAttempts,
            locked_until: lockedUntil,
          },
        });
      }

      throw new Error(GENERIC_ERR);
    }

    await supabaseAdmin
      .from("staff_permissions")
      .update({
        failed_attempts: 0,
        locked_until: null,
        last_seen_at: new Date().toISOString(),
      })
      .eq("id", staff.id);

    const { writeAudit } = await import("@/lib/audit.server");
    await writeAudit({
      cafeId: cafe.id,
      actorId: staff.staff_user_id,
      action: "staff.login",
      resourceType: "staff",
      resourceId: staff.staff_user_id,
      meta: {
        username: staff.username,
        display_name: staff.display_name,
      },
    });

    return {
      access_token: authData.session.access_token,
      refresh_token: authData.session.refresh_token,
      must_change_pin: Boolean(staff.must_change_pin),
      slug: cafe.slug as string,
      cafe_id: cafe.id as string,
      cafe_name: cafe.name as string,
    };
  });
