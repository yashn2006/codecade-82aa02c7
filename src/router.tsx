import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { RoutePending } from "./components/RoutePending";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Keep data fresh for 30s so navigating back to a page is instant
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        // ALWAYS refetch on mount — fixes "dashboard empty until I navigate away"
        // bug where the first fetch happens before the Supabase bearer token is
        // attached and silently errors, then the cached error/empty state sticks.
        refetchOnMount: "always",
        refetchOnReconnect: true,
        // Retry transient auth races (bearer not yet attached on first paint)
        retry: 2,
        retryDelay: (attempt) => Math.min(400 * 2 ** attempt, 2000),
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Preload route code + data on hover/focus so click feels instant
    defaultPreload: "intent",
    defaultPreloadDelay: 30,
    // Let TanStack Query own freshness
    defaultPreloadStaleTime: 0,
    // Keep the current page up for quick loads; show a skeleton (held long
    // enough not to flicker) only when the next page takes a moment.
    defaultPendingMs: 180,
    defaultPendingMinMs: 320,
    defaultPendingComponent: RoutePending,
  });

  return router;
};
