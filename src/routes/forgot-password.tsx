import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, ArrowRight, MailCheck } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuroraBackground } from "@/components/AuroraBackground";
import { BrandLockup } from "@/components/Brand";
import { toast } from "sonner";

export const Route = createFileRoute("/forgot-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Reset your password — CoreCade" },
      { name: "description", content: "Request a secure password reset link for your CoreCade account." },
      { property: "og:title", content: "Reset your password — CoreCade" },
      { property: "og:description", content: "Request a secure password reset link for your CoreCade account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ForgotPassword,
});

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = window.setInterval(() => setCooldown((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => window.clearInterval(t);
  }, [cooldown]);

  const send = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!emailValid || loading) return;
    setLoading(true);
    setError(null);
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (err) throw err;
      setSent(true);
      setCooldown(60);
      toast.success("Reset link sent.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not send the reset link.";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <AuroraBackground intensity="immersive" />

      <div className="relative z-20 mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
        <BrandLockup size={32} />
        <Link to="/auth" className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground transition hover:text-foreground">
          ← back to sign in
        </Link>
      </div>

      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-80px)] max-w-md items-center px-5 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="w-full rounded-[1.6rem] border border-border/60 bg-card/70 p-7 backdrop-blur-2xl sm:p-9"
        >
          <AnimatePresence mode="wait" initial={false}>
            {!sent ? (
              <motion.form
                key="form"
                onSubmit={send}
                noValidate
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-5"
              >
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-primary">Recovery channel</div>
                  <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight">
                    Reset <span className="text-gradient-hot">password</span>
                  </h1>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Enter your email — we'll send a reset link.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fp-email">Email</Label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="fp-email"
                      type="email"
                      autoFocus
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@cafe.in"
                      className="h-12 pl-10"
                    />
                  </div>
                </div>

                {error && <p className="text-xs text-destructive">{error}</p>}

                <button
                  type="submit"
                  disabled={!emailValid || loading}
                  className="group relative h-12 w-full overflow-hidden rounded-xl text-base font-semibold text-primary-foreground transition disabled:opacity-50"
                  style={{ background: "var(--gradient-brand-hot)" }}
                >
                  <span className="absolute inset-0 overflow-hidden rounded-xl" aria-hidden>
                    <span className="absolute -inset-y-2 -left-1/2 w-1/2 rotate-12 bg-gradient-to-r from-transparent via-white/40 to-transparent opacity-0 transition-all duration-700 group-hover:left-[120%] group-hover:opacity-100" />
                  </span>
                  <span className="relative inline-flex items-center justify-center gap-2">
                    {loading ? "Sending…" : "Send reset link"}
                    <ArrowRight className="h-4 w-4" />
                  </span>
                </button>
              </motion.form>
            ) : (
              <motion.div
                key="sent"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4 text-center"
              >
                <motion.div
                  animate={{ y: [0, -10, 0] }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                  className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-primary/30 bg-primary/10"
                >
                  <MailCheck className="h-7 w-7 text-primary" />
                </motion.div>
                <h1 className="font-display text-2xl font-extrabold">Check your inbox!</h1>
                <p className="text-sm text-muted-foreground">
                  Reset link sent to <span className="text-foreground">{email}</span>
                </p>
                <button
                  type="button"
                  disabled={cooldown > 0 || loading}
                  onClick={() => void send()}
                  className="text-sm text-primary hover:underline disabled:text-muted-foreground disabled:no-underline"
                >
                  {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend link"}
                </button>
                <div>
                  <Link to="/auth" className="text-xs text-muted-foreground hover:text-foreground">← Back to sign in</Link>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}
