import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bell, Check, Trash2, X, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  listNotifications,
  markAllRead,
  markNotificationRead,
  deleteNotification,
  clearAllNotifications,
} from "@/lib/notifications.functions";
import { supabase } from "@/lib/supabase/client";
import { toast } from "sonner";

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
  const navigate = useNavigate();
  const list = useServerFn(listNotifications);
  const mark = useServerFn(markAllRead);
  const markSingle = useServerFn(markNotificationRead);
  const deleteSingle = useServerFn(deleteNotification);
  const clear = useServerFn(clearAllNotifications);
  const qc = useQueryClient();

  const q = useQuery<Notif[]>({
    queryKey: ["notifications"],
    queryFn: () => list(),
    refetchInterval: 30_000,
  });

  const markM = useMutation({
    mutationFn: () => mark(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to mark notifications read"),
  });

  const markSingleM = useMutation({
    mutationFn: markSingle,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to mark notification read"),
  });

  const deleteSingleM = useMutation({
    mutationFn: deleteSingle,
    onSuccess: () => {
      toast.success("Notification dismissed");
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to remove"),
  });

  const clearM = useMutation({
    mutationFn: () => clear(),
    onSuccess: () => {
      toast.success("All notifications cleared");
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to clear"),
  });

  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Realtime subscription
  useEffect(() => {
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return;
      const userId = data.user?.id;
      if (!userId) return;
      channel = supabase
        .channel(`notif:${userId}:${crypto.randomUUID()}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${userId}`,
          },
          () => qc.invalidateQueries({ queryKey: ["notifications"] }),
        )
        .subscribe();
    });
    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [qc]);

  const items = Array.isArray(q.data) ? q.data : [];
  const unread = items.filter((n) => !n.read_at).length;

  return (
    <div className="relative flex items-center">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mobile-keep-blur relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/[0.05] text-muted-foreground shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)] backdrop-blur-xl transition hover:border-white/25 hover:bg-white/10 hover:text-foreground active:scale-95"
        aria-label={`Notifications${unread ? ` — ${unread} unread` : ""}`}
      >
        <Bell className="h-4 w-4 shrink-0" />
        {unread > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="pointer-events-none absolute -right-1 -top-1 grid h-4 min-w-[16px] place-items-center rounded-full bg-gradient-to-r from-primary to-accent px-1 text-[9px] font-bold leading-none text-white ring-2 ring-[#0c0818] shadow-[0_0_10px_oklch(0.7_0.26_335/0.8)]"
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
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
              className="mobile-keep-blur fixed left-3 right-3 top-[calc(max(env(safe-area-inset-top),0.375rem)+58px)] z-50 origin-top-right overflow-hidden rounded-3xl border border-white/15 bg-[#0e0a1f]/95 shadow-[0_20px_60px_rgba(0,0,0,0.75),inset_0_1px_1px_rgba(255,255,255,0.2)] backdrop-blur-2xl sm:inset-auto sm:absolute sm:right-0 sm:top-full sm:mt-2 sm:w-[22rem]"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.02] px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="font-display text-sm font-bold text-white">Notifications</span>
                  {unread > 0 && (
                    <span className="rounded-full bg-primary/20 px-2 py-0.5 font-mono text-[9px] font-bold text-primary">
                      {unread} new
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  {unread > 0 && (
                    <button
                      onClick={() => markM.mutate()}
                      disabled={markM.isPending}
                      className="inline-flex items-center gap-1 rounded-lg border border-primary/30 bg-primary/10 px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-wider text-primary transition hover:bg-primary/20 active:scale-95"
                    >
                      <Check className="h-3 w-3" /> Mark read
                    </button>
                  )}
                  {items.length > 0 && (
                    <button
                      onClick={() => clearM.mutate()}
                      disabled={clearM.isPending}
                      className="inline-flex items-center gap-1 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-wider text-rose-300 transition hover:bg-rose-500/20 active:scale-95"
                      title="Clear all notifications"
                    >
                      <Trash2 className="h-3 w-3" /> Clear all
                    </button>
                  )}
                </div>
              </div>

              {/* Items List */}
              <div className="max-h-96 overflow-y-auto overscroll-contain divide-y divide-white/5">
                {items.length === 0 ? (
                  <div className="p-8 text-center text-xs text-muted-foreground">
                    <Sparkles className="mx-auto mb-2 h-6 w-6 text-primary/40 animate-pulse" />
                    All caught up. No new notifications.
                  </div>
                ) : (
                  items.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => {
                        if (!n.read_at) {
                          markSingleM.mutate({ data: { id: n.id } });
                        }
                        if (n.link) {
                          setOpen(false);
                          if (/^https?:\/\//.test(n.link)) {
                            window.location.assign(n.link);
                          } else {
                            navigate({ to: n.link as never });
                          }
                        }
                      }}
                      className={`group relative flex items-start justify-between gap-3 p-3.5 transition-colors cursor-pointer hover:bg-white/[0.05] ${
                        !n.read_at ? "bg-primary/[0.06]" : "bg-transparent"
                      }`}
                    >
                      <div className="flex items-start gap-2.5 min-w-0 flex-1">
                        {!n.read_at ? (
                          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary shadow-[0_0_8px_currentColor]" />
                        ) : (
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-white/20" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-xs font-semibold text-white">
                            {n.title}
                          </div>
                          {n.body && (
                            <div className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground leading-snug">
                              {n.body}
                            </div>
                          )}
                          <div className="mt-1 flex items-center gap-2 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                            <span>
                              {new Date(n.created_at).toLocaleString("en-IN", {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                            <span>·</span>
                            <span className="text-primary/70">{n.kind}</span>
                          </div>
                        </div>
                      </div>

                      {/* Clear / Dismiss Action inside this notification */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          deleteSingleM.mutate({ data: { id: n.id } });
                        }}
                        disabled={deleteSingleM.isPending}
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white/70 transition sm:opacity-60 sm:group-hover:opacity-100 hover:bg-rose-500/20 hover:text-rose-300 active:scale-90"
                        title="Dismiss this notification"
                      >
                        <X className="h-4 w-4" />
                        <span className="sr-only">Clear notification</span>
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Bottom Footer Clear All CTA */}
              {items.length > 0 && (
                <div className="border-t border-white/10 bg-white/[0.02] p-2 text-center">
                  <button
                    onClick={() => clearM.mutate()}
                    disabled={clearM.isPending}
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] py-2 font-mono text-[11px] font-semibold text-rose-300 shadow transition hover:border-rose-500/40 hover:bg-rose-500/10 active:scale-98 disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Clear all notifications
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
