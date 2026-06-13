import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import {
  LifeBuoy, LayoutDashboard, Rocket, Wallet, ShieldCheck,
  Mail, Bell, ChevronDown, BookOpen,
} from "lucide-react";
import { ConsoleShell } from "@/components/ConsoleShell";
import { SupportTickets } from "@/components/SupportTickets";
import { supabase } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/owner/help")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Help Center — CoreCade Owner" },
      { name: "description", content: "Quick answers, support tickets and a direct line to the CoreCade team." },
    ],
  }),
  beforeLoad: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/auth" });
    const { data: roles } = await supabase
      .from("user_roles").select("role").eq("user_id", user.id)
      .in("role", ["cafe_owner", "super_admin"]);
    if (!roles || roles.length === 0) throw redirect({ to: "/portal" });
  },
  component: OwnerHelp,
});

const FAQS: { q: string; a: string }[] = [
  {
    q: "How do I add a new device or seat?",
    a: "Open your café console → Devices → New device. Set a name, type (PC / console / VR), hourly rate and station number. It goes live on the floor instantly.",
  },
  {
    q: "Where do I view my revenue?",
    a: "Café console → Analytics shows revenue by day, top games and customers. The Wallet and Ledger tabs show payouts and every credit/debit.",
  },
  {
    q: "How do refunds and cancellations work?",
    a: "Owners can cancel a pending booking from the Bookings tab — the deposit is automatically refunded to the customer's wallet. Razorpay refunds settle to the original method in 5–7 working days.",
  },
  {
    q: "Can I add staff to my café?",
    a: "Café console → Staff → Invite. Each staff member gets a scoped login that can run POS, start sessions and check bookings — but cannot change rates or payouts.",
  },
  {
    q: "How is loyalty / wallet credit calculated?",
    a: "Every paid session and POS order adds points based on the rate you set in Memberships. Points convert to wallet credit at checkout — fully configurable per café.",
  },
  {
    q: "What does the welcome notification mean?",
    a: "When you create a new café, we drop a welcome notification in your bell with a link straight to this Help Center. That's your launch checklist starting point.",
  },
];

function OwnerHelp() {
  return (
    <ConsoleShell
      badge="Help"
      title="Help Center"
      subtitle="Quick answers, a direct line to support, and your ticket history — all in one place."
      nav={[
        { label: "Owner Hub", icon: LayoutDashboard, to: "/owner", exact: true },
        { label: "Help Center", icon: LifeBuoy, to: "/owner/help", exact: true },
      ]}
    >
      {/* Hero */}
      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative mb-8 overflow-hidden rounded-3xl border border-border/60 bg-card/40 p-8 backdrop-blur"
      >
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full opacity-60 blur-[90px]"
          style={{ background: "radial-gradient(circle, oklch(0.7 0.26 335 / 0.55), transparent 70%)" }}
        />
        <LifeBuoy
          className="pointer-events-none absolute -right-6 bottom-[-30px] h-56 w-56 text-primary/10"
          aria-hidden
        />
        <div className="relative max-w-2xl">
          <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-primary">Help Center</div>
          <h1 className="mt-2 font-display text-5xl font-extrabold tracking-tight">
            We've got your <span className="text-gradient-hot">back</span>.
          </h1>
          <p className="mt-3 max-w-xl text-muted-foreground">
            Quick answers below. Still stuck? Open a ticket and the CoreCade team takes it from there — typically inside 4 hours.
          </p>
        </div>
      </motion.section>

      {/* Pillars */}
      <div className="mb-10 grid gap-4 md:grid-cols-3">
        <Pillar icon={Rocket}      title="Getting started"
                body="Add seats → set rates → take your first booking. About 5 minutes end-to-end." accent="oklch(0.74 0.21 15)" />
        <Pillar icon={Wallet}      title="Payments & refunds"
                body="₹10 advance locks a seat. Refunds adjust your wallet and customer balance live." accent="oklch(0.7 0.26 335)" />
        <Pillar icon={ShieldCheck} title="Security & access"
                body="Role-based access, Row-Level-Security in Postgres, daily backups baked in." accent="oklch(0.78 0.18 200)" />
      </div>

      {/* FAQ */}
      <section className="mb-10">
        <div className="mb-3 flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-primary" />
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Frequently asked</div>
        </div>
        <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/40 backdrop-blur">
          {FAQS.map((f, i) => <FaqRow key={i} q={f.q} a={f.a} />)}
        </div>
      </section>

      {/* Tickets */}
      <SupportTickets role="owner" />

      {/* Escape hatch */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-10 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border/60 bg-card/40 p-5 backdrop-blur"
      >
        <div>
          <div className="font-display text-lg font-bold">Still stuck?</div>
          <div className="text-sm text-muted-foreground">Drop us a line — we typically reply in under 4 hours.</div>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="mailto:support@corecade.app"
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-primary-foreground"
            style={{ background: "var(--gradient-brand-hot)" }}
          >
            <Mail className="h-4 w-4" /> Email support
          </a>
          <Link
            to="/owner"
            className="inline-flex items-center gap-2 rounded-xl border border-border/60 bg-background/50 px-4 py-2 text-sm font-semibold hover:bg-background"
          >
            <Bell className="h-4 w-4" /> Back to dashboard
          </Link>
        </div>
      </motion.section>
    </ConsoleShell>
  );
}

function Pillar({ icon: Icon, title, body, accent }: {
  icon: typeof Rocket; title: string; body: string; accent: string;
}) {
  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 280, damping: 20 }}
      className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card/40 p-5 backdrop-blur"
    >
      <span
        className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-40 blur-2xl transition group-hover:opacity-70"
        style={{ background: `radial-gradient(circle, ${accent}, transparent 70%)` }}
        aria-hidden
      />
      <Icon className="relative h-6 w-6 text-foreground" />
      <div className="relative mt-3 font-display text-lg font-bold">{title}</div>
      <div className="relative mt-1 text-sm text-muted-foreground">{body}</div>
    </motion.div>
  );
}

function FaqRow({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border/40 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left transition hover:bg-white/5"
      >
        <span className="font-display text-sm font-semibold text-foreground">{q}</span>
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition", open && "rotate-180 text-primary")} />
      </button>
      <motion.div
        initial={false}
        animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }}
        transition={{ duration: 0.2 }}
        className="overflow-hidden"
      >
        <div className="px-4 pb-4 text-sm text-muted-foreground">{a}</div>
      </motion.div>
    </div>
  );
}
