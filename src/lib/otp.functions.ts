import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Email OTP signup verification.
// Everything here runs server-side only: the Resend key and the Supabase
// service-role key never reach the browser.

const OTP_TTL_MS = 5 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_RESENDS = 3;
const MAX_ATTEMPTS = 6;

const FROM = "CoreCade <noreply@verify.corecade.coreegin.com>";

async function sha256(value: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function makeCode() {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
  return n.toString().padStart(6, "0");
}

function template(code: string) {
  return `
<!doctype html><html><body style="margin:0;background:#0b0b12;font-family:system-ui,-apple-system,Segoe UI,sans-serif;padding:28px">
  <div style="max-width:520px;margin:0 auto;background:#141422;border-radius:18px;padding:32px;color:#eaeaf0">
    <div style="font-size:11px;letter-spacing:.28em;color:#e94ea0;text-transform:uppercase">CoreCade</div>
    <h1 style="margin:14px 0 8px;font-size:22px">Verify your email</h1>
    <p style="color:#c9c9d6;line-height:1.6;margin:0 0 20px">Use this code to finish creating your account. It expires in 5 minutes.</p>
    <div style="font-size:34px;letter-spacing:.35em;font-weight:700;background:#0b0b12;border:1px solid #262638;border-radius:14px;padding:18px;text-align:center">${code}</div>
    <p style="color:#7a7a90;font-size:12px;margin-top:20px">Didn't request this? You can safely ignore this email.</p>
  </div>
</body></html>`;
}

async function sendCode(email: string, code: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("Email service is not configured. Please try again later.");
  const { Resend } = await import("resend");
  const resend = new Resend(key);
  const { error } = await resend.emails.send({
    from: FROM,
    to: [email],
    subject: `${code} is your CoreCade verification code`,
    html: template(code),
  });
  if (error) {
    console.error("[otp] resend failed", error);
    throw new Error("Could not send the verification email. Please try again.");
  }
}

async function issue(email: string, resendCount: number) {
  const { supabaseAdmin } = await import("@/lib/supabase/client.server");
  const code = makeCode();
  const code_hash = await sha256(code);
  // One live OTP per email: clear anything older first.
  await supabaseAdmin.from("email_otps").delete().eq("email", email).is("consumed_at", null);
  const { error } = await supabaseAdmin.from("email_otps").insert({
    email,
    code_hash,
    expires_at: new Date(Date.now() + OTP_TTL_MS).toISOString(),
    resend_count: resendCount,
  });
  if (error) throw new Error(error.message);
  await sendCode(email, code);
  return { ok: true as const, expires_in: OTP_TTL_MS / 1000, resends_left: MAX_RESENDS - resendCount };
}

const signupInput = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  full_name: z.string().min(2),
  phone: z.string().nullable().optional(),
});

/** Step 1 — create the (unverified) account and email a 6-digit code. */
export const startSignupOtp = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => signupInput.parse(d))
  .handler(async ({ data }) => {
    const email = data.email.trim().toLowerCase();
    const { supabaseAdmin } = await import("@/lib/supabase/client.server");

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: false,
      user_metadata: { full_name: data.full_name, phone: data.phone ?? null },
    });

    if (error) {
      const msg = error.message ?? "";
      const exists = /already/i.test(msg) || /registered/i.test(msg);
      if (!exists) throw new Error(msg || "Could not create your account.");
      // Existing account: only allow re-verification if it was never confirmed.
      const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
      const match = list?.users?.find((u) => u.email?.toLowerCase() === email);
      if (match?.email_confirmed_at) {
        throw new Error("An account with this email already exists. Please sign in instead.");
      }
      if (match) {
        await supabaseAdmin.auth.admin.updateUserById(match.id, {
          password: data.password,
          user_metadata: { full_name: data.full_name, phone: data.phone ?? null },
        });
      }
    } else if (created?.user && data.phone) {
      await supabaseAdmin.from("profiles").update({ phone: data.phone }).eq("id", created.user.id);
    }

    return issue(email, 0);
  });

/** Step 2 — resend the code (max 3, 60s apart). */
export const resendSignupOtp = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ email: z.string().email() }).parse(d))
  .handler(async ({ data }) => {
    const email = data.email.trim().toLowerCase();
    const { supabaseAdmin } = await import("@/lib/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("email_otps")
      .select("id, created_at, resend_count")
      .eq("email", email)
      .is("consumed_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const count = row?.resend_count ?? 0;
    if (count >= MAX_RESENDS) {
      throw new Error("Resend limit reached. Please start the sign-up again.");
    }
    if (row?.created_at) {
      const waited = Date.now() - new Date(row.created_at).getTime();
      if (waited < RESEND_COOLDOWN_MS) {
        throw new Error(`Please wait ${Math.ceil((RESEND_COOLDOWN_MS - waited) / 1000)}s before requesting a new code.`);
      }
    }
    return issue(email, count + 1);
  });

/** Step 3 — verify the code, confirm the account, burn the OTP. */
export const verifySignupOtp = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ email: z.string().email(), code: z.string().regex(/^\d{6}$/) }).parse(d),
  )
  .handler(async ({ data }) => {
    const email = data.email.trim().toLowerCase();
    const { supabaseAdmin } = await import("@/lib/supabase/client.server");

    const { data: row } = await supabaseAdmin
      .from("email_otps")
      .select("id, code_hash, expires_at, attempts")
      .eq("email", email)
      .is("consumed_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!row) throw new Error("No active code. Please request a new one.");
    if (new Date(row.expires_at).getTime() < Date.now()) {
      await supabaseAdmin.from("email_otps").delete().eq("id", row.id);
      throw new Error("This code has expired. Request a new one.");
    }
    if ((row.attempts ?? 0) >= MAX_ATTEMPTS) {
      await supabaseAdmin.from("email_otps").delete().eq("id", row.id);
      throw new Error("Too many incorrect attempts. Request a new code.");
    }

    const hash = await sha256(data.code);
    if (hash !== row.code_hash) {
      await supabaseAdmin
        .from("email_otps")
        .update({ attempts: (row.attempts ?? 0) + 1 })
        .eq("id", row.id);
      throw new Error("That code is incorrect. Please check and try again.");
    }

    // Correct — confirm the user, then invalidate the code for good.
    const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const user = list?.users?.find((u) => u.email?.toLowerCase() === email);
    if (!user) throw new Error("Account not found. Please sign up again.");
    await supabaseAdmin.auth.admin.updateUserById(user.id, { email_confirm: true });
    await supabaseAdmin.from("email_otps").delete().eq("id", row.id);

    return { ok: true as const };
  });
