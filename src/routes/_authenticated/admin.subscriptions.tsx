import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { CalendarClock, Search, Zap, TimerReset, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { adminListSubscriptions, adminExtendSubscription, type SubscriptionRow } from "@/lib/billing.functions";

export const Route = createFileRoute("/_authenticated/admin/subscriptions")({
  head: () => ({
    meta: [
      { title: "Subscriptions — CoreCade Admin" },
      { name: "description", content: "Track every café's remaining subscription days and extend them in one click." },
    ],
  }),
  component: SubscriptionsPanel,
});

const QUICK = [7, 15, 30, 90];

function toneFor(days: number, status: string | null) {
  if (status === "expired" || days === 0) return { c: "#f43f5e", label: "Expired" };
  if (days <= 5) return { c: "#f43f5e", label: "Critical" };
  if (days <= 10) return { c: "#f59e0b", label: "Ending soon" };
  return { c: "#22c55e", label: "Healthy" };
}

function SubscriptionsPanel() {
  const listFn = useServerFn(adminListSubscriptions);
  const extendFn = useServerFn(adminExtendSubscription);
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [custom, setCustom] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["admin-subscriptions"],
    queryFn: () => listFn(),
    refetchInterval: 30000,
  });

  const extend = useMutation({
    mutationFn: extendFn,
    onMutate: async (vars: { data: { cafe_id: string; add_days: number; reason?: string | null } }) => {
      await qc.cancelQueries({ queryKey: ["admin-subscriptions"] });
      const prev = qc.getQueryData<SubscriptionRow[]>(["admin-subscriptions"]);
      qc.setQueryData<SubscriptionRow[]>(["admin-subscriptions"], (old) =>
        (old ?? []).map((r) =>
          r.id === vars.data.cafe_id
            ? { ...r, days_left: r.days_left + vars.data.add_days, subscription_status: "active" }
            : r,
        ),
      );
      return { prev };
    },
    onError: (e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["admin-subscriptions"], ctx.prev);
      toast.error(e instanceof Error ? e.message : "Could not extend");
    },
    onSuccess: (res) => toast.success(`Extended → ${new Date(res.new_ends_at).toDateString()}`),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["admin-subscriptions"] });
      qc.invalidateQueries({ queryKey: ["admin-cafes"] });
    },
  });

  const rows = (data ?? []).filter((r) =>
    !q.trim() ||
    [r.name, r.slug, r.city, r.owner_email, r.owner_name].filter(Boolean).join(" ").toLowerCase().includes(q.toLowerCase()),
  );

  const expiring = rows.filter((r) => r.days_left <= 10).length;
  const active = rows.filter((r) => r.days_left > 10).length;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "Cafés tracked", value: rows.length, icon: CalendarClock, c: "#8b5cf6" },
          { label: "Healthy", value: active, icon: CheckCircle2, c: "#22c55e" },
          { label: "Ending in ≤10 days", value: expiring, icon: AlertTriangle, c: "#f59e0b" },
        ].map((s) => (
          <div key={s.label} className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/40 p-4 backdrop-blur">
            <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full blur-3xl" style={{ background: `${s.c}44` }} />
            <s.icon className="h-4 w-4" style={{ color: s.c }} />
            <div className="mt-2 font-display text-3xl font-extrabold">{s.value}</div>
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search café, city or owner…" className="pl-9" />
      </div>

      <div className="space-y-2">
        {isLoading && <div className="rounded-2xl border border-border/50 p-6 text-center text-sm text-muted-foreground">Loading subscriptions…</div>}
        {!isLoading && rows.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border/50 p-10 text-center text-sm text-muted-foreground">No cafés match that search.</div>
        )}
        {rows.map((r, i) => {
          const tone = toneFor(r.days_left, r.subscription_status);
          const pct = Math.min(100, (r.days_left / 30) * 100);
          return (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.02, 0.3) }}
              className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/40 p-4 backdrop-blur"
            >
              <span className="absolute inset-y-0 left-0 w-[3px]" style={{ background: tone.c, boxShadow: `0 0 18px ${tone.c}` }} />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-display text-base font-bold">{r.name}</span>
                    <Badge variant="outline" style={{ borderColor: `${tone.c}66`, color: tone.c }}>{tone.label}</Badge>
                    {r.pending_invoices > 0 && <Badge variant="outline">{r.pending_invoices} pending payment</Badge>}
                  </div>
                  <div className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                    /{r.slug} · {r.city ?? "—"} · {r.owner_email ?? "no owner email"}
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-display text-2xl font-extrabold tabular-nums" style={{ color: tone.c }}>
                    {r.days_left}<span className="ml-1 text-xs font-medium text-muted-foreground">days left</span>
                  </div>
                  <div className="font-mono text-[10px] text-muted-foreground">
                    {r.trial_ends_at ? `until ${new Date(r.trial_ends_at).toDateString()}` : "no end date set"}
                  </div>
                </div>
              </div>

              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/5">
                <motion.span
                  className="block h-full rounded-full"
                  initial={false}
                  animate={{ width: `${pct}%` }}
                  transition={{ type: "spring", stiffness: 120, damping: 20 }}
                  style={{ background: `linear-gradient(90deg, ${tone.c}, ${tone.c}66)`, boxShadow: `0 0 12px ${tone.c}` }}
                />
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                {QUICK.map((d) => (
                  <Button
                    key={d}
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    disabled={extend.isPending}
                    onClick={() => extend.mutate({ data: { cafe_id: r.id, add_days: d, reason: "Admin quick extend" } })}
                  >
                    <Zap className="mr-1 h-3 w-3" /> +{d}d
                  </Button>
                ))}
                <div className="flex items-center gap-1.5">
                  <Input
                    className="h-7 w-20 text-xs"
                    inputMode="numeric"
                    placeholder="days"
                    value={custom[r.id] ?? ""}
                    onChange={(e) => setCustom((c) => ({ ...c, [r.id]: e.target.value.replace(/\D/g, "") }))}
                  />
                  <Button
                    size="sm"
                    className="h-7 text-xs"
                    disabled={!custom[r.id] || extend.isPending}
                    style={{ background: "var(--gradient-brand-hot)" }}
                    onClick={() => {
                      const n = Number(custom[r.id]);
                      if (!n) return;
                      extend.mutate({ data: { cafe_id: r.id, add_days: n, reason: "Admin custom extend" } });
                      setCustom((c) => ({ ...c, [r.id]: "" }));
                    }}
                  >
                    <TimerReset className="mr-1 h-3 w-3" /> Extend
                  </Button>
                </div>
                {r.last_extension && (
                  <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                    last: +{r.last_extension.added_days}d · {new Date(r.last_extension.created_at).toLocaleDateString("en-IN")}
                  </span>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
