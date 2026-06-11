import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarRange, Plus, Check, X } from "lucide-react";
import { useState } from "react";
import { getCafeBySlug } from "@/lib/cafes.functions";
import { listBookings, updateBookingStatus, createBookingForCustomer } from "@/lib/bookings.functions";
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
  const createM = useMutation({
    mutationFn: create,
    onSuccess: () => { refresh(); toast.success("Booking created"); setOpen(false); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const [open, setOpen] = useState(false);

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
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">{q.data?.length ?? 0} bookings</div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" style={{ background: "var(--gradient-brand-hot)" }}>
              <Plus className="h-4 w-4" /> New booking
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create booking</DialogTitle></DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                createM.mutate({
                  data: {
                    cafe_id: cafeId,
                    device_id: String(fd.get("device_id")),
                    customer_id: String(fd.get("customer_id")),
                    scheduled_at: new Date(String(fd.get("scheduled_at"))).toISOString(),
                    duration_minutes: Number(fd.get("duration_minutes")),
                  },
                });
              }}
              className="space-y-3"
            >
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

      <div className="mt-4 space-y-6">
        {q.isLoading ? (
          <div className="h-40 animate-pulse rounded-2xl border border-border/40 bg-card/30" />
        ) : (q.data?.length ?? 0) === 0 ? (
          <EmptyState icon={CalendarRange} title="No bookings yet" description="Customers will book here, or create one manually." />
        ) : Array.from(groups.entries()).map(([day, items]) => (
          <div key={day}>
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{day}</div>
            <div className="mt-2 space-y-2">
              {(items ?? []).map((b) => (
                <div key={b.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card/40 p-4 backdrop-blur">
                  <div>
                    <div className="font-mono text-xs text-azure">
                      {new Date(b.scheduled_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} · {b.duration_minutes}m
                    </div>
                    <div className="mt-0.5 font-medium">
                      {(b.customers as { full_name?: string } | null)?.full_name ?? "—"} on {(b.devices as { name?: string } | null)?.name ?? "—"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={b.status === "confirmed" ? "default" : b.status === "cancelled" ? "destructive" : "secondary"}>{b.status}</Badge>
                    {b.status === "pending" && (
                      <>
                        <Button size="icon" variant="ghost" onClick={() => setM.mutate({ data: { id: b.id, status: "confirmed" } })}><Check className="h-4 w-4 text-emerald-400" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => setM.mutate({ data: { id: b.id, status: "cancelled" } })}><X className="h-4 w-4 text-destructive" /></Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
