import { useMemo, useState, useRef, useEffect } from "react";
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Calendar,
  Clock,
  Gamepad2,
  Check,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Zap,
  MapPin,
  Cpu,
  Monitor,
  Joystick,
  Headphones,
  Tv,
  LayoutGrid,
  Server,
  ShieldCheck,
  QrCode,
  Sun,
  Sunset,
  Moon,
  X,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ParticleField } from "@/components/ParticleField";
import {
  getCafeDevicesPublic,
  getDeviceSchedule,
  customerBookDevice,
} from "@/lib/portal.functions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Device = {
  id: string;
  name: string;
  type: string;
  hourly_rate: number;
  status: string;
  specs?: unknown;
};
type Cafe = { id: string; name: string; city?: string | null; address?: string | null };

function formatSpecs(specs: unknown): string | null {
  if (!specs) return null;
  if (typeof specs === "string") return specs.trim() || null;
  if (typeof specs === "object" && !Array.isArray(specs)) {
    const entries = Object.entries(specs as Record<string, unknown>)
      .filter(([_, v]) => v !== undefined && v !== null && String(v).trim().length > 0)
      .map(([k, v]) => `${k.toUpperCase()}: ${v}`);
    return entries.length > 0 ? entries.join(" · ") : null;
  }
  return null;
}

const DURATIONS = [30, 60, 90, 120, 180, 240, 360];

function deviceIcon(type: string) {
  const t = type.toLowerCase();
  if (t.includes("ps") || t.includes("console") || t.includes("xbox")) return Joystick;
  if (t.includes("vr")) return Headphones;
  if (t.includes("sim") || t.includes("racing")) return Tv;
  if (t.includes("pc") || t.includes("rig")) return Monitor;
  return Cpu;
}

function fmtDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// 3D tilt card
function TiltCard({
  children,
  className,
  onClick,
  disabled,
  selected,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
  selected?: boolean;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rx = useSpring(useTransform(y, [-50, 50], [8, -8]), { stiffness: 220, damping: 22 });
  const ry = useSpring(useTransform(x, [-50, 50], [-8, 8]), { stiffness: 220, damping: 22 });
  const gx = useTransform(x, [-50, 50], [0, 100]);
  const gy = useTransform(y, [-50, 50], [0, 100]);

  return (
    <motion.button
      ref={ref}
      disabled={disabled}
      onClick={onClick}
      onMouseMove={(e) => {
        if (!ref.current) return;
        const r = ref.current.getBoundingClientRect();
        x.set(e.clientX - r.left - r.width / 2);
        y.set(e.clientY - r.top - r.height / 2);
      }}
      onMouseLeave={() => {
        x.set(0);
        y.set(0);
      }}
      style={{ rotateX: rx, rotateY: ry, transformPerspective: 1000 }}
      whileTap={{ scale: 0.98 }}
      className={cn("relative will-change-transform", className)}
    >
      <motion.div
        className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity hover:opacity-100"
        style={{
          background: useTransform(
            [gx, gy],
            ([gxv, gyv]) =>
              `radial-gradient(circle at ${gxv}% ${gyv}%, oklch(0.78 0.22 335 / 0.35), transparent 65%)`,
          ),
          opacity: selected ? 1 : undefined,
        }}
      />
      {children}
    </motion.button>
  );
}

function AnimatedCost({ value }: { value: number }) {
  const mv = useSpring(0, { stiffness: 90, damping: 20 });
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    mv.set(value);
  }, [value, mv]);
  useEffect(() => mv.on("change", (v) => setDisplay(Math.round(v))), [mv]);
  return <>{display.toLocaleString("en-IN")}</>;
}

export function BookingFlow({
  open,
  onOpenChange,
  cafe,
  onBooked,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  cafe: Cafe;
  onBooked?: () => void;
}) {
  function getInitialDate(): Date {
    const now = new Date();
    if (now.getHours() >= 23) {
      const tmr = new Date(now);
      tmr.setDate(tmr.getDate() + 1);
      return tmr;
    }
    return now;
  }

  const [step, setStep] = useState(0);
  const [device, setDevice] = useState<Device | null>(null);
  const [date, setDate] = useState<Date>(getInitialDate);
  const [time, setTime] = useState<string | null>(null);
  const [duration, setDuration] = useState(60);
  const [burst, setBurst] = useState(false);
  const [viewMode, setViewMode] = useState<"cards" | "floor">("floor");
  const [typeFilter, setTypeFilter] = useState("all");

  const devicesFn = useServerFn(getCafeDevicesPublic);
  const scheduleFn = useServerFn(getDeviceSchedule);
  const bookFn = useServerFn(customerBookDevice);

  const devicesQ = useQuery({
    queryKey: ["public-devices", cafe.id],
    queryFn: () => devicesFn({ data: { cafe_id: cafe.id } }),
    enabled: open,
  });

  const scheduleQ = useQuery({
    queryKey: ["device-schedule", cafe.id, fmtDate(date)],
    queryFn: () => scheduleFn({ data: { cafe_id: cafe.id, date: fmtDate(date) } }),
    enabled: open && step >= 1,
  });

  const paymentMethod = "pay_at_cafe" as const;

  const finishSuccess = () => {
    setBurst(true);
    setTimeout(() => {
      toast.success("Battle station locked! Reservation confirmed.");
      onBooked?.();
      reset();
      onOpenChange(false);
    }, 900);
  };

  const book = useMutation({
    mutationFn: bookFn,
    onSuccess: () => {
      finishSuccess();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Booking failed"),
  });

  const reset = () => {
    setStep(0);
    setDevice(null);
    setTime(null);
    setDuration(60);
    setDate(getInitialDate());
    setBurst(false);
    setTypeFilter("all");
  };

  const rawDevices = useMemo(() => {
    return (Array.isArray(devicesQ.data) ? devicesQ.data : []) as Device[];
  }, [devicesQ.data]);

  const filteredDevices = useMemo(() => {
    if (typeFilter === "all") return rawDevices;
    return rawDevices.filter((d) => d.type.toLowerCase().includes(typeFilter.toLowerCase()));
  }, [rawDevices, typeFilter]);

  const slots = useMemo(() => {
    const out: {
      iso: string;
      label: string;
      period: "morning" | "afternoon" | "evening";
      disabled: boolean;
      past: boolean;
      bookedMinutes: number;
    }[] = [];
    const now = Date.now();
    const schedules = Array.isArray(scheduleQ.data) ? scheduleQ.data : [];

    for (let h = 9; h < 24; h++) {
      for (let m = 0; m < 60; m += 30) {
        const dt = new Date(date);
        dt.setHours(h, m, 0, 0);
        const iso = dt.toISOString();
        const past = dt.getTime() < now;
        const slotEnd = dt.getTime() + duration * 60_000;
        let disabled = past;
        let bookedMinutes = 0;

        for (const b of schedules) {
          if (b.device_id !== device?.id) continue;
          const bs = new Date(b.scheduled_at).getTime();
          const be = bs + b.duration_minutes * 60_000;
          if (bs < slotEnd && be > dt.getTime()) {
            disabled = true;
            if (b.duration_minutes > bookedMinutes) bookedMinutes = b.duration_minutes;
            break;
          }
        }

        const period: "morning" | "afternoon" | "evening" =
          h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";

        out.push({
          iso,
          label: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`,
          period,
          disabled,
          past,
          bookedMinutes,
        });
      }
    }
    return out;
  }, [date, scheduleQ.data, device, duration]);

  const morningSlots = useMemo(() => slots.filter((s) => s.period === "morning"), [slots]);
  const afternoonSlots = useMemo(() => slots.filter((s) => s.period === "afternoon"), [slots]);
  const eveningSlots = useMemo(() => slots.filter((s) => s.period === "evening"), [slots]);

  const next14 = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 14 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      return d;
    });
  }, []);

  const cost = device ? Math.ceil((device.hourly_rate * duration) / 60) : 0;
  const steps = ["Seat / Rig", "Date & Duration", "Time Slot", "Boarding Pass"];

  const grouped = useMemo(() => {
    const map = new Map<string, Device[]>();
    filteredDevices.forEach((d) => {
      const arr = map.get(d.type) ?? [];
      arr.push(d);
      map.set(d.type, arr);
    });
    return Array.from(map.entries());
  }, [filteredDevices]);

  const availableStationsCount = useMemo(() => {
    return rawDevices.filter((d) => d.status === "available" || d.status === "idle").length;
  }, [rawDevices]);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent
        className="w-full max-sm:h-[92dvh] max-sm:max-h-[92dvh] max-sm:p-0 [&>span]:hidden sm:w-[96vw] sm:max-w-4xl sm:max-h-[88dvh] border-primary/30 bg-[#0c0a15] p-0 overflow-hidden sm:rounded-3xl shadow-[0_50px_120px_-20px_oklch(0.6_0.3_330/0.4)] [&>button]:hidden"
        style={{ perspective: 1400 }}
      >
        <DialogTitle className="sr-only">Reserve Battle Rig at {cafe.name}</DialogTitle>

        {/* Ambient esports lighting */}
        <div className="pointer-events-none absolute inset-0 -z-0 overflow-hidden">
          <ParticleField density={40} />
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage:
                "linear-gradient(oklch(0.7 0.26 335 / 0.1) 1px, transparent 1px), linear-gradient(90deg, oklch(0.7 0.26 335 / 0.1) 1px, transparent 1px)",
              backgroundSize: "32px 32px",
            }}
          />
          <motion.div
            className="absolute -top-32 -left-32 h-96 w-96 rounded-full blur-3xl"
            style={{ background: "oklch(0.7 0.26 335 / 0.35)" }}
            animate={{ x: [0, 40, 0], y: [0, 30, 0] }}
            transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full blur-3xl"
            style={{ background: "oklch(0.65 0.25 220 / 0.35)" }}
            animate={{ x: [0, -40, 0], y: [0, -30, 0] }}
            transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>

        <div className="relative z-10 flex flex-col h-[92dvh] max-h-[92dvh] sm:h-auto sm:max-h-[88dvh]">
          {/* Header */}
          <div className="mobile-keep-blur border-b border-white/10 px-4 sm:px-6 py-3.5 sm:py-4 backdrop-blur-xl bg-black/55">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.25em] text-primary">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
                  </span>
                  Instant Arena Reservation
                </div>
                <h2 className="mt-1 font-display text-xl sm:text-2xl font-black tracking-tight text-white truncate">
                  {cafe.name}
                </h2>
                <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  <span className="flex items-center gap-1 truncate">
                    <MapPin className="h-3 w-3 text-primary shrink-0" />
                    {cafe.city ?? "India"}
                  </span>
                  <span>·</span>
                  <span className="text-emerald-400 font-bold shrink-0">
                    {availableStationsCount} of {rawDevices.length} Rigs Free
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                {device && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-right"
                  >
                    <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                      Live Total
                    </div>
                    <div className="font-display text-xl sm:text-2xl font-black text-gradient-hot tabular-nums">
                      ₹<AnimatedCost value={cost} />
                    </div>
                  </motion.div>
                )}

                {/* Highly visible prominent close cross button */}
                <button
                  type="button"
                  onClick={() => {
                    reset();
                    onOpenChange(false);
                  }}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-white shadow-lg transition hover:bg-rose-500/25 hover:border-rose-500/60 hover:text-rose-200 active:scale-95 cursor-pointer"
                  aria-label="Close booking modal"
                  title="Close (Esc)"
                >
                  <X className="h-5 w-5" strokeWidth={2.5} />
                </button>
              </div>
            </div>

            {/* Stepper HUD */}
            <div className="mt-4 flex items-center gap-2">
              {steps.map((s, i) => (
                <div key={s} className="flex flex-1 items-center gap-2">
                  <motion.div
                    layout
                    className={cn(
                      "grid h-7 w-7 place-items-center rounded-full font-mono text-xs font-bold ring-1 transition-all",
                      i < step && "bg-emerald-500/20 text-emerald-300 ring-emerald-500/40",
                      i === step &&
                        "bg-primary text-primary-foreground ring-primary shadow-[0_0_20px_oklch(0.7_0.26_335/0.8)]",
                      i > step && "bg-white/5 text-white/40 ring-white/10",
                    )}
                  >
                    {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
                  </motion.div>
                  <span
                    className={cn(
                      "hidden text-xs font-semibold sm:inline truncate",
                      i === step ? "text-white" : "text-white/40",
                    )}
                  >
                    {s}
                  </span>
                  {i < steps.length - 1 && (
                    <div className="relative h-px flex-1 overflow-hidden bg-white/10">
                      <motion.div
                        initial={{ x: "-100%" }}
                        animate={{ x: i < step ? "0%" : "-100%" }}
                        transition={{ duration: 0.4 }}
                        className="absolute inset-0 bg-gradient-to-r from-primary to-accent"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-5">
            <div key={step} className="page-reveal">
                {/* STEP 0: RIG & SEAT SELECTION */}
                {step === 0 && (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="font-display text-lg font-bold text-white">
                          Select Battle Station / Seat
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          Choose a desk from the tactical floor matrix or browse by hardware specs.
                        </p>
                      </div>

                      {/* View Mode Toggle */}
                      <div className="inline-flex rounded-xl border border-white/10 bg-white/5 p-1">
                        <button
                          type="button"
                          onClick={() => setViewMode("floor")}
                          className={cn(
                            "flex min-h-[38px] items-center gap-1.5 rounded-lg px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-wider transition",
                            viewMode === "floor"
                              ? "bg-primary text-white shadow"
                              : "text-muted-foreground hover:text-white",
                          )}
                        >
                          <LayoutGrid className="h-3.5 w-3.5" /> Tactical Floor
                        </button>
                        <button
                          type="button"
                          onClick={() => setViewMode("cards")}
                          className={cn(
                            "flex min-h-[38px] items-center gap-1.5 rounded-lg px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-wider transition",
                            viewMode === "cards"
                              ? "bg-primary text-white shadow"
                              : "text-muted-foreground hover:text-white",
                          )}
                        >
                          <Server className="h-3.5 w-3.5" /> Rig Cards
                        </button>
                      </div>
                    </div>

                    {/* Filter Pills — swipeable horizontal rail on mobile */}
                    <div className="-mx-4 flex flex-nowrap gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0 sm:pb-0">
                      {["all", "pc", "console", "ps5", "racing", "vr"].map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setTypeFilter(t)}
                          className={cn(
                            "min-h-[38px] shrink-0 snap-start rounded-full border px-3.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider transition",
                            typeFilter === t
                              ? "border-primary bg-primary/20 text-primary"
                              : "border-white/10 bg-white/5 text-muted-foreground hover:border-white/20 hover:text-white",
                          )}
                        >
                          {t === "all" ? "All Rigs" : t.toUpperCase()}
                        </button>
                      ))}
                    </div>

                    {devicesQ.isLoading ? (
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                        {Array.from({ length: 6 }).map((_, i) => (
                          <div key={i} className="h-32 animate-pulse rounded-2xl bg-white/5" />
                        ))}
                      </div>
                    ) : filteredDevices.length === 0 ? (
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-sm text-muted-foreground">
                        No battle stations found matching this filter.
                      </div>
                    ) : viewMode === "floor" ? (
                      /* TACTICAL ARENA FLOOR MATRIX VIEW */
                      <div className="space-y-4">
                        <div className="rounded-2xl border border-white/10 bg-black/40 p-3 sm:p-5">
                          <div className="mb-3 sm:mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
                            <div className="flex items-center gap-2">
                              <span className="h-2 w-2 rounded-full bg-emerald-400" />
                              <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-white">
                                Arena Battle Floor Map
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <span className="h-2 w-2 rounded-full bg-emerald-400" /> Free
                              </span>
                              <span className="flex items-center gap-1">
                                <span className="h-2 w-2 rounded-full bg-amber-400" /> Occupied
                              </span>
                              <span className="flex items-center gap-1">
                                <span className="h-2 w-2 rounded-full bg-rose-400" /> Maintenance
                              </span>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                            {filteredDevices.map((d, idx) => {
                              const isSelected = device?.id === d.id;
                              const isOccupied = d.status === "occupied" || d.status === "in_use";
                              const isOffline = d.status === "maintenance";
                              const Icon = deviceIcon(d.type);

                              return (
                                <button
                                  key={d.id}
                                  type="button"
                                  disabled={isOffline}
                                  onClick={() => setDevice(d)}
                                  className={cn(
                                    "relative flex flex-col justify-between rounded-xl border p-3 text-left transition-all",
                                    isSelected
                                      ? "border-primary bg-gradient-to-br from-primary/30 to-accent/20 shadow-[0_0_25px_oklch(0.7_0.26_335/0.7)]"
                                      : "border-white/10 bg-white/[0.03] hover:border-white/30 hover:bg-white/[0.06]",
                                    isOffline && "opacity-40 cursor-not-allowed",
                                  )}
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="font-mono text-[10px] font-bold text-muted-foreground">
                                      DESK {String(idx + 1).padStart(2, "0")}
                                    </span>
                                    <span
                                      className={cn(
                                        "h-2 w-2 rounded-full",
                                        isOffline
                                          ? "bg-rose-400"
                                          : isOccupied
                                            ? "bg-amber-400 animate-pulse"
                                            : "bg-emerald-400",
                                      )}
                                    />
                                  </div>

                                  <div className="my-2 flex items-center gap-2">
                                    <div
                                      className={cn(
                                        "rounded-lg p-2",
                                        isSelected
                                          ? "bg-primary text-white"
                                          : "bg-white/10 text-white/70",
                                      )}
                                    >
                                      <Icon className="h-4 w-4" />
                                    </div>
                                    <div className="min-w-0">
                                      <div className="truncate font-display text-sm font-bold text-white">
                                        {d.name}
                                      </div>
                                      <div className="font-mono text-[9px] uppercase text-muted-foreground">
                                        {d.type}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex items-center justify-between border-t border-white/5 pt-2 text-[10px]">
                                    <span className="text-muted-foreground">Rate</span>
                                    <span className="font-mono font-bold text-emerald-400">
                                      ₹{d.hourly_rate}/hr
                                    </span>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* RIG SPEC CARDS */
                      <div className="space-y-6">
                        {grouped.map(([type, rigs]) => {
                          const Icon = deviceIcon(type);
                          return (
                            <div key={type}>
                              <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                                <Icon className="h-3.5 w-3.5 text-primary" />
                                {type} · {rigs.length} Units
                                <div className="ml-2 h-px flex-1 bg-white/10" />
                              </div>
                              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                {rigs.map((d) => {
                                  const selected = device?.id === d.id;
                                  const offline = d.status === "maintenance";
                                  return (
                                    <TiltCard
                                      key={d.id}
                                      selected={selected}
                                      disabled={offline}
                                      onClick={() => setDevice(d)}
                                      className={cn(
                                        "block w-full rounded-2xl border p-4 text-left transition-all",
                                        selected
                                          ? "border-primary bg-primary/20 shadow-[0_0_30px_oklch(0.7_0.26_335/0.8)]"
                                          : "border-white/10 bg-white/5 hover:border-white/20",
                                        offline && "opacity-40 cursor-not-allowed",
                                      )}
                                    >
                                      <div className="flex items-start justify-between">
                                        <div>
                                          <div className="font-display text-base font-bold text-white">
                                            {d.name}
                                          </div>
                                          <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                                            {d.type}
                                          </div>
                                        </div>
                                        <div className="text-right">
                                          <div className="font-display text-lg font-black text-emerald-400 tabular-nums">
                                            ₹{d.hourly_rate}
                                          </div>
                                          <div className="font-mono text-[8px] uppercase text-muted-foreground">
                                            per hr
                                          </div>
                                        </div>
                                      </div>

                                      {formatSpecs(d.specs) && (
                                        <div className="mt-2 text-xs text-white/70 line-clamp-1 font-mono">
                                          {formatSpecs(d.specs)}
                                        </div>
                                      )}
                                    </TiltCard>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* STEP 1: DATE & DURATION */}
                {step === 1 && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="font-display text-lg font-bold text-white">
                        When are you dropping in?
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Select your drop-in day and gaming duration.
                      </p>
                    </div>

                    {/* 14-Day Calendar Strip */}
                    <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-7 sm:gap-2">
                      {next14.map((d) => {
                        const isSelected = fmtDate(d) === fmtDate(date);
                        const isToday = fmtDate(d) === fmtDate(new Date());
                        const isWeekend = d.getDay() === 0 || d.getDay() === 6;

                        return (
                          <motion.button
                            key={d.toISOString()}
                            whileHover={{ y: -2 }}
                            whileTap={{ scale: 0.96 }}
                            onClick={() => {
                              setDate(d);
                              setTime(null);
                            }}
                            className={cn(
                              "relative flex flex-col items-center rounded-xl border p-2 sm:p-3 transition-all",
                              isSelected
                                ? "border-primary bg-primary/20 text-white shadow-[0_0_20px_oklch(0.7_0.26_335/0.8)]"
                                : "border-white/10 bg-white/5 text-muted-foreground hover:border-white/20 hover:text-white",
                            )}
                          >
                            <span
                              className={cn(
                                "font-mono text-[10px] uppercase tracking-wider",
                                isWeekend ? "text-accent font-bold" : "text-muted-foreground",
                              )}
                            >
                              {d.toLocaleDateString("en-IN", { weekday: "short" })}
                            </span>
                            <span className="my-0.5 sm:my-1 font-display text-xl sm:text-2xl font-black text-white">
                              {d.getDate()}
                            </span>
                            <span className="font-mono text-[9px] uppercase">
                              {isToday
                                ? "Today"
                                : d.toLocaleDateString("en-IN", { month: "short" })}
                            </span>
                          </motion.button>
                        );
                      })}
                    </div>

                    {/* Duration Preset Chips */}
                    <div className="rounded-2xl border border-white/10 bg-black/40 p-4 sm:p-5">
                      <div className="mb-3 flex items-center justify-between">
                        <div className="font-mono text-[10px] uppercase tracking-widest text-primary">
                          Session Duration
                        </div>
                        <div className="font-mono text-xs text-emerald-400 font-bold">
                          {duration >= 60 ? `${duration / 60} hrs` : `${duration} mins`} · ₹{cost}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {DURATIONS.map((dur) => (
                          <button
                            key={dur}
                            type="button"
                            onClick={() => setDuration(dur)}
                            className={cn(
                              "min-h-[42px] rounded-xl border px-4 py-2 font-mono text-xs font-bold transition",
                              duration === dur
                                ? "border-primary bg-primary text-white shadow"
                                : "border-white/10 bg-white/5 text-muted-foreground hover:border-white/20 hover:text-white",
                            )}
                          >
                            {dur >= 60 ? `${dur / 60}h` : `${dur}m`}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 2: TIME SLOTS */}
                {step === 2 && (
                  <div className="space-y-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-display text-lg font-bold text-white">
                          Select Start Time Slot
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          {date.toLocaleDateString("en-IN", {
                            weekday: "long",
                            month: "short",
                            day: "numeric",
                          })}{" "}
                          · {duration >= 60 ? `${duration / 60}h` : `${duration}m`} session
                        </p>
                      </div>

                      <div className="flex items-center gap-3 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <span className="h-2 w-2 rounded-full bg-emerald-400" /> Free
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="h-2 w-2 rounded-full bg-rose-400" /> Booked
                        </span>
                      </div>
                    </div>

                    {/* No Slots Left Warning */}
                    {slots.length > 0 && slots.every((s) => s.disabled) && (
                      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 text-center">
                        <p className="font-display font-bold text-amber-200">
                          All slots for this day have ended or are booked.
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Switch to tomorrow to pick your preferred time!
                        </p>
                        <Button
                          size="sm"
                          className="mt-3 text-xs"
                          onClick={() => {
                            const nextDay = new Date(date);
                            nextDay.setDate(nextDay.getDate() + 1);
                            setDate(nextDay);
                            setTime(null);
                          }}
                        >
                          Switch to Tomorrow →
                        </Button>
                      </div>
                    )}

                    {scheduleQ.isLoading ? (
                      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                        {Array.from({ length: 18 }).map((_, i) => (
                          <div key={i} className="h-12 animate-pulse rounded-lg bg-white/5" />
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* Morning Slots */}
                        {morningSlots.length > 0 && (
                          <div>
                            <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                              <Sun className="h-3.5 w-3.5 text-amber-400" />
                              Morning Drop (09:00 - 12:00)
                            </div>
                            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                              {morningSlots.map((s) => (
                                <SlotButton
                                  key={s.iso}
                                  slot={s}
                                  selected={time === s.iso}
                                  onSelect={() => setTime(s.iso)}
                                />
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Afternoon Slots */}
                        {afternoonSlots.length > 0 && (
                          <div>
                            <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                              <Sunset className="h-3.5 w-3.5 text-orange-400" />
                              Afternoon Grind (12:00 - 17:00)
                            </div>
                            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                              {afternoonSlots.map((s) => (
                                <SlotButton
                                  key={s.iso}
                                  slot={s}
                                  selected={time === s.iso}
                                  onSelect={() => setTime(s.iso)}
                                />
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Evening / Night Slots */}
                        {eveningSlots.length > 0 && (
                          <div>
                            <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                              <Moon className="h-3.5 w-3.5 text-primary" />
                              Prime Night & Squad Hours (17:00 - 00:00)
                            </div>
                            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                              {eveningSlots.map((s) => (
                                <SlotButton
                                  key={s.iso}
                                  slot={s}
                                  selected={time === s.iso}
                                  onSelect={() => setTime(s.iso)}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* STEP 3: BOARDING PASS & CONFIRMATION */}
                {step === 3 && device && time && (
                  <div className="space-y-5">
                    {/* HOLOGRAPHIC BOARDING PASS */}
                    <div className="relative overflow-hidden rounded-3xl border border-primary/40 bg-gradient-to-br from-primary/15 via-black/60 to-accent/15 p-6 shadow-2xl">
                      <div className="flex items-center justify-between border-b border-white/10 pb-4">
                        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-primary">
                          <Zap className="h-3.5 w-3.5" /> Cyber Arena Station Pass
                        </div>
                        <span className="font-mono text-xs text-muted-foreground">
                          LOCK PREVIEW
                        </span>
                      </div>

                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        <div className="flex items-start gap-3">
                          <div className="rounded-xl bg-primary/20 p-2 text-primary">
                            <MapPin className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                              Gaming Arena
                            </div>
                            <div className="font-bold text-white text-sm">{cafe.name}</div>
                            <div className="text-xs text-muted-foreground">{cafe.city ?? "India"}</div>
                          </div>
                        </div>

                        <div className="flex items-start gap-3">
                          <div className="rounded-xl bg-primary/20 p-2 text-primary">
                            <Gamepad2 className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                              Battle Station
                            </div>
                            <div className="font-bold text-white text-sm">
                              {device.name} · {device.type.toUpperCase()}
                            </div>
                            <div className="text-xs text-emerald-400 font-mono">Instant Seat Lock</div>
                          </div>
                        </div>

                        <div className="flex items-start gap-3">
                          <div className="rounded-xl bg-primary/20 p-2 text-primary">
                            <Calendar className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                              Session Date
                            </div>
                            <div className="font-bold text-white text-sm">
                              {new Date(time).toLocaleDateString("en-IN", {
                                weekday: "short",
                                month: "short",
                                day: "numeric",
                              })}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-start gap-3">
                          <div className="rounded-xl bg-primary/20 p-2 text-primary">
                            <Clock className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                              Time & Length
                            </div>
                            <div className="font-bold text-white text-sm">
                              {new Date(time).toLocaleTimeString("en-IN", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}{" "}
                              ({duration >= 60 ? `${duration / 60}h` : `${duration}m`})
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="mt-5 flex items-end justify-between border-t border-white/10 pt-4">
                        <div>
                          <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                            Payable on Arrival
                          </div>
                          <div className="font-display text-4xl font-black text-gradient-hot tabular-nums">
                            ₹<AnimatedCost value={cost} />
                          </div>
                        </div>

                        <div className="flex items-center gap-2 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-xs font-bold text-emerald-300">
                          <ShieldCheck className="h-4 w-4" /> 100% Free Cancellation
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-center">
                      <div className="font-bold text-sm text-white">Payment at Counter</div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Pay with Cash, UPI, or Card directly at the counter upon arrival.
                      </p>
                    </div>
                  </div>
                )}
            </div>
          </div>

          {/* Dialog Footer Actions */}
          <div
            className="mobile-keep-blur flex items-center justify-between gap-2 border-t border-white/10 bg-black/55 px-4 pt-3 sm:px-6 sm:py-4 backdrop-blur-xl"
            style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0.75rem)" }}
          >
            <Button
              variant="ghost"
              size="sm"
              disabled={step === 0}
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              className="min-h-[44px] text-muted-foreground hover:text-white"
            >
              <ChevronLeft className="h-4 w-4 mr-1" /> Back
            </Button>

            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Step {step + 1} of 4
            </div>

            {step < 3 ? (
              <Button
                size="sm"
                disabled={(step === 0 && !device) || (step === 2 && !time)}
                onClick={() => setStep((s) => Math.min(3, s + 1))}
                style={{ background: "var(--gradient-brand-hot)" }}
                className="min-h-[44px] px-4 font-bold text-white shadow-lg"
              >
                Continue <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button
                size="sm"
                disabled={book.isPending || !device || !time}
                onClick={() =>
                  book.mutate({
                    data: {
                      device_id: device!.id,
                      scheduled_at: time!,
                      duration_minutes: duration,
                      payment_method: paymentMethod,
                    },
                  })
                }
                style={{ background: "var(--gradient-brand-hot)" }}
                className="min-h-[44px] px-4 font-bold text-white shadow-xl"
              >
                <Sparkles className="h-4 w-4 mr-1" />
                {book.isPending ? "Locking Seat…" : "Confirm"}
              </Button>
            )}
          </div>
        </div>

        {/* Celebration Burst */}
        <AnimatePresence>
          {burst && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="pointer-events-none absolute inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: [0, 1.2, 1] }}
                transition={{ duration: 0.5 }}
                className="grid h-24 w-24 place-items-center rounded-full bg-gradient-to-br from-primary to-accent shadow-[0_0_60px_oklch(0.7_0.26_335/0.9)]"
              >
                <Check className="h-12 w-12 text-white" strokeWidth={3} />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}

function SlotButton({
  slot,
  selected,
  onSelect,
}: {
  slot: {
    iso: string;
    label: string;
    disabled: boolean;
    past: boolean;
    bookedMinutes: number;
  };
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      disabled={slot.disabled}
      onClick={onSelect}
      className={cn(
        "relative flex h-11 flex-col items-center justify-center rounded-xl border font-mono text-xs font-bold transition-all",
        slot.past && "cursor-not-allowed border-white/5 bg-white/[0.02] text-white/20 line-through",
        slot.disabled &&
          !slot.past &&
          "cursor-not-allowed border-rose-500/30 bg-rose-500/10 text-rose-300/80",
        !slot.disabled &&
          !selected &&
          "border-white/10 bg-white/5 text-white hover:border-primary/50 hover:bg-primary/10",
        selected &&
          "border-primary bg-primary text-white shadow-[0_0_20px_oklch(0.7_0.26_335/0.8)] scale-105",
      )}
    >
      <span>{slot.label}</span>
      {slot.disabled && !slot.past && (
        <span className="text-[8px] text-rose-300 font-normal">Booked</span>
      )}
    </button>
  );
}
