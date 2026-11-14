import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const directSignUp = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      email: z.string().email(),
      password: z.string().min(6),
      fullName: z.string().optional().nullable(),
      phone: z.string().optional().nullable(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/lib/supabase/client.server");
    const cleanEmail = data.email.trim().toLowerCase();
    const cleanName = data.fullName?.trim() || cleanEmail.split("@")[0] || "Customer";
    const cleanPhone = data.phone?.trim() || null;

    let userId: string;

    // 1. Attempt admin creation with email_confirm: true (bypasses email code completely)
    const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: cleanEmail,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        full_name: cleanName,
        phone: cleanPhone,
      },
    });

    if (createErr) {
      // If user already exists in auth.users (e.g. from an earlier attempt stuck awaiting confirmation),
      // auto-confirm them and set their password so they can log in immediately.
      const { data: userList } = await supabaseAdmin.auth.admin.listUsers();
      const match = (userList?.users ?? []).find((u) => u.email?.toLowerCase() === cleanEmail);
      if (match) {
        userId = match.id;
        const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(match.id, {
          email_confirm: true,
          password: data.password,
          user_metadata: {
            full_name: cleanName,
            phone: cleanPhone,
          },
        });
        if (updErr) throw new Error(updErr.message);
      } else {
        throw new Error(createErr.message);
      }
    } else {
      userId = newUser.user.id;
    }

    // 2. Upsert profile in public.profiles
    await supabaseAdmin.from("profiles").upsert(
      {
        id: userId,
        email: cleanEmail,
        full_name: cleanName,
        phone: cleanPhone,
      },
      { onConflict: "id" },
    );

    // 3. Ensure user has default 'customer' role in user_roles
    const { data: existingRoles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    if (!existingRoles || existingRoles.length === 0) {
      await supabaseAdmin.from("user_roles").insert({
        user_id: userId,
        role: "customer",
      });
    }

    return { ok: true, userId, email: cleanEmail };
  });
