import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  CalendarRange, Plus, Check, X, UserX, IndianRupee, Wallet, Undo2, CalendarDays, LifeBuoy,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getCafeBySlug } from "@/lib/cafes.functions";
import {
  listBookings, updateBookingStatus, createBookingForCustomer, markBookingDeposit,
  payBookingDeposit, refundBookingDeposit, cancelBookingWithRefund,
} from "@/lib/bookings.functions";
import { listDevices } from "@/lib/devices.functions";
import { listCustomers } from "@/lib/customers.functions";
import { listCafeCustomerTickets } from "@/lib/tickets.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/EmptyState";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogIcon,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { BookingDetailDialog, type BookingRow } from "@/components/BookingDetailDialog";
import { ConfirmModal, DepositModal } from "@/components/ConfirmDialog";

export const Route = createFileRoute("/_authenticated/cafe/$slug/bookings")({
  head: () => ({
    meta: [
      { title: "Bookings — CoreCade" },
      { name: "description", content: "Confirm, reschedule and track every reservation." },
      { property: "og:title", content: "Bookings — CoreCade" },
      { property: "og:description", content: "Confirm, reschedule and track every reservation." },
    ],
  }),
  component: BookingsPage,
});

const STATUS_ACCENT: Record<string, string> = {
  confirmed: "#22c55e",
  pending: "#f59e0b",
  cancelled: "#64748b",
  no_show: "#f43f5e",
  completed: "#38bdf8",
};

const time = (s: string) =>
  new Date(s).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
const dayLabel = (s: string) =>
  new Date(s).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });

function BookingsPage() {
  const { slug } = Route.useParams();
  const getCafe = useServerFn(getCafeBySlug);
  const { data: cafe } = useQuery({ queryKey: ["cafe", slug], queryFn: () => getCafe({ data: { slug } }) });
  const cafeId = cafe?.id;

  const list = useServerFn(listBookings);
  const setStatus = useServerFn(updateBookingStatus);
  const create = useServerFn(createBookingForCustomer);
  const deposit = useServerFn(markBookingDeposit);
  const lDev = useServerFn(listDevices);
  const lCus = useServerFn(listCustomers);
  const supportFn = useServerFn(listCafeCustomerTickets);

  const q = useQuery({
    queryKey: ["bookings", cafeId],
    queryFn: () => list({ data: { cafe_id: cafeId! } }),
    enabled: !!cafeId,
  });
  const devicesQ = useQuery({ queryKey: ["devices", cafeId], queryFn: () => lDev({ data: { cafe_id: cafeId! } }), enabled: !!cafeId });
  const customersQ = useQuery({ queryKey: ["customers", cafeId], queryFn: () => lCus({ data: { cafe_id: cafeId! } }), enabled: !!cafeId });
  const supportQ = useQuery({
    queryKey: ["cafe-customer-tickets", cafeId],
    queryFn: () => supportFn({ data: { cafe_id: cafeId! } }),
    enabled: !!cafeId,
    refetchInterval: 10_000,
  });

  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ["bookings", cafeId] });
  const setM = useMutation({ mutationFn: setStatus, onSuccess: () => { refresh(); toast.success("Updated"); } });
  const depositM = useMutation({ mutationFn: deposit, onSuccess: () => { refresh(); toast.success("Deposit updated"); } });
  const payDep = useServerFn(payBookingDeposit);
  const refDep = useServerFn(refundBookingDeposit);
  const cxlRef = useServerFn(cancelBookingWithRefund);
  const payM = useMutation({ mutationFn: payDep, onSuccess: () => { refresh(); toast.success("Deposit paid from wallet"); }, onError: (e) => toast.error(e instanceof Error ? e.message : "Failed") });
  const refM = useMutation({ mutationFn: refDep, onSuccess: () => { refresh(); toast.success("Deposit refunded"); }, onError: (e) => toast.error(e instanceof Error ? e.message : "Failed") });
  const cxlM = useMutation({ mutationFn: cxlRef, onSuccess: () => { refresh(); toast.success("Booking cancelled + refunded"); }, onError: (e) => toast.error(e instanceof Error ? e.message : "Failed") });
  const createM = useMutation({
    mutationFn: create,
    onSuccess: () => { refresh(); toast.success("Booking created"); setOpen(false); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"upcoming" | "today" | "past">("today");
  const [detail, setDetail] = useState<BookingRow | null>(null);
  const [pastLimit, setPastLimit] = useState(25);
  const [depositTarget, setDepositTarget] = useState<{ id: string; initialAmount: number; customerName: string | null } | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    description: string;
    confirmLabel: string;
    onConfirm: () => Promise<unknown> | void;
  } | null>(null);

  const openSupportCount = useMemo(
    () =>
      (supportQ.data ?? []).filter(
        (t) => t.status === "open" || t.status === "in_progress" || t.status === "waiting",
      ).length,
    [supportQ.data],
  );

  // Live "NOW" line position on the today timeline.
  const [nowMin, setNowMin] = useState(() => new Date().getHours() * 60 + new Date().getMinutes());
  useEffect(() => {
    const t = setInterval(() => { const d = new Date(); setNowMin(d.getHours() * 60 + d.getMinutes()); }, 60_000);
    return () => clearInterval(t);
  }, []);

  const rows = useMemo(() => (Array.isArray(q.data) ? q.data : []), [q.data]);
  const { upcoming, today, past } = useMemo(() => {
    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay); endOfDay.setDate(endOfDay.getDate() + 1);
    const u: typeof rows = [], t: typeof rows = [], p: typeof rows = [];
    if (!Array.isArray(rows)) return { upcoming: [], today: [], past: [] };
    for (const b of rows) {
      if (!b || !b.scheduled_at) continue;
      const ts = new Date(b.scheduled_at).getTime();
      if (ts >= endOfDay.getTime()) u.push(b);
      else if (ts >= startOfDay.getTime()) t.push(b);
      else p.push(b);
    }
    const asc = (a: (typeof rows)[number], b: (typeof rows)[number]) =>
      new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime();
    return { upcoming: u.sort(asc), today: t.sort(asc), past: p.sort((a, b) => -asc(a, b)) };
  }, [rows]);

  if (!cafeId) return <div className="h-40 animate-pulse rounded-2xl border border-border/40 bg-card/30" />;

  const Actions = ({ b }: { b: (typeof rows)[number] }) => {
    const dep = b as { deposit_amount?: number; deposit_paid?: boolean };
    const customerName = (b.customers as { full_name?: string } | null)?.full_name ?? null;
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        {b.status === "pending" && (
          <>
            <Button size="icon" variant="ghost" className="h-8 w-8" title="Confirm"
              onClick={() => setM.mutate({ data: { id: b.id, status: "confirmed" } })}>
              <Check className="h-4 w-4 text-emerald-400" />
            </Button>
            <Button size="icon" variant="ghost" className="h-8 w-8" title="Cancel"
              onClick={() => setM.mutate({ data: { id: b.id, status: "cancelled" } })}>
              <X className="h-4 w-4 text-destructive" />
            </Button>
          </>
        )}
        {(b.status === "confirmed" || b.status === "pending") && (
          <>
            <Button size="icon" variant="ghost" className="h-8 w-8" title="Mark no-show"
              onClick={() => setConfirmAction({
                title: "Mark booking as no-show?",
                description: `This flags ${customerName ?? "the customer"}'s #BK-${b.id.slice(0, 8).toUpperCase()} slot as a no-show.`,
                confirmLabel: "Mark No-Show",
                onConfirm: () => setM.mutateAsync({ data: { id: b.id, status: "no_show" } }),
              })}>
              <UserX className="h-4 w-4 text-amber-400" />
            </Button>
            <Button size="icon" variant="ghost" className="h-8 w-8" title="Cancel & refund"
              onClick={() => setConfirmAction({
                title: "Cancel booking & refund deposit?",
                description: "This cancels the reservation and refunds any paid deposit back to the customer's wallet.",
                confirmLabel: "Cancel & Refund",
                onConfirm: () => cxlM.mutateAsync({ data: { id: b.id } }),
              })}>
              <Undo2 className="h-4 w-4 text-rose-400" />
            </Button>
          </>
        )}
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1 rounded-lg text-xs"
          onClick={() => setDepositTarget({ id: b.id, initialAmount: dep.deposit_amount ?? 0, customerName })}
        >
          <IndianRupee className="h-3 w-3" /> Deposit
        </Button>
        {dep.deposit_paid && (
          <Button size="sm" variant="ghost" className="h-8 gap-1 text-xs text-emerald-400"
            onClick={() => setConfirmAction({
              title: "Refund deposit to wallet?",
              description: `Return ₹${dep.deposit_amount ?? 0} back to ${customerName ?? "the customer"}'s café wallet.`,
              confirmLabel: "Refund Deposit",
              onConfirm: () => refM.mutateAsync({ data: { id: b.id } }),
            })}>
            <Wallet className="h-3 w-3" /> Refund
          </Button>
        )}
      </div>
    );
  };

  const Card = ({ b, compact = false }: { b: (typeof rows)[number]; compact?: boolean }) => {
    const dep = b as { deposit_amount?: number; deposit_paid?: boolean };
    const accent = STATUS_ACCENT[b.status] ?? "#64748b";
    return (
      <div
        onClick={(e) => { if ((e.target as HTMLElement).closest("button")) return; setDetail(b as unknown as BookingRow); }}
        className={`relative cursor-pointer overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur transition hover:border-primary/40 hover:bg-white/[0.05] ${compact ? "px-4 py-2.5" : "p-4"}`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="font-mono text-[11px] uppercase tracking-[0.16em] tabular-nums" style={{ color: accent }}>
              {compact ? `${dayLabel(b.scheduled_at)} · ` : ""}{time(b.scheduled_at)} · {b.duration_minutes}m
            </div>
            <div className="mt-0.5 truncate text-[14px] font-semibold">
              {(b.customers as { full_name?: string } | null)?.full_name ?? "—"}
              <span className="text-muted-foreground"> · {(b.devices as { name?: string } | null)?.name ?? "—"}</span>
            </div>
            {!compact && (dep.deposit_amount ?? 0) > 0 && (
              <Badge variant={dep.deposit_paid ? "default" : "outline"} className="mt-1.5 text-[10px]">
                <IndianRupee className="mr-0.5 h-2.5 w-2.5" />{dep.deposit_amount} deposit · {dep.deposit_paid ? "paid" : "pending"}
              </Badge>
            )}
          </div>
          {compact ? (
            <Badge variant="outline" className="text-[10px] capitalize" style={{ borderColor: `${accent}55`, color: accent }}>
              {b.status.replace("_", " ")}
            </Badge>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="capitalize" style={{ borderColor: `${accent}55`, color: accent }}>
                {b.status.replace("_", " ")}
              </Badge>
              <Actions b={b} />
            </div>
          )}
        </div>
      </div>
    );
  };

  const tabs = [
    { id: "upcoming" as const, label: "Upcoming", n: upcoming.length },
    { id: "today" as const, label: "Today", n: today.length },
    { id: "past" as const, label: "Past", n: past.length },
  ];

  return (
    <div className="pb-24">
      {/* Tabs + Customer Support Shortcut */}
      <div className="sticky top-0 z-10 -mx-3 flex items-center justify-between gap-2 overflow-x-auto bg-background/85 px-3 py-2 backdrop-blur-xl sm:mx-0 sm:rounded-2xl sm:px-2">
        <div className="flex shrink-0 gap-2">
          {tabs.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`shrink-0 rounded-full px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] transition ${
                  active ? "text-primary-foreground" : "border border-white/10 text-muted-foreground hover:text-foreground"
                }`}
                style={active ? { background: "var(--gradient-brand-hot)", boxShadow: "0 0 14px -2px oklch(0.7 0.26 335 / 0.8)" } : undefined}
              >
                {t.label}
                <span className={`ml-1.5 rounded-full px-1.5 ${active ? "bg-black/25" : "bg-white/10"}`}>{t.n}</span>
              </button>
            );
          })}
        </div>

        <Link
          to="/cafe/$slug/support"
          params={{ slug }}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-white/90 transition hover:border-primary/45 hover:bg-primary/10"
        >
          <LifeBuoy className="h-3.5 w-3.5 text-primary" />
          Customer Support
          {openSupportCount > 0 && (
            <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-white">
              {openSupportCount}
            </span>
          )}
        </Link>
      </div>

      <div className="mt-4 space-y-6">
        {q.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-20 rounded-2xl" />)}
          </div>
        ) : tab === "upcoming" ? (
          upcoming.length === 0 ? (
            <EmptyState icon={CalendarRange} title="Nothing booked ahead" description="Future reservations will show up here." />
          ) : (
            Object.entries(
              upcoming.reduce<Record<string, typeof rows>>((acc, b) => {
                const k = dayLabel(b.scheduled_at);
                (acc[k] ||= []).push(b);
                return acc;
              }, {}),
            ).map(([day, items]) => (
              <div key={day}>
                <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{day}</div>
                <div className="space-y-2">{items.map((b) => <Card key={b.id} b={b} />)}</div>
              </div>
            ))
          )
        ) : tab === "today" ? (
          today.length === 0 ? (
            <EmptyState icon={CalendarDays} title="No bookings today" description="Your floor is fully walk-in right now." />
          ) : (
            <div className="relative pl-14">
              {/* rail */}
              <span className="absolute bottom-0 left-[52px] top-0 w-px bg-white/8" aria-hidden />
              {/* NOW marker */}
              <div className="relative mb-3 flex items-center gap-2" aria-hidden>
                <span className="w-10 shrink-0 text-right font-mono text-[10px] font-bold text-primary">
                  {String(Math.floor(nowMin / 60)).padStart(2, "0")}:{String(nowMin % 60).padStart(2, "0")}
                </span>
                <span className="h-px flex-1" style={{ background: "var(--gradient-brand-hot)", boxShadow: "0 0 10px oklch(0.7 0.26 335)" }} />
                <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-primary">now</span>
              </div>
              <div className="space-y-3">
                {today.map((b) => (
                  <div key={b.id} className="relative">
                    <span className="absolute -left-14 top-4 w-10 text-right font-mono text-[10px] text-muted-foreground">
                      {time(b.scheduled_at)}
                    </span>
                    <span
                      className="absolute -left-[9px] top-5 h-2 w-2 rounded-full"
                      style={{ background: STATUS_ACCENT[b.status] ?? "#64748b" }}
                      aria-hidden
                    />
                    <Card b={b} />
                  </div>
                ))}
              </div>
            </div>
          )
        ) : past.length === 0 ? (
          <EmptyState icon={CalendarRange} title="No history yet" description="Completed and cancelled bookings land here." />
        ) : (
          <div className="space-y-1.5">
            {past.slice(0, pastLimit).map((b) => <Card key={b.id} b={b} compact />)}
            {past.length > pastLimit && (
              <Button variant="outline" className="mt-3 w-full rounded-xl" onClick={() => setPastLimit((n) => n + 25)}>
                Load 25 more
              </Button>
            )}
          </div>
        )}
      </div>

      {/* FAB */}
      <button
        onClick={() => setOpen(true)}
        className="btn-glow-magenta fixed bottom-24 right-5 z-30 inline-flex h-14 items-center gap-2 rounded-full px-5 text-[14px] font-bold text-primary-foreground transition hover:brightness-110 sm:bottom-8"
        style={{ background: "var(--gradient-brand-hot)" }}
      >
        <Plus className="h-5 w-5" /> New booking
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogIcon><CalendarRange className="h-5 w-5" /></DialogIcon>
            <DialogTitle>Create booking</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const rawScheduled = String(fd.get("scheduled_at") ?? "");
              const parsedDate = new Date(rawScheduled);
              if (isNaN(parsedDate.getTime())) {
                toast.error("Please choose a valid date and time");
                return;
              }
              createM.mutate({ data: {
                cafe_id: cafeId,
                device_id: String(fd.get("device_id")),
                customer_id: String(fd.get("customer_id")),
                scheduled_at: parsedDate.toISOString(),
                duration_minutes: Number(fd.get("duration_minutes")),
              } });
            }}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <Label>Customer</Label>
              <select name="customer_id" required className="field-select">
                <option value="">Select…</option>
                {(customersQ.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Station</Label>
              <select name="device_id" required className="field-select">
                <option value="">Select…</option>
                {(devicesQ.data ?? []).map((d) => <option key={d.id} value={d.id}>{d.name} · {d.type}</option>)}
              </select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Date &amp; time</Label>
                <Input
                  name="scheduled_at"
                  type="datetime-local"
                  defaultValue={(() => {
                    const d = new Date(Date.now() + 15 * 60000);
                    d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
                    const p = (n: number) => String(n).padStart(2, "0");
                    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
                  })()}
                  required
                />
              </div>
              <div className="space-y-1.5"><Label>Duration (min)</Label><Input name="duration_minutes" type="number" min={15} step={15} defaultValue={60} required /></div>
            </div>
            <DialogFooter className="pt-1">
              <Button type="submit" disabled={createM.isPending}
                className="h-12 w-full rounded-xl text-[15px] font-bold text-primary-foreground"
                style={{ background: "var(--gradient-brand-hot)" }}>
                {createM.isPending ? "Creating…" : "Create booking"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <BookingDetailDialog booking={detail} open={!!detail} onOpenChange={(o) => !o && setDetail(null)} cafeId={cafeId} />

      <DepositModal
        open={!!depositTarget}
        onOpenChange={(o) => !o && setDepositTarget(null)}
        initialAmount={depositTarget?.initialAmount ?? 0}
        customerName={depositTarget?.customerName}
        onSubmit={async ({ amount, mode }) => {
          if (!depositTarget) return;
          if (amount > 0 && mode === "wallet") {
            await payM.mutateAsync({ data: { id: depositTarget.id, amount } });
          } else {
            await depositM.mutateAsync({
              data: { id: depositTarget.id, deposit_amount: amount, deposit_paid: amount > 0 },
            });
          }
        }}
      />

      <ConfirmModal
        open={!!confirmAction}
        onOpenChange={(o) => !o && setConfirmAction(null)}
        title={confirmAction?.title ?? ""}
        description={confirmAction?.description}
        confirmLabel={confirmAction?.confirmLabel ?? "Confirm"}
        onConfirm={() => confirmAction?.onConfirm()}
      />
    </div>
  );
}
