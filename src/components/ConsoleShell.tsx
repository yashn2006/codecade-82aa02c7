import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { KeyRound, LifeBuoy, LogOut, Menu, X, type LucideIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/lib/supabase/client";
import { AuroraBackground } from "@/components/AuroraBackground";
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
  /** Section heading this item belongs to in the desktop sidebar. */
  group?: string;
};

/** Bottom-bar tab (mobile). `more: true` opens the full menu sheet. */
export type MobileTab = {
  label: string;
  icon: LucideIcon;
  to?: string;
  params?: Record<string, string>;
  exact?: boolean;
  /** Extra path prefixes that should light this tab up. */
  match?: string[];
  more?: boolean;
};

export function ConsoleShell({
  badge, title, subtitle, nav, tabs, children, intensity = "default", banner,
}: {
  badge: string;
  title: string;
  subtitle?: string;
  nav: NavItem[];
  tabs?: MobileTab[];
  children: ReactNode;
  intensity?: "default" | "hero" | "immersive";
  /** Slim sticky strip rendered directly under the header (trial notices etc). */
  banner?: ReactNode;
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

  useEffect(() => { setOpen(false); }, [path, hash]);

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const resolveTo = (to: string, params?: Record<string, string>) =>
    params ? to.replace(/\$(\w+)/g, (_, k) => params[k] ?? "") : to;

  const isActive = (item: NavItem) => {
    const target = resolveTo(item.to, item.params);
    const pathMatches = item.exact ? path === target : path === target || path.startsWith(target + "/");
    if (!pathMatches) return false;
    const hashScoped = safeNav.some((n) => resolveTo(n.to, n.params) === target && n.hash !== undefined);
    if (!hashScoped) return true;
    const current = (hash ?? "").replace(/^#/, "");
    const wanted = (item.hash ?? "").replace(/^#/, "");
    return current === wanted;
  };

  // ---- desktop grouping -------------------------------------------------
  const groups = useMemo(() => {
    const out: { label: string | null; items: NavItem[] }[] = [];
    for (const item of safeNav) {
      const key = item.group ?? null;
      const last = out[out.length - 1];
      if (last && last.label === key) last.items.push(item);
      else out.push({ label: key, items: [item] });
    }
    return out;
  }, [safeNav]);

  // ---- mobile tabs ------------------------------------------------------
  const mobileTabs: MobileTab[] = useMemo(() => {
    if (tabs?.length) return tabs;
    const primary = safeNav.slice(0, 4).map((n) => ({
      label: n.label.split(" ")[0], icon: n.icon, to: n.to, params: n.params, exact: n.exact,
    }));
    return safeNav.length > 4
      ? [...primary, { label: "More", icon: Menu, more: true }]
      : primary;
  }, [tabs, safeNav]);

  const tabActive = (t: MobileTab) => {
    if (t.more) return false;
    if (!t.to) return false;
    const target = resolveTo(t.to, t.params);
    const hit = t.exact ? path === target : path === target || path.startsWith(target + "/");
    if (hit) return true;
    return (t.match ?? []).some((m) => {
      const r = resolveTo(m, t.params);
      return path === r || path.startsWith(r + "/");
    });
  };
  const anyTabActive = mobileTabs.some(tabActive);

  const avatar = (email[0] ?? "?").toUpperCase();

  return (
    <div className="relative min-h-screen overflow-x-clip bg-background text-foreground">
      <AuroraBackground intensity={intensity} />
      <CommandPalette />

      <div className="flex min-h-screen">
        {/* ============ Desktop sidebar (220px) ============ */}
        <aside
          className="relative z-30 hidden lg:flex lg:w-[220px] lg:flex-shrink-0 lg:flex-col"
          style={{
            background: "rgba(0,0,0,0.4)",
            backdropFilter: "blur(12px)",
            borderRight: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div className="flex h-[52px] items-center px-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <BrandLockup size={22} to={safeNav[0]?.to ?? "/"} params={safeNav[0]?.params} />
          </div>

          <div className="px-4 py-3">
            <div className="truncate font-display text-sm font-bold leading-tight">{title}</div>
            {subtitle && (
              <div className="truncate font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                {subtitle}
              </div>
            )}
          </div>

          <nav className="flex-1 overflow-y-auto px-2 pb-4">
            {groups.map((g) => (
              <div key={g.label ?? "root"} className="mb-3">
                {g.label && (
                  <div className="px-3 pb-1.5 pt-2 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground/70">
                    {g.label}
                  </div>
                )}
                <div className="space-y-0.5">
                  {g.items.map((item) => {
                    const active = isActive(item);
                    return (
                      <Link
                        key={item.label}
                        to={item.to}
                        params={item.params}
                        hash={item.hash}
                        className={`group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors ${
                          active ? "text-primary" : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                        }`}
                        style={active ? {
                          background: "rgba(255,0,200,0.08)",
                          borderLeft: "3px solid var(--color-magenta, oklch(0.7 0.26 335))",
                          boxShadow: "inset 0 0 24px -12px var(--color-magenta, oklch(0.7 0.26 335))",
                        } : { borderLeft: "3px solid transparent" }}
                      >
                        <item.icon className={`h-4 w-4 shrink-0 transition-colors ${active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"}`} />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          <div className="p-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="flex items-center gap-2 rounded-xl bg-white/5 p-2">
              <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-primary to-accent text-[11px] font-bold text-primary-foreground">
                {avatar}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[11px] font-medium">{email || "—"}</div>
              </div>
              <button
                onClick={signOut}
                className="rounded-md p-1.5 text-muted-foreground transition hover:bg-background hover:text-destructive"
                aria-label="Sign out"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </aside>

        {/* ============ Main column ============ */}
        <div className="relative flex min-w-0 flex-1 flex-col">
          {/* Header bar — 52px, mobile + desktop */}
          <header
            className="sticky top-0 z-30 flex h-[52px] items-center justify-between gap-3 px-3 sm:px-4"
            style={{
              background: "rgba(0,0,0,0.6)",
              backdropFilter: "blur(20px)",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <div className="flex min-w-0 items-center gap-2">
              <span className="lg:hidden">
                <BrandLockup size={20} to={safeNav[0]?.to ?? "/"} params={safeNav[0]?.params} />
              </span>
              <span className="hidden shrink-0 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em] text-primary sm:inline">
                {badge}
              </span>
            </div>

            <div className="hidden min-w-0 flex-1 justify-center lg:flex">
              <span className="truncate font-display text-sm font-bold">{title}</span>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              <span className="hidden items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em] text-emerald-300 sm:flex">
                <span className="h-1.5 w-1.5 animate-dot-pulse rounded-full bg-emerald-300 shadow-[0_0_10px_currentColor]" />
                Console online
              </span>
              <NotificationBell />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    title={email || "Account"}
                    aria-label="Account menu"
                    className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-primary to-accent text-[11px] font-bold text-primary-foreground transition hover:opacity-90"
                  >
                    {avatar}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60">
                  <DropdownMenuLabel>
                    <div className="truncate text-xs font-semibold">{email || "Signed in"}</div>
                    <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                      {badge}
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/owner/help">
                      <LifeBuoy className="mr-2 h-4 w-4" /> Help center
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/reset-password">
                      <KeyRound className="mr-2 h-4 w-4" /> Change password
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={(e) => { e.preventDefault(); void signOut(); }}
                    className="text-destructive focus:text-destructive"
                  >
                    <LogOut className="mr-2 h-4 w-4" /> Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          {banner ? <div className="sticky top-[52px] z-20">{banner}</div> : null}

          {/* Main content */}
          <main className="min-w-0 px-3 pb-28 pt-4 sm:px-5 lg:px-6 xl:px-8 lg:pb-10">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div
                key={path}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </main>

          {/* ============ Mobile bottom nav — 56px ============ */}
          <nav
            className="fixed inset-x-0 bottom-0 z-30 lg:hidden"
            style={{
              background: "rgba(10,0,20,0.95)",
              backdropFilter: "blur(20px)",
              borderTop: "1px solid rgba(255,100,200,0.15)",
              paddingBottom: "env(safe-area-inset-bottom)",
            }}
            aria-label="Primary"
          >
            <div className="grid h-14" style={{ gridTemplateColumns: `repeat(${mobileTabs.length}, minmax(0,1fr))` }}>
              {mobileTabs.map((t) => {
                const active = t.more ? open || !anyTabActive : tabActive(t);
                const cls = `relative flex h-14 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition active:scale-95 ${
                  active ? "text-primary" : "text-muted-foreground"
                }`;
                const inner = (
                  <>
                    {active && (
                      <span
                        className="pointer-events-none absolute inset-x-3 top-0 h-[2px] rounded-full bg-primary"
                        style={{ boxShadow: "0 0 10px var(--color-magenta, oklch(0.7 0.26 335))" }}
                      />
                    )}
                    <t.icon className="h-[18px] w-[18px]" />
                    <span className="truncate px-1">{t.label}</span>
                  </>
                );
                if (t.more || !t.to) {
                  return (
                    <button key={t.label} type="button" onPointerDown={() => setOpen(true)} className={cls} aria-label="More menu">
                      {inner}
                    </button>
                  );
                }
                return (
                  <Link
                    key={t.label}
                    to={t.to}
                    params={t.params}
                    className={cls}
                    aria-current={active ? "page" : undefined}
                  >
                    {inner}
                  </Link>
                );
              })}
            </div>
          </nav>
        </div>
      </div>

      {/* ============ "More" sheet ============ */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-40 bg-ink/60 backdrop-blur-md lg:hidden"
            />
            <motion.aside
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 460, damping: 40, mass: 0.6 }}
              className="fixed inset-x-0 bottom-0 z-50 flex max-h-[88vh] flex-col overflow-hidden rounded-t-[28px] border-t border-white/10 bg-card/95 backdrop-blur-2xl lg:hidden"
              style={{ paddingBottom: "max(env(safe-area-inset-bottom), 1rem)", willChange: "transform" }}
              aria-label="More navigation"
            >
              <div className="flex justify-center pt-2.5">
                <span className="h-1.5 w-12 rounded-full bg-white/20" />
              </div>
              <div className="flex items-center justify-between px-5 pb-3 pt-3">
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground">{badge}</div>
                  <div className="font-display text-lg font-extrabold">{title}</div>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="rounded-full bg-secondary/60 p-2 text-muted-foreground transition active:scale-90"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-4 pb-4">
                {groups.map((g) => (
                  <div key={g.label ?? "root"} className="mb-4">
                    {g.label && (
                      <div className="px-1 pb-2 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground/70">
                        {g.label}
                      </div>
                    )}
                    <div className="grid grid-cols-3 gap-2.5">
                      {g.items.map((item) => {
                        const active = isActive(item);
                        return (
                          <Link
                            key={item.label}
                            to={item.to}
                            params={item.params}
                            hash={item.hash}
                            onClick={() => setOpen(false)}
                            className={`flex aspect-square flex-col items-center justify-center gap-1.5 rounded-2xl border p-2 text-center transition active:scale-95 ${
                              active
                                ? "border-primary/50 bg-primary/15 text-primary"
                                : "border-white/10 bg-background/40 text-foreground"
                            }`}
                          >
                            <item.icon className="h-5 w-5" />
                            <span className="line-clamp-2 text-[10px] font-medium leading-tight">{item.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
