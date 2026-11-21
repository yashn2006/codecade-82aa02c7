import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Gamepad2, CalendarRange, Wallet, Users, Trophy, BarChart3, Store, ShieldCheck,
  Smartphone, QrCode, Bell, Zap, Layers, Clock, CreditCard, Boxes, MessageCircle, Star, ArrowRight,
  Menu, X,
} from "lucide-react";
import { BrandLockup, BrandShowcase } from "@/components/Brand";

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
  hidden: { opacity: 0, y: 14 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.4, delay: Math.min(i * 0.03, 0.25), ease: [0.22, 1, 0.36, 1] as const } }),
};

const ownerFeatures = [
  { icon: Gamepad2, title: "Live device console", desc: "PCs, consoles, VR — start/stop sessions in one tap." },
  { icon: CalendarRange, title: "Bookings & reservations", desc: "Owner + customer booking with deposits & auto-refunds." },
  { icon: Store, title: "POS & inventory", desc: "Sell snacks, drinks, gear — receipts printed or shared." },
  { icon: Users, title: "Memberships", desc: "Prepaid hours, tiered discounts, auto-renewals." },
  { icon: Trophy, title: "Tournaments", desc: "Brackets, entry fees, prize pools, live leaderboards." },
  { icon: BarChart3, title: "Analytics dashboard", desc: "Revenue, sessions, peak hours, top devices — daily." },
  { icon: Wallet, title: "Customer wallets", desc: "Prepaid wallets, verified UPI top-ups & refunds — every rupee traced." },
  { icon: CreditCard, title: "UPI QR verification", desc: "Accept direct café UPI QR payments with UTR verification and instant ledger sync." },
  { icon: Boxes, title: "Multi-branch", desc: "Manage multiple arenas cleanly from one owner command hub." },
  { icon: ShieldCheck, title: "Staff roles", desc: "Scoped logins — cashier, floor, manager, owner." },
  { icon: Bell, title: "Alerts & audit", desc: "Session-end pings, support tickets, full audit trail." },
  { icon: Clock, title: "Auto-extend & end-early", desc: "One-tap +15/+30 min, or end early with pro-rated refund." },
];

const playerFeatures = [
  { icon: Smartphone, title: "Mobile-first portal", desc: "Book, pay and check wallet from your phone." },
  { icon: QrCode, title: "UPI QR checkout", desc: "Scan · pay · play — fast counter or wallet top-ups." },
  { icon: Star, title: "Loyalty rewards", desc: "Earn XP every session and level up your gamer tier." },
  { icon: MessageCircle, title: "In-app booking support", desc: "Message your café directly on any booking with real-time chat." },
  { icon: Zap, title: "Instant re-booking", desc: "Lock your favourite RTX rig or PS5 seat in seconds." },
  { icon: Layers, title: "Session history", desc: "Every visit, pass and wallet movement always in your pocket." },
];

function FeaturesPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileMenuOpen]);

  return (
    <div className="relative min-h-dvh overflow-x-clip bg-background">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[560px] bg-[radial-gradient(circle_at_50%_0%,oklch(0.6_0.24_315/0.25),transparent_65%)]" />

      {/* Sticky Top Glass Header */}
      <header
        className="mobile-keep-blur sticky top-0 z-40 border-b border-white/[0.08] bg-background/80 backdrop-blur-xl"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-3.5 py-2.5 sm:px-6 sm:py-3">
          <BrandLockup size={28} badge="Platform" to="/" />
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
            <Link
              to="/discover"
              className="hidden min-h-[42px] items-center rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2 text-xs font-semibold text-white/85 transition hover:border-white/25 hover:text-white sm:inline-flex"
            >
              Discover Arenas
            </Link>
            <Link
              to="/auth"
              className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold text-white shadow-lg transition hover:opacity-95 sm:px-4"
              style={{ background: "var(--gradient-brand-hot)" }}
            >
              Get Started <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/15 bg-white/[0.06] text-foreground transition active:scale-95 sm:hidden"
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {mobileMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-30 bg-black/45 sm:hidden"
                onClick={() => setMobileMenuOpen(false)}
                aria-hidden
              />
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.14 }}
                className="mobile-keep-blur relative z-40 border-t border-white/10 bg-[#0d091d]/95 px-4 py-3 backdrop-blur-2xl sm:hidden"
              >
                <div className="grid grid-cols-2 gap-2">
                  <Link
                    to="/"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex min-h-[44px] items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-3.5 text-sm font-medium text-white"
                  >
                    <span>Home</span>
                    <ArrowRight className="h-3.5 w-3.5 text-primary" />
                  </Link>
                  <Link
                    to="/discover"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex min-h-[44px] items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-3.5 text-sm font-medium text-white"
                  >
                    <span>Arenas</span>
                    <ArrowRight className="h-3.5 w-3.5 text-primary" />
                  </Link>
                  <Link
                    to="/auth"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex min-h-[44px] items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-3.5 text-sm font-medium text-white"
                  >
                    <span>Sign in</span>
                    <ArrowRight className="h-3.5 w-3.5 text-primary" />
                  </Link>
                  <Link
                    to="/staff-login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex min-h-[44px] items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-3.5 text-sm font-medium text-white"
                  >
                    <span>Staff PIN</span>
                    <ArrowRight className="h-3.5 w-3.5 text-primary" />
                  </Link>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20">
        <div className="text-center">
          <div className="mx-auto mb-6 max-w-[230px]">
            <BrandShowcase compact className="aspect-[16/9]" />
          </div>
          <motion.h1 initial="hidden" animate="visible" variants={fade} className="font-display text-4xl font-extrabold tracking-tight sm:text-6xl lg:text-7xl">
            Everything you get, <span className="text-gradient-hot">in one price.</span>
          </motion.h1>
          <motion.p initial="hidden" animate="visible" variants={fade} custom={1} className="mx-auto mt-5 max-w-2xl text-[15px] text-muted-foreground sm:text-lg">
            CoreCade ships every tool your café — and every gamer — needs. Built for 60fps desktop & mobile consoles.
          </motion.p>
        </div>

        <Section title="For Café Owners & Staff" subtitle="Run the floor like a pro" items={ownerFeatures} />
        <Section title="For Gamers & Members" subtitle="A portal built like a flagship esports app" items={playerFeatures} />

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fade}
          className="relative mt-20 overflow-hidden rounded-3xl border border-white/15 bg-card/55 p-8 text-center shadow-2xl backdrop-blur-xl sm:p-12"
        >
          <div
            className="pointer-events-none absolute -top-24 left-1/2 h-48 w-96 -translate-x-1/2 rounded-full opacity-40 blur-3xl"
            style={{ background: "var(--gradient-brand-hot)" }}
            aria-hidden
          />
          <h3 className="relative font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
            Start free. Launch tomorrow.
          </h3>
          <p className="relative mt-3 text-sm text-muted-foreground sm:text-base">
            15-day free trial · no card required · full arena toolkit.
          </p>
          <div className="relative mt-6 flex flex-col justify-center gap-3 sm:flex-row sm:flex-wrap">
            <Link
              to="/auth"
              className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white shadow-lg hover:opacity-95"
              style={{ background: "var(--gradient-brand-hot)" }}
            >
              Get started — ₹999/mo <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/"
              className="inline-flex min-h-[46px] items-center justify-center rounded-xl border border-white/15 bg-white/[0.04] px-6 py-3 text-sm font-semibold text-white/90 hover:bg-white/[0.08]"
            >
              Back to home
            </Link>
          </div>
        </motion.div>
      </main>
    </div>
  );
}

function Section({ title, subtitle, items }: { title: string; subtitle: string; items: { icon: React.ComponentType<{ className?: string }>; title: string; desc: string }[] }) {
  return (
    <section className="mt-16 sm:mt-20">
      <div className="mb-7">
        <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-primary">{subtitle}</div>
        <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">{title}</h2>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((f, i) => (
          <motion.div
            key={f.title}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            custom={i}
            variants={fade}
            className="group relative overflow-hidden rounded-2xl border border-white/10 bg-card/45 p-6 backdrop-blur transition hover:-translate-y-1 hover:border-primary/45 hover:shadow-[0_14px_40px_-12px_oklch(0.65_0.25_315/0.4)]"
          >
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-primary/25 bg-primary/12 text-primary">
              <f.icon className="h-5 w-5" />
            </div>
            <h3 className="mt-4 font-heading text-lg font-bold text-white">{f.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
