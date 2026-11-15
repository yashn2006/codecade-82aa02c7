import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { RoutePending } from "./components/RoutePending";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Keep data fresh for 2 minutes so switching between pages/tabs is instant
        staleTime: 2 * 60_000,
        gcTime: 15 * 60_000,
        refetchOnWindowFocus: false,
        // Render cached data synchronously while refreshing stale queries silently in background
        refetchOnMount: true,
        refetchOnReconnect: true,
        // Retry transient auth races (bearer not yet attached on first paint)
        retry: 2,
        retryDelay: (attempt) => Math.min(300 * 2 ** attempt, 1500),
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Preload route JS + loaders immediately on hover/touch/focus
    defaultPreload: "intent",
    defaultPreloadDelay: 0,
    defaultPreloadGcTime: 10 * 60_000,
    defaultPreloadStaleTime: 0,
    // Keep current view visible during fast transitions instead of flashing a skeleton
    defaultPendingMs: 2000,
    defaultPendingMinMs: 150,
    defaultPendingComponent: RoutePending,
  });

  return router;
};
