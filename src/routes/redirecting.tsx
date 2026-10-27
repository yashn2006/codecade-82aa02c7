import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AuroraBackground } from "@/components/AuroraBackground";
import { BrandMark } from "@/components/Brand";
import { getDashboardPathForUser, getSupabaseUserReady, type DashboardPath } from "@/lib/auth-routing";
import { ShieldCheck, Cpu, Sparkles, Check } from "lucide-react";

export const Route = createFileRoute("/redirecting")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Entering CoreCade…" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  pendingComponent: RedirectingFallback,
  component: RedirectingPage,
});

const STEPS = [
  { icon: ShieldCheck, label: "Verifying secure session" },
  { icon: Cpu, label: "Loading your workspace" },
  { icon: Sparkles, label: "Tuning the console" },
];

type Phase = 0 | 1 | 2 | 3; // 3 = done
const PHASE_TARGET = [30, 66, 92, 100];
const MIN_PHASE_MS = 420;

const sleep = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => window.setTimeout(() => reject(new Error("timeout")), ms)),
  ]);
}

function RedirectingFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="animate-pulse"><BrandMark size={72} /></div>
    </div>
  );
}

function RedirectingPage() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>(0);
  const [tagline, setTagline] = useState("Authenticating");
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const step = Math.min(phase, STEPS.length - 1);
  const progress = PHASE_TARGET[phase];

  useEffect(() => {
    let cancelled = false;
    let hardFallback: number | undefined;
    setFailed(false);
    setPhase(0);
    setTagline("Authenticating");

    // Each phase waits for its real work AND a minimum beat, so every step
    // visibly completes instead of freezing half-way.
    const runPhase = async <T,>(work: Promise<T>): Promise<T> => {
      const [value] = await Promise.all([work, sleep(MIN_PHASE_MS)]);
      return value;
    };

    (async () => {
      try {
        const user = await runPhase(withTimeout(getSupabaseUserReady(3000), 6000));
        if (cancelled) return;
        if (!user) {
          navigate({ to: "/auth", replace: true });
          return;
        }
        setPhase(1);
        setTagline("Loading your workspace");
        let path: DashboardPath;
        try {
          path = await runPhase(withTimeout(getDashboardPathForUser(user), 6000));
        } catch {
          // One quiet retry for a slow network before giving up.
          path = await withTimeout(getDashboardPathForUser(user), 6000);
        }
        if (cancelled) return;
        setPhase(2);
        setTagline("Routing to your dashboard");
        await sleep(MIN_PHASE_MS);
        if (cancelled) return;
        setPhase(3);
        await sleep(260);
        if (cancelled) return;
        navigate({ to: path, replace: true });
        // If the in-app hop is somehow swallowed, force a real page load.
        hardFallback = window.setTimeout(() => {
          if (!cancelled && window.location.pathname === "/redirecting") window.location.assign(path);
        }, 3000);
      } catch {
        if (!cancelled) {
          setFailed(true);
          setTagline("Connection is slow");
        }
      }
    })();

    return () => {
      cancelled = true;
      if (hardFallback) window.clearTimeout(hardFallback);
    };
  }, [navigate, attempt]);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background text-foreground">
      <AuroraBackground intensity="immersive" />
      <div
        className="pointer-events-none fixed inset-0 -z-10 opacity-[0.06] mix-blend-overlay"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent 0 2px, rgba(255,255,255,0.6) 2px 3px)",
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 flex w-full max-w-md flex-col items-center px-6 text-center"
      >
        {/* Pulsing brand mark */}
        <div className="relative mb-8">
          <motion.div
            className="absolute inset-0 rounded-full blur-2xl"
            style={{ background: "var(--gradient-brand-hot)" }}
            animate={{ scale: [1, 1.25, 1], opacity: [0.5, 0.85, 0.5] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
            className="relative"
          >
            <BrandMark size={72} />
          </motion.div>
        </div>

        <div className="font-mono text-[10px] uppercase tracking-[0.32em] text-primary">
          {tagline}
        </div>
        <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
          Entering the <span className="text-gradient-hot">console</span>
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Hold tight — we're routing you to the right cockpit.
        </p>

        {/* Step list */}
        <div className="mt-8 w-full space-y-2.5">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const active = i <= step;
            const done = i < phase;
            return (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: active ? 1 : 0.35, x: 0 }}
                transition={{ delay: i * 0.12, duration: 0.35 }}
                className={`flex items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left text-sm backdrop-blur transition ${
                  active
                    ? "border-primary/50 bg-background/60 text-foreground"
                    : "border-border/60 bg-background/30 text-muted-foreground"
                }`}
              >
                <span
                  className={`relative inline-flex h-7 w-7 items-center justify-center rounded-lg ${
                    active ? "bg-primary/15 text-primary" : "bg-muted/40 text-muted-foreground"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {active && !done && !failed && (
                    <span className="absolute inset-0 animate-ping rounded-lg bg-primary/30" />
                  )}
                </span>
                <span className="flex-1 font-medium">{s.label}</span>
                {done ? (
                  <motion.span
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 500, damping: 22 }}
                    className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/20 text-primary"
                  >
                    <Check className="h-3 w-3" />
                  </motion.span>
                ) : active && !failed ? (
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
                ) : null}
              </motion.div>
            );
          })}
        </div>

        {/* Progress bar — fills for real as each step completes */}
        <div className="mt-8 w-full">
          <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-border/40">
            <motion.div
              initial={{ width: "4%" }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="relative h-full overflow-hidden rounded-full"
              style={{ background: "var(--gradient-brand-hot)" }}
            >
              <span className="absolute inset-0 animate-shimmer" />
            </motion.div>
          </div>
          <div className="mt-2 flex justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            <span>{phase === 3 ? "Ready" : STEPS[step].label}</span>
            <span className="tabular-nums text-foreground">{progress}%</span>
          </div>
        </div>

        {failed && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 flex w-full flex-col items-center gap-3 rounded-xl border border-border/60 bg-background/60 p-4 text-sm backdrop-blur"
          >
            <p className="text-muted-foreground">This is taking longer than usual. Check your internet and try again.</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAttempt((a) => a + 1)}
                className="rounded-md px-4 py-2 text-sm font-medium text-primary-foreground"
                style={{ background: "var(--gradient-brand-hot)" }}
              >
                Try again
              </button>
              <button
                type="button"
                onClick={() => navigate({ to: "/auth", replace: true })}
                className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-secondary"
              >
                Back to sign in
              </button>
            </div>
          </motion.div>
        )}

        <div className="mt-6 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          TLS 1.3 · Encrypted · CoreCade Cloud
        </div>
      </motion.div>
    </div>
  );
}
