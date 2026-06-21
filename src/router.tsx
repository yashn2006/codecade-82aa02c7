import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Keep data fresh for 30s so navigating back to a page is instant
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: 1,
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
    // Show the new route immediately instead of waiting on the old one
    defaultPendingMs: 0,
    defaultPendingMinMs: 0,
  });

  return router;
};
