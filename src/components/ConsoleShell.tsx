import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
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
  badge, title, subtitle, nav, children, intensity = "default",
}: {
  badge: string;
  title: string;
  subtitle?: string;
  nav: NavItem[];
  children: ReactNode;
  intensity?: "default" | "hero" | "immersive";
}) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [open, setOpen] = useState(false);
  const path = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
  }, []);

  // close drawer on route change
  useEffect(() => { setOpen(false); }, [path]);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const resolveTo = (item: NavItem) =>
    item.params ? item.to.replace(/\$(\w+)/g, (_, k) => item.params![k] ?? "") : item.to;

  const isActive = (item: NavItem) => {
    const target = resolveTo(item);
    return item.exact ? path === target : path === target || path.startsWith(target + "/");
  };

  // Top 5 nav items for mobile bottom bar
  const bottomNav = nav.slice(0, 5);

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <AuroraBackground intensity={intensity} />

      <div className="flex min-h-screen">
        {/* === Desktop sidebar === */}
        <aside className="hidden lg:flex lg:w-[260px] lg:flex-shrink-0 lg:flex-col lg:border-r lg:border-border/70 lg:bg-card/60 lg:backdrop-blur-xl">
          <div className="flex h-16 items-center px-5 border-b border-border/70">
            <BrandLockup size={28} badge={badge} />
          </div>
          <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
            {nav.map((item, i) => {
              const active = isActive(item);
              return (
                <Link
                  key={item.label}
                  to={item.to}
                  params={item.params}
                  className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                    active
                      ? "bg-primary/10 text-primary shadow-soft"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="nav-active-bar"
                      className="absolute inset-y-1.5 left-0 w-1 rounded-r-full bg-primary"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                  <item.icon className={`h-4 w-4 transition-transform group-hover:scale-110 ${active ? "text-primary" : ""}`} />
                  <span className="truncate">{item.label}</span>
                  {active && (
                    <motion.span
                      initial={{ scale: 0 }} animate={{ scale: 1 }}
                      className="ml-auto h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_8px_currentColor]"
                    />
                  )}
                  <span style={{ ['--i' as string]: i }} />
                </Link>
              );
            })}
          </nav>
          <div className="border-t border-border/70 p-3">
            <div className="flex items-center gap-2 rounded-xl bg-secondary/60 p-2.5">
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-primary to-accent text-xs font-bold text-primary-foreground">
                {(email[0] ?? "?").toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-medium">{email || "—"}</div>
                <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">signed in</div>
              </div>
              <button
                onClick={signOut}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-background hover:text-destructive transition"
                aria-label="Sign out"
                title="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </aside>

        {/* === Main column === */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Mobile top bar */}
          <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border/70 bg-background/80 px-3 backdrop-blur-xl lg:hidden">
            <div className="flex items-center gap-2">
              <button
                className="rounded-lg p-2 hover:bg-secondary"
                onClick={() => setOpen(true)}
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" />
              </button>
              <BrandLockup size={24} badge={badge} />
            </div>
            <button
              onClick={signOut}
              className="rounded-lg p-2 text-muted-foreground hover:bg-secondary"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </header>

          {/* Main content */}
          <main className="min-w-0 flex-1 px-4 pb-24 pt-6 sm:px-6 lg:px-8 lg:pb-10">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="min-w-0">
                <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                  {badge}
                </div>
                <h1 className="mt-1 truncate font-display text-2xl font-extrabold tracking-tight sm:text-3xl lg:text-4xl">
                  {title}
                </h1>
                {subtitle && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{subtitle}</p>}
              </div>
              <span className="hidden font-mono text-[11px] text-muted-foreground sm:inline">{email}</span>
            </div>
            <AnimatePresence mode="wait">
              <motion.div
                key={path}
                initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -6, filter: "blur(4px)" }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                className="mt-6"
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </main>


          {/* === Mobile bottom nav === */}
          <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border/70 bg-card/90 backdrop-blur-xl lg:hidden">
            {bottomNav.map((item) => {
              const active = isActive(item);
              return (
                <Link
                  key={item.label}
                  to={item.to}
                  params={item.params}
                  className={`relative flex flex-col items-center justify-center gap-1 py-2 text-[10px] font-medium transition ${
                    active ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="mob-nav-pill"
                      className="absolute inset-x-3 top-0 h-0.5 rounded-full bg-primary shadow-[0_0_8px_currentColor]"
                    />
                  )}
                  <item.icon className="h-4 w-4" />
                  <span className="truncate px-1">{item.label.split(" ")[0]}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* === Mobile drawer (full nav) === */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-40 bg-ink/40 backdrop-blur-sm lg:hidden"
            />
            <motion.aside
              initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
              className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-border bg-card shadow-pop lg:hidden"
            >
              <div className="flex h-14 items-center justify-between border-b border-border/70 px-4">
                <BrandLockup size={24} badge={badge} />
                <button onClick={() => setOpen(false)} className="rounded-lg p-2 hover:bg-secondary" aria-label="Close">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
                {nav.map((item) => {
                  const active = isActive(item);
                  return (
                    <Link
                      key={item.label}
                      to={item.to}
                      params={item.params}
                      onClick={() => setOpen(false)}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                        active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                      }`}
                    >
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
