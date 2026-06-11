import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bell, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { listNotifications, markAllRead } from "@/lib/notifications.functions";
import { supabase } from "@/lib/supabase/client";

type Notif = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

export function NotificationBell() {
  const list = useServerFn(listNotifications);
  const mark = useServerFn(markAllRead);
  const qc = useQueryClient();
  const q = useQuery<Notif[]>({
    queryKey: ["notifications"],
    queryFn: () => list(),
    refetchInterval: 30_000,
  });
  const markM = useMutation({
    mutationFn: mark,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
  const [open, setOpen] = useState(false);

  // Realtime subscription
  useEffect(() => {
    let userId: string | undefined;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    supabase.auth.getUser().then(({ data }) => {
      userId = data.user?.id;
      if (!userId) return;
      channel = supabase
        .channel(`notif:${userId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
          () => qc.invalidateQueries({ queryKey: ["notifications"] }),
        )
        .subscribe();
    });
    return () => { if (channel) supabase.removeChannel(channel); };
  }, [qc]);

  const items = q.data ?? [];
  const unread = items.filter((n) => !n.read_at).length;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground transition"
        aria-label={`Notifications${unread ? ` — ${unread} unread` : ""}`}
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <motion.span
            initial={{ scale: 0 }} animate={{ scale: 1 }}
            className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground shadow-[0_0_10px_currentColor]"
          >
            {unread > 9 ? "9+" : unread}
          </motion.span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-full z-50 mt-2 w-80 origin-top-right overflow-hidden rounded-2xl border border-border/70 bg-card/95 shadow-pop backdrop-blur-xl"
            >
              <div className="flex items-center justify-between border-b border-border/60 px-4 py-2.5">
                <div className="font-display text-sm font-bold">Notifications</div>
                {unread > 0 && (
                  <button
                    onClick={() => markM.mutate(undefined)}
                    className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-primary hover:bg-primary/10"
                  >
                    <Check className="h-3 w-3" /> Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-96 overflow-y-auto">
                {items.length === 0 ? (
                  <div className="p-6 text-center text-xs text-muted-foreground">All caught up.</div>
                ) : items.map((n) => (
                  <a
                    key={n.id}
                    href={n.link ?? "#"}
                    className={`block border-b border-border/40 px-4 py-3 transition hover:bg-secondary/40 last:border-0 ${!n.read_at ? "bg-primary/[0.04]" : ""}`}
                  >
                    <div className="flex items-start gap-2">
                      {!n.read_at && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary shadow-[0_0_8px_currentColor]" />}
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{n.title}</div>
                        {n.body && <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.body}</div>}
                        <div className="mt-1 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                          {new Date(n.created_at).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })} · {n.kind}
                        </div>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
