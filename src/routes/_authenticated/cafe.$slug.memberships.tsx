import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Crown, Plus, Trash2, UserPlus } from "lucide-react";
import { getCafeBySlug } from "@/lib/cafes.functions";
import { listMemberships, createMembership, deleteMembership, grantMembership } from "@/lib/memberships.functions";
import { listCustomers } from "@/lib/customers.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/EmptyState";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/cafe/$slug/memberships")({
  component: MembershipsPage,
});

function MembershipsPage() {
  const { slug } = Route.useParams();
  const getCafe = useServerFn(getCafeBySlug);
  const { data: cafe } = useQuery({ queryKey: ["cafe", slug], queryFn: () => getCafe({ data: { slug } }) });
  const cafeId = cafe?.id;
  const list = useServerFn(listMemberships);
  const create = useServerFn(createMembership);
  const del = useServerFn(deleteMembership);
  const grant = useServerFn(grantMembership);
  const lCus = useServerFn(listCustomers);

  const q = useQuery({ queryKey: ["memberships", cafeId], queryFn: () => list({ data: { cafe_id: cafeId! } }), enabled: !!cafeId });
  const customersQ = useQuery({ queryKey: ["customers", cafeId], queryFn: () => lCus({ data: { cafe_id: cafeId! } }), enabled: !!cafeId });
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ["memberships", cafeId] });
  const createM = useMutation({ mutationFn: create, onSuccess: () => { toast.success("Created"); refresh(); setOpen(false); }, onError: (e) => toast.error(e instanceof Error ? e.message : "Failed") });
  const delM = useMutation({ mutationFn: del, onSuccess: () => { toast.success("Deleted"); refresh(); } });
  const grantM = useMutation({
    mutationFn: grant,
    onSuccess: () => { toast.success("Granted"); setGrantTo(null); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const [open, setOpen] = useState(false);
  const [grantTo, setGrantTo] = useState<null | { id: string; name: string }>(null);

  if (!cafeId) return <div className="h-40 animate-pulse rounded-2xl border border-border/40 bg-card/30" />;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">{q.data?.length ?? 0} plans</div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" style={{ background: "var(--gradient-brand-hot)" }}>
              <Plus className="h-4 w-4" /> New plan
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create membership</DialogTitle></DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                createM.mutate({
                  data: {
                    cafe_id: cafeId,
                    name: String(fd.get("name")),
                    hours_included: Number(fd.get("hours_included")),
                    price: Number(fd.get("price")),
                    validity_days: Number(fd.get("validity_days")),
                    is_active: true,
                  },
                });
              }}
              className="space-y-3"
            >
              <div className="space-y-1"><Label>Plan name</Label><Input name="name" required placeholder="Weekend Pro" /></div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1"><Label>Hours</Label><Input name="hours_included" type="number" defaultValue={10} required /></div>
                <div className="space-y-1"><Label>Price (₹)</Label><Input name="price" type="number" defaultValue={500} required /></div>
                <div className="space-y-1"><Label>Validity (days)</Label><Input name="validity_days" type="number" defaultValue={30} required /></div>
              </div>
              <DialogFooter><Button type="submit" style={{ background: "var(--gradient-brand-hot)" }}>Create</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mt-4">
        {q.isLoading ? (
          <div className="h-40 animate-pulse rounded-2xl border border-border/40 bg-card/30" />
        ) : (q.data?.length ?? 0) === 0 ? (
          <EmptyState icon={Crown} title="No memberships yet" description="Create your first pre-paid hours plan." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(q.data ?? []).map((m) => (
              <div key={m.id} className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/40 p-5 backdrop-blur">
                <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-violet/30 blur-2xl" />
                <div className="relative flex items-start justify-between">
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{m.validity_days}-day plan</div>
                    <h3 className="mt-1 font-display text-xl font-bold">{m.name}</h3>
                  </div>
                  <Badge variant={m.is_active ? "default" : "secondary"}>{m.is_active ? "Live" : "Off"}</Badge>
                </div>
                <div className="relative mt-4 flex items-baseline gap-2">
                  <div className="font-display text-3xl font-extrabold text-gradient">₹{m.price}</div>
                  <div className="text-xs text-muted-foreground">for {m.hours_included} hrs</div>
                </div>
                <div className="relative mt-4 flex items-center gap-2">
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setGrantTo({ id: m.id, name: m.name })}>
                    <UserPlus className="h-3.5 w-3.5" /> Grant
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => { if (confirm("Delete plan?")) delM.mutate({ data: { id: m.id } }); }}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!grantTo} onOpenChange={(v) => !v && setGrantTo(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Grant {grantTo?.name}</DialogTitle></DialogHeader>
          <div className="max-h-72 overflow-y-auto rounded-xl border border-border/40">
            {(customersQ.data ?? []).length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">No customers</div>
            ) : (customersQ.data ?? []).map((c) => (
              <button
                key={c.id}
                disabled={grantM.isPending}
                className="flex w-full items-center justify-between border-b border-border/40 px-3 py-2 text-left text-sm last:border-0 hover:bg-background/40"
                onClick={() => grantTo && grantM.mutate({ data: { customer_id: c.id, membership_id: grantTo.id } })}
              >
                <span>{c.full_name}</span>
                <span className="font-mono text-xs text-muted-foreground">{c.phone ?? "—"}</span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
