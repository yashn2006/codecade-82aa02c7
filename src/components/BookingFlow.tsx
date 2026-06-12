import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Calendar, Clock, Gamepad2, Check, ChevronRight, ChevronLeft, Sparkles, Zap, MapPin } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getCafeDevicesPublic, getDeviceSchedule, customerBookDevice } from "@/lib/portal.functions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Device = { id: string; name: string; type: string; hourly_rate: number; status: string };
type Cafe = { id: string; name: string; city?: string | null };

const DURATIONS = [30, 60, 90, 120, 180, 240];

function fmtDate(d: Date) {
  return d.toISOString().slice(0, 10);
}
function localDateOnly(s: string) {
  const d = new Date(s);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
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
  const [step, setStep] = useState(0);
  const [device, setDevice] = useState<Device | null>(null);
  const [date, setDate] = useState<Date>(() => new Date());
  const [time, setTime] = useState<string | null>(null); // ISO
  const [duration, setDuration] = useState(60);

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

  const book = useMutation({
    mutationFn: bookFn,
    onSuccess: () => {
      toast.success("Booking confirmed! Check My Bookings.");
      onBooked?.();
      reset();
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Booking failed"),
  });

  const reset = () => {
    setStep(0); setDevice(null); setTime(null); setDuration(60); setDate(new Date());
  };

  const slots = useMemo(() => {
    // 30-min slots from 09:00 to 23:30
    const out: { iso: string; label: string; disabled: boolean; past: boolean }[] = [];
    const now = Date.now();
    for (let h = 9; h < 24; h++) {
      for (let m = 0; m < 60; m += 30) {
        const dt = new Date(date);
        dt.setHours(h, m, 0, 0);
        const iso = dt.toISOString();
        const past = dt.getTime() < now;
        const slotEnd = dt.getTime() + duration * 60_000;
        let disabled = past;
        for (const b of scheduleQ.data ?? []) {
          if (b.device_id !== device?.id) continue;
          const bs = new Date(b.scheduled_at).getTime();
          const be = bs + b.duration_minutes * 60_000;
          if (bs < slotEnd && be > dt.getTime()) { disabled = true; break; }
        }
        out.push({
          iso,
          label: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`,
          disabled, past,
        });
      }
    }
    return out;
  }, [date, scheduleQ.data, device, duration]);

  const next7 = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 14 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      return d;
    });
  }, []);

  const cost = device ? Math.ceil((device.hourly_rate * duration) / 60) : 0;

  const steps = ["Device", "Date", "Time", "Confirm"];

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-3xl border-primary/30 bg-gradient-to-br from-card via-card to-card/40 p-0 overflow-hidden">
        <div className="relative">
          {/* glow */}
          <div className="pointer-events-none absolute inset-0 -z-10 opacity-60">
            <div className="absolute -top-20 -left-20 h-64 w-64 rounded-full bg-primary/30 blur-3xl" />
            <div className="absolute -bottom-20 -right-20 h-64 w-64 rounded-full bg-accent/30 blur-3xl" />
          </div>

          <DialogHeader className="border-b border-border/50 px-6 py-4">
            <DialogTitle className="flex items-center gap-2 font-display text-2xl">
              <Sparkles className="h-5 w-5 text-primary" />
              Book at <span className="text-gradient-hot">{cafe.name}</span>
            </DialogTitle>
            <div className="mt-1 flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              <MapPin className="h-3 w-3" />{cafe.city ?? "—"}
            </div>
          </DialogHeader>

          {/* stepper */}
          <div className="flex items-center justify-between gap-2 border-b border-border/40 bg-secondary/20 px-6 py-3">
            {steps.map((s, i) => (
              <div key={s} className="flex flex-1 items-center gap-2">
                <div className={cn(
                  "grid h-7 w-7 place-items-center rounded-full font-mono text-xs font-bold transition-all",
                  i < step && "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40",
                  i === step && "bg-primary text-primary-foreground shadow-[0_0_20px_oklch(0.7_0.26_335/0.7)]",
                  i > step && "bg-secondary text-muted-foreground",
                )}>
                  {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </div>
                <span className={cn(
                  "hidden text-xs font-medium sm:inline",
                  i === step ? "text-foreground" : "text-muted-foreground",
                )}>{s}</span>
                {i < steps.length - 1 && <div className="h-px flex-1 bg-border/50" />}
              </div>
            ))}
          </div>

          <div className="max-h-[60vh] overflow-y-auto px-6 py-5">
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                {step === 0 && (
                  <div>
                    <p className="mb-4 text-sm text-muted-foreground">Pick your rig. Each one has live status.</p>
                    {devicesQ.isLoading ? (
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {Array.from({ length: 6 }).map((_, i) => (
                          <div key={i} className="h-24 animate-pulse rounded-xl bg-secondary/50" />
                        ))}
                      </div>
                    ) : (devicesQ.data ?? []).length === 0 ? (
                      <div className="rounded-xl border border-border/60 bg-card/40 p-8 text-center text-sm text-muted-foreground">
                        No rigs configured at this café yet.
                      </div>
                    ) : (
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {(devicesQ.data ?? []).map((d) => {
                          const selected = device?.id === d.id;
                          const offline = d.status === "maintenance";
                          return (
                            <button
                              key={d.id}
                              disabled={offline}
                              onClick={() => setDevice(d as Device)}
                              className={cn(
                                "group relative overflow-hidden rounded-xl border p-4 text-left transition-all",
                                selected
                                  ? "border-primary bg-primary/10 shadow-[0_0_30px_-8px_oklch(0.7_0.26_335/0.9)] scale-[1.02]"
                                  : "border-border/60 bg-card/40 hover:border-primary/40 hover:bg-card/70",
                                offline && "opacity-50 cursor-not-allowed",
                              )}
                            >
                              <div className="flex items-start justify-between">
                                <Gamepad2 className={cn("h-5 w-5", selected ? "text-primary" : "text-muted-foreground")} />
                                <Badge variant={d.status === "available" ? "secondary" : "destructive"} className="text-[9px]">
                                  {d.status}
                                </Badge>
                              </div>
                              <div className="mt-2 font-display text-base font-bold">{d.name}</div>
                              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                                {d.type}
                              </div>
                              <div className="mt-2 text-sm font-bold text-azure">₹{d.hourly_rate}/hr</div>
                              {selected && (
                                <motion.div
                                  layoutId="device-glow"
                                  className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/20 to-accent/10"
                                />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {step === 1 && (
                  <div>
                    <p className="mb-4 text-sm text-muted-foreground">When do you want to play?</p>
                    <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                      {next7.map((d) => {
                        const selected = fmtDate(d) === fmtDate(date);
                        const isToday = fmtDate(d) === fmtDate(new Date());
                        return (
                          <button
                            key={d.toISOString()}
                            onClick={() => setDate(d)}
                            className={cn(
                              "rounded-xl border p-3 text-center transition-all",
                              selected
                                ? "border-primary bg-primary/10 shadow-[0_0_20px_-8px_oklch(0.7_0.26_335/0.8)]"
                                : "border-border/60 bg-card/40 hover:border-primary/40",
                            )}
                          >
                            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                              {d.toLocaleDateString("en-IN", { weekday: "short" })}
                            </div>
                            <div className="mt-1 font-display text-xl font-bold">
                              {d.getDate()}
                            </div>
                            <div className="font-mono text-[9px] uppercase text-muted-foreground">
                              {isToday ? "today" : d.toLocaleDateString("en-IN", { month: "short" })}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    <div className="mt-6">
                      <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Duration</div>
                      <div className="flex flex-wrap gap-2">
                        {DURATIONS.map((d) => (
                          <button
                            key={d}
                            onClick={() => setDuration(d)}
                            className={cn(
                              "rounded-full border px-4 py-1.5 text-sm font-medium transition",
                              duration === d
                                ? "border-primary bg-primary/15 text-primary"
                                : "border-border/60 text-muted-foreground hover:border-primary/40",
                            )}
                          >
                            {d >= 60 ? `${d / 60}h` : `${d}m`}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {step === 2 && (
                  <div>
                    <p className="mb-4 text-sm text-muted-foreground">
                      Pick a time. Greyed out = booked or past.
                    </p>
                    {scheduleQ.isLoading ? (
                      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                        {Array.from({ length: 24 }).map((_, i) => (
                          <div key={i} className="h-10 animate-pulse rounded-lg bg-secondary/50" />
                        ))}
                      </div>
                    ) : (
                      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                        {slots.map((s) => {
                          const selected = time === s.iso;
                          return (
                            <button
                              key={s.iso}
                              disabled={s.disabled}
                              onClick={() => setTime(s.iso)}
                              className={cn(
                                "relative rounded-lg border px-2 py-2.5 font-mono text-xs font-bold transition-all",
                                s.disabled && "cursor-not-allowed border-border/30 bg-secondary/20 text-muted-foreground/40 line-through",
                                !s.disabled && !selected && "border-border/60 bg-card/40 text-foreground hover:border-primary/50 hover:bg-primary/5",
                                selected && "border-primary bg-primary text-primary-foreground shadow-[0_0_18px_oklch(0.7_0.26_335/0.7)]",
                              )}
                            >
                              {s.label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {step === 3 && device && time && (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-primary/40 bg-gradient-to-br from-primary/10 via-card/40 to-accent/10 p-6">
                      <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-primary">
                        <Zap className="h-3 w-3" /> Booking summary
                      </div>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <Row icon={MapPin} label="Café" value={cafe.name} />
                        <Row icon={Gamepad2} label="Rig" value={`${device.name} · ${device.type.toUpperCase()}`} />
                        <Row icon={Calendar} label="Date" value={new Date(time).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })} />
                        <Row icon={Clock} label="Time" value={`${new Date(time).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} · ${duration >= 60 ? `${duration / 60}h` : `${duration}m`}`} />
                      </div>
                      <div className="mt-5 flex items-end justify-between border-t border-border/40 pt-4">
                        <div>
                          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Total</div>
                          <div className="font-display text-3xl font-extrabold text-gradient-hot">₹{cost}</div>
                        </div>
                        <div className="text-right font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                          Pay at the café
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Your booking starts as <Badge variant="secondary" className="mx-1">pending</Badge> until the café confirms. Free cancellation anytime before start.
                    </p>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-border/50 bg-secondary/20 px-6 py-3">
            <Button
              variant="ghost" size="sm"
              disabled={step === 0}
              onClick={() => setStep((s) => Math.max(0, s - 1))}
            >
              <ChevronLeft className="h-4 w-4" /> Back
            </Button>
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Step {step + 1} / 4
            </div>
            {step < 3 ? (
              <Button
                size="sm"
                disabled={
                  (step === 0 && !device) ||
                  (step === 2 && !time)
                }
                onClick={() => setStep((s) => Math.min(3, s + 1))}
                style={{ background: "var(--gradient-brand-hot)" }}
              >
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                size="sm" disabled={book.isPending || !device || !time}
                onClick={() => book.mutate({ data: { device_id: device!.id, scheduled_at: time!, duration_minutes: duration } })}
                style={{ background: "var(--gradient-brand-hot)" }}
              >
                {book.isPending ? "Booking…" : "Confirm booking"}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Row({ icon: Icon, label, value }: { icon: typeof Calendar; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 h-4 w-4 text-primary" />
      <div>
        <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground">{label}</div>
        <div className="text-sm font-semibold">{value}</div>
      </div>
    </div>
  );
}
