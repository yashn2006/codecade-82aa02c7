import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { LogOut, Menu, X, type LucideIcon } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { AuroraBackground } from "@/components/AuroraBackground";
import { HeroBackdrop3D } from "@/components/HeroBackdrop3D";
import { BrandLockup } from "@/components/Brand";
import { NotificationBell } from "@/components/NotificationBell";
import { CommandPalette } from "@/components/CommandPalette";

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
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [open, setOpen] = useState(false);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const safeNav = Array.isArray(nav) ? nav : [];

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
  }, []);

  // close drawer on route change
  useEffect(() => { setOpen(false); }, [path]);

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
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
  const bottomNav = safeNav.slice(0, 5);

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <AuroraBackground intensity={intensity} />
      <CommandPalette />

      <div className="flex min-h-screen">
        {/* === Desktop sidebar === */}
        <aside className="hidden lg:flex lg:w-[260px] lg:flex-shrink-0 lg:flex-col lg:border-r lg:border-border/70 lg:bg-card/60 lg:backdrop-blur-xl">
          <div className="flex h-16 items-center px-5 border-b border-border/70">
            <BrandLockup size={28} badge={badge} />
          </div>
          <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
            {safeNav.map((item, i) => {
              const active = isActive(item);
              return (
                <Link
                  key={item.label}
                  to={item.to}
                  params={item.params}
                  className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                    active
                      ? "bg-primary/10 text-primary shadow-[0_0_24px_-6px_oklch(0.7_0.26_335/0.55)] ring-1 ring-primary/30"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground hover:ring-1 hover:ring-primary/15"
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
          {/* Desktop top bar — notification bell lives here so the dropdown
              has room to open downward instead of clipping at the sidebar. */}
          <header className="sticky top-0 z-30 hidden h-12 items-center justify-end gap-1 border-b border-border/70 bg-background/80 px-4 backdrop-blur-xl lg:flex">
            <NotificationBell />
          </header>

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
            <div className="flex items-center gap-1">
              <NotificationBell />
              <button
                onClick={signOut}
                className="rounded-lg p-2 text-muted-foreground hover:bg-secondary"
                aria-label="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </header>

          {/* Main content */}
          <main className="min-w-0 flex-1 px-3 pb-24 pt-4 sm:px-5 lg:px-6 xl:px-8 lg:pb-10">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/35 px-4 py-5 shadow-pop backdrop-blur-xl sm:px-6 sm:py-6"
            >
              <HeroBackdrop3D />
              <div className="relative z-10 flex flex-wrap items-end justify-between gap-4">
                <div className="min-w-0">
                  <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.28em] text-primary shadow-[0_0_24px_-6px_oklch(0.72_0.26_330/0.6)]">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
                    </span>
                    {badge}
                  </div>
                  <motion.h1
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1, duration: 0.6 }}
                    className="mt-3 max-w-full font-display text-3xl font-extrabold leading-tight tracking-normal sm:text-4xl lg:text-5xl"
                  >
                    <span className="text-gradient-hot">{title}</span>
                  </motion.h1>
                  {subtitle && (
                    <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
                      {subtitle}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className="hidden font-mono text-[11px] text-muted-foreground sm:inline">{email}</span>
                  <div className="hidden items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-300 sm:flex">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_10px_currentColor]" />
                    Console online
                  </div>
                </div>
              </div>
            </motion.div>
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
                {safeNav.map((item) => {
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
