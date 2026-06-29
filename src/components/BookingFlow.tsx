import { useMemo, useState, useRef, useEffect } from "react";
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Calendar, Clock, Gamepad2, Check, ChevronRight, ChevronLeft, Sparkles, Zap,
  MapPin, Cpu, Monitor, Joystick, Headphones, Tv,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ParticleField } from "@/components/ParticleField";
import { getCafeDevicesPublic, getDeviceSchedule, customerBookDevice } from "@/lib/portal.functions";
import { createBookingOrder, verifyBookingPayment } from "@/lib/razorpay.functions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type RzpOptions = {
  key: string; amount: number; currency: string; order_id: string;
  name: string; description: string;
  handler: (r: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => void;
  prefill?: { name?: string; email?: string; contact?: string };
  modal?: { ondismiss?: () => void };
  theme?: { color?: string };
};
type RzpCtor = new (o: RzpOptions) => { open: () => void };
declare global { interface Window { Razorpay?: RzpCtor } }

function loadRazorpay(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if (window.Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(!!window.Razorpay);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

type Device = { id: string; name: string; type: string; hourly_rate: number; status: string };
type Cafe = { id: string; name: string; city?: string | null };

const DURATIONS = [30, 60, 90, 120, 180, 240];

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
function TiltCard({ children, className, onClick, disabled, selected }: {
  children: React.ReactNode; className?: string; onClick?: () => void;
  disabled?: boolean; selected?: boolean;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rx = useSpring(useTransform(y, [-50, 50], [10, -10]), { stiffness: 200, damping: 20 });
  const ry = useSpring(useTransform(x, [-50, 50], [-10, 10]), { stiffness: 200, damping: 20 });
  const gx = useTransform(x, [-50, 50], [0, 100]);
  const gy = useTransform(y, [-50, 50], [0, 100]);

  return (
    <motion.button
      ref={ref}
      disabled={disabled}
      onClick={onClick}
      onMouseMove={(e) => {
        const r = ref.current!.getBoundingClientRect();
        x.set(e.clientX - r.left - r.width / 2);
        y.set(e.clientY - r.top - r.height / 2);
      }}
      onMouseLeave={() => { x.set(0); y.set(0); }}
      style={{ rotateX: rx, rotateY: ry, transformPerspective: 1000 }}
      whileTap={{ scale: 0.97 }}
      className={cn("relative will-change-transform", className)}
    >
      <motion.div
        className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity hover:opacity-100"
        style={{
          background: useTransform([gx, gy], ([gxv, gyv]) =>
            `radial-gradient(circle at ${gxv}% ${gyv}%, oklch(0.78 0.22 335 / 0.4), transparent 60%)`),
          opacity: selected ? 1 : undefined,
        }}
      />
      {children}
    </motion.button>
  );
}

function AnimatedCost({ value }: { value: number }) {
  const mv = useSpring(0, { stiffness: 80, damping: 18 });
  const [display, setDisplay] = useState(0);
  useEffect(() => { mv.set(value); }, [value, mv]);
  useEffect(() => mv.on("change", (v) => setDisplay(Math.round(v))), [mv]);
  return <>{display.toLocaleString("en-IN")}</>;
}

export function BookingFlow({
  open, onOpenChange, cafe, onBooked,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  cafe: Cafe;
  onBooked?: () => void;
}) {
  const [step, setStep] = useState(0);
  const [device, setDevice] = useState<Device | null>(null);
  const [date, setDate] = useState<Date>(() => new Date());
  const [time, setTime] = useState<string | null>(null);
  const [duration, setDuration] = useState(60);
  const [burst, setBurst] = useState(false);

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
    enabled: open && step >= 2,
  });

  const paymentMethod = "pay_at_cafe" as const;

  const createOrderFn = useServerFn(createBookingOrder);
  const verifyPayFn = useServerFn(verifyBookingPayment);

  const finishSuccess = () => {
    setBurst(true);
    setTimeout(() => {
      toast.success("Booking confirmed! Check My Bookings.");
      onBooked?.();
      reset();
      onOpenChange(false);
    }, 900);
  };

  const book = useMutation({
    mutationFn: bookFn,
    onSuccess: async (row) => {
      if (paymentMethod !== "pay_online") {
        finishSuccess();
        return;
      }
      try {
        const ok = await loadRazorpay();
        if (!ok || !window.Razorpay) throw new Error("Could not load Razorpay");
        const order = await createOrderFn({ data: { booking_id: (row as { id: string }).id } });
        // Close the booking dialog FIRST so Radix releases pointer-events / focus trap,
        // otherwise the Razorpay checkout overlay is unclickable.
        onOpenChange(false);
        // Wait a tick for Radix to fully unmount before opening Razorpay's overlay.
        await new Promise((r) => setTimeout(r, 60));
        const rzp = new window.Razorpay({
          key: order.key_id,
          amount: order.amount * 100,
          currency: order.currency,
          order_id: order.order_id,
          name: cafe.name,
          description: `Booking · ${device?.name ?? ""}`,
          theme: { color: "#e94db1" },
          handler: async (resp) => {
            try {
              await verifyPayFn({
                data: {
                  booking_id: order.booking_id,
                  razorpay_order_id: resp.razorpay_order_id,
                  razorpay_payment_id: resp.razorpay_payment_id,
                  razorpay_signature: resp.razorpay_signature,
                },
              });
              setBurst(true);
              setTimeout(() => {
                toast.success("Payment received! Booking confirmed.");
                onBooked?.();
                reset();
              }, 400);
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Payment verification failed");
            }
          },
          modal: { ondismiss: () => toast("Payment cancelled — booking still pending. Pay from My Bookings.") },
        });
        rzp.open();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Payment failed to start");
      }
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Booking failed"),
  });

  const reset = () => {
    setStep(0); setDevice(null); setTime(null); setDuration(60); setDate(new Date()); setBurst(false);
  };

  const slots = useMemo(() => {
    const out: { iso: string; label: string; disabled: boolean; past: boolean; bookedMinutes: number }[] = [];
    const now = Date.now();
    for (let h = 9; h < 24; h++) {
      for (let m = 0; m < 60; m += 30) {
        const dt = new Date(date); dt.setHours(h, m, 0, 0);
        const iso = dt.toISOString();
        const past = dt.getTime() < now;
        const slotEnd = dt.getTime() + duration * 60_000;
        let disabled = past;
        let bookedMinutes = 0;
        for (const b of scheduleQ.data ?? []) {
          if (b.device_id !== device?.id) continue;
          const bs = new Date(b.scheduled_at).getTime();
          const be = bs + b.duration_minutes * 60_000;
          if (bs < slotEnd && be > dt.getTime()) {
            disabled = true;
            if (b.duration_minutes > bookedMinutes) bookedMinutes = b.duration_minutes;
            break;
          }
        }
        out.push({
          iso,
          label: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`,
          disabled, past, bookedMinutes,
        });
      }
    }
    return out;
  }, [date, scheduleQ.data, device, duration]);

  const next14 = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 14 }, (_, i) => {
      const d = new Date(today); d.setDate(today.getDate() + i); return d;
    });
  }, []);

  const cost = device ? Math.ceil((device.hourly_rate * duration) / 60) : 0;
  const steps = ["Rig", "Date", "Time", "Confirm"];

  // Group devices by type for floor-plan feel
  const grouped = useMemo(() => {
    const map = new Map<string, Device[]>();
    (devicesQ.data ?? []).forEach((d) => {
      const arr = map.get(d.type) ?? []; arr.push(d as Device); map.set(d.type, arr);
    });
    return Array.from(map.entries());
  }, [devicesQ.data]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent
        className="max-w-5xl border-primary/30 bg-gradient-to-br from-[oklch(0.13_0.05_310)] via-[oklch(0.1_0.04_280)] to-[oklch(0.08_0.03_260)] p-0 overflow-hidden shadow-[0_50px_120px_-20px_oklch(0.6_0.3_330/0.5)]"
        style={{ perspective: 1400 }}
      >
        <DialogTitle className="sr-only">Book at {cafe.name}</DialogTitle>

        {/* Layered immersive backdrop */}
        <div className="pointer-events-none absolute inset-0 -z-0 overflow-hidden">
          <ParticleField density={50} />
          <div className="absolute inset-0 opacity-30" style={{
            backgroundImage: "linear-gradient(oklch(0.7 0.26 335 / 0.08) 1px, transparent 1px), linear-gradient(90deg, oklch(0.7 0.26 335 / 0.08) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
            maskImage: "radial-gradient(ellipse at center, black 30%, transparent 80%)",
          }} />
          <motion.div
            className="absolute -top-32 -left-32 h-96 w-96 rounded-full blur-3xl"
            style={{ background: "oklch(0.7 0.26 335 / 0.45)" }}
            animate={{ x: [0, 60, 0], y: [0, 40, 0] }}
            transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full blur-3xl"
            style={{ background: "oklch(0.65 0.25 220 / 0.45)" }}
            animate={{ x: [0, -50, 0], y: [0, -30, 0] }}
            transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>

        <div className="relative z-10">
          {/* Header */}
          <div className="border-b border-white/10 px-6 py-5 backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <div>
                <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.28em] text-primary shadow-[0_0_20px_-4px_oklch(0.7_0.26_335/0.8)]">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
                  </span>
                  Reserve a rig
                </div>
                <h2 className="mt-2 font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
                  <span className="text-gradient-hot">{cafe.name}</span>
                </h2>
                <div className="mt-1 flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.22em] text-white/50">
                  <MapPin className="h-3 w-3" />{cafe.city ?? "—"}
                </div>
              </div>
              {device && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                  className="hidden text-right sm:block"
                >
                  <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-white/50">Live total</div>
                  <div className="font-display text-3xl font-extrabold text-gradient-hot tabular-nums">
                    ₹<AnimatedCost value={cost} />
                  </div>
                </motion.div>
              )}
            </div>

            {/* Stepper */}
            <div className="mt-5 flex items-center gap-2">
              {steps.map((s, i) => (
                <div key={s} className="flex flex-1 items-center gap-2">
                  <motion.div
                    layout
                    className={cn(
                      "grid h-8 w-8 place-items-center rounded-full font-mono text-xs font-bold ring-1",
                      i < step && "bg-emerald-500/20 text-emerald-300 ring-emerald-500/40",
                      i === step && "bg-primary text-primary-foreground ring-primary shadow-[0_0_24px_oklch(0.7_0.26_335/0.9)]",
                      i > step && "bg-white/5 text-white/40 ring-white/10",
                    )}
                  >
                    {i < step ? <Check className="h-4 w-4" /> : i + 1}
                  </motion.div>
                  <span className={cn(
                    "hidden text-xs font-semibold sm:inline",
                    i === step ? "text-white" : "text-white/40",
                  )}>{s}</span>
                  {i < steps.length - 1 && (
                    <div className="relative h-px flex-1 overflow-hidden bg-white/10">
                      <motion.div
                        initial={{ x: "-100%" }}
                        animate={{ x: i < step ? "0%" : "-100%" }}
                        transition={{ duration: 0.5 }}
                        className="absolute inset-0 bg-gradient-to-r from-primary to-accent"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Body */}
          <div className="max-h-[58vh] overflow-y-auto px-6 py-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 40, rotateY: 15 }}
                animate={{ opacity: 1, x: 0, rotateY: 0 }}
                exit={{ opacity: 0, x: -40, rotateY: -15 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                style={{ transformPerspective: 1200 }}
              >
                {/* Step 0 — DEVICES (floor plan) */}
                {step === 0 && (
                  <div>
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <h3 className="font-display text-lg font-bold">Choose your battle station</h3>
                        <p className="text-xs text-white/50">Live availability · 3D preview · tilt to inspect</p>
                      </div>
                      <Badge variant="secondary" className="bg-white/5 text-white/70">
                        {(devicesQ.data ?? []).length} rigs
                      </Badge>
                    </div>
                    {devicesQ.isLoading ? (
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {Array.from({ length: 6 }).map((_, i) => (
                          <div key={i} className="h-36 animate-pulse rounded-2xl bg-white/5" />
                        ))}
                      </div>
                    ) : grouped.length === 0 ? (
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-10 text-center text-sm text-white/60">
                        No rigs configured at this café yet.
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {grouped.map(([type, rigs]) => {
                          const Icon = deviceIcon(type);
                          return (
                            <div key={type}>
                              <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-white/50">
                                <Icon className="h-3.5 w-3.5 text-primary" />
                                {type} <span className="text-white/30">· {rigs.length}</span>
                                <div className="ml-2 h-px flex-1 bg-white/10" />
                              </div>
                              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                {rigs.map((d, idx) => {
                                  const selected = device?.id === d.id;
                                  const offline = d.status === "maintenance" || d.status === "occupied";
                                  return (
                                    <motion.div
                                      key={d.id}
                                      initial={{ opacity: 0, y: 12 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      transition={{ delay: idx * 0.05 }}
                                    >
                                      <TiltCard
                                        selected={selected}
                                        disabled={offline}
                                        onClick={() => setDevice(d)}
                                        className={cn(
                                          "block w-full rounded-2xl border p-4 text-left transition-all",
                                          selected
                                            ? "border-primary bg-gradient-to-br from-primary/25 via-primary/10 to-accent/15 shadow-[0_0_40px_-6px_oklch(0.7_0.26_335/0.9)]"
                                            : "border-white/10 bg-white/5 hover:border-primary/40 hover:bg-white/10",
                                          offline && "opacity-40 cursor-not-allowed",
                                        )}
                                      >
                                        {/* mini console mockup */}
                                        <div className="relative mb-3 flex h-20 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-black/60 to-black/30">
                                          <div className="absolute inset-0 opacity-40" style={{
                                            backgroundImage: "repeating-linear-gradient(0deg, oklch(0.7 0.26 335 / 0.15) 0 1px, transparent 1px 4px)",
                                          }} />
                                          <motion.div
                                            animate={selected ? { scale: [1, 1.15, 1] } : {}}
                                            transition={{ duration: 1.6, repeat: Infinity }}
                                            className={cn(
                                              "grid h-12 w-12 place-items-center rounded-lg",
                                              selected ? "bg-primary text-primary-foreground shadow-[0_0_30px_oklch(0.7_0.26_335/0.8)]" : "bg-white/10 text-white/70",
                                            )}
                                          >
                                            <Icon className="h-6 w-6" />
                                          </motion.div>
                                          {!offline && (
                                            <div className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-emerald-500/20 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.18em] text-emerald-300">
                                              <span className="relative flex h-1 w-1">
                                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-75" />
                                                <span className="relative inline-flex h-1 w-1 rounded-full bg-emerald-300" />
                                              </span>
                                              live
                                            </div>
                                          )}
                                          {offline && (
                                            <div className="absolute right-2 top-2 rounded-full bg-red-500/20 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.18em] text-red-300">
                                              {d.status}
                                            </div>
                                          )}
                                        </div>
                                        <div className="flex items-end justify-between">
                                          <div>
                                            <div className="font-display text-base font-bold text-white">{d.name}</div>
                                            <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/50">{d.type}</div>
                                          </div>
                                          <div className="text-right">
                                            <div className="font-display text-lg font-extrabold text-azure tabular-nums">₹{d.hourly_rate}</div>
                                            <div className="font-mono text-[9px] uppercase text-white/40">/hour</div>
                                          </div>
                                        </div>
                                      </TiltCard>
                                    </motion.div>
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

                {/* Step 1 — DATE */}
                {step === 1 && (
                  <div>
                    <h3 className="mb-1 font-display text-lg font-bold">When are you dropping in?</h3>
                    <p className="mb-4 text-xs text-white/50">Next 14 days · pick duration below</p>

                    <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                      {next14.map((d, i) => {
                        const selected = fmtDate(d) === fmtDate(date);
                        const isToday = fmtDate(d) === fmtDate(new Date());
                        const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                        return (
                          <motion.button
                            key={d.toISOString()}
                            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.02 }}
                            whileHover={{ y: -3, scale: 1.04 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setDate(d)}
                            className={cn(
                              "relative overflow-hidden rounded-xl border p-3 text-center transition-all",
                              selected
                                ? "border-primary bg-gradient-to-br from-primary/30 to-accent/20 shadow-[0_0_28px_-4px_oklch(0.7_0.26_335/0.9)]"
                                : "border-white/10 bg-white/5 hover:border-primary/40 hover:bg-white/10",
                            )}
                          >
                            {selected && (
                              <motion.div layoutId="date-glow" className="absolute inset-0 -z-10 bg-primary/10" />
                            )}
                            <div className={cn(
                              "font-mono text-[10px] uppercase tracking-[0.2em]",
                              isWeekend ? "text-accent" : "text-white/50",
                            )}>
                              {d.toLocaleDateString("en-IN", { weekday: "short" })}
                            </div>
                            <div className="mt-1 font-display text-2xl font-extrabold text-white">
                              {d.getDate()}
                            </div>
                            <div className="font-mono text-[9px] uppercase text-white/40">
                              {isToday ? "today" : d.toLocaleDateString("en-IN", { month: "short" })}
                            </div>
                          </motion.button>
                        );
                      })}
                    </div>

                    <div className="mt-7">
                      <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.22em] text-white/50">
                        Session length
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {DURATIONS.map((d) => (
                          <motion.button
                            key={d}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setDuration(d)}
                            className={cn(
                              "relative rounded-full border px-5 py-2 text-sm font-semibold transition",
                              duration === d
                                ? "border-primary bg-primary/20 text-primary shadow-[0_0_18px_oklch(0.7_0.26_335/0.6)]"
                                : "border-white/10 bg-white/5 text-white/60 hover:border-primary/40 hover:text-white",
                            )}
                          >
                            {d >= 60 ? `${d / 60}h` : `${d}m`}
                          </motion.button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 2 — TIME */}
                {step === 2 && (
                  <div>
                    <h3 className="mb-1 font-display text-lg font-bold">Lock your slot</h3>
                    <p className="mb-3 text-xs text-white/50">
                      {date.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
                    </p>
                    <div className="mb-4 flex flex-wrap items-center gap-3 font-mono text-[10px] uppercase tracking-[0.18em] text-white/50">
                      <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-400" /> Free</span>
                      <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-400/70" /> Booked</span>
                      <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-white/20" /> Past</span>
                    </div>

                    {scheduleQ.isLoading ? (
                      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8">
                        {Array.from({ length: 24 }).map((_, i) => (
                          <div key={i} className="h-14 animate-pulse rounded-lg bg-white/5" />
                        ))}
                      </div>
                    ) : (
                      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8">
                        {slots.map((s, i) => {
                          const selected = time === s.iso;
                          const isBooked = s.disabled && !s.past;
                          const bookedLabel = s.bookedMinutes >= 60
                            ? `${(s.bookedMinutes / 60) % 1 === 0 ? s.bookedMinutes / 60 : (s.bookedMinutes / 60).toFixed(1)}h`
                            : `${s.bookedMinutes}m`;
                          return (
                            <motion.button
                              key={s.iso}
                              initial={{ opacity: 0, scale: 0.85 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: i * 0.008 }}
                              disabled={s.disabled}
                              whileHover={!s.disabled ? { scale: 1.08, y: -2 } : {}}
                              whileTap={!s.disabled ? { scale: 0.95 } : {}}
                              onClick={() => setTime(s.iso)}
                              title={isBooked ? `Booked for ${bookedLabel}` : s.past ? "Past slot" : "Available"}
                              className={cn(
                                "relative flex h-14 flex-col items-center justify-center rounded-lg border px-2 py-2 font-mono text-xs font-bold transition-all",
                                s.past && "cursor-not-allowed border-white/5 bg-white/[0.02] text-white/20 line-through",
                                isBooked && "cursor-not-allowed border-red-500/30 bg-red-500/10 text-red-300/80",
                                !s.disabled && !selected && "border-white/10 bg-white/5 text-white hover:border-primary/60 hover:bg-primary/10 hover:text-primary",
                                selected && "border-primary bg-primary text-primary-foreground shadow-[0_0_22px_oklch(0.7_0.26_335/0.9)] scale-110",
                              )}
                            >
                              {selected && (
                                <motion.span
                                  className="absolute inset-0 rounded-lg ring-2 ring-primary/60"
                                  animate={{ scale: [1, 1.35], opacity: [0.8, 0] }}
                                  transition={{ duration: 1.2, repeat: Infinity }}
                                />
                              )}
                              <span>{s.label}</span>
                              {isBooked && (
                                <span className="mt-0.5 font-mono text-[8px] uppercase tracking-[0.16em] text-red-300/90">
                                  Booked {bookedLabel}
                                </span>
                              )}
                            </motion.button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Step 3 — CONFIRM */}
                {step === 3 && device && time && (
                  <div className="space-y-5">
                    <div className="relative overflow-hidden rounded-3xl border border-primary/40 bg-gradient-to-br from-primary/15 via-card/40 to-accent/15 p-6 shadow-[0_30px_60px_-20px_oklch(0.7_0.26_335/0.5)]">
                      <motion.div
                        className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full opacity-50 blur-3xl"
                        style={{ background: "oklch(0.7 0.26 335)" }}
                        animate={{ scale: [1, 1.3, 1], opacity: [0.4, 0.6, 0.4] }}
                        transition={{ duration: 4, repeat: Infinity }}
                      />
                      <div className="relative">
                        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.24em] text-primary">
                          <Zap className="h-3.5 w-3.5" /> Boarding pass
                        </div>
                        <div className="mt-4 grid gap-4 sm:grid-cols-2">
                          <Row icon={MapPin} label="Café" value={cafe.name} />
                          <Row icon={Gamepad2} label="Rig" value={`${device.name} · ${device.type.toUpperCase()}`} />
                          <Row icon={Calendar} label="Date" value={new Date(time).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })} />
                          <Row icon={Clock} label="Time" value={`${new Date(time).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} · ${duration >= 60 ? `${duration / 60}h` : `${duration}m`}`} />
                        </div>
                        <div className="mt-6 flex items-end justify-between border-t border-white/10 pt-5">
                          <div>
                            <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-white/50">Total payable</div>
                            <div className="font-display text-5xl font-extrabold text-gradient-hot tabular-nums">
                              ₹<AnimatedCost value={cost} />
                            </div>
                          </div>
                        </div>
                      </div>
                      {/* ticket perforations */}
                      <div className="absolute -left-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-background" />
                      <div className="absolute -right-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-background" />
                    </div>

                    <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-center">
                      <div className="font-display text-base font-bold text-emerald-200">Pay at the café counter</div>
                      <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-emerald-100/70">
                        Cash · Card · UPI on arrival
                      </div>
                    </div>

                    <p className="text-center text-xs text-white/50">
                      Your booking starts <Badge variant="secondary" className="mx-1 bg-white/10">pending</Badge> until the café confirms · Free cancellation anytime
                    </p>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-2 border-t border-white/10 bg-black/30 px-6 py-4 backdrop-blur-xl">
            <Button
              variant="ghost" size="sm"
              disabled={step === 0}
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              className="text-white/70 hover:bg-white/5 hover:text-white"
            >
              <ChevronLeft className="h-4 w-4" /> Back
            </Button>
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/40">
              Step {step + 1} / 4
            </div>
            {step < 3 ? (
              <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}>
                <Button
                  size="sm"
                  disabled={(step === 0 && !device) || (step === 2 && !time)}
                  onClick={() => setStep((s) => Math.min(3, s + 1))}
                  style={{ background: "var(--gradient-brand-hot)" }}
                  className="shadow-[0_0_24px_-4px_oklch(0.7_0.26_335/0.8)]"
                >
                  Continue <ChevronRight className="h-4 w-4" />
                </Button>
              </motion.div>
            ) : (
              <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}>
                <Button
                  size="sm" disabled={book.isPending || !device || !time}
                  onClick={() => book.mutate({ data: { device_id: device!.id, scheduled_at: time!, duration_minutes: duration, payment_method: paymentMethod } })}
                  style={{ background: "var(--gradient-brand-hot)" }}
                  className="shadow-[0_0_30px_-2px_oklch(0.7_0.26_335/0.9)]"
                >
                  <Sparkles className="h-4 w-4" />
                  {book.isPending ? "Locking it in…" : paymentMethod === "pay_online" ? `Pay ₹${cost} & lock` : "Confirm & lock"}
                </Button>
              </motion.div>
            )}
          </div>
        </div>

        {/* Confetti burst */}
        <AnimatePresence>
          {burst && (
            <motion.div
              initial={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="pointer-events-none absolute inset-0 z-50 grid place-items-center"
            >
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: [0, 1.4, 1], opacity: [0, 1, 1] }}
                transition={{ duration: 0.8 }}
                className="grid h-32 w-32 place-items-center rounded-full bg-gradient-to-br from-primary to-accent shadow-[0_0_80px_oklch(0.7_0.26_335/0.9)]"
              >
                <Check className="h-16 w-16 text-white" strokeWidth={3} />
              </motion.div>
              {Array.from({ length: 24 }).map((_, i) => {
                const angle = (i / 24) * Math.PI * 2;
                return (
                  <motion.span
                    key={i}
                    className="absolute h-2 w-2 rounded-full"
                    style={{ background: i % 2 ? "oklch(0.7 0.26 335)" : "oklch(0.7 0.2 220)" }}
                    initial={{ x: 0, y: 0, opacity: 1 }}
                    animate={{
                      x: Math.cos(angle) * 220,
                      y: Math.sin(angle) * 220,
                      opacity: 0,
                      scale: [1, 1.5, 0],
                    }}
                    transition={{ duration: 0.9, ease: "easeOut" }}
                  />
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}

function Row({ icon: Icon, label, value }: { icon: typeof Calendar; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-lg bg-primary/15 text-primary ring-1 ring-primary/30">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className="font-mono text-[9px] uppercase tracking-[0.24em] text-white/50">{label}</div>
        <div className="truncate text-sm font-semibold text-white">{value}</div>
      </div>
    </div>
  );
}
