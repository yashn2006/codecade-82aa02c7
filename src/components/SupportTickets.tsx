import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, MessageSquare, Clock, CheckCircle2, AlertCircle, Loader2, X,
  Inbox, Sparkles, Hash,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { createTicket, listMyTickets } from "@/lib/tickets.functions";
import { cn } from "@/lib/utils";

type TicketRole = "owner" | "customer";

const STATUS_META: Record<string, { label: string; cls: string; icon: typeof Clock }> = {
  open:         { label: "Open",         cls: "border-primary/40 bg-primary/10 text-primary",       icon: AlertCircle },
  waiting:      { label: "Waiting",      cls: "border-amber-400/40 bg-amber-400/10 text-amber-200", icon: Clock },
  in_progress:  { label: "In progress",  cls: "border-violet-400/40 bg-violet-400/10 text-violet-200", icon: Loader2 },
  resolved:     { label: "Resolved",     cls: "border-emerald-400/40 bg-emerald-400/10 text-emerald-200", icon: CheckCircle2 },
  closed:       { label: "Closed",       cls: "border-white/15 bg-white/5 text-white/60",           icon: X },
};

const PRIO_META: Record<string, string> = {
  low:    "border-white/15 bg-white/5 text-white/60",
  normal: "border-sky-400/40 bg-sky-400/10 text-sky-200",
  high:   "border-amber-400/40 bg-amber-400/10 text-amber-200",
  urgent: "border-rose-500/40 bg-rose-500/10 text-rose-200",
};

export function SupportTickets({ role = "owner", cafeId }: { role?: TicketRole; cafeId?: string | null }) {
  const fetchFn = useServerFn(listMyTickets);
  const q = useQuery({ queryKey: ["my-tickets"], queryFn: () => fetchFn(), refetchInterval: 30_000 });
  const [open, setOpen] = useState(false);

  const tickets = q.data ?? [];
  const counts = tickets.reduce(
    (a, t) => ({ ...a, [t.status]: (a[t.status] ?? 0) + 1 }),
    {} as Record<string, number>,
  );

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Support tickets
          </div>
          <h3 className="font-display text-2xl font-extrabold tracking-tight">Your conversations</h3>
        </div>
        <div className="flex items-center gap-2">
          <CountPill icon={AlertCircle} label="Open" value={counts.open ?? 0} tone="primary" />
          <CountPill icon={Loader2}     label="In progress" value={counts.in_progress ?? 0} tone="violet" />
          <CountPill icon={CheckCircle2} label="Resolved" value={counts.resolved ?? 0} tone="emerald" />
          <Button
            onClick={() => setOpen(true)}
            className="gap-2 text-primary-foreground"
            style={{ background: "var(--gradient-brand-hot)" }}
          >
            <Plus className="h-4 w-4" /> New ticket
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/40 backdrop-blur">
        {q.isLoading ? (
          <div className="space-y-1 p-4">
            {[0, 1, 2].map(i => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-white/5" />
            ))}
          </div>
        ) : tickets.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
            <Inbox className="h-8 w-8 text-muted-foreground" />
            <div className="font-display text-lg font-bold">No tickets yet</div>
            <div className="max-w-sm text-sm text-muted-foreground">
              Stuck on something? Open a ticket and the CoreCade team will jump in. Typical reply under 4 hours.
            </div>
          </div>
        ) : (
          <ul className="divide-y divide-border/40">
            {tickets.map((t) => {
              const meta = STATUS_META[t.status] ?? STATUS_META.open;
              const Icon = meta.icon;
              return (
                <li key={t.id} className="group px-4 py-3 transition hover:bg-white/5">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium", meta.cls)}>
                      <Icon className={cn("h-3 w-3", t.status === "in_progress" && "animate-spin")} />
                      {meta.label}
                    </span>
                    <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                      <Hash className="h-3 w-3" /> {t.id.slice(0, 8)}
                    </span>
                    <Badge variant="outline" className="text-[10px] uppercase tracking-wider">{t.category}</Badge>
                    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider", PRIO_META[t.priority] ?? PRIO_META.normal)}>
                      {t.priority}
                    </span>
                    <div className="min-w-0 flex-1 font-display text-sm font-semibold text-foreground">
                      {t.subject}
                    </div>
                    <div className="font-mono text-[10px] text-muted-foreground">
                      {new Date(t.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                    </div>
                  </div>
                  {t.admin_reply && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="mt-2 rounded-lg border border-emerald-400/20 bg-emerald-400/5 p-3"
                    >
                      <div className="mb-1 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-emerald-300">
                        <Sparkles className="h-3 w-3" /> CoreCade replied
                      </div>
                      <div className="text-sm text-foreground/90 whitespace-pre-wrap">{t.admin_reply}</div>
                    </motion.div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <NewTicketModal open={open} onOpenChange={setOpen} role={role} cafeId={cafeId ?? null} />
    </section>
  );
}

function CountPill({ icon: Icon, label, value, tone }: {
  icon: typeof Clock; label: string; value: number;
  tone: "primary" | "violet" | "emerald";
}) {
  const cls =
    tone === "primary"  ? "border-primary/40 text-primary"
  : tone === "violet"   ? "border-violet-400/40 text-violet-200"
  :                       "border-emerald-400/40 text-emerald-200";
  return (
    <div className={cn("hidden items-center gap-1.5 rounded-full border bg-card/40 px-2.5 py-1 text-xs font-mono backdrop-blur sm:inline-flex", cls)}>
      <Icon className="h-3 w-3" /> {value} <span className="text-muted-foreground">{label}</span>
    </div>
  );
}

function NewTicketModal({ open, onOpenChange, role, cafeId }: {
  open: boolean; onOpenChange: (v: boolean) => void; role: TicketRole; cafeId: string | null;
}) {
  const qc = useQueryClient();
  const create = useServerFn(createTicket);
  const m = useMutation({
    mutationFn: create,
    onSuccess: (res) => {
      toast.success(`Ticket #${res.id.slice(0, 8)} created — we'll be in touch.`);
      qc.invalidateQueries({ queryKey: ["my-tickets"] });
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not create ticket"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Open a support ticket</DialogTitle>
          <DialogDescription>
            Be specific — paste IDs, time stamps and screenshots in the description. Average response time is under 4 hours.
          </DialogDescription>
        </DialogHeader>
        <AnimatePresence>
          <motion.form
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              m.mutate({
                data: {
                  subject: String(fd.get("subject") ?? "").trim(),
                  description: String(fd.get("description") ?? "").trim(),
                  category: fd.get("category") as "general" | "billing" | "bookings" | "hardware" | "account" | "bug" | "feature",
                  priority: fd.get("priority") as "low" | "normal" | "high" | "urgent",
                  role,
                  cafe_id: cafeId,
                },
              });
            }}
          >
            <div className="space-y-1">
              <Label>Subject *</Label>
              <Input name="subject" required minLength={2} maxLength={200} placeholder="POS not printing receipts after v15 update" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Category</Label>
                <select name="category" defaultValue="general"
                  className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
                  <option value="general">General</option>
                  <option value="billing">Billing</option>
                  <option value="bookings">Bookings</option>
                  <option value="hardware">Hardware</option>
                  <option value="account">Account</option>
                  <option value="bug">Bug</option>
                  <option value="feature">Feature request</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label>Priority</Label>
                <select name="priority" defaultValue="normal"
                  className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Description *</Label>
              <Textarea name="description" required minLength={2} maxLength={4000} rows={6}
                placeholder="What happened, what you expected, and any IDs/timestamps that help us reproduce." />
            </div>
            <div className="flex items-center justify-between pt-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                <MessageSquare className="mr-1 inline h-3 w-3" /> Replies appear in this list + your notifications
              </span>
              <Button type="submit" disabled={m.isPending} className="gap-2 text-primary-foreground" style={{ background: "var(--gradient-brand-hot)" }}>
                {m.isPending ? "Submitting…" : "Submit ticket"}
              </Button>
            </div>
          </motion.form>
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
