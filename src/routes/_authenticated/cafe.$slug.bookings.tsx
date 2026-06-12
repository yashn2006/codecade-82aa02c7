import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarRange, Plus, Check, X, UserX, IndianRupee, Wallet, Undo2 } from "lucide-react";
import { useState } from "react";
import { getCafeBySlug } from "@/lib/cafes.functions";
import { listBookings, updateBookingStatus, createBookingForCustomer, markBookingDeposit, payBookingDeposit, refundBookingDeposit, cancelBookingWithRefund } from "@/lib/bookings.functions";
import { listDevices } from "@/lib/devices.functions";
import { listCustomers } from "@/lib/customers.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/EmptyState";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";

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

  const q = useQuery({
    queryKey: ["bookings", cafeId],
    queryFn: () => list({ data: { cafe_id: cafeId! } }),
    enabled: !!cafeId,
  });
  const devicesQ = useQuery({ queryKey: ["devices", cafeId], queryFn: () => lDev({ data: { cafe_id: cafeId! } }), enabled: !!cafeId });
  const customersQ = useQuery({ queryKey: ["customers", cafeId], queryFn: () => lCus({ data: { cafe_id: cafeId! } }), enabled: !!cafeId });

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
  const [view, setView] = useState<"list" | "calendar">("list");

  if (!cafeId) return <div className="h-40 animate-pulse rounded-2xl border border-border/40 bg-card/30" />;

  const groups = new Map<string, typeof q.data>();
  (q.data ?? []).forEach((b) => {
    const day = new Date(b.scheduled_at).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
    const arr = groups.get(day) ?? [];
    arr.push(b);
    groups.set(day, arr);
  });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-muted-foreground">{q.data?.length ?? 0} bookings</div>
        <div className="flex items-center gap-2">
          <div className="flex overflow-hidden rounded-md border border-border">
            <button onClick={() => setView("list")} className={`px-3 py-1 text-xs ${view === "list" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"}`}>List</button>
            <button onClick={() => setView("calendar")} className={`px-3 py-1 text-xs ${view === "calendar" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"}`}>Calendar</button>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2" style={{ background: "var(--gradient-brand-hot)" }}>
                <Plus className="h-4 w-4" /> New booking
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create booking</DialogTitle></DialogHeader>
              <form onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                createM.mutate({ data: {
                  cafe_id: cafeId,
                  device_id: String(fd.get("device_id")),
                  customer_id: String(fd.get("customer_id")),
                  scheduled_at: new Date(String(fd.get("scheduled_at"))).toISOString(),
                  duration_minutes: Number(fd.get("duration_minutes")),
                } });
              }} className="space-y-3">
                <div className="space-y-1">
                  <Label>Customer</Label>
                  <select name="customer_id" required className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                    <option value="">Select…</option>
                    {(customersQ.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>Device</Label>
                  <select name="device_id" required className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                    <option value="">Select…</option>
                    {(devicesQ.data ?? []).map((d) => <option key={d.id} value={d.id}>{d.name} · {d.type}</option>)}
                  </select>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1"><Label>Date &amp; time</Label><Input name="scheduled_at" type="datetime-local" required /></div>
                  <div className="space-y-1"><Label>Duration (min)</Label><Input name="duration_minutes" type="number" defaultValue={60} required /></div>
                </div>
                <DialogFooter><Button type="submit" style={{ background: "var(--gradient-brand-hot)" }}>Create</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {view === "calendar" ? (
        <CalendarView bookings={q.data ?? []} />
      ) : (
        <div className="mt-4 space-y-6">
          {q.isLoading ? (
            <div className="h-40 animate-pulse rounded-2xl border border-border/40 bg-card/30" />
          ) : (q.data?.length ?? 0) === 0 ? (
            <EmptyState icon={CalendarRange} title="No bookings yet" description="Customers will book here, or create one manually." />
          ) : Array.from(groups.entries()).map(([day, items]) => (
            <div key={day}>
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{day}</div>
              <div className="mt-2 space-y-2">
                {(items ?? []).map((b) => {
                  const dep = (b as { deposit_amount?: number; deposit_paid?: boolean });
                  return (
                    <div key={b.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card/40 p-4 backdrop-blur">
                      <div>
                        <div className="font-mono text-xs text-azure">
                          {new Date(b.scheduled_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} · {b.duration_minutes}m
                        </div>
                        <div className="mt-0.5 font-medium">
                          {(b.customers as { full_name?: string } | null)?.full_name ?? "—"} on {(b.devices as { name?: string } | null)?.name ?? "—"}
                        </div>
                        {(dep.deposit_amount ?? 0) > 0 && (
                          <Badge variant={dep.deposit_paid ? "default" : "outline"} className="mt-1 text-[10px]">
                            <IndianRupee className="mr-0.5 h-2.5 w-2.5" />{dep.deposit_amount} deposit · {dep.deposit_paid ? "paid" : "pending"}
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={b.status === "confirmed" ? "default" : b.status === "cancelled" || b.status === "no_show" ? "destructive" : "secondary"}>{b.status}</Badge>
                        {b.status === "pending" && (
                          <>
                            <Button size="icon" variant="ghost" title="Confirm" onClick={() => setM.mutate({ data: { id: b.id, status: "confirmed" } })}><Check className="h-4 w-4 text-emerald-400" /></Button>
                            <Button size="icon" variant="ghost" title="Cancel" onClick={() => setM.mutate({ data: { id: b.id, status: "cancelled" } })}><X className="h-4 w-4 text-destructive" /></Button>
                          </>
                        )}
                        {(b.status === "confirmed" || b.status === "pending") && (
                          <>
                            <Button size="icon" variant="ghost" title="Mark no-show" onClick={() => { if (confirm("Mark as no-show?")) setM.mutate({ data: { id: b.id, status: "no_show" } }); }}>
                              <UserX className="h-4 w-4 text-amber-400" />
                            </Button>
                            <Button size="icon" variant="ghost" title="Cancel & refund" onClick={() => { if (confirm("Cancel booking and refund deposit?")) cxlM.mutate({ data: { id: b.id } }); }}>
                              <Undo2 className="h-4 w-4 text-rose-400" />
                            </Button>
                          </>
                        )}
                        <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={() => {
                          const v = prompt("Deposit amount (₹):", String(dep.deposit_amount ?? 0));
                          if (v === null) return;
                          const amount = Math.max(0, Number(v) || 0);
                          const paid = amount > 0 && confirm("Mark already paid (cash)? Cancel = deduct from wallet.");
                          if (amount > 0 && !paid) {
                            payM.mutate({ data: { id: b.id, amount } });
                          } else {
                            depositM.mutate({ data: { id: b.id, deposit_amount: amount, deposit_paid: paid } });
                          }
                        }}>
                          <IndianRupee className="h-3 w-3" /> Deposit
                        </Button>
                        {dep.deposit_paid && (
                          <Button size="sm" variant="ghost" className="h-8 gap-1 text-xs text-emerald-400" onClick={() => { if (confirm("Refund deposit to wallet?")) refM.mutate({ data: { id: b.id } }); }}>
                            <Wallet className="h-3 w-3" /> Refund
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

type AnyBooking = { id: string; scheduled_at: string; duration_minutes: number; status: string; customers: unknown; devices: unknown };
function CalendarView({ bookings }: { bookings: AnyBooking[] }) {
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today); d.setDate(today.getDate() + i); d.setHours(0, 0, 0, 0); return d;
  });
  return (
    <div className="mt-4 overflow-x-auto">
      <div className="grid min-w-[700px] grid-cols-7 gap-2">
        {days.map((d) => {
          const dayBookings = bookings.filter((b) => {
            const bd = new Date(b.scheduled_at); return bd.toDateString() === d.toDateString();
          }).sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
          const isToday = d.toDateString() === new Date().toDateString();
          return (
            <div key={d.toISOString()} className={`rounded-xl border ${isToday ? "border-primary/60 bg-primary/5" : "border-border/60 bg-card/30"} p-2 backdrop-blur min-h-[200px]`}>
              <div className="mb-2 text-center">
                <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">{d.toLocaleDateString("en-IN", { weekday: "short" })}</div>
                <div className={`font-display text-lg font-bold ${isToday ? "text-primary" : ""}`}>{d.getDate()}</div>
              </div>
              <div className="space-y-1">
                {dayBookings.length === 0 ? (
                  <div className="text-center text-[10px] text-muted-foreground/60">—</div>
                ) : dayBookings.map((b) => (
                  <div key={b.id} className={`rounded-md border p-1.5 text-[10px] ${b.status === "no_show" ? "border-amber-400/40 bg-amber-400/10" : b.status === "cancelled" ? "border-destructive/40 bg-destructive/5 opacity-60" : b.status === "confirmed" ? "border-emerald-400/40 bg-emerald-400/10" : "border-border/40"}`}>
                    <div className="font-mono">{new Date(b.scheduled_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</div>
                    <div className="truncate font-medium">{(b.customers as { full_name?: string } | null)?.full_name ?? "—"}</div>
                    <div className="truncate opacity-70">{(b.devices as { name?: string } | null)?.name ?? "—"}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
