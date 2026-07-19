import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Mail, CheckCheck, Building2 } from "lucide-react";
import { listOwnerMessagesAdmin, markOwnerMessageRead } from "@/lib/messages.functions";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Row = {
  id: string; subject: string; body: string; sent_at: string; read_at: string | null;
  cafe_id: string | null; sender_id: string;
  cafes: { name: string; slug: string } | null;
};

export function AdminOwnerMessagesInbox() {
  const fn = useServerFn(listOwnerMessagesAdmin);
  const mark = useServerFn(markOwnerMessageRead);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin-owner-messages"], queryFn: () => fn(), refetchInterval: 60_000 });
  const rows = (q.data ?? []) as unknown as Row[];
  const m = useMutation({
    mutationFn: (id: string) => mark({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-owner-messages"] }),
  });
  const unread = rows.filter((r) => !r.read_at).length;

  return (
    <div className="rounded-2xl border border-border/60 bg-card/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-magenta" />
          <div className="font-display text-sm font-bold">Owner messages</div>
        </div>
        {unread > 0 && <Badge className="bg-magenta text-white">{unread} new</Badge>}
      </div>
      {q.isLoading ? (
        <div className="h-20 animate-pulse rounded-xl bg-card/60" />
      ) : rows.length === 0 ? (
        <div className="py-6 text-center text-xs text-muted-foreground">No owner messages yet.</div>
      ) : (
        <div className="max-h-[420px] space-y-2 overflow-auto pr-1">
          {rows.map((r) => (
            <button
              key={r.id}
              onClick={() => { if (!r.read_at) m.mutate(r.id); }}
              className={cn(
                "block w-full rounded-xl border p-3 text-left transition",
                r.read_at ? "border-border/60 bg-card/30" : "border-magenta/40 bg-magenta/5",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="truncate font-display text-sm font-bold">{r.subject}</div>
                {r.read_at ? <CheckCheck className="h-3.5 w-3.5 text-muted-foreground" /> : <Badge className="bg-magenta text-white">New</Badge>}
              </div>
              <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-xs text-foreground/80">{r.body}</p>
              <div className="mt-2 flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                <span>{new Date(r.sent_at).toLocaleString()}</span>
                {r.cafes && (
                  <span className="inline-flex items-center gap-1"><Building2 className="h-3 w-3" />{r.cafes.name}</span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
