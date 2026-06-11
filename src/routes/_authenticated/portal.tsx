import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { Gamepad2, LogOut, Shield } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { getMyRoles } from "@/lib/me.functions";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/portal")({
  head: () => ({ meta: [{ title: "Portal — Giganexa" }] }),
  component: Portal,
});

export function PortalShell({ title, subtitle, badge, children }: { title: string; subtitle?: string; badge?: string; children?: ReactNode }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState<string>("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 glass border-b border-border/40">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-cyan to-magenta glow-cyan">
              <Gamepad2 className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-display text-lg font-bold tracking-wider">GIGANEXA</span>
            {badge && (
              <span className="ml-2 rounded-full bg-primary/15 px-2.5 py-0.5 text-[10px] font-mono uppercase tracking-wider text-primary">
                {badge}
              </span>
            )}
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-muted-foreground sm:inline font-mono">{email}</span>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="font-display text-4xl font-bold sm:text-5xl">{title}</h1>
          {subtitle && <p className="mt-3 text-muted-foreground">{subtitle}</p>}
        </motion.div>
        {children}
      </main>
    </div>
  );
}

function Portal() {
  const fetchRoles = useServerFn(getMyRoles);
  const { data } = useQuery({ queryKey: ["my-roles"], queryFn: () => fetchRoles() });

  const roles = data?.roles ?? [];
  const isSuper = roles.some((r) => r.role === "super_admin");
  const isOwner = roles.some((r) => r.role === "cafe_owner");

  return (
    <PortalShell title="Your portal" subtitle="Choose a workspace to enter." badge="Customer">
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isSuper && (
          <Link to="/admin" className="glass rounded-2xl p-6 transition hover:border-primary/50 group">
            <Shield className="h-8 w-8 text-magenta" />
            <h3 className="mt-4 font-heading text-xl font-semibold">Super Admin</h3>
            <p className="mt-1 text-sm text-muted-foreground">Manage the entire platform.</p>
          </Link>
        )}
        {isOwner && (
          <Link to="/cafe/$slug" params={{ slug: "my-cafe" }} className="glass rounded-2xl p-6 transition hover:border-primary/50">
            <Gamepad2 className="h-8 w-8 text-cyan" />
            <h3 className="mt-4 font-heading text-xl font-semibold">Cafe Owner</h3>
            <p className="mt-1 text-sm text-muted-foreground">Run your café operations.</p>
          </Link>
        )}
        <div className="glass rounded-2xl p-6">
          <Gamepad2 className="h-8 w-8 text-primary" />
          <h3 className="mt-4 font-heading text-xl font-semibold">Customer</h3>
          <p className="mt-1 text-sm text-muted-foreground">Book sessions at your favourite cafés. Coming in Phase 2.</p>
        </div>
      </div>
    </PortalShell>
  );
}
