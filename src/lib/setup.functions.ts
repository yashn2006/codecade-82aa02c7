import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import process from "node:process";

/**
 * One-time super-admin bootstrap.
 *
 * SECURITY: This endpoint is UNAUTHENTICATED by design — you can't require
 * auth before any user exists. To prevent abuse it enforces THREE gates:
 *   1. A setup token (SETUP_TOKEN env var) must be supplied and match.
 *   2. No `super_admin` role may already exist in `user_roles`.
 *   3. Password + email are supplied by the caller (no hardcoded creds).
 *
 * After the first super-admin is created, this endpoint is permanently
 * disabled (gate #2 always fails). To rotate credentials, do it in the
 * Supabase Auth dashboard — not through this endpoint.
 */
export const seedSuperAdmin = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      email: z.string().email(),
      password: z.string().min(12, "Password must be at least 12 characters"),
      token: z.string().min(1, "Setup token required"),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const expected = process.env.SETUP_TOKEN;
    if (!expected) {
      throw new Error(
        "SETUP_TOKEN is not configured on the server. Set it as a secret before running setup.",
      );
    }
    if (data.token !== expected) {
      throw new Error("Invalid setup token.");
    }

    const { supabaseAdmin } = await import("@/lib/supabase/client.server");

    // Gate: only allow when there is no super_admin yet.
    const { count, error: countErr } = await supabaseAdmin
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("role", "super_admin");
    if (countErr) throw new Error(countErr.message);
    if ((count ?? 0) > 0) {
      throw new Error("Setup is disabled: a super_admin already exists.");
    }

    // Create or find the auth user.
    let userId: string | null = null;
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: "CoreCade Super Admin" },
    });
    if (createErr) {
      const { data: list } = await supabaseAdmin.auth.admin.listUsers();
      const existing = list.users.find((u) => u.email === data.email);
      if (!existing) throw new Error(createErr.message);
      userId = existing.id;
    } else {
      userId = created.user?.id ?? null;
    }
    if (!userId) throw new Error("Could not resolve super admin user id");

    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role: "super_admin" }, { onConflict: "user_id,role,cafe_id" });
    if (roleErr) throw new Error(roleErr.message);

    return { ok: true, email: data.email, userId };
  });
