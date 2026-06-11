import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { seedSuperAdmin } from "@/lib/setup.functions";
import { Button } from "@/components/ui/button";
import { Shield, Check } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/setup")({
  head: () => ({ meta: [{ title: "Setup — Giganexa" }] }),
  component: SetupPage,
});

function SetupPage() {
  const seed = useServerFn(seedSuperAdmin);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const run = async () => {
    setLoading(true);
    try {
      const res = await seed();
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
      <div className="w-full max-w-lg glass rounded-2xl p-8">
        <Shield className="h-12 w-12 text-magenta" />
        <h1 className="mt-4 font-display text-3xl font-bold">One-time setup</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This creates the super-admin account <span className="font-mono text-foreground">giganexa2026@gmail.com</span> and grants it the <code>super_admin</code> role.
          Run this once after applying the SQL migration.
        </p>
        <ol className="mt-6 space-y-2 text-sm text-muted-foreground">
          <li>1. Paste <code className="font-mono text-foreground">supabase-migration.sql</code> into Supabase SQL Editor and run.</li>
          <li>2. Click the button below.</li>
          <li>3. Sign in at <code className="font-mono text-foreground">/auth</code>.</li>
        </ol>
        <Button onClick={run} disabled={loading || done} className="mt-8 w-full h-12 bg-gradient-to-r from-cyan to-magenta text-primary-foreground glow-cyan font-semibold">
          {done ? <><Check className="mr-2 h-4 w-4" /> Done — go to /auth</> : loading ? "Seeding…" : "Seed super admin"}
        </Button>
      </div>
    </div>
  );
}
