import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AuroraBackground } from "@/components/AuroraBackground";
import { BrandMark } from "@/components/Brand";
import { getDashboardPathForUser, getSupabaseUserReady } from "@/lib/auth-routing";
import { ShieldCheck, Cpu, Sparkles } from "lucide-react";

export const Route = createFileRoute("/redirecting")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Entering CoreCade…" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: RedirectingPage,
});

const STEPS = [
  { icon: ShieldCheck, label: "Verifying secure session" },
  { icon: Cpu, label: "Loading your workspace" },
  { icon: Sparkles, label: "Tuning the console" },
];

function RedirectingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [tagline, setTagline] = useState("Authenticating");

  useEffect(() => {
    let cancelled = false;
    const stepTimer = window.setInterval(() => {
      setStep((s) => Math.min(s + 1, STEPS.length - 1));
    }, 550);

    (async () => {
      const user = await getSupabaseUserReady(3000);
      if (cancelled) return;
      if (!user) {
        navigate({ to: "/auth", replace: true });
        return;
      }
      setTagline("Routing to your dashboard");
      const path = await getDashboardPathForUser(user);
      if (cancelled) return;
      // Let the animation breathe a moment for the "sexy" effect
      window.setTimeout(() => {
        if (!cancelled) navigate({ to: path, replace: true });
      }, 700);
    })();

    return () => {
      cancelled = true;
      window.clearInterval(stepTimer);
    };
  }, [navigate]);

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
            const done = i < step;
            return (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: active ? 1 : 0.35, x: 0 }}
                transition={{ delay: i * 0.12 }}
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
                  {active && !done && (
                    <span className="absolute inset-0 animate-ping rounded-lg bg-primary/30" />
                  )}
                </span>
                <span className="flex-1 font-medium">{s.label}</span>
                {done && <span className="text-xs text-primary">✓</span>}
              </motion.div>
            );
          })}
        </div>

        {/* Progress bar */}
        <div className="mt-8 h-1 w-full overflow-hidden rounded-full bg-border/40">
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: "100%" }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
            className="h-full w-1/2 rounded-full"
            style={{ background: "var(--gradient-brand-hot)" }}
          />
        </div>

        <div className="mt-6 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          TLS 1.3 · Encrypted · CoreCade Cloud
        </div>
      </motion.div>
    </div>
  );
}
