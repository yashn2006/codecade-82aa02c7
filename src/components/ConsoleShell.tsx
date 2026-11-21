import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronRight,
  Compass,
  KeyRound,
  LifeBuoy,
  LogOut,
  Menu,
  SlidersHorizontal,
  Sparkles,
  X,
  type LucideIcon,
} from "lucide-react";
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
import { BrandLockup, BrandMark } from "@/components/Brand";
import { NotificationBell } from "@/components/NotificationBell";
import { CommandPalette } from "@/components/CommandPalette";
import { PageTransition } from "@/components/PageTransition";
import { cn } from "@/lib/utils";

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
  hash?: string;
  exact?: boolean;
  /** Extra path prefixes that should light this tab up. */
  match?: string[];
  more?: boolean;
};

export function ConsoleShell({
  badge,
  title,
  subtitle,
  nav,
  tabs,
  children,
  intensity = "default",
  banner,
  hideHubLink = false,
  hidePasswordLink = false,
  userLabel,
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
  hideHubLink?: boolean;
  hidePasswordLink?: boolean;
  userLabel?: string;
}) {
  const navigate = useNavigate();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [open, setOpen] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [effectsPref, setEffectsPref] = useState<"liquid" | "crisp">("liquid");
  const [motionPref, setMotionPref] = useState<"smooth" | "reduced">("smooth");
  const mainRef = useRef<HTMLElement>(null);
  const sheetSwipeY = useRef<number | null>(null);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const routerHash = useRouterState({ select: (s) => s.location.hash });
  const [winHash, setWinHash] = useState<string>(() =>
    typeof window !== "undefined" ? window.location.hash : "",
  );
  const hash = routerHash || winHash;
  const safeNav = useMemo(() => (Array.isArray(nav) ? nav : []), [nav]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sync = () => setWinHash(window.location.hash);
    sync();
    window.addEventListener("hashchange", sync);
    window.addEventListener("popstate", sync);
    return () => {
      window.removeEventListener("hashchange", sync);
      window.removeEventListener("popstate", sync);
    };
  }, [path, routerHash]);

  const normalizeHash = (h?: string) => {
    const clean = (h ?? "").replace(/^#/, "").trim();
    return clean || undefined;
  };

  const splitTarget = (to: string, params?: Record<string, string>, explicitHash?: string) => {
    const [rawPath, inlineHash] = to.split("#");
    const pathname = params
      ? rawPath.replace(/\$(\w+)/g, (_, k) => params[k] ?? "")
      : rawPath;
    const resolvedHash = normalizeHash(explicitHash ?? inlineHash);
    return { rawPath, pathname, hash: resolvedHash };
  };

  const preloadRouteTarget = useCallback(
    (to?: string, params?: Record<string, string>, targetHash?: string) => {
      if (!to) return;
      const [rawPath, inlineHash] = to.split("#");
      const h = normalizeHash(targetHash ?? inlineHash);
      void router
        .preloadRoute({
          to: rawPath as never,
          params: params as never,
          hash: h,
        })
        .catch(() => {});
    },
    [router],
  );

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
    if (typeof window !== "undefined") {
      const savedFx = window.localStorage.getItem("cc_pref_effects") === "crisp" ? "crisp" : "liquid";
      const savedMo = window.localStorage.getItem("cc_pref_motion") === "reduced" ? "reduced" : "smooth";
      setEffectsPref(savedFx);
      setMotionPref(savedMo);
      document.documentElement.dataset.effects = savedFx;
      document.documentElement.dataset.motion = savedMo;
    }
  }, []);

  const updateEffectsPref = (next: "liquid" | "crisp") => {
    setEffectsPref(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("cc_pref_effects", next);
      document.documentElement.dataset.effects = next;
    }
  };

  const updateMotionPref = (next: "smooth" | "reduced") => {
    setMotionPref(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("cc_pref_motion", next);
      document.documentElement.dataset.motion = next;
    }
  };

  useEffect(() => {
    setOpen(false);
    mainRef.current?.scrollTo({ top: 0, behavior: "auto" });
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "auto" });
    }
  }, [path, hash]);

  // Hide floating mobile dock when soft keyboard or text input is active on small screens
  useEffect(() => {
    if (typeof window === "undefined") return;
    const isTextField = (el: EventTarget | null) => {
      if (!(el instanceof HTMLElement)) return false;
      if (el.isContentEditable) return true;
      const tag = el.tagName;
      if (tag === "TEXTAREA" || tag === "SELECT") return true;
      if (tag === "INPUT") {
        const type = (el as HTMLInputElement).type;
        return !["checkbox", "radio", "button", "submit", "reset", "file", "range", "color"].includes(type);
      }
      return false;
    };

    const onFocusIn = (e: FocusEvent) => {
      if (window.innerWidth < 1024 && isTextField(e.target)) {
        setKeyboardOpen(true);
      }
    };
    const onFocusOut = () => {
      window.setTimeout(() => {
        if (!isTextField(document.activeElement)) {
          setKeyboardOpen(false);
        }
      }, 60);
    };
    const vv = window.visualViewport;
    const onResize = () => {
      if (!vv || window.innerWidth >= 1024) {
        setKeyboardOpen(false);
        return;
      }
      if (vv.height < window.innerHeight * 0.78) {
        setKeyboardOpen(true);
      } else if (!isTextField(document.activeElement)) {
        setKeyboardOpen(false);
      }
    };

    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    vv?.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      vv?.removeEventListener("resize", onResize);
    };
  }, []);

  // Quietly preload sibling route JS chunks while idle so sidebar/dock clicks feel instantaneous.
  useEffect(() => {
    if (typeof window === "undefined" || safeNav.length <= 1) return;
    const seen = new Set<string>();
    const targets = safeNav.filter((n) => {
      const resolved = n.params ? n.to.replace(/\$(\w+)/g, (_, k) => n.params?.[k] ?? "") : n.to;
      if (resolved === path || seen.has(resolved)) return false;
      seen.add(resolved);
      return true;
    });
    const timers: number[] = [];
    const startTimer = window.setTimeout(() => {
      targets.forEach((item, idx) => {
        const t = window.setTimeout(() => {
          preloadRouteTarget(item.to, item.params, item.hash);
        }, idx * 70);
        timers.push(t);
      });
    }, 220);
    return () => {
      window.clearTimeout(startTimer);
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [safeNav, path, preloadRouteTarget]);

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const resolveTo = (to: string, params?: Record<string, string>) =>
    splitTarget(to, params).pathname;

  const isHashScopedRoute = (pathname: string) =>
    safeNav.some((n) => splitTarget(n.to, n.params, n.hash).pathname === pathname && (n.hash !== undefined || n.to.includes("#")));

  const linkHashProp = (pathname: string, targetHash?: string) =>
    isHashScopedRoute(pathname) ? (targetHash ?? "") : targetHash;

  const isActive = (item: NavItem) => {
    const { pathname: target, hash: itemHash } = splitTarget(item.to, item.params, item.hash);
    const pathMatches = item.exact
      ? path === target
      : path === target || path.startsWith(target + "/");
    if (!pathMatches) return false;
    const hashScoped =
      item.hash !== undefined || item.to.includes("#") || isHashScopedRoute(target);
    if (!hashScoped) return true;
    const current = normalizeHash(hash) ?? "";
    const wanted = itemHash ?? "";
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
    const primary = safeNav.slice(0, 4).map((n) => {
      const parsed = splitTarget(n.to, n.params, n.hash);
      return {
        label: n.label.split(" ")[0],
        icon: n.icon,
        to: parsed.rawPath,
        params: n.params,
        hash: parsed.hash,
        exact: n.exact,
      };
    });
    return [...primary, { label: "Menu", icon: Menu, more: true }];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabs, safeNav]);

  const tabActive = (t: MobileTab) => {
    if (t.more) return false;
    if (!t.to) return false;
    const { pathname: target, hash: tabHash } = splitTarget(t.to, t.params, t.hash);
    const hit = t.exact ? path === target : path === target || path.startsWith(target + "/");
    if (hit) {
      const hashScoped =
        t.hash !== undefined || t.to.includes("#") || isHashScopedRoute(target);
      if (!hashScoped) return true;
      const current = normalizeHash(hash) ?? "";
      const wanted = tabHash ?? "";
      return current === wanted;
    }
    return (t.match ?? []).some((m) => {
      const r = resolveTo(m, t.params);
      return path === r || path.startsWith(r + "/");
    });
  };
  const anyTabActive = mobileTabs.some(tabActive);

  // Mobile header shows the section you're on (most specific match wins).
  const currentLabel = useMemo(() => {
    let best: { label: string; len: number } | null = null;
    for (const item of safeNav) {
      if (!isActive(item)) continue;
      const len = resolveTo(item.to, item.params).length;
      if (!best || len > best.len) best = { label: item.label, len };
    }
    return best?.label ?? title;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeNav, path, hash, title]);

  // Lock page scroll and bind Escape key while the "More" sheet is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const displayAccount = userLabel || email;
  const avatar = (displayAccount[0] ?? "?").toUpperCase();

  return (
    <>
    <div className="relative min-h-dvh w-full max-w-full overflow-x-clip lg:h-dvh lg:overflow-hidden bg-background text-foreground flex flex-col lg:flex-row">
      <AuroraBackground intensity={intensity} />
      <CommandPalette />

      {/* ============ Desktop sidebar (Pinned, Fixed height, Full width only) ============ */}
      <aside className="relative z-30 hidden lg:flex h-dvh w-[230px] flex-shrink-0 flex-col liquid-glass-sidebar select-none">
        {/* Brand / Logo */}
        <div className="flex h-[54px] shrink-0 items-center px-4 border-b border-white/[0.08]">
          <BrandLockup size={22} to={safeNav[0]?.to ?? "/"} params={safeNav[0]?.params} />
        </div>

        {/* Section title & subtitle */}
        <div className="px-4 py-3 shrink-0">
          <div className="truncate font-display text-sm font-bold leading-tight">{title}</div>
          {subtitle && (
            <div className="truncate font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              {subtitle}
            </div>
          )}
        </div>

        {/* Navigation items */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-2 space-y-4">
          {groups.map((g) => (
            <div key={g.label ?? "root"} className="space-y-1">
              {g.label && (
                <div className="px-3 pb-1 pt-1 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground/70">
                  {g.label}
                </div>
              )}
              <div className="space-y-0.5">
                {g.items.map((item) => {
                  const active = isActive(item);
                  const target = splitTarget(item.to, item.params, item.hash);
                  return (
                    <Link
                      key={item.label}
                      to={target.rawPath as never}
                      params={item.params as never}
                      hash={linkHashProp(target.pathname, target.hash)}
                      onMouseEnter={() => preloadRouteTarget(item.to, item.params, item.hash)}
                      onFocus={() => preloadRouteTarget(item.to, item.params, item.hash)}
                      className={cn(
                        "group relative flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-medium transition-colors duration-150",
                        active
                          ? "text-primary font-semibold"
                          : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                      )}
                      style={
                        active
                          ? {
                              background: "rgba(255,0,200,0.12)",
                              border: "1px solid rgba(255, 43, 206, 0.3)",
                              boxShadow: "0 0 20px -8px rgba(255, 43, 206, 0.45)",
                            }
                          : { border: "1px solid transparent" }
                      }
                    >
                      <item.icon
                        className={cn(
                          "h-4 w-4 shrink-0 transition-transform duration-200 group-hover:scale-110",
                          active ? "text-primary drop-shadow-[0_0_8px_var(--primary)]" : "text-muted-foreground group-hover:text-foreground"
                        )}
                      />
                      <span className="truncate">{item.label}</span>
                      {active && (
                        <span className="absolute right-2 h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_8px_currentColor]" />
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Sidebar Footer — User profile */}
        <div className="p-3 shrink-0 border-t border-white/[0.08]">
          <div className="flex items-center gap-2 rounded-xl bg-white/[0.04] border border-white/[0.06] p-2">
            <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-primary to-accent text-[11px] font-bold text-primary-foreground">
              {avatar}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[11px] font-medium">{displayAccount || "—"}</div>
            </div>
            <button
              onClick={signOut}
              className="rounded-md p-1.5 text-muted-foreground transition hover:bg-white/10 hover:text-destructive"
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* ============ Main Center Container ============ */}
      <div className="relative flex min-w-0 w-full max-w-full flex-1 min-h-dvh flex-col overflow-x-clip lg:h-dvh lg:overflow-hidden">
        {/* Header bar — sticky on mobile document flow, pinned on desktop */}
        <header
          className="mobile-header mobile-keep-blur sticky top-0 shrink-0 z-30 w-full max-w-full min-h-[54px] liquid-glass-header grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-3 py-1.5 lg:relative lg:grid-cols-[1fr_auto_1fr] lg:h-[54px] lg:py-0 sm:px-4"
          style={{
            paddingTop: "max(env(safe-area-inset-top), 0.375rem)",
          }}
        >
          <div className="flex min-w-0 items-center gap-2 lg:justify-self-start">
            {/* Mobile: Menu drawer button + logo mark + current section */}
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Open navigation menu"
              aria-expanded={open}
              className={cn(
                "grid h-10 w-10 shrink-0 place-items-center rounded-xl border transition active:scale-95 lg:hidden",
                open
                  ? "border-primary/60 bg-primary/20 text-primary shadow-[0_0_16px_-4px_var(--primary)]"
                  : "border-white/12 bg-white/[0.06] text-foreground hover:bg-white/10",
              )}
            >
              <Menu className="h-4.5 w-4.5" />
            </button>
            <Link
              to={(safeNav[0]?.to ?? "/") as never}
              params={safeNav[0]?.params as never}
              className="flex h-10 w-9 items-center justify-center shrink-0 lg:hidden"
              aria-label="Home"
            >
              <BrandMark size={28} />
            </Link>
            <div className="min-w-0 flex-1 leading-tight lg:hidden">
              <motion.div
                key={currentLabel}
                initial={{ opacity: 0.7, y: 3 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
                className="truncate font-display text-[15px] font-extrabold tracking-tight"
              >
                {currentLabel}
              </motion.div>
              <div className="truncate font-mono text-[9px] uppercase tracking-[0.18em] text-primary/85">
                {title}
              </div>
            </div>
            <span className="hidden shrink-0 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em] text-primary lg:inline">
              {badge}
            </span>
          </div>

          <div className="hidden min-w-0 items-center justify-center lg:flex lg:justify-self-center">
            <div className="inline-flex max-w-[44vw] items-center gap-2 overflow-hidden px-3.5 py-1 rounded-full bg-white/[0.04] border border-white/10 shadow-[0_2px_12px_rgba(0,0,0,0.25)] backdrop-blur-md text-xs font-medium">
              {!hideHubLink && (
                <>
                  <Link
                    to={(path.startsWith("/admin") ? "/admin" : path.startsWith("/portal") ? "/portal" : "/owner") as never}
                    className="text-muted-foreground hover:text-white transition flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap shrink-0"
                  >
                    {path.startsWith("/admin") ? "Admin HQ" : path.startsWith("/portal") ? "Gamer Portal" : "Owner Hub"}
                  </Link>
                  <ChevronRight className="h-3 w-3 text-muted-foreground/60 shrink-0" />
                </>
              )}
              <span className="font-bold text-foreground max-w-[180px] truncate">{title}</span>
              {currentLabel && currentLabel !== title && (
                <>
                  <ChevronRight className="h-3 w-3 text-muted-foreground/60 shrink-0" />
                  <span className="whitespace-nowrap shrink-0 px-2.5 py-0.5 rounded-full bg-primary/20 border border-primary/30 text-primary text-[11px] font-bold shadow-[0_0_12px_rgba(255,43,206,0.3)]">
                    {currentLabel}
                  </span>
                </>
              )}
            </div>
          </div>

            <div className="flex shrink-0 items-center gap-1 lg:justify-self-end">
              <span className="hidden items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em] text-emerald-300 sm:flex">
                <span className="h-1.5 w-1.5 animate-dot-pulse rounded-full bg-emerald-300 shadow-[0_0_10px_currentColor]" />
                Console online
              </span>
              <NotificationBell />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    title={displayAccount || "Account"}
                    aria-label="Account menu"
                    className="grid h-10 w-10 place-items-center rounded-full p-1 transition hover:opacity-90 active:scale-95"
                  >
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-primary to-accent text-[11px] font-bold text-primary-foreground shadow-[0_0_14px_-2px_oklch(0.7_0.26_335/0.6)]">
                      {avatar}
                    </span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60">
                  <DropdownMenuLabel>
                    <div className="truncate text-xs font-semibold">{displayAccount || "Signed in"}</div>
                    <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                      {badge}
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    {path.startsWith("/portal") ? (
                      <Link to="/portal" hash="support">
                        <LifeBuoy className="mr-2 h-4 w-4" /> Support &amp; Help
                      </Link>
                    ) : path.startsWith("/admin") ? (
                      <Link to="/admin/support">
                        <LifeBuoy className="mr-2 h-4 w-4" /> Support HQ
                      </Link>
                    ) : path.startsWith("/cafe/") ? (
                      <Link to="/cafe/$slug/support" params={{ slug: path.split("/")[2] ?? "" }}>
                        <LifeBuoy className="mr-2 h-4 w-4" /> Café Support
                      </Link>
                    ) : (
                      <Link to="/owner/help">
                        <LifeBuoy className="mr-2 h-4 w-4" /> Help center
                      </Link>
                    )}
                  </DropdownMenuItem>
                  {!hidePasswordLink && (
                    <DropdownMenuItem asChild>
                      <Link to="/reset-password">
                        <KeyRound className="mr-2 h-4 w-4" /> Change password
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={(e) => {
                      e.preventDefault();
                      void signOut();
                    }}
                    className="text-destructive focus:text-destructive"
                  >
                    <LogOut className="mr-2 h-4 w-4" /> Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          {banner ? (
            <div className="relative z-20 shrink-0">
              {banner}
            </div>
          ) : null}

          {/* Main content — native document flow on mobile, independent viewport on desktop */}
          <main
            ref={mainRef}
            className="dashboard-content flex-1 min-w-0 w-full max-w-full overflow-x-clip px-3.5 pb-[calc(max(env(safe-area-inset-bottom),10px)+6rem)] pt-3.5 sm:px-6 lg:overflow-y-auto lg:overscroll-y-contain lg:px-8 lg:pb-12"
          >
            <PageTransition routeKey={normalizeHash(hash) ? `${path}#${normalizeHash(hash)}` : path}>{children}</PageTransition>
          </main>
        </div>
      </div>

      {/* soft fade so content melts under the floating dock */}
      {!keyboardOpen && (
        <div
          aria-hidden
          className="mobile-dock-fade pointer-events-none fixed inset-x-0 bottom-0 z-30 h-24 lg:hidden"
        />
      )}

      {/* ============ Mobile floating dock ============ */}
      {!keyboardOpen && (
      <nav
        className="fixed inset-x-0 bottom-0 z-40 w-full max-w-full px-2 sm:px-3 lg:hidden"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 8px)" }}
        aria-label="Primary"
      >
        <div
          className="mobile-dock mobile-keep-blur liquid-glass-dock relative mx-auto grid h-[56px] w-full max-w-md gap-0.5 sm:gap-1 overflow-hidden rounded-[22px] p-1 shadow-[0_20px_50px_rgba(0,0,0,0.75)]"
          style={{ gridTemplateColumns: `repeat(${mobileTabs.length}, minmax(0,1fr))` }}
        >
          {mobileTabs.map((t) => {
            const active = t.more ? open || !anyTabActive : tabActive(t);
            const cls = `relative flex min-h-[44px] min-w-0 overflow-hidden flex-col items-center justify-center gap-0.5 rounded-[16px] px-0.5 text-[9.5px] sm:text-[10px] font-semibold tracking-wide transition-colors duration-150 active:scale-[0.94] ${
              active ? "text-foreground" : "text-muted-foreground"
            }`;
            const inner = (
              <>
                {active && (
                  <span
                    aria-hidden
                    className="dock-active pointer-events-none absolute inset-0 rounded-[16px]"
                  />
                )}
                <t.icon
                  className={`relative z-10 h-[18px] w-[18px] shrink-0 transition-transform duration-150 ${active ? "-translate-y-px text-primary drop-shadow-[0_0_8px_var(--primary)]" : ""}`}
                  strokeWidth={active ? 2.3 : 1.8}
                />
                <span className="relative z-10 block w-full truncate text-center px-0.5 leading-tight">{t.label}</span>
              </>
            );
            if (t.more || !t.to) {
              return (
                <button
                  key={t.label}
                  type="button"
                  onClick={() => setOpen((v) => !v)}
                  className={cls}
                  aria-label="More menu"
                  aria-expanded={open}
                >
                  {inner}
                </button>
              );
            }
            const parsed = splitTarget(t.to, t.params, t.hash);
            return (
              <Link
                key={t.label}
                to={parsed.rawPath as never}
                params={t.params as never}
                hash={linkHashProp(parsed.pathname, parsed.hash)}
                onMouseEnter={() => preloadRouteTarget(t.to, t.params, t.hash)}
                onFocus={() => preloadRouteTarget(t.to, t.params, t.hash)}
                onClick={() => setOpen(false)}
                className={cls}
                aria-current={active ? "page" : undefined}
              >
                {inner}
              </Link>
            );
          })}
        </div>
      </nav>
      )}

      {/* ============ "More" sheet ============ */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="mobile-sheet-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.14 }}
            onClick={() => setOpen(false)}
            className="mobile-keep-blur fixed inset-0 z-[60] bg-background/75 backdrop-blur-sm lg:hidden"
          />
        )}
        {open && (
          <motion.aside
            key="mobile-sheet-drawer"
            role="dialog"
            aria-modal="true"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 520, damping: 42, mass: 0.55 }}
            className="mobile-sheet mobile-keep-blur fixed inset-x-0 bottom-0 z-[70] w-full max-w-full flex max-h-[88dvh] flex-col overflow-hidden rounded-t-[30px] lg:hidden"
            style={{
              paddingBottom: "max(env(safe-area-inset-bottom), 1rem)",
              willChange: "transform",
            }}
            aria-label="More navigation"
          >
            {/* drag handle + header — swipe down or tap close */}
            <div
              className="touch-none select-none"
              onTouchStart={(e) => {
                sheetSwipeY.current = e.touches[0]?.clientY ?? null;
              }}
              onTouchEnd={(e) => {
                const startY = sheetSwipeY.current;
                sheetSwipeY.current = null;
                const endY = e.changedTouches[0]?.clientY;
                if (startY != null && endY != null && endY - startY > 56) {
                  setOpen(false);
                }
              }}
            >
              <div className="flex justify-center pt-3">
                <span className="h-1.5 w-11 rounded-full bg-white/30" />
              </div>
              <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-3">
                <div className="flex min-w-0 items-center gap-3">
                  <BrandMark size={38} />
                  <div className="min-w-0">
                    <div className="truncate font-display text-lg font-extrabold leading-tight">
                      {title}
                    </div>
                    <div className="truncate font-mono text-[10px] uppercase tracking-[0.22em] text-primary/85">
                      {badge}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.06] text-white/80 transition active:scale-90"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 space-y-5">
              {/* Account & Quick Utility Strip */}
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary to-accent text-xs font-bold text-primary-foreground">
                    {avatar}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-xs font-semibold text-white">{displayAccount || "Signed in"}</div>
                    <div className="font-mono text-[9px] uppercase tracking-wider text-emerald-300">Session active</div>
                  </div>
                </div>
                <Link
                  to="/discover"
                  onClick={() => setOpen(false)}
                  className="inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-xl border border-primary/35 bg-primary/15 px-3 text-[11px] font-semibold text-primary active:scale-95"
                >
                  <Compass className="h-3.5 w-3.5" /> Arenas
                </Link>
              </div>

              {/* Navigation Sections */}
              {groups.map((g) => (
                <div key={g.label ?? "root"}>
                  {g.label && (
                    <div className="flex items-center gap-2 px-1 pb-2.5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                      <span className="h-px w-3 bg-primary/60" />
                      {g.label}
                    </div>
                  )}
                  <div className="grid grid-cols-3 gap-2.5">
                    {g.items.map((item) => {
                      const active = isActive(item);
                      const parsed = splitTarget(item.to, item.params, item.hash);
                      return (
                        <Link
                          key={item.label}
                          to={parsed.rawPath as never}
                          params={item.params as never}
                          hash={linkHashProp(parsed.pathname, parsed.hash)}
                          onMouseEnter={() => preloadRouteTarget(item.to, item.params, item.hash)}
                          onClick={() => setOpen(false)}
                          data-active={active || undefined}
                          className="sheet-tile flex min-h-[84px] min-w-0 flex-col items-center justify-center gap-2 rounded-[20px] p-2.5 text-center transition active:scale-95"
                        >
                          <span className="sheet-tile-icon grid h-10 w-10 place-items-center rounded-2xl">
                            <item.icon className="h-[19px] w-[19px]" />
                          </span>
                          <span className="line-clamp-2 text-[11px] font-semibold leading-tight">
                            {item.label}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}

                {/* Mobile Display & Motion Preferences */}
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3.5 space-y-3">
                  <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    <SlidersHorizontal className="h-3.5 w-3.5 text-primary" />
                    <span>Mobile Preferences</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <div className="mb-1.5 text-[11px] font-medium text-white/80 flex items-center gap-1">
                        <Sparkles className="h-3 w-3 text-primary" /> Glass Finish
                      </div>
                      <div className="grid grid-cols-2 gap-1 rounded-xl border border-white/10 bg-black/30 p-1">
                        {(["liquid", "crisp"] as const).map((val) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => updateEffectsPref(val)}
                            className={cn(
                              "min-h-[36px] rounded-lg text-[11px] font-semibold capitalize transition",
                              effectsPref === val ? "bg-primary text-white shadow" : "text-muted-foreground hover:text-white",
                            )}
                          >
                            {val}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="mb-1.5 text-[11px] font-medium text-white/80">Transitions</div>
                      <div className="grid grid-cols-2 gap-1 rounded-xl border border-white/10 bg-black/30 p-1">
                        {(["smooth", "reduced"] as const).map((val) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => updateMotionPref(val)}
                            className={cn(
                              "min-h-[36px] rounded-lg text-[11px] font-semibold capitalize transition",
                              motionPref === val ? "bg-primary text-white shadow" : "text-muted-foreground hover:text-white",
                            )}
                          >
                            {val === "reduced" ? "Fast" : "Smooth"}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className={cn("grid gap-2.5", hidePasswordLink ? "grid-cols-1" : "grid-cols-2")}>
                  {!hidePasswordLink && (
                    <Link
                      to="/reset-password"
                      onClick={() => setOpen(false)}
                      className="flex min-h-[44px] items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 text-xs font-semibold text-white/90 transition active:scale-[0.98]"
                    >
                      <KeyRound className="h-4 w-4 text-primary" /> Password
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      void signOut();
                    }}
                    className="flex min-h-[44px] items-center justify-center gap-2 rounded-2xl border border-destructive/35 bg-destructive/15 px-3 text-xs font-semibold text-destructive transition active:scale-[0.98]"
                  >
                    <LogOut className="h-4 w-4" /> Log out
                  </button>
                </div>
              </div>
            </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}
