import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ScrollText, User, Clock } from "lucide-react";
import { getCafeBySlug } from "@/lib/cafes.functions";
import { listAuditLogs } from "@/lib/audit.functions";
import { EmptyState } from "@/components/EmptyState";

export const Route = createFileRoute("/_authenticated/cafe/$slug/audit")({
  head: () => ({
    meta: [
      { title: "Activity Audit — CoreCade" },
      { name: "description", content: "Every staff and owner action, timestamped." },
      { property: "og:title", content: "Activity Audit — CoreCade" },
      { property: "og:description", content: "Every staff and owner action, timestamped." },
    ],
  }),
  component: AuditPage,
});

function AuditPage() {
  const { slug } = Route.useParams();
  const getCafe = useServerFn(getCafeBySlug);
  const { data: cafe } = useQuery({ queryKey: ["cafe", slug], queryFn: () => getCafe({ data: { slug } }) });
  const cafeId = cafe?.id;
  const list = useServerFn(listAuditLogs);
  const q = useQuery({ queryKey: ["audit", cafeId], queryFn: () => list({ data: { cafe_id: cafeId!, limit: 200 } }), enabled: !!cafeId });

  if (!cafeId) return <div className="h-40 animate-pulse rounded-2xl border border-border/40 bg-card/30" />;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm text-muted-foreground">Latest 200 events. Every staff/owner action is logged here.</div>
      </div>
      {q.isLoading ? (
        <div className="h-40 animate-pulse rounded-2xl border border-border/40 bg-card/30" />
      ) : (q.data?.length ?? 0) === 0 ? (
        <EmptyState icon={ScrollText} title="No events yet" description="Audit events will appear here as your team works." />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/40">
          {(q.data ?? []).map((e) => (
            <div key={e.id} className="grid grid-cols-[auto_1fr_auto] gap-3 border-b border-border/40 px-4 py-2.5 text-xs last:border-0">
              <div className="font-mono text-muted-foreground"><Clock className="mr-1 inline h-3 w-3" />{new Date(e.created_at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}</div>
              <div className="min-w-0">
                <span className="font-medium">{e.action}</span>
                {e.resource_type && <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] text-primary">{e.resource_type}{e.resource_id ? `:${e.resource_id.slice(0, 8)}` : ""}</span>}
                {e.meta && Object.keys(e.meta as object).length > 0 && (
                  <span className="ml-2 truncate font-mono text-[10px] text-muted-foreground">{JSON.stringify(e.meta).slice(0, 80)}</span>
                )}
              </div>
              <div className="text-right text-muted-foreground"><User className="mr-1 inline h-3 w-3" />{e.actor_email ?? e.actor_id?.slice(0, 8) ?? "—"}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
