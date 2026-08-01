import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Search, Play, Edit3, Lock, Wrench, CheckCircle, Square, Pause, Clock3,
  ArrowLeftRight, Printer, Loader2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { DeviceStatus } from "@/lib/devices.functions";

export type StationDevice = {
  id: string; name: string; type: string; hourly_rate: number; status: string;
  zone?: string | null; notes?: string | null; suspend_until?: string | null;
};
export type StationSession = {
  id: string; device_id: string; started_at: string; status: string;
  customers?: { full_name?: string } | null;
};
export type StationCustomer = {
  id: string; full_name?: string | null; phone?: string | null; wallet_balance?: number | null;
};

export type DevicePatch = {
  name?: string; hourly_rate?: number;
  type?: "pc" | "console" | "vr" | "racing" | "other";
  zone?: string | null; notes?: string | null;
};

function fmtClock(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}
function billed(startedAt: string, rate: number, now: number) {
  const minutes = Math.max(1, Math.ceil((now - new Date(startedAt).getTime()) / 60000));
  return Math.ceil((rate * minutes) / 60);
}
function initials(text: string) {
  return text.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
}

const SHELL: React.CSSProperties = {
  background: "rgba(6,0,18,0.97)",
  backdropFilter: "blur(40px) saturate(200%)",
  border: "1px solid rgba(255,100,200,0.2)",
  borderRadius: 28,
  boxShadow:
    "0 50px 100px rgba(0,0,0,0.9), 0 0 80px rgba(120,0,255,0.15), inset 0 1px 0 rgba(255,255,255,0.06)",
};

function Expand({ show, children }: { show: boolean; children: React.ReactNode }) {
  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="overflow-hidden"
        >
          <div className="pt-3">{children}</div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ActionTile({
  tint, icon, label, sub, onClick, active,
}: {
  tint: { bg: string; border: string; fg: string };
  icon: React.ReactNode; label: string; sub: string; onClick: () => void; active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex h-[72px] flex-col justify-center gap-1 rounded-[14px] px-3 text-left transition-all duration-150 hover:-translate-y-0.5"
      style={{
        background: tint.bg,
        border: `1px solid ${active ? tint.fg : tint.border}`,
      }}
    >
      <span className="flex items-center gap-2" style={{ color: tint.fg }}>
        {icon}
        <span className="text-[13px] font-semibold">{label}</span>
      </span>
      <span className="text-[11px] text-muted-foreground">{sub}</span>
    </button>
  );
}

export function StationModal({
  device, session, now, customers, onClose,
  onStart, onEnd, onSetStatus, onSaveEdit,
  starting, ending, saving,
}: {
  device: StationDevice | null;
  session?: StationSession;
  now: number;
  customers: StationCustomer[];
  onClose: () => void;
  onStart: (customerId?: string) => void;
  onEnd: () => void;
  onSetStatus: (status: DeviceStatus, opts?: { suspend_minutes?: number; notes?: string }) => void;
  onSaveEdit: (patch: DevicePatch) => void;
  starting?: boolean; ending?: boolean; saving?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [walkIn, setWalkIn] = useState(true);
  const [picked, setPicked] = useState<StationCustomer | null>(null);
  const [expand, setExpand] = useState<null | "edit" | "reserve" | "maint">(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [reason, setReason] = useState("");
  const [form, setForm] = useState<DevicePatch>({});

  const open = !!device;

  useEffect(() => {
    if (!device) return;
    setSearch(""); setPicked(null); setWalkIn(true); setExpand(null);
    setConfirmEnd(false); setReason(device.notes ?? "");
    setForm({
      name: device.name,
      hourly_rate: device.hourly_rate,
      type: (device.type as DevicePatch["type"]) ?? "pc",
      zone: device.zone ?? "",
      notes: device.notes ?? "",
    });
  }, [device?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [] as StationCustomer[];
    return customers.filter((c) =>
      (c.full_name ?? "").toLowerCase().includes(q) || (c.phone ?? "").includes(q),
    ).slice(0, 6);
  }, [customers, search]);

  if (!device || typeof document === "undefined") return null;

  const status = (device.status as DeviceStatus) ?? "available";
  const live = status === "in_use" && !!session;
  const broken = status === "maintenance";
  const booked = status === "reserved";

  const editForm = (
    <div className="space-y-3 rounded-[16px] border border-white/10 bg-white/[0.03] p-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-[11px]">Name</Label>
          <Input value={form.name ?? ""} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[11px]">Rate ₹/hr</Label>
          <Input type="number" inputMode="numeric" value={form.hourly_rate ?? 0}
            onChange={(e) => setForm((f) => ({ ...f, hourly_rate: Number(e.target.value) || 0 }))} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-[11px]">Type</Label>
          <select className="field-select" value={form.type ?? "pc"}
            onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as DevicePatch["type"] }))}>
            <option value="pc">PC</option>
            <option value="console">Console</option>
            <option value="vr">VR</option>
            <option value="racing">Racing</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-[11px]">Zone</Label>
          <Input value={form.zone ?? ""} onChange={(e) => setForm((f) => ({ ...f, zone: e.target.value }))} placeholder="Deck A" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-[11px]">Notes</Label>
        <textarea
          value={form.notes ?? ""}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          rows={2}
          className="w-full rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-sm outline-none focus:border-primary"
        />
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={() => onSaveEdit({ ...form, zone: form.zone || null, notes: form.notes || null })}
          className="h-10 flex-1 rounded-xl text-[13px] font-bold text-primary-foreground disabled:opacity-60"
          style={{ background: "var(--gradient-brand-hot)" }}
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
        <button type="button" onClick={() => setExpand(null)}
          className="h-10 rounded-xl border border-white/10 px-4 text-[13px] text-muted-foreground hover:text-foreground">
          Cancel
        </button>
      </div>
    </div>
  );

  const body = (
    <AnimatePresence>
      <motion.div key="backdrop" className="fixed inset-0 z-[99]"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)" }}
        onClick={onClose}
      />
      <motion.div
        key="modal"
        role="dialog"
        aria-modal="true"
        initial={{ scale: 0.85, opacity: 0, y: 20, x: "-50%" }}
        animate={{ scale: 1, opacity: 1, y: 0, x: "-50%" }}
        exit={{ scale: 0.9, opacity: 0, x: "-50%" }}
        transition={{ type: "spring", damping: 20, stiffness: 280 }}
        className="fixed left-1/2 top-1/2 z-[100] w-[92vw] max-w-[400px] -translate-y-1/2 overflow-y-auto"
        style={{ ...SHELL, maxHeight: "88vh" }}
      >
        {/* HEADER */}
        <div className="flex items-start justify-between gap-3 p-5 pb-0">
          <div className="min-w-0">
            <div className="truncate text-[28px] font-bold leading-tight">{device.name}</div>
            <span className="mt-1 inline-flex rounded-full bg-[rgba(0,212,255,0.12)] px-2 py-0.5 font-mono text-[11px] uppercase tracking-[0.14em] text-[#5ee9ff]">
              {device.type}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.16em]"
              style={
                live ? { background: "rgba(0,255,100,0.12)", color: "#5cf2a5" }
                  : broken ? { background: "rgba(255,50,50,0.12)", color: "#ff8080" }
                    : booked ? { background: "rgba(255,170,0,0.12)", color: "#ffc061" }
                      : { background: "rgba(0,212,255,0.12)", color: "#5ee9ff" }
              }
            >
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
              {live ? "Live" : status.replace("_", " ")}
            </span>
            <button type="button" onClick={onClose} aria-label="Close"
              className="grid h-8 w-8 place-items-center rounded-full bg-white/[0.08] transition hover:bg-white/[0.15]">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mt-4 h-px bg-white/[0.07]" />

        {/* BODY */}
        <div className="space-y-4 p-5">
          {live && session ? (
            <>
              {/* customer card */}
              <div className="flex items-center gap-3 rounded-[16px] border border-white/[0.07] bg-white/[0.03] p-3.5">
                <div
                  className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-[15px] font-black text-black/80"
                  style={{
                    background: "linear-gradient(135deg,#ff006e,#7000ff)",
                    border: "2px solid rgba(255,100,200,0.3)",
                  }}
                >
                  {initials(session.customers?.full_name ?? "Walk in")}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-[18px] font-bold">
                    {session.customers?.full_name ?? "Walk-in"}
                  </div>
                  <span className={`mt-0.5 inline-flex rounded-full px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.16em] ${
                    session.customers?.full_name
                      ? "bg-emerald-400/12 text-emerald-300"
                      : "bg-white/8 text-foreground/60"}`}>
                    {session.customers?.full_name ? "Member" : "Walk-in"}
                  </span>
                </div>
              </div>

              {/* metrics */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="rounded-[14px] p-3.5"
                  style={{ background: "rgba(0,255,100,0.05)", border: "1px solid rgba(0,255,100,0.15)" }}>
                  <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Time</div>
                  <div className="mt-1 font-mono text-[26px] font-bold leading-none tabular-nums"
                    style={{ color: "#00ff88", textShadow: "0 0 16px rgba(0,255,100,0.5)" }}>
                    {fmtClock(now - new Date(session.started_at).getTime())}
                  </div>
                </div>
                <div className="rounded-[14px] p-3.5"
                  style={{ background: "rgba(255,0,110,0.05)", border: "1px solid rgba(255,0,110,0.15)" }}>
                  <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Earning</div>
                  <div className="mt-1 text-[30px] font-extrabold leading-none tabular-nums"
                    style={{ color: "#ff66aa", textShadow: "0 0 16px rgba(255,0,110,0.4)" }}>
                    ₹{billed(session.started_at, device.hourly_rate, now)}
                  </div>
                </div>
              </div>
              <div className="text-center text-[12px] text-muted-foreground">
                ₹{device.hourly_rate}/hr · Started{" "}
                {new Date(session.started_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
              </div>

              {/* end session */}
              {!confirmEnd ? (
                <button type="button" onClick={() => setConfirmEnd(true)}
                  className="flex h-[52px] w-full items-center justify-center gap-2 rounded-[14px] text-[16px] font-bold text-white"
                  style={{ background: "linear-gradient(90deg,#ff2244,#ff006e)" }}>
                  <Square className="h-4 w-4" /> End session
                </button>
              ) : (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
                  <div className="text-center text-[13px] text-muted-foreground">End this session?</div>
                  <div className="flex gap-2">
                    <button type="button" disabled={ending} onClick={onEnd}
                      className="h-[46px] flex-1 rounded-[14px] text-[14px] font-bold text-white disabled:opacity-60"
                      style={{ background: "linear-gradient(90deg,#ff2244,#ff006e)" }}>
                      {ending ? "Ending…" : "Yes, end it"}
                    </button>
                    <button type="button" onClick={() => setConfirmEnd(false)}
                      className="h-[46px] flex-1 rounded-[14px] border border-white/12 text-[14px] text-muted-foreground hover:text-foreground">
                      Cancel
                    </button>
                  </div>
                </motion.div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => onSetStatus("suspended", { suspend_minutes: 15 })}
                  className="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-amber-400/30 text-[13px] font-semibold text-amber-300 hover:bg-amber-400/10">
                  <Pause className="h-3.5 w-3.5" /> Pause
                </button>
                <button type="button" onClick={() => onSetStatus("in_use", { suspend_minutes: undefined })}
                  className="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-cyan-400/30 text-[13px] font-semibold text-cyan-300 hover:bg-cyan-400/10">
                  <Clock3 className="h-3.5 w-3.5" /> +30 min
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => onSetStatus("available")}
                  className="flex h-[38px] items-center justify-center gap-1.5 rounded-xl text-[12px] text-muted-foreground hover:bg-white/5 hover:text-foreground">
                  <ArrowLeftRight className="h-3.5 w-3.5" /> Transfer
                </button>
                <button type="button" onClick={() => window.print()}
                  className="flex h-[38px] items-center justify-center gap-1.5 rounded-xl text-[12px] text-muted-foreground hover:bg-white/5 hover:text-foreground">
                  <Printer className="h-3.5 w-3.5" /> Receipt
                </button>
              </div>

              <div className="text-right">
                <button type="button" onClick={() => setExpand(expand === "edit" ? null : "edit")}
                  className="text-[12px] text-muted-foreground hover:text-foreground">
                  ✏ Edit station details
                </button>
              </div>
              <Expand show={expand === "edit"}>{editForm}</Expand>
            </>
          ) : broken ? (
            <>
              <div className="py-2 text-center">
                <Wrench className="mx-auto h-12 w-12 text-[#ff5555]" style={{ filter: "drop-shadow(0 0 14px rgba(255,50,50,0.5))" }} />
                <div className="mt-3 text-[18px] font-bold">Under maintenance</div>
                {device.notes && <p className="mt-1 text-[14px] text-muted-foreground">{device.notes}</p>}
              </div>
              <button type="button" onClick={() => onSetStatus("available")}
                className="h-12 w-full rounded-[14px] text-[15px] font-bold text-black"
                style={{ background: "linear-gradient(90deg,#00ff88,#00d4aa)" }}>
                Mark as available
              </button>
              <button type="button" onClick={() => setExpand(expand === "maint" ? null : "maint")}
                className="h-11 w-full rounded-[14px] border border-white/12 text-[13px] text-muted-foreground hover:text-foreground">
                ✏ Edit reason
              </button>
              <Expand show={expand === "maint"}>
                <div className="space-y-2">
                  <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="What's wrong?" />
                  <button type="button" onClick={() => onSetStatus("maintenance", { notes: reason })}
                    className="h-11 w-full rounded-xl text-[13px] font-bold text-white"
                    style={{ background: "linear-gradient(90deg,#ff2244,#b91c1c)" }}>
                    Save reason
                  </button>
                </div>
              </Expand>
            </>
          ) : booked ? (
            <>
              <div className="rounded-[16px] border border-amber-400/20 bg-amber-400/[0.06] p-4 text-center">
                <div className="text-[18px] font-bold">{session?.customers?.full_name ?? "Held station"}</div>
                <div className="mt-1 font-mono text-[12px] uppercase tracking-[0.16em] text-amber-300">
                  Reserved · ₹{device.hourly_rate}/hr
                </div>
              </div>
              <button type="button" disabled={starting} onClick={() => onStart()}
                className="h-[52px] w-full rounded-[14px] text-[16px] font-bold text-black disabled:opacity-60"
                style={{ background: "linear-gradient(90deg,#00ff88,#00d4aa)" }}>
                {starting ? "Checking in…" : "✓ Check in"}
              </button>
              <button type="button" onClick={() => onSetStatus("available")}
                className="h-11 w-full rounded-[14px] text-[13px] text-muted-foreground hover:text-foreground">
                ✗ Cancel booking
              </button>
            </>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-primary/40 px-2.5 py-1 font-mono text-[11px] text-primary">
                  ₹{device.hourly_rate}/hr
                </span>
                {device.zone && (
                  <span className="rounded-full border border-white/12 bg-white/5 px-2.5 py-1 font-mono text-[11px] text-muted-foreground">
                    {device.zone}
                  </span>
                )}
              </div>

              <div className="space-y-2">
                <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Find customer</div>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={picked ? (picked.full_name ?? "") : search}
                    onChange={(e) => { setPicked(null); setSearch(e.target.value); setWalkIn(false); }}
                    placeholder="Name or phone…"
                    className="h-[46px] rounded-xl pl-9"
                  />
                </div>
                {!picked && matches.length > 0 && (
                  <div className="max-h-48 overflow-y-auto rounded-xl border border-white/10">
                    {matches.map((c) => (
                      <button key={c.id} type="button"
                        onClick={() => { setPicked(c); setWalkIn(false); }}
                        className="flex w-full items-center gap-3 border-b border-white/5 px-3 py-2 text-left last:border-0 hover:bg-primary/10">
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[11px] font-bold text-black/80"
                          style={{ background: "linear-gradient(135deg,#ff006e,#7000ff)" }}>
                          {initials(c.full_name ?? "?")}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm">{c.full_name}</span>
                        <span className="shrink-0 font-mono text-[11px] text-muted-foreground">{c.phone}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2.5">
                <span className="text-[13px] text-muted-foreground">Walk-in (no customer)</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={walkIn}
                  onClick={() => { setWalkIn((v) => !v); setPicked(null); }}
                  className="relative h-6 w-11 rounded-full transition"
                  style={{ background: walkIn ? "#ff006e" : "rgba(255,255,255,0.15)" }}
                >
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${walkIn ? "left-[22px]" : "left-0.5"}`} />
                </button>
              </div>

              <button
                type="button"
                disabled={starting || (!walkIn && !picked)}
                onClick={() => onStart(picked?.id)}
                className="cta-shimmer flex h-[52px] w-full items-center justify-center gap-2 rounded-[14px] text-[16px] font-bold text-primary-foreground disabled:opacity-50"
                style={{ background: "linear-gradient(90deg,#ff006e,#7000ff)" }}
              >
                {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                {starting ? "Starting…" : "Start session"}
              </button>

              <div className="flex items-center gap-3 pt-1">
                <span className="h-px flex-1 bg-white/8" />
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">or manage station</span>
                <span className="h-px flex-1 bg-white/8" />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <ActionTile
                  tint={{ bg: "rgba(255,255,255,0.04)", border: "rgba(255,255,255,0.1)", fg: "#ffffff" }}
                  icon={<Edit3 className="h-5 w-5" />} label="Edit Station" sub="Name, price, type"
                  active={expand === "edit"}
                  onClick={() => setExpand(expand === "edit" ? null : "edit")}
                />
                <ActionTile
                  tint={{ bg: "rgba(255,170,0,0.06)", border: "rgba(255,170,0,0.2)", fg: "#ffaa00" }}
                  icon={<Lock className="h-5 w-5" />} label="Reserve" sub="Book for later"
                  active={expand === "reserve"}
                  onClick={() => setExpand(expand === "reserve" ? null : "reserve")}
                />
                <ActionTile
                  tint={{ bg: "rgba(255,50,50,0.06)", border: "rgba(255,50,50,0.2)", fg: "#ff5555" }}
                  icon={<Wrench className="h-5 w-5" />} label="Maintenance" sub="Mark out of order"
                  active={expand === "maint"}
                  onClick={() => setExpand(expand === "maint" ? null : "maint")}
                />
                <ActionTile
                  tint={{ bg: "rgba(0,212,255,0.06)", border: "rgba(0,212,255,0.2)", fg: "#00d4ff" }}
                  icon={<CheckCircle className="h-5 w-5" />} label="Mark Free" sub="Reset to available"
                  onClick={() => onSetStatus("available")}
                />
              </div>

              <Expand show={expand === "edit"}>{editForm}</Expand>

              <Expand show={expand === "reserve"}>
                <div className="space-y-2 rounded-[16px] border border-amber-400/20 bg-amber-400/[0.05] p-3">
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Customer name or phone" />
                  <div className="grid grid-cols-2 gap-2">
                    <Input type="date" />
                    <Input type="time" />
                  </div>
                  <button type="button" onClick={() => onSetStatus("reserved")}
                    className="h-11 w-full rounded-xl text-[13px] font-bold text-black"
                    style={{ background: "linear-gradient(90deg,#ffaa00,#ff6a00)" }}>
                    Confirm reserve
                  </button>
                </div>
              </Expand>

              <Expand show={expand === "maint"}>
                <div className="space-y-2 rounded-[16px] border border-rose-400/20 bg-rose-500/[0.05] p-3">
                  <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (GPU failure…)" />
                  <button type="button" onClick={() => onSetStatus("maintenance", { notes: reason })}
                    className="h-11 w-full rounded-xl text-[13px] font-bold text-white"
                    style={{ background: "linear-gradient(90deg,#ff2244,#b91c1c)" }}>
                    Set maintenance
                  </button>
                </div>
              </Expand>
            </>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );

  return createPortal(body, document.body);
}
