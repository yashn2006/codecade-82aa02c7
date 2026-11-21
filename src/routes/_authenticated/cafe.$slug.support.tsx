import { createFileRoute, Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarRange, Inbox, LifeBuoy, MessageSquare, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";
import { SupportTickets } from "@/components/SupportTickets";
import { OwnerInboxPanel, type AdminBroadcastMessage } from "@/components/OwnerInbox";
import {
  TicketChatWorkspace,
  type WorkspaceTicket,
} from "@/components/TicketChatWorkspace";
import { getCafeBySlug } from "@/lib/cafes.functions";
import { listCafeCustomerTickets } from "@/lib/tickets.functions";
import { listMyMessages } from "@/lib/messages.functions";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { QueryBoundary, QueryErrorBanner } from "@/components/QueryBoundary";
import { useCafeAccess } from "@/hooks/useCafeAccess";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/cafe/$slug/support")({
  head: () => ({
    meta: [
      { title: "Support — Café Console" },
      { name: "description", content: "Reply to customer booking inquiries and message CoreCade support." },
    ],
  }),
  component: CafeSupportPage,
});

function CafeSupportPage() {
  const { slug } = Route.useParams();
  const fn = useServerFn(getCafeBySlug);
  const customerTicketsFn = useServerFn(listCafeCustomerTickets);
  const myMessagesFn = useServerFn(listMyMessages);
  const [tab, setTab] = useState<"customers" | "admin" | "inbox">("customers");
  const [userId, setUserId] = useState<string | null>(null);

  const locationHash = useRouterState({ select: (s) => s.location.hash });

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  useEffect(() => {
    if (locationHash === "messages" || locationHash === "#messages") {
      setTab("inbox");
    }
  }, [locationHash]);

  const cafeQ = useQuery({
    queryKey: ["cafe", slug],
    queryFn: () => fn({ data: { slug } }),
  });
  const cafe = cafeQ.data;
  const cafeId = (cafe as { id?: string } | undefined)?.id ?? null;
  const { isLoading: accessLoading, isOwnerOrAdmin } = useCafeAccess(cafeId ?? undefined);

  useEffect(() => {
    if (!accessLoading && !isOwnerOrAdmin && tab !== "customers") {
      setTab("customers");
    }
  }, [accessLoading, isOwnerOrAdmin, tab]);

  const customerTicketsQ = useQuery({
    queryKey: ["cafe-customer-tickets", cafeId],
    queryFn: () => customerTicketsFn({ data: { cafe_id: cafeId! } }) as Promise<WorkspaceTicket[]>,
    enabled: !!cafeId,
    refetchInterval: 6_000,
  });

  const adminMessagesQ = useQuery({
    queryKey: ["owner-messages"],
    queryFn: () => myMessagesFn() as Promise<AdminBroadcastMessage[]>,
    enabled: Boolean(cafeId && !accessLoading && isOwnerOrAdmin),
    refetchInterval: 60_000,
  });

  const customerTickets = customerTicketsQ.data ?? [];
  const openCustomerCount = customerTickets.filter(
    (t) => t.status === "open" || t.status === "in_progress" || t.status === "waiting",
  ).length;
  const unreadAdminMessages = (adminMessagesQ.data ?? []).filter((m) => !m.read_at).length;

  if (cafeQ.isError || !cafeId) {
    return (
      <QueryBoundary queries={[cafeQ]} loading={!cafeQ.isError && !cafeId} errorTitle="Couldn't load support desk">
        {null}
      </QueryBoundary>
    );
  }

  return (
    <div className="space-y-5">
      <QueryErrorBanner queries={[customerTicketsQ, adminMessagesQ]} title="Some support threads couldn't refresh" />
      <motion.div
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.14 }}
        className="liquid-glass-card overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-primary/12 via-card/50 to-violet-500/12 p-5 sm:p-6"
      >
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3.5">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-primary/30 bg-primary/20 text-primary">
              <LifeBuoy className="h-6 w-6" />
            </div>
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                Café Support Center
              </div>
              <h2 className="font-display text-2xl font-extrabold tracking-tight text-white">
                {cafe?.name ?? "Café"} Support Desk
              </h2>
              <p className="text-xs text-white/75">
                Chat live with players about booking cancellations &amp; slot changes, or message CoreCade Admin.
              </p>
            </div>
          </div>

          <Link to="/cafe/$slug/bookings" params={{ slug }}>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-[40px] gap-2 rounded-xl border-white/15 bg-white/[0.04] text-xs font-semibold"
            >
              <CalendarRange className="h-3.5 w-3.5 text-primary" />
              Manage Bookings
            </Button>
          </Link>
        </div>

        {/* Desk Mode Switcher */}
        <div className="mt-4 inline-flex flex-wrap gap-1.5 rounded-2xl border border-white/10 bg-black/30 p-1">
          <button
            type="button"
            onClick={() => setTab("customers")}
            className={cn(
              "inline-flex min-h-[40px] items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition",
              tab === "customers"
                ? "text-white shadow-[0_0_16px_-4px_oklch(0.7_0.26_335/0.8)]"
                : "text-white/75 hover:text-white",
            )}
            style={tab === "customers" ? { background: "var(--gradient-brand-hot)" } : undefined}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Customer Booking Support
            {openCustomerCount > 0 && (
              <span className="rounded-full bg-black/35 px-2 py-0.5 font-mono text-[10px] tabular-nums text-white">
                {openCustomerCount}
              </span>
            )}
          </button>

          {isOwnerOrAdmin && (
            <>
              <button
                type="button"
                onClick={() => setTab("admin")}
                className={cn(
                  "inline-flex min-h-[40px] items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition",
                  tab === "admin"
                    ? "text-white shadow-[0_0_16px_-4px_oklch(0.7_0.26_335/0.8)]"
                    : "text-white/75 hover:text-white",
                )}
                style={tab === "admin" ? { background: "var(--gradient-brand-hot)" } : undefined}
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                CoreCade Admin Support
              </button>

              <button
                type="button"
                onClick={() => setTab("inbox")}
                className={cn(
                  "inline-flex min-h-[40px] items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition",
                  tab === "inbox"
                    ? "text-white shadow-[0_0_16px_-4px_oklch(0.7_0.26_335/0.8)]"
                    : "text-white/75 hover:text-white",
                )}
                style={tab === "inbox" ? { background: "var(--gradient-brand-hot)" } : undefined}
              >
                <Inbox className="h-3.5 w-3.5" />
                Messages from CoreCade
                {unreadAdminMessages > 0 && (
                  <span className="rounded-full bg-black/35 px-2 py-0.5 font-mono text-[10px] tabular-nums text-white">
                    {unreadAdminMessages}
                  </span>
                )}
              </button>
            </>
          )}
        </div>
      </motion.div>

      {tab === "customers" || !isOwnerOrAdmin ? (
        <div className="space-y-3">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              Player Booking Requests
            </div>
            <h3 className="font-display text-xl font-extrabold tracking-tight text-white">
              Customer cancellation &amp; booking chats
            </h3>
          </div>
          <TicketChatWorkspace
            tickets={customerTickets}
            isLoading={customerTicketsQ.isLoading}
            isFetching={customerTicketsQ.isFetching}
            viewerRole="owner"
            viewerUserId={userId}
            queryKeysToInvalidate={[["cafe-customer-tickets", cafeId]]}
            allowAllStatuses
            realtimeTableFilter={cafeId ? `cafe_id=eq.${cafeId}` : undefined}
            emptyTitle="No customer booking messages yet"
            emptyDescription="When players message your café from their Gamer Portal about cancelling, rescheduling, or booking deposits, their tickets appear right here."
            emptyAction={
              <Link to="/cafe/$slug/bookings" params={{ slug }}>
                <Button type="button" variant="outline" className="mt-1 gap-2 rounded-xl border-white/15">
                  <CalendarRange className="h-4 w-4 text-primary" /> View Bookings Calendar
                </Button>
              </Link>
            }
          />
        </div>
      ) : tab === "admin" ? (
        <SupportTickets role="owner" cafeId={cafeId} />
      ) : (
        <div className="space-y-3">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              Official Notices &amp; Direct Updates
            </div>
            <h3 className="font-display text-xl font-extrabold tracking-tight text-white">
              Messages from CoreCade
            </h3>
          </div>
          <OwnerInboxPanel />
        </div>
      )}
    </div>
  );
}
