import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useRef, useState, useEffect } from "react";
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from "framer-motion";
import { Mail, Lock, User, ArrowRight, Eye, EyeOff, ShieldCheck, Zap, Sparkles } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuroraBackground } from "@/components/AuroraBackground";
import { BrandLockup, BrandMark } from "@/components/Brand";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in — CoreCade" },
      { name: "description", content: "Sign in to your CoreCade account." },
    ],
  }),
  component: AuthPage,
});

type Mode = "signin" | "signup" | "forgot";

function AuthPage() {
  const [mode, setMode] = useState<Mode>("signin");
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [shake, setShake] = useState(false);
  const navigate = useNavigate();

  // Validation state (drives magnetic-evading button)
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const pwValid = password.length >= 8;
  const nameValid = mode !== "signup" || fullName.trim().length >= 2;
  const formValid =
    mode === "forgot" ? emailValid : emailValid && pwValid && nameValid;

  const triggerShake = () => {
    setShake(true);
    window.setTimeout(() => setShake(false), 600);
  };

  const handle = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!formValid) {
      triggerShake();
      const why =
        mode === "forgot"
          ? "Enter a valid email."
          : !emailValid
            ? "Enter a valid email."
            : !nameValid
              ? "Tell us your name."
              : "Password must be 8+ characters.";
      toast.error(why);
      return;
    }
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: {
            emailRedirectTo: `${window.location.origin}/portal`,
            data: { full_name: fullName },
          },
        });
        if (error) throw error;
        toast.success("Account created. Check your email if confirmation is required.");
        await routeByRole(navigate);
      } else if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back.");
        await routeByRole(navigate);
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("Reset link sent. Check your email.");
        setMode("signin");
      }
    } catch (err) {
      triggerShake();
      toast.error(err instanceof Error ? err.message : "Authentication failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <AuroraBackground intensity="immersive" />
      {/* Scanline noise */}
      <div className="pointer-events-none fixed inset-0 -z-10 opacity-[0.08] mix-blend-overlay"
           style={{ backgroundImage: "repeating-linear-gradient(0deg, transparent 0 2px, rgba(255,255,255,0.6) 2px 3px)" }} />

      {/* Top nav */}
      <div className="relative z-20 mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
        <BrandLockup size={32} />
        <Link
          to="/"
          className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground transition hover:text-foreground"
        >
          ← corecade.com
        </Link>
      </div>

      <div className="relative z-10 mx-auto grid min-h-[calc(100vh-80px)] max-w-7xl items-center gap-8 px-5 pb-16 sm:px-8 lg:grid-cols-[1.05fr_1fr]">
        {/* LEFT — cinematic hero */}
        <HeroPanel />

        {/* RIGHT — 3D tilt form card */}
        <TiltCard shake={shake}>
          <motion.div
            key={mode}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="relative"
          >
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.28em] text-primary">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
              </span>
              {mode === "signin" && "Secure access · TLS 1.3"}
              {mode === "signup" && "New player · customer access"}
              {mode === "forgot" && "Recovery channel"}
            </div>
            <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
              {mode === "signin" && (<>Welcome <span className="text-gradient-hot">back</span></>)}
              {mode === "signup" && (<>Create customer <span className="text-gradient-hot">account</span></>)}
              {mode === "forgot" && (<>Reset <span className="text-gradient-hot">password</span></>)}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {mode === "signin" && "Sign in with email and password to enter the right dashboard."}
              {mode === "signup" && "New accounts start as customers. Café owner access is granted by admin only."}
              {mode === "forgot" && "We'll email you a one-time reset link."}
            </p>

            {/* Mode tabs */}
            {mode !== "forgot" && (
              <div className="mt-5 inline-flex rounded-xl border border-border/60 bg-background/40 p-1 backdrop-blur">
                {(["signin", "signup"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className={`relative px-4 py-1.5 text-xs font-semibold uppercase tracking-wider transition ${
                      mode === m ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {mode === m && (
                      <motion.span
                        layoutId="auth-pill"
                        className="absolute inset-0 rounded-lg"
                        style={{ background: "var(--gradient-brand-hot)" }}
                        transition={{ type: "spring", stiffness: 350, damping: 28 }}
                      />
                    )}
                    <span className="relative">{m === "signin" ? "Sign in" : "Sign up"}</span>
                  </button>
                ))}
              </div>
            )}

            {mode !== "forgot" && (
              <div className="mt-6 space-y-3">
                <button
                  type="button"
                  disabled={loading}
                  onClick={async () => {
                    setLoading(true);
                    try {
                      const { error } = await supabase.auth.signInWithOAuth({
                        provider: "google",
                        options: { redirectTo: `${window.location.origin}/auth` },
                      });
                      if (error) throw error;
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Google sign-in failed");
                      setLoading(false);
                    }
                  }}
                  className="group relative flex h-12 w-full items-center justify-center gap-3 overflow-hidden rounded-xl border border-border/70 bg-background/60 font-semibold text-foreground backdrop-blur transition hover:border-primary/50 hover:bg-background/80"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden>
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18A10.99 10.99 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.83z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
                  </svg>
                  Continue with Google
                </button>
                <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                  <span className="h-px flex-1 bg-border/60" />
                  or with email
                  <span className="h-px flex-1 bg-border/60" />
                </div>
              </div>
            )}

            <form onSubmit={handle} noValidate className="mt-6 space-y-4">
              <AnimatePresence initial={false}>
                {mode === "signup" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-2"
                  >
                    <Label htmlFor="fullName">Full name</Label>
                    <FieldShell icon={<User className="h-4 w-4" />}>
                      <Input
                        id="fullName"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Your name"
                        className="h-12 border-0 bg-transparent pl-10 focus-visible:ring-0"
                      />
                    </FieldShell>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <FieldShell icon={<Mail className="h-4 w-4" />} valid={email.length > 0 && emailValid}>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@cafe.in"
                    className="h-12 border-0 bg-transparent pl-10 focus-visible:ring-0"
                  />
                </FieldShell>
              </div>

              {mode !== "forgot" && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    {mode === "signin" && (
                      <button type="button" onClick={() => setMode("forgot")} className="text-xs text-primary hover:underline">
                        Forgot?
                      </button>
                    )}
                  </div>
                  <FieldShell icon={<Lock className="h-4 w-4" />} valid={password.length > 0 && pwValid}>
                    <Input
                      id="password"
                      type={showPw ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="h-12 border-0 bg-transparent pl-10 pr-10 focus-visible:ring-0"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((s) => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition hover:text-foreground"
                      aria-label="Toggle password visibility"
                    >
                      {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </FieldShell>
                  {mode === "signup" && <PasswordMeter value={password} />}
                </div>
              )}

              <MagneticSubmit
                disabled={loading}
                valid={formValid}
                onInvalid={() => { triggerShake(); toast.error("Fill the required fields correctly."); }}
                label={
                  loading ? "Please wait…"
                    : mode === "signin" ? "Sign in"
                      : mode === "signup" ? "Create account"
                        : "Send reset link"
                }
              />
            </form>

            <div className="mt-5 text-center text-sm text-muted-foreground">
              {mode === "forgot" ? (
                <button onClick={() => setMode("signin")} className="text-primary hover:underline">← Back to sign in</button>
              ) : mode === "signin" ? (
                <>New here? <button onClick={() => setMode("signup")} className="text-primary hover:underline">Create an account</button></>
              ) : (
                <>Already an operator? <button onClick={() => setMode("signin")} className="text-primary hover:underline">Sign in</button></>
              )}
            </div>

            <div className="mt-6 flex items-center justify-center gap-4 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3 w-3 text-primary" /> SOC-2 ready</span>
              <span className="h-3 w-px bg-border/60" />
              <span className="inline-flex items-center gap-1.5"><Zap className="h-3 w-3 text-primary" /> 60ms p95</span>
            </div>
          </motion.div>
        </TiltCard>
      </div>
    </div>
  );
}

/* -------------------- Hero panel -------------------- */
function HeroPanel() {
  return (
    <div className="relative hidden lg:block">
      <motion.div
        initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="relative"
      >
        <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/40 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.22em] text-primary backdrop-blur">
          <Sparkles className="h-3 w-3" /> Operating system · v1
        </div>
        <h2 className="mt-6 font-display text-6xl font-extrabold leading-[0.95] tracking-tight xl:text-7xl">
          The console for<br />
          <span className="text-gradient-hot">gaming cafés.</span>
        </h2>
        <p className="mt-6 max-w-md text-muted-foreground">
          Real-time sessions. Instant bookings. Mobile-first portals.
          Built for the floor, not the boardroom.
        </p>

        <div className="mt-10 grid max-w-md grid-cols-3 gap-4">
          {[
            { k: "12", v: "Cities" },
            { k: "30+", v: "Cafés" },
            { k: "99.98%", v: "Uptime" },
          ].map((s) => (
            <div key={s.v} className="rounded-2xl border border-border/60 bg-background/30 p-4 backdrop-blur">
              <div className="font-display text-2xl font-extrabold text-gradient">{s.k}</div>
              <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">{s.v}</div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Floating 3D mark with parallax */}
      <FloatingMark />

      <div className="mt-12 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
        🇮🇳 Made in India · Trusted across 12 cities
      </div>
    </div>
  );
}

function FloatingMark() {
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rx = useSpring(useTransform(my, [-1, 1], [12, -12]), { stiffness: 100, damping: 14 });
  const ry = useSpring(useTransform(mx, [-1, 1], [-18, 18]), { stiffness: 100, damping: 14 });

  return (
    <div
      className="relative mt-12 h-64"
      style={{ perspective: 1200 }}
      onMouseMove={(e) => {
        const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
        mx.set(((e.clientX - (r.left + r.width / 2)) / (r.width / 2)));
        my.set(((e.clientY - (r.top + r.height / 2)) / (r.height / 2)));
      }}
      onMouseLeave={() => { mx.set(0); my.set(0); }}
    >
      <motion.div
        style={{ rotateX: rx, rotateY: ry, transformStyle: "preserve-3d" }}
        className="relative mx-auto h-full w-fit"
      >
        {/* Glow orbs */}
        <div className="absolute -left-12 top-6 h-40 w-40 rounded-full blur-[60px]"
             style={{ background: "radial-gradient(circle, oklch(0.74 0.21 15 / 0.55), transparent 70%)" }} />
        <div className="absolute -right-8 bottom-0 h-44 w-44 rounded-full blur-[70px]"
             style={{ background: "radial-gradient(circle, oklch(0.65 0.25 295 / 0.6), transparent 70%)" }} />
        <motion.div
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          className="relative"
          style={{ transform: "translateZ(40px)" }}
        >
          <BrandMark size={180} />
        </motion.div>

        {/* Orbit ring */}
        <div
          className="pointer-events-none absolute inset-0 m-auto h-56 w-56 rounded-full border border-primary/30"
          style={{ transform: "translateZ(-20px) rotateX(70deg)" }}
        />
        <div
          className="pointer-events-none absolute inset-0 m-auto h-72 w-72 rounded-full border border-primary/15"
          style={{ transform: "translateZ(-40px) rotateX(70deg)" }}
        />
      </motion.div>
    </div>
  );
}

/* -------------------- Tilt card -------------------- */
function TiltCard({ children, shake }: { children: React.ReactNode; shake: boolean }) {
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rx = useSpring(useTransform(my, [-1, 1], [4, -4]), { stiffness: 120, damping: 14 });
  const ry = useSpring(useTransform(mx, [-1, 1], [-6, 6]), { stiffness: 120, damping: 14 });
  const spotX = useTransform(mx, [-1, 1], ["0%", "100%"]);
  const spotY = useTransform(my, [-1, 1], ["0%", "100%"]);
  const spot = useTransform(
    [spotX, spotY] as unknown as [typeof spotX, typeof spotY],
    ([x, y]) => `radial-gradient(500px circle at ${x} ${y}, oklch(0.74 0.21 15 / 0.18), transparent 50%)`,
  );

  return (
    <div
      className="relative mx-auto w-full max-w-md"
      style={{ perspective: 1400 }}
      onMouseMove={(e) => {
        const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
        mx.set(((e.clientX - (r.left + r.width / 2)) / (r.width / 2)));
        my.set(((e.clientY - (r.top + r.height / 2)) / (r.height / 2)));
      }}
      onMouseLeave={() => { mx.set(0); my.set(0); }}
    >
      {/* Conic glow */}
      <div className="pointer-events-none absolute -inset-4 rounded-[2rem] opacity-70 blur-2xl"
           style={{ background: "conic-gradient(from 120deg at 50% 50%, oklch(0.74 0.21 15 / 0.45), oklch(0.7 0.26 335 / 0.35), oklch(0.65 0.25 295 / 0.45), oklch(0.74 0.21 15 / 0.45))" }} />
      <motion.div
        animate={shake ? { x: [0, -10, 10, -8, 8, -4, 0] } : { x: 0 }}
        transition={{ duration: 0.55 }}
        style={{ rotateX: rx, rotateY: ry, transformStyle: "preserve-3d" }}
        className="relative rounded-[1.6rem] p-px"
      >
        <div className="rounded-[1.6rem] p-px" style={{ background: "linear-gradient(135deg, oklch(0.74 0.21 15 / 0.7), oklch(0.65 0.25 295 / 0.5) 50%, oklch(0.7 0.26 335 / 0.6))" }}>
          <div className="relative overflow-hidden rounded-[1.55rem] bg-card/70 p-7 backdrop-blur-2xl sm:p-9">
            {/* Animated grid */}
            <div className="pointer-events-none absolute inset-0 opacity-[0.07]"
                 style={{ backgroundImage: "linear-gradient(oklch(0.74 0.21 15 / 1) 1px, transparent 1px), linear-gradient(90deg, oklch(0.74 0.21 15 / 1) 1px, transparent 1px)", backgroundSize: "28px 28px", maskImage: "radial-gradient(circle at 30% 0%, black, transparent 70%)" }} />
            <motion.div className="pointer-events-none absolute inset-0" style={{ background: spot }} />
            <div className="relative" style={{ transform: "translateZ(30px)" }}>
              {children}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

/* -------------------- Field shell w/ glow + valid tick -------------------- */
function FieldShell({ icon, children, valid }: { icon: React.ReactNode; children: React.ReactNode; valid?: boolean }) {
  return (
    <div className="group relative">
      <div
        className={`absolute -inset-px rounded-xl opacity-0 blur transition group-focus-within:opacity-100 ${valid ? "opacity-60" : ""}`}
        style={{ background: "linear-gradient(135deg, oklch(0.74 0.21 15 / 0.55), oklch(0.7 0.26 335 / 0.55))" }}
        aria-hidden
      />
      <div className="relative rounded-xl border border-border/70 bg-background/60 backdrop-blur transition group-focus-within:border-primary/60">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">{icon}</span>
        {children}
        {valid && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-400">
            <Check />
          </span>
        )}
      </div>
    </div>
  );
}

function Check() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

/* -------------------- Password strength meter -------------------- */
function PasswordMeter({ value }: { value: string }) {
  const score =
    (value.length >= 8 ? 1 : 0) +
    (/[A-Z]/.test(value) ? 1 : 0) +
    (/\d/.test(value) ? 1 : 0) +
    (/[^A-Za-z0-9]/.test(value) ? 1 : 0);
  const labels = ["Too weak", "Weak", "Okay", "Strong", "Elite"];
  const colors = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#a855f7"];
  return (
    <div className="mt-2">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-1 flex-1 rounded-full bg-border/60 overflow-hidden">
            <motion.div
              initial={false}
              animate={{ width: i < score ? "100%" : "0%" }}
              className="h-full"
              style={{ background: colors[Math.max(0, score - 1)] }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {value ? labels[score] : "8+ chars · upper · number · symbol"}
      </div>
    </div>
  );
}

/* -------------------- Magnetic submit (evades if invalid) -------------------- */
function MagneticSubmit({
  label, disabled, valid, onInvalid,
}: { label: string; disabled: boolean; valid: boolean; onInvalid: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const x = useSpring(mx, { stiffness: 250, damping: 18 });
  const y = useSpring(my, { stiffness: 250, damping: 18 });

  const handleMove = (e: React.MouseEvent) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;

    if (!valid) {
      // Magnetic REPULSION when invalid — flee the cursor
      const dist = Math.hypot(dx, dy);
      const near = dist < 200;
      if (near) {
        const push = (200 - dist) * 0.6;
        const ang = Math.atan2(dy, dx);
        mx.set(-Math.cos(ang) * push);
        my.set(-Math.sin(ang) * push);
      } else {
        mx.set(0); my.set(0);
      }
    } else {
      // Attraction when valid
      mx.set(dx * 0.18);
      my.set(dy * 0.2);
    }
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={() => { mx.set(0); my.set(0); }}
      style={{ x, y }}
      className="relative pt-1"
    >
      <button
        type={valid ? "submit" : "button"}
        onClick={(e) => { if (!valid) { e.preventDefault(); onInvalid(); } }}
        disabled={disabled}
        aria-disabled={!valid}
        className={`group relative h-12 w-full overflow-hidden rounded-xl text-base font-semibold text-primary-foreground transition ${valid ? "" : "opacity-80"}`}
        style={{ background: "var(--gradient-brand-hot)" }}
      >
        <span className={`absolute -inset-2 rounded-2xl opacity-70 blur-2xl transition group-hover:opacity-100 ${valid ? "" : "opacity-40"}`}
              style={{ background: "radial-gradient(circle, oklch(0.74 0.21 15 / 0.6), transparent 70%)" }} aria-hidden />
        <span className="absolute inset-0 overflow-hidden rounded-xl" aria-hidden>
          <span className="absolute -inset-y-2 -left-1/2 w-1/2 rotate-12 bg-gradient-to-r from-transparent via-white/40 to-transparent opacity-0 transition-all duration-700 group-hover:left-[120%] group-hover:opacity-100" />
        </span>
        <span className="relative z-10 inline-flex items-center justify-center gap-2">
          {label}
          <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
        </span>
      </button>
    </motion.div>
  );
}

// Only this email may ever route into /admin. Defense-in-depth alongside the
// route's beforeLoad role gate and DB-level RLS.
const SUPER_ADMIN_EMAIL = "giganexa2026@gmail.com";

async function routeByRole(navigate: ReturnType<typeof useNavigate>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) { navigate({ to: "/auth" }); return; }
  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
  const set = new Set((roles ?? []).map((r) => r.role));
  const isSuperAdmin = set.has("super_admin") && user.email?.toLowerCase() === SUPER_ADMIN_EMAIL;
  if (isSuperAdmin) navigate({ to: "/admin" });
  else if (set.has("cafe_owner")) navigate({ to: "/owner" });
  else navigate({ to: "/portal" });
}
