import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Gamepad2, Zap, Shield, BarChart3, Users, Sparkles, ArrowRight, Check } from "lucide-react";
import { ParticleField } from "@/components/ParticleField";
import { submitContact } from "@/lib/contact.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Giganexa — The Gaming Café OS" },
      {
        name: "description",
        content:
          "All-in-one platform for India's gaming cafés. Live sessions, bookings, memberships, devices — engineered for speed.",
      },
      { property: "og:title", content: "Giganexa — The Gaming Café OS" },
      {
        property: "og:description",
        content: "Run your gaming café like a billion-dollar brand.",
      },
    ],
  }),
  component: Landing,
});

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

function Landing() {
  return (
    <div className="min-h-screen overflow-hidden">
      <Header />
      <Hero />
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
    <header className="sticky top-0 z-50 glass border-b border-border/40">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-cyan to-magenta glow-cyan">
            <Gamepad2 className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-display text-xl font-bold tracking-wider">GIGANEXA</span>
        </Link>
        <div className="hidden gap-8 md:flex">
          <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition">Features</a>
          <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition">Pricing</a>
          <a href="#contact" className="text-sm text-muted-foreground hover:text-foreground transition">Contact</a>
        </div>
        <Link
          to="/auth"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
        >
          Sign in
        </Link>
      </nav>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden px-4 pt-20 pb-32 sm:px-6 grid-bg">
      <ParticleField />
      <div className="relative z-10 mx-auto max-w-5xl text-center">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          className="inline-flex items-center gap-2 rounded-full glass px-4 py-1.5 text-xs font-medium text-muted-foreground"
        >
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          Built for India's gaming café revolution
        </motion.div>

        <motion.h1
          initial="hidden"
          animate="visible"
          custom={1}
          variants={fadeUp}
          className="mt-8 font-display text-5xl font-black leading-[1.05] tracking-tight sm:text-7xl md:text-8xl"
        >
          The Operating System
          <br />
          for <span className="text-gradient">Gaming Cafés</span>
        </motion.h1>

        <motion.p
          initial="hidden"
          animate="visible"
          custom={2}
          variants={fadeUp}
          className="mx-auto mt-6 max-w-2xl text-base text-muted-foreground sm:text-lg"
        >
          Sessions. Bookings. Memberships. Devices. Analytics. One platform.
          Real-time everything. Built mobile-first for café owners across India.
        </motion.p>

        <motion.div
          initial="hidden"
          animate="visible"
          custom={3}
          variants={fadeUp}
          className="mt-10 flex flex-wrap items-center justify-center gap-3"
        >
          <Link
            to="/auth"
            className="group inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan to-magenta px-6 py-3.5 text-sm font-semibold text-primary-foreground glow-cyan transition hover:scale-105"
          >
            Start your café <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
          </Link>
          <a
            href="#features"
            className="inline-flex items-center gap-2 rounded-xl glass px-6 py-3.5 text-sm font-semibold transition hover:bg-secondary/50"
          >
            See features
          </a>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.6, duration: 0.8 }}
          className="relative mx-auto mt-20 max-w-4xl"
        >
          <div className="relative rounded-2xl glass p-2 glow-cyan animate-pulse-glow">
            <div className="rounded-xl bg-background/80 p-6 sm:p-10">
              <div className="grid grid-cols-3 gap-4 text-left">
                {[
                  { label: "Active Sessions", value: "24", color: "text-cyan" },
                  { label: "Today's Revenue", value: "₹18.4K", color: "text-magenta" },
                  { label: "Devices Online", value: "30/30", color: "text-primary" },
                ].map((s) => (
                  <div key={s.label} className="rounded-lg bg-card/60 p-4">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.label}</div>
                    <div className={`mt-2 font-mono text-2xl font-bold sm:text-3xl ${s.color}`}>{s.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function Features() {
  const items = [
    { icon: Zap, title: "Real-time Sessions", desc: "Track every PC live. Auto-bill by the minute. Pause, resume, transfer in one tap." },
    { icon: Gamepad2, title: "Device Manager", desc: "Lock screens remotely. Monitor specs, uptime, health. Push updates in bulk." },
    { icon: Users, title: "Memberships", desc: "Sell hour packs and monthly passes. Wallets, loyalty, referrals — built-in." },
    { icon: BarChart3, title: "Analytics That Matter", desc: "Peak hours. Top games. Customer retention. India-first metrics dashboards." },
    { icon: Shield, title: "Staff Permissions", desc: "Granular role control. Owner sees everything. Staff sees only what they need." },
    { icon: Sparkles, title: "Mobile-First Portal", desc: "Customers book from their phone. Owners run the café from theirs." },
  ];
  return (
    <section id="features" className="relative px-4 py-24 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="text-center">
          <h2 className="font-display text-4xl font-bold sm:text-5xl">Everything. In one place.</h2>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">No more juggling Excel, WhatsApp, and clipboards.</p>
        </motion.div>

        <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((f, i) => (
            <motion.div
              key={f.title}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              custom={i}
              variants={fadeUp}
              className="group relative overflow-hidden rounded-2xl glass p-6 transition hover:border-primary/50"
            >
              <div className="absolute inset-0 -z-10 bg-gradient-to-br from-cyan/0 to-magenta/0 transition group-hover:from-cyan/10 group-hover:to-magenta/10" />
              <f.icon className="h-8 w-8 text-primary" />
              <h3 className="mt-5 font-heading text-xl font-semibold">{f.title}</h3>
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
    { value: "50K+", label: "Sessions Tracked" },
    { value: "₹2.4Cr", label: "Revenue Processed" },
    { value: "99.9%", label: "Uptime" },
    { value: "<50ms", label: "Real-time Latency" },
  ];
  return (
    <section className="border-y border-border/40 bg-card/30 px-4 py-16 sm:px-6">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-8 md:grid-cols-4">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
            className="text-center"
          >
            <div className="font-mono text-4xl font-bold text-gradient sm:text-5xl">{s.value}</div>
            <div className="mt-2 text-xs uppercase tracking-wider text-muted-foreground">{s.label}</div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function Pricing() {
  const plans = [
    { name: "Starter", price: "₹999", devices: "10", features: ["Basic POS", "Session tracking", "Email support"] },
    { name: "Pro", price: "₹2,499", devices: "30", features: ["All Starter", "Bookings", "Memberships", "Analytics", "Priority support"], featured: true },
    { name: "Enterprise", price: "₹5,999", devices: "100", features: ["All Pro", "Multi-branch", "White-label", "Dedicated manager", "API access"] },
  ];
  return (
    <section id="pricing" className="px-4 py-24 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="text-center">
          <h2 className="font-display text-4xl font-bold sm:text-5xl">Pricing built for India.</h2>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">Pay monthly. Cancel anytime. No setup fees.</p>
        </motion.div>

        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {plans.map((p, i) => (
            <motion.div
              key={p.name}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              custom={i}
              variants={fadeUp}
              className={`relative rounded-2xl p-8 transition ${
                p.featured
                  ? "glass border-2 border-primary glow-cyan scale-105"
                  : "glass hover:border-primary/40"
              }`}
            >
              {p.featured && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-cyan to-magenta px-3 py-1 text-xs font-semibold text-primary-foreground">
                  MOST POPULAR
                </div>
              )}
              <h3 className="font-heading text-2xl font-semibold">{p.name}</h3>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="font-mono text-5xl font-bold">{p.price}</span>
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
                    ? "bg-gradient-to-r from-cyan to-magenta text-primary-foreground hover:opacity-90"
                    : "border border-border hover:bg-secondary"
                }`}
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
  const submit = useServerFn(submitContact);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setLoading(true);
    try {
      await submit({
        data: {
          name: String(fd.get("name") ?? ""),
          email: String(fd.get("email") ?? ""),
          phone: String(fd.get("phone") ?? "") || null,
          message: String(fd.get("message") ?? ""),
        },
      });
      toast.success("Message sent — we'll get back to you within 24 hours.");
      e.currentTarget.reset();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="contact" className="px-4 py-24 sm:px-6">
      <div className="mx-auto grid max-w-5xl gap-12 md:grid-cols-2">
        <div>
          <h2 className="font-display text-4xl font-bold sm:text-5xl">Let's talk.</h2>
          <p className="mt-4 text-muted-foreground">
            Run a café? Thinking of opening one? Drop us a line — we reply within 24 hours, IST.
          </p>
          <div className="mt-8 space-y-3 text-sm">
            <div className="flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
              <span className="text-muted-foreground">Online · Mon–Sat 10am–8pm IST</span>
            </div>
          </div>
        </div>
        <form onSubmit={onSubmit} className="glass rounded-2xl p-6 space-y-4">
          <Input name="name" placeholder="Your name" required maxLength={120} />
          <Input name="email" type="email" placeholder="Email address" required maxLength={200} />
          <Input name="phone" placeholder="Phone (optional)" maxLength={20} />
          <Textarea name="message" placeholder="What are you building?" rows={4} required maxLength={2000} />
          <Button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-cyan to-magenta text-primary-foreground glow-cyan h-12 text-base font-semibold">
            {loading ? "Sending…" : "Send message"}
          </Button>
        </form>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border/40 px-4 py-12 sm:px-6">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 text-sm text-muted-foreground sm:flex-row">
        <div className="flex items-center gap-2">
          <Gamepad2 className="h-4 w-4 text-primary" />
          <span className="font-display font-bold">GIGANEXA</span>
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
