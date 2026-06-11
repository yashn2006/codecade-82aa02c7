import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Wrench } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { setCafeMaintenance } from "@/lib/cafes.functions";
import { setPlatformMaintenance } from "@/lib/platform.functions";
import { isMaintenanceActive, maintenanceCountdown, type MaintenanceWindow } from "@/lib/maintenance";

function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(v: string): string | null {
  if (!v) return null;
  return new Date(v).toISOString();
}

type Scope =
  | { kind: "cafe"; cafeId: string; cafeName: string }
  | { kind: "platform" };

export function MaintenanceScheduler({
  scope,
  current,
  trigger,
  onSaved,
}: {
  scope: Scope;
  current: (MaintenanceWindow & { title?: string | null }) | null;
  trigger?: React.ReactNode;
  onSaved?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const saveCafe = useServerFn(setCafeMaintenance);
  const savePlatform = useServerFn(setPlatformMaintenance);

  const m = useMutation({
    mutationFn: async (payload: {
      starts_at: string | null;
      ends_at: string | null;
      title: string | null;
      message: string | null;
    }) => {
      if (scope.kind === "cafe") {
        return saveCafe({ data: {
          id: scope.cafeId,
          starts_at: payload.starts_at,
          ends_at: payload.ends_at,
          message: payload.message,
        } });
      }
      return savePlatform({ data: payload });
    },
    onSuccess: () => {
      toast.success("Maintenance schedule saved");
      onSaved?.();
      setOpen(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const active = isMaintenanceActive(current);
  const countdown = maintenanceCountdown(current);
  const title = scope.kind === "platform" ? "Platform maintenance" : `Maintenance · ${scope.cafeName}`;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant={active ? "destructive" : "outline"} className="gap-1.5">
            <Wrench className="h-3.5 w-3.5" />
            {active ? "In maintenance" : "Maintenance"}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="h-4 w-4 text-amber-400" /> {title}
          </DialogTitle>
        </DialogHeader>
        {active && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200">
            Currently in maintenance · {countdown ?? "no end time"}
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const starts = fromLocalInput(String(fd.get("starts") || ""));
            const ends = fromLocalInput(String(fd.get("ends") || ""));
            const msg = String(fd.get("message") || "").trim() || null;
            const ttl = scope.kind === "platform" ? (String(fd.get("title") || "").trim() || null) : null;
            if (starts && ends && new Date(ends) <= new Date(starts)) {
              toast.error("End time must be after start time");
              return;
            }
            m.mutate({ starts_at: starts, ends_at: ends, message: msg, title: ttl });
          }}
          className="space-y-3"
        >
          {scope.kind === "platform" && (
            <div className="space-y-1">
              <Label>Banner title</Label>
              <Input
                name="title"
                placeholder="Scheduled upgrade"
                defaultValue={current?.title ?? ""}
                maxLength={120}
              />
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Starts at</Label>
              <Input type="datetime-local" name="starts" defaultValue={toLocalInput(current?.starts_at ?? null)} />
            </div>
            <div className="space-y-1">
              <Label>Ends at <span className="text-muted-foreground">(optional)</span></Label>
              <Input type="datetime-local" name="ends" defaultValue={toLocalInput(current?.ends_at ?? null)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Public message</Label>
            <Textarea
              name="message"
              rows={3}
              maxLength={500}
              placeholder={scope.kind === "platform"
                ? "We'll be back shortly — upgrading the booking engine."
                : "Air-con repair · stations are offline until tonight."}
              defaultValue={current?.message ?? ""}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Tip: leave end time blank to require a manual lift. Clear both to remove the window.
          </p>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => m.mutate({ starts_at: null, ends_at: null, title: null, message: null })}
              disabled={m.isPending}
            >
              Clear schedule
            </Button>
            <Button
              type="submit"
              disabled={m.isPending}
              style={{ background: "var(--gradient-brand-hot)" }}
            >
              {m.isPending ? "Saving…" : "Save schedule"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
