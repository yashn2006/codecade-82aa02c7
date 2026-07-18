import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Send, Megaphone, Mail } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { sendAdminMessage, broadcastAdminMessage } from "@/lib/messages.functions";

export function AdminMessageComposer({
  cafeId, cafeName, trigger, mode = "single", open: openProp, onOpenChange,
}: {
  cafeId?: string;
  cafeName?: string;
  trigger?: React.ReactNode;
  mode?: "single" | "broadcast";
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
}) {
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const setOpen = onOpenChange ?? setOpenState;
  const send = useServerFn(sendAdminMessage);
  const broadcast = useServerFn(broadcastAdminMessage);

  const m = useMutation({
    mutationFn: async (payload: { subject: string; body: string }) => {
      if (mode === "broadcast") return broadcast({ data: payload });
      if (!cafeId) throw new Error("cafe id required");
      return send({ data: { cafe_id: cafeId, ...payload } });
    },
    onSuccess: (res) => {
      toast.success(
        mode === "broadcast"
          ? `Broadcast sent to ${(res as { count?: number }).count ?? 0} café(s)`
          : "Message delivered",
      );
      setOpen(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger !== null && (
        <DialogTrigger asChild>
          {trigger ?? (
            <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs">
              {mode === "broadcast" ? <Megaphone className="h-3 w-3" /> : <Mail className="h-3 w-3" />}
              {mode === "broadcast" ? "Broadcast" : "Message"}
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mode === "broadcast" ? <Megaphone className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
            {mode === "broadcast" ? "Broadcast to all cafés" : `Message ${cafeName ?? "owner"}`}
          </DialogTitle>
          <DialogDescription>
            {mode === "broadcast"
              ? "Every active café owner receives an in-app notification."
              : "Sent to the owner's inbox with an in-app notification."}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const subject = String(fd.get("subject") || "").trim();
            const body = String(fd.get("body") || "").trim();
            if (!subject || !body) { toast.error("Subject + body required"); return; }
            m.mutate({ subject, body });
          }}
          className="space-y-3"
        >
          <div className="space-y-1.5">
            <Label>Subject</Label>
            <Input name="subject" required maxLength={200} placeholder="Heads-up on your subscription" />
          </div>
          <div className="space-y-1.5">
            <Label>Message</Label>
            <Textarea name="body" required rows={5} maxLength={4000} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={m.isPending} className="gap-2" style={{ background: "var(--gradient-brand-hot)" }}>
              <Send className="h-4 w-4" /> {m.isPending ? "Sending…" : "Send"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
