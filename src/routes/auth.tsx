import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Gamepad2, Mail, Lock, User, ArrowRight } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ParticleField } from "@/components/ParticleField";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Giganexa" },
      { name: "description", content: "Sign in to your Giganexa account." },
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
          email,
          password,
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
    <div className="min-h-screen lg:grid lg:grid-cols-2">
      {/* Left — animated art */}
      <div className="relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-12 grid-bg">
        <ParticleField density={80} />
        <Link to="/" className="relative z-10 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-cyan to-magenta glow-cyan">
            <Gamepad2 className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-display text-xl font-bold tracking-wider">GIGANEXA</span>
        </Link>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.8 }}
          className="relative z-10"
        >
          <h2 className="font-display text-5xl font-black leading-tight">
            The future of <span className="text-gradient">gaming cafés</span> runs here.
          </h2>
          <p className="mt-6 max-w-md text-muted-foreground">
            Real-time session tracking, instant bookings, mobile-first portals — all in one beautiful, brutally fast platform.
          </p>
        </motion.div>
        <div className="relative z-10 text-xs text-muted-foreground">
          🇮🇳 Built for India · Trusted by café owners across 12 cities
        </div>
      </div>

      {/* Right — form */}
      <div className="flex min-h-screen items-center justify-center px-4 py-12 sm:px-6">
        <div className="w-full max-w-md">
          <Link to="/" className="mb-8 flex items-center gap-2 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-cyan to-magenta">
              <Gamepad2 className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-display text-xl font-bold tracking-wider">GIGANEXA</span>
          </Link>

          <motion.div
            key={mode}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="glass rounded-2xl p-8"
          >
            <h1 className="font-display text-3xl font-bold">
              {mode === "signin" && "Welcome back"}
              {mode === "signup" && "Create your account"}
              {mode === "forgot" && "Reset password"}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {mode === "signin" && "Sign in to access your café."}
              {mode === "signup" && "Get started in under 60 seconds."}
              {mode === "forgot" && "We'll email you a reset link."}
            </p>

            <form onSubmit={handle} className="mt-6 space-y-4">
              <AnimatePresence mode="wait">
                {mode === "signup" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-2"
                  >
                    <Label htmlFor="fullName">Full name</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input id="fullName" name="fullName" required placeholder="Your name" className="pl-10 h-12" />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="email" name="email" type="email" required placeholder="you@example.com" className="pl-10 h-12" />
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
                    <Input id="password" name="password" type="password" required minLength={8} placeholder="••••••••" className="pl-10 h-12" />
                  </div>
                </div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="group h-12 w-full bg-gradient-to-r from-cyan to-magenta text-primary-foreground glow-cyan text-base font-semibold"
              >
                {loading ? "Please wait…" : (
                  <>
                    {mode === "signin" && "Sign in"}
                    {mode === "signup" && "Create account"}
                    {mode === "forgot" && "Send reset link"}
                    <ArrowRight className="ml-2 h-4 w-4 transition group-hover:translate-x-1" />
                  </>
                )}
              </Button>
            </form>

            <div className="mt-6 text-center text-sm text-muted-foreground">
              {mode === "signin" && (
                <>Don't have an account? <button onClick={() => setMode("signup")} className="text-primary hover:underline">Sign up</button></>
              )}
              {mode === "signup" && (
                <>Already have one? <button onClick={() => setMode("signin")} className="text-primary hover:underline">Sign in</button></>
              )}
              {mode === "forgot" && (
                <button onClick={() => setMode("signin")} className="text-primary hover:underline">← Back to sign in</button>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

async function routeByRole(navigate: ReturnType<typeof useNavigate>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    navigate({ to: "/auth" });
    return;
  }
  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  const roleSet = new Set((roles ?? []).map((r) => r.role));

  if (roleSet.has("super_admin")) navigate({ to: "/admin" });
  else if (roleSet.has("cafe_owner")) navigate({ to: "/portal" });
  else if (roleSet.has("cafe_staff")) navigate({ to: "/portal" });
  else navigate({ to: "/portal" });
}
