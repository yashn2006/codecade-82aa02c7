import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, useScroll, useTransform, useMotionValue, useSpring } from "framer-motion";
import { Search, MapPin, Star, Zap, Calendar, Trophy, Gift, UserPlus, Gamepad2, ArrowRight, Sparkles } from "lucide-react";
import { listPublicCafes } from "@/lib/discover.functions";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/discover")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Discover Gaming Cafés — CoreCade" },
      { name: "description", content: "Find gaming cafés near you. Book a seat. Game on. India's largest gaming café network." },
      { property: "og:title", content: "Discover Gaming Cafés — CoreCade" },
      { property: "og:description", content: "Find gaming cafés near you. Book a seat. Game on." },
    ],
  }),
  component: DiscoverPage,
});

type Cafe = {
  id: string; slug: string; name: string;
  city: string | null; state: string | null;
  description: string | null; cover_url: string | null;
};

function DiscoverPage() {
  const fn = useServerFn(listPublicCafes);
  const { data: cafes = [] } = useQuery<Cafe[]>({ queryKey: ["public-cafes"], queryFn: () => fn() });

  const [query, setQuery] = useState("");
  const [city, setCity] = useState<string>("all");
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setSignedIn(!!data.user));
  }, []);

  const cities = useMemo(() => {
    const s = new Set<string>();
    cafes.forEach((c) => c.city && s.add(c.city));
    return ["all", ...Array.from(s).sort()];
  }, [cafes]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return cafes.filter((c) => {
      if (city !== "all" && c.city !== city) return false;
      if (!q) return true;
      return [c.name, c.city, c.state, c.description].some((v) => v?.toLowerCase().includes(q));
    });
  }, [cafes, query, city]);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#05050F] text-white">
      <GalaxyBackdrop />
      <Navbar signedIn={signedIn} />
      <Hero query={query} setQuery={setQuery} cities={cities} city={city} setCity={setCity} />
      <StatsBar />
      <CafesSection cafes={filtered} loading={!cafes.length} />
      <HowItWorks />
      <WhyCorecade />
      <Footer />
    </div>
  );
}

/* ---------------- 3D Galaxy Backdrop ---------------- */
function GalaxyBackdrop() {
  const stars = useMemo(
    () => Array.from({ length: 220 }, () => ({
      x: Math.random() * 100, y: Math.random() * 100,
      s: Math.random() * 1.6 + 0.3, d: Math.random() * 6 + 2,
      o: Math.random() * 0.7 + 0.2,
    })),
    [],
  );
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {/* base */}
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at top, #0f0826 0%, #05050F 60%)" }} />
      {/* grid */}
      <div
        className="absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }}
      />
      {/* stars */}
      {stars.map((s, i) => (
        <span
          key={i}
          className="absolute rounded-full bg-white"
          style={{
            top: `${s.y}%`, left: `${s.x}%`,
            width: s.s, height: s.s, opacity: s.o,
            boxShadow: s.s > 1.2 ? "0 0 6px rgba(255,255,255,.8)" : undefined,
            animation: `twinkle ${s.d}s ease-in-out ${Math.random() * 4}s infinite alternate`,
          }}
        />
      ))}
      {/* glowing orbs */}
      <FloatingOrb className="left-[-10%] top-[10%] h-[520px] w-[520px]" color="oklch(0.65 0.25 295 / 0.45)" duration={18} />
      <FloatingOrb className="right-[-12%] top-[40%] h-[460px] w-[460px]" color="oklch(0.7 0.2 240 / 0.40)" duration={22} delay={-6} />
      <FloatingOrb className="left-[30%] bottom-[-10%] h-[600px] w-[600px]" color="oklch(0.7 0.26 335 / 0.40)" duration={26} delay={-12} />

      <style>{`
        @keyframes twinkle { from { opacity: .15 } to { opacity: 1 } }
      `}</style>
    </div>
  );
}

function FloatingOrb({ className = "", color, duration = 20, delay = 0 }: { className?: string; color: string; duration?: number; delay?: number }) {
  return (
    <motion.div
      className={`absolute rounded-full blur-[110px] ${className}`}
      style={{ background: `radial-gradient(circle, ${color}, transparent 65%)` }}
      animate={{ x: [0, 40, -20, 0], y: [0, -30, 20, 0] }}
      transition={{ duration, delay, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

/* ---------------- Navbar ---------------- */
function Navbar({ signedIn }: { signedIn: boolean }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <motion.nav
      initial={{ y: -60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? "border-b border-white/10 bg-[#05050F]/70 backdrop-blur-xl" : "bg-transparent"
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
        <Link to="/discover" className="group flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-lg" style={{ background: "linear-gradient(135deg, #7b2fff, #2d8eff)", boxShadow: "0 0 22px rgba(123,47,255,.55)" }}>
            <Gamepad2 className="h-5 w-5 text-white" />
          </div>
          <span className="font-display text-lg font-black tracking-wider text-white" style={{ textShadow: "0 0 18px rgba(123,47,255,.7)", letterSpacing: "0.18em" }}>
            CORECADE
          </span>
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
          {signedIn ? (
            <Link to="/portal">
              <Button size="sm" className="bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-400 hover:to-fuchsia-400">
                My Portal <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            </Link>
          ) : (
            <>
              <Link to="/auth">
                <Button size="sm" variant="ghost" className="border border-white/20 bg-transparent text-white hover:bg-white/10">Login</Button>
              </Link>
              <Link to="/auth">
                <Button size="sm" className="bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-400 hover:to-fuchsia-400 shadow-[0_0_24px_rgba(123,47,255,.45)]">
                  Sign Up
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </motion.nav>
  );
}

/* ---------------- Hero ---------------- */
function Hero({
  query, setQuery, cities, city, setCity,
}: { query: string; setQuery: (s: string) => void; cities: string[]; city: string; setCity: (c: string) => void }) {
  const words = ["FIND", "YOUR", "ARENA"];
  return (
    <section className="relative z-10 mx-auto max-w-7xl px-5 pt-32 pb-16 sm:px-8 sm:pt-40">
      <div className="mx-auto max-w-4xl text-center">
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.28em] text-violet-300 backdrop-blur"
        >
          <Sparkles className="h-3 w-3" /> India's gaming café universe
        </motion.div>
        <h1 className="mt-6 font-display text-[2.5rem] font-black leading-[0.95] tracking-tight sm:text-7xl md:text-8xl">
          {words.map((w, i) => (
            <motion.span
              key={w}
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 + i * 0.12, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="mx-2 inline-block"
              style={i === 2 ? {
                background: "linear-gradient(135deg, #c084fc, #7b2fff, #2d8eff)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                textShadow: "0 0 60px rgba(123,47,255,.4)",
              } : undefined}
            >
              {w}
            </motion.span>
          ))}
        </h1>
        <motion.p
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.75 }}
          className="mx-auto mt-6 max-w-xl text-base text-white/70 sm:text-lg"
        >
          Discover gaming cafés near you. Book a seat. <span className="text-white">Game on.</span>
        </motion.p>

        {/* Search bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 }}
          className="relative mx-auto mt-10 max-w-2xl"
        >
          <div className="group relative overflow-hidden rounded-2xl border border-violet-500/30 bg-white/[0.04] backdrop-blur-xl"
               style={{ boxShadow: "0 0 40px rgba(123,47,255,.25), inset 0 1px 0 rgba(255,255,255,.08)" }}>
            <Search className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 animate-pulse text-violet-300" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by café, city, area or PIN code…"
              className="w-full bg-transparent py-5 pl-14 pr-5 text-base text-white placeholder:text-white/40 focus:outline-none"
            />
          </div>
        </motion.div>

        {/* City pills */}
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.1 }}
          className="mt-5 flex flex-wrap justify-center gap-2"
        >
          {cities.slice(0, 10).map((c) => (
            <button
              key={c}
              onClick={() => setCity(c)}
              className={`rounded-full border px-4 py-1.5 text-xs font-medium transition ${
                city === c
                  ? "border-violet-400/60 bg-violet-500/20 text-white shadow-[0_0_18px_rgba(123,47,255,.4)]"
                  : "border-white/10 bg-white/[0.03] text-white/60 hover:border-white/30 hover:text-white"
              }`}
            >
              {c === "all" ? "All Cities" : c}
            </button>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

/* ---------------- Stats Bar ---------------- */
function StatsBar() {
  const stats = [
    { v: 120, suf: "+", label: "Cafés" },
    { v: 50000, suf: "+", label: "Sessions" },
    { v: 10000, suf: "+", label: "Gamers" },
    { v: 15, suf: "", label: "Cities" },
  ];
  return (
    <section className="relative z-10 mx-auto mt-10 max-w-7xl px-5 sm:px-8">
      <div className="grid grid-cols-2 gap-3 rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl sm:grid-cols-4 sm:gap-6">
        {stats.map((s, i) => (
          <CountStat key={s.label} target={s.v} suffix={s.suf} label={s.label} delay={i * 0.1} />
        ))}
      </div>
    </section>
  );
}

function CountStat({ target, suffix, label, delay }: { target: number; suffix: string; label: string; delay: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [n, setN] = useState(0);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        const start = performance.now();
        const tick = (t: number) => {
          const p = Math.min(1, (t - start) / 1400);
          const eased = 1 - Math.pow(1 - p, 3);
          setN(Math.floor(target * eased));
          if (p < 1) requestAnimationFrame(tick);
        };
        setTimeout(() => requestAnimationFrame(tick), delay * 1000);
        obs.disconnect();
      }
    });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [target, delay]);
  return (
    <div ref={ref} className="text-center sm:text-left">
      <div className="font-display text-3xl font-black sm:text-5xl" style={{ background: "linear-gradient(135deg, #ffd86b, #ffae3c)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
        {n.toLocaleString("en-IN")}{suffix}
      </div>
      <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.22em] text-white/60">{label}</div>
    </div>
  );
}

/* ---------------- Cafes Grid ---------------- */
function CafesSection({ cafes, loading }: { cafes: Cafe[]; loading: boolean }) {
  return (
    <section className="relative z-10 mx-auto mt-20 max-w-7xl px-5 sm:px-8">
      <div className="text-center">
        <h2 className="relative inline-block font-display text-3xl font-black tracking-tight sm:text-4xl">
          FEATURED ARENAS
          <span className="absolute -bottom-2 left-1/2 h-[3px] w-32 -translate-x-1/2 rounded-full" style={{ background: "linear-gradient(90deg, transparent, #7b2fff, transparent)", boxShadow: "0 0 16px rgba(123,47,255,.7)" }} />
        </h2>
        <p className="mt-4 text-sm text-white/60">{cafes.length} arena{cafes.length !== 1 && "s"} ready to play</p>
      </div>

      <AnimatePresence mode="wait">
        {loading ? (
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-[360px] animate-pulse rounded-3xl border border-white/10 bg-white/[0.03]" />
            ))}
          </div>
        ) : cafes.length === 0 ? (
          <motion.div
            key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="mt-16 text-center"
          >
            <motion.div
              animate={{ y: [0, -10, 0], rotate: [0, 8, -8, 0] }}
              transition={{ duration: 4, repeat: Infinity }}
              className="mx-auto grid h-24 w-24 place-items-center rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur"
            >
              <Gamepad2 className="h-12 w-12 text-violet-300" />
            </motion.div>
            <p className="mt-6 font-display text-xl text-white/80">No arenas found in this area yet</p>
            <p className="mt-2 text-sm text-white/50">Try a different city or clear the search.</p>
          </motion.div>
        ) : (
          <motion.div
            key="grid"
            layout
            className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
          >
            {cafes.slice(0, 12).map((c, i) => (
              <CafeCard key={c.id} cafe={c} index={i} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function CafeCard({ cafe, index }: { cafe: Cafe; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rx = useSpring(useTransform(my, [-0.5, 0.5], [10, -10]), { stiffness: 280, damping: 22 });
  const ry = useSpring(useTransform(mx, [-0.5, 0.5], [-12, 12]), { stiffness: 280, damping: 22 });

  const onMove = (e: React.MouseEvent) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    mx.set((e.clientX - r.left) / r.width - 0.5);
    my.set((e.clientY - r.top) / r.height - 0.5);
  };

  return (
    <motion.div
      layout
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={() => { mx.set(0); my.set(0); }}
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      style={{ rotateX: rx, rotateY: ry, transformPerspective: 1000, transformStyle: "preserve-3d" }}
      whileHover={{ scale: 1.02, y: -6 }}
      className="group relative overflow-hidden rounded-3xl border border-violet-500/20 bg-[rgba(19,15,42,0.7)] backdrop-blur-xl transition-all hover:border-violet-400/50 hover:shadow-[0_24px_60px_-12px_rgba(123,47,255,.5)]"
    >
      {/* Cover */}
      <div className="relative h-44 overflow-hidden">
        {cafe.cover_url ? (
          <img src={cafe.cover_url} alt={cafe.name} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" />
        ) : (
          <div className="h-full w-full animate-gradient-shift" style={{ background: "linear-gradient(135deg, #7b2fff 0%, #2d8eff 50%, #ec4899 100%)", backgroundSize: "200% 200%" }} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[rgba(19,15,42,0.95)] via-transparent to-transparent" />
        <div className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-500/15 px-2.5 py-1 backdrop-blur">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-emerald-300">OPEN</span>
        </div>
        {/* shine sweep */}
        <div className="pointer-events-none absolute inset-0 -translate-x-full transition-transform duration-700 group-hover:translate-x-full" style={{ background: "linear-gradient(110deg, transparent 40%, rgba(255,255,255,.18) 50%, transparent 60%)" }} />
      </div>

      {/* Body */}
      <div className="p-5" style={{ transform: "translateZ(20px)" }}>
        <h3 className="font-display text-xl font-bold text-white">{cafe.name}</h3>
        <div className="mt-1.5 flex items-center gap-1.5 text-sm text-violet-300/80">
          <MapPin className="h-3.5 w-3.5" />
          {cafe.city ?? "—"}{cafe.state ? `, ${cafe.state}` : ""}
        </div>
        {cafe.description && (
          <p className="mt-3 line-clamp-2 text-sm text-white/60">{cafe.description}</p>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-white/5 px-2.5 py-1 font-mono text-[10px] text-white/70">PC · Console</span>
          <span className="rounded-full bg-amber-500/10 px-2.5 py-1 font-mono text-[10px] text-amber-300">₹ from ₹60/hr</span>
          <span className="flex items-center gap-1 rounded-full bg-white/5 px-2.5 py-1 font-mono text-[10px] text-white/70">
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> 4.7
          </span>
        </div>
        <Link
          to="/c/$slug" params={{ slug: cafe.slug }}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 font-semibold text-white transition hover:shadow-[0_0_24px_rgba(123,47,255,.55)]"
          style={{ background: "linear-gradient(135deg, #7b2fff, #ec4899)" }}
        >
          Book Now <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      <style>{`
        @keyframes gradient-shift { 0%,100% { background-position: 0% 50% } 50% { background-position: 100% 50% } }
        .animate-gradient-shift { animation: gradient-shift 8s ease infinite }
      `}</style>
    </motion.div>
  );
}

/* ---------------- How It Works ---------------- */
function HowItWorks() {
  const steps = [
    { icon: UserPlus, title: "Create Account", desc: "Free 60-second signup" },
    { icon: Search, title: "Find Your Café", desc: "Browse arenas near you" },
    { icon: Calendar, title: "Book a Seat", desc: "Pick a device & time" },
    { icon: Gamepad2, title: "Game On", desc: "Walk in. Play. Win." },
  ];
  const { scrollYProgress } = useScroll();
  const lineProgress = useTransform(scrollYProgress, [0.4, 0.7], [0, 1]);

  return (
    <section className="relative z-10 mx-auto mt-28 max-w-7xl px-5 sm:px-8">
      <div className="text-center">
        <h2 className="font-display text-3xl font-black sm:text-4xl">HOW IT WORKS</h2>
        <p className="mt-3 text-sm text-white/60">Four steps from zero to game-on</p>
      </div>
      <div className="relative mt-16">
        {/* connector line */}
        <svg className="absolute left-0 right-0 top-10 mx-auto hidden h-1 max-w-4xl sm:block" viewBox="0 0 800 4" preserveAspectRatio="none">
          <motion.line x1="40" y1="2" x2="760" y2="2" stroke="url(#g)" strokeWidth="2" strokeDasharray="6 6" pathLength={1} style={{ pathLength: lineProgress }} />
          <defs><linearGradient id="g"><stop offset="0" stopColor="#7b2fff" /><stop offset="1" stopColor="#2d8eff" /></linearGradient></defs>
        </svg>
        <div className="relative grid gap-8 sm:grid-cols-4">
          {steps.map((s, i) => (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, y: 30, rotateY: -30 }}
              whileInView={{ opacity: 1, y: 0, rotateY: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.12, duration: 0.6 }}
              className="text-center"
            >
              <div className="mx-auto grid h-20 w-20 place-items-center rounded-2xl border border-violet-500/30 bg-[#0c0a24]/80 backdrop-blur-xl" style={{ boxShadow: "0 0 30px rgba(123,47,255,.3)" }}>
                <s.icon className="h-9 w-9 text-violet-300" />
              </div>
              <div className="mt-4 font-mono text-[10px] uppercase tracking-[0.22em] text-violet-300">Step {i + 1}</div>
              <div className="mt-1 font-display text-lg font-bold">{s.title}</div>
              <div className="mt-1 text-sm text-white/60">{s.desc}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- Why CoreCade ---------------- */
function WhyCorecade() {
  const items = [
    { icon: Zap, title: "Instant Booking", desc: "Confirm a seat in seconds — no calls, no waiting." },
    { icon: Trophy, title: "Real-Time Availability", desc: "Live device status across every café in the network." },
    { icon: Gift, title: "Loyalty Rewards", desc: "Earn points every session. Redeem at any CoreCade café." },
  ];
  return (
    <section className="relative z-10 mx-auto mt-28 max-w-7xl px-5 sm:px-8">
      <div className="text-center">
        <h2 className="font-display text-3xl font-black sm:text-4xl">WHY <span style={{ background: "linear-gradient(135deg, #c084fc, #2d8eff)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>CORECADE</span></h2>
      </div>
      <div className="mt-12 grid gap-6 sm:grid-cols-3">
        {items.map((it, i) => <TiltFeature key={it.title} item={it} delay={i * 0.1} />)}
      </div>
    </section>
  );
}

function TiltFeature({ item, delay }: { item: { icon: any; title: string; desc: string }; delay: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rx = useSpring(useTransform(my, [-0.5, 0.5], [12, -12]), { stiffness: 240, damping: 20 });
  const ry = useSpring(useTransform(mx, [-0.5, 0.5], [-15, 15]), { stiffness: 240, damping: 20 });
  return (
    <motion.div
      ref={ref}
      onMouseMove={(e) => {
        const r = ref.current?.getBoundingClientRect(); if (!r) return;
        mx.set((e.clientX - r.left) / r.width - 0.5);
        my.set((e.clientY - r.top) / r.height - 0.5);
      }}
      onMouseLeave={() => { mx.set(0); my.set(0); }}
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay, duration: 0.6 }}
      style={{ rotateX: rx, rotateY: ry, transformPerspective: 1000, transformStyle: "preserve-3d" }}
      className="rounded-3xl border border-white/10 bg-white/[0.03] p-7 backdrop-blur-xl transition-colors hover:border-violet-400/40"
    >
      <div className="grid h-12 w-12 place-items-center rounded-xl" style={{ background: "linear-gradient(135deg, #7b2fff, #2d8eff)", boxShadow: "0 0 20px rgba(123,47,255,.45)", transform: "translateZ(30px)" }}>
        <item.icon className="h-6 w-6 text-white" />
      </div>
      <h3 className="mt-5 font-display text-xl font-bold" style={{ transform: "translateZ(20px)" }}>{item.title}</h3>
      <p className="mt-2 text-sm text-white/60" style={{ transform: "translateZ(10px)" }}>{item.desc}</p>
    </motion.div>
  );
}

/* ---------------- Footer ---------------- */
function Footer() {
  return (
    <footer className="relative z-10 mt-32 border-t border-white/10 bg-[#05050F]/80 px-5 py-12 backdrop-blur sm:px-8">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 sm:flex-row">
        <div className="text-center sm:text-left">
          <div className="font-display text-lg font-black tracking-wider" style={{ letterSpacing: "0.18em" }}>CORECADE</div>
          <p className="mt-1 text-xs text-white/50">The gaming café universe, unified.</p>
        </div>
        <nav className="flex flex-wrap items-center justify-center gap-5 text-xs text-white/60">
          <Link to="/discover" className="hover:text-white">Discover</Link>
          <Link to="/auth" className="hover:text-white">Sign Up</Link>
          <Link to="/auth" className="hover:text-white">Login</Link>
          <Link to="/" className="hover:text-white">Owners</Link>
        </nav>
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/40">© 2026 CoreCade</div>
      </div>
    </footer>
  );
}
