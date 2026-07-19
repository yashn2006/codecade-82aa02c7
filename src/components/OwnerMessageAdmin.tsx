import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Send, LifeBuoy } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { sendOwnerMessage } from "@/lib/messages.functions";

export function OwnerMessageAdmin({ cafeId, trigger }: { cafeId?: string; trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const send = useServerFn(sendOwnerMessage);
  const m = useMutation({
    mutationFn: (payload: { subject: string; body: string }) =>
      send({ data: { cafe_id: cafeId ?? null, ...payload } }),
    onSuccess: () => { toast.success("Message sent to CoreCade admins"); setOpen(false); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant="outline" className="gap-1.5">
            <LifeBuoy className="h-3.5 w-3.5" /> Message admin
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><LifeBuoy className="h-4 w-4" /> Message CoreCade admin</DialogTitle>
          <DialogDescription>Reach the platform team directly. Replies land in your inbox.</DialogDescription>
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
          <div className="space-y-1.5"><Label>Subject</Label>
            <Input name="subject" required maxLength={200} placeholder="Help with…" /></div>
          <div className="space-y-1.5"><Label>Message</Label>
            <Textarea name="body" required rows={5} maxLength={4000} /></div>
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
