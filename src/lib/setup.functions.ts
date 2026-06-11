import { createServerFn } from "@tanstack/react-start";

const SUPER_ADMIN_EMAIL = "giganexa2026@gmail.com";
const SUPER_ADMIN_PASSWORD = "giganexa2026saadyashstartup";

export const seedSuperAdmin = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/lib/supabase/client.server");

  // Try to create the user. If already exists, fetch it.
  let userId: string | null = null;
  const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
    email: SUPER_ADMIN_EMAIL,
    password: SUPER_ADMIN_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: "CoreCade Super Admin" },
  });

  if (createErr) {
    // Likely "already registered" — look it up by listing
    const { data: list } = await supabaseAdmin.auth.admin.listUsers();
    const existing = list.users.find((u) => u.email === SUPER_ADMIN_EMAIL);
    if (!existing) {
      throw new Error(`Failed to create or find super admin: ${createErr.message}`);
    }
    userId = existing.id;
  } else {
    userId = created.user?.id ?? null;
  }

  if (!userId) throw new Error("Could not resolve super admin user id");

  // Upsert super_admin role
  const { error: roleErr } = await supabaseAdmin
    .from("user_roles")
    .upsert({ user_id: userId, role: "super_admin" }, { onConflict: "user_id,role,cafe_id" });

  if (roleErr) throw new Error(`Failed to grant super_admin role: ${roleErr.message}`);

  return { ok: true, email: SUPER_ADMIN_EMAIL, userId };
});
