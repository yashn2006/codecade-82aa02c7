import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { seedSuperAdmin } from "@/lib/setup.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, Check } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/setup")({
  head: () => ({ meta: [{ title: "Setup — CoreCade" }] }),
  component: SetupPage,
});

function SetupPage() {
  const seed = useServerFn(seedSuperAdmin);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");

  const run = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 12) {
      toast.error("Password must be at least 12 characters.");
      return;
    }
    setLoading(true);
    try {
      const res = await seed({ data: { email, password, token } });
      setDone(true);
      toast.success(`Super admin ready: ${res.email}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Setup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={run} className="w-full max-w-lg glass rounded-2xl p-8 space-y-4">
        <Shield className="h-12 w-12 text-magenta" />
        <h1 className="font-display text-3xl font-bold">One-time setup</h1>
        <p className="text-sm text-muted-foreground">
          Creates the first super-admin. Locked after one use — this page becomes inert once a super_admin exists.
          You must supply the <code className="font-mono text-foreground">SETUP_TOKEN</code> configured on the server.
        </p>

        <div className="space-y-1.5">
          <Label>Super-admin email</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </div>
        <div className="space-y-1.5">
          <Label>Password (12+ chars, keep it strong)</Label>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={12} autoComplete="new-password" />
        </div>
        <div className="space-y-1.5">
          <Label>Setup token</Label>
          <Input type="password" value={token} onChange={(e) => setToken(e.target.value)} required autoComplete="off" />
        </div>

        <Button type="submit" disabled={loading || done} className="w-full h-12 bg-gradient-to-r from-violet via-primary to-azure text-primary-foreground glow-violet font-semibold">
          {done ? <><Check className="mr-2 h-4 w-4" /> Done — go to /auth</> : loading ? "Creating…" : "Create super admin"}
        </Button>
      </form>
    </div>
  );
}
