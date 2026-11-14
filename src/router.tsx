import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { RoutePending } from "./components/RoutePending";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Keep data fresh for 60s so navigating between pages/tabs is instant
        staleTime: 60_000,
        gcTime: 10 * 60_000,
        refetchOnWindowFocus: false,
        // Render cached data immediately while stale queries refresh silently in background
        refetchOnMount: true,
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
    // Keep current page visible for normal transitions; only show pending component on slow loads
    defaultPendingMs: 750,
    defaultPendingMinMs: 200,
    defaultPendingComponent: RoutePending,
  });

  return router;
};
