import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { LifeBuoy } from "lucide-react";
import { listAdminTickets } from "@/lib/tickets.functions";
import { supabase } from "@/lib/supabase/client";
import { AdminOwnerMessagesInbox } from "@/components/AdminOwnerMessagesInbox";
import {
  TicketChatWorkspace,
  type WorkspaceTicket,
} from "@/components/TicketChatWorkspace";

export const Route = createFileRoute("/_authenticated/admin/support")({
  head: () => ({ meta: [{ title: "Support tickets — Super Admin · CoreCade" }] }),
  component: AdminSupportPanel,
});

function AdminSupportPanel() {
  const listFn = useServerFn(listAdminTickets);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const q = useQuery({
    queryKey: ["admin-tickets"],
    queryFn: () => listFn() as Promise<WorkspaceTicket[]>,
    refetchInterval: 6_000,
  });

  const tickets = q.data ?? [];
  const activeCount = tickets.filter(
    (t) => t.status === "open" || t.status === "waiting" || t.status === "in_progress",
  ).length;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Network support desk
          </div>
          <h1 className="flex items-center gap-2 font-display text-3xl font-extrabold tracking-tight">
            <LifeBuoy className="h-7 w-7 text-primary" /> Support Tickets
            {activeCount > 0 && (
              <span className="inline-flex items-center rounded-full border border-primary/45 bg-primary/15 px-2.5 py-0.5 font-mono text-xs font-bold text-primary">
                {activeCount} active
              </span>
            )}
          </h1>
        </div>
      </header>

      <AdminOwnerMessagesInbox />

      <TicketChatWorkspace
        tickets={tickets}
        isLoading={q.isLoading}
        isFetching={q.isFetching}
        viewerRole="admin"
        viewerUserId={userId}
        queryKeysToInvalidate={[["admin-tickets"]]}
        allowAllStatuses
        emptyTitle="Inbox zero"
        emptyDescription="No tickets match this view. New owner and player support chats appear here live."
      />
    </div>
  );
}
