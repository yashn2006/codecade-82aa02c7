import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutGrid, Plus, Trash2, Save, Minus, MoreHorizontal, MapPin, Sparkles, Move,
  MonitorPlay, Gamepad2, Headset, Car, Cpu,
} from "lucide-react";
import { getCafeBySlug } from "@/lib/cafes.functions";
import { updateCafe } from "@/lib/cafes.functions";
import {
  listDevices, createDevice, updateDevice, deleteDevice, placeDevice,
  type DeviceStatus,
} from "@/lib/devices.functions";
import { listBookings } from "@/lib/bookings.functions";
import { BookingDetailDialog, type BookingRow } from "@/components/BookingDetailDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { Skeleton } from "@/components/LoadingSkeleton";
import { StationPod } from "@/components/StationPod";
import { toast } from "sonner";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter,
} from "@/components/ui/sheet";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";


export const Route = createFileRoute("/_authenticated/cafe/$slug/floor")({
  head: () => ({
    meta: [
      { title: "Live Floor — CoreCade" },
      { name: "description", content: "Real-time station status, active sessions and check-ins." },
      { property: "og:title", content: "Live Floor — CoreCade" },
      { property: "og:description", content: "Real-time station status, active sessions and check-ins." },
    ],
  }),
  component: FloorBuilder,
});

const TYPES = ["pc", "console", "vr", "racing", "other"] as const;
const ZONE_COLORS = [
  { name: "Violet",  value: "#a78bfa" },
  { name: "Azure",   value: "#7dd3fc" },
  { name: "Magenta", value: "#ef4fb6" },
  { name: "Amber",   value: "#f5b042" },
  { name: "Emerald", value: "#22d3a8" },
  { name: "Rose",    value: "#f87171" },
];

type Device = {
  id: string; cafe_id: string; name: string; type: string; hourly_rate: number;
  status: string; pos_x: number | null; pos_y: number | null;
  zone: string | null; zone_color: string | null; notes: string | null;
  specs?: Record<string, unknown> | null;
};

function FloorBuilder() {
  const { slug } = Route.useParams();
  const getCafe = useServerFn(getCafeBySlug);
  const cafeQ = useQuery({ queryKey: ["cafe", slug], queryFn: () => getCafe({ data: { slug } }) });
  const cafe = cafeQ.data;

  const list = useServerFn(listDevices);
  const create = useServerFn(createDevice);
  const update = useServerFn(updateDevice);
  const place = useServerFn(placeDevice);
  const del = useServerFn(deleteDevice);
  const upCafe = useServerFn(updateCafe);

  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ["devices", cafe?.id] });

  const devicesQ = useQuery({
    queryKey: ["devices", cafe?.id],
    queryFn: () => list({ data: { cafe_id: cafe!.id } }),
    enabled: !!cafe?.id,
  });

  const placeM = useMutation({
    mutationFn: place,
    onMutate: async (vars: { data: { id: string; pos_x: number | null; pos_y: number | null } } | undefined) => {
      if (!vars) return;
      await qc.cancelQueries({ queryKey: ["devices", cafe?.id] });
      const prev = qc.getQueryData<Device[]>(["devices", cafe?.id]);
      qc.setQueryData<Device[]>(["devices", cafe?.id], (old) =>
        (old ?? []).map((d) => d.id === vars.data.id ? { ...d, pos_x: vars.data.pos_x, pos_y: vars.data.pos_y } : d),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(["devices", cafe?.id], ctx.prev); toast.error("Move failed"); },
    onSuccess: () => refresh(),
  });
  const createM = useMutation({
    mutationFn: create,
    onSuccess: () => { toast.success("Station added"); refresh(); setAdding(null); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const updateM = useMutation({
    mutationFn: update,
    onSuccess: () => { toast.success("Saved"); refresh(); setEditing(null); },
  });
  const delM = useMutation({
    mutationFn: del,
    onSuccess: () => { toast.success("Removed"); refresh(); setEditing(null); },
  });
  const sizeM = useMutation({
    mutationFn: upCafe,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["cafe", slug] }); },
  });

  const [adding, setAdding] = useState<null | { x: number; y: number }>(null);
  const [editing, setEditing] = useState<null | Device>(null);
  const [selectedBooking, setSelectedBooking] = useState<BookingRow | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [hoverCell, setHoverCell] = useState<string | null>(null);

  // Live bookings for this café — used to overlay reserved / live sessions on stations.
  const bookingsFn = useServerFn(listBookings);
  const bookingsQ = useQuery({
    queryKey: ["bookings", cafe?.id],
    queryFn: () => bookingsFn({ data: { cafe_id: cafe!.id } }),
    enabled: !!cafe?.id,
    refetchInterval: 30_000,
  });

  // 1-second ticker so countdowns/overlays refresh live.
  const [nowTs, setNowTs] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  type ActiveInfo = { booking: BookingRow; state: "live" | "reserved"; endMs: number; startMs: number };
  const activeByDevice = useMemo(() => {
    const m = new Map<string, ActiveInfo>();
    const rows = (bookingsQ.data ?? []) as BookingRow[] & { device_id?: string }[];
    for (const b of rows as any[]) {
      if (!b.device_id) continue;
      if (b.status === "cancelled" || b.status === "completed" || b.status === "no_show") continue;
      const startMs = new Date(b.scheduled_at).getTime();
      const endMs = startMs + (b.duration_minutes || 0) * 60_000;
      if (nowTs > endMs) continue; // finished
      // Only surface within 2h of start / until end
      if (startMs - nowTs > 2 * 60 * 60_000) continue;
      const state: "live" | "reserved" = nowTs >= startMs ? "live" : "reserved";
      const prev = m.get(b.device_id);
      // Prefer the currently live one, else the soonest upcoming.
      if (!prev || (state === "live" && prev.state !== "live") || (state === prev.state && startMs < prev.startMs)) {
        m.set(b.device_id, { booking: b as BookingRow, state, endMs, startMs });
      }
    }
    return m;
  }, [bookingsQ.data, nowTs]);

  function fmtCountdown(ms: number) {
    const s = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(s / 60);
    const r = s % 60;
    if (m >= 60) {
      const h = Math.floor(m / 60);
      return `${h}h ${m % 60}m`;
    }
    return `${m}:${String(r).padStart(2, "0")}`;
  }

  const cols = cafe?.floor_cols ?? 10;
  const rows = cafe?.floor_rows ?? 6;


  const cols = cafe?.floor_cols ?? 10;
  const rows = cafe?.floor_rows ?? 6;
  const devices = (devicesQ.data ?? []) as Device[];
  const placed = devices.filter((d) => d.pos_x != null && d.pos_y != null);
  const tray = devices.filter((d) => d.pos_x == null || d.pos_y == null);

  const cellMap = useMemo(() => {
    const m = new Map<string, Device>();
    for (const d of placed) m.set(`${d.pos_x},${d.pos_y}`, d);
    return m;
  }, [placed]);

  const zones = useMemo(() => {
    const z = new Map<string, string>();
    for (const d of devices) if (d.zone) z.set(d.zone, d.zone_color || "#a78bfa");
    return Array.from(z.entries());
  }, [devices]);

  const onCellDrop = (x: number, y: number, e: React.DragEvent) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    if (!id) return;
    if (cellMap.has(`${x},${y}`)) { toast.error("Cell already occupied"); return; }
    placeM.mutate({ data: { id, pos_x: x, pos_y: y } });
    setHoverCell(null);
    setDraggingId(null);
  };

  const sendToTray = (id: string) => placeM.mutate({ data: { id, pos_x: null, pos_y: null } });

  if (cafeQ.isLoading) return <Skeleton className="h-96" />;
  if (cafeQ.isError || !cafe) return <ErrorState description="Could not load this café." onRetry={() => cafeQ.refetch()} />;

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card/40 p-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl border border-border/60 bg-background/50">
            <LayoutGrid className="h-4 w-4 text-primary" />
          </div>
          <div>
            <div className="font-display text-sm font-bold">Floor builder</div>
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              Drag · drop · place · paint your café
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 rounded-xl border border-border/60 bg-background/40 px-2 py-1">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Cols</span>
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => sizeM.mutate({ data: { id: cafe.id, patch: { floor_cols: Math.max(4, cols - 1) } } })}><Minus className="h-3 w-3" /></Button>
            <span className="w-5 text-center font-mono text-xs">{cols}</span>
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => sizeM.mutate({ data: { id: cafe.id, patch: { floor_cols: Math.min(40, cols + 1) } } })}><Plus className="h-3 w-3" /></Button>
          </div>
          <div className="flex items-center gap-1.5 rounded-xl border border-border/60 bg-background/40 px-2 py-1">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Rows</span>
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => sizeM.mutate({ data: { id: cafe.id, patch: { floor_rows: Math.max(3, rows - 1) } } })}><Minus className="h-3 w-3" /></Button>
            <span className="w-5 text-center font-mono text-xs">{rows}</span>
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => sizeM.mutate({ data: { id: cafe.id, patch: { floor_rows: Math.min(30, rows + 1) } } })}><Plus className="h-3 w-3" /></Button>
          </div>
          <Button size="sm" className="gap-1.5" style={{ background: "var(--gradient-brand-hot)" }} onClick={() => setAdding({ x: 0, y: 0 })}>
            <Plus className="h-3.5 w-3.5" /> New station
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_240px]">
        {/* Floor canvas */}
        <div className="relative overflow-auto rounded-3xl border border-border/60 bg-[radial-gradient(120%_80%_at_50%_-10%,oklch(0.18_0.05_285)_0%,oklch(0.07_0.02_285)_60%)] p-4">
          <div
            className="grid"
            style={{
              gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${rows}, minmax(112px, auto))`,
              gap: 12,
            }}
          >
            {Array.from({ length: cols * rows }).map((_, idx) => {
              const x = idx % cols;
              const y = Math.floor(idx / cols);
              const key = `${x},${y}`;
              const dev = cellMap.get(key);
              const hover = hoverCell === key;
              return (
                <div
                  key={key}
                  onDragOver={(e) => { e.preventDefault(); setHoverCell(key); }}
                  onDragLeave={() => setHoverCell((c) => c === key ? null : c)}
                  onDrop={(e) => onCellDrop(x, y, e)}
                  className={`group relative rounded-2xl border transition ${
                    dev
                      ? "border-transparent"
                      : hover
                      ? "border-primary/60 bg-primary/10"
                      : "border-dashed border-border/30 hover:border-primary/40 hover:bg-background/30"
                  }`}
                  style={{ minHeight: 112 }}
                >
                  {/* coords */}
                  {!dev && (
                    <button
                      onClick={() => setAdding({ x, y })}
                      className="absolute inset-0 grid place-items-center text-muted-foreground/40 transition group-hover:text-primary"
                      aria-label={`Add station at ${x},${y}`}
                    >
                      <Plus className="h-4 w-4" />
                      <span className="absolute bottom-1 right-2 font-mono text-[9px] opacity-50">{x},{y}</span>
                    </button>
                  )}
                  {dev && (
                    <div
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", dev.id);
                        setDraggingId(dev.id);
                      }}
                      onDragEnd={() => setDraggingId(null)}
                      className={`relative ${draggingId === dev.id ? "opacity-40" : ""}`}
                    >
                      {/* zone tag */}
                      {dev.zone && (
                        <div
                          className="absolute -top-1 left-2 z-10 rounded-md border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.16em]"
                          style={{
                            background: `${dev.zone_color || "#a78bfa"}22`,
                            color: dev.zone_color || "#a78bfa",
                            borderColor: `${dev.zone_color || "#a78bfa"}55`,
                          }}
                        >{dev.zone}</div>
                      )}
                      <button
                        onClick={() => setEditing(dev)}
                        onContextMenu={(e) => { e.preventDefault(); sendToTray(dev.id); }}
                        className="block w-full text-left"
                        title="Click to edit · Right-click to unplace"
                      >
                        <StationPod
                          name={dev.name}
                          type={dev.type as "pc" | "console" | "vr" | "racing" | "other"}
                          status={(dev.status as DeviceStatus) || "available"}
                          hourlyRate={dev.hourly_rate}
                          accent={dev.zone_color}
                        />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right tray */}
        <aside className="space-y-3">
          <div className="rounded-2xl border border-border/60 bg-card/40 p-3 backdrop-blur">
            <div className="flex items-center gap-2">
              <Move className="h-3.5 w-3.5 text-azure" />
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Unplaced ({tray.length})</div>
            </div>
            <div className="mt-2 space-y-2">
              {tray.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/40 p-4 text-center font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  Everything is on the floor
                </div>
              ) : tray.map((d) => (
                <div
                  key={d.id}
                  draggable
                  onDragStart={(e) => { e.dataTransfer.setData("text/plain", d.id); setDraggingId(d.id); }}
                  onDragEnd={() => setDraggingId(null)}
                  className={`flex items-center justify-between gap-2 rounded-xl border border-border/50 bg-background/40 px-2.5 py-2 transition hover:border-primary/40 hover:bg-background/60 ${
                    draggingId === d.id ? "opacity-50" : "cursor-grab active:cursor-grabbing"
                  }`}
                  title="Drag onto a floor cell"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{d.name}</div>
                    <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
                      {d.type} · ₹{d.hourly_rate}
                    </div>
                  </div>
                  <button onClick={() => setEditing(d)} className="rounded-md p-1 text-muted-foreground hover:bg-background/60 hover:text-foreground">
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Zones legend */}
          <div className="rounded-2xl border border-border/60 bg-card/40 p-3 backdrop-blur">
            <div className="flex items-center gap-2">
              <MapPin className="h-3.5 w-3.5 text-violet" />
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Zones</div>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {zones.length === 0 ? (
                <div className="font-mono text-[10px] text-muted-foreground">Set a zone in a station's panel</div>
              ) : zones.map(([name, color]) => (
                <span
                  key={name}
                  className="rounded-md border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em]"
                  style={{ background: `${color}1a`, color, borderColor: `${color}55` }}
                >{name}</span>
              ))}
            </div>
          </div>

          {/* Tips */}
          <div className="rounded-2xl border border-border/60 bg-card/40 p-3 backdrop-blur">
            <div className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-magenta" />
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Tips</div>
            </div>
            <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
              <li>• Click empty cell to add</li>
              <li>• Drag to move stations</li>
              <li>• Right-click to send to tray</li>
              <li>• Click a station to edit</li>
            </ul>
          </div>
        </aside>
      </div>

      {/* Add dialog — two-pane with live preview */}
      <Dialog open={!!adding} onOpenChange={(v) => !v && setAdding(null)}>
        <DialogContent className="overflow-hidden p-0 sm:max-w-2xl">
          <NewStationForm
            adding={adding}
            defaultName={`PC-${devices.length + 1}`}
            isPending={createM.isPending}
            onSubmit={(values) => {
              if (!adding) return;
              const taken = cellMap.has(`${adding.x},${adding.y}`);
              createM.mutate({
                data: {
                  cafe_id: cafe.id,
                  ...values,
                  pos_x: taken ? null : adding.x,
                  pos_y: taken ? null : adding.y,
                },
              });
            }}
          />
        </DialogContent>
      </Dialog>


      {/* Edit sheet */}
      <Sheet open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editing?.name}</SheetTitle>
          </SheetHeader>
          {editing && (
            <form
              className="mt-4 space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                updateM.mutate({
                  data: {
                    id: editing.id,
                    patch: {
                      cafe_id: editing.cafe_id,
                      name: String(fd.get("name") || editing.name),
                      type: String(fd.get("type") || editing.type) as typeof TYPES[number],
                      hourly_rate: Number(fd.get("hourly_rate") || editing.hourly_rate),
                      status: String(fd.get("status") || editing.status) as DeviceStatus,
                      zone: (String(fd.get("zone") || "").trim() || null) as string | null,
                      zone_color: (String(fd.get("zone_color") || "") || null) as string | null,
                      notes: (String(fd.get("notes") || "").trim() || null) as string | null,
                    },
                  },
                });
              }}
            >
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Name</Label><Input name="name" defaultValue={editing.name} /></div>
                <div className="space-y-1">
                  <Label>Type</Label>
                  <select name="type" defaultValue={editing.type} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                    {TYPES.map((t) => <option key={t} value={t}>{t.toUpperCase()}</option>)}
                  </select>
                </div>
                <div className="space-y-1"><Label>Hourly ₹</Label><Input name="hourly_rate" type="number" defaultValue={editing.hourly_rate} /></div>
                <div className="space-y-1">
                  <Label>Status</Label>
                  <select name="status" defaultValue={editing.status} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                    {["available","reserved","suspended","maintenance"].map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <Label>Zone label</Label>
                <Input name="zone" defaultValue={editing.zone ?? ""} placeholder="e.g. VR Zone" />
              </div>
              <div className="space-y-1">
                <Label>Zone color</Label>
                <div className="flex flex-wrap gap-2">
                  {ZONE_COLORS.map((c) => (
                    <label key={c.value} className="cursor-pointer">
                      <input type="radio" name="zone_color" value={c.value} defaultChecked={editing.zone_color === c.value} className="peer sr-only" />
                      <span className="block h-7 w-7 rounded-full border-2 border-transparent ring-1 ring-border/60 transition peer-checked:border-foreground peer-checked:scale-110" style={{ background: c.value }} />
                    </label>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <Label>Internal notes</Label>
                <textarea name="notes" defaultValue={editing.notes ?? ""} rows={2} className="w-full rounded-md border border-input bg-background p-2 text-sm" placeholder="Specs, peripherals, quirks…" />
              </div>

              <SheetFooter className="flex-row justify-between gap-2 pt-2">
                <Button
                  type="button" variant="ghost" className="gap-1.5 text-destructive hover:text-destructive"
                  onClick={() => { if (confirm(`Delete ${editing.name}?`)) delM.mutate({ data: { id: editing.id } }); }}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </Button>
                <Button type="submit" disabled={updateM.isPending} className="gap-1.5" style={{ background: "var(--gradient-brand-hot)" }}>
                  <Save className="h-3.5 w-3.5" /> {updateM.isPending ? "Saving…" : "Save"}
                </Button>
              </SheetFooter>
            </form>
          )}
        </SheetContent>
      </Sheet>

      {/* If totally empty, soft empty state hint */}
      <AnimatePresence>
        {devices.length === 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <EmptyState
              icon={LayoutGrid}
              title="A blank café floor"
              description="Click any cell on the grid to place your first station, or hit ‘New station’ above."
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------
// New Station form with live preview pane
// ---------------------------------------------------------------

const TYPE_OPTIONS: { value: typeof TYPES[number]; label: string; icon: typeof Cpu }[] = [
  { value: "pc",      label: "PC",       icon: MonitorPlay },
  { value: "console", label: "Console",  icon: Gamepad2 },
  { value: "vr",      label: "VR",       icon: Headset },
  { value: "racing",  label: "Racing",   icon: Car },
  { value: "other",   label: "Other",    icon: Cpu },
];

type NewStationValues = {
  name: string;
  type: typeof TYPES[number];
  hourly_rate: number;
  zone: string | null;
  zone_color: string | null;
};

function NewStationForm({
  adding, defaultName, isPending, onSubmit,
}: {
  adding: { x: number; y: number } | null;
  defaultName: string;
  isPending: boolean;
  onSubmit: (v: NewStationValues) => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<typeof TYPES[number]>("pc");
  const [rate, setRate] = useState(100);
  const [zone, setZone] = useState("");
  const [color, setColor] = useState<string>(ZONE_COLORS[0].value);

  const finalName = name.trim() || defaultName;

  return (
    <div className="grid gap-0 sm:grid-cols-[260px_1fr]">
      {/* Left: live preview */}
      <div className="relative overflow-hidden border-b border-border bg-gradient-to-br from-secondary/60 to-card p-6 sm:border-b-0 sm:border-r">
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{ background: `radial-gradient(80% 60% at 50% 0%, ${color}33, transparent 70%)` }}
          aria-hidden
        />
        <div className="relative">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Live preview {adding && `· cell ${adding.x},${adding.y}`}
          </div>
          <motion.div
            key={`${type}-${color}-${finalName}-${rate}`}
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.25 }}
            className="mt-4"
          >
            <StationPod
              name={finalName}
              type={type}
              status="available"
              hourlyRate={rate}
              accent={color}
            />
          </motion.div>
          {zone && (
            <div
              className="mt-3 inline-block rounded-md border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em]"
              style={{ background: `${color}1a`, color, borderColor: `${color}55` }}
            >{zone}</div>
          )}
        </div>
      </div>

      {/* Right: form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({
            name: finalName,
            type,
            hourly_rate: rate,
            zone: zone.trim() || null,
            zone_color: color || null,
          });
        }}
        className="space-y-4 p-6"
      >
        <DialogHeader className="space-y-1">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-4 w-4 text-primary" /> New station
          </DialogTitle>
          <p className="text-xs text-muted-foreground">Configure once — your customers and floor will reflect it instantly.</p>
        </DialogHeader>

        {/* Type picker */}
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Type</Label>
          <div className="grid grid-cols-5 gap-1.5">
            {TYPE_OPTIONS.map((t) => {
              const active = type === t.value;
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setType(t.value)}
                  className={`group flex flex-col items-center gap-1 rounded-xl border p-2 transition-all ${
                    active
                      ? "border-primary bg-primary/10 text-primary shadow-soft scale-[1.03]"
                      : "border-border bg-card hover:border-primary/40 hover:bg-secondary"
                  }`}
                >
                  <t.icon className="h-4 w-4 transition-transform group-hover:scale-110" />
                  <span className="text-[10px] font-medium">{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={defaultName} autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Hourly rate ₹</Label>
            <Input type="number" min={0} value={rate} onChange={(e) => setRate(Number(e.target.value) || 0)} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Zone label <span className="opacity-50">(optional)</span></Label>
          <Input value={zone} onChange={(e) => setZone(e.target.value)} placeholder="e.g. PC Zone, VR Pit, Console Lounge" />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Zone color</Label>
          <div className="flex flex-wrap gap-2">
            {ZONE_COLORS.map((c) => {
              const active = color === c.value;
              return (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setColor(c.value)}
                  className="relative grid h-9 w-9 place-items-center rounded-full transition-transform hover:scale-110"
                  title={c.name}
                  aria-label={c.name}
                >
                  <span className="block h-7 w-7 rounded-full" style={{ background: c.value, boxShadow: active ? `0 0 0 3px var(--background), 0 0 0 5px ${c.value}` : "none" }} />
                </button>
              );
            })}
          </div>
        </div>

        <DialogFooter className="pt-2">
          <Button
            type="submit"
            disabled={isPending}
            className="gap-1.5 text-primary-foreground"
            style={{ background: "var(--gradient-brand)" }}
          >
            <Save className="h-3.5 w-3.5" /> {isPending ? "Adding…" : "Add station"}
          </Button>
        </DialogFooter>
      </form>
    </div>
  );
}

