import { useEffect, useState } from "react";
import { AlertTriangle, IndianRupee, Loader2, Wallet, Banknote } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function ConfirmModal({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "destructive",
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "destructive" | "default";
  onConfirm: () => Promise<unknown> | void;
}) {
  const [busy, setBusy] = useState(false);

  async function handleConfirm() {
    if (busy) return;
    setBusy(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent className="max-w-sm border-white/15 bg-[#0e0c1a]/95 text-foreground">
        <DialogHeader className="border-b-0 pb-1">
          <div className="mb-2 flex items-center gap-2.5">
            <div
              className={cn(
                "grid h-9 w-9 shrink-0 place-items-center rounded-xl border",
                tone === "destructive"
                  ? "border-rose-500/35 bg-rose-500/15 text-rose-300"
                  : "border-primary/35 bg-primary/15 text-primary",
              )}
            >
              <AlertTriangle className="h-4 w-4" />
            </div>
            <DialogTitle className="text-base font-bold text-white">{title}</DialogTitle>
          </div>
          {description && (
            <DialogDescription className="text-xs leading-relaxed text-muted-foreground">
              {description}
            </DialogDescription>
          )}
        </DialogHeader>
        <DialogFooter className="mt-2 gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => onOpenChange(false)}
            className="min-h-[44px] flex-1 border-white/15 bg-white/[0.03] text-xs font-semibold"
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={tone === "destructive" ? "destructive" : "default"}
            disabled={busy}
            onClick={() => void handleConfirm()}
            className="min-h-[44px] flex-1 gap-1.5 text-xs font-bold"
            style={tone === "default" ? { background: "var(--gradient-brand-hot)" } : undefined}
          >
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DepositModal({
  open,
  onOpenChange,
  initialAmount = 0,
  customerName,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialAmount?: number;
  customerName?: string | null;
  onSubmit: (opts: { amount: number; mode: "cash" | "wallet" }) => Promise<unknown> | void;
}) {
  const [amountText, setAmountText] = useState(String(initialAmount));
  const [mode, setMode] = useState<"cash" | "wallet">("cash");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setAmountText(String(initialAmount));
      setMode("cash");
    }
  }, [open, initialAmount]);

  const parsedAmount = Math.max(0, Math.round(Number(amountText) || 0));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      await onSubmit({ amount: parsedAmount, mode });
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent className="max-w-md border-white/15 bg-[#0e0c1a]/95 text-foreground">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold text-white">
            <IndianRupee className="h-4 w-4 text-primary" />
            Set Booking Deposit
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {customerName
              ? `Update deposit for ${customerName}. Choose cash/counter or deduct from their café wallet.`
              : "Set the advance deposit amount and settlement mode."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Deposit amount (₹)
            </Label>
            <div className="relative">
              <IndianRupee className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="number"
                min={0}
                step={1}
                value={amountText}
                onChange={(e) => setAmountText(e.target.value)}
                className="h-11 pl-9 font-mono text-base"
                autoFocus
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Settlement method
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMode("cash")}
                className={cn(
                  "flex min-h-[52px] items-center gap-2.5 rounded-xl border p-3 text-left transition",
                  mode === "cash"
                    ? "border-primary bg-primary/15 text-white"
                    : "border-white/10 bg-white/[0.03] text-muted-foreground hover:text-white",
                )}
              >
                <Banknote className="h-4 w-4 shrink-0 text-emerald-400" />
                <div>
                  <div className="text-xs font-semibold">Already Paid</div>
                  <div className="text-[10px] text-muted-foreground">Cash / UPI at counter</div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setMode("wallet")}
                className={cn(
                  "flex min-h-[52px] items-center gap-2.5 rounded-xl border p-3 text-left transition",
                  mode === "wallet"
                    ? "border-primary bg-primary/15 text-white"
                    : "border-white/10 bg-white/[0.03] text-muted-foreground hover:text-white",
                )}
              >
                <Wallet className="h-4 w-4 shrink-0 text-primary" />
                <div>
                  <div className="text-xs font-semibold">Deduct Wallet</div>
                  <div className="text-[10px] text-muted-foreground">Charge player balance</div>
                </div>
              </button>
            </div>
          </div>

          <DialogFooter className="gap-2 pt-1 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => onOpenChange(false)}
              className="min-h-[44px] flex-1 border-white/15 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={busy}
              className="min-h-[44px] flex-1 gap-1.5 text-xs font-bold text-white"
              style={{ background: "var(--gradient-brand-hot)" }}
            >
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Save ₹{parsedAmount}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
