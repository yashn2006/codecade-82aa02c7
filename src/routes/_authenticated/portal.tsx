import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { LogOut, Shield, Gamepad2, User } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { getMyRoles } from "@/lib/me.functions";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { AuroraBackground } from "@/components/AuroraBackground";
import { BrandLockup } from "@/components/Brand";

export const Route = createFileRoute("/_authenticated/portal")({
  head: () => ({ meta: [{ title: "Portal — CoreCade" }] }),
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
    <div className="relative min-h-screen">
      <AuroraBackground />
      <header className="sticky top-0 z-40">
        <div className="mx-auto mt-3 max-w-7xl px-3 sm:px-6">
          <div className="glass-strong flex items-center justify-between rounded-2xl px-3 py-2.5 sm:px-5">
            <BrandLockup size={30} badge={badge} />
            <div className="flex items-center gap-3">
              <span className="hidden items-center gap-2 font-mono text-xs text-muted-foreground sm:inline-flex">
                <User className="h-3 w-3" /> {email}
              </span>
              <Button variant="ghost" size="sm" onClick={signOut} className="hover:bg-background/60">
                <LogOut className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Sign out</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
            {badge ?? "Workspace"}
          </div>
          <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight sm:text-6xl">
            {title}
          </h1>
          {subtitle && <p className="mt-3 max-w-2xl text-muted-foreground">{subtitle}</p>}
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
          <Link to="/admin" className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card/40 p-6 backdrop-blur hover-lift hover:border-primary/40">
            <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-magenta/30 blur-2xl" />
            <Shield className="relative h-8 w-8 text-magenta" />
            <h3 className="relative mt-4 font-heading text-xl font-bold">Super Admin</h3>
            <p className="relative mt-1 text-sm text-muted-foreground">Manage the entire platform.</p>
          </Link>
        )}
        {isOwner && (
          <Link to="/cafe/$slug" params={{ slug: "my-cafe" }} className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card/40 p-6 backdrop-blur hover-lift hover:border-primary/40">
            <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-azure/30 blur-2xl" />
            <Gamepad2 className="relative h-8 w-8 text-azure" />
            <h3 className="relative mt-4 font-heading text-xl font-bold">Café Owner</h3>
            <p className="relative mt-1 text-sm text-muted-foreground">Run your café operations.</p>
          </Link>
        )}
        <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/40 p-6 backdrop-blur">
          <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-violet/30 blur-2xl" />
          <Gamepad2 className="relative h-8 w-8 text-violet" />
          <h3 className="relative mt-4 font-heading text-xl font-bold">Customer</h3>
          <p className="relative mt-1 text-sm text-muted-foreground">Book sessions at your favourite cafés. Coming in Phase 2.</p>
        </div>
      </div>
    </PortalShell>
  );
}
