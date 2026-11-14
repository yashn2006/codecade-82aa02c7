import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  CalendarRange,
  CheckCircle2,
  Clock,
  Hash,
  Inbox,
  Loader2,
  MessageSquare,
  Phone,
  Radio,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  User as UserIcon,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { sendTicketMessage, updateTicketStatus } from "@/lib/tickets.functions";
import {
  formatTicketRef,
  parseTicketThread,
  type ThreadRole,
} from "@/lib/support-thread";
import { supabase } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export type TicketStatus = "open" | "waiting" | "in_progress" | "resolved" | "closed";

export type WorkspaceTicket = {
  id: string;
  user_id: string;
  role: string;
  subject: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  admin_reply: string | null;
  replied_at: string | null;
  created_at: string;
  cafe_id: string | null;
  user?: { id: string; email: string | null; full_name: string | null; phone?: string | null } | null;
  cafe?: { id: string; name: string; slug?: string } | null;
};

export const STATUS_META: Record<
  TicketStatus,
  { label: string; cls: string; icon: typeof Clock }
> = {
  open: {
    label: "Open",
    cls: "border-primary/45 bg-primary/15 text-primary",
    icon: AlertCircle,
  },
  waiting: {
    label: "Waiting",
    cls: "border-amber-400/45 bg-amber-400/15 text-amber-200",
    icon: Clock,
  },
  in_progress: {
    label: "In progress",
    cls: "border-violet-400/45 bg-violet-400/15 text-violet-200",
    icon: Loader2,
  },
  resolved: {
    label: "Resolved",
    cls: "border-emerald-400/45 bg-emerald-400/15 text-emerald-200",
    icon: CheckCircle2,
  },
  closed: {
    label: "Closed",
    cls: "border-white/20 bg-white/10 text-white/80",
    icon: X,
  },
};

export const PRIO_META: Record<string, string> = {
  low: "border-white/20 bg-white/10 text-white/80",
  normal: "border-sky-400/45 bg-sky-400/15 text-sky-200",
  high: "border-amber-400/45 bg-amber-400/15 text-amber-200",
  urgent: "border-rose-500/50 bg-rose-500/15 text-rose-200",
};

const ROLE_LABEL: Record<ThreadRole, string> = {
  customer: "Player",
  owner: "Café Desk",
  admin: "CoreCade Support",
};

export function TicketChatWorkspace({
  tickets,
  isLoading,
  isFetching,
  viewerRole,
  viewerUserId,
  queryKeysToInvalidate,
  allowAllStatuses = false,
  selectedId,
  onSelectId,
  emptyTitle = "No conversations yet",
  emptyDescription = "Open a ticket to start a live chat thread.",
  emptyAction,
  headerAction,
  realtimeTableFilter,
}: {
  tickets: WorkspaceTicket[];
  isLoading?: boolean;
  isFetching?: boolean;
  viewerRole: ThreadRole;
  viewerUserId?: string | null;
  queryKeysToInvalidate: readonly (readonly unknown[])[];
  allowAllStatuses?: boolean;
  selectedId?: string | null;
  onSelectId?: (id: string | null) => void;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  headerAction?: ReactNode;
  realtimeTableFilter?: string;
}) {
  const qc = useQueryClient();
  const sendFn = useServerFn(sendTicketMessage);
  const statusFn = useServerFn(updateTicketStatus);

  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(null);
  const [mobileShowThread, setMobileShowThread] = useState(false);
  const [filter, setFilter] = useState<"all" | TicketStatus>("all");
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [live, setLive] = useState(false);
  const scrollEndRef = useRef<HTMLDivElement | null>(null);

  const activeId = selectedId !== undefined ? selectedId : internalSelectedId;
  const setActiveId = (id: string | null) => {
    if (onSelectId) onSelectId(id);
    else setInternalSelectedId(id);
  };

  const invalidateAll = () => {
    for (const key of queryKeysToInvalidate) {
      qc.invalidateQueries({ queryKey: [...key] });
    }
  };

  // Realtime sync on support_tickets + user notifications
  useEffect(() => {
    let cancelled = false;
    const ch = supabase.channel(`chat:${viewerRole}:${Math.random().toString(36).slice(2, 8)}`);

    ch.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "support_tickets",
        ...(realtimeTableFilter ? { filter: realtimeTableFilter } : {}),
      },
      () => {
        if (!cancelled) invalidateAll();
      },
    );

    if (viewerUserId) {
      ch.on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${viewerUserId}`,
        },
        () => {
          if (!cancelled) invalidateAll();
        },
      );
    }

    ch.subscribe((status) => {
      if (!cancelled) setLive(status === "SUBSCRIBED");
    });

    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewerRole, viewerUserId, realtimeTableFilter]);

  const parsedByTicket = useMemo(() => {
    const map = new Map<string, ReturnType<typeof parseTicketThread>>();
    for (const t of tickets) {
      map.set(
        t.id,
        parseTicketThread({
          ...t,
          userName: t.user?.full_name || t.user?.email || null,
          cafeName: t.cafe?.name ?? null,
        }),
      );
    }
    return map;
  }, [tickets]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tickets.filter((t) => {
      if (filter !== "all" && t.status !== filter) return false;
      if (!q) return true;
      const parsed = parsedByTicket.get(t.id);
      const msgsText = parsed?.messages.map((m) => m.body).join(" ") ?? "";
      return (
        t.subject.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        msgsText.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q) ||
        formatTicketRef(t.id).toLowerCase().includes(q) ||
        (parsed?.meta.bookingRef ?? "").toLowerCase().includes(q) ||
        (t.user?.full_name ?? "").toLowerCase().includes(q) ||
        (t.user?.email ?? "").toLowerCase().includes(q) ||
        (t.cafe?.name ?? "").toLowerCase().includes(q)
      );
    });
  }, [tickets, filter, search, parsedByTicket]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: tickets.length };
    for (const t of tickets) c[t.status] = (c[t.status] ?? 0) + 1;
    return c;
  }, [tickets]);

  const active = filtered.find((t) => t.id === activeId) ?? filtered[0] ?? null;
  const activeThread = active ? parsedByTicket.get(active.id) ?? null : null;

  useEffect(() => {
    setDraft("");
  }, [active?.id]);

  useEffect(() => {
    if (!activeThread?.messages.length) return;
    scrollEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [active?.id, activeThread?.messages.length]);

  const sendM = useMutation({
    mutationFn: (vars: { ticket_id: string; body: string }) =>
      sendFn({ data: vars }),
    onSuccess: () => {
      setDraft("");
      invalidateAll();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not send message"),
  });

  const statusM = useMutation({
    mutationFn: (vars: { id: string; status: TicketStatus }) =>
      statusFn({ data: vars }),
    onSuccess: (_d, vars) => {
      toast.success(`Ticket marked ${STATUS_META[vars.status].label.toLowerCase()}`);
      invalidateAll();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not update status"),
  });

  function handleSelect(t: WorkspaceTicket) {
    setActiveId(t.id);
    setMobileShowThread(true);
  }

  function submitDraft() {
    if (!active || !draft.trim() || sendM.isPending) return;
    sendM.mutate({ ticket_id: active.id, body: draft.trim() });
  }

  return (
    <div className="space-y-4">
      {/* Status filter pills + search + action */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {(["all", "open", "in_progress", "waiting", "resolved", "closed"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setFilter(k)}
                className={cn(
                  "inline-flex min-h-[36px] items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[11px] uppercase tracking-wider transition",
                  filter === k
                    ? "border-primary/65 bg-primary/20 text-white shadow-[0_0_14px_-4px_oklch(0.7_0.26_335/0.8)]"
                    : "border-white/10 bg-white/[0.03] text-white/75 hover:border-primary/40 hover:text-white",
                )}
              >
                <span>{k === "all" ? "All" : STATUS_META[k].label}</span>
                <span className="rounded-full bg-black/35 px-1.5 py-0.5 text-[10px] tabular-nums">
                  {counts[k] ?? 0}
                </span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {live && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-emerald-300">
                <Radio className="h-3 w-3 animate-pulse" /> Live chat
              </span>
            )}
            {headerAction}
          </div>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by subject, #TK-ID, #BK-ID, café, player, or message…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-11 rounded-xl border-white/10 bg-white/[0.03] pl-9"
          />
        </div>
      </div>

      {/* Split Workspace */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.28fr)]">
        {/* LEFT: Ticket List */}
        <div
          className={cn(
            "liquid-glass-card overflow-hidden rounded-2xl border border-white/10",
            mobileShowThread && active ? "hidden lg:block" : "block",
          )}
        >
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            <span className="tabular-nums">
              Conversations ({filtered.length} / {tickets.length})
            </span>
            {isFetching && <span className="text-primary">Syncing…</span>}
          </div>

          {isLoading ? (
            <div className="space-y-2 p-3">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-20 animate-pulse rounded-xl bg-white/5" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
              <div className="grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-muted-foreground">
                <Inbox className="h-6 w-6" />
              </div>
              <div className="font-display text-lg font-bold text-white">{emptyTitle}</div>
              <div className="max-w-sm text-xs leading-relaxed text-muted-foreground">
                {emptyDescription}
              </div>
              {emptyAction}
            </div>
          ) : (
            <ul className="max-h-[600px] divide-y divide-white/[0.07] overflow-y-auto">
              {filtered.map((t) => {
                const statusKey = (t.status in STATUS_META ? t.status : "open") as TicketStatus;
                const meta = STATUS_META[statusKey];
                const Icon = meta.icon;
                const parsed = parsedByTicket.get(t.id);
                const lastMsg = parsed?.messages[parsed.messages.length - 1];
                const isActive = active?.id === t.id;
                const msgCount = parsed?.messages.length ?? 1;

                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => handleSelect(t)}
                      className={cn(
                        "w-full min-h-[72px] px-4 py-3.5 text-left transition hover:bg-white/[0.05]",
                        isActive && "bg-primary/12 shadow-[inset_3px_0_0_0_var(--primary)]",
                      )}
                    >
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                            meta.cls,
                          )}
                        >
                          <Icon className={cn("h-3 w-3", statusKey === "in_progress" && "animate-spin")} />
                          {meta.label}
                        </span>
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider",
                            PRIO_META[t.priority] ?? PRIO_META.normal,
                          )}
                        >
                          {t.priority}
                        </span>
                        {parsed?.meta.bookingRef && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/35 bg-emerald-400/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-200">
                            {parsed.meta.bookingRef}
                          </span>
                        )}
                        <span className="ml-auto font-mono text-[10px] tabular-nums text-muted-foreground">
                          {new Date(t.replied_at || t.created_at).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                          })}
                        </span>
                      </div>

                      <div className="mt-1.5 flex items-center justify-between gap-2">
                        <div className="truncate font-display text-sm font-bold text-white">
                          {t.subject}
                        </div>
                        <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 font-mono text-[10px] tabular-nums text-white/75">
                          {msgCount} msg{msgCount === 1 ? "" : "s"}
                        </span>
                      </div>

                      {lastMsg && (
                        <div className="mt-1 truncate text-xs text-muted-foreground">
                          <span className="font-semibold text-white/80">{lastMsg.senderName}:</span>{" "}
                          {lastMsg.body}
                        </div>
                      )}

                      <div className="mt-1.5 flex flex-wrap items-center gap-2.5 font-mono text-[10px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Hash className="h-3 w-3" />
                          {formatTicketRef(t.id)}
                        </span>
                        {t.user && (
                          <span className="inline-flex items-center gap-1">
                            <UserIcon className="h-3 w-3" />
                            {t.user.full_name || t.user.email || "User"}
                          </span>
                        )}
                        {t.cafe && (
                          <span className="inline-flex items-center gap-1 text-primary/90">
                            <Building2 className="h-3 w-3" />
                            {t.cafe.name}
                          </span>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* RIGHT: Live Thread View */}
        <div
          className={cn(
            "liquid-glass-card flex min-h-[480px] lg:h-[640px] flex-col overflow-hidden rounded-2xl border border-white/10",
            mobileShowThread && active ? "flex" : "hidden lg:flex",
          )}
        >
          {!active || !activeThread ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-16 text-center">
              <MessageSquare className="h-8 w-8 text-muted-foreground" />
              <div className="font-display text-lg font-bold text-white">Select a conversation</div>
              <div className="max-w-sm text-xs text-muted-foreground">
                Pick any ticket on the left to open the full message thread and reply live.
              </div>
            </div>
          ) : (
            <>
              {/* Thread Header */}
              <div className="shrink-0 border-b border-white/10 bg-white/[0.02] p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setMobileShowThread(false)}
                    className="inline-flex min-h-[36px] items-center gap-1 rounded-xl border border-white/15 bg-white/5 px-2.5 text-xs font-semibold text-white lg:hidden"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" /> Inbox
                  </button>

                  {(() => {
                    const statusKey = (active.status in STATUS_META ? active.status : "open") as TicketStatus;
                    const meta = STATUS_META[statusKey];
                    const Icon = meta.icon;
                    return (
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold",
                          meta.cls,
                        )}
                      >
                        <Icon className={cn("h-3 w-3", statusKey === "in_progress" && "animate-spin")} />
                        {meta.label}
                      </span>
                    );
                  })()}

                  <span
                    className={cn(
                      "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider",
                      PRIO_META[active.priority] ?? PRIO_META.normal,
                    )}
                  >
                    {active.priority}
                  </span>
                  <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                    {active.category}
                  </Badge>
                  <span className="ml-auto font-mono text-[11px] font-semibold text-muted-foreground">
                    {formatTicketRef(active.id)}
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap items-start justify-between gap-2">
                  <h3 className="font-display text-lg font-extrabold leading-tight text-white sm:text-xl">
                    {active.subject}
                  </h3>
                  <div className="flex items-center gap-1.5">
                    {active.status !== "resolved" && active.status !== "closed" ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={statusM.isPending}
                        onClick={() => statusM.mutate({ id: active.id, status: "resolved" })}
                        className="h-8 gap-1 rounded-xl border-emerald-400/35 bg-emerald-400/10 text-xs font-semibold text-emerald-200 hover:bg-emerald-400/20"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> Resolve
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={statusM.isPending}
                        onClick={() => statusM.mutate({ id: active.id, status: "open" })}
                        className="h-8 gap-1 rounded-xl border-white/15 bg-white/5 text-xs font-semibold"
                      >
                        <RotateCcw className="h-3.5 w-3.5" /> Reopen
                      </Button>
                    )}
                  </div>
                </div>

                <div className="mt-1.5 flex flex-wrap items-center gap-3 font-mono text-[10px] text-muted-foreground">
                  {active.user && (
                    <span className="inline-flex items-center gap-1">
                      <UserIcon className="h-3 w-3" />
                      {active.user.full_name || "User"}
                      {active.user.email ? ` · ${active.user.email}` : ""}
                    </span>
                  )}
                  {active.user?.phone && (
                    <a
                      href={`tel:${active.user.phone}`}
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      <Phone className="h-3 w-3" />
                      {active.user.phone}
                    </a>
                  )}
                  {active.cafe && (
                    <span className="inline-flex items-center gap-1 text-primary/90">
                      <Building2 className="h-3 w-3" />
                      {active.cafe.name}
                    </span>
                  )}
                  <span className="tabular-nums">
                    Opened {new Date(active.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                  </span>
                </div>

                {/* Linked Booking Context Strip */}
                {(activeThread.meta.bookingRef || activeThread.meta.bookingSummary) && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-xs">
                    <CalendarRange className="h-4 w-4 shrink-0 text-emerald-300" />
                    <span className="font-mono font-bold text-emerald-200">
                      {activeThread.meta.bookingRef || "Linked Booking"}
                    </span>
                    {activeThread.meta.bookingSummary && (
                      <span className="text-white/85">· {activeThread.meta.bookingSummary}</span>
                    )}
                  </div>
                )}

                {allowAllStatuses && (
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    {(["open", "in_progress", "waiting", "resolved", "closed"] as TicketStatus[]).map((s) => (
                      <button
                        key={s}
                        type="button"
                        disabled={statusM.isPending || active.status === s}
                        onClick={() => statusM.mutate({ id: active.id, status: s })}
                        className={cn(
                          "rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider transition disabled:opacity-50",
                          active.status === s
                            ? "border-primary/60 bg-primary/20 text-white"
                            : "border-white/10 bg-white/[0.02] text-white/70 hover:border-primary/40 hover:text-white",
                        )}
                      >
                        {STATUS_META[s].label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Message Stream */}
              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                {activeThread.messages.map((m) => {
                  const isMine =
                    (viewerUserId && m.senderId && m.senderId === viewerUserId) ||
                    m.senderRole === viewerRole;

                  return (
                    <div
                      key={m.id}
                      className={cn("flex gap-2.5", isMine ? "justify-end" : "justify-start")}
                    >
                      {!isMine && (
                        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/15 bg-white/10 font-mono text-xs font-bold text-white">
                          {m.senderRole === "admin" ? (
                            <Sparkles className="h-3.5 w-3.5 text-primary" />
                          ) : m.senderRole === "owner" ? (
                            <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />
                          ) : (
                            m.senderName.slice(0, 1).toUpperCase()
                          )}
                        </div>
                      )}

                      <div
                        className={cn(
                          "max-w-[85%] rounded-2xl border px-3.5 py-2.5 text-sm shadow-sm",
                          isMine
                            ? "rounded-tr-sm border-primary/40 bg-primary/15 text-white"
                            : m.senderRole === "admin"
                              ? "rounded-tl-sm border-emerald-400/35 bg-emerald-400/10 text-white"
                              : "rounded-tl-sm border-white/15 bg-white/[0.05] text-white/95",
                        )}
                      >
                        <div className="mb-1 flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-white/70">
                          <span className="font-bold text-white">{m.senderName}</span>
                          <span>·</span>
                          <span>{ROLE_LABEL[m.senderRole]}</span>
                          <span>·</span>
                          <span className="tabular-nums">
                            {new Date(m.createdAt).toLocaleString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                        <div className="whitespace-pre-wrap break-words text-[13px] leading-relaxed">
                          {m.body}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={scrollEndRef} />
              </div>

              {/* Chat Composer */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  submitDraft();
                }}
                className="shrink-0 border-t border-white/10 bg-black/25 p-3"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <Textarea
                    rows={2}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        submitDraft();
                      }
                    }}
                    placeholder={
                      viewerRole === "customer"
                        ? "Message the café about cancelling, rescheduling, or your session… (Enter to send)"
                        : viewerRole === "owner" && active.role === "customer"
                          ? "Reply to player's booking message… (Enter to send)"
                          : "Type your message… (Enter to send, Shift+Enter for newline)"
                    }
                    className="min-h-[52px] flex-1 resize-none rounded-xl border-white/15 bg-white/[0.04]"
                  />
                  <Button
                    type="submit"
                    disabled={sendM.isPending || !draft.trim()}
                    className="min-h-[44px] shrink-0 gap-2 rounded-xl px-5 font-bold text-white"
                    style={{ background: "var(--gradient-brand-hot)" }}
                  >
                    {sendM.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    <span>Send</span>
                  </Button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
