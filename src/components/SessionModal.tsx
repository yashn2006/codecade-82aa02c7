import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  X, Plus, Square, Wrench, Pause, Play, MessageSquare, Loader2, Send, StickyNote,
} from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  extendSession, endSession, suspendSession, resumeSession,
  setSessionNotes, listSessionAlerts, logSessionAlert, customerSessionStats,
} from "@/lib/sessions.functions";
import type { DeviceStatus } from "@/lib/devices.functions";

export type LiveDevice = {
  id: string; name: string; type: string; hourly_rate: number; status: string;
};
export type LiveSession = {
  id: string; device_id: string; started_at: string; status: string;
  planned_minutes?: number | null; package_name?: string | null;
  amount_paid?: number | null; payment_method?: string | null;
  paused_ms?: number | null; paused_at?: string | null; notes?: string | null;
  customers?: {
    id?: string; full_name?: string | null; phone?: string | null;
    email?: string | null; wallet_balance?: number | null;
  } | null;
};

const SHELL: React.CSSProperties = {
  background: "rgba(6,0,18,0.97)",
  backdropFilter: "blur(40px) saturate(180%)",
  border: "1px solid rgba(255,100,200,0.2)",
  borderRadius: 26,
  boxShadow: "0 50px 100px rgba(0,0,0,0.9), 0 0 80px rgba(120,0,255,0.15)",
};

const TEMPLATES = [
  "5 mins remaining",
  "Please wrap up",
  "Come to the desk",
  "Session ending soon",
  "Your session has been extended",
];

function fmtClock(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}
function initials(t: string) {
  return t.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
}

export function SessionModal({
  device, session, cafeId, now, onClose, onChanged, onSetStatus,
}: {
  device: LiveDevice;
  session: LiveSession;
  cafeId: string;
  now: number;
  onClose: () => void;
  onChanged: () => void;
  onSetStatus: (status: DeviceStatus) => void;
}) {
  const qc = useQueryClient();
  const extendFn = useServerFn(extendSession);
  const endFn = useServerFn(endSession);
  const suspendFn = useServerFn(suspendSession);
  const resumeFn = useServerFn(resumeSession);
  const notesFn = useServerFn(setSessionNotes);
  const alertsFn = useServerFn(listSessionAlerts);
  const logAlertFn = useServerFn(logSessionAlert);
  const statsFn = useServerFn(customerSessionStats);

  const customer = session.customers ?? null;
  const name = customer?.full_name ?? "Walk-in";
  const paused = !!session.paused_at || session.status === "paused";

  const [addMin, setAddMin] = useState(30);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const [notes, setNotes] = useState(session.notes ?? "");

  useEffect(() => { setNotes(session.notes ?? ""); }, [session.id, session.notes]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const statsQ = useQuery({
    queryKey: ["customer-stats", customer?.id],
    queryFn: () => statsFn({ data: { customer_id: customer!.id! } }),
    enabled: !!customer?.id,
  });
  const alertsQ = useQuery({
    queryKey: ["session-alerts", session.id],
    queryFn: () => alertsFn({ data: { session_id: session.id } }),
  });

  const after = (m: string) => { toast.success(m); onChanged(); };
  const fail = (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed");

  const extendM = useMutation({ mutationFn: extendFn, onSuccess: () => after("Time extended"), onError: fail });
  const endM = useMutation({
    mutationFn: endFn,
    onSuccess: (r) => {
      toast.success(`Ended · ${r.minutes}m · ₹${r.amount}${r.refund ? ` · refund ₹${r.refund}` : ""}${r.due ? ` · due ₹${r.due}` : ""}`);
      onChanged(); onClose();
    },
    onError: fail,
  });
  const suspendM = useMutation({ mutationFn: suspendFn, onSuccess: () => after("Session suspended"), onError: fail });
  const resumeM = useMutation({ mutationFn: resumeFn, onSuccess: () => after("Session resumed"), onError: fail });
  const notesM = useMutation({ mutationFn: notesFn, onSuccess: () => after("Note saved"), onError: fail });
  const alertM = useMutation({
    mutationFn: logAlertFn,
    onSuccess: () => { setMsg(""); qc.invalidateQueries({ queryKey: ["session-alerts", session.id] }); },
    onError: fail,
  });

  const pausedMs = Number(session.paused_ms ?? 0) + (session.paused_at ? now - new Date(session.paused_at).getTime() : 0);
  const elapsedMs = Math.max(0, now - new Date(session.started_at).getTime() - pausedMs);
  const plannedMin = Number(session.planned_minutes ?? 0);
  const remainingMs = plannedMin > 0 ? plannedMin * 60000 - elapsedMs : null;
  const critical = remainingMs !== null && remainingMs <= 5 * 60000;
  const warning = remainingMs !== null && !critical && remainingMs <= 10 * 60000;
  const color = critical ? "#ff5470" : warning ? "#ffaa00" : "#00ff88";
  const progress = plannedMin > 0 ? Math.min(100, (elapsedMs / (plannedMin * 60000)) * 100) : null;
  const runningCost = useMemo(
    () => Math.ceil((device.hourly_rate * Math.max(1, Math.ceil(elapsedMs / 60000))) / 60),
    [device.hourly_rate, elapsedMs],
  );

  const sendAlert = (text: string, channel: "whatsapp" | "sms") => {
    const body = text.trim();
    if (!body) return;
    alertM.mutate({ data: { session_id: session.id, cafe_id: cafeId, message: body, channel } });
    const phone = (customer?.phone ?? "").replace(/[^\d]/g, "");
    if (typeof window !== "undefined" && phone) {
      const url = channel === "whatsapp"
        ? `https://wa.me/${phone.length === 10 ? "91" + phone : phone}?text=${encodeURIComponent(body)}`
        : `sms:${phone}?body=${encodeURIComponent(body)}`;
      window.open(url, "_blank", "noopener");
    }
  };

  const body = (
    <AnimatePresence>
      <motion.div
        key="overlay"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-black/70 p-3 backdrop-blur-md sm:p-6"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 14 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 8 }}
          transition={{ type: "spring", damping: 26, stiffness: 320 }}
          style={SHELL}
          className="my-auto w-full max-w-[640px] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* header */}
          <div className="flex items-start justify-between gap-3 border-b border-white/8 p-5">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-primary to-accent text-[14px] font-black text-primary-foreground">
                {initials(name)}
              </span>
              <div className="min-w-0">
                <div className="truncate text-[19px] font-black leading-tight">{name}</div>
                <div className="truncate font-mono text-[11px] text-muted-foreground">
                  {customer?.phone ?? "no phone"}{customer?.email ? ` · ${customer.email}` : ""}
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="shrink-0 rounded-full border border-white/10 p-2 text-muted-foreground transition hover:bg-white/10 hover:text-foreground"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="max-h-[72vh] space-y-5 overflow-y-auto p-5">
            {/* loyalty */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { k: "Visits", v: statsQ.data ? String(statsQ.data.visits) : "—" },
                { k: "Hours", v: statsQ.data ? (statsQ.data.minutes / 60).toFixed(1) : "—" },
                { k: "Spend", v: statsQ.data ? `₹${statsQ.data.spend.toLocaleString("en-IN")}` : "—" },
                { k: "Wallet", v: `₹${Number(customer?.wallet_balance ?? 0).toLocaleString("en-IN")}` },
              ].map((s) => (
                <div key={s.k} className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                  <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">{s.k}</div>
                  <div className="mt-1 text-[16px] font-bold tabular-nums">{s.v}</div>
                </div>
              ))}
            </div>

            {/* session info + timer */}
            <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[11px] text-muted-foreground">
                <span>{device.name} · {device.type.toUpperCase()}</span>
                <span>
                  Started {new Date(session.started_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <span className="rounded-full border border-white/12 bg-white/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em]">
                  {session.package_name ?? "Open play"}
                </span>
                <span className="rounded-full border border-white/12 bg-white/5 px-2 py-0.5 font-mono text-[10px]">
                  paid ₹{Number(session.amount_paid ?? 0).toLocaleString("en-IN")}
                  {session.payment_method ? ` · ${session.payment_method}` : ""}
                </span>
                {paused && (
                  <span className="rounded-full border border-slate-400/30 bg-slate-400/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-slate-300">
                    suspended
                  </span>
                )}
              </div>
              <div
                className={`mt-4 font-mono text-[44px] font-black leading-none tabular-nums ${critical ? "animate-pulse-soft" : ""}`}
                style={{ color, textShadow: `0 0 26px ${color}55` }}
              >
                {fmtClock(remainingMs !== null ? Math.max(0, remainingMs) : elapsedMs)}
              </div>
              <div className="mt-1 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
                <span>{remainingMs !== null ? "remaining" : "elapsed"} · {fmtClock(elapsedMs)} played</span>
                <span className="text-[13px] font-bold text-foreground">₹{runningCost}</span>
              </div>
              {progress !== null && (
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/8">
                  <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${progress}%`, background: `linear-gradient(90deg, ${color}, #a855f7)` }} />
                </div>
              )}
            </div>

            {/* actions */}
            <section className="space-y-2">
              <Label className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Actions</Label>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={addMin}
                  onChange={(e) => setAddMin(Number(e.target.value))}
                  className="field-select h-10 w-[120px]"
                >
                  <option value={30}>+30 min</option>
                  <option value={60}>+1 hour</option>
                  <option value={120}>+2 hour</option>
                </select>
                <button
                  onClick={() => extendM.mutate({ data: { id: session.id, add_minutes: addMin } })}
                  disabled={extendM.isPending}
                  className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-emerald-400/40 bg-emerald-400/12 px-3 text-[12px] font-bold text-emerald-200 transition hover:bg-emerald-400/22"
                >
                  <Plus className="h-4 w-4" /> Extend · ₹{Math.ceil((device.hourly_rate * addMin) / 60)}
                </button>
                {paused ? (
                  <button
                    onClick={() => resumeM.mutate({ data: { id: session.id } })}
                    className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-sky-400/40 bg-sky-400/12 px-3 text-[12px] font-bold text-sky-200 transition hover:bg-sky-400/22"
                  >
                    <Play className="h-4 w-4" /> Resume
                  </button>
                ) : (
                  <button
                    onClick={() => suspendM.mutate({ data: { id: session.id } })}
                    className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-400/40 bg-slate-400/12 px-3 text-[12px] font-bold text-slate-200 transition hover:bg-slate-400/22"
                  >
                    <Pause className="h-4 w-4" /> Suspend
                  </button>
                )}
                <button
                  onClick={() => { endM.mutate({ data: { id: session.id } }); onSetStatus("maintenance"); }}
                  className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-amber-400/40 bg-amber-400/12 px-3 text-[12px] font-bold text-amber-200 transition hover:bg-amber-400/22"
                >
                  <Wrench className="h-4 w-4" /> Maintenance
                </button>
                {confirmEnd ? (
                  <span className="inline-flex items-center gap-1.5">
                    <button
                      onClick={() => endM.mutate({ data: { id: session.id } })}
                      disabled={endM.isPending}
                      className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-rose-400/60 bg-rose-500/25 px-3 text-[12px] font-bold text-rose-100"
                    >
                      {endM.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Square className="h-4 w-4" />} Confirm end
                    </button>
                    <button onClick={() => setConfirmEnd(false)} className="text-[12px] text-muted-foreground hover:text-foreground">
                      cancel
                    </button>
                  </span>
                ) : (
                  <button
                    onClick={() => setConfirmEnd(true)}
                    className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-rose-400/40 bg-rose-400/12 px-3 text-[12px] font-bold text-rose-200 transition hover:bg-rose-400/22"
                  >
                    <Square className="h-4 w-4" /> End session
                  </button>
                )}
              </div>
            </section>

            {/* alerts */}
            <section className="rounded-2xl border border-white/8 bg-white/[0.03]">
              <button
                onClick={() => setAlertOpen((v) => !v)}
                className="flex w-full items-center justify-between p-3.5 text-left"
              >
                <span className="inline-flex items-center gap-2 text-[13px] font-bold">
                  <MessageSquare className="h-4 w-4 text-primary" /> Send alert
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  {alertOpen ? "hide" : "open"}
                </span>
              </button>
              <AnimatePresence initial={false}>
                {alertOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-3 border-t border-white/8 p-3.5">
                      <div className="flex flex-wrap gap-1.5">
                        {TEMPLATES.map((t) => (
                          <button
                            key={t}
                            onClick={() => setMsg(t)}
                            className="rounded-full border border-white/12 bg-white/5 px-2.5 py-1 text-[11px] text-foreground/80 transition hover:bg-white/12"
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                      <Input placeholder="Custom message…" value={msg} onChange={(e) => setMsg(e.target.value)} />
                      <div className="flex gap-2">
                        <button
                          onClick={() => sendAlert(msg, "whatsapp")}
                          disabled={!msg.trim() || alertM.isPending}
                          className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl border border-emerald-400/40 bg-emerald-400/12 text-[12px] font-bold text-emerald-200 disabled:opacity-50"
                        >
                          <Send className="h-3.5 w-3.5" /> WhatsApp
                        </button>
                        <button
                          onClick={() => sendAlert(msg, "sms")}
                          disabled={!msg.trim() || alertM.isPending}
                          className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl border border-sky-400/40 bg-sky-400/12 text-[12px] font-bold text-sky-200 disabled:opacity-50"
                        >
                          <Send className="h-3.5 w-3.5" /> SMS
                        </button>
                      </div>
                      <div className="space-y-1">
                        {(alertsQ.data ?? []).map((a) => (
                          <div key={a.id} className="flex items-center justify-between gap-2 rounded-lg bg-white/[0.04] px-2.5 py-1.5">
                            <span className="min-w-0 truncate text-[12px]">{a.message}</span>
                            <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                              {a.channel} · {new Date(a.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                        ))}
                        {(alertsQ.data ?? []).length === 0 && (
                          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                            no alerts sent yet
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </section>

            {/* notes */}
            <section className="space-y-2">
              <Label className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                <StickyNote className="h-3.5 w-3.5" /> Staff notes
              </Label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="e.g. customer requested extra time, PC had an issue…"
                className="w-full rounded-xl border border-white/10 bg-white/[0.03] p-3 text-[13px] outline-none focus:border-primary/50"
              />
              <button
                onClick={() => notesM.mutate({ data: { id: session.id, notes } })}
                disabled={notesM.isPending}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-white/12 px-3 text-[12px] font-semibold text-foreground/85 transition hover:bg-white/8"
              >
                {notesM.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Save note
              </button>
            </section>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );

  if (typeof document === "undefined") return null;
  return createPortal(body, document.body);
}
