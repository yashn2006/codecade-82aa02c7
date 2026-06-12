import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Cpu, Plus, Trash2, Pencil, Lock, Unlock, Camera, MessageSquare, RotateCw, XCircle, Terminal, Info } from "lucide-react";
import { getCafeBySlug } from "@/lib/cafes.functions";
import { listDevices, createDevice, updateDevice, deleteDevice } from "@/lib/devices.functions";
import { listDeviceCommands, createDeviceCommand, cancelDeviceCommand, type DeviceCommand } from "@/lib/device-commands.functions";
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
  const [controlling, setControlling] = useState<null | { id: string; name: string }>(null);

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
                      <Button size="icon" variant="ghost" title="Remote control" onClick={() => setControlling({ id: d.id, name: d.name })}>
                        <Terminal className="h-3.5 w-3.5 text-primary" />
                      </Button>
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

      <DeviceControlDialog
        cafeId={cafeId}
        device={controlling}
        onClose={() => setControlling(null)}
      />
    </div>
  );
}

function DeviceControlDialog({ cafeId, device, onClose }: { cafeId: string; device: { id: string; name: string } | null; onClose: () => void }) {
  const lc = useServerFn(listDeviceCommands);
  const cc = useServerFn(createDeviceCommand);
  const cx = useServerFn(cancelDeviceCommand);
  const qc = useQueryClient();
  const [message, setMessage] = useState("");

  const cmdQ = useQuery({
    queryKey: ["devcmds", device?.id],
    queryFn: () => lc({ data: { cafe_id: cafeId, device_id: device!.id, limit: 30 } }),
    enabled: !!device,
    refetchInterval: 5_000,
  });
  const createM = useMutation({
    mutationFn: cc,
    onSuccess: () => { toast.success("Command queued"); qc.invalidateQueries({ queryKey: ["devcmds", device?.id] }); setMessage(""); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const cancelM = useMutation({
    mutationFn: cx,
    onSuccess: () => { toast.success("Cancelled"); qc.invalidateQueries({ queryKey: ["devcmds", device?.id] }); },
  });

  function send(command: DeviceCommand, payload?: Record<string, unknown>) {
    if (!device) return;
    createM.mutate({ data: { cafe_id: cafeId, device_id: device.id, command, payload } });
  }

  const actions: { cmd: DeviceCommand; label: string; icon: typeof Lock; tone?: string }[] = [
    { cmd: "lock", label: "Lock", icon: Lock },
    { cmd: "unlock", label: "Unlock", icon: Unlock },
    { cmd: "screenshot", label: "Screenshot", icon: Camera },
    { cmd: "reboot", label: "Reboot", icon: RotateCw, tone: "destructive" },
    { cmd: "kill_session", label: "Kill session", icon: XCircle, tone: "destructive" },
  ];

  return (
    <Dialog open={!!device} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Remote control · {device?.name}</DialogTitle></DialogHeader>

        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5 text-[11px] text-amber-200">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>Commands are queued in your database. Physical execution requires the <b>CoreCade agent</b> running on the PC — it polls this queue and executes.</span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {actions.map((a) => (
            <Button
              key={a.cmd}
              variant={a.tone === "destructive" ? "destructive" : "outline"}
              className="h-16 flex-col gap-1"
              onClick={() => {
                if (a.tone === "destructive" && !confirm(`${a.label}?`)) return;
                send(a.cmd);
              }}
              disabled={createM.isPending}
            >
              <a.icon className="h-4 w-4" />
              <span className="text-[11px]">{a.label}</span>
            </Button>
          ))}
        </div>

        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-1">
            <Label className="text-xs">Send message to screen</Label>
            <Input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Time's almost up!" />
          </div>
          <Button onClick={() => message.trim() && send("message", { text: message.trim() })} className="gap-2">
            <MessageSquare className="h-4 w-4" /> Send
          </Button>
        </div>

        <div>
          <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Recent commands</div>
          <div className="max-h-56 space-y-1 overflow-y-auto">
            {(cmdQ.data ?? []).length === 0 ? (
              <div className="rounded-md border border-dashed border-border/40 p-3 text-center text-xs text-muted-foreground">No commands yet</div>
            ) : (cmdQ.data ?? []).map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-md border border-border/40 bg-background/30 px-2 py-1.5 text-xs">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono text-[10px] uppercase">{c.command}</Badge>
                  <span className="font-mono text-[10px] text-muted-foreground">{new Date(c.created_at).toLocaleTimeString()}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge variant={c.status === "executed" ? "default" : c.status === "failed" ? "destructive" : c.status === "cancelled" ? "secondary" : "outline"}>
                    {c.status}
                  </Badge>
                  {c.status === "pending" && (
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => cancelM.mutate({ data: { id: c.id } })} title="Cancel">
                      <XCircle className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter><Button variant="ghost" onClick={onClose}>Close</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
