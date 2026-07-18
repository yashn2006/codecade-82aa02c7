import { createFileRoute } from "@tanstack/react-router";

/**
 * Cron endpoint: emails owners whose café trial ends in the next 3 days.
 *
 * Schedule via pg_cron:
 *   SELECT cron.schedule(
 *     'trial-emails-daily',
 *     '0 9 * * *',
 *     $$ SELECT net.http_post(
 *          url:='https://project--<id>.lovable.app/api/public/cron/trial-emails',
 *          headers:=jsonb_build_object('x-cron-secret','<SETUP_TOKEN>')
 *        ) $$
 *   );
 */
export const Route = createFileRoute("/api/public/cron/trial-emails")({
  server: {
    handlers: {
      POST: async ({ request }) => handle(request),
      GET: async ({ request }) => handle(request),
    },
  },
});

async function handle(request: Request) {
  const secret = process.env.SETUP_TOKEN || process.env.CRON_SECRET;
  const provided = request.headers.get("x-cron-secret") ?? new URL(request.url).searchParams.get("secret");
  if (!secret || provided !== secret) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { supabaseAdmin } = await import("@/lib/supabase/client.server");
  const now = new Date();
  const in3 = new Date(now.getTime() + 3 * 86_400_000);

  const { data: cafes, error } = await supabaseAdmin
    .from("cafes")
    .select("id, name, owner_id, trial_ends_at, subscription_status")
    .neq("subscription_status", "active")
    .gte("trial_ends_at", now.toISOString())
    .lte("trial_ends_at", in3.toISOString());
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const results: Array<{ cafe: string; sent: boolean; reason?: string }> = [];
  const resendKey = process.env.RESEND_API_KEY;

  for (const c of cafes ?? []) {
    if (!c.owner_id) { results.push({ cafe: c.name, sent: false, reason: "no owner" }); continue; }
    const { data: owner } = await supabaseAdmin
      .from("profiles").select("email, full_name").eq("id", c.owner_id).maybeSingle();
    if (!owner?.email) { results.push({ cafe: c.name, sent: false, reason: "no email" }); continue; }

    const days = Math.max(1, Math.ceil((new Date(c.trial_ends_at!).getTime() - now.getTime()) / 86_400_000));
    const subject = `Your ${c.name} trial ends in ${days} day${days === 1 ? "" : "s"}`;
    const html = `<!doctype html><body style="font-family:system-ui,sans-serif;background:#0b0b12;color:#eaeaf0;padding:24px">
      <div style="max-width:560px;margin:0 auto;background:#141422;border-radius:16px;padding:28px">
        <div style="font-size:12px;letter-spacing:.24em;color:#e94ea0;text-transform:uppercase">CoreCade</div>
        <h1 style="margin:12px 0 16px;font-size:22px">${subject}</h1>
        <p style="line-height:1.6;color:#c9c9d6">Hi ${owner.full_name ?? "there"}, your CoreCade trial for <b>${c.name}</b> ends on <b>${new Date(c.trial_ends_at!).toDateString()}</b>. Upgrade now to keep bookings, POS, wallet and reports running.</p>
        <p><a href="https://corecade.coreegin.com/owner" style="display:inline-block;margin-top:8px;padding:12px 20px;border-radius:10px;background:#e94ea0;color:#fff;text-decoration:none">Renew subscription →</a></p>
      </div></body>`;

    // best-effort log + in-app notification regardless of Resend
    await supabaseAdmin.from("notifications").insert({
      user_id: c.owner_id, cafe_id: c.id, kind: "trial_ending",
      title: subject, body: `Your trial ends ${new Date(c.trial_ends_at!).toDateString()}`, link: "/owner",
    });

    if (!resendKey) {
      await supabaseAdmin.from("email_logs").insert({
        to_email: owner.email, template: "trial_ending", subject, status: "queued",
        provider_response: { skipped: true, reason: "RESEND_API_KEY missing" },
      });
      results.push({ cafe: c.name, sent: false, reason: "no resend key" });
      continue;
    }

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
        body: JSON.stringify({ from: "CoreCade <notify@corecade.in>", to: [owner.email], subject, html }),
      });
      const body = await res.json().catch(() => ({}));
      await supabaseAdmin.from("email_logs").insert({
        to_email: owner.email, template: "trial_ending", subject,
        status: res.ok ? "sent" : "failed", provider_response: body, sent_at: res.ok ? new Date().toISOString() : null,
      });
      results.push({ cafe: c.name, sent: res.ok, reason: res.ok ? undefined : `resend ${res.status}` });
    } catch (e) {
      results.push({ cafe: c.name, sent: false, reason: e instanceof Error ? e.message : "network" });
    }
  }

  return Response.json({ scanned: (cafes ?? []).length, results });
}
