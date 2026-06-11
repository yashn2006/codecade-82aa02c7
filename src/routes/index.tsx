import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import {
  Zap, Shield, BarChart3, Users, Cpu, ArrowRight, Check,
  Wifi, Activity, Clock, Sparkles, IndianRupee, Terminal,
} from "lucide-react";
import { AuroraBackground } from "@/components/AuroraBackground";
import { BrandLockup, BrandMark } from "@/components/Brand";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { ConsoleMockup } from "@/components/ConsoleMockup";
import { TerminalContact } from "@/components/TerminalContact";
import { Button } from "@/components/ui/button";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CoreCade — The Operating System for Gaming Cafés" },
      { name: "description", content: "CoreCade powers India's gaming cafés. Live sessions, bookings, memberships, devices — one ridiculously fast platform." },
      { property: "og:title", content: "CoreCade — Powering Gaming Cafés" },
      { property: "og:description", content: "Run your gaming café like a billion-dollar brand." },
    ],
  }),
  component: Landing,
});

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.07, duration: 0.7, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

function Landing() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <Header />
      <Hero />
      <Marquee />
      <Cinematic />
      <Features />
      <Stats />
      <Pricing />
      <Contact />
      <Footer />
    </div>
  );
}


function Header() {
  return (
    <header className="sticky top-0 z-50">
      <div className="mx-auto mt-3 max-w-7xl px-3 sm:px-6">
        <nav className="glass-strong flex items-center justify-between rounded-2xl px-3 py-2.5 sm:px-5">
          <BrandLockup size={32} />
          <div className="hidden gap-7 md:flex">
            {["Features", "Pricing", "Contact"].map((l) => (
              <a key={l} href={`#${l.toLowerCase()}`} className="text-sm text-muted-foreground transition hover:text-foreground">
                {l}
              </a>
            ))}
          </div>
          <Link
            to="/auth"
            className="group inline-flex items-center gap-1.5 rounded-xl bg-foreground px-4 py-2 text-sm font-semibold text-background transition hover:bg-foreground/90"
          >
            Sign in <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
          </Link>
        </nav>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative px-4 pt-16 pb-24 sm:px-6">
      <AuroraBackground intensity="immersive" />

      <div className="relative z-10 mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1.1fr_1fr] lg:gap-8">
        {/* LEFT — typography column */}
        <div>
          <motion.div
            initial="hidden" animate="visible" variants={fadeUp}
            className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/40 px-4 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur"
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
            </span>
            <span>Live in 12 Indian cities · Onboarding cafés daily</span>
          </motion.div>

          <motion.h1
            initial="hidden" animate="visible" custom={1} variants={fadeUp}
            className="mt-6 font-display font-extrabold leading-[0.92] tracking-[-0.045em] text-[3rem] sm:text-[4.5rem] xl:text-[6rem]"
          >
            <span className="block text-foreground/95">The OS that runs</span>
            <span className="relative block">
              <span className="text-gradient-hot">India's arcades.</span>
              <span className="absolute -bottom-1 left-0 h-1 w-[55%] rounded-full bg-gradient-to-r from-primary via-magenta to-transparent blur-[2px]" />
            </span>
          </motion.h1>

          <motion.p
            initial="hidden" animate="visible" custom={2} variants={fadeUp}
            className="mt-6 max-w-xl text-base text-muted-foreground sm:text-lg"
          >
            Live sessions. Per-minute billing. Bookings, memberships, devices, analytics —
            collapsed into one ridiculously fast console you can run from a phone.
          </motion.p>

          <motion.div
            initial="hidden" animate="visible" custom={3} variants={fadeUp}
            className="mt-9 flex flex-wrap items-center gap-3"
          >
            <Link
              to="/auth"
              className="group relative inline-flex items-center gap-2 overflow-hidden rounded-xl px-7 py-3.5 text-sm font-semibold text-primary-foreground glow-violet"
              style={{ background: "var(--gradient-brand-hot)" }}
            >
              <span className="relative z-10">Launch your café</span>
              <ArrowRight className="relative z-10 h-4 w-4 transition group-hover:translate-x-1" />
              <span className="absolute inset-0 -z-0 animate-shimmer" />
            </Link>
            <a
              href="#features"
              className="inline-flex items-center gap-2 rounded-xl border border-border/70 bg-background/40 px-6 py-3.5 text-sm font-semibold backdrop-blur transition hover:border-primary/50 hover:bg-background/60"
            >
              Explore the OS
            </a>
          </motion.div>

          {/* Trust / proof strip */}
          <motion.div
            initial="hidden" animate="visible" custom={4} variants={fadeUp}
            className="mt-10 grid max-w-md grid-cols-3 gap-4 border-t border-border/40 pt-6"
          >
            {[
              { v: "50k+", l: "sessions" },
              { v: "₹2.4 Cr", l: "processed" },
              { v: "99.9%", l: "uptime" },
            ].map((k) => (
              <div key={k.l}>
                <div className="font-display text-2xl font-extrabold text-gradient">{k.v}</div>
                <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{k.l}</div>
              </div>
            ))}
          </motion.div>
        </div>

        {/* RIGHT — 3D console mockup */}
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.4, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          className="relative"
        >
          <ConsoleMockup />
          {/* Floating annotations */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 1.1 }}
            className="absolute -left-2 top-1/3 hidden rounded-full border border-emerald-400/40 bg-emerald-400/10 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-emerald-300 backdrop-blur xl:flex"
          >
            ◉ realtime · 60fps
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 1.3 }}
            className="absolute -right-2 bottom-12 hidden rounded-full border border-fuchsia-400/40 bg-fuchsia-400/10 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-fuchsia-200 backdrop-blur xl:flex"
          >
            ⏵ ₹ per-minute billing
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

function Cinematic() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y1 = useTransform(scrollYProgress, [0, 1], [60, -60]);
  const y2 = useTransform(scrollYProgress, [0, 1], [120, -120]);
  const rot = useTransform(scrollYProgress, [0, 1], [-6, 6]);
  const blur = useTransform(scrollYProgress, [0, 0.5, 1], [8, 0, 8]);
  const filter = useTransform(blur, (b) => `blur(${b}px)`);

  return (
    <section ref={ref} className="relative overflow-hidden py-32">
      <div className="pointer-events-none absolute inset-0 grid-arcade opacity-30" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-magenta/40 to-transparent" />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <motion.div style={{ y: y2 }} className="absolute -left-10 top-10 hidden h-40 w-40 rounded-full bg-violet/30 blur-3xl md:block" />
        <motion.div style={{ y: y1 }} className="absolute -right-10 bottom-10 hidden h-56 w-56 rounded-full bg-magenta/30 blur-3xl md:block" />

        <motion.div style={{ filter, rotate: rot }} className="text-center">
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Chapter 01</div>
          <h2 className="mt-4 font-display text-5xl font-extrabold leading-[0.95] tracking-[-0.04em] sm:text-7xl md:text-[8rem]">
            <span className="block text-foreground/90">Built like</span>
            <span className="block text-gradient-hot">an arcade.</span>
            <span className="block text-foreground/40">Runs like a bank.</span>
          </h2>
          <p className="mx-auto mt-8 max-w-2xl text-muted-foreground sm:text-lg">
            CoreCade is the operating system underneath every PC, console, controller and
            QR-code in your café. One backend. One source of truth. Zero spreadsheets.
          </p>
        </motion.div>

        {/* Marquee accent */}
        <motion.div
          style={{ y: y1 }}
          className="mt-16 flex w-full justify-between font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground"
        >
          {["per-minute billing", "live floor map", "wallet + UPI", "rls secured", "60fps everywhere"].map((t) => (
            <span key={t} className="hidden md:inline">◉ {t}</span>
          ))}
        </motion.div>
      </div>
    </section>
  );
}



function Marquee() {
  const items = [
    "Real-time billing", "Per-minute precision", "UPI checkout", "Razorpay-ready",
    "Multi-branch", "Offline-tolerant", "Mobile-first", "60fps everywhere",
    "RLS-secured", "Made in India",
  ];
  return (
    <section className="relative overflow-hidden border-y border-border/30 bg-background/30 py-6">
      <div className="flex w-max animate-marquee gap-12 whitespace-nowrap">
        {[...items, ...items].map((it, i) => (
          <div key={i} className="flex items-center gap-3 font-mono text-xs uppercase tracking-[0.25em] text-muted-foreground">
            <Sparkles className="h-3 w-3 text-primary" />
            {it}
          </div>
        ))}
      </div>
    </section>
  );
}

function Features() {
  const items = [
    { icon: Zap, title: "Real-time sessions", desc: "Track every PC live. Auto-bill by the minute. Pause, resume, transfer in one tap.", c: "violet" },
    { icon: Cpu, title: "Device manager", desc: "Remote lock, push updates, monitor specs, uptime, health — all from one console.", c: "azure" },
    { icon: Users, title: "Memberships & wallets", desc: "Hour packs, monthly passes, referrals, loyalty. Designed for repeat gamers.", c: "magenta" },
    { icon: BarChart3, title: "Analytics that matter", desc: "Peak hours. Top games. Customer retention. India-first metrics, not vanity charts.", c: "violet" },
    { icon: Shield, title: "Staff permissions", desc: "Granular role control. Owner sees everything. Staff sees only what they need.", c: "azure" },
    { icon: Activity, title: "Mobile portal", desc: "Customers book from their phone. Owners run the floor from theirs. PWA-ready.", c: "magenta" },
  ];
  return (
    <section id="features" className="relative px-4 py-28 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/40 px-3 py-1 text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
            <span className="h-1 w-1 rounded-full bg-primary" /> The Platform
          </div>
          <h2 className="mt-5 font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
            Everything you need.<br /><span className="text-gradient">Nothing you don't.</span>
          </h2>
          <p className="mt-5 text-muted-foreground sm:text-lg">
            Replace 6 apps, 3 spreadsheets, and a WhatsApp group with one beautiful, brutally fast console.
          </p>
        </motion.div>

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((f, i) => (
            <motion.div
              key={f.title}
              initial="hidden" whileInView="visible" viewport={{ once: true }} custom={i} variants={fadeUp}
              className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card/40 p-6 backdrop-blur hover-lift hover:border-primary/40"
            >
              <div
                className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full blur-2xl opacity-0 transition-opacity duration-500 group-hover:opacity-70"
                style={{ background: `oklch(var(--${f.c}) / 0.5)` }}
              />
              <div
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-border/60"
                style={{ background: `oklch(0.15 0.03 285 / 0.7)` }}
              >
                <f.icon className={`h-5 w-5 text-${f.c}`} />
              </div>
              <h3 className="mt-5 font-heading text-xl font-bold tracking-tight">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Stats() {
  const stats = [
    { value: 50000, suffix: "+", label: "Sessions tracked" },
    { value: 24000000, label: "Revenue processed", format: (n: number) => `₹${(n / 10000000).toFixed(1)}Cr` },
    { value: 99.9, label: "Uptime", suffix: "%", format: (n: number) => n.toFixed(1) },
    { value: 50, label: "Real-time latency", prefix: "<", suffix: "ms" },
  ];
  return (
    <section className="relative border-y border-border/40 bg-background/40 px-4 py-20 sm:px-6">
      <div className="absolute inset-0 grid-arcade opacity-30" />
      <div className="relative mx-auto grid max-w-7xl grid-cols-2 gap-10 md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="text-center">
            <div className="font-display text-4xl font-extrabold tracking-tight text-gradient sm:text-5xl">
              <AnimatedNumber value={s.value} prefix={s.prefix} suffix={s.suffix} format={s.format} />
            </div>
            <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Pricing() {
  const plans = [
    { name: "Starter", price: "₹999", devices: "10", features: ["POS basics", "Session tracking", "Email support"] },
    { name: "Pro", price: "₹2,499", devices: "30", features: ["All Starter", "Bookings + memberships", "Analytics dashboard", "Priority support"], featured: true },
    { name: "Enterprise", price: "₹5,999", devices: "100", features: ["All Pro", "Multi-branch", "White-label portal", "Dedicated manager", "API access"] },
  ];
  return (
    <section id="pricing" className="relative px-4 py-28 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="text-center">
          <h2 className="font-display text-4xl font-extrabold tracking-tight sm:text-6xl">
            Pricing for <span className="text-gradient">India.</span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">Pay monthly. Cancel anytime. No setup fees. No surprises.</p>
        </motion.div>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {plans.map((p, i) => (
            <motion.div
              key={p.name}
              initial="hidden" whileInView="visible" viewport={{ once: true }} custom={i} variants={fadeUp}
              className={`relative rounded-3xl p-7 backdrop-blur transition ${
                p.featured
                  ? "border-conic glass-strong glow-violet md:scale-[1.03]"
                  : "border border-border/60 bg-card/40 hover-lift hover:border-primary/40"
              }`}
            >
              {p.featured && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-primary-foreground" style={{ background: "var(--gradient-brand-hot)" }}>
                  Most popular
                </div>
              )}
              <h3 className="font-heading text-2xl font-bold tracking-tight">{p.name}</h3>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="font-display text-5xl font-extrabold tracking-tight">{p.price}</span>
                <span className="text-sm text-muted-foreground">/mo</span>
              </div>
              <div className="mt-1 text-sm text-muted-foreground">Up to {p.devices} devices</div>
              <ul className="mt-6 space-y-3">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                to="/auth"
                className={`mt-8 inline-flex w-full items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold transition ${
                  p.featured
                    ? "text-primary-foreground hover:opacity-90"
                    : "border border-border bg-background/40 hover:bg-background/70"
                }`}
                style={p.featured ? { background: "var(--gradient-brand-hot)" } : undefined}
              >
                Get started
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Contact() {
  return (
    <section id="contact" className="relative px-4 py-28 sm:px-6">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-1/2 h-[480px] w-[480px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl opacity-30" style={{ background: "var(--gradient-brand-hot)" }} />
      </div>
      <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[1fr_1.2fr] lg:gap-16">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-400/5 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.25em] text-emerald-300 backdrop-blur">
            <Terminal className="h-3 w-3" /> direct line · encrypted
          </div>
          <h2 className="mt-5 font-display text-5xl font-extrabold leading-[0.95] tracking-[-0.04em] sm:text-7xl">
            Open a <span className="text-gradient-hot">socket</span> to us.
          </h2>
          <p className="mt-5 max-w-md text-muted-foreground sm:text-lg">
            No forms. No funnels. A live shell straight to the team that builds CoreCade.
            Type, hit <span className="font-mono text-emerald-300">[enter]</span>, then
            <span className="font-mono text-emerald-300"> :send</span> to transmit.
          </p>
          <div className="mt-8 space-y-3 font-mono text-xs">
            <div className="flex items-center gap-3 text-emerald-300">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </span>
              ● connected · Mon–Sat · 10:00–20:00 IST
            </div>
            <div className="text-muted-foreground">↳ avg first reply 4h 12m</div>
            <div className="text-muted-foreground">↳ humans only, no autoresponders</div>
          </div>
        </div>
        <TerminalContact />
      </div>
    </section>
  );
}


function Footer() {
  return (
    <footer className="border-t border-border/40 px-4 py-12 sm:px-6">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 text-sm text-muted-foreground sm:flex-row">
        <div className="flex items-center gap-3">
          <BrandMark size={28} />
          <span className="font-display font-bold">
            <span className="text-foreground">core</span><span className="text-gradient">cade</span>
          </span>
          <span>© {new Date().getFullYear()}</span>
        </div>
        <div className="flex gap-6">
          <a href="#features" className="hover:text-foreground">Features</a>
          <a href="#pricing" className="hover:text-foreground">Pricing</a>
          <a href="#contact" className="hover:text-foreground">Contact</a>
        </div>
        <div className="font-mono text-xs">Made in India 🇮🇳</div>
      </div>
    </footer>
  );
}
