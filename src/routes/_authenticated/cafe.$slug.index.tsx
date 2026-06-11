import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import {
  Gamepad2, Play, Square, Plus, Filter, Activity, Sparkles, Lock, Pause, Wrench, Check, UserPlus, Zap,
} from "lucide-react";
import { getCafeBySlug } from "@/lib/cafes.functions";
import { listDevices, setDeviceStatus, type DeviceStatus } from "@/lib/devices.functions";
import { listSessions, startSession, endSession } from "@/lib/sessions.functions";
import { listCustomers, createCustomer } from "@/lib/customers.functions";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/EmptyState";
import { SessionTimer } from "@/components/SessionTimer";
import { StationPod, SuspendCountdown } from "@/components/StationPod";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/cafe/$slug/")({
  component: LiveFloor,
});

const FILTERS: { id: "all" | DeviceStatus; label: string }[] = [
  { id: "all", label: "All" },
  { id: "available", label: "Available" },
  { id: "in_use", label: "Live" },
  { id: "reserved", label: "Reserved" },
  { id: "suspended", label: "Suspended" },
  { id: "maintenance", label: "Maintenance" },
];

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
  const setStatus = useServerFn(setDeviceStatus);
  const addCust = useServerFn(createCustomer);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["devices", cafeId] });
    qc.invalidateQueries({ queryKey: ["sessions", cafeId] });
  };

  const startM = useMutation({
    mutationFn: start,
    onSuccess: () => { toast.success("Session started"); invalidate(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const endM = useMutation({
    mutationFn: end,
    onSuccess: (r) => { toast.success(`Session ended · ${r.minutes}m · ₹${r.amount}`); invalidate(); },
  });
  const statusM = useMutation({
    mutationFn: setStatus,
    onSuccess: () => { toast.success("Station updated"); invalidate(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const [picker, setPicker] = useState<null | { deviceId: string }>(null);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [walkInOpen, setWalkInOpen] = useState(false);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");

  const devices = devicesQ.data ?? [];
  const sessions = sessionsQ.data ?? [];
  const customers = customersQ.data ?? [];
  const activeByDevice = useMemo(
    () => new Map(sessions.filter((s) => s.status === "active").map((s) => [s.device_id, s])),
    [sessions],
  );

  const counts = useMemo(() => {
    const c: Record<DeviceStatus, number> = { available: 0, in_use: 0, reserved: 0, suspended: 0, maintenance: 0 };
    for (const d of devices) {
      const s = (d.status as DeviceStatus) ?? "available";
      if (c[s] !== undefined) c[s] += 1;
    }
    return c;
  }, [devices]);

  const revenueToday = sessions
    .filter((s) => s.ended_at && new Date(s.ended_at).toDateString() === new Date().toDateString())
    .reduce((sum, s) => sum + (s.amount ?? 0), 0);

  const filteredDevices = filter === "all" ? devices : devices.filter((d) => d.status === filter);

  if (!cafeId) return <div className="h-40 animate-pulse rounded-2xl border border-border/40 bg-card/30" />;

  return (
    <div className="space-y-6">
      {/* Hero strip — floor pulse */}
      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl border border-border/60 bg-card/40 p-5 backdrop-blur-xl"
      >
        <div className="pointer-events-none absolute -left-12 -top-12 h-56 w-56 rounded-full bg-violet/30 blur-3xl animate-pulse-soft" />
        <div className="pointer-events-none absolute -right-10 bottom-[-3rem] h-56 w-56 rounded-full bg-azure/30 blur-3xl animate-pulse-soft" />
        <div className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
            maskImage: "radial-gradient(ellipse at 50% 0%, black 30%, transparent 80%)",
          }}
        />
        <div className="relative grid gap-4 sm:grid-cols-4">
          <FloorStat tone="#22d3a8" label="Available" value={counts.available} icon={Sparkles} />
          <FloorStat tone="#ef4fb6" label="Live now"  value={counts.in_use} icon={Activity} pulse />
          <FloorStat tone="#f5b042" label="Reserved"  value={counts.reserved} icon={Lock} />
          <FloorStat tone="#94a3b8" label="Today"     value={revenueToday} icon={Activity} prefix="₹" />
        </div>

        {/* Walk-in mega-CTA */}
        <div className="relative mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-background/30 p-3 backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-magenta to-rose text-primary-foreground shadow-magenta">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <div className="font-display text-sm font-bold leading-tight">Customer walked in?</div>
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                Capture them &amp; allot a station in one tap
              </div>
            </div>
          </div>
          <Button
            onClick={() => setWalkInOpen(true)}
            disabled={counts.available === 0}
            className="gap-1.5 text-primary-foreground glow-magenta"
            style={{ background: "var(--gradient-brand-hot)" }}
          >
            <UserPlus className="h-4 w-4" />
            {counts.available === 0 ? "No stations free" : "New walk-in"}
          </Button>
        </div>
      </motion.div>



      {/* Filter ribbon */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 rounded-xl border border-border/60 bg-card/40 px-2 py-1.5 backdrop-blur">
          <Filter className="ml-1 h-3.5 w-3.5 text-muted-foreground" />
          {FILTERS.map((f) => {
            const n = f.id === "all" ? devices.length : counts[f.id as DeviceStatus];
            const active = filter === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`group relative rounded-lg px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.18em] transition ${
                  active ? "bg-background/80 text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {f.label} <span className="ml-1 opacity-60">{n}</span>
                {active && (
                  <motion.span layoutId="filter-dot" className="absolute -bottom-0.5 left-2 right-2 h-px bg-primary" />
                )}
              </button>
            );
          })}
        </div>
        <div className="ml-auto font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          Right-click or tap a station to control →
        </div>
      </div>

      {/* Floor */}
      {devices.length === 0 ? (
        <EmptyState
          icon={Gamepad2}
          title="No stations yet"
          description="Head to Devices to add your first PC, console, or VR rig."
        />
      ) : (
        <div
          className="relative rounded-3xl border border-border/60 bg-[radial-gradient(120%_80%_at_50%_-10%,oklch(0.18_0.05_285)_0%,oklch(0.08_0.02_285)_60%)] p-5"
        >
          {/* Floor lines */}
          <div
            className="pointer-events-none absolute inset-0 rounded-3xl opacity-50"
            style={{
              backgroundImage:
                "linear-gradient(rgba(167,139,250,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(125,211,252,0.08) 1px, transparent 1px)",
              backgroundSize: "44px 44px",
              maskImage: "radial-gradient(ellipse 80% 65% at 50% 50%, black 50%, transparent 100%)",
            }}
            aria-hidden
          />
          <div className="relative grid gap-5 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
            {filteredDevices.map((d, i) => {
              const status = (d.status as DeviceStatus) ?? "available";
              const active = activeByDevice.get(d.id);
              const caption =
                status === "suspended" && d.suspend_until
                  ? <SuspendCountdown until={d.suspend_until} />
                  : status === "in_use" && active
                  ? (active.customers as { full_name?: string } | null)?.full_name ?? "Walk-in"
                  : null;

              const overlay = status === "in_use" && active
                ? (
                  <div className="space-y-2 rounded-md border border-border/40 bg-background/30 p-2">
                    <SessionTimer startedAt={active.started_at} hourlyRate={d.hourly_rate} />
                    <Button
                      size="sm" variant="outline" className="w-full gap-1.5 h-7"
                      onClick={(e) => { e.stopPropagation(); endM.mutate({ data: { id: active.id } }); }}
                      disabled={endM.isPending}
                    ><Square className="h-3 w-3" /> End</Button>
                  </div>
                ) : null;

              return (
                <DropdownMenu key={d.id}>
                  <DropdownMenuTrigger asChild>
                    <div>
                      <StationPod
                        index={i}
                        name={d.name}
                        type={d.type as "pc" | "console" | "vr" | "racing" | "other"}
                        status={status}
                        hourlyRate={d.hourly_rate}
                        caption={caption ?? undefined}
                        overlay={overlay}
                        accent={(d as { zone_color?: string | null }).zone_color}
                      />
                    </div>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="center" className="w-56">
                    <DropdownMenuLabel className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                      {d.name}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {status !== "in_use" && status !== "maintenance" && (
                      <DropdownMenuItem onClick={() => setPicker({ deviceId: d.id })}>
                        <Play className="mr-2 h-3.5 w-3.5 text-primary" /> Start session
                      </DropdownMenuItem>
                    )}
                    {status === "in_use" && active && (
                      <DropdownMenuItem onClick={() => endM.mutate({ data: { id: active.id } })}>
                        <Square className="mr-2 h-3.5 w-3.5 text-magenta" /> End session
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => statusM.mutate({ data: { id: d.id, status: "reserved" } })}>
                      <Lock className="mr-2 h-3.5 w-3.5 text-amber-400" /> Mark reserved
                    </DropdownMenuItem>
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>
                        <Pause className="mr-2 h-3.5 w-3.5 text-slate-300" /> Suspend for…
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent>
                        {[15, 30, 60, 120].map((m) => (
                          <DropdownMenuItem
                            key={m}
                            onClick={() => statusM.mutate({ data: { id: d.id, status: "suspended", suspend_minutes: m } })}
                          >
                            {m} minutes
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    <DropdownMenuItem onClick={() => statusM.mutate({ data: { id: d.id, status: "maintenance" } })}>
                      <Wrench className="mr-2 h-3.5 w-3.5 text-rose-400" /> Maintenance
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => statusM.mutate({ data: { id: d.id, status: "available" } })}>
                      <Check className="mr-2 h-3.5 w-3.5 text-emerald-400" /> Mark available
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              );
            })}
          </div>
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

      {/* Walk-in — capture customer + assign device in one go */}
      <Dialog open={walkInOpen} onOpenChange={setWalkInOpen}>
        <DialogContent className="overflow-hidden p-0 sm:max-w-lg">
          <div className="relative bg-gradient-to-br from-magenta/20 via-card to-rose/15 p-5">
            <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-magenta/30 blur-3xl" />
            <div className="relative flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-magenta to-rose text-primary-foreground shadow-magenta">
                <Zap className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="font-display text-lg">Walk-in customer</DialogTitle>
                <p className="text-xs text-muted-foreground">
                  {counts.available} station{counts.available === 1 ? "" : "s"} free right now.
                </p>
              </div>
            </div>
          </div>
          <form
            className="space-y-3 p-5"
            onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const fullName = String(fd.get("full_name") || "").trim();
              const phone = String(fd.get("phone") || "").trim();
              const deviceId = String(fd.get("device_id") || "");
              const skipCustomer = !fullName && !phone;
              try {
                let customerId: string | undefined;
                if (!skipCustomer) {
                  const cust = await addCust({
                    data: { cafe_id: cafeId, full_name: fullName || "Walk-in", phone: phone || null, email: null },
                  });
                  customerId = cust?.id;
                  qc.invalidateQueries({ queryKey: ["customers", cafeId] });
                }
                startM.mutate({ data: { cafe_id: cafeId, device_id: deviceId, customer_id: customerId } });
                setWalkInOpen(false);
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Failed");
              }
            }}
          >
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Name <span className="opacity-60">(optional)</span></Label>
                <Input name="full_name" placeholder="Walk-in" autoFocus />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Phone <span className="opacity-60">(optional)</span></Label>
                <Input name="phone" type="tel" inputMode="tel" placeholder="+91…" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Allot a station</Label>
              <select
                name="device_id"
                required
                defaultValue={devices.find((d) => d.status === "available")?.id ?? ""}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="" disabled>Choose…</option>
                {devices.filter((d) => d.status === "available").map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} · {d.type.toUpperCase()} · ₹{d.hourly_rate}/hr
                  </option>
                ))}
              </select>
              {counts.available === 0 && (
                <p className="text-xs text-destructive">No free stations. End a session first.</p>
              )}
            </div>
            <DialogFooter className="pt-2">
              <Button
                type="submit"
                disabled={counts.available === 0 || startM.isPending}
                className="gap-1.5 text-primary-foreground glow-magenta"
                style={{ background: "var(--gradient-brand-hot)" }}
              >
                <Play className="h-4 w-4" /> Seat &amp; start session
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}


function FloorStat({
  tone, label, value, icon: Icon, pulse, prefix,
}: { tone: string; label: string; value: number; icon: typeof Activity; pulse?: boolean; prefix?: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/5 bg-background/30 p-4 backdrop-blur">
      <div
        className="absolute -right-6 -top-6 h-20 w-20 rounded-full blur-2xl opacity-60"
        style={{ background: tone }}
      />
      <div className="relative flex items-center justify-between">
        <div
          className="grid h-8 w-8 place-items-center rounded-lg border border-white/10"
          style={{ background: `${tone}22` }}
        >
          <Icon className="h-4 w-4" style={{ color: tone }} />
        </div>
        {pulse && (
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" style={{ background: tone }} />
            <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: tone }} />
          </span>
        )}
      </div>
      <div className="relative mt-3 font-display text-3xl font-extrabold tabular-nums">
        {prefix}{value}
      </div>
      <div className="relative mt-0.5 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
        {label}
      </div>
    </div>
  );
}
