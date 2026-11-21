import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, ArrowRight, Delete, KeyRound, Loader2, Lock, ShieldCheck, Store, User, Eye, EyeOff,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { staffLogin } from "@/lib/staff-auth.functions";
import { staffChangePin, isTrivialPin } from "@/lib/staff.functions";
import { AuroraBackground } from "@/components/AuroraBackground";
import { BrandLockup } from "@/components/Brand";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/staff-login")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Staff Login — CoreCade" },
      { name: "description", content: "Sign in to your café floor console using your café code, username, and 6-digit PIN." },
    ],
  }),
  component: StaffLoginPage,
});

const KEYPAD_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "CLR", "0", "DEL"] as const;

function PinPad({
  value,
  onChange,
  showDigits,
  onToggleShow,
  disabled,
}: {
  value: string;
  onChange: (next: string) => void;
  showDigits: boolean;
  onToggleShow: () => void;
  disabled?: boolean;
}) {
  const pressKey = (key: (typeof KEYPAD_KEYS)[number]) => {
    if (disabled) return;
    if (key === "CLR") {
      onChange("");
      return;
    }
    if (key === "DEL") {
      onChange(value.slice(0, -1));
      return;
    }
    if (value.length < 6) {
      onChange(value + key);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="grid flex-1 grid-cols-6 gap-2">
          {Array.from({ length: 6 }).map((_, idx) => {
            const ch = value[idx];
            const active = idx === value.length;
            return (
              <div
                key={idx}
                className={`flex h-12 items-center justify-center rounded-xl border font-mono text-xl font-bold transition ${
                  ch
                    ? "border-primary/70 bg-primary/15 text-foreground"
                    : active
                      ? "border-primary/50 bg-background/80 ring-2 ring-primary/20"
                      : "border-border/70 bg-background/50 text-muted-foreground"
                }`}
              >
                {ch ? (showDigits ? ch : "•") : ""}
              </div>
            );
          })}
        </div>
        <button
          type="button"
          onClick={onToggleShow}
          className="inline-flex h-12 w-11 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-background/50 text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
          aria-label={showDigits ? "Hide PIN" : "Show PIN"}
        >
          {showDigits ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>

      {/* Hidden-style accessible numeric input for desktop keyboard / mobile autofill */}
      <Input
        type={showDigits ? "text" : "password"}
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="one-time-code"
        maxLength={6}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
        placeholder="Type 6-digit PIN or tap keypad below"
        className="h-11 border-border/70 bg-background/50 text-center font-mono text-base tracking-[0.35em]"
      />

      <div className="grid grid-cols-3 gap-2">
        {KEYPAD_KEYS.map((k) => {
          const isAction = k === "CLR" || k === "DEL";
          return (
            <button
              key={k}
              type="button"
              disabled={disabled}
              onClick={() => pressKey(k)}
              className={`flex h-13 items-center justify-center rounded-xl border text-lg font-bold transition active:scale-95 disabled:opacity-50 ${
                isAction
                  ? "border-border/60 bg-background/40 font-mono text-xs uppercase tracking-wider text-muted-foreground hover:bg-secondary hover:text-foreground"
                  : "border-border/70 bg-background/60 font-mono text-foreground hover:border-primary/50 hover:bg-primary/10"
              }`}
            >
              {k === "DEL" ? <Delete className="h-5 w-5" /> : k}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StaffLoginPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const loginFn = useServerFn(staffLogin);
  const changePinFn = useServerFn(staffChangePin);

  const [step, setStep] = useState<"login" | "change_pin">("login");
  const [cafeCode, setCafeCode] = useState("");
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);

  const [targetCafe, setTargetCafe] = useState<{ slug: string; name: string } | null>(null);
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [showNewPin, setShowNewPin] = useState(false);
  const [activePinField, setActivePinField] = useState<"new" | "confirm">("new");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = cafeCode.trim().toUpperCase();
    const user = username.trim().toLowerCase();
    if (!code) {
      toast.error("Enter your 6-character café code.");
      return;
    }
    if (!user) {
      toast.error("Enter your staff username.");
      return;
    }
    if (!/^\d{6}$/.test(pin)) {
      toast.error("Enter your 6-digit PIN.");
      return;
    }

    setLoading(true);
    try {
      const res = await loginFn({
        data: { cafe_code: code, username: user, pin },
      });

      const { error: sessErr } = await supabase.auth.setSession({
        access_token: res.access_token,
        refresh_token: res.refresh_token,
      });
      if (sessErr) throw sessErr;

      await qc.cancelQueries();
      qc.clear();

      if (res.must_change_pin) {
        setTargetCafe({ slug: res.slug, name: res.cafe_name });
        setStep("change_pin");
        toast.info("First sign-in: please choose a new personal 6-digit PIN.");
      } else {
        toast.success(`Welcome to ${res.cafe_name}`);
        navigate({ to: "/cafe/$slug", params: { slug: res.slug }, replace: true });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not sign in.");
    } finally {
      setLoading(false);
    }
  };

  const handleSetNewPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(newPin)) {
      toast.error("New PIN must be 6 digits.");
      return;
    }
    if (isTrivialPin(newPin)) {
      toast.error("Choose a stronger PIN — avoid 000000, 123456, 654321, or repeated digits.");
      return;
    }
    if (newPin !== confirmPin) {
      toast.error("PINs do not match.");
      return;
    }

    setLoading(true);
    try {
      const res = await changePinFn({ data: { new_pin: newPin } });
      if (res?.access_token && res?.refresh_token) {
        const { error: sessErr } = await supabase.auth.setSession({
          access_token: res.access_token,
          refresh_token: res.refresh_token,
        });
        if (sessErr) throw sessErr;
      }
      await qc.cancelQueries();
      qc.clear();
      toast.success("PIN updated! Entering console…");
      const slug = targetCafe?.slug;
      if (slug) {
        navigate({ to: "/cafe/$slug", params: { slug }, replace: true });
      } else {
        navigate({ to: "/redirecting", replace: true });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update PIN.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-dvh overflow-x-clip bg-background text-foreground">
      <AuroraBackground intensity="immersive" />
      <div
        className="pointer-events-none fixed inset-0 -z-10 opacity-[0.07] mix-blend-overlay"
        style={{ backgroundImage: "repeating-linear-gradient(0deg, transparent 0 2px, rgba(255,255,255,0.6) 2px 3px)" }}
      />

      {/* Top bar */}
      <div
        className="relative z-20 mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 pb-3 sm:px-8 sm:py-5"
        style={{ paddingTop: "max(env(safe-area-inset-top), 1rem)" }}
      >
        <BrandLockup size={30} />
        <Link
          to="/auth"
          className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Owner / Player Login</span><span className="sm:hidden">Sign in</span>
        </Link>
      </div>

      <div className="relative z-10 mx-auto flex min-h-[calc(100dvh-76px)] max-w-md items-center px-4 pb-[max(env(safe-area-inset-bottom),2rem)]">
        <div
          className="w-full rounded-[1.6rem] p-px shadow-2xl"
          style={{
            background:
              "linear-gradient(135deg, oklch(0.74 0.21 15 / 0.7), oklch(0.65 0.25 295 / 0.5) 50%, oklch(0.7 0.26 335 / 0.6))",
          }}
        >
          <div className="relative overflow-hidden rounded-[1.55rem] bg-card/85 p-5 backdrop-blur-2xl sm:p-8">
            <AnimatePresence mode="wait">
              {step === "login" ? (
                <motion.form
                  key="login"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  onSubmit={handleLogin}
                  className="space-y-4"
                >
                  <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.28em] text-primary">
                    <KeyRound className="h-3.5 w-3.5" /> Floor Staff Access
                  </div>

                  <div>
                    <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
                      Staff <span className="text-gradient-hot">PIN login</span>
                    </h1>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Enter the 6-character café code from your owner, your username, and your 6-digit PIN.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="cafeCode" className="text-xs uppercase tracking-wider text-muted-foreground">
                        Café code
                      </Label>
                      <div className="relative">
                        <Store className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="cafeCode"
                          value={cafeCode}
                          onChange={(e) =>
                            setCafeCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))
                          }
                          placeholder="AB12CD"
                          autoCapitalize="characters"
                          autoComplete="off"
                          maxLength={6}
                          className="h-12 pl-9 font-mono text-base font-bold uppercase tracking-[0.2em]"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="staffUsername" className="text-xs uppercase tracking-wider text-muted-foreground">
                        Username
                      </Label>
                      <div className="relative">
                        <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="staffUsername"
                          value={username}
                          onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, ""))}
                          placeholder="rohan"
                          autoCapitalize="none"
                          autoCorrect="off"
                          autoComplete="username"
                          className="h-12 pl-9 text-base"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                      6-Digit PIN
                    </Label>
                    <PinPad
                      value={pin}
                      onChange={setPin}
                      showDigits={showPin}
                      onToggleShow={() => setShowPin((s) => !s)}
                      disabled={loading}
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={loading}
                    className="h-12 w-full gap-2 text-base font-semibold text-primary-foreground glow-magenta"
                    style={{ background: "var(--gradient-brand-hot)" }}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Signing in…
                      </>
                    ) : (
                      <>
                        Enter console <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </Button>

                  <div className="flex items-center justify-center gap-2 pt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                    <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                    Locks for 15m after 5 wrong PINs
                  </div>
                </motion.form>
              ) : (
                <motion.form
                  key="change_pin"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  onSubmit={handleSetNewPin}
                  className="space-y-4"
                >
                  <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.28em] text-amber-400">
                    <Lock className="h-3.5 w-3.5" /> Security Check · {targetCafe?.name ?? "Staff"}
                  </div>

                  <div>
                    <h1 className="font-display text-2xl font-extrabold tracking-tight">
                      Set your <span className="text-gradient-hot">new PIN</span>
                    </h1>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Replace the temporary PIN from your owner with your own 6-digit PIN before opening the floor.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                        New 6-digit PIN
                      </Label>
                      <button
                        type="button"
                        onClick={() => setActivePinField("new")}
                        className={`text-[11px] font-medium ${activePinField === "new" ? "text-primary" : "text-muted-foreground"}`}
                      >
                        {activePinField === "new" ? "Keypad active" : "Tap keypad here"}
                      </button>
                    </div>
                    <Input
                      type={showNewPin ? "text" : "password"}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      value={newPin}
                      onFocus={() => setActivePinField("new")}
                      onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="••••••"
                      className="h-12 text-center font-mono text-xl tracking-[0.4em]"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                        Confirm new PIN
                      </Label>
                      <button
                        type="button"
                        onClick={() => setActivePinField("confirm")}
                        className={`text-[11px] font-medium ${activePinField === "confirm" ? "text-primary" : "text-muted-foreground"}`}
                      >
                        {activePinField === "confirm" ? "Keypad active" : "Tap keypad here"}
                      </button>
                    </div>
                    <div className="relative">
                      <Input
                        type={showNewPin ? "text" : "password"}
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={6}
                        value={confirmPin}
                        onFocus={() => setActivePinField("confirm")}
                        onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        placeholder="••••••"
                        className="h-12 pr-12 text-center font-mono text-xl tracking-[0.4em]"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPin((s) => !s)}
                        className="absolute right-1 top-1/2 -translate-y-1/2 inline-flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground"
                        aria-label={showNewPin ? "Hide PIN" : "Show PIN"}
                      >
                        {showNewPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Quick keypad targeting whichever field is focused */}
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    {KEYPAD_KEYS.map((k) => {
                      const isAction = k === "CLR" || k === "DEL";
                      const targetVal = activePinField === "new" ? newPin : confirmPin;
                      const setTarget = activePinField === "new" ? setNewPin : setConfirmPin;
                      return (
                        <button
                          key={k}
                          type="button"
                          disabled={loading}
                          onClick={() => {
                            if (k === "CLR") setTarget("");
                            else if (k === "DEL") setTarget(targetVal.slice(0, -1));
                            else if (targetVal.length < 6) {
                              const next = targetVal + k;
                              setTarget(next);
                              if (activePinField === "new" && next.length === 6) {
                                setActivePinField("confirm");
                              }
                            }
                          }}
                          className={`flex h-12 items-center justify-center rounded-xl border text-base font-bold transition active:scale-95 disabled:opacity-50 ${
                            isAction
                              ? "border-border/60 bg-background/40 font-mono text-xs uppercase tracking-wider text-muted-foreground hover:bg-secondary"
                              : "border-border/70 bg-background/60 font-mono text-foreground hover:border-primary/50 hover:bg-primary/10"
                          }`}
                        >
                          {k === "DEL" ? <Delete className="h-4 w-4" /> : k}
                        </button>
                      );
                    })}
                  </div>

                  <p className="text-[11px] text-muted-foreground">
                    Avoid obvious codes like 000000, 123456, 654321, or repeated digits.
                  </p>

                  <Button
                    type="submit"
                    disabled={loading}
                    className="h-12 w-full gap-2 text-base font-semibold text-primary-foreground glow-magenta"
                    style={{ background: "var(--gradient-brand-hot)" }}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Saving PIN…
                      </>
                    ) : (
                      <>
                        Save PIN &amp; continue <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                </motion.form>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
