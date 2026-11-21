import type { ReactNode } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";
import { ErrorState } from "@/components/ErrorState";
import { Button } from "@/components/ui/button";

export type QueryLike = {
  isLoading?: boolean;
  isError?: boolean;
  error?: unknown;
  refetch?: () => unknown;
};

function friendlyErrorText(queries: QueryLike[], fallback: string): string {
  if (!import.meta.env.DEV) return fallback;
  for (const q of queries) {
    if (q.isError && q.error instanceof Error && q.error.message) {
      return q.error.message;
    }
  }
  return fallback;
}

export function retryQueries(queries: QueryLike[]) {
  for (const q of queries) {
    if (q.isError && q.refetch) void q.refetch();
  }
}

export function QueryBoundary({
  queries,
  loading,
  loadingFallback,
  errorTitle = "Couldn't load this section",
  errorDescription = "We couldn't load this data right now. Try again in a moment.",
  children,
}: {
  queries: QueryLike[];
  loading?: boolean;
  loadingFallback?: ReactNode;
  errorTitle?: string;
  errorDescription?: string;
  children: ReactNode;
}) {
  const hasError = queries.some((q) => q.isError);
  if (hasError) {
    return (
      <ErrorState
        title={errorTitle}
        description={friendlyErrorText(queries, errorDescription)}
        onRetry={() => retryQueries(queries)}
      />
    );
  }

  const isLoading = loading ?? queries.some((q) => q.isLoading);
  if (isLoading) {
    return (
      <>
        {loadingFallback ?? (
          <div className="h-40 animate-pulse rounded-2xl border border-border/40 bg-card/30" />
        )}
      </>
    );
  }

  return <>{children}</>;
}

export function QueryErrorBanner({
  queries,
  title = "Some data couldn't refresh",
}: {
  queries: QueryLike[];
  title?: string;
}) {
  const errored = queries.filter((q) => q.isError);
  if (errored.length === 0) return null;

  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-xs"
    >
      <div className="flex min-w-0 items-center gap-2.5 text-foreground">
        <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
        <span className="truncate font-medium">{title}</span>
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-8 gap-1.5 rounded-lg border-destructive/30 bg-background/60 text-xs"
        onClick={() => retryQueries(errored)}
      >
        <RotateCw className="h-3 w-3" /> Retry
      </Button>
    </div>
  );
}
