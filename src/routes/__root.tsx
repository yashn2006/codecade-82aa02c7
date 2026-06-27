import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { supabase } from "@/lib/supabase/client";
import { Toaster } from "@/components/ui/sonner";
import { getDashboardPathForUser, getSupabaseUserReady } from "@/lib/auth-routing";

function NotFoundComponent() {
  const router = useRouter();
  // If a signed-in user lands here (e.g. Supabase OAuth redirected to a path
  // that isn't a real route, or a race during post-login navigation), bounce
  // them to their dashboard. Show a neutral loading state first so users
  // never see a flash of "404" during the normal sign-in flow.
  const [checked, setChecked] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const user = await getSupabaseUserReady(1500);
      if (cancelled) return;
      if (user) {
        setHasSession(true);
        const path = await getDashboardPathForUser(user);
        if (!cancelled) router.navigate({ to: path, replace: true });
        return;
      }
      setChecked(true);
    })();
    return () => { cancelled = true; };
  }, [router]);

  if (!checked || hasSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
            Loading…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-8xl font-bold text-gradient">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Lost in the matrix</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          This route doesn't exist. Let's get you back to base.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 glow-violet"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}


function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  const message = error?.message || String(error);
  const isAuthIssue = /supabase|fetch|network|auth|jwt|unauthorized/i.test(message);

  const handleHardReset = async () => {
    try { await supabase.auth.signOut(); } catch {}
    try {
      if (typeof window !== "undefined") {
        Object.keys(window.localStorage)
          .filter((k) => k.startsWith("sb-"))
          .forEach((k) => window.localStorage.removeItem(k));
      }
    } catch {}
    if (typeof window !== "undefined") window.location.replace("/auth");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-lg text-center">
        <h1 className="text-xl font-semibold tracking-tight">Something glitched</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {isAuthIssue
            ? "We couldn't reach Supabase from this deployment. Your sign-in session may be stale."
            : "We hit an unexpected error. Try again or head home."}
        </p>
        <pre className="mt-3 max-h-40 overflow-auto rounded-md border border-border bg-muted/30 p-3 text-left text-[11px] leading-relaxed text-muted-foreground">
          {message}
        </pre>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            Try again
          </button>
          <button
            onClick={handleHardReset}
            className="inline-flex items-center justify-center rounded-md border border-border bg-background px-4 py-2 text-sm font-medium transition hover:bg-secondary"
          >
            Clear session & sign in
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-border bg-background px-4 py-2 text-sm font-medium transition hover:bg-secondary"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#0a0613" },
      { title: "CoreCade — The Operating System for Gaming Cafés" },
      {
        name: "description",
        content:
          "CoreCade powers India's gaming cafés. Live sessions, bookings, memberships, devices — one ridiculously fast platform.",
      },
      { name: "author", content: "CoreCade" },
      { property: "og:title", content: "CoreCade — The Operating System for Gaming Cafés" },
      { property: "og:description", content: "A SaaS platform for gaming cafes to manage devices, sessions, customers, and revenue." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "CoreCade — The Operating System for Gaming Cafés" },
      { name: "description", content: "A SaaS platform for gaming cafes to manage devices, sessions, customers, and revenue." },
      { name: "twitter:description", content: "A SaaS platform for gaming cafes to manage devices, sessions, customers, and revenue." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/81cbe3aa-ea1a-4123-ab8e-fe323d3bae63/id-preview-e0d3511e--6c5c5626-7d24-4a67-9368-fb9a601303aa.lovable.app-1781271081091.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/81cbe3aa-ea1a-4123-ab8e-fe323d3bae63/id-preview-e0d3511e--6c5c5626-7d24-4a67-9368-fb9a601303aa.lovable.app-1781271081091.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", href: "/favicon.ico" },
      { rel: "apple-touch-icon", href: "/favicon.ico" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=Inter+Tight:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    // Track the last known user id so we only invalidate router/queries on
    // an ACTUAL identity change. Without this, Supabase fires SIGNED_IN on
    // initial mount / token refresh / tab focus, and router.invalidate()
    // cancels in-flight loaders → empty dashboards on first paint AND a
    // visible "auto-refresh" a couple seconds after every section click.
    let lastUserId: string | null | undefined = undefined;

    const routeByRoleIfNeeded = async () => {
      const path = window.location.pathname;
      // Only auto-route from places where the user can't be (or shouldn't stay)
      const shouldRoute =
        path === "/" || path === "/auth" || path === "/login" || path === "/signup";
      if (!shouldRoute) return;
      const user = await getSupabaseUserReady(1200);
      if (!user) return;
      // Send through the sexy interstitial; it resolves the correct dashboard.
      router.navigate({ to: "/redirecting", replace: true });
      void getDashboardPathForUser;
    };

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      const currentId = session?.user?.id ?? null;
      // First event after mount: just record state, don't invalidate.
      if (lastUserId === undefined) {
        lastUserId = currentId;
        if (event === "SIGNED_IN" && currentId) routeByRoleIfNeeded();
        return;
      }
      // Same identity (token refresh, tab focus, USER_UPDATED) → no-op.
      // USER_UPDATED fires on profile/metadata sync and was causing
      // router.invalidate() + queryClient.invalidateQueries() while the user
      // was actively using the app — visible as a "glitchy auto-reload"
      // a couple seconds after opening any portal.
      if (currentId === lastUserId) return;
      lastUserId = currentId;

      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT") return;
      router.invalidate();
      if (event === "SIGNED_OUT") {
        queryClient.cancelQueries();
        queryClient.clear();
      } else {
        queryClient.invalidateQueries();
      }
      if (event === "SIGNED_IN" && currentId) routeByRoleIfNeeded();
    });
    return () => sub.subscription.unsubscribe();
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  );
}

