import { useEffect, useState } from "react";
import { Wrench, Loader2, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogIcon } from "@/components/ui/dialog";
import { MAINT_PREFIX } from "@/lib/live-floor";

const REASONS = [
  "Hardware fault",
  "Software / game update",
  "Controller or peripheral",
  "Network issue",
  "Display issue",
  "Cleaning",
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
  /** notes is the full text to store on the device (≤ 280 chars). */
  onConfirm: (v: { notes: string; endSession: boolean }) => void;
}) {
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [ack, setAck] = useState(false);
  const [tried, setTried] = useState(false);

  useEffect(() => {
    if (open) { setReason(""); setNotes(""); setAck(false); setTried(false); }
  }, [open]);

  const text = `${MAINT_PREFIX}${reason}${notes.trim() ? ` — ${notes.trim()}` : ""}`;
  const error =
    !reason ? "Choose a reason." :
    hasSession && !ack ? "Confirm that the running session will be ended." :
    text.length > 280 ? "Notes are too long." : null;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !busy) onClose(); }}>
      <DialogContent className="max-w-[460px]">
        <DialogHeader>
          <DialogIcon><Wrench className="h-5 w-5" /></DialogIcon>
          <DialogTitle>Mark {code} for maintenance</DialogTitle>
          <DialogDescription>{name} will be taken off the floor until you mark it available again.</DialogDescription>
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
          <div className="space-y-1.5">
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-lf-dim">Reason *</div>
            <div className="flex flex-wrap gap-1.5">
              {REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  data-on={reason === r}
                  onClick={() => setReason(r)}
                  className="lf-chip"
                  style={{ ["--tone" as string]: "var(--lf-maint)" }}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          <label className="block space-y-1.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-lf-dim">Notes (optional)</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              maxLength={220}
              placeholder="e.g. GPU fan noisy, replaced mouse…"
              className="lf-input h-auto resize-none py-2"
            />
          </label>
          {hasSession && (
            <label className="flex items-start gap-2 rounded-lg border border-lf-maint/40 bg-lf-maint/10 px-3 py-2 text-[12px]">
              <input type="checkbox" className="mt-0.5" checked={ack} onChange={(e) => setAck(e.target.checked)} />
              <span>A session is running on this station. It will be <b>ended and billed</b> first.</span>
            </label>
          )}
          {tried && error && (
            <div role="alert" className="flex items-center gap-2 text-[12px] text-lf-danger">
              <AlertTriangle className="h-3.5 w-3.5" /> {error}
            </div>
          )}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} disabled={busy} className="lf-btn h-11 flex-1">Cancel</button>
            <button
              type="submit"
              disabled={busy}
              className="lf-btn lf-btn-tone h-11 flex-[2] text-[13px]"
              style={{ ["--tone" as string]: "var(--lf-maint)" }}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wrench className="h-4 w-4" />}
              {busy ? "Saving…" : "Start maintenance"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
