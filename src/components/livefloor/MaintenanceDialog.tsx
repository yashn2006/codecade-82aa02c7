import { useEffect, useState } from "react";
import { Wrench, Loader2, AlertTriangle, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { MAINT_PREFIX } from "@/lib/live-floor";

const REASONS = [
  "Hardware fault",
  "Software / game update",
  "Peripheral issue",
  "Network issue",
  "Display issue",
  "Cleaning & thermal",
  "Other",
];

export function MaintenanceDialog({
  open, code, name, hasSession, busy, onClose, onConfirm,
}: {
  open: boolean;
  code: string;
  name: string;
  hasSession: boolean;
  busy: boolean;
  onClose: () => void;
  /** notes is the full text to store on the device (<= 280 chars). */
  onConfirm: (v: { notes: string; endSession: boolean }) => void;
}) {
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [ack, setAck] = useState(false);
  const [tried, setTried] = useState(false);

  useEffect(() => {
    if (open) {
      setReason("");
      setNotes("");
      setAck(false);
      setTried(false);
    }
  }, [open]);

  const text = `${MAINT_PREFIX}${reason}${notes.trim() ? ` — ${notes.trim()}` : ""}`;
  const error =
    !reason
      ? "Choose a reason."
      : hasSession && !ack
        ? "Confirm that the running session will be ended."
        : text.length > 280
          ? "Notes are too long."
          : null;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !busy) onClose(); }}>
      <DialogContent
        variant="compact-center"
        className="max-w-[430px] border-amber-400/25 bg-[linear-gradient(165deg,rgba(26,20,38,0.97),rgba(10,8,20,0.99))]"
      >
        <DialogHeader className="border-white/10 pb-3.5">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-amber-400/35 bg-amber-400/15 text-amber-300 shadow-[0_0_20px_-6px_rgba(251,191,36,0.6)]">
              <Wrench className="h-4.5 w-4.5" />
            </span>
            <div className="min-w-0">
              <DialogTitle className="text-[17px] leading-snug">
                Maintenance · {code}
              </DialogTitle>
              <DialogDescription className="truncate text-xs">
                {name} will be taken offline until resolved.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setTried(true);
            if (error || busy) return;
            onConfirm({ notes: text, endSession: hasSession });
          }}
        >
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Reason *
              </span>
              {reason && (
                <span className="font-mono text-[10px] text-amber-300">{reason}</span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {REASONS.map((r) => {
                const active = reason === r;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setReason(r)}
                    className={`flex min-h-[38px] items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-xs font-medium transition-colors ${
                      active
                        ? "border-amber-400/60 bg-amber-400/15 text-amber-100 shadow-[0_0_16px_-6px_rgba(251,191,36,0.5)]"
                        : "border-white/10 bg-white/[0.03] text-muted-foreground hover:border-white/20 hover:bg-white/[0.06] hover:text-foreground"
                    } ${r === "Other" ? "col-span-2" : ""}`}
                  >
                    <span className="truncate">{r}</span>
                    {active && <Check className="h-3.5 w-3.5 shrink-0 text-amber-300" />}
                  </button>
                );
              })}
            </div>
          </div>

          <label className="block space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Notes <span className="opacity-60">(optional)</span>
              </span>
              <span className="font-mono text-[10px] tabular-nums text-muted-foreground/70">
                {notes.length}/220
              </span>
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              maxLength={220}
              placeholder="e.g. GPU fan noisy, swapped mouse…"
              className="w-full resize-none rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-amber-400/50 focus:outline-none focus:ring-2 focus:ring-amber-400/20"
            />
          </label>

          {hasSession && (
            <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-amber-400/35 bg-amber-400/10 px-3 py-2.5 text-xs text-amber-100">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-amber-400"
                checked={ack}
                onChange={(e) => setAck(e.target.checked)}
              />
              <span>
                An active session is running on this station. It will be <strong>ended and billed</strong> first.
              </span>
            </label>
          )}

          {tried && error && (
            <div
              role="alert"
              className="flex items-center gap-2 rounded-xl border border-rose-500/35 bg-rose-500/10 px-3 py-2 text-xs text-rose-200"
            >
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="inline-flex h-10 flex-1 items-center justify-center rounded-xl border border-white/12 bg-white/[0.04] px-4 text-xs font-semibold text-foreground transition-colors hover:bg-white/10 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex h-10 flex-[1.5] items-center justify-center gap-1.5 rounded-xl border border-amber-400/40 bg-amber-500/20 px-4 text-xs font-bold text-amber-200 transition-colors hover:bg-amber-500/30 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wrench className="h-3.5 w-3.5" />}
              {busy ? "Saving…" : "Start maintenance"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
