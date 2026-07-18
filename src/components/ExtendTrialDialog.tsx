import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { format, differenceInCalendarDays } from "date-fns";
import { CalendarPlus, CalendarIcon } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { extendCafeTrial } from "@/lib/messages.functions";

export function ExtendTrialDialog({
  cafeId, cafeName, currentEndsAt, trigger, open: openProp, onOpenChange,
}: {
  cafeId: string;
  cafeName: string;
  currentEndsAt: string | null;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
}) {
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const setOpen = onOpenChange ?? setOpenState;
  const [date, setDate] = useState<Date | undefined>();
  const [reason, setReason] = useState("");
  const qc = useQueryClient();
  const fn = useServerFn(extendCafeTrial);

  const base = currentEndsAt ? new Date(currentEndsAt) : new Date();
  const target = date ?? base;
  const addDays = Math.max(1, differenceInCalendarDays(target, base));

  const m = useMutation({
    mutationFn: fn,
    onSuccess: (res) => {
      toast.success(`Trial extended → ${new Date(res.new_ends_at).toDateString()}`);
      qc.invalidateQueries({ queryKey: ["admin-cafes"] });
      qc.invalidateQueries({ queryKey: ["admin-overview"] });
      setOpen(false); setDate(undefined); setReason("");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger !== null && (
        <DialogTrigger asChild>
          {trigger ?? (
            <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs">
              <CalendarPlus className="h-3 w-3" /> Extend trial
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><CalendarPlus className="h-4 w-4" /> Extend trial — {cafeName}</DialogTitle>
          <DialogDescription>
            Current end: <b>{currentEndsAt ? new Date(currentEndsAt).toDateString() : "not set"}</b>. Pick a new date.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>New trial end date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single" selected={date} onSelect={setDate} initialFocus
                  disabled={(d) => d < base}
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="flex gap-1.5">
            {[7, 15, 30, 90].map((n) => (
              <Button key={n} size="sm" variant="outline" onClick={() => setDate(new Date(base.getTime() + n * 86_400_000))}>
                +{n}d
              </Button>
            ))}
          </div>
          <div className="space-y-1.5">
            <Label>Reason (optional)</Label>
            <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Goodwill after onboarding delay" />
          </div>
          {date && (
            <div className="rounded-lg border border-border/60 bg-card/40 p-2 text-xs">
              Will add <b>{addDays}</b> day(s). New end: <b>{format(target, "PPP")}</b>.
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            disabled={!date || m.isPending}
            onClick={() => date && m.mutate({ data: { cafe_id: cafeId, add_days: addDays, reason: reason || null } })}
            style={{ background: "var(--gradient-brand-hot)" }}
          >
            {m.isPending ? "Extending…" : "Extend trial"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
