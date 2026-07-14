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
  hash?: string;
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
  const hash = useRouterState({ select: (s) => s.location.hash });
  const safeNav = Array.isArray(nav) ? nav : [];

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
  }, []);

  // close drawer on route change
  useEffect(() => { setOpen(false); }, [path, hash]);

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
    const pathMatches = item.exact ? path === target : path === target || path.startsWith(target + "/");
    if (!pathMatches) return false;
    // If any sibling item on this same path defines a hash, treat items as
    // hash-scoped: only the matching hash is active (empty hash matches "").
    const hashScoped = safeNav.some((n) => resolveTo(n) === target && n.hash !== undefined);
    if (!hashScoped) return true;
    const current = (hash ?? "").replace(/^#/, "");
    const wanted = (item.hash ?? "").replace(/^#/, "");
    return current === wanted;
  };


  // iOS-style bottom nav: 4 primary tabs + "More" pill if there are extras
  const PRIMARY_COUNT = 4;
  const primaryNav = safeNav.slice(0, PRIMARY_COUNT);
  const overflowNav = safeNav.slice(PRIMARY_COUNT);
  const hasOverflow = overflowNav.length > 0;
  const moreActive = overflowNav.some(isActive);

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <AuroraBackground intensity={intensity} />
      <CommandPalette />

      <div className="flex min-h-screen">
        {/* === Desktop sidebar === */}
        <aside className="hidden lg:flex lg:w-[260px] lg:flex-shrink-0 lg:flex-col lg:border-r lg:border-border/70 lg:bg-card/60 lg:backdrop-blur-xl">
          <div className="flex h-16 items-center px-5 border-b border-border/70">
            <BrandLockup size={28} badge={badge} to={safeNav[0]?.to ?? "/"} params={safeNav[0]?.params} />
          </div>


          <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
            {safeNav.map((item, i) => {
              const active = isActive(item);
              return (
                <Link
                  key={item.label}
                  to={item.to}
                  params={item.params}
                  hash={item.hash}

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

          {/* Mobile top bar — clean: logo + bell. Nav lives in the bottom bar. */}
          <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border/40 bg-background/70 px-4 backdrop-blur-2xl lg:hidden">
            <BrandLockup size={22} badge={badge} to={safeNav[0]?.to ?? "/"} params={safeNav[0]?.params} />

            <div className="flex items-center gap-1">

              <NotificationBell />
              <button
                onClick={signOut}
                className="rounded-full p-2 text-muted-foreground transition active:scale-90 hover:bg-secondary"
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
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div
                key={path}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                className="mt-6"
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </main>


          {/* === iOS-grade mobile bottom nav === */}
          <nav
            className="fixed inset-x-0 bottom-0 z-30 lg:hidden"
            style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0.5rem)" }}
            aria-label="Primary"
          >
            <div className="mx-3 mb-2 overflow-hidden rounded-[28px] border border-white/10 bg-card/60 shadow-[0_18px_60px_-20px_rgba(0,0,0,0.7)] backdrop-blur-2xl supports-[backdrop-filter]:bg-card/40">
              <div className={`relative grid ${hasOverflow ? "grid-cols-5" : "grid-cols-4"}`}>
                {primaryNav.map((item) => {
                  const active = isActive(item);
                  return (
                    <Link
                      key={item.label}
                      to={item.to}
                      params={item.params}
                      hash={item.hash}
                      className="relative isolate flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-medium tracking-wide transition active:scale-95"
                      aria-current={active ? "page" : undefined}
                    >

                      {active && (
                        <motion.span
                          layoutId="mob-nav-pill"
                          className="pointer-events-none absolute inset-x-2 inset-y-1 -z-10 rounded-2xl bg-primary/15 ring-1 ring-primary/40 shadow-[0_0_24px_-6px_oklch(0.72_0.26_330/0.6)]"
                          transition={{ type: "spring", stiffness: 500, damping: 38 }}
                        />
                      )}
                      <item.icon className={`h-[18px] w-[18px] transition ${active ? "text-primary" : "text-muted-foreground"}`} />
                      <span className={`truncate px-1 ${active ? "text-primary" : "text-muted-foreground"}`}>
                        {item.label.split(" ")[0]}
                      </span>
                    </Link>
                  );
                })}
                {hasOverflow && (
                  <button
                    type="button"
                    onPointerDown={() => setOpen(true)}
                    className="relative isolate flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-medium tracking-wide transition active:scale-95"
                    aria-label="More menu"
                  >
                    {moreActive && (
                      <span className="absolute inset-x-2 inset-y-1 -z-10 rounded-2xl bg-primary/15 ring-1 ring-primary/40 shadow-[0_0_24px_-6px_oklch(0.72_0.26_330/0.6)]" />
                    )}
                    <Menu className={`h-[18px] w-[18px] transition ${moreActive ? "text-primary" : "text-muted-foreground"}`} />
                    <span className={moreActive ? "text-primary" : "text-muted-foreground"}>More</span>
                  </button>
                )}
              </div>
            </div>
          </nav>
        </div>
      </div>

      {/* === iOS-style "More" full-screen sheet === */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-40 bg-ink/60 backdrop-blur-md lg:hidden"
            />
            <motion.aside
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 420, damping: 38, mass: 0.7 }}
              className="fixed inset-x-0 bottom-0 z-50 flex max-h-[88vh] flex-col overflow-hidden rounded-t-[32px] border-t border-white/10 bg-card/95 shadow-[0_-30px_80px_-20px_rgba(0,0,0,0.7)] backdrop-blur-2xl lg:hidden"
              style={{ paddingBottom: "max(env(safe-area-inset-bottom), 1rem)", willChange: "transform" }}
              aria-label="More navigation"
            >
              <div className="flex justify-center pt-2.5">
                <span className="h-1.5 w-12 rounded-full bg-white/20" />
              </div>
              <div className="flex items-center justify-between px-5 pb-3 pt-4">
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground">{badge}</div>
                  <div className="font-display text-xl font-extrabold">Menu</div>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="rounded-full bg-secondary/60 p-2 text-muted-foreground transition active:scale-90"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="grid flex-1 grid-cols-3 gap-2.5 overflow-y-auto px-4 pb-4">
                {safeNav.map((item) => {
                  const active = isActive(item);
                  return (
                    <Link
                      key={item.label}
                      to={item.to}
                      params={item.params}
                      onClick={() => setOpen(false)}
                      className={`group flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl border p-3 text-center transition active:scale-95 ${
                        active
                          ? "border-primary/50 bg-primary/15 text-primary shadow-[0_0_28px_-8px_oklch(0.72_0.26_330/0.7)]"
                          : "border-white/10 bg-background/40 text-foreground hover:border-primary/30"
                      }`}
                    >
                      <div className={`grid h-10 w-10 place-items-center rounded-xl ${active ? "bg-primary/20" : "bg-secondary/60"}`}>
                        <item.icon className={`h-5 w-5 ${active ? "text-primary" : "text-foreground"}`} />
                      </div>
                      <span className="line-clamp-2 text-[11px] font-medium leading-tight">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
