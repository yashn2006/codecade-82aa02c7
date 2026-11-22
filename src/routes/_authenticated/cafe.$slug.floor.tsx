import { createFileRoute } from "@tanstack/react-router";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutGrid, Plus, Trash2, Save, Minus, MapPin, Sparkles, Move,
  MonitorPlay, Gamepad2, Headset, Car, Cpu, Wand2, RotateCcw, Search,
  Pencil, ArrowLeftRight, X,
} from "lucide-react";
import { getCafeBySlug, updateCafe } from "@/lib/cafes.functions";
import {
  listDevices, createDevice, updateDevice, deleteDevice, placeDevice,
  type DeviceStatus,
} from "@/lib/devices.functions";
import { listBookings } from "@/lib/bookings.functions";
import { BookingDetailDialog, type BookingRow } from "@/components/BookingDetailDialog";
import { StationDetailDialog, type StationBooking, type StationInfo } from "@/components/StationDetailDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { QueryBoundary, QueryErrorBanner } from "@/components/QueryBoundary";
import { CafeAccessGuard } from "@/hooks/useCafeAccess";
import { Skeleton } from "@/components/LoadingSkeleton";
import { StationPod } from "@/components/StationPod";
import { useNow } from "@/hooks/useNow";
import { toast } from "sonner";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter,
} from "@/components/ui/sheet";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmModal } from "@/components/ConfirmDialog";

export const Route = createFileRoute("/_authenticated/cafe/$slug/floor")({
  head: () => ({
    meta: [
      { title: "Floor Builder — CoreCade" },
      { name: "description", content: "Design your café floor matrix, arrange gaming rigs, and customize zones." },
      { property: "og:title", content: "Floor Builder — CoreCade" },
      { property: "og:description", content: "Design your café floor matrix, arrange gaming rigs, and customize zones." },
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
  id: string;
  cafe_id: string;
  name: string;
  type: string;
  hourly_rate: number;
  status: string;
  pos_x: number | null;
  pos_y: number | null;
  zone: string | null;
  zone_color: string | null;
  notes: string | null;
  specs?: Record<string, unknown> | null;
};

type ActiveInfo = {
  booking: BookingRow;
  state: "live" | "reserved";
  endMs: number;
  startMs: number;
};

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

/** Isolated 1s timer leaf — only pods with an active booking re-render on ticks. */
const LiveBookingCaption = memo(function LiveBookingCaption({ info }: { info: ActiveInfo }) {
  const now = useNow() || Date.now();
  const isLive = now >= info.startMs;
  const remaining = isLive ? info.endMs - now : info.startMs - now;
  const who = info.booking.customers?.full_name || "Guest";
  return (
    <span className="truncate font-mono tabular-nums">
      {isLive ? fmtCountdown(remaining) : `IN ${fmtCountdown(remaining)}`} · {who}
    </span>
  );
});

const SCALE_DIMS = {
  compact:  { minW: 132, gap: 8 },
  normal:   { minW: 158, gap: 12 },
  spacious: { minW: 186, gap: 14 },
} as const;

function rowLabel(y: number): string {
  if (y < 26) return String.fromCharCode(65 + y);
  return `R${y + 1}`;
}

function FloorBuilder() {
  const { slug } = Route.useParams();
  const getCafe = useServerFn(getCafeBySlug);
  const cafeQ = useQuery({ queryKey: ["cafe", slug], queryFn: () => getCafe({ data: { slug } }) });
  const cafe = cafeQ.data;
  if (cafeQ.isError || !cafe?.id) {
    return (
      <QueryBoundary queries={[cafeQ]} loading={!cafeQ.isError && !cafe?.id} errorTitle="Couldn't load floor layout">
        {null}
      </QueryBoundary>
    );
  }
  return (
    <CafeAccessGuard cafeId={cafe.id} slug={slug} requirePerm="manage_devices">
      <FloorBuilderContent />
    </CafeAccessGuard>
  );
}

function FloorBuilderContent() {
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
  const refresh = useCallback(() => qc.invalidateQueries({ queryKey: ["devices", cafe?.id] }), [qc, cafe?.id]);

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
        (old ?? []).map((d) => (d.id === vars.data.id ? { ...d, pos_x: vars.data.pos_x, pos_y: vars.data.pos_y } : d)),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["devices", cafe?.id], ctx.prev);
      toast.error("Move failed");
    },
    onSuccess: () => refresh(),
  });

  const createM = useMutation({
    mutationFn: create,
    onSuccess: () => {
      toast.success("Station added");
      refresh();
      setAdding(null);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const updateM = useMutation({
    mutationFn: update,
    onSuccess: () => {
      toast.success("Saved");
      refresh();
      setEditing(null);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to save station"),
  });

  const delM = useMutation({
    mutationFn: del,
    onSuccess: () => {
      toast.success("Removed");
      refresh();
      setEditing(null);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to remove station"),
  });

  const sizeM = useMutation({
    mutationFn: upCafe,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cafe", slug] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to resize floor grid"),
  });

  const [adding, setAdding] = useState<null | { x: number; y: number }>(null);
  const [editing, setEditing] = useState<null | Device>(null);
  const [selectedBooking, setSelectedBooking] = useState<BookingRow | null>(null);
  const [selectedStation, setSelectedStation] = useState<StationInfo | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [hoverCell, setHoverCell] = useState<string | null>(null);
  const [movingDevice, setMovingDevice] = useState<Device | null>(null);

  useEffect(() => {
    if (!movingDevice) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMovingDevice(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [movingDevice]);

  // Live bookings for this café — slow 30s window scan; live seconds render inside isolated LiveBookingCaption.
  const bookingsFn = useServerFn(listBookings);
  const bookingsQ = useQuery({
    queryKey: ["bookings", cafe?.id],
    queryFn: () => bookingsFn({ data: { cafe_id: cafe!.id } }),
    enabled: !!cafe?.id,
    refetchInterval: 30_000,
  });

  const [minuteTick, setMinuteTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setMinuteTick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const activeByDevice = useMemo(() => {
    void minuteTick;
    const nowTs = Date.now();
    const m = new Map<string, ActiveInfo>();
    const rows = (bookingsQ.data ?? []) as (BookingRow & { device_id?: string })[];
    for (const b of rows) {
      if (!b.device_id) continue;
      if (b.status === "cancelled" || b.status === "completed" || b.status === "no_show") continue;
      const startMs = new Date(b.scheduled_at).getTime();
      const endMs = startMs + (b.duration_minutes || 0) * 60_000;
      if (nowTs > endMs) continue;
      if (startMs - nowTs > 2 * 60 * 60_000) continue;
      const state: "live" | "reserved" = nowTs >= startMs ? "live" : "reserved";
      const prev = m.get(b.device_id);
      if (!prev || (state === "live" && prev.state !== "live") || (state === prev.state && startMs < prev.startMs)) {
        m.set(b.device_id, { booking: b as BookingRow, state, endMs, startMs });
      }
    }
    return m;
  }, [bookingsQ.data, minuteTick]);

  const cols = cafe?.floor_cols ?? 10;
  const rows = cafe?.floor_rows ?? 6;

  const devices = useMemo(() => (devicesQ.data ?? []) as Device[], [devicesQ.data]);
  const placed = useMemo(() => devices.filter((d) => d.pos_x != null && d.pos_y != null), [devices]);
  const tray = useMemo(() => devices.filter((d) => d.pos_x == null || d.pos_y == null), [devices]);

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

  const moveOrSwap = useCallback(
    async (sourceId: string, targetX: number, targetY: number) => {
      const source = devices.find((d) => d.id === sourceId);
      if (!source) return;
      if (source.pos_x === targetX && source.pos_y === targetY) {
        setMovingDevice(null);
        return;
      }
      const occupant = cellMap.get(`${targetX},${targetY}`);
      if (!occupant) {
        placeM.mutate({ data: { id: sourceId, pos_x: targetX, pos_y: targetY } });
        setMovingDevice(null);
        return;
      }
      if (occupant.id === sourceId) {
        setMovingDevice(null);
        return;
      }
      const prevX = source.pos_x;
      const prevY = source.pos_y;
      try {
        await place({ data: { id: sourceId, pos_x: targetX, pos_y: targetY } });
        await place({ data: { id: occupant.id, pos_x: prevX, pos_y: prevY } });
        toast.success(
          prevX != null && prevY != null
            ? `Swapped ${source.name} & ${occupant.name}`
            : `Placed ${source.name} and moved ${occupant.name} to staging`,
        );
        refresh();
      } catch {
        toast.error("Couldn't swap stations");
      } finally {
        setMovingDevice(null);
      }
    },
    [devices, cellMap, placeM, place, refresh],
  );

  const onCellDrop = (x: number, y: number, e: React.DragEvent) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    setHoverCell(null);
    setDraggingId(null);
    if (!id) return;
    void moveOrSwap(id, x, y);
  };

  const sendToTray = useCallback(
    (id: string) => placeM.mutate({ data: { id, pos_x: null, pos_y: null } }),
    [placeM],
  );

  const [scale, setScale] = useState<"compact" | "normal" | "spacious">("normal");
  const [trayQuery, setTrayQuery] = useState("");
  const [isAutoPlacing, setIsAutoPlacing] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    description: string;
    confirmLabel: string;
    onConfirm: () => Promise<unknown> | void;
  } | null>(null);

  const filteredTray = useMemo(() => {
    if (!trayQuery.trim()) return tray;
    const q = trayQuery.toLowerCase();
    return tray.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        d.type.toLowerCase().includes(q) ||
        (d.zone && d.zone.toLowerCase().includes(q)),
    );
  }, [tray, trayQuery]);

  const autoPlaceAll = async () => {
    if (tray.length === 0) {
      toast.info("All stations are already placed on the floor matrix.");
      return;
    }
    const openCells: { x: number; y: number }[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!cellMap.has(`${c},${r}`)) openCells.push({ x: c, y: r });
      }
    }
    if (openCells.length === 0) {
      toast.error("Grid is full! Increase columns or rows to fit more rigs.");
      return;
    }
    setIsAutoPlacing(true);
    try {
      const toPlace = tray.slice(0, openCells.length);
      for (let i = 0; i < toPlace.length; i++) {
        await place({ data: { id: toPlace[i].id, pos_x: openCells[i].x, pos_y: openCells[i].y } });
      }
      toast.success(`Arranged ${toPlace.length} rigs onto the floor matrix`);
      refresh();
    } catch {
      toast.error("Failed to auto-arrange stations");
    } finally {
      setIsAutoPlacing(false);
    }
  };

  const clearAllToTray = () => {
    if (placed.length === 0) {
      toast.info("No placed rigs on the floor.");
      return;
    }
    setConfirmAction({
      title: "Unplace all stations?",
      description: `Send all ${placed.length} placed stations back to the staging tray?`,
      confirmLabel: "Unplace All",
      onConfirm: async () => {
        try {
          for (const d of placed) {
            await place({ data: { id: d.id, pos_x: null, pos_y: null } });
          }
          toast.success("Sent all rigs to staging tray.");
          refresh();
        } catch {
          toast.error("Failed to unplace stations");
        }
      },
    });
  };

  if (cafeQ.isLoading) return <Skeleton className="h-96" />;
  if (cafeQ.isError || !cafe) return <ErrorState description="Could not load this café." onRetry={() => cafeQ.refetch()} />;
  if (devicesQ.isError) return <ErrorState title="Couldn't load stations" description="We couldn't fetch the stations for this floor plan." onRetry={() => void devicesQ.refetch()} />;

  const dims = SCALE_DIMS[scale];

  return (
    <div className="space-y-4">
      <QueryErrorBanner queries={[bookingsQ]} title="Live booking overlays couldn't refresh" />

      {/* Studio Header Toolbar */}
      <div className="liquid-glass-card flex flex-col justify-between gap-4 rounded-2xl border border-white/10 p-4 shadow-xl lg:flex-row lg:items-center">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary to-accent text-white shadow-[0_0_18px_rgba(255,43,206,0.35)]">
            <LayoutGrid className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-lg font-extrabold tracking-tight text-foreground">
              Floor Studio
            </h1>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground tabular-nums">
              <span>{cols}×{rows} Matrix</span>
              <span aria-hidden>·</span>
              <span>{devices.length} Rigs</span>
              <span aria-hidden>·</span>
              <span>{tray.length} Staging</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Quick grid presets */}
          <div className="hidden items-center gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1 text-[11px] font-mono sm:inline-flex">
            {[
              { l: "6×4", c: 6, r: 4 },
              { l: "8×6", c: 8, r: 6 },
              { l: "10×6", c: 10, r: 6 },
              { l: "12×8", c: 12, r: 8 },
            ].map((p) => (
              <button
                key={p.l}
                type="button"
                disabled={sizeM.isPending}
                onClick={() => sizeM.mutate({ data: { id: cafe.id, patch: { floor_cols: p.c, floor_rows: p.r } } })}
                className={`rounded-lg px-2 py-1 transition-colors ${
                  cols === p.c && rows === p.r
                    ? "bg-primary font-bold text-white shadow-sm"
                    : "text-muted-foreground hover:text-white"
                }`}
              >
                {p.l}
              </button>
            ))}
          </div>

          {/* Steppers */}
          <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.04] px-2 py-1">
            <span className="px-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Cols</span>
            <Button
              size="icon"
              variant="ghost"
              disabled={sizeM.isPending || cols <= 4}
              className="h-7 w-7 rounded-md text-white hover:bg-white/10"
              onClick={() => sizeM.mutate({ data: { id: cafe.id, patch: { floor_cols: Math.max(4, cols - 1) } } })}
              aria-label="Decrease columns"
            >
              <Minus className="h-3 w-3" />
            </Button>
            <span className="w-5 text-center font-mono text-xs font-bold tabular-nums text-white">{cols}</span>
            <Button
              size="icon"
              variant="ghost"
              disabled={sizeM.isPending || cols >= 40}
              className="h-7 w-7 rounded-md text-white hover:bg-white/10"
              onClick={() => sizeM.mutate({ data: { id: cafe.id, patch: { floor_cols: Math.min(40, cols + 1) } } })}
              aria-label="Increase columns"
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>

          <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.04] px-2 py-1">
            <span className="px-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Rows</span>
            <Button
              size="icon"
              variant="ghost"
              disabled={sizeM.isPending || rows <= 3}
              className="h-7 w-7 rounded-md text-white hover:bg-white/10"
              onClick={() => sizeM.mutate({ data: { id: cafe.id, patch: { floor_rows: Math.max(3, rows - 1) } } })}
              aria-label="Decrease rows"
            >
              <Minus className="h-3 w-3" />
            </Button>
            <span className="w-5 text-center font-mono text-xs font-bold tabular-nums text-white">{rows}</span>
            <Button
              size="icon"
              variant="ghost"
              disabled={sizeM.isPending || rows >= 30}
              className="h-7 w-7 rounded-md text-white hover:bg-white/10"
              onClick={() => sizeM.mutate({ data: { id: cafe.id, patch: { floor_rows: Math.min(30, rows + 1) } } })}
              aria-label="Increase rows"
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>

          <Button
            size="sm"
            className="h-9 gap-1.5 whitespace-nowrap rounded-xl text-xs font-bold text-white shadow-lg shadow-pink-500/20 transition-transform active:scale-[0.98]"
            style={{ background: "var(--gradient-brand-hot)" }}
            onClick={() => setAdding({ x: 0, y: 0 })}
          >
            <Plus className="h-3.5 w-3.5" /> Add Station
          </Button>
        </div>
      </div>

      {/* Automation, Move Indicator & Pod Scale Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 px-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={isAutoPlacing || tray.length === 0}
            onClick={() => void autoPlaceAll()}
            className="h-9 gap-1.5 rounded-xl border-white/10 bg-white/[0.03] text-xs font-medium text-foreground hover:bg-white/10"
          >
            <Wand2 className="h-3.5 w-3.5 text-primary" />
            {isAutoPlacing ? "Placing…" : `Auto-Place (${tray.length})`}
          </Button>
          {placed.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void clearAllToTray()}
              className="h-9 gap-1.5 rounded-xl text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Unplace All
            </Button>
          )}
        </div>

        <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1 font-mono text-[10px]">
          <span className="px-2 uppercase tracking-widest text-[9px] text-muted-foreground">Pod size</span>
          {(["compact", "normal", "spacious"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setScale(s)}
              className={`rounded-lg px-2.5 py-1 uppercase transition-colors ${
                scale === s ? "bg-primary font-bold text-white shadow-sm" : "text-muted-foreground hover:text-white"
              }`}
            >
              {s === "compact" ? "S" : s === "normal" ? "M" : "L"}
            </button>
          ))}
        </div>
      </div>

      {/* Active Move / Place mode banner (accessible on mobile touch & desktop) */}
      <AnimatePresence>
        {movingDevice && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.14 }}
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/50 bg-primary/15 px-4 py-2.5 text-xs shadow-lg"
          >
            <div className="flex items-center gap-2 font-medium text-white">
              <ArrowLeftRight className="h-4 w-4 text-primary" />
              <span>
                Placing <strong className="font-bold">{movingDevice.name}</strong> — tap any grid slot to move or swap.
              </span>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setMovingDevice(null)}
              className="h-8 gap-1 rounded-lg px-2.5 text-xs hover:bg-white/10"
            >
              <X className="h-3.5 w-3.5" /> Cancel
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Canvas + Staging Tray */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_272px]">
        {/* Architectural CAD Floor Canvas */}
        <div className="relative w-full max-w-full min-w-0 overflow-auto rounded-3xl border border-white/10 bg-[radial-gradient(120%_80%_at_50%_-10%,oklch(0.18_0.05_285)_0%,oklch(0.07_0.02_285)_70%)] p-3 shadow-2xl sm:p-4 lf-scroll">
          {/* Column Coordinate Header */}
          <div
            className="mb-2 grid items-center pl-7"
            style={{
              gridTemplateColumns: `repeat(${cols}, minmax(${dims.minW}px, 1fr))`,
              gap: dims.gap,
              minWidth: cols * dims.minW + (cols - 1) * dims.gap + 28,
            }}
            aria-hidden
          >
            {Array.from({ length: cols }).map((_, c) => (
              <div
                key={c}
                className="text-center font-mono text-[9.5px] tracking-[0.18em] text-muted-foreground/50 tabular-nums"
              >
                {String(c + 1).padStart(2, "0")}
              </div>
            ))}
          </div>

          {/* Row Matrix */}
          <div className="space-y-2" style={{ minWidth: cols * dims.minW + (cols - 1) * dims.gap + 28 }}>
            {Array.from({ length: rows }).map((_, y) => (
              <div key={y} className="flex items-stretch gap-2">
                {/* Row label */}
                <div
                  className="flex w-5 shrink-0 items-center justify-center font-mono text-[9.5px] tracking-[0.14em] text-muted-foreground/50"
                  aria-hidden
                >
                  {rowLabel(y)}
                </div>

                {/* Cells in row */}
                <div
                  className="grid flex-1"
                  style={{
                    gridTemplateColumns: `repeat(${cols}, minmax(${dims.minW}px, 1fr))`,
                    gap: dims.gap,
                  }}
                >
                  {Array.from({ length: cols }).map((__, x) => {
                    const key = `${x},${y}`;
                    const dev = cellMap.get(key);
                    const isHover = hoverCell === key;
                    const isMovingSource = movingDevice?.id === dev?.id;
                    const isTargetable = !!movingDevice && !isMovingSource;

                    if (!dev) {
                      return (
                        <div
                          key={key}
                          onDragOver={(e) => { e.preventDefault(); setHoverCell(key); }}
                          onDragLeave={() => setHoverCell((c) => (c === key ? null : c))}
                          onDrop={(e) => onCellDrop(x, y, e)}
                          className={`group relative min-h-[146px] rounded-[20px] border transition-[border-color,background-color,transform] duration-150 ${
                            isHover
                              ? "scale-[1.01] border-primary bg-primary/15 shadow-[0_0_24px_-6px_rgba(255,43,206,0.5)]"
                              : isTargetable
                                ? "border-dashed border-primary/50 bg-primary/[0.06] hover:border-primary hover:bg-primary/15"
                                : "border-dashed border-white/[0.08] bg-white/[0.012] hover:border-primary/45 hover:bg-white/[0.03]"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              if (movingDevice) {
                                void moveOrSwap(movingDevice.id, x, y);
                              } else {
                                setAdding({ x, y });
                              }
                            }}
                            className="absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-[20px] text-muted-foreground/35 transition-colors duration-150 group-hover:text-primary"
                            aria-label={
                              movingDevice
                                ? `Move ${movingDevice.name} to ${rowLabel(y)}${x + 1}`
                                : `Add station at ${rowLabel(y)}${x + 1}`
                            }
                          >
                            {isTargetable ? (
                              <ArrowLeftRight className="h-4 w-4 text-primary" />
                            ) : (
                              <Plus className="h-4 w-4 transition-transform duration-150 group-hover:scale-110" />
                            )}
                            <span className="font-mono text-[9px] tracking-[0.16em] opacity-70">
                              {rowLabel(y)}{String(x + 1).padStart(2, "0")}
                            </span>
                          </button>
                        </div>
                      );
                    }

                    const active = activeByDevice.get(dev.id);
                    const effectiveStatus: DeviceStatus = active
                      ? active.state === "live"
                        ? "in_use"
                        : "reserved"
                      : ((dev.status as DeviceStatus) || "available");

                    return (
                      <div
                        key={key}
                        draggable
                        onDragOver={(e) => { e.preventDefault(); setHoverCell(key); }}
                        onDragLeave={() => setHoverCell((c) => (c === key ? null : c))}
                        onDrop={(e) => onCellDrop(x, y, e)}
                        onDragStart={(e) => {
                          e.dataTransfer.setData("text/plain", dev.id);
                          setDraggingId(dev.id);
                        }}
                        onDragEnd={() => {
                          setDraggingId(null);
                          setHoverCell(null);
                        }}
                        className={`relative rounded-[20px] transition-opacity duration-150 ${
                          draggingId === dev.id ? "opacity-40" : ""
                        } ${isHover && draggingId && draggingId !== dev.id ? "ring-2 ring-primary ring-offset-2 ring-offset-[#070512]" : ""}`}
                      >
                        <StationPod
                          name={dev.name}
                          type={dev.type as "pc" | "console" | "vr" | "racing" | "other"}
                          status={effectiveStatus}
                          hourlyRate={dev.hourly_rate}
                          zone={dev.zone}
                          accent={dev.zone_color}
                          selected={isMovingSource || selectedStation?.id === dev.id}
                          caption={active ? <LiveBookingCaption info={active} /> : undefined}
                          title="Click for station details · Drag or tap Move to rearrange · Right-click to unplace"
                          onClick={() => {
                            if (movingDevice) {
                              if (movingDevice.id === dev.id) {
                                setMovingDevice(null);
                              } else {
                                void moveOrSwap(movingDevice.id, x, y);
                              }
                            } else {
                              setSelectedStation(dev as unknown as StationInfo);
                            }
                          }}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            sendToTray(dev.id);
                          }}
                          controls={
                            <div className="flex items-center gap-0.5 opacity-80 transition-opacity group-hover:opacity-100">
                              <button
                                type="button"
                                onClick={() => setMovingDevice((curr) => (curr?.id === dev.id ? null : dev))}
                                className={`grid h-6 w-6 place-items-center rounded-md transition-colors ${
                                  isMovingSource
                                    ? "bg-primary text-white"
                                    : "text-muted-foreground hover:bg-white/10 hover:text-white"
                                }`}
                                title="Move or swap position"
                                aria-label={`Move ${dev.name}`}
                              >
                                <Move className="h-3 w-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditing(dev)}
                                className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-white/10 hover:text-white"
                                title="Edit station"
                                aria-label={`Edit ${dev.name}`}
                              >
                                <Pencil className="h-3 w-3" />
                              </button>
                            </div>
                          }
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Staging Tray & Zone Key */}
        <aside className="min-w-0 space-y-3">
          <div className="rounded-2xl border border-white/10 bg-card/45 p-3.5 backdrop-blur-xl shadow-xl">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Move className="h-3.5 w-3.5 text-azure" />
                <div className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Staging ({tray.length})
                </div>
              </div>
              {tray.length > 0 && (
                <span className="font-mono text-[10px] text-azure">Drag or tap Place</span>
              )}
            </div>

            {tray.length > 3 && (
              <div className="relative mt-2.5">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
                <input
                  value={trayQuery}
                  onChange={(e) => setTrayQuery(e.target.value)}
                  placeholder="Filter staging…"
                  className="h-9 w-full rounded-xl border border-white/10 bg-background/50 pl-8 pr-3 text-xs placeholder:text-muted-foreground/50 focus:border-primary/50 focus:outline-none"
                />
              </div>
            )}

            <div className="mt-3 max-h-[380px] space-y-2 overflow-y-auto pr-1 lf-scroll">
              {tray.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/40 p-5 text-center font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  All stations placed on floor
                </div>
              ) : filteredTray.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/40 p-4 text-center font-mono text-[10px] text-muted-foreground">
                  No matching staging stations
                </div>
              ) : (
                filteredTray.map((d) => {
                  const isPicked = movingDevice?.id === d.id;
                  return (
                    <div
                      key={d.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", d.id);
                        setDraggingId(d.id);
                      }}
                      onDragEnd={() => setDraggingId(null)}
                      className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 shadow-sm transition-colors ${
                        isPicked
                          ? "border-primary bg-primary/15"
                          : "border-white/10 bg-background/45 hover:border-primary/40 hover:bg-background/70"
                      } ${draggingId === d.id ? "opacity-50" : "cursor-grab active:cursor-grabbing"}`}
                      title="Drag onto any floor cell or click Place"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">{d.name}</div>
                        <div className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-muted-foreground tabular-nums">
                          {d.type} · ₹{d.hourly_rate}
                          {d.zone && ` · ${d.zone}`}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setMovingDevice((curr) => (curr?.id === d.id ? null : d))}
                          className={`rounded-lg px-2 py-1 font-mono text-[10px] font-semibold transition-colors ${
                            isPicked
                              ? "bg-primary text-white"
                              : "bg-white/[0.06] text-foreground hover:bg-primary/20 hover:text-primary"
                          }`}
                        >
                          {isPicked ? "Cancel" : "Place"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditing(d)}
                          className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
                          aria-label={`Edit ${d.name}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Zones legend */}
          <div className="rounded-2xl border border-white/10 bg-card/45 p-3.5 backdrop-blur-xl">
            <div className="flex items-center gap-2">
              <MapPin className="h-3.5 w-3.5 text-violet" />
              <div className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Zones
              </div>
            </div>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {zones.length === 0 ? (
                <div className="text-xs text-muted-foreground">Assign a zone label and color when editing any station.</div>
              ) : (
                zones.map(([name, color]) => (
                  <span
                    key={name}
                    className="inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.14em]"
                    style={{ color }}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ background: color }} />
                    {name}
                  </span>
                ))
              )}
            </div>
          </div>

          {/* Shortcuts */}
          <div className="rounded-2xl border border-white/10 bg-card/45 p-3.5 backdrop-blur-xl">
            <div className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-magenta" />
              <div className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Controls
              </div>
            </div>
            <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
              <li>• Tap an empty slot to add a station</li>
              <li>• Drag any pod or tap <strong className="text-foreground/90">Move</strong> to swap/reposition</li>
              <li>• Tap a pod to view live status &amp; bookings</li>
              <li>• Right-click a placed pod to send to staging</li>
            </ul>
          </div>
        </aside>
      </div>

      {/* Add dialog — two-pane with live StationPod hardware preview */}
      <Dialog open={!!adding} onOpenChange={(v) => !v && setAdding(null)}>
        <DialogContent className="overflow-y-auto p-0 sm:max-w-2xl">
          <NewStationForm
            key={adding ? `${adding.x},${adding.y}` : "closed"}
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
        <SheetContent className="dashboard-dialog w-full overflow-y-auto sm:max-w-md">
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
                      name: String(fd.get("name") || editing.name).trim(),
                      type: String(fd.get("type") || editing.type) as (typeof TYPES)[number],
                      hourly_rate: Math.max(0, Number(fd.get("hourly_rate") ?? editing.hourly_rate)),
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
                <div className="space-y-1">
                  <Label>Name</Label>
                  <Input name="name" defaultValue={editing.name} required />
                </div>
                <div className="space-y-1">
                  <Label>Type</Label>
                  <select name="type" defaultValue={editing.type} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                    {TYPES.map((t) => (
                      <option key={t} value={t}>{t.toUpperCase()}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>Hourly ₹</Label>
                  <Input name="hourly_rate" type="number" min={0} defaultValue={editing.hourly_rate} required />
                </div>
                <div className="space-y-1">
                  <Label>Status</Label>
                  <select name="status" defaultValue={editing.status} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                    {["available", "reserved", "suspended", "maintenance"].map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
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
                      <span
                        className="block h-7 w-7 rounded-full border-2 border-transparent ring-1 ring-border/60 transition peer-checked:scale-110 peer-checked:border-foreground"
                        style={{ background: c.value }}
                      />
                    </label>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <Label>Internal notes</Label>
                <textarea
                  name="notes"
                  defaultValue={editing.notes ?? ""}
                  rows={2}
                  className="w-full rounded-md border border-input bg-background p-2 text-sm"
                  placeholder="Specs, peripherals, quirks…"
                />
              </div>

              <SheetFooter className="flex-row justify-between gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  className="gap-1.5 text-destructive hover:text-destructive"
                  onClick={() =>
                    setConfirmAction({
                      title: `Delete ${editing.name}?`,
                      description: "This permanently removes the station from your floor plan.",
                      confirmLabel: "Delete Station",
                      onConfirm: () => delM.mutateAsync({ data: { id: editing.id } }),
                    })
                  }
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

      {/* Rich station detail popup */}
      <StationDetailDialog
        open={!!selectedStation}
        onOpenChange={(o) => !o && setSelectedStation(null)}
        station={selectedStation}
        bookings={
          selectedStation
            ? ((bookingsQ.data ?? []) as unknown as StationBooking[]).filter(
                (b) => (b as { device_id?: string }).device_id === selectedStation.id,
              )
            : []
        }
        cafeId={cafe.id}
        onEdit={(s) => setEditing(s as unknown as Device)}
      />

      <BookingDetailDialog
        booking={selectedBooking}
        open={!!selectedBooking}
        onOpenChange={(o) => !o && setSelectedBooking(null)}
        cafeId={cafe.id}
      />

      <AnimatePresence>
        {devices.length === 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <EmptyState
              icon={LayoutGrid}
              title="A blank café floor"
              description="Click any slot on the grid to place your first station, or click Add Station above."
            />
          </motion.div>
        )}
      </AnimatePresence>

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

// ---------------------------------------------------------------
// New Station form with live hardware pod preview
// ---------------------------------------------------------------

const TYPE_OPTIONS: { value: (typeof TYPES)[number]; label: string; icon: typeof Cpu }[] = [
  { value: "pc",      label: "PC",       icon: MonitorPlay },
  { value: "console", label: "Console",  icon: Gamepad2 },
  { value: "vr",      label: "VR",       icon: Headset },
  { value: "racing",  label: "Racing",   icon: Car },
  { value: "other",   label: "Other",    icon: Cpu },
];

type NewStationValues = {
  name: string;
  type: (typeof TYPES)[number];
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
  const [type, setType] = useState<(typeof TYPES)[number]>("pc");
  const [rate, setRate] = useState(100);
  const [zone, setZone] = useState("");
  const [color, setColor] = useState<string>(ZONE_COLORS[0].value);

  const finalName = name.trim() || defaultName;

  return (
    <div className="grid gap-0 sm:grid-cols-[260px_1fr]">
      {/* Left: live hardware preview */}
      <div className="relative overflow-hidden border-b border-border bg-gradient-to-br from-secondary/60 to-card p-6 sm:border-b-0 sm:border-r">
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{ background: `radial-gradient(80% 60% at 50% 0%, ${color}33, transparent 70%)` }}
          aria-hidden
        />
        <div className="relative">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Live preview {adding && `· ${rowLabel(adding.y)}${String(adding.x + 1).padStart(2, "0")}`}
          </div>
          <div className="mt-4">
            <StationPod
              name={finalName}
              type={type}
              status="available"
              hourlyRate={rate}
              zone={zone.trim() || null}
              accent={color}
            />
          </div>
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
          <p className="text-xs text-muted-foreground">Configure once — your customers and live floor reflect it instantly.</p>
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
                  className={`group flex flex-col items-center gap-1 rounded-xl border p-2 transition-colors ${
                    active
                      ? "border-primary bg-primary/10 text-primary shadow-soft"
                      : "border-border bg-card hover:border-primary/40 hover:bg-secondary"
                  }`}
                >
                  <t.icon className="h-4 w-4" />
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
            <Input type="number" min={0} value={rate} onChange={(e) => setRate(Math.max(0, Number(e.target.value) || 0))} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Zone label <span className="opacity-50">(optional)</span>
          </Label>
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
                  <span
                    className="block h-7 w-7 rounded-full"
                    style={{
                      background: c.value,
                      boxShadow: active ? `0 0 0 3px var(--background), 0 0 0 5px ${c.value}` : "none",
                    }}
                  />
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button
            type="submit"
            disabled={isPending}
            className="gap-1.5 text-primary-foreground"
            style={{ background: "var(--gradient-brand)" }}
          >
            <Save className="h-3.5 w-3.5" /> {isPending ? "Adding…" : "Add station"}
          </Button>
        </div>
      </form>
    </div>
  );
}
