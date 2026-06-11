import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Lock, User, ArrowRight } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuroraBackground } from "@/components/AuroraBackground";
import { BrandLockup } from "@/components/Brand";
import { toast } from "sonner";
import glowAsset from "@/assets/corecade-glow.png.asset.json";

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
  const navigate = useNavigate();

  const handle = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "").trim();
    const password = String(fd.get("password") ?? "");
    const fullName = String(fd.get("fullName") ?? "").trim();
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
      toast.error(err instanceof Error ? err.message : "Authentication failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen lg:grid lg:grid-cols-[1.05fr_1fr]">
      <AuroraBackground intensity="hero" />

      {/* Left — art panel */}
      <div className="relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-12">
        <BrandLockup size={36} />

        <motion.div
          initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.8 }}
          className="relative z-10"
        >
          <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-primary">
            Operating system · v1
          </div>
          <h2 className="mt-5 font-display text-5xl font-extrabold leading-[1.02] tracking-tight xl:text-6xl">
            The console for<br />
            <span className="text-gradient-hot">gaming cafés</span>
          </h2>
          <p className="mt-6 max-w-md text-muted-foreground">
            Real-time sessions. Instant bookings. Mobile-first portals. Built for the floor, not the boardroom.
          </p>

          <div className="mt-10 flex gap-6">
            {[
              { k: "12", v: "Cities" },
              { k: "30+", v: "Cafés onboarding" },
              { k: "99.98%", v: "Uptime" },
            ].map((s) => (
              <div key={s.v}>
                <div className="font-display text-2xl font-extrabold text-gradient">{s.k}</div>
                <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{s.v}</div>
              </div>
            ))}
          </div>
        </motion.div>

        <div className="pointer-events-none absolute -right-32 top-1/2 -translate-y-1/2 opacity-60">
          <img src={glowAsset.url} alt="" className="h-[520px] w-[520px] animate-float" aria-hidden />
        </div>

        <div className="relative z-10 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          🇮🇳 Made in India · Trusted across 12 cities
        </div>
      </div>

      {/* Right — form */}
      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-12 sm:px-6">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <BrandLockup size={32} />
          </div>

          <motion.div
            key={mode}
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="border-conic rounded-2xl p-px"
          >
            <div className="rounded-2xl bg-card/70 p-8 backdrop-blur-xl">
              <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-primary">
                {mode === "signin" && "Access"}
                {mode === "signup" && "Onboard"}
                {mode === "forgot" && "Recover"}
              </div>
              <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight">
                {mode === "signin" && "Welcome back"}
                {mode === "signup" && "Create your account"}
                {mode === "forgot" && "Reset password"}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {mode === "signin" && "Sign in to access your console."}
                {mode === "signup" && "Get started in under 60 seconds."}
                {mode === "forgot" && "We'll email you a reset link."}
              </p>

              <form onSubmit={handle} className="mt-6 space-y-4">
                <AnimatePresence mode="wait" initial={false}>
                  {mode === "signup" && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                      className="space-y-2"
                    >
                      <Label htmlFor="fullName">Full name</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input id="fullName" name="fullName" required placeholder="Your name" className="h-12 pl-10" />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input id="email" name="email" type="email" required placeholder="you@example.com" className="h-12 pl-10" />
                  </div>
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
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input id="password" name="password" type="password" required minLength={8} placeholder="••••••••" className="h-12 pl-10" />
                    </div>
                  </div>
                )}

                <Button
                  type="submit" disabled={loading}
                  className="group relative h-12 w-full overflow-hidden text-base font-semibold text-primary-foreground glow-violet"
                  style={{ background: "var(--gradient-brand-hot)" }}
                >
                  <span className="relative z-10 inline-flex items-center justify-center gap-2">
                    {loading ? "Please wait…" : (
                      <>
                        {mode === "signin" && "Sign in"}
                        {mode === "signup" && "Create account"}
                        {mode === "forgot" && "Send reset link"}
                        <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                      </>
                    )}
                  </span>
                  <span className="absolute inset-0 animate-shimmer" />
                </Button>
              </form>

              <div className="mt-6 text-center text-sm text-muted-foreground">
                {mode === "signin" && (<>Don't have an account? <button onClick={() => setMode("signup")} className="text-primary hover:underline">Sign up</button></>)}
                {mode === "signup" && (<>Already have one? <button onClick={() => setMode("signin")} className="text-primary hover:underline">Sign in</button></>)}
                {mode === "forgot" && (<button onClick={() => setMode("signin")} className="text-primary hover:underline">← Back to sign in</button>)}
              </div>
            </div>
          </motion.div>

          <div className="mt-6 text-center">
            <Link to="/" className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground hover:text-foreground">
              ← Back to corecade.com
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

async function routeByRole(navigate: ReturnType<typeof useNavigate>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) { navigate({ to: "/auth" }); return; }
  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
  const set = new Set((roles ?? []).map((r) => r.role));
  if (set.has("super_admin")) navigate({ to: "/admin" });
  else if (set.has("cafe_owner")) navigate({ to: "/portal" });
  else if (set.has("cafe_staff")) navigate({ to: "/portal" });
  else navigate({ to: "/portal" });
}
