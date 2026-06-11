import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { LogOut, Menu, X, type LucideIcon } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { AuroraBackground } from "@/components/AuroraBackground";
import { BrandLockup } from "@/components/Brand";

export type NavItem = {
  label: string;
  icon: LucideIcon;
  to: string;
  params?: Record<string, string>;
  exact?: boolean;
};

export function ConsoleShell({
  badge, title, subtitle, nav, children,
}: {
  badge: string;
  title: string;
  subtitle?: string;
  nav: NavItem[];
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [open, setOpen] = useState(false);
  const path = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const isActive = (item: NavItem) => {
    const target = item.params
      ? item.to.replace(/\$(\w+)/g, (_, k) => item.params![k] ?? "")
      : item.to;
    return item.exact ? path === target : path === target || path.startsWith(target + "/");
  };

  return (
    <div className="relative min-h-screen">
      <AuroraBackground />

      {/* Top bar */}
      <header className="sticky top-0 z-40">
        <div className="mx-auto mt-3 max-w-[1400px] px-3 sm:px-6">
          <div className="glass-strong flex items-center justify-between rounded-2xl px-3 py-2.5 sm:px-5">
            <div className="flex items-center gap-2">
              <button
                className="rounded-md p-1.5 hover:bg-background/60 lg:hidden"
                onClick={() => setOpen((v) => !v)}
                aria-label="Toggle menu"
              >
                {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
              <BrandLockup size={28} badge={badge} />
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden font-mono text-xs text-muted-foreground sm:inline">{email}</span>
              <Button variant="ghost" size="sm" onClick={signOut} className="hover:bg-background/60">
                <LogOut className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Sign out</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto mt-4 grid max-w-[1400px] gap-4 px-3 sm:px-6 lg:grid-cols-[240px_1fr]">
        {/* Sidebar */}
        <aside className={`${open ? "block" : "hidden"} lg:block`}>
          <nav className="sticky top-24 space-y-1 rounded-2xl border border-border/60 bg-card/40 p-2 backdrop-blur">
            {nav.map((item) => {
              const active = isActive(item);
              return (
                <Link
                  key={item.label}
                  to={item.to}
                  params={item.params}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                    active
                      ? "bg-background/80 text-foreground glow-violet"
                      : "text-muted-foreground hover:bg-background/40 hover:text-foreground"
                  }`}
                >
                  <item.icon className={`h-4 w-4 ${active ? "text-primary" : ""}`} />
                  {item.label}
                  {active && (
                    <motion.span layoutId="nav-dot" className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />
                  )}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Main */}
        <main className="min-w-0 pb-16">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
              {badge}
            </div>
            <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
              {title}
            </h1>
            {subtitle && <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{subtitle}</p>}
          </motion.div>
          <div className="mt-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
