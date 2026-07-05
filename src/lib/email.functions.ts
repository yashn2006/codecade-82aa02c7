import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const FROM = "CoreCade <notify@corecade.in>";

async function sendViaResend(to: string, subject: string, html: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn("[email] RESEND_API_KEY not set — skipping send", { to, subject });
    return { skipped: true as const };
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({ from: FROM, to: [to], subject, html }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error("[email] resend failed", res.status, body);
    throw new Error(`Resend ${res.status}`);
  }
  return { skipped: false as const, id: (await res.json()).id as string };
}

const wrap = (title: string, body: string) => `
<!doctype html><html><body style="font-family:system-ui,sans-serif;background:#0b0b12;color:#eaeaf0;padding:24px">
  <div style="max-width:560px;margin:0 auto;background:#141422;border-radius:16px;padding:28px">
    <div style="font-size:12px;letter-spacing:.24em;color:#e94ea0;text-transform:uppercase">CoreCade</div>
    <h1 style="margin:12px 0 16px;font-size:22px">${title}</h1>
    <div style="line-height:1.6;color:#c9c9d6">${body}</div>
    <hr style="border:0;border-top:1px solid #262638;margin:24px 0"/>
    <div style="font-size:11px;color:#7a7a90">CoreCade Technologies · Bengaluru, India</div>
  </div>
</body></html>`;

export const sendWelcomeEmail = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ email: z.string().email(), name: z.string().min(1) }).parse(d))
  .handler(async ({ data }) =>
    sendViaResend(
      data.email,
      "Welcome to CoreCade 🎮",
      wrap(`Hey ${data.name}, welcome!`, `<p>Your account is ready. Set up your first café from the owner dashboard and start booking sessions in minutes.</p><p><a href="https://corecade.coreegin.com/owner" style="color:#e94ea0">Open dashboard →</a></p>`),
    ),
  );

export const sendTrialExpiring = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ email: z.string().email(), cafeName: z.string(), daysLeft: z.number().int() }).parse(d))
  .handler(async ({ data }) =>
    sendViaResend(
      data.email,
      `Your ${data.cafeName} trial ends in ${data.daysLeft} day(s)`,
      wrap("Trial ending soon", `<p><b>${data.cafeName}</b> has <b>${data.daysLeft}</b> day(s) left on the free trial.</p><p>Upgrade now to avoid losing access to bookings, POS and reports.</p>`),
    ),
  );

export const sendInvoice = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ email: z.string().email(), cafeName: z.string(), amount: z.number() }).parse(d))
  .handler(async ({ data }) =>
    sendViaResend(
      data.email,
      `Invoice — ${data.cafeName}`,
      wrap("Payment received", `<p>We received your payment of <b>₹${data.amount.toFixed(2)}</b> for <b>${data.cafeName}</b>.</p><p>Your invoice is available in the billing section of your dashboard.</p>`),
    ),
  );

export const sendStaffInvite = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ email: z.string().email(), cafeName: z.string(), inviteLink: z.string().url() }).parse(d))
  .handler(async ({ data }) =>
    sendViaResend(
      data.email,
      `You're invited to ${data.cafeName} on CoreCade`,
      wrap("Staff invitation", `<p>You've been invited to join <b>${data.cafeName}</b>.</p><p><a href="${data.inviteLink}" style="color:#e94ea0">Accept invitation →</a></p>`),
    ),
  );
