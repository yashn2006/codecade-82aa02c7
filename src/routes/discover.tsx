import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  motion, AnimatePresence, useScroll, useTransform, useMotionValue, useSpring,
  useMotionTemplate, useVelocity, useAnimationFrame, wrap,
} from "framer-motion";
import {
  Search, MapPin, Star, Zap, Calendar, Trophy, Gift, UserPlus, Gamepad2,
  ArrowRight, ArrowUpRight, Sparkles, PlayCircle, Joystick, Headphones, Cpu, Crown,
} from "lucide-react";
import { listPublicCafes } from "@/lib/discover.functions";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import corecadeLogo from "@/assets/corecade-logo.png.asset.json";

export const Route = createFileRoute("/discover")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "CoreCade — Enter the Arena" },
      { name: "description", content: "India's cinematic gaming café network. Find arenas. Book seats. Game on." },
      { property: "og:title", content: "CoreCade — Enter the Arena" },
      { property: "og:description", content: "India's cinematic gaming café network. Find arenas. Book seats. Game on." },
    ],
  }),
  component: DiscoverPage,
});

type Cafe = {
  id: string; slug: string; name: string;
  city: string | null; state: string | null;
  description: string | null; cover_url: string | null;
};

/* =================================================================
   ROOT
================================================================= */
function DiscoverPage() {
  const fn = useServerFn(listPublicCafes);
  const { data: cafes = [] } = useQuery<Cafe[]>({ queryKey: ["public-cafes"], queryFn: () => fn() });

  const [query, setQuery] = useState("");
  const [city, setCity] = useState<string>("all");
  const [signedIn, setSignedIn] = useState(false);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setSignedIn(!!data.user);
      setEmail(data.user?.email ?? null);
    });
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
    <div className="relative min-h-screen overflow-x-hidden bg-[#04030c] text-white antialiased selection:bg-fuchsia-500/40 selection:text-white">
      <NeonCursor />
      <NebulaCanvas />
      <GrainOverlay />
      <ScrollProgress />
      <Navbar signedIn={signedIn} email={email} />

      <CinematicHero query={query} setQuery={setQuery} cities={cities} city={city} setCity={setCity} cafes={cafes} />
      <MarqueeStrip />
      <PinnedManifesto />
      <ArenaShowcase cafes={filtered} loading={!cafes.length} />
      <ParallaxStats />
      <RitualSection />
      <PerksSection />
      <FinalCTA />
      <Footer />
    </div>
  );
}

/* =================================================================
   NEON CURSOR (desktop only)
================================================================= */
function NeonCursor() {
  const x = useMotionValue(-200);
  const y = useMotionValue(-200);
  const sx = useSpring(x, { stiffness: 350, damping: 30, mass: 0.4 });
  const sy = useSpring(y, { stiffness: 350, damping: 30, mass: 0.4 });
  const [hover, setHover] = useState(false);

  useEffect(() => {
    const move = (e: MouseEvent) => { x.set(e.clientX); y.set(e.clientY); };
    const over = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      setHover(!!t?.closest("a,button,[data-cursor]"));
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseover", over);
    return () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseover", over); };
  }, [x, y]);

  return (
    <>
      <motion.div
        aria-hidden
        style={{ x: sx, y: sy }}
        className="pointer-events-none fixed left-0 top-0 z-[100] hidden md:block"
      >
        <motion.div
          animate={{ scale: hover ? 2.4 : 1, opacity: hover ? 0.9 : 0.7 }}
          transition={{ type: "spring", stiffness: 260, damping: 22 }}
          className="-translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            width: 18, height: 18,
            background: "radial-gradient(circle, #ff52e0 0%, #7b2fff 55%, transparent 75%)",
            filter: "blur(2px)",
            boxShadow: "0 0 30px rgba(255,82,224,.8), 0 0 60px rgba(123,47,255,.5)",
          }}
        />
      </motion.div>
      <motion.div
        aria-hidden
        style={{ x, y }}
        className="pointer-events-none fixed left-0 top-0 z-[101] hidden md:block"
      >
        <div className="-translate-x-1/2 -translate-y-1/2 rounded-full bg-white" style={{ width: 4, height: 4 }} />
      </motion.div>
    </>
  );
}

/* =================================================================
   NEBULA CANVAS — animated particle field reacting to mouse
================================================================= */
function NebulaCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext("2d"); if (!ctx) return;
    let raf = 0; const DPR = Math.min(2, window.devicePixelRatio || 1);
    const mouse = { x: -9999, y: -9999 };
    const resize = () => {
      c.width = window.innerWidth * DPR; c.height = window.innerHeight * DPR;
      c.style.width = "100vw"; c.style.height = "100vh";
    };
    resize(); window.addEventListener("resize", resize);
    const onMove = (e: MouseEvent) => { mouse.x = e.clientX * DPR; mouse.y = e.clientY * DPR; };
    window.addEventListener("mousemove", onMove);

    const N = 140;
    type P = { x: number; y: number; vx: number; vy: number; r: number; h: number };
    const parts: P[] = Array.from({ length: N }, () => ({
      x: Math.random() * c.width, y: Math.random() * c.height,
      vx: (Math.random() - 0.5) * 0.35 * DPR, vy: (Math.random() - 0.5) * 0.35 * DPR,
      r: (Math.random() * 1.6 + 0.4) * DPR,
      h: Math.random() < 0.5 ? 290 : 320, // violet / magenta hues
    }));

    const tick = () => {
      ctx.clearRect(0, 0, c.width, c.height);
      // soft tint
      const grad = ctx.createRadialGradient(c.width * 0.5, c.height * 0.3, 0, c.width * 0.5, c.height * 0.3, c.width * 0.7);
      grad.addColorStop(0, "rgba(40,12,80,0.35)");
      grad.addColorStop(1, "rgba(4,3,12,0)");
      ctx.fillStyle = grad; ctx.fillRect(0, 0, c.width, c.height);

      for (const p of parts) {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > c.width) p.vx *= -1;
        if (p.y < 0 || p.y > c.height) p.vy *= -1;
        // mouse repulse
        const dx = p.x - mouse.x, dy = p.y - mouse.y;
        const d2 = dx * dx + dy * dy;
        const R = 160 * DPR;
        if (d2 < R * R) {
          const d = Math.sqrt(d2) || 1;
          const f = (1 - d / R) * 0.9;
          p.x += (dx / d) * f * 3; p.y += (dy / d) * f * 3;
        }
        ctx.beginPath();
        ctx.fillStyle = `hsla(${p.h}, 95%, 70%, .85)`;
        ctx.shadowBlur = 14 * DPR; ctx.shadowColor = `hsla(${p.h}, 95%, 65%, .9)`;
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      }
      // connect lines
      ctx.shadowBlur = 0;
      for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          const a = parts[i], b = parts[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          const max = 110 * DPR;
          if (d < max) {
            ctx.strokeStyle = `hsla(305, 90%, 70%, ${(1 - d / max) * 0.18})`;
            ctx.lineWidth = 0.6 * DPR;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); window.removeEventListener("mousemove", onMove); };
  }, []);
  return (
    <div className="pointer-events-none fixed inset-0 z-0">
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at top, #1a0838 0%, #04030c 55%, #000 100%)" }} />
      <canvas ref={ref} className="absolute inset-0" />
      <div
        className="absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.5) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.5) 1px,transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage: "radial-gradient(ellipse 70% 60% at 50% 30%, #000 30%, transparent 100%)",
          WebkitMaskImage: "radial-gradient(ellipse 70% 60% at 50% 30%, #000 30%, transparent 100%)",
        }}
      />
    </div>
  );
}

function GrainOverlay() {
  return (
    <div className="pointer-events-none fixed inset-0 z-[2] opacity-[0.07] mix-blend-overlay"
      style={{
        backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
      }}
    />
  );
}

function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const w = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);
  return (
    <motion.div className="fixed top-0 left-0 z-[60] h-[2px] origin-left"
      style={{ width: w, background: "linear-gradient(90deg,#ff52e0,#7b2fff,#2d8eff)", boxShadow: "0 0 14px #ff52e0" }} />
  );
}

/* =================================================================
   NAVBAR
================================================================= */
function Navbar({ signedIn, email }: { signedIn: boolean; email: string | null }) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll(); window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const initial = (email?.[0] ?? "G").toUpperCase();
  return (
    <motion.nav
      initial={{ y: -60, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-500 ${
        scrolled ? "border-b border-white/10 bg-[#04030c]/70 backdrop-blur-2xl" : "bg-transparent"
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
        <Link to="/discover" className="group flex items-center gap-2.5">
          <img
            src={corecadeLogo.url}
            alt="CoreCade"
            className="h-9 w-auto select-none drop-shadow-[0_0_22px_rgba(255,82,224,.55)]"
            draggable={false}
          />
          <span className="font-display text-lg font-black tracking-[0.2em] text-white" style={{ textShadow: "0 0 22px rgba(255,82,224,.55)" }}>
            CORECADE
          </span>
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
          {signedIn ? (
            <div className="relative">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                onBlur={() => setTimeout(() => setMenuOpen(false), 160)}
                className="group flex items-center gap-2.5 rounded-full border border-white/15 bg-white/5 py-1 pl-1 pr-3 backdrop-blur-xl transition hover:border-fuchsia-400/50 hover:bg-white/10"
              >
                <span
                  className="grid h-8 w-8 place-items-center rounded-full font-display text-sm font-black text-white"
                  style={{ background: "linear-gradient(135deg,#ff52e0,#7b2fff,#2d8eff)", boxShadow: "0 0 18px rgba(255,82,224,.55)" }}
                >{initial}</span>
                <span className="hidden text-xs font-medium text-white/90 sm:inline max-w-[140px] truncate">{email ?? "Account"}</span>
              </button>
              <AnimatePresence>
                {menuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.97 }}
                    transition={{ duration: 0.18 }}
                    className="absolute right-0 top-[calc(100%+8px)] w-64 overflow-hidden rounded-2xl border border-white/10 bg-[#0b0820]/95 backdrop-blur-2xl shadow-[0_24px_60px_-12px_rgba(255,82,224,.35)]"
                  >
                    <div className="border-b border-white/10 px-4 py-3">
                      <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-fuchsia-300">Signed in</div>
                      <div className="mt-0.5 truncate text-sm font-medium text-white">{email}</div>
                    </div>
                    <Link to="/portal" className="flex items-center gap-2 px-4 py-2.5 text-sm text-white/90 transition hover:bg-white/5">
                      <Gamepad2 className="h-4 w-4 text-fuchsia-300" /> My Portal
                    </Link>
                    <Link to="/portal" className="flex items-center gap-2 px-4 py-2.5 text-sm text-white/90 transition hover:bg-white/5">
                      <Calendar className="h-4 w-4 text-blue-300" /> My Bookings
                    </Link>
                    <button
                      onMouseDown={async () => { await supabase.auth.signOut(); window.location.href = "/discover"; }}
                      className="flex w-full items-center gap-2 border-t border-white/10 px-4 py-2.5 text-sm text-rose-300 transition hover:bg-rose-500/10"
                    >
                      <ArrowUpRight className="h-4 w-4 rotate-90" /> Sign out
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <>
              <Link to="/auth">
                <Button size="sm" variant="ghost" className="border border-white/20 bg-transparent text-white hover:bg-white/10">Login</Button>
              </Link>
              <Link to="/auth">
                <Button size="sm" className="border-0 bg-gradient-to-r from-fuchsia-500 via-violet-500 to-blue-500 text-white shadow-[0_0_28px_rgba(255,82,224,.5)]">
                  Enter Arena
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </motion.nav>
  );
}

/* =================================================================
   CINEMATIC HERO
================================================================= */
function CinematicHero({
  query, setQuery, cities, city, setCity, cafes,
}: { query: string; setQuery: (s: string) => void; cities: string[]; city: string; setCity: (c: string) => void; cafes: Cafe[] }) {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const yTitle = useTransform(scrollYProgress, [0, 1], [0, -180]);
  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [1, 0.85]);
  const yBg = useTransform(scrollYProgress, [0, 1], [0, 250]);

  return (
    <section ref={ref} className="relative z-10 min-h-[100svh] pt-28 sm:pt-36">
      {/* parallax hero layers */}
      <motion.div style={{ y: yBg }} className="pointer-events-none absolute inset-0 -z-10">
        {/* halo */}
        <div className="absolute left-1/2 top-[28%] h-[680px] w-[680px] -translate-x-1/2 -translate-y-1/2 rounded-full"
             style={{ background: "radial-gradient(circle, rgba(255,82,224,.30), rgba(123,47,255,.15) 40%, transparent 70%)", filter: "blur(60px)" }} />
        {/* concentric rings (no globe) */}
        <svg className="absolute left-1/2 top-1/2 -z-10 -translate-x-1/2 -translate-y-[55%] opacity-40" width="1200" height="800" viewBox="-600 -400 1200 800">
          {[120, 200, 290, 390, 500, 620].map((r, i) => (
            <motion.circle
              key={r} cx="0" cy="0" r={r} fill="none" stroke="url(#ringG)" strokeWidth="1"
              initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 0.5 }}
              transition={{ duration: 1.4 + i * 0.15, ease: "easeOut", delay: 0.2 + i * 0.05 }}
            />
          ))}
          <defs>
            <linearGradient id="ringG" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#ff52e0" stopOpacity="0.9" />
              <stop offset="0.5" stopColor="#7b2fff" stopOpacity="0.5" />
              <stop offset="1" stopColor="#2d8eff" stopOpacity="0.0" />
            </linearGradient>
          </defs>
        </svg>
        {/* corner glyphs */}
        <CornerGlyphs />
      </motion.div>

      <motion.div style={{ y: yTitle, opacity, scale }} className="relative mx-auto max-w-7xl px-5 sm:px-8">
        {/* eyebrow */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="mx-auto flex w-fit items-center gap-3 rounded-full border border-white/15 bg-white/[0.04] px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.32em] text-fuchsia-200 backdrop-blur-xl"
        >
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-fuchsia-400 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-fuchsia-400" />
          </span>
          INDIA · GAMING CAFÉ NETWORK · ONLINE
        </motion.div>

        {/* MASSIVE TYPE */}
        <div className="mt-8 text-center">
          <SplitTitle text="ENTER" delay={0.1} />
          <div className="-mt-3 sm:-mt-6 md:-mt-10">
            <SplitTitle text="THE" delay={0.3} italic />
          </div>
          <div className="-mt-3 sm:-mt-6 md:-mt-10">
            <SplitTitle text="ARENA" delay={0.5} gradient />
          </div>
        </div>

        <motion.p
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 }}
          className="mx-auto mt-8 max-w-xl text-center text-base text-white/65 sm:text-lg"
        >
          Find India's best gaming cafés. Lock in your rig. <span className="text-white">Step inside the network.</span>
        </motion.p>

        {/* search */}
        <SearchBox query={query} setQuery={setQuery} cafes={cafes} />


        {/* city pills */}
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.25 }}
          className="mx-auto mt-5 flex max-w-3xl flex-wrap justify-center gap-2"
        >
          {cities.slice(0, 10).map((c) => (
            <button
              key={c} onClick={() => setCity(c)}
              className={`rounded-full border px-4 py-1.5 text-xs font-medium transition ${
                city === c
                  ? "border-fuchsia-400/60 bg-fuchsia-500/20 text-white shadow-[0_0_18px_rgba(255,82,224,.4)]"
                  : "border-white/10 bg-white/[0.03] text-white/60 hover:border-white/30 hover:text-white"
              }`}
            >
              {c === "all" ? "All Cities" : c}
            </button>
          ))}
        </motion.div>

        {/* scroll cue */}
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5 }}
          className="mx-auto mt-14 flex w-fit flex-col items-center gap-2 font-mono text-[10px] uppercase tracking-[0.32em] text-white/40"
        >
          <span>Scroll</span>
          <motion.div animate={{ y: [0, 8, 0], opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.8, repeat: Infinity }}
                      className="h-6 w-[2px] rounded-full bg-gradient-to-b from-fuchsia-400 to-transparent" />
        </motion.div>
      </motion.div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </section>
  );
}

function SplitTitle({ text, delay = 0, gradient = false, italic = false }: { text: string; delay?: number; gradient?: boolean; italic?: boolean }) {
  return (
    <h1
      className="font-display text-[18vw] font-black leading-[0.85] tracking-[-0.04em] sm:text-[16vw] md:text-[15vw] lg:text-[14rem]"
      style={italic ? { fontStyle: "italic", fontWeight: 300, letterSpacing: "-0.06em" } : undefined}
    >
      {text.split("").map((ch, i) => (
        <motion.span
          key={i}
          initial={{ y: "100%", opacity: 0, rotateX: -60 }}
          animate={{ y: "0%", opacity: 1, rotateX: 0 }}
          transition={{ delay: delay + i * 0.06, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          className="inline-block"
          style={gradient ? {
            background: "linear-gradient(135deg,#ff52e0 0%,#c084fc 40%,#7b2fff 70%,#2d8eff 100%)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            filter: "drop-shadow(0 0 40px rgba(255,82,224,.35))",
          } : undefined}
        >
          {ch}
        </motion.span>
      ))}
    </h1>
  );
}

function CornerGlyphs() {
  const items = [
    { c: "top-24 left-6", t: "N 28.61°" },
    { c: "top-24 right-6", t: "E 77.20°" },
    { c: "bottom-10 left-6", t: "SECTOR · 07" },
    { c: "bottom-10 right-6", t: "GRID · 4K" },
  ];
  return (
    <>
      {items.map((g) => (
        <div key={g.t} className={`absolute ${g.c} hidden font-mono text-[10px] uppercase tracking-[0.32em] text-white/35 md:block`}>
          + {g.t}
        </div>
      ))}
    </>
  );
}

/* =================================================================
   VELOCITY MARQUEE
================================================================= */
function MarqueeStrip() {
  const baseX = useMotionValue(0);
  const { scrollY } = useScroll();
  const scrollVel = useVelocity(scrollY);
  const smoothVel = useSpring(scrollVel, { damping: 50, stiffness: 400 });
  const velFactor = useTransform(smoothVel, [0, 1000], [0, 5], { clamp: false });
  const baseVelocity = -1.6;
  useAnimationFrame((_, delta) => {
    let move = baseVelocity * (delta / 1000) * 100;
    move += velFactor.get();
    baseX.set(wrap(-25, -75, baseX.get() + move * 0.01));
  });
  const x = useMotionTemplate`${baseX}%`;
  const items = ["FIND YOUR ARENA", "★", "BOOK A RIG", "★", "GAME ON", "★", "ENTER CORECADE", "★"];
  return (
    <section className="relative z-10 mt-24 overflow-hidden border-y border-white/10 bg-gradient-to-b from-transparent via-fuchsia-950/20 to-transparent py-6">
      <motion.div style={{ x }} className="flex whitespace-nowrap font-display text-5xl font-black uppercase tracking-tight sm:text-7xl">
        {Array.from({ length: 6 }).map((_, k) => (
          <span key={k} className="flex shrink-0 items-center">
            {items.map((it, i) => (
              <span key={`${k}-${i}`} className={`mx-6 ${it === "★" ? "text-fuchsia-400" : ""}`}
                    style={it !== "★" ? {
                      WebkitTextStroke: "1.5px rgba(255,255,255,0.85)",
                      WebkitTextFillColor: "transparent",
                    } : undefined}>{it}</span>
            ))}
          </span>
        ))}
      </motion.div>
    </section>
  );
}

/* =================================================================
   PINNED MANIFESTO (sticky scroll word reveal)
================================================================= */
function PinnedManifesto() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const text = "A NETWORK BUILT FOR GAMERS. EVERY ARENA. EVERY CITY. ONE TAP AWAY.";
  const words = text.split(" ");

  return (
    <section ref={ref} className="relative z-10 mx-auto mt-32 max-w-7xl px-5 sm:px-8">
      <div className="font-mono text-[10px] uppercase tracking-[0.32em] text-fuchsia-300">/ Manifesto</div>
      <p className="mt-6 flex flex-wrap font-display text-3xl font-black leading-[1.1] tracking-tight sm:text-5xl md:text-6xl">
        {words.map((w, i) => {
          const start = i / words.length;
          const end = start + 1 / words.length;
          return <RevealWord key={i} progress={scrollYProgress} range={[start * 0.85, end * 0.85 + 0.05]} word={w} />;
        })}
      </p>
    </section>
  );
}
function RevealWord({ progress, range, word }: { progress: any; range: [number, number]; word: string }) {
  const opacity = useTransform(progress, range, [0.18, 1]);
  const y = useTransform(progress, range, [10, 0]);
  return (
    <motion.span style={{ opacity, y }} className="mr-3">{word}</motion.span>
  );
}

/* =================================================================
   ARENA SHOWCASE
================================================================= */
function ArenaShowcase({ cafes, loading }: { cafes: Cafe[]; loading: boolean }) {
  return (
    <section className="relative z-10 mx-auto mt-32 max-w-7xl px-5 sm:px-8">
      <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-end">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.32em] text-fuchsia-300">/ Featured Arenas</div>
          <h2 className="mt-3 font-display text-4xl font-black tracking-tight sm:text-6xl">
            Pick a <span style={{ background: "linear-gradient(135deg,#ff52e0,#7b2fff,#2d8eff)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Battleground</span>
          </h2>
          <p className="mt-3 max-w-md text-sm text-white/60">
            {cafes.length} arena{cafes.length !== 1 && "s"} live. Hover, tilt, and step in.
          </p>
        </div>
        <Link to="/auth" className="group inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.03] px-5 py-2.5 text-sm text-white/80 hover:bg-white/[0.08]">
          View all <ArrowUpRight className="h-4 w-4 transition group-hover:rotate-45" />
        </Link>
      </div>

      <AnimatePresence mode="wait">
        {loading ? (
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-[420px] animate-pulse rounded-3xl border border-white/10 bg-white/[0.03]" />
            ))}
          </div>
        ) : cafes.length === 0 ? (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-16 text-center">
            <motion.div animate={{ y: [0, -10, 0], rotate: [0, 6, -6, 0] }} transition={{ duration: 4, repeat: Infinity }}
              className="mx-auto grid h-24 w-24 place-items-center rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur">
              <Gamepad2 className="h-12 w-12 text-fuchsia-300" />
            </motion.div>
            <p className="mt-6 font-display text-xl text-white/80">No arenas online here yet</p>
            <p className="mt-2 text-sm text-white/50">Try another city or clear the search.</p>
          </motion.div>
        ) : (
          <motion.div key="grid" layout className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {cafes.slice(0, 12).map((c, i) => (<ArenaCard key={c.id} cafe={c} index={i} />))}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function ArenaCard({ cafe, index }: { cafe: Cafe; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0), my = useMotionValue(0);
  const rx = useSpring(useTransform(my, [-0.5, 0.5], [12, -12]), { stiffness: 280, damping: 22 });
  const ry = useSpring(useTransform(mx, [-0.5, 0.5], [-14, 14]), { stiffness: 280, damping: 22 });
  const spotX = useMotionValue(-200), spotY = useMotionValue(-200);
  const spot = useMotionTemplate`radial-gradient(380px circle at ${spotX}px ${spotY}px, rgba(255,82,224,.22), transparent 60%)`;

  const onMove = (e: React.MouseEvent) => {
    const r = ref.current?.getBoundingClientRect(); if (!r) return;
    mx.set((e.clientX - r.left) / r.width - 0.5);
    my.set((e.clientY - r.top) / r.height - 0.5);
    spotX.set(e.clientX - r.left); spotY.set(e.clientY - r.top);
  };

  return (
    <motion.div
      layout ref={ref} onMouseMove={onMove}
      onMouseLeave={() => { mx.set(0); my.set(0); spotX.set(-200); spotY.set(-200); }}
      initial={{ opacity: 0, y: 50 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-80px" }}
      transition={{ delay: index * 0.06, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      style={{ rotateX: rx, rotateY: ry, transformPerspective: 1100, transformStyle: "preserve-3d" }}
      whileHover={{ y: -8 }}
      data-cursor
      className="group relative overflow-hidden rounded-3xl border border-white/10 bg-[rgba(14,9,32,0.7)] backdrop-blur-xl transition-colors hover:border-fuchsia-400/40"
    >
      {/* spotlight */}
      <motion.div className="pointer-events-none absolute inset-0 z-10 opacity-0 transition-opacity duration-300 group-hover:opacity-100" style={{ background: spot }} />
      {/* conic glow border on hover */}
      <div className="pointer-events-none absolute -inset-[1px] rounded-3xl opacity-0 transition-opacity duration-500 group-hover:opacity-100"
           style={{ background: "conic-gradient(from var(--a,0deg),#ff52e0,#7b2fff,#2d8eff,#ff52e0)", WebkitMask: "linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0)", WebkitMaskComposite: "xor" as any, padding: "1px" }} />

      <div className="relative h-48 overflow-hidden">
        {cafe.cover_url ? (
          <img src={cafe.cover_url} alt={cafe.name} className="h-full w-full object-cover transition-transform duration-[1200ms] group-hover:scale-110" />
        ) : (
          <div className="h-full w-full" style={{ background: "linear-gradient(135deg,#ff52e0 0%,#7b2fff 40%,#2d8eff 80%)", backgroundSize: "200% 200%", animation: "gradShift 8s ease infinite" }} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[rgba(10,7,26,0.95)] via-[rgba(10,7,26,0.35)] to-transparent" />
        <div className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-500/15 px-2.5 py-1 backdrop-blur">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-emerald-300">LIVE</span>
        </div>
        <div className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full border border-white/15 bg-black/40 px-2.5 py-1 backdrop-blur">
          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
          <span className="font-mono text-[10px] text-white/90">4.7</span>
        </div>
        <div className="absolute inset-x-0 bottom-0 p-5" style={{ transform: "translateZ(40px)" }}>
          <h3 className="font-display text-2xl font-bold leading-tight">{cafe.name}</h3>
          <div className="mt-1 flex items-center gap-1.5 text-sm text-fuchsia-200/90">
            <MapPin className="h-3.5 w-3.5" /> {cafe.city ?? "—"}{cafe.state ? `, ${cafe.state}` : ""}
          </div>
        </div>
        {/* shine sweep */}
        <div className="pointer-events-none absolute inset-0 -translate-x-full transition-transform duration-1000 group-hover:translate-x-full"
             style={{ background: "linear-gradient(110deg,transparent 40%,rgba(255,255,255,.16) 50%,transparent 60%)" }} />
      </div>

      <div className="relative z-10 p-5" style={{ transform: "translateZ(20px)" }}>
        {cafe.description && <p className="line-clamp-2 text-sm text-white/65">{cafe.description}</p>}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Chip icon={Cpu}>PC · Console</Chip>
          <Chip icon={Headphones}>Studio Audio</Chip>
          <Chip>₹ from ₹60/hr</Chip>
        </div>
        <Link to="/c/$slug" params={{ slug: cafe.slug }}
          className="group/btn relative mt-5 inline-flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl px-4 py-3 font-semibold text-white transition"
          style={{ background: "linear-gradient(135deg,#ff52e0,#7b2fff,#2d8eff)", boxShadow: "0 12px 36px -10px rgba(255,82,224,.55)" }}>
          <span className="relative z-10">Step Inside</span>
          <ArrowRight className="relative z-10 h-4 w-4 transition group-hover/btn:translate-x-1" />
          <span className="absolute inset-0 -translate-x-full bg-white/20 transition-transform duration-500 group-hover/btn:translate-x-0" />
        </Link>
      </div>
      <style>{`@keyframes gradShift { 0%,100% { background-position: 0% 50% } 50% { background-position: 100% 50% } }`}</style>
    </motion.div>
  );
}
function Chip({ icon: Icon, children }: { icon?: any; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 font-mono text-[10px] text-white/75">
      {Icon ? <Icon className="h-3 w-3" /> : null}{children}
    </span>
  );
}

/* =================================================================
   PARALLAX STATS
================================================================= */
function ParallaxStats() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [60, -60]);
  const stats = [
    { v: 120, suf: "+", label: "Arenas", icon: Gamepad2 },
    { v: 50000, suf: "+", label: "Sessions", icon: Zap },
    { v: 10000, suf: "+", label: "Gamers", icon: Crown },
    { v: 15, suf: "", label: "Cities", icon: MapPin },
  ];
  return (
    <section ref={ref} className="relative z-10 mx-auto mt-32 max-w-7xl px-5 sm:px-8">
      <motion.div style={{ y }} className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-fuchsia-950/40 via-[#0a0720]/80 to-blue-950/40 p-8 backdrop-blur-xl sm:p-12">
        <div className="pointer-events-none absolute -right-20 -top-20 h-80 w-80 rounded-full bg-fuchsia-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-20 h-80 w-80 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          {stats.map((s, i) => (
            <CountStat key={s.label} target={s.v} suffix={s.suf} label={s.label} icon={s.icon} delay={i * 0.08} />
          ))}
        </div>
      </motion.div>
    </section>
  );
}
function CountStat({ target, suffix, label, icon: Icon, delay }: { target: number; suffix: string; label: string; icon: any; delay: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [n, setN] = useState(0);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        const start = performance.now();
        const tick = (t: number) => {
          const p = Math.min(1, (t - start) / 1600);
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
    <div ref={ref} className="relative">
      <Icon className="mb-3 h-5 w-5 text-fuchsia-300" />
      <div className="font-display text-4xl font-black sm:text-5xl"
           style={{ background: "linear-gradient(135deg,#fff,#ff52e0)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
        {n.toLocaleString("en-IN")}{suffix}
      </div>
      <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.28em] text-white/55">{label}</div>
    </div>
  );
}

/* =================================================================
   RITUAL — sticky steps
================================================================= */
function RitualSection() {
  const steps = [
    { n: "01", icon: UserPlus, t: "Create your handle", d: "Free 60-second signup. Pick a callsign. You're in." },
    { n: "02", icon: Search, t: "Scout an arena", d: "Live map of every CoreCade café near you, vibes included." },
    { n: "03", icon: Calendar, t: "Lock your rig", d: "Pick a device, pick a time slot. Confirmed in seconds." },
    { n: "04", icon: PlayCircle, t: "Press start", d: "Walk in. Game on. Earn loyalty with every session." },
  ];
  return (
    <section className="relative z-10 mx-auto mt-32 max-w-7xl px-5 sm:px-8">
      <div className="grid gap-12 lg:grid-cols-[1fr_2fr]">
        <div className="lg:sticky lg:top-32 lg:self-start">
          <div className="font-mono text-[10px] uppercase tracking-[0.32em] text-fuchsia-300">/ The Ritual</div>
          <h2 className="mt-3 font-display text-4xl font-black tracking-tight sm:text-6xl">
            Four moves<br />to <span style={{ background: "linear-gradient(135deg,#ff52e0,#2d8eff)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>game on</span>.
          </h2>
          <p className="mt-4 max-w-sm text-white/60">
            Zero friction. Pure entry. The exact path every CoreCade gamer takes — from first tap to first kill.
          </p>
        </div>
        <div className="relative space-y-6">
          {/* vertical line */}
          <div className="absolute left-6 top-0 hidden h-full w-px bg-gradient-to-b from-fuchsia-500/60 via-violet-500/30 to-transparent sm:block" />
          {steps.map((s, i) => (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, x: 40 }} whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ delay: i * 0.08, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="group relative flex gap-5 rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl transition hover:border-fuchsia-400/40 hover:bg-white/[0.06] sm:p-7"
            >
              <div className="relative grid h-12 w-12 shrink-0 place-items-center rounded-xl"
                   style={{ background: "linear-gradient(135deg,#ff52e0,#7b2fff)", boxShadow: "0 0 22px rgba(255,82,224,.45)" }}>
                <s.icon className="h-6 w-6 text-white" />
              </div>
              <div className="flex-1">
                <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-fuchsia-300">Step {s.n}</div>
                <div className="mt-1 font-display text-2xl font-bold">{s.t}</div>
                <p className="mt-2 text-sm text-white/65">{s.d}</p>
              </div>
              <ArrowUpRight className="hidden h-5 w-5 self-center text-white/30 transition group-hover:rotate-45 group-hover:text-white sm:block" />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* =================================================================
   PERKS BENTO
================================================================= */
function PerksSection() {
  return (
    <section className="relative z-10 mx-auto mt-32 max-w-7xl px-5 sm:px-8">
      <div className="text-center">
        <div className="font-mono text-[10px] uppercase tracking-[0.32em] text-fuchsia-300">/ Why CoreCade</div>
        <h2 className="mt-3 font-display text-4xl font-black tracking-tight sm:text-6xl">
          Built for the <span className="italic" style={{ background: "linear-gradient(135deg,#ff52e0,#2d8eff)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>grind</span>.
        </h2>
      </div>
      <div className="mt-12 grid gap-5 sm:grid-cols-6">
        <Perk className="sm:col-span-3" icon={Zap} title="Instant booking" desc="Confirm a seat in seconds. No calls. No waiting." accent="from-fuchsia-500 to-rose-500" />
        <Perk className="sm:col-span-3" icon={Trophy} title="Realtime status" desc="Live device map across the entire network." accent="from-violet-500 to-fuchsia-500" />
        <Perk className="sm:col-span-2" icon={Gift} title="Loyalty XP" desc="Earn points. Redeem anywhere." accent="from-blue-500 to-violet-500" />
        <Perk className="sm:col-span-2" icon={Crown} title="Tournaments" desc="Compete weekly. Stack the bracket." accent="from-amber-500 to-fuchsia-500" />
        <Perk className="sm:col-span-2" icon={Cpu} title="Top-tier rigs" desc="Curated PCs, consoles, sims." accent="from-emerald-500 to-blue-500" />
      </div>
    </section>
  );
}
function Perk({ className = "", icon: Icon, title, desc, accent }: { className?: string; icon: any; title: string; desc: string; accent: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(-200), my = useMotionValue(-200);
  const bg = useMotionTemplate`radial-gradient(280px circle at ${mx}px ${my}px, rgba(255,82,224,.18), transparent 60%)`;
  return (
    <motion.div
      ref={ref} data-cursor
      onMouseMove={(e) => { const r = ref.current?.getBoundingClientRect(); if (!r) return; mx.set(e.clientX - r.left); my.set(e.clientY - r.top); }}
      onMouseLeave={() => { mx.set(-200); my.set(-200); }}
      initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
      transition={{ duration: 0.6 }}
      className={`group relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-7 backdrop-blur-xl transition hover:border-fuchsia-400/40 ${className}`}
    >
      <motion.div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" style={{ background: bg }} />
      <div className={`grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br ${accent}`} style={{ boxShadow: "0 0 22px rgba(255,82,224,.35)" }}>
        <Icon className="h-6 w-6 text-white" />
      </div>
      <h3 className="mt-5 font-display text-xl font-bold">{title}</h3>
      <p className="mt-2 text-sm text-white/65">{desc}</p>
    </motion.div>
  );
}

/* =================================================================
   FINAL CTA
================================================================= */
function FinalCTA() {
  return (
    <section className="relative z-10 mx-auto mt-32 max-w-7xl px-5 sm:px-8">
      <div className="relative overflow-hidden rounded-[2.5rem] border border-white/10 p-10 text-center sm:p-20"
           style={{ background: "radial-gradient(ellipse at top, rgba(255,82,224,.25), transparent 60%), linear-gradient(180deg,#10082a,#04030c)" }}>
        <div className="pointer-events-none absolute inset-0 opacity-30"
             style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.4) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.4) 1px,transparent 1px)", backgroundSize: "44px 44px", maskImage: "radial-gradient(ellipse 60% 50% at 50% 50%,#000,transparent)", WebkitMaskImage: "radial-gradient(ellipse 60% 50% at 50% 50%,#000,transparent)" }} />
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                    className="font-mono text-[10px] uppercase tracking-[0.32em] text-fuchsia-300">/ Ready Player One</motion.div>
        <h2 className="relative mt-5 font-display text-5xl font-black leading-[0.95] tracking-tight sm:text-7xl md:text-8xl">
          Your arena<br />
          <span className="italic font-light" style={{ background: "linear-gradient(135deg,#ff52e0,#7b2fff,#2d8eff)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            is waiting.
          </span>
        </h2>
        <p className="mx-auto mt-6 max-w-md text-white/65">Join 10,000+ gamers across India already playing on CoreCade.</p>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Link to="/auth">
            <button data-cursor className="group inline-flex items-center gap-2 rounded-full px-7 py-4 font-semibold text-white"
                    style={{ background: "linear-gradient(135deg,#ff52e0,#7b2fff,#2d8eff)", boxShadow: "0 0 40px rgba(255,82,224,.55)" }}>
              Create Free Account <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </button>
          </Link>
          <Link to="/auth">
            <button data-cursor className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-7 py-4 font-semibold text-white backdrop-blur hover:bg-white/10">
              I have an account
            </button>
          </Link>
        </div>
      </div>
    </section>
  );
}

/* =================================================================
   FOOTER
================================================================= */
function Footer() {
  return (
    <footer className="relative z-10 mt-24 border-t border-white/10 px-5 py-12 sm:px-8">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 sm:flex-row">
        <div className="text-center sm:text-left">
          <div className="font-display text-lg font-black tracking-[0.2em]">CORECADE</div>
          <p className="mt-1 text-xs text-white/50">The gaming café universe, unified.</p>
        </div>
        <nav className="flex flex-wrap items-center justify-center gap-5 text-xs text-white/60">
          <Link to="/discover" className="hover:text-white">Discover</Link>
          <Link to="/auth" className="hover:text-white">Sign Up</Link>
          <Link to="/auth" className="hover:text-white">Login</Link>
          <Link to="/" className="hover:text-white">Owners</Link>
        </nav>
        <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-white/40">© 2026 CoreCade</div>
      </div>
    </footer>
  );
}
