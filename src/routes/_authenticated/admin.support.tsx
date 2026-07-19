import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion, AnimatePresence } from "framer-motion";
import {
  LifeBuoy, Radio, Inbox, Search, AlertCircle, Loader2, CheckCircle2, Clock, X,
  Hash, MessageSquare, Send, Filter, Sparkles, Building2, User as UserIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { listAdminTickets, replyTicket } from "@/lib/tickets.functions";
import { supabase } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { AdminOwnerMessagesInbox } from "@/components/AdminOwnerMessagesInbox";

export const Route = createFileRoute("/_authenticated/admin/support")({
  head: () => ({ meta: [{ title: "Support tickets — Super Admin · CoreCade" }] }),
  component: AdminSupportPanel,
});

type Status = "open" | "waiting" | "in_progress" | "resolved" | "closed";

const STATUS_META: Record<Status, { label: string; cls: string; icon: typeof Clock }> = {
  open:        { label: "Open",        cls: "border-primary/40 bg-primary/10 text-primary",                  icon: AlertCircle },
  waiting:     { label: "Waiting",     cls: "border-amber-400/40 bg-amber-400/10 text-amber-200",            icon: Clock },
  in_progress: { label: "In progress", cls: "border-violet-400/40 bg-violet-400/10 text-violet-200",         icon: Loader2 },
  resolved:    { label: "Resolved",    cls: "border-emerald-400/40 bg-emerald-400/10 text-emerald-200",      icon: CheckCircle2 },
  closed:      { label: "Closed",      cls: "border-white/15 bg-white/5 text-white/60",                      icon: X },
};

const PRIO_META: Record<string, string> = {
  low:    "border-white/15 bg-white/5 text-white/60",
  normal: "border-sky-400/40 bg-sky-400/10 text-sky-200",
  high:   "border-amber-400/40 bg-amber-400/10 text-amber-200",
  urgent: "border-rose-500/40 bg-rose-500/10 text-rose-200",
};

type AdminTicket = {
  id: string;
  user_id: string;
  role: string;
  subject: string;
  description: string;
  category: string;
  priority: string;
  status: Status;
  admin_reply: string | null;
  replied_at: string | null;
  created_at: string;
  cafe_id: string | null;
  user: { id: string; email: string | null; full_name: string | null } | null;
  cafe: { id: string; name: string } | null;
};

function AdminSupportPanel() {
  const qc = useQueryClient();
  const listFn = useServerFn(listAdminTickets);
  const replyFn = useServerFn(replyTicket);
  const q = useQuery({
    queryKey: ["admin-tickets"],
    queryFn: () => listFn() as Promise<AdminTicket[]>,
    refetchInterval: 20_000,
  });

  const [live, setLive] = useState(false);
  const [filter, setFilter] = useState<"all" | Status>("all");
  const [search, setSearch] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [reply, setReply] = useState("");

  // Realtime: subscribe to all ticket changes
  useEffect(() => {
    const ch = supabase
      .channel("admin:support_tickets")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "support_tickets" },
        (payload) => {
          qc.invalidateQueries({ queryKey: ["admin-tickets"] });
          if (payload.eventType === "INSERT") {
            const row = payload.new as { subject?: string; priority?: string };
            toast.message(`🔔 New ticket — ${row.subject ?? "Support request"}`, {
              description: `Priority: ${row.priority ?? "normal"}`,
            });
          }
        },
      )
      .subscribe((status) => setLive(status === "SUBSCRIBED"));
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const tickets = q.data ?? [];
  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return tickets.filter((t) => {
      if (filter !== "all" && t.status !== filter) return false;
      if (!s) return true;
      return (
        t.subject.toLowerCase().includes(s) ||
        t.description.toLowerCase().includes(s) ||
        t.id.toLowerCase().includes(s) ||
        (t.user?.email ?? "").toLowerCase().includes(s) ||
        (t.user?.full_name ?? "").toLowerCase().includes(s) ||
        (t.cafe?.name ?? "").toLowerCase().includes(s)
      );
    });
  }, [tickets, filter, search]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: tickets.length };
    for (const t of tickets) c[t.status] = (c[t.status] ?? 0) + 1;
    return c;
  }, [tickets]);

  const active = filtered.find((t) => t.id === activeId) ?? filtered[0] ?? null;
  useEffect(() => { setReply(""); }, [active?.id]);

  const m = useMutation({
    mutationFn: (vars: { id: string; admin_reply: string; status?: Status }) =>
      replyFn({ data: vars }),
    onSuccess: () => {
      toast.success("Reply sent");
      setReply("");
      qc.invalidateQueries({ queryKey: ["admin-tickets"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not send reply"),
  });

  const setStatusOnly = useMutation({
    mutationFn: (vars: { id: string; status: Status; admin_reply: string }) =>
      replyFn({ data: vars }),
    onSuccess: (_d, vars) => {
      toast.success(`Status → ${vars.status}`);
      qc.invalidateQueries({ queryKey: ["admin-tickets"] });
    },
  });

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Network support
          </div>
          <h1 className="flex items-center gap-2 font-display text-3xl font-extrabold tracking-tight">
            <LifeBuoy className="h-7 w-7 text-primary" /> Tickets
            {live && (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-emerald-300">
                <Radio className="h-3 w-3 animate-pulse" /> live
              </span>
            )}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(["all", "open", "waiting", "in_progress", "resolved", "closed"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-mono uppercase tracking-wider transition",
                filter === k
                  ? "border-primary/60 bg-primary/15 text-primary"
                  : "border-border/60 bg-card/40 text-muted-foreground hover:border-primary/30 hover:text-foreground",
              )}
            >
              <Filter className="h-3 w-3" /> {k === "all" ? "All" : STATUS_META[k as Status].label}
              <span className="rounded-full bg-background/40 px-1.5 py-0.5 text-[10px]">
                {counts[k] ?? 0}
              </span>
            </button>
          ))}
        </div>
      </header>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by subject, description, email, café or ticket id…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        {/* LIST */}
        <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/40 backdrop-blur">
          <div className="flex items-center justify-between border-b border-border/60 px-4 py-2.5 text-xs font-mono uppercase tracking-wider text-muted-foreground">
            <span>Showing {filtered.length} of {tickets.length}</span>
            {q.isFetching && <span className="text-azure">syncing…</span>}
          </div>
          {q.isLoading ? (
            <div className="space-y-1 p-3">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-lg bg-white/5" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
              <Inbox className="h-8 w-8 text-muted-foreground" />
              <div className="font-display text-lg font-bold">Inbox zero</div>
              <div className="max-w-sm text-sm text-muted-foreground">
                No tickets match this view. New tickets appear instantly.
              </div>
            </div>
          ) : (
            <ul className="max-h-[640px] overflow-y-auto divide-y divide-border/40">
              {filtered.map((t) => {
                const meta = STATUS_META[t.status] ?? STATUS_META.open;
                const Icon = meta.icon;
                const isActive = active?.id === t.id;
                return (
                  <li key={t.id}>
                    <button
                      onClick={() => setActiveId(t.id)}
                      className={cn(
                        "w-full px-4 py-3 text-left transition hover:bg-white/5",
                        isActive && "bg-primary/10",
                      )}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium", meta.cls)}>
                          <Icon className={cn("h-3 w-3", t.status === "in_progress" && "animate-spin")} />
                          {meta.label}
                        </span>
                        <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider", PRIO_META[t.priority] ?? PRIO_META.normal)}>
                          {t.priority}
                        </span>
                        <Badge variant="outline" className="text-[10px] uppercase tracking-wider">{t.category}</Badge>
                        <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                          {new Date(t.created_at).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <div className="mt-1.5 truncate font-display text-sm font-semibold">{t.subject}</div>
                      <div className="mt-0.5 flex items-center gap-3 font-mono text-[10px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1"><Hash className="h-3 w-3" />{t.id.slice(0, 8)}</span>
                        <span className="inline-flex items-center gap-1"><UserIcon className="h-3 w-3" />{t.user?.full_name || t.user?.email || "—"}</span>
                        {t.cafe && <span className="inline-flex items-center gap-1"><Building2 className="h-3 w-3" />{t.cafe.name}</span>}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* DETAIL / CHAT */}
        <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/40 backdrop-blur">
          <AnimatePresence mode="wait">
            {!active ? (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex h-full min-h-[400px] flex-col items-center justify-center gap-2 px-6 text-center">
                <MessageSquare className="h-8 w-8 text-muted-foreground" />
                <div className="font-display text-lg font-bold">Select a ticket</div>
                <div className="max-w-sm text-sm text-muted-foreground">Open any ticket on the left to reply, change status, or close it.</div>
              </motion.div>
            ) : (
              <motion.div key={active.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex h-full flex-col">
                {/* header */}
                <div className="border-b border-border/60 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    {(() => {
                      const meta = STATUS_META[active.status] ?? STATUS_META.open;
                      const Icon = meta.icon;
                      return (
                        <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium", meta.cls)}>
                          <Icon className={cn("h-3 w-3", active.status === "in_progress" && "animate-spin")} />
                          {meta.label}
                        </span>
                      );
                    })()}
                    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider", PRIO_META[active.priority] ?? PRIO_META.normal)}>
                      {active.priority}
                    </span>
                    <Badge variant="outline" className="text-[10px] uppercase tracking-wider">{active.category}</Badge>
                    <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                      <Hash className="mr-1 inline h-3 w-3" />{active.id.slice(0, 8)}
                    </span>
                  </div>
                  <h2 className="mt-2 font-display text-xl font-extrabold leading-tight">{active.subject}</h2>
                  <div className="mt-1 flex flex-wrap items-center gap-3 font-mono text-[10px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><UserIcon className="h-3 w-3" />{active.user?.full_name || "—"} · {active.user?.email || "no email"}</span>
                    {active.cafe && <span className="inline-flex items-center gap-1"><Building2 className="h-3 w-3" />{active.cafe.name}</span>}
                    <span>{new Date(active.created_at).toLocaleString("en-IN")}</span>
                  </div>
                </div>

                {/* messages */}
                <div className="flex-1 space-y-3 overflow-y-auto p-4">
                  <div className="flex gap-2">
                    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/10 font-mono text-xs">
                      {(active.user?.full_name || active.user?.email || "?").slice(0, 1).toUpperCase()}
                    </div>
                    <div className="max-w-[85%] rounded-2xl rounded-tl-sm border border-border/60 bg-background/40 p-3">
                      <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                        {active.user?.full_name || active.user?.email || "User"} · {active.role}
                      </div>
                      <div className="whitespace-pre-wrap text-sm">{active.description}</div>
                    </div>
                  </div>

                  {active.admin_reply && (
                    <div className="flex justify-end gap-2">
                      <div className="max-w-[85%] rounded-2xl rounded-tr-sm border border-emerald-400/30 bg-emerald-400/10 p-3">
                        <div className="mb-1 flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.18em] text-emerald-300">
                          <Sparkles className="h-3 w-3" /> CoreCade · {active.replied_at ? new Date(active.replied_at).toLocaleString("en-IN") : ""}
                        </div>
                        <div className="whitespace-pre-wrap text-sm">{active.admin_reply}</div>
                      </div>
                      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-mono text-primary-foreground" style={{ background: "var(--gradient-brand-hot)" }}>
                        CC
                      </div>
                    </div>
                  )}
                </div>

                {/* composer */}
                <div className="border-t border-border/60 p-3">
                  <Textarea
                    rows={3}
                    placeholder="Type a reply… (markdown OK)"
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                  />
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {(["open", "waiting", "in_progress", "resolved", "closed"] as Status[]).map((s) => (
                        <button
                          key={s}
                          onClick={() => setStatusOnly.mutate({
                            id: active.id,
                            status: s,
                            admin_reply: active.admin_reply ?? "",
                          })}
                          disabled={setStatusOnly.isPending || active.status === s}
                          className={cn(
                            "rounded-full border px-2.5 py-0.5 text-[10px] font-mono uppercase tracking-wider transition disabled:opacity-50",
                            active.status === s
                              ? "border-primary/60 bg-primary/15 text-primary"
                              : "border-border/60 hover:border-primary/40 hover:text-foreground",
                          )}
                        >
                          → {STATUS_META[s].label}
                        </button>
                      ))}
                    </div>
                    <Button
                      onClick={() => reply.trim() && m.mutate({ id: active.id, admin_reply: reply.trim() })}
                      disabled={m.isPending || !reply.trim()}
                      className="gap-2 text-primary-foreground"
                      style={{ background: "var(--gradient-brand-hot)" }}
                    >
                      {m.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      Send reply
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
