import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Check, X, ShieldCheck, Eye, EyeOff } from "lucide-react";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Reset password — CoreCade" }] }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [show, setShow] = useState(false);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");

  const checks = useMemo(() => ({
    len: pw.length >= 8,
    upper: /[A-Z]/.test(pw),
    num: /\d/.test(pw),
    sym: /[^A-Za-z0-9]/.test(pw),
    match: pw.length > 0 && pw === pw2,
  }), [pw, pw2]);
  const score = Object.values(checks).filter(Boolean).length;
  const strong = score >= 4;

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!strong) return toast.error("Password too weak — meet all requirements.");
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) throw error;
      toast.success("Password updated. Redirecting…");
      navigate({ to: "/redirecting" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not reset.");
    } finally {
      setLoading(false);
    }
  };

  const Req = ({ ok, label }: { ok: boolean; label: string }) => (
    <li className={`flex items-center gap-2 text-xs transition ${ok ? "text-emerald-400" : "text-muted-foreground"}`}>
      {ok ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5 opacity-50" />}
      {label}
    </li>
  );

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-12 overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-background via-background to-background">
        <div className="absolute top-1/4 left-1/4 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full bg-violet/20 blur-3xl" />
      </div>

      <form onSubmit={onSubmit} className="w-full max-w-md glass rounded-3xl p-8 space-y-5 border border-white/10 shadow-2xl">
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-primary/80">
          <ShieldCheck className="h-4 w-4" /> Secure reset
        </div>
        <div>
          <h1 className="font-display text-3xl font-bold leading-tight">
            Set a new <span className="text-gradient-hot">password</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Pick something strong. You'll be signed in instantly.</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">New password</Label>
          <div className="relative">
            <Input
              id="password" name="password"
              type={show ? "text" : "password"} minLength={8} required
              value={pw} onChange={(e) => setPw(e.target.value)}
              className="h-12 pr-10" autoFocus autoComplete="new-password"
            />
            <button type="button" onClick={() => setShow(s => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                score <= 2 ? "bg-rose-500 w-1/5" :
                score === 3 ? "bg-amber-400 w-2/5" :
                score === 4 ? "bg-cyan-400 w-3/5" :
                "bg-emerald-400 w-full"
              }`}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="password2">Confirm password</Label>
          <Input
            id="password2" type={show ? "text" : "password"} minLength={8} required
            value={pw2} onChange={(e) => setPw2(e.target.value)}
            className="h-12" autoComplete="new-password"
          />
        </div>

        <ul className="grid grid-cols-2 gap-1.5 pt-1">
          <Req ok={checks.len}   label="8+ characters" />
          <Req ok={checks.upper} label="Uppercase letter" />
          <Req ok={checks.num}   label="Number" />
          <Req ok={checks.sym}   label="Symbol" />
          <Req ok={checks.match} label="Passwords match" />
        </ul>

        <Button
          type="submit" disabled={loading || !strong}
          className="w-full h-12 bg-gradient-to-r from-violet via-primary to-azure text-primary-foreground glow-violet font-semibold disabled:opacity-50"
        >
          {loading ? "Updating…" : "Update password"}
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          Remembered it? <Link to="/auth" className="text-primary hover:underline">Back to sign in</Link>
        </p>
      </form>
    </div>
  );
}
