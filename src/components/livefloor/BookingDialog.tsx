import { useEffect, useMemo, useState } from "react";
import { CalendarPlus, Loader2, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogIcon } from "@/components/ui/dialog";
import { CustomerSelector, type CustomerDraft, type FloorCustomer } from "./CustomerSelector";
import { findBookingConflict, fmtTime, type FloorBooking, type FloorDevice } from "@/lib/live-floor";

const DURATIONS = [30, 60, 90, 120, 180, 240];

function pad(n: number) { return String(n).padStart(2, "0"); }
function nextSlot(): { date: string; time: string } {
  const d = new Date(Date.now() + 15 * 60000);
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

export type BookingSubmit = { draft: CustomerDraft; scheduledAt: string; minutes: number };

export function BookingDialog({
  open, device, code, customers, bookings, busy, onClose, onSubmit,
}: {
  open: boolean;
  device: FloorDevice | null;
  code: string;
  customers: FloorCustomer[];
  bookings: FloorBooking[];
  busy: boolean;
  onClose: () => void;
  onSubmit: (v: BookingSubmit) => void;
}) {
  const [draft, setDraft] = useState<CustomerDraft>(null);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [minutes, setMinutes] = useState(60);
  const [tried, setTried] = useState(false);

  useEffect(() => {
    if (!open) return;
    const s = nextSlot();
    setDraft(null); setDate(s.date); setTime(s.time); setMinutes(60); setTried(false);
  }, [open, device?.id]);

  const startMs = date && time ? new Date(`${date}T${time}`).getTime() : NaN;
  const conflict = useMemo(
    () => (device && Number.isFinite(startMs) ? findBookingConflict(bookings, device.id, startMs, minutes) : null),
    [bookings, device, startMs, minutes],
  );
  const total = device ? Math.ceil((device.hourly_rate * minutes) / 60) : 0;

  const customerError =
    !draft ? "Pick a customer or add a new one." :
    draft.kind === "new" && !draft.full_name.trim() ? "Enter the customer's name." : null;
  const timeError =
    !Number.isFinite(startMs) ? "Choose a date and start time." :
    startMs < Date.now() - 5 * 60000 ? "Start time is in the past." : null;
  const conflictError = conflict
    ? `Already booked ${fmtTime(conflict.scheduled_at)} for ${conflict.duration_minutes} min${conflict.customers?.full_name ? ` (${conflict.customers.full_name})` : ""}.`
    : null;
  const error = customerError ?? timeError ?? conflictError;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (error || busy || !device) return;
    onSubmit({ draft, scheduledAt: new Date(startMs).toISOString(), minutes });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !busy) onClose(); }}>
      <DialogContent className="max-w-[520px]">
        <DialogHeader>
          <DialogIcon><CalendarPlus className="h-5 w-5" /></DialogIcon>
          <DialogTitle>Book {code}</DialogTitle>
          <DialogDescription>
            {device?.name} · ₹{device?.hourly_rate ?? 0}/hr
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <section className="space-y-1.5">
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-lf-dim">Customer *</div>
            <CustomerSelector customers={customers} value={draft} onChange={setDraft} invalid={tried && !!customerError} autoFocus />
          </section>

          <section className="grid grid-cols-2 gap-2.5">
            <label className="space-y-1.5">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-lf-dim">Date *</span>
              <input type="date" className="lf-input" value={date} onChange={(e) => setDate(e.target.value)} required />
            </label>
            <label className="space-y-1.5">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-lf-dim">Start *</span>
              <input type="time" step={300} className="lf-input" value={time} onChange={(e) => setTime(e.target.value)} required />
            </label>
          </section>

          <section className="space-y-1.5">
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-lf-dim">Duration</div>
            <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
              {DURATIONS.map((m) => (
                <button
                  key={m}
                  type="button"
                  data-on={minutes === m}
                  onClick={() => setMinutes(m)}
                  className="lf-chip justify-center"
                  style={{ ["--tone" as string]: "var(--lf-violet)" }}
                >
                  {m < 60 ? `${m}m` : `${m / 60}h`}
                </button>
              ))}
            </div>
          </section>

          <div className="flex items-center justify-between rounded-xl border border-lf-line bg-lf-bg/60 px-3 py-2.5">
            <span className="text-[12px] text-lf-dim">Estimated total</span>
            <span className="font-mono text-[18px] font-bold">₹{total.toLocaleString("en-IN")}</span>
          </div>

          {(tried || conflictError) && error && (
            <div role="alert" className="flex items-start gap-2 rounded-lg border border-lf-danger/40 bg-lf-danger/10 px-3 py-2 text-[12px] text-lf-text">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-lf-danger" /> {error}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} disabled={busy} className="lf-btn h-11 flex-1">Cancel</button>
            <button type="submit" disabled={busy || !!conflictError} className="lf-btn lf-btn-primary h-11 flex-[2] text-[13px]">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarPlus className="h-4 w-4" />}
              {busy ? "Booking…" : "Confirm booking"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
