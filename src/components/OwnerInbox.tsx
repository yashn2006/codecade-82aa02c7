import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Inbox, Mail, CheckCheck, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { listMyMessages, markMessageRead } from "@/lib/messages.functions";
import { cn } from "@/lib/utils";

export type AdminBroadcastMessage = {
  id: string;
  subject: string;
  body: string;
  sent_at: string;
  read_at: string | null;
  cafe_id?: string | null;
};

export function OwnerInboxPanel() {
  const fn = useServerFn(listMyMessages);
  const mark = useServerFn(markMessageRead);
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["owner-messages"],
    queryFn: () => fn(),
    refetchInterval: 60_000,
  });
  const rows = (q.data ?? []) as AdminBroadcastMessage[];
  const m = useMutation({
    mutationFn: (id: string) => mark({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["owner-messages"] }),
  });

  if (q.isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-xl bg-card/60" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] py-14 text-center text-sm text-muted-foreground">
        <Sparkles className="h-6 w-6 text-magenta" />
        You&apos;re all caught up. No messages from CoreCade yet.
      </div>
    );
  }

  return (
    <AnimatePresence initial={false}>
      <div className="space-y-2.5">
        {rows.map((r) => (
          <motion.button
            key={r.id}
            type="button"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              if (!r.read_at) m.mutate(r.id);
            }}
            className={cn(
              "block w-full rounded-2xl border p-4 text-left transition hover:border-primary/40",
              r.read_at
                ? "border-border/60 bg-card/30"
                : "border-magenta/40 bg-magenta/5 shadow-[0_0_0_1px_rgba(233,78,160,0.12)]",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="truncate font-display text-sm font-bold text-white">{r.subject}</div>
              {!r.read_at ? (
                <Badge className="bg-magenta text-white">New · tap to mark read</Badge>
              ) : (
                <CheckCheck className="h-4 w-4 shrink-0 text-muted-foreground" />
              )}
            </div>
            <p className="mt-1.5 whitespace-pre-wrap text-xs leading-relaxed text-foreground/85">
              {r.body}
            </p>
            <div className="mt-2.5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              {new Date(r.sent_at).toLocaleString()}
            </div>
          </motion.button>
        ))}
      </div>
    </AnimatePresence>
  );
}

export function OwnerInbox() {
  const fn = useServerFn(listMyMessages);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const q = useQuery({
    queryKey: ["owner-messages"],
    queryFn: () => fn(),
    refetchInterval: 60_000,
  });
  const rows = (q.data ?? []) as AdminBroadcastMessage[];
  const unread = useMemo(() => rows.filter((r) => !r.read_at).length, [rows]);

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) qc.invalidateQueries({ queryKey: ["owner-messages"] });
      }}
    >
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="relative gap-1.5 min-h-[42px] sm:min-h-[36px] sm:h-9 w-full sm:w-auto text-xs font-semibold rounded-xl border-white/10 hover:bg-white/10 whitespace-nowrap">
          <Inbox className="h-3.5 w-3.5 shrink-0" />
          <span>Inbox</span>
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-magenta px-1 text-[10px] font-bold text-white tabular-nums">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Mail className="h-4 w-4" /> Messages from CoreCade
          </SheetTitle>
        </SheetHeader>
        <ScrollArea className="mt-4 h-[calc(100dvh-110px)] pr-3">
          <OwnerInboxPanel />
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
