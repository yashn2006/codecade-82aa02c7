import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabase/client";
import { AuroraBackground } from "@/components/AuroraBackground";
import { BrandLockup } from "@/components/Brand";
import { toast } from "sonner";

export const Route = createFileRoute("/verify-email")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Verify your email — CoreCade" },
      { name: "description", content: "Enter the 6-digit code we sent to finish creating your CoreCade account." },
      { property: "og:title", content: "Verify your email — CoreCade" },
      { property: "og:description", content: "Enter the 6-digit code we sent to finish creating your CoreCade account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: VerifyEmail,
});

function VerifyEmail() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [digits, setDigits] = useState<string[]>(Array(6).fill(""));
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const [cooldown, setCooldown] = useState(60);
  const inputs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const fromUrl = new URLSearchParams(window.location.search).get("email");
    setEmail(fromUrl ?? window.sessionStorage.getItem("cc_pending_email") ?? "");
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = window.setInterval(() => setCooldown((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => window.clearInterval(t);
  }, [cooldown]);

  const code = digits.join("");

  const setAt = (i: number, v: string) => {
    setDigits((d) => {
      const next = [...d];
      next[i] = v;
      return next;
    });
  };

  const onChange = (i: number, raw: string) => {
    const v = raw.replace(/\D/g, "");
    if (!v) return setAt(i, "");
    if (v.length > 1) {
      // paste support
      const chars = v.slice(0, 6 - i).split("");
      setDigits((d) => {
        const next = [...d];
        chars.forEach((c, k) => { next[i + k] = c; });
        return next;
      });
      inputs.current[Math.min(5, i + chars.length)]?.focus();
      return;
    }
    setAt(i, v);
    if (i < 5) inputs.current[i + 1]?.focus();
  };

  const onKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[i] && i > 0) inputs.current[i - 1]?.focus();
  };

  const fail = (msg: string) => {
    setShake(true);
    window.setTimeout(() => setShake(false), 500);
    toast.error(msg);
  };

  const verify = async () => {
    if (code.length !== 6) return fail("Enter all 6 digits.");
    if (!email) return fail("Missing email — sign up again.");
    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "signup" });
      if (error) throw error;
      toast.success("Email verified.");
      navigate({ to: "/redirecting" });
    } catch (err) {
      fail(err instanceof Error ? err.message : "Invalid or expired code.");
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    if (!email || cooldown > 0) return;
    try {
      const { error } = await supabase.auth.resend({ type: "signup", email });
      if (error) throw error;
      setCooldown(60);
      toast.success("New code sent.");
    } catch (err) {
      fail(err instanceof Error ? err.message : "Could not resend the code.");
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
          animate={shake ? { x: [0, -10, 10, -8, 8, -4, 0] } : { x: 0 }}
          transition={{ duration: 0.45 }}
          className="w-full rounded-[1.6rem] border border-border/60 bg-card/70 p-7 backdrop-blur-2xl sm:p-9"
        >
          <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-primary">One-time code</div>
          <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight">
            Verify your <span className="text-gradient-hot">email</span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            We sent a 6-digit code to <span className="text-foreground">{email || "your email"}</span>
          </p>

          <div className="mt-6 flex justify-between gap-2">
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => { inputs.current[i] = el; }}
                value={d}
                onChange={(e) => onChange(i, e.target.value)}
                onKeyDown={(e) => onKeyDown(i, e)}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                aria-label={`Digit ${i + 1}`}
                className={`h-16 w-[52px] rounded-xl border bg-white/[0.05] text-center font-mono text-2xl text-foreground outline-none transition-all focus:border-[rgba(255,0,110,0.6)] focus:shadow-[0_0_0_3px_rgba(255,0,110,0.12)] ${
                  shake ? "border-destructive/70" : "border-white/10"
                }`}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={verify}
            disabled={loading || code.length !== 6}
            className="mt-6 h-12 w-full rounded-xl text-base font-semibold text-primary-foreground transition disabled:opacity-50"
            style={{ background: "var(--gradient-brand-hot)" }}
          >
            {loading ? "Verifying…" : "Verify"}
          </button>

          <button
            type="button"
            onClick={() => void resend()}
            disabled={cooldown > 0}
            className="mt-4 w-full text-center text-sm text-primary hover:underline disabled:text-muted-foreground disabled:no-underline"
          >
            {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
          </button>
        </motion.div>
      </div>
    </div>
  );
}
