import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Cpu, Clock, User, Phone, IndianRupee, Plus, StopCircle, UserX, Undo2,
  Check, X, Wallet, CalendarClock, Sparkles, Settings2, Trash2, Zap,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  updateBookingStatus, cancelBookingWithRefund, refundBookingDeposit, extendBooking,
  endBookingEarly, payBookingDeposit, markBookingDeposit,
} from "@/lib/bookings.functions";

export type StationBooking = {
  id: string;
  scheduled_at: string;
  duration_minutes: number;
  status: string;
  device_id?: string | null;
  deposit_amount?: number | null;
  deposit_paid?: boolean | null;
  customers: { full_name?: string; phone?: string } | null;
  devices: { name?: string; type?: string } | null;
};

export type StationInfo = {
  id: string;
  name: string;
  type: string;
  status: string;
  hourly_rate: number;
  zone?: string | null;
  zone_color?: string | null;
  notes?: string | null;
};

function useTick(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

function fmt(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m >= 60) return `${Math.floor(m / 60)}h ${m % 60}m`;
  return `${m}:${String(r).padStart(2, "0")}`;
}

export function StationDetailDialog({
  open, onOpenChange, station, bookings, cafeId, onEdit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  station: StationInfo | null;
  bookings: StationBooking[];
  cafeId?: string;
  onEdit?: (s: StationInfo) => void;
}) {
  const qc = useQueryClient();
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["bookings", cafeId] });
    qc.invalidateQueries({ queryKey: ["devices", cafeId] });
  };
  const now = useTick(1000);

  const setStatus = useServerFn(updateBookingStatus);
  const cxlRef   = useServerFn(cancelBookingWithRefund);
  const refDep   = useServerFn(refundBookingDeposit);
  const extend   = useServerFn(extendBooking);
  const endEarly = useServerFn(endBookingEarly);
  const payDep   = useServerFn(payBookingDeposit);
  const markDep  = useServerFn(markBookingDeposit);

  const setM = useMutation({ mutationFn: setStatus, onSuccess: () => { refresh(); toast.success("Updated"); } });
  const cxlM = useMutation({ mutationFn: cxlRef, onSuccess: () => { refresh(); toast.success("Cancelled & refunded"); }, onError: (e) => toast.error(e instanceof Error ? e.message : "Failed") });
  const refM = useMutation({ mutationFn: refDep, onSuccess: () => { refresh(); toast.success("Deposit refunded"); }, onError: (e) => toast.error(e instanceof Error ? e.message : "Failed") });
  const extM = useMutation({ mutationFn: extend, onSuccess: (r: any) => { refresh(); toast.success(`Extended to ${r?.duration_minutes ?? "+"}m`); }, onError: (e) => toast.error(e instanceof Error ? e.message : "Failed") });
  const endM = useMutation({ mutationFn: endEarly, onSuccess: () => { refresh(); toast.success("Session ended"); }, onError: (e) => toast.error(e instanceof Error ? e.message : "Failed") });
  const payM = useMutation({ mutationFn: payDep, onSuccess: () => { refresh(); toast.success("Paid from wallet"); }, onError: (e) => toast.error(e instanceof Error ? e.message : "Failed") });
  const depM = useMutation({ mutationFn: markDep, onSuccess: () => { refresh(); toast.success("Deposit updated"); }, onError: (e) => toast.error(e instanceof Error ? e.message : "Failed") });

  const { live, upcoming } = useMemo(() => {
    const active = bookings.filter((b) => b.status !== "cancelled" && b.status !== "completed" && b.status !== "no_show");
    const withMs = active.map((b) => {
      const startMs = new Date(b.scheduled_at).getTime();
      const endMs = startMs + (b.duration_minutes || 0) * 60_000;
      return { b, startMs, endMs };
    }).filter((x) => x.endMs > now)
      .sort((a, b) => a.startMs - b.startMs);
    const live = withMs.find((x) => now >= x.startMs && now < x.endMs) ?? null;
    const upcoming = withMs.filter((x) => !live || x.b.id !== live.b.id).slice(0, 5);
    return { live, upcoming };
  }, [bookings, now]);

  if (!station) return null;

  const activeBooking = live?.b ?? null;
  const endMs = live?.endMs ?? 0;
  const startMs = live?.startMs ?? 0;
  const diffMs = endMs - now;
  const past = live ? diffMs < 0 : false;

  const dep = { amount: activeBooking?.deposit_amount ?? 0, paid: !!activeBooking?.deposit_paid };

  const statusTone =
    live ? { bg: "rgba(239,79,182,0.14)", fg: "#ef4fb6", label: "● LIVE" }
    : upcoming[0] ? { bg: "rgba(245,176,66,0.14)", fg: "#f5b042", label: "✦ RESERVED" }
    : station.status === "maintenance" ? { bg: "rgba(148,163,184,0.14)", fg: "#94a3b8", label: "MAINTENANCE" }
    : { bg: "rgba(34,211,168,0.14)", fg: "#22d3a8", label: "AVAILABLE" };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg overflow-hidden p-0">
        {/* Header */}
        <div
          className="relative border-b border-border/50 p-4"
          style={{ background: `linear-gradient(135deg, ${statusTone.bg}, transparent 60%)` }}
        >
          <DialogHeader className="space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <DialogTitle className="flex items-center gap-2 text-base">
                  <Cpu className="h-4 w-4 text-primary" /> {station.name}
                </DialogTitle>
                <div className="mt-0.5 flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  <span>{station.type}</span>
                  <span>·</span>
                  <span>₹{station.hourly_rate}/hr</span>
                  {station.zone && (
                    <>
                      <span>·</span>
                      <span style={{ color: station.zone_color || "#a78bfa" }}>{station.zone}</span>
                    </>
                  )}
                </div>
              </div>
              <Badge
                className="whitespace-nowrap border font-mono text-[10px] uppercase tracking-[0.18em]"
                style={{ background: statusTone.bg, color: statusTone.fg, borderColor: `${statusTone.fg}55` }}
              >
                {statusTone.label}
              </Badge>
            </div>
          </DialogHeader>
        </div>

        <div className="max-h-[70vh] space-y-3 overflow-auto p-4">
          {/* LIVE session */}
          {live ? (
            <div className="space-y-3 rounded-xl border border-magenta/30 bg-magenta/5 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-magenta/20 text-magenta">
                    <User className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate font-display text-sm font-bold">
                      {activeBooking?.customers?.full_name ?? "Guest"}
                    </div>
                    {activeBooking?.customers?.phone && (
                      <a href={`tel:${activeBooking.customers.phone}`} className="flex items-center gap-1 font-mono text-[11px] text-muted-foreground hover:text-foreground">
                        <Phone className="h-3 w-3" /> {activeBooking.customers.phone}
                      </a>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className={`font-mono text-2xl font-bold ${past ? "text-rose-400" : diffMs < 5 * 60_000 ? "text-amber-400" : "text-emerald-400"}`}>
                    {past ? `−${fmt(-diffMs)}` : fmt(diffMs)}
                  </div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                    {past ? "past end" : "remaining"}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 border-t border-magenta/20 pt-3 text-xs">
                <div className="flex items-center gap-1.5"><Clock className="h-3 w-3 text-muted-foreground" /> Started {new Date(startMs).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</div>
                <div className="flex items-center gap-1.5"><CalendarClock className="h-3 w-3 text-muted-foreground" /> Ends {new Date(endMs).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</div>
                <div className="flex items-center gap-1.5"><IndianRupee className="h-3 w-3 text-muted-foreground" /> Deposit ₹{dep.amount} · {dep.paid ? <span className="text-emerald-400">paid</span> : <span className="text-amber-400">pending</span>}</div>
                <div className="flex items-center gap-1.5"><Zap className="h-3 w-3 text-muted-foreground" /> {activeBooking?.duration_minutes} min slot</div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={() => extM.mutate({ data: { id: activeBooking!.id, add_minutes: 15 } })}><Plus className="h-3.5 w-3.5" /> +15 min</Button>
                <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={() => extM.mutate({ data: { id: activeBooking!.id, add_minutes: 30 } })}><Plus className="h-3.5 w-3.5" /> +30 min</Button>
                <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={() => { if (confirm("End session now?")) endM.mutate({ data: { id: activeBooking!.id } }); }}><StopCircle className="h-3.5 w-3.5" /> End early</Button>
                <Button size="sm" variant="outline" className="h-8 gap-1 text-xs text-amber-400" onClick={() => { if (confirm("Mark as no-show?")) setM.mutate({ data: { id: activeBooking!.id, status: "no_show" } }); }}><UserX className="h-3.5 w-3.5" /> No-show</Button>
                <Button size="sm" variant="outline" className="col-span-2 h-8 gap-1 text-xs" onClick={() => {
                  const v = prompt("Deposit amount (₹):", String(dep.amount));
                  if (v === null) return;
                  const amt = Math.max(0, Number(v) || 0);
                  const paid = amt > 0 && confirm("Mark already paid (cash)? Cancel = deduct from wallet.");
                  if (amt > 0 && !paid) payM.mutate({ data: { id: activeBooking!.id, amount: amt } });
                  else depM.mutate({ data: { id: activeBooking!.id, deposit_amount: amt, deposit_paid: paid } });
                }}><IndianRupee className="h-3.5 w-3.5" /> Set deposit</Button>
                {dep.paid && (
                  <Button size="sm" variant="ghost" className="col-span-2 h-8 gap-1 text-xs text-emerald-400" onClick={() => { if (confirm("Refund deposit to wallet?")) refM.mutate({ data: { id: activeBooking!.id } }); }}><Wallet className="h-3.5 w-3.5" /> Refund deposit</Button>
                )}
                <Button size="sm" variant="destructive" className="col-span-2 h-8 gap-1 text-xs" onClick={() => { if (confirm("Cancel & refund deposit?")) cxlM.mutate({ data: { id: activeBooking!.id } }); }}><Undo2 className="h-3.5 w-3.5" /> Cancel & refund</Button>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border/60 bg-background/30 p-4 text-center">
              <Sparkles className="mx-auto h-5 w-5 text-emerald-400" />
              <div className="mt-1 font-display text-sm">Station is free</div>
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                No active session right now
              </div>
            </div>
          )}

          {/* Upcoming queue */}
          {upcoming.length > 0 && (
            <div className="rounded-xl border border-border/60 bg-card/40 p-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  Upcoming ({upcoming.length})
                </div>
              </div>
              <div className="space-y-1.5">
                {upcoming.map(({ b, startMs }) => (
                  <div key={b.id} className="flex items-center justify-between gap-2 rounded-lg border border-border/50 bg-background/40 px-2.5 py-1.5">
                    <div className="min-w-0">
                      <div className="truncate text-xs font-medium">{b.customers?.full_name ?? "Guest"}</div>
                      <div className="font-mono text-[10px] text-muted-foreground">
                        {new Date(startMs).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })} · {b.duration_minutes}m
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Badge variant="outline" className="text-[10px]">
                        in {fmt(Math.max(0, startMs - now))}
                      </Badge>
                      {b.status === "pending" && (
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-emerald-400" onClick={() => setM.mutate({ data: { id: b.id, status: "confirmed" } })} title="Confirm">
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-rose-400" onClick={() => { if (confirm(`Cancel ${b.customers?.full_name ?? "booking"}?`)) cxlM.mutate({ data: { id: b.id } }); }} title="Cancel">
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Station-level actions */}
          <div className="flex flex-wrap gap-2 border-t border-border/50 pt-3">
            {onEdit && (
              <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={() => { onOpenChange(false); onEdit(station); }}>
                <Settings2 className="h-3.5 w-3.5" /> Edit station
              </Button>
            )}
            {station.notes && (
              <div className="mt-1 w-full rounded-lg border border-border/50 bg-background/30 p-2 text-[11px] text-muted-foreground">
                {station.notes}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
