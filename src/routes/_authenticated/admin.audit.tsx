import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ScrollText, Search, RefreshCw } from "lucide-react";
import { adminListAuditLogs, adminCafeOptions } from "@/lib/admin.functions";
import { downloadCsv } from "@/lib/csv";
import { Download } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/admin/audit")({
  head: () => ({
    meta: [
      { title: "Audit log — CoreCade admin" },
      { name: "description", content: "Every staff and owner action across the entire network." },
    ],
  }),
  component: AuditPanel,
});

type Row = {
  id: string; created_at: string; cafe_id: string;
  actor_email: string | null; action: string;
  resource_type: string | null; resource_id: string | null;
  meta: Record<string, unknown> | null;
  cafes: { name: string; slug: string } | null;
};

function AuditPanel() {
  const [cafeId, setCafeId] = useState<string>("");
  const [action, setAction] = useState<string>("");
  const [q, setQ] = useState<string>("");
  const listFn = useServerFn(adminListAuditLogs);
  const optFn = useServerFn(adminCafeOptions);
  const cafes = useQuery({ queryKey: ["admin-cafe-opts"], queryFn: () => optFn() });
  const logs = useQuery({
    queryKey: ["admin-audit", cafeId, action, q],
    queryFn: () => listFn({ data: { cafe_id: cafeId || null, action: action || null, q: q || null, limit: 200 } }),
    refetchInterval: 20_000,
  });

  const rows = (logs.data ?? []) as Row[];

  return (
    <div className="space-y-5">
      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Network-wide · last 200</div>
        <h2 className="font-display text-3xl font-extrabold">Audit log</h2>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={cafeId} onChange={(e) => setCafeId(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">All cafés</option>
          {(cafes.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <Input
          placeholder="Action (e.g. session.end, order.refund)"
          value={action} onChange={(e) => setAction(e.target.value)}
          className="h-10 w-64"
        />
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Filter by actor email…"
            value={q} onChange={(e) => setQ(e.target.value)}
            className="h-10 w-72 pl-9"
          />
        </div>
        <Button variant="outline" onClick={() => logs.refetch()} className="gap-2">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
        <Button
          variant="outline" className="gap-2"
          disabled={rows.length === 0}
          onClick={() => downloadCsv(`audit-${new Date().toISOString().slice(0, 10)}.csv`, rows as unknown as Record<string, unknown>[])}
        >
          <Download className="h-3.5 w-3.5" /> Export
        </Button>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={ScrollText} title="No audit entries" description="When staff & owners act on the platform, you'll see it here." />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/30 backdrop-blur">
          <table className="w-full text-sm">
            <thead className="border-b border-border/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="p-3">When</th>
                <th className="p-3">Actor</th>
                <th className="p-3">Café</th>
                <th className="p-3">Action</th>
                <th className="p-3">Resource</th>
                <th className="p-3">Meta</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border/30 last:border-0">
                  <td className="p-3 font-mono text-xs text-azure">
                    {new Date(r.created_at).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td className="p-3 font-mono text-xs">{r.actor_email ?? "—"}</td>
                  <td className="p-3 text-xs">{r.cafes?.name ?? "—"}</td>
                  <td className="p-3"><Badge variant="outline" className="font-mono text-[10px]">{r.action}</Badge></td>
                  <td className="p-3 font-mono text-[10px] text-muted-foreground">
                    {r.resource_type ? `${r.resource_type}${r.resource_id ? ` · ${r.resource_id.slice(0, 8)}` : ""}` : "—"}
                  </td>
                  <td className="p-3 max-w-sm">
                    <pre className="overflow-hidden truncate text-[10px] text-muted-foreground">
                      {r.meta && Object.keys(r.meta).length ? JSON.stringify(r.meta) : "—"}
                    </pre>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
