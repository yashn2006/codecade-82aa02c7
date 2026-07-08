import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  Gamepad2, CalendarRange, Wallet, Users, Trophy, BarChart3, Store, ShieldCheck,
  Smartphone, QrCode, Bell, Zap, Layers, Clock, CreditCard, Boxes, MessageCircle, Star,
} from "lucide-react";

export const Route = createFileRoute("/features")({
  head: () => ({
    meta: [
      { title: "Features — CoreCade" },
      { name: "description", content: "Every tool India's gaming cafés and players get with CoreCade — sessions, bookings, POS, tournaments, wallets and more." },
      { property: "og:title", content: "Features — CoreCade" },
      { property: "og:description", content: "Sessions, bookings, POS, tournaments, wallets — the full CoreCade toolkit." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FeaturesPage,
});

const fade = {
  hidden: { opacity: 0, y: 16 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.5, delay: i * 0.04, ease: [0.22, 1, 0.36, 1] as const } }),
};

const ownerFeatures = [
  { icon: Gamepad2, title: "Live device console", desc: "PCs, consoles, VR — start/stop sessions in one tap." },
  { icon: CalendarRange, title: "Bookings & reservations", desc: "Owner + customer booking with deposits & auto-refunds." },
  { icon: Store, title: "POS & inventory", desc: "Sell snacks, drinks, gear — receipts printed or shared." },
  { icon: Users, title: "Memberships", desc: "Prepaid hours, tiered discounts, auto-renewals." },
  { icon: Trophy, title: "Tournaments", desc: "Brackets, entry fees, prize pools, live leaderboards." },
  { icon: BarChart3, title: "Analytics dashboard", desc: "Revenue, sessions, peak hours, top devices — daily." },
  { icon: Wallet, title: "Wallet & ledger", desc: "Customer wallets, top-ups, refunds — every rupee traced." },
  { icon: CreditCard, title: "UPI + card payments", desc: "Accept Razorpay, UPI QR, cash — reconciled automatically." },
  { icon: Boxes, title: "Multi-branch (add-on)", desc: "Manage many cafés from one owner dashboard." },
  { icon: ShieldCheck, title: "Staff roles", desc: "Scoped logins — cashier, floor, manager, owner." },
  { icon: Bell, title: "Alerts & audit", desc: "Session-end pings, no-show flags, full audit trail." },
  { icon: Clock, title: "Auto-extend & end-early", desc: "One-tap +15/+30 min, or end early with pro-rated refund." },
];

const playerFeatures = [
  { icon: Smartphone, title: "Mobile-first portal", desc: "Book, pay and check wallet from your phone." },
  { icon: QrCode, title: "UPI QR checkout", desc: "Scan · pay · play — no fumbling with cards." },
  { icon: Star, title: "Loyalty rewards", desc: "Earn points every session, redeem for hours." },
  { icon: MessageCircle, title: "In-app messaging", desc: "Talk to the café, get session reminders." },
  { icon: Zap, title: "Instant re-booking", desc: "Repeat your last booking in one tap." },
  { icon: Layers, title: "Session history", desc: "Every visit, every payment, always in your pocket." },
];

function FeaturesPage() {
  return (
    <main className="relative min-h-screen bg-background">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] bg-[radial-gradient(circle_at_50%_0%,oklch(0.6_0.22_295/0.25),transparent_60%)]" />
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28">
        <div className="text-center">
          <Link to="/" className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground hover:text-foreground">← Back home</Link>
          <motion.h1 initial="hidden" animate="visible" variants={fade} className="mt-4 font-display text-5xl font-extrabold tracking-tight sm:text-7xl">
            Everything you get, <span className="text-gradient">in one price.</span>
          </motion.h1>
          <motion.p initial="hidden" animate="visible" variants={fade} custom={1} className="mx-auto mt-5 max-w-2xl text-muted-foreground sm:text-lg">
            CoreCade ships every tool your café — and every gamer — needs. No hidden add-ons.
          </motion.p>
        </div>

        <Section title="For Café Owners & Staff" subtitle="Run the floor like a pro." items={ownerFeatures} />
        <Section title="For Gamers & Members" subtitle="A portal that feels like an app store, not a form." items={playerFeatures} />

        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fade} className="mt-20 rounded-3xl border border-border/60 bg-card/40 p-10 text-center backdrop-blur">
          <h3 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">Start free. Launch tomorrow.</h3>
          <p className="mt-3 text-muted-foreground">14-day trial · no card · full access.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link to="/auth" className="rounded-xl px-5 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90" style={{ background: "var(--gradient-brand-hot)" }}>
              Get started — ₹999/mo
            </Link>
            <Link to="/" className="rounded-xl border border-border bg-background/40 px-5 py-3 text-sm font-semibold hover:bg-background/70">
              Back to home
            </Link>
          </div>
        </motion.div>
      </div>
    </main>
  );
}

function Section({ title, subtitle, items }: { title: string; subtitle: string; items: { icon: React.ComponentType<{ className?: string }>; title: string; desc: string }[] }) {
  return (
    <section className="mt-20">
      <div className="mb-8">
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary/80">{subtitle}</div>
        <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">{title}</h2>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((f, i) => (
          <motion.div
            key={f.title}
            initial="hidden" whileInView="visible" viewport={{ once: true }} custom={i} variants={fade}
            className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card/40 p-6 transition hover:-translate-y-1 hover:border-primary/40 hover:shadow-[0_10px_40px_-10px_oklch(0.6_0.22_295/0.35)]"
          >
            <div className="absolute inset-0 -z-10 opacity-0 transition group-hover:opacity-100" style={{ background: "radial-gradient(circle at 30% 0%, oklch(0.6 0.22 295 / 0.15), transparent 60%)" }} />
            <f.icon className="h-6 w-6 text-primary" />
            <h3 className="mt-4 font-heading text-lg font-bold">{f.title}</h3>
            <p className="mt-1.5 text-sm text-muted-foreground">{f.desc}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
