import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Cpu, Plus, Trash2, Pencil } from "lucide-react";
import { getCafeBySlug } from "@/lib/cafes.functions";
import { listDevices, createDevice, updateDevice, deleteDevice } from "@/lib/devices.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/EmptyState";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/cafe/$slug/devices")({
  head: () => ({
    meta: [
      { title: "Devices — CoreCade" },
      { name: "description", content: "Manage PCs, consoles, VR rigs and station availability." },
      { property: "og:title", content: "Devices — CoreCade" },
      { property: "og:description", content: "Manage PCs, consoles, VR rigs and station availability." },
    ],
  }),
  component: DevicesPage,
});

const TYPES = ["pc", "console", "vr", "racing", "other"] as const;
const STATUSES = ["available", "in_use", "reserved", "suspended", "maintenance"] as const;

function DevicesPage() {
  const { slug } = Route.useParams();
  const getCafe = useServerFn(getCafeBySlug);
  const { data: cafe } = useQuery({ queryKey: ["cafe", slug], queryFn: () => getCafe({ data: { slug } }) });
  const cafeId = cafe?.id;
  const list = useServerFn(listDevices);
  const create = useServerFn(createDevice);
  const update = useServerFn(updateDevice);
  const del = useServerFn(deleteDevice);

  const q = useQuery({
    queryKey: ["devices", cafeId],
    queryFn: () => list({ data: { cafe_id: cafeId! } }),
    enabled: !!cafeId,
  });

  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ["devices", cafeId] });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<null | { id: string; name: string; type: string; hourly_rate: number; status: string }>(null);

  const createM = useMutation({
    mutationFn: create,
    onSuccess: () => { toast.success("Device added"); refresh(); setOpen(false); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const updateM = useMutation({
    mutationFn: update,
    onSuccess: () => { toast.success("Updated"); refresh(); setEditing(null); },
  });
  const delM = useMutation({
    mutationFn: del,
    onSuccess: () => { toast.success("Deleted"); refresh(); },
  });

  if (!cafeId) return <div className="h-40 animate-pulse rounded-2xl border border-border/40 bg-card/30" />;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">{q.data?.length ?? 0} devices</div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" style={{ background: "var(--gradient-brand-hot)" }}>
              <Plus className="h-4 w-4" /> Add device
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add device</DialogTitle></DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                createM.mutate({
                  data: {
                    cafe_id: cafeId,
                    name: String(fd.get("name")),
                    type: String(fd.get("type")) as typeof TYPES[number],
                    hourly_rate: Number(fd.get("hourly_rate")) || 0,
                  },
                });
              }}
              className="space-y-3"
            >
              <div className="space-y-1"><Label>Name</Label><Input name="name" required placeholder="PC-01" /></div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>Type</Label>
                  <select name="type" defaultValue="pc" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                    {TYPES.map((t) => <option key={t} value={t}>{t.toUpperCase()}</option>)}
                  </select>
                </div>
                <div className="space-y-1"><Label>Hourly rate (₹)</Label><Input name="hourly_rate" type="number" defaultValue={100} required /></div>
              </div>
              <DialogFooter>
                <Button type="submit" style={{ background: "var(--gradient-brand-hot)" }}>Add</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mt-4">
        {q.isLoading ? (
          <div className="h-40 animate-pulse rounded-2xl border border-border/40 bg-card/30" />
        ) : !q.data || q.data.length === 0 ? (
          <EmptyState icon={Cpu} title="No devices yet" description="Add your first PC, console, or VR rig." />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/30 backdrop-blur">
            <table className="w-full text-sm">
              <thead className="border-b border-border/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr><th className="p-3">Name</th><th className="p-3">Type</th><th className="p-3">Rate</th><th className="p-3">Status</th><th className="p-3 text-right">Actions</th></tr>
              </thead>
              <tbody>
                {q.data.map((d) => (
                  <tr key={d.id} className="border-b border-border/30 last:border-0">
                    <td className="p-3 font-medium">{d.name}</td>
                    <td className="p-3 font-mono text-xs uppercase">{d.type}</td>
                    <td className="p-3 text-azure">₹{d.hourly_rate}/hr</td>
                    <td className="p-3"><Badge variant={d.status === "in_use" ? "default" : d.status === "maintenance" ? "secondary" : "outline"}>{d.status}</Badge></td>
                    <td className="p-3 text-right">
                      <Button size="icon" variant="ghost" onClick={() => setEditing({ id: d.id, name: d.name, type: d.type, hourly_rate: d.hourly_rate, status: d.status })}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => { if (confirm("Delete device?")) delM.mutate({ data: { id: d.id } }); }}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit device</DialogTitle></DialogHeader>
          {editing && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                updateM.mutate({
                  data: {
                    id: editing.id,
                    patch: {
                      name: String(fd.get("name")),
                      type: String(fd.get("type")) as typeof TYPES[number],
                      hourly_rate: Number(fd.get("hourly_rate")),
                      status: String(fd.get("status")) as typeof STATUSES[number],
                      cafe_id: cafeId,
                    },
                  },
                });
              }}
              className="space-y-3"
            >
              <div className="space-y-1"><Label>Name</Label><Input name="name" defaultValue={editing.name} required /></div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <Label>Type</Label>
                  <select name="type" defaultValue={editing.type} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                    {TYPES.map((t) => <option key={t} value={t}>{t.toUpperCase()}</option>)}
                  </select>
                </div>
                <div className="space-y-1"><Label>Rate</Label><Input name="hourly_rate" type="number" defaultValue={editing.hourly_rate} required /></div>
                <div className="space-y-1">
                  <Label>Status</Label>
                  <select name="status" defaultValue={editing.status} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <DialogFooter><Button type="submit" style={{ background: "var(--gradient-brand-hot)" }}>Save</Button></DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
