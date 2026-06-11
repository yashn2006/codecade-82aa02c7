import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion, AnimatePresence } from "framer-motion";
import { Gamepad2, Play, Square, Wrench, Plus } from "lucide-react";
import { useState } from "react";
import { getCafeBySlug } from "@/lib/cafes.functions";
import { listDevices } from "@/lib/devices.functions";
import { listSessions, startSession, endSession } from "@/lib/sessions.functions";
import { listCustomers, createCustomer } from "@/lib/customers.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/EmptyState";
import { SessionTimer } from "@/components/SessionTimer";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/cafe/$slug/")({
  component: LiveFloor,
});

function LiveFloor() {
  const { slug } = Route.useParams();
  const getCafe = useServerFn(getCafeBySlug);
  const { data: cafe } = useQuery({ queryKey: ["cafe", slug], queryFn: () => getCafe({ data: { slug } }) });
  const cafeId = cafe?.id;

  const lDev = useServerFn(listDevices);
  const lSes = useServerFn(listSessions);
  const lCus = useServerFn(listCustomers);

  const devicesQ = useQuery({
    queryKey: ["devices", cafeId],
    queryFn: () => lDev({ data: { cafe_id: cafeId! } }),
    enabled: !!cafeId,
    refetchInterval: 5000,
  });
  const sessionsQ = useQuery({
    queryKey: ["sessions", cafeId],
    queryFn: () => lSes({ data: { cafe_id: cafeId! } }),
    enabled: !!cafeId,
    refetchInterval: 5000,
  });
  const customersQ = useQuery({
    queryKey: ["customers", cafeId],
    queryFn: () => lCus({ data: { cafe_id: cafeId! } }),
    enabled: !!cafeId,
  });

  const qc = useQueryClient();
  const start = useServerFn(startSession);
  const end = useServerFn(endSession);
  const addCust = useServerFn(createCustomer);

  const startM = useMutation({
    mutationFn: start,
    onSuccess: () => {
      toast.success("Session started");
      qc.invalidateQueries({ queryKey: ["devices", cafeId] });
      qc.invalidateQueries({ queryKey: ["sessions", cafeId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const endM = useMutation({
    mutationFn: end,
    onSuccess: (r) => {
      toast.success(`Session ended · ${r.minutes}m · ₹${r.amount}`);
      qc.invalidateQueries({ queryKey: ["devices", cafeId] });
      qc.invalidateQueries({ queryKey: ["sessions", cafeId] });
    },
  });

  const [picker, setPicker] = useState<null | { deviceId: string }>(null);
  const [quickAddOpen, setQuickAddOpen] = useState(false);

  if (!cafeId) {
    return <div className="h-40 animate-pulse rounded-2xl border border-border/40 bg-card/30" />;
  }

  const devices = devicesQ.data ?? [];
  const sessions = sessionsQ.data ?? [];
  const customers = customersQ.data ?? [];
  const activeByDevice = new Map(sessions.filter((s) => s.status === "active").map((s) => [s.device_id, s]));
  const activeCount = activeByDevice.size;
  const revenueToday = sessions
    .filter((s) => s.ended_at && new Date(s.ended_at).toDateString() === new Date().toDateString())
    .reduce((sum, s) => sum + (s.amount ?? 0), 0);

  const accents = ["violet", "azure", "magenta"] as const;

  return (
    <div className="space-y-6">
      {/* Stat strip */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Devices" value={devices.length} accent="violet" />
        <Stat label="Active sessions" value={activeCount} accent="magenta" hint="Live" />
        <Stat label="Revenue today" value={`₹${revenueToday}`} accent="azure" />
      </div>

      {/* Device grid */}
      {devices.length === 0 ? (
        <EmptyState
          icon={Gamepad2}
          title="No devices yet"
          description="Head to Devices to add your first PC, console, or VR rig."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {devices.map((d, i) => {
            const active = activeByDevice.get(d.id);
            const accent = accents[i % 3];
            const isBusy = d.status === "in_use" || !!active;
            return (
              <motion.div
                key={d.id}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                className={`relative overflow-hidden rounded-2xl border bg-card/50 p-5 backdrop-blur transition ${
                  isBusy ? "border-magenta/50" : "border-border/60 hover:border-primary/40"
                }`}
              >
                <div
                  className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full blur-2xl opacity-50"
                  style={{ background: `oklch(var(--${isBusy ? "magenta" : accent}) / 0.5)` }}
                />
                <div className="relative flex items-start justify-between">
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{d.type}</div>
                    <h3 className="mt-1 font-display text-lg font-bold">{d.name}</h3>
                    <div className="mt-0.5 font-mono text-xs text-azure">₹{d.hourly_rate}/hr</div>
                  </div>
                  <StatusBadge status={d.status} />
                </div>

                <div className="relative mt-4">
                  <AnimatePresence mode="wait">
                    {active ? (
                      <motion.div key="active" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                        <div className="text-xs text-muted-foreground">
                          {(active.customers as { full_name?: string } | null)?.full_name ?? "Walk-in"}
                        </div>
                        <SessionTimer startedAt={active.started_at} hourlyRate={d.hourly_rate} />
                        <Button
                          size="sm" variant="outline" className="w-full gap-1.5"
                          onClick={() => endM.mutate({ data: { id: active.id } })}
                          disabled={endM.isPending}
                        ><Square className="h-3.5 w-3.5" /> End session</Button>
                      </motion.div>
                    ) : d.status === "maintenance" ? (
                      <div className="text-xs text-muted-foreground">Under maintenance</div>
                    ) : (
                      <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                        <Button
                          size="sm" className="w-full gap-1.5"
                          style={{ background: "var(--gradient-brand-hot)" }}
                          onClick={() => setPicker({ deviceId: d.id })}
                        ><Play className="h-3.5 w-3.5" /> Start session</Button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Customer picker */}
      <Dialog open={!!picker} onOpenChange={(v) => !v && setPicker(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Start session</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Button
              variant="outline" className="w-full justify-start"
              onClick={() => {
                if (!picker) return;
                startM.mutate({ data: { cafe_id: cafeId, device_id: picker.deviceId } });
                setPicker(null);
              }}
            >Walk-in (no customer)</Button>
            <div className="max-h-64 overflow-y-auto rounded-xl border border-border/40">
              {customers.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">No customers yet</div>
              ) : customers.map((c) => (
                <button
                  key={c.id}
                  className="flex w-full items-center justify-between border-b border-border/40 px-3 py-2 text-left text-sm last:border-0 hover:bg-background/40"
                  onClick={() => {
                    if (!picker) return;
                    startM.mutate({ data: { cafe_id: cafeId, device_id: picker.deviceId, customer_id: c.id } });
                    setPicker(null);
                  }}
                >
                  <span>{c.full_name}</span>
                  <span className="font-mono text-xs text-muted-foreground">{c.phone}</span>
                </button>
              ))}
            </div>
            <Button variant="ghost" className="w-full gap-1.5" onClick={() => { setPicker(null); setQuickAddOpen(true); }}>
              <Plus className="h-3.5 w-3.5" /> Quick-add customer
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={quickAddOpen} onOpenChange={setQuickAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Add customer</DialogTitle></DialogHeader>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              try {
                await addCust({ data: { cafe_id: cafeId, full_name: String(fd.get("full_name")), phone: String(fd.get("phone") || "") || null, email: String(fd.get("email") || "") || null } });
                toast.success("Customer added");
                qc.invalidateQueries({ queryKey: ["customers", cafeId] });
                setQuickAddOpen(false);
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Failed");
              }
            }}
            className="space-y-3"
          >
            <div className="space-y-1"><Label>Name</Label><Input name="full_name" required /></div>
            <div className="space-y-1"><Label>Phone</Label><Input name="phone" /></div>
            <div className="space-y-1"><Label>Email</Label><Input name="email" type="email" /></div>
            <DialogFooter><Button type="submit" style={{ background: "var(--gradient-brand-hot)" }}>Add</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ label, value, accent, hint }: { label: string; value: number | string; accent: "violet" | "azure" | "magenta"; hint?: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/40 p-5 backdrop-blur">
      <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full blur-2xl opacity-50" style={{ background: `oklch(var(--${accent}) / 0.5)` }} />
      <div className="relative flex items-baseline justify-between">
        <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
        {hint && <span className="font-mono text-[10px] text-magenta">{hint}</span>}
      </div>
      <div className="relative mt-2 font-display text-3xl font-extrabold">{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { variant: "default" | "secondary" | "outline" | "destructive"; label: string }> = {
    available: { variant: "outline", label: "Free" },
    in_use: { variant: "default", label: "In use" },
    maintenance: { variant: "secondary", label: <Wrench className="h-3 w-3 inline" /> as unknown as string },
  };
  const s = map[status] ?? map.available;
  return <Badge variant={s.variant}>{s.label}</Badge>;
}
