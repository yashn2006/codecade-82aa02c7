import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ShieldCheck, Plus, Trash2, Mail } from "lucide-react";
import { getCafeBySlug } from "@/lib/cafes.functions";
import { listStaff, inviteStaff, removeStaff } from "@/lib/staff.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/EmptyState";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/cafe/$slug/staff")({
  component: StaffPage,
});

const PERMS = ["sessions", "bookings", "customers", "wallet"] as const;

function StaffPage() {
  const { slug } = Route.useParams();
  const getCafe = useServerFn(getCafeBySlug);
  const { data: cafe } = useQuery({ queryKey: ["cafe", slug], queryFn: () => getCafe({ data: { slug } }) });
  const cafeId = cafe?.id;
  const list = useServerFn(listStaff);
  const invite = useServerFn(inviteStaff);
  const remove = useServerFn(removeStaff);

  const q = useQuery({ queryKey: ["staff", cafeId], queryFn: () => list({ data: { cafe_id: cafeId! } }), enabled: !!cafeId });
  const qc = useQueryClient();
  const inviteM = useMutation({
    mutationFn: invite,
    onSuccess: () => { toast.success("Invite sent"); qc.invalidateQueries({ queryKey: ["staff", cafeId] }); setOpen(false); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const removeM = useMutation({
    mutationFn: remove,
    onSuccess: () => { toast.success("Removed"); qc.invalidateQueries({ queryKey: ["staff", cafeId] }); },
  });
  const [open, setOpen] = useState(false);
  const [perms, setPerms] = useState<string[]>(["sessions", "bookings"]);

  if (!cafeId) return <div className="h-40 animate-pulse rounded-2xl border border-border/40 bg-card/30" />;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">{q.data?.length ?? 0} staff members</div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" style={{ background: "var(--gradient-brand-hot)" }}>
              <Plus className="h-4 w-4" /> Invite staff
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Invite a staff member</DialogTitle></DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                inviteM.mutate({ data: { cafe_id: cafeId, email: String(fd.get("email")), permissions: perms } });
              }}
              className="space-y-3"
            >
              <div className="space-y-1"><Label>Email</Label><Input name="email" type="email" required placeholder="staff@example.com" /></div>
              <div className="space-y-1.5">
                <Label>Permissions</Label>
                <div className="flex flex-wrap gap-1.5">
                  {PERMS.map((p) => {
                    const active = perms.includes(p);
                    return (
                      <button
                        type="button" key={p}
                        onClick={() => setPerms((cur) => active ? cur.filter((x) => x !== p) : [...cur, p])}
                        className={`rounded-full border px-3 py-1 text-xs transition ${active ? "border-primary bg-primary/10 text-foreground" : "border-border/60 text-muted-foreground hover:text-foreground"}`}
                      >{p}</button>
                    );
                  })}
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={inviteM.isPending} style={{ background: "var(--gradient-brand-hot)" }}>
                  {inviteM.isPending ? "Inviting…" : "Send invite"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mt-4">
        {q.isLoading ? (
          <div className="h-40 animate-pulse rounded-2xl border border-border/40 bg-card/30" />
        ) : (q.data?.length ?? 0) === 0 ? (
          <EmptyState icon={ShieldCheck} title="No staff yet" description="Invite trusted teammates to run the floor with you." />
        ) : (
          <div className="space-y-2">
            {(q.data ?? []).map((s) => {
              const prof = s.profiles as { email?: string; full_name?: string } | null;
              const perms = (s.permissions as string[]) ?? [];
              return (
                <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card/40 p-4 backdrop-blur">
                  <div>
                    <div className="font-medium">{prof?.full_name || prof?.email || "—"}</div>
                    <div className="font-mono text-xs text-muted-foreground"><Mail className="mr-1 inline h-3 w-3" />{prof?.email}</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {perms.length === 0 ? (
                      <Badge variant="secondary">view-only</Badge>
                    ) : perms.map((p) => <Badge key={p} variant="outline">{p}</Badge>)}
                    <Button size="icon" variant="ghost" onClick={() => { if (confirm("Remove this staff member?")) removeM.mutate({ data: { cafe_id: cafeId, staff_user_id: s.staff_user_id } }); }}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
