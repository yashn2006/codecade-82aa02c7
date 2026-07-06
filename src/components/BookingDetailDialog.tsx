import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Clock, IndianRupee, Phone, User, Cpu, Plus, StopCircle, UserX, Undo2, X, Check, Wallet } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { updateBookingStatus, cancelBookingWithRefund, refundBookingDeposit, extendBooking, endBookingEarly, payBookingDeposit, markBookingDeposit } from "@/lib/bookings.functions";

export type BookingRow = {
  id: string;
  scheduled_at: string;
  duration_minutes: number;
  status: string;
  deposit_amount?: number | null;
  deposit_paid?: boolean | null;
  customers: { full_name?: string; phone?: string } | null;
  devices: { name?: string; type?: string } | null;
};

function useCountdown(endMs: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const diff = Math.max(0, endMs - now);
  const past = endMs - now < 0;
  const mins = Math.floor(diff / 60000);
  const secs = Math.floor((diff % 60000) / 1000);
  return { label: `${mins}:${String(secs).padStart(2, "0")}`, past, diffMs: endMs - now };
}

export function BookingDetailDialog({ booking, open, onOpenChange, cafeId }: { booking: BookingRow | null; open: boolean; onOpenChange: (o: boolean) => void; cafeId?: string }) {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ["bookings", cafeId] });

  const setStatus = useServerFn(updateBookingStatus);
  const cxlRef = useServerFn(cancelBookingWithRefund);
  const refDep = useServerFn(refundBookingDeposit);
  const extend = useServerFn(extendBooking);
  const endEarly = useServerFn(endBookingEarly);
  const payDep = useServerFn(payBookingDeposit);
  const markDep = useServerFn(markBookingDeposit);

  const setM = useMutation({ mutationFn: setStatus, onSuccess: () => { refresh(); toast.success("Updated"); } });
  const cxlM = useMutation({ mutationFn: cxlRef, onSuccess: () => { refresh(); toast.success("Cancelled + refunded"); onOpenChange(false); }, onError: (e) => toast.error(e instanceof Error ? e.message : "Failed") });
  const refM = useMutation({ mutationFn: refDep, onSuccess: () => { refresh(); toast.success("Deposit refunded"); }, onError: (e) => toast.error(e instanceof Error ? e.message : "Failed") });
  const extM = useMutation({ mutationFn: extend, onSuccess: (r) => { refresh(); toast.success(`Extended to ${r.duration_minutes}m`); }, onError: (e) => toast.error(e instanceof Error ? e.message : "Failed") });
  const endM = useMutation({ mutationFn: endEarly, onSuccess: () => { refresh(); toast.success("Ended"); onOpenChange(false); }, onError: (e) => toast.error(e instanceof Error ? e.message : "Failed") });
  const payM = useMutation({ mutationFn: payDep, onSuccess: () => { refresh(); toast.success("Paid from wallet"); }, onError: (e) => toast.error(e instanceof Error ? e.message : "Failed") });
  const depM = useMutation({ mutationFn: markDep, onSuccess: () => { refresh(); toast.success("Deposit updated"); }, onError: (e) => toast.error(e instanceof Error ? e.message : "Failed") });

  const endMs = booking ? new Date(booking.scheduled_at).getTime() + booking.duration_minutes * 60000 : 0;
  const cd = useCountdown(endMs);

  // 5-min-to-end toast
  useEffect(() => {
    if (!booking || !open) return;
    if (booking.status !== "confirmed" && booking.status !== "pending") return;
    if (cd.diffMs > 0 && cd.diffMs < 60_000 * 5 && cd.diffMs > 60_000 * 4.9) {
      toast.warning(`${booking.customers?.full_name ?? "Booking"} ends in 5 minutes`);
    }
    if (cd.diffMs <= 0 && cd.diffMs > -1500) {
      toast.error(`${booking.customers?.full_name ?? "Booking"} time is up`);
    }
  }, [cd.diffMs, booking, open]);

  if (!booking) return null;
  const b = booking;
  const active = b.status === "confirmed" || b.status === "pending";
  const dep = { amount: b.deposit_amount ?? 0, paid: !!b.deposit_paid };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-2">
            <span>Booking detail</span>
            <Badge variant={b.status === "confirmed" ? "default" : b.status === "cancelled" || b.status === "no_show" ? "destructive" : b.status === "completed" ? "secondary" : "outline"}>{b.status}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-xl border border-border/60 bg-card/40 p-3">
            <div className="flex items-center gap-2 text-sm"><User className="h-4 w-4 text-azure" /> <span className="font-medium">{b.customers?.full_name ?? "—"}</span></div>
            {b.customers?.phone && (
              <a href={`tel:${b.customers.phone}`} className="mt-1 flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"><Phone className="h-3 w-3" /> {b.customers.phone}</a>
            )}
            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"><Cpu className="h-3 w-3" /> {b.devices?.name ?? "—"} · {b.devices?.type ?? ""}</div>
          </div>

          <div className="rounded-xl border border-border/60 bg-card/40 p-3">
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Session</div>
            <div className="mt-1 text-sm">
              {new Date(b.scheduled_at).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })} · {b.duration_minutes} min
            </div>
            {active && (
              <div className="mt-2 flex items-center gap-2">
                <Clock className={`h-4 w-4 ${cd.past ? "text-rose-400" : cd.diffMs < 5 * 60000 ? "text-amber-400" : "text-emerald-400"}`} />
                <span className={`font-mono text-lg font-bold ${cd.past ? "text-rose-400" : cd.diffMs < 5 * 60000 ? "text-amber-400" : "text-emerald-400"}`}>
                  {cd.past ? `−${cd.label}` : cd.label}
                </span>
                <span className="text-xs text-muted-foreground">{cd.past ? "past end" : "remaining"}</span>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border/60 bg-card/40 p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5"><IndianRupee className="h-3.5 w-3.5" /> Deposit</span>
              <span className="font-mono">₹{dep.amount} · {dep.paid ? <span className="text-emerald-400">paid</span> : <span className="text-amber-400">pending</span>}</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => {
                const v = prompt("Deposit amount (₹):", String(dep.amount));
                if (v === null) return;
                const amt = Math.max(0, Number(v) || 0);
                const paid = amt > 0 && confirm("Mark already paid (cash)? Cancel = deduct from wallet.");
                if (amt > 0 && !paid) payM.mutate({ data: { id: b.id, amount: amt } });
                else depM.mutate({ data: { id: b.id, deposit_amount: amt, deposit_paid: paid } });
              }}>Set deposit</Button>
              {dep.paid && <Button size="sm" variant="ghost" className="h-8 gap-1 text-xs text-emerald-400" onClick={() => { if (confirm("Refund deposit to wallet?")) refM.mutate({ data: { id: b.id } }); }}><Wallet className="h-3 w-3" /> Refund</Button>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {b.status === "pending" && (
              <>
                <Button size="sm" className="gap-1" onClick={() => setM.mutate({ data: { id: b.id, status: "confirmed" } })}><Check className="h-4 w-4" /> Confirm</Button>
                <Button size="sm" variant="destructive" className="gap-1" onClick={() => setM.mutate({ data: { id: b.id, status: "cancelled" } })}><X className="h-4 w-4" /> Reject</Button>
              </>
            )}
            {active && (
              <>
                <Button size="sm" variant="outline" className="gap-1" onClick={() => extM.mutate({ data: { id: b.id, add_minutes: 15 } })}><Plus className="h-4 w-4" /> +15 min</Button>
                <Button size="sm" variant="outline" className="gap-1" onClick={() => extM.mutate({ data: { id: b.id, add_minutes: 30 } })}><Plus className="h-4 w-4" /> +30 min</Button>
                <Button size="sm" variant="outline" className="gap-1" onClick={() => { if (confirm("End session now?")) endM.mutate({ data: { id: b.id } }); }}><StopCircle className="h-4 w-4" /> End early</Button>
                <Button size="sm" variant="outline" className="gap-1 text-amber-400" onClick={() => { if (confirm("Mark as no-show?")) setM.mutate({ data: { id: b.id, status: "no_show" } }); }}><UserX className="h-4 w-4" /> No-show</Button>
                <Button size="sm" variant="destructive" className="col-span-2 gap-1" onClick={() => { if (confirm("Cancel & refund deposit?")) cxlM.mutate({ data: { id: b.id } }); }}><Undo2 className="h-4 w-4" /> Cancel & refund</Button>
              </>
            )}
            {b.status === "no_show" && (
              <Button size="sm" variant="destructive" className="col-span-2 gap-1" onClick={() => { if (confirm("Delete this no-show?")) setM.mutate({ data: { id: b.id, status: "cancelled" } }); }}><X className="h-4 w-4" /> Delete no-show</Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
