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

export function OwnerInbox() {
  const fn = useServerFn(listMyMessages);
  const mark = useServerFn(markMessageRead);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const q = useQuery({
    queryKey: ["owner-messages"],
    queryFn: () => fn(),
    refetchInterval: 60_000,
  });
  const rows = (q.data ?? []) as Array<{ id: string; subject: string; body: string; sent_at: string; read_at: string | null }>;
  const unread = useMemo(() => rows.filter((r) => !r.read_at).length, [rows]);
  const m = useMutation({
    mutationFn: (id: string) => mark({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["owner-messages"] }),
  });

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="relative gap-1.5">
          <Inbox className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Inbox</span>
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-magenta px-1 text-[10px] font-bold text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2"><Mail className="h-4 w-4" /> Messages from CoreCade</SheetTitle>
        </SheetHeader>
        <ScrollArea className="mt-4 h-[calc(100vh-120px)] pr-3">
          {q.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-card/60" />)}
            </div>
          ) : rows.length === 0 ? (
            <div className="mt-16 flex flex-col items-center gap-2 text-center text-sm text-muted-foreground">
              <Sparkles className="h-6 w-6 text-magenta" />
              You're all caught up.
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {rows.map((r) => (
                <motion.button
                  key={r.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  onClick={() => { if (!r.read_at) m.mutate(r.id); }}
                  className={cn(
                    "mb-2 block w-full rounded-xl border p-3 text-left transition hover:border-primary/40",
                    r.read_at ? "border-border/60 bg-card/30" : "border-magenta/40 bg-magenta/5 shadow-[0_0_0_1px_rgba(233,78,160,0.12)]",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="truncate font-display text-sm font-bold">{r.subject}</div>
                    {!r.read_at ? (
                      <Badge className="bg-magenta text-white">New</Badge>
                    ) : (
                      <CheckCheck className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </div>
                  <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-xs text-foreground/80">{r.body}</p>
                  <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    {new Date(r.sent_at).toLocaleString()}
                  </div>
                </motion.button>
              ))}
            </AnimatePresence>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
