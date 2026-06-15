import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ownerDeleteCafe } from "@/lib/cafes.functions";
import { toast } from "sonner";

export function DeleteCafeButton({ cafeId, slug, name }: { cafeId: string; slug: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const navigate = useNavigate();
  const fn = useServerFn(ownerDeleteCafe);
  const m = useMutation({
    mutationFn: fn,
    onSuccess: () => {
      toast.success(`"${name}" deleted`);
      setOpen(false);
      navigate({ to: "/owner" });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to delete"),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setTyped(""); }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="destructive" className="gap-1.5">
          <Trash2 className="h-3.5 w-3.5" /> Delete café
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-4 w-4" /> Delete this café?
          </DialogTitle>
          <DialogDescription>
            This permanently removes <span className="font-semibold text-foreground">{name}</span> along with every device,
            booking, session, ledger entry, customer record, and audit log linked to it. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label className="text-xs">Type <span className="font-mono text-destructive">{slug}</span> to confirm.</Label>
          <Input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={slug} autoFocus />
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            variant="destructive"
            disabled={typed !== slug || m.isPending}
            onClick={() => m.mutate({ data: { id: cafeId, confirm_slug: typed } })}
          >
            {m.isPending ? "Deleting…" : "Delete forever"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
