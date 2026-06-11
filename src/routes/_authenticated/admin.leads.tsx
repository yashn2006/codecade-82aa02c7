import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, FileText } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { listContacts, setContactStatus } from "@/lib/admin.functions";
import { ExportButton } from "./admin.cafes";

export const Route = createFileRoute("/_authenticated/admin/leads")({
  component: LeadsPanel,
});

type Lead = { id: string; name: string; email: string; phone: string | null; message: string; status: string };

function LeadsPanel() {
  const fn = useServerFn(listContacts);
  const set = useServerFn(setContactStatus);
  const { data } = useQuery({ queryKey: ["admin-leads"], queryFn: () => fn() });
  const qc = useQueryClient();

  const leads = (data ?? []) as Lead[];
  const buckets = useMemo(() => ({
    new: leads.filter((c) => c.status === "new"),
    resolved: leads.filter((c) => c.status === "resolved"),
    all: leads,
  }), [leads]);

  const render = (rows: Lead[]) =>
    rows.length === 0 ? (
      <EmptyState icon={FileText} title="Inbox zero" description="No leads in this view." />
    ) : (
      <div className="space-y-2">
        {rows.map((c) => (
          <div key={c.id} className="rounded-2xl border border-border/60 bg-card/40 p-4 backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="font-medium">{c.name}</div>
                <div className="truncate font-mono text-xs text-muted-foreground">{c.email}{c.phone ? ` · ${c.phone}` : ""}</div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={c.status === "new" ? "default" : "secondary"}>{c.status}</Badge>
                {c.status === "new" && (
                  <Button size="sm" variant="outline" className="h-7 gap-1.5"
                    onClick={async () => {
                      await set({ data: { id: c.id, status: "resolved" } });
                      qc.invalidateQueries({ queryKey: ["admin-leads"] });
                    }}
                  ><Check className="h-3 w-3" /> Resolve</Button>
                )}
              </div>
            </div>
            <p className="mt-2 text-sm text-foreground/80">{c.message}</p>
          </div>
        ))}
      </div>
    );

  return (
    <Tabs defaultValue="new">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TabsList className="glass-strong rounded-2xl p-1">
          <TabsTrigger value="new">New <Badge variant="secondary" className="ml-2">{buckets.new.length}</Badge></TabsTrigger>
          <TabsTrigger value="resolved">Resolved <Badge variant="secondary" className="ml-2">{buckets.resolved.length}</Badge></TabsTrigger>
          <TabsTrigger value="all">All <Badge variant="secondary" className="ml-2">{buckets.all.length}</Badge></TabsTrigger>
        </TabsList>
        <ExportButton kind="leads" />
      </div>
      <TabsContent value="new" className="mt-4">{render(buckets.new)}</TabsContent>
      <TabsContent value="resolved" className="mt-4">{render(buckets.resolved)}</TabsContent>
      <TabsContent value="all" className="mt-4">{render(buckets.all)}</TabsContent>
    </Tabs>
  );
}
