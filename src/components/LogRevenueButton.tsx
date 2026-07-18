import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { IndianRupee, ReceiptText } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { logManualRevenue } from "@/lib/messages.functions";

const KINDS = ["cash", "upi", "card", "other"] as const;
const SOURCES = ["session", "pos", "membership", "tournament", "other"] as const;

export function LogRevenueButton({ cafeId }: { cafeId: string }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<(typeof KINDS)[number]>("cash");
  const [source, setSource] = useState<(typeof SOURCES)[number]>("session");
  const qc = useQueryClient();
  const fn = useServerFn(logManualRevenue);

  const m = useMutation({
    mutationFn: fn,
    onSuccess: () => {
      toast.success("Payment logged");
      qc.invalidateQueries({ queryKey: ["cafe-analytics"] });
      qc.invalidateQueries({ queryKey: ["cafe-deep-stats"] });
      setOpen(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <IndianRupee className="h-3.5 w-3.5" />
          Log payment
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ReceiptText className="h-4 w-4" /> Log a manual payment</DialogTitle>
          <DialogDescription>Cash, UPI QR, card swipe — anything that didn't go through checkout.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const amt = parseFloat(String(fd.get("amount") || "0"));
            if (!amt || amt <= 0) { toast.error("Enter an amount"); return; }
            m.mutate({ data: {
              cafe_id: cafeId, amount_rupees: amt, kind, source,
              note: String(fd.get("note") || "") || null,
            } });
          }}
          className="space-y-3"
        >
          <div className="space-y-1.5">
            <Label>Amount (₹)</Label>
            <Input name="amount" type="number" step="0.01" min="1" required autoFocus placeholder="500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Method</Label>
              <div className="flex flex-wrap gap-1">
                {KINDS.map((k) => (
                  <Button key={k} type="button" size="sm" variant={kind === k ? "default" : "outline"} onClick={() => setKind(k)} className="capitalize">
                    {k}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Source</Label>
              <div className="flex flex-wrap gap-1">
                {SOURCES.map((s) => (
                  <Button key={s} type="button" size="sm" variant={source === s ? "default" : "outline"} onClick={() => setSource(s)} className="capitalize">
                    {s}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Note (optional)</Label>
            <Textarea name="note" rows={2} placeholder="Table 4 — 2 hrs PS5" />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={m.isPending} style={{ background: "var(--gradient-brand-hot)" }}>
              {m.isPending ? "Logging…" : "Log payment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
