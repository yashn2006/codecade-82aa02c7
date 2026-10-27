import { ContentSkeleton } from "@/components/PageTransition";

/** Shown by the router when a page takes a moment to resolve. */
export function RoutePending() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      <div className="grid">
        <ContentSkeleton />
      </div>
    </div>
  );
}
