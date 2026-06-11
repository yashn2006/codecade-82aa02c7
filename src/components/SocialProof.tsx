import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { Quote, Star, TrendingUp, Trophy, Zap } from "lucide-react";
import { AnimatedNumber } from "@/components/AnimatedNumber";

const TESTIMONIALS = [
  {
    name: "Rohit Mehta",
    role: "Owner · NeoArcade, Pune",
    avatar: "RM",
    tone: "violet",
    quote:
      "We switched from 4 spreadsheets and a WhatsApp group to CoreCade in one night. Daily close dropped from 90 min to 4 min. Wild.",
    metric: { v: "+38%", l: "revenue / month" },
    stars: 5,
  },
  {
    name: "Ananya Verma",
    role: "Founder · LagFree Esports, Bengaluru",
    avatar: "AV",
    tone: "magenta",
    quote:
      "Per-minute billing without a stopwatch. Members love wallets. Staff love the floor view. I love the analytics.",
    metric: { v: "2.1×", l: "repeat visits" },
    stars: 5,
  },
  {
    name: "Karan Singh",
    role: "CEO · GG Cafés (4 branches)",
    avatar: "KS",
    tone: "azure",
    quote:
      "Multi-branch dashboard is the cleanest I've used — including Western SaaS. India-first metrics actually matter here.",
    metric: { v: "₹0", l: "stale-stock loss" },
    stars: 5,
  },
];

const LOGOS = ["NeoArcade", "LagFree", "GG Cafés", "PixelPit", "Frag Lounge", "Respawn Co.", "Aurora LAN"];

export function SocialProof() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const glow = useTransform(scrollYProgress, [0, 0.5, 1], [0.15, 0.65, 0.15]);
  const yA = useTransform(scrollYProgress, [0, 1], [40, -40]);

  return (
    <section ref={ref} className="relative overflow-hidden px-4 py-32 sm:px-6">
      {/* Scroll-driven glow */}
      <motion.div
        style={{ opacity: glow }}
        className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[640px] w-[640px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
      >
        <div className="absolute inset-0 rounded-full" style={{ background: "var(--gradient-brand-hot)" }} />
      </motion.div>
      <div className="pointer-events-none absolute inset-0 -z-10 grid-arcade opacity-20" />

      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="text-center"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-400/5 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.25em] text-emerald-300">
            <Trophy className="h-3 w-3" /> Loved by India's top arcades
          </div>
          <h2 className="mt-5 font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
            The receipts. <span className="text-gradient-hot">Pinned.</span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground sm:text-lg">
            Café owners who replaced their entire stack with CoreCade — and never went back.
          </p>
        </motion.div>

        {/* Live counters */}
        <motion.div
          style={{ y: yA }}
          className="mt-14 grid grid-cols-2 gap-3 sm:grid-cols-4"
        >
          {[
            { icon: TrendingUp, v: 137, suffix: "+", l: "cafés onboarded", c: "text-violet-300" },
            { icon: Zap, v: 4.2, suffix: "M", l: "minutes billed", c: "text-fuchsia-300", format: (n: number) => n.toFixed(1) },
            { icon: Star, v: 4.9, suffix: "/5", l: "owner rating", c: "text-amber-300", format: (n: number) => n.toFixed(1) },
            { icon: Trophy, v: 24, suffix: "h", l: "avg go-live", c: "text-emerald-300" },
          ].map((s) => (
            <motion.div
              key={s.l}
              whileHover={{ y: -4 }}
              className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card/40 p-5 backdrop-blur transition hover:border-primary/40"
            >
              <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/20 blur-2xl opacity-0 transition group-hover:opacity-100" />
              <s.icon className={`h-4 w-4 ${s.c}`} />
              <div className="mt-3 font-display text-4xl font-extrabold tracking-tight text-gradient">
                <AnimatedNumber value={s.v} suffix={s.suffix} format={s.format} />
              </div>
              <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{s.l}</div>
            </motion.div>
          ))}
        </motion.div>

        {/* Testimonial cards */}
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {TESTIMONIALS.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ delay: i * 0.12, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ y: -6 }}
              className="group relative overflow-hidden rounded-3xl border border-border/60 bg-card/40 p-6 backdrop-blur-xl"
            >
              {/* Glow on hover */}
              <div
                className="pointer-events-none absolute -inset-px rounded-3xl opacity-0 transition duration-500 group-hover:opacity-100"
                style={{
                  background:
                    "conic-gradient(from 180deg at 50% 50%, oklch(0.7 0.26 335 / 0.6), oklch(0.7 0.22 285 / 0.5), oklch(0.78 0.18 220 / 0.5), oklch(0.7 0.26 335 / 0.6))",
                  filter: "blur(20px)",
                }}
              />
              <div className="relative">
                <Quote className={`h-6 w-6 text-${t.tone}`} />
                <div className="mt-3 flex gap-0.5">
                  {Array.from({ length: t.stars }).map((_, j) => (
                    <Star key={j} className="h-3.5 w-3.5 fill-amber-300 text-amber-300" />
                  ))}
                </div>
                <p className="mt-4 text-base leading-relaxed text-foreground/90">"{t.quote}"</p>

                <div className="mt-5 flex items-center justify-between border-t border-border/40 pt-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="grid h-10 w-10 place-items-center rounded-full font-display text-sm font-bold text-primary-foreground"
                      style={{ background: "var(--gradient-brand-hot)" }}
                    >
                      {t.avatar}
                    </div>
                    <div>
                      <div className="font-heading text-sm font-bold leading-tight">{t.name}</div>
                      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                        {t.role}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-display text-lg font-extrabold text-gradient">{t.metric.v}</div>
                    <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
                      {t.metric.l}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Logo rail */}
        <div className="mt-16 overflow-hidden border-y border-border/30 py-6">
          <div className="flex animate-marquee gap-14 whitespace-nowrap">
            {[...LOGOS, ...LOGOS, ...LOGOS].map((l, i) => (
              <span
                key={i}
                className="font-display text-2xl font-extrabold tracking-tight text-muted-foreground/50 transition hover:text-foreground"
              >
                {l}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
