import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Megaphone, Send } from "lucide-react";
import { motion } from "framer-motion";
import { broadcastAnnouncement } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/announcements")({
  head: () => ({
    meta: [
      { title: "Announcements — CoreCade admin" },
      { name: "description", content: "Broadcast in-app notifications to every café owner, staff member or customer on the network." },
    ],
  }),
  component: AnnouncePanel,
});

type Audience = "all" | "owners" | "staff" | "customers";

function AnnouncePanel() {
  const [audience, setAudience] = useState<Audience>("owners");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState("");
  const fn = useServerFn(broadcastAnnouncement);
  const m = useMutation({
    mutationFn: fn,
    onSuccess: (res) => {
      toast.success(`Sent to ${res.count} users`);
      setTitle(""); setBody(""); setLink("");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const audiences: { id: Audience; label: string; desc: string }[] = [
    { id: "owners", label: "Café owners", desc: "Every cafe_owner across the network" },
    { id: "staff", label: "Staff", desc: "Every cafe_staff member" },
    { id: "customers", label: "Customers", desc: "All registered customer accounts" },
    { id: "all", label: "Everyone", desc: "All users — use sparingly" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Broadcast in-app push</div>
        <h2 className="font-display text-3xl font-extrabold">Announcements</h2>
        <p className="mt-1 max-w-xl text-sm text-muted-foreground">
          Sends a real-time in-app notification (the bell in the top bar) to the chosen audience. Use for outages, feature launches and important policy changes.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {audiences.map((a) => (
          <button
            key={a.id} onClick={() => setAudience(a.id)}
            className={`rounded-2xl border p-4 text-left transition ${
              audience === a.id ? "border-primary bg-primary/10" : "border-border/60 bg-card/40 hover:border-primary/40"
            }`}
          >
            <div className="font-display text-sm font-bold">{a.label}</div>
            <div className="mt-1 text-xs text-muted-foreground">{a.desc}</div>
          </button>
        ))}
      </div>

      <motion.form
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim()) { toast.error("Title required"); return; }
          m.mutate({ data: { audience, title, body: body || null, link: link || null } });
        }}
        className="space-y-4 rounded-2xl border border-border/60 bg-card/40 p-5 backdrop-blur"
      >
        <div className="flex items-center gap-2">
          <Megaphone className="h-4 w-4 text-primary" />
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Compose</div>
          <Badge variant="outline" className="ml-auto">{audience}</Badge>
        </div>

        <div className="space-y-1.5">
          <Label>Title *</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="New feature: bracket-style tournaments" maxLength={120} />
        </div>
        <div className="space-y-1.5">
          <Label>Body</Label>
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} maxLength={400} placeholder="What's the message?" />
        </div>
        <div className="space-y-1.5">
          <Label>Link (optional)</Label>
          <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="/cafe/your-slug/tournaments" maxLength={400} />
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={m.isPending} className="gap-2" style={{ background: "var(--gradient-brand-hot)" }}>
            <Send className="h-4 w-4" /> {m.isPending ? "Sending…" : `Broadcast to ${audience}`}
          </Button>
        </div>
      </motion.form>
    </div>
  );
}
