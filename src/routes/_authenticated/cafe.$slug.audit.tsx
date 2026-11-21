import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ScrollText, Clock } from "lucide-react";
import { getCafeBySlug } from "@/lib/cafes.functions";
import { listAuditLogs } from "@/lib/audit.functions";
import { EmptyState } from "@/components/EmptyState";
import { QueryBoundary } from "@/components/QueryBoundary";
import { CafeAccessGuard } from "@/hooks/useCafeAccess";

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

const ACTION_VERBS: Record<string, string> = {
  "booking.confirmed": "confirmed booking",
  "booking.cancelled": "cancelled booking",
  "booking.no_show": "marked booking as no-show",
  "booking.completed": "completed booking",
  "booking.ended_early": "ended booking early",
  "booking.pending": "moved booking to pending",
  "session.started": "started session",
  "session.ended": "ended session",
  "wallet.topped_up": "topped up wallet",
  "wallet.adjusted": "adjusted wallet balance",
  "wallet.topup_rejected": "rejected wallet top-up",
  "pos.order_refunded": "refunded POS order",
  "revenue.manual_logged": "logged manual income entry",
  "staff.added": "added staff member",
  "staff.removed": "removed staff member",
  "device.price_changed": "changed device price",
  "cafe.settings_updated": "updated café settings",
  "cafe.maintenance_updated": "updated maintenance schedule",
  "cafe.page_updated": "updated public café page",
};

type AuditRow = {
  id: string;
  actor_id?: string | null;
  actor_email?: string | null;
  action: string;
  resource_type?: string | null;
  resource_id?: string | null;
  meta?: Record<string, unknown> | null;
  created_at: string;
};

function formatWho(e: AuditRow): string {
  return e.actor_email || (e.actor_id ? `User ${e.actor_id.slice(0, 8)}` : "System");
}

function formatAction(action: string): string {
  return ACTION_VERBS[action] ?? action.replace(/\./g, " ");
}

function formatTarget(e: AuditRow): string {
  const m = (e.meta ?? {}) as Record<string, unknown>;
  const nameHint =
    (typeof m.customer === "string" && m.customer) ||
    (typeof m.email === "string" && m.email) ||
    (typeof m.name === "string" && m.name) ||
    (typeof m.receipt_no === "string" && m.receipt_no) ||
    null;

  const type = e.resource_type ? e.resource_type.replace(/_/g, " ") : "item";
  const shortId = e.resource_id ? `#${e.resource_id.slice(0, 8)}` : "";
  if (nameHint) return `${type} (${nameHint})`;
  return shortId ? `${type} ${shortId}` : type;
}

function formatDetails(e: AuditRow): string | null {
  const m = (e.meta ?? {}) as Record<string, unknown>;
  const parts: string[] = [];
  if (typeof m.amount_rupees === "number") parts.push(`₹${m.amount_rupees}`);
  else if (typeof m.amount === "number") parts.push(`₹${m.amount}`);
  if (typeof m.previous_rate === "number" && typeof m.new_rate === "number") {
    parts.push(`₹${m.previous_rate}/hr → ₹${m.new_rate}/hr`);
  }
  if (typeof m.minutes === "number") parts.push(`${m.minutes} min`);
  if (typeof m.planned_minutes === "number") parts.push(`${m.planned_minutes} min`);
  if (typeof m.reason === "string" && m.reason) parts.push(`"${m.reason}"`);
  else if (typeof m.note === "string" && m.note) parts.push(`"${m.note}"`);
  if (Array.isArray(m.updated_fields) && m.updated_fields.length > 0) {
    parts.push(`fields: ${m.updated_fields.join(", ")}`);
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

function AuditPage() {
  const { slug } = Route.useParams();
  const getCafe = useServerFn(getCafeBySlug);
  const cafeQ = useQuery({ queryKey: ["cafe", slug], queryFn: () => getCafe({ data: { slug } }) });
  const cafe = cafeQ.data;
  if (cafeQ.isError || !cafe?.id) {
    return (
      <QueryBoundary queries={[cafeQ]} loading={!cafeQ.isError && !cafe?.id} errorTitle="Couldn't load audit log">
        {null}
      </QueryBoundary>
    );
  }
  return (
    <CafeAccessGuard cafeId={cafe.id} slug={slug} requireOwner>
      <AuditPageContent />
    </CafeAccessGuard>
  );
}

function AuditPageContent() {
  const { slug } = Route.useParams();
  const getCafe = useServerFn(getCafeBySlug);
  const cafeQ = useQuery({ queryKey: ["cafe", slug], queryFn: () => getCafe({ data: { slug } }) });
  const cafe = cafeQ.data;
  const cafeId = cafe?.id;
  const list = useServerFn(listAuditLogs);
  const q = useQuery({ queryKey: ["audit", cafeId], queryFn: () => list({ data: { cafe_id: cafeId!, limit: 200 } }), enabled: !!cafeId });

  if (cafeQ.isError || !cafeId) {
    return (
      <QueryBoundary queries={[cafeQ]} loading={!cafeQ.isError && !cafeId} errorTitle="Couldn't load audit log">
        {null}
      </QueryBoundary>
    );
  }

  const rows = (q.data ?? []) as AuditRow[];

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm text-muted-foreground">Latest 200 events. Every staff and owner action is logged here.</div>
      </div>
      <QueryBoundary queries={[q]} errorTitle="Couldn't load audit log">
        {rows.length === 0 ? (
          <EmptyState
            icon={ScrollText}
            title="No audit activity yet"
            description="Actions like bookings, sessions, wallet adjustments, refunds, staff changes, and café settings updates will appear here automatically."
          />
        ) : (
        <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/40">
          {rows.map((e) => {
            const who = formatWho(e);
            const didWhat = formatAction(e.action);
            const toWhat = formatTarget(e);
            const when = new Date(e.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
            const details = formatDetails(e);

            return (
              <div
                key={e.id}
                className="flex flex-col gap-1 border-b border-border/40 px-4 py-3 text-xs last:border-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
              >
                <div className="min-w-0 flex-1 leading-relaxed">
                  <span className="font-semibold text-foreground">{who}</span>{" "}
                  <span className="text-foreground/90">{didWhat}</span>{" "}
                  <span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[11px] text-primary">
                    {toWhat}
                  </span>
                  {details ? (
                    <span className="ml-2 text-muted-foreground">· {details}</span>
                  ) : null}
                </div>
                <div className="shrink-0 font-mono text-[11px] text-muted-foreground tabular-nums">
                  <Clock className="mr-1 inline h-3 w-3" />
                  {when}
                </div>
              </div>
            );
          })}
        </div>
        )}
      </QueryBoundary>
    </div>
  );
}
