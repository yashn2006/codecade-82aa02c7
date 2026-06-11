import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Users, Plus } from "lucide-react";
import { getCafeBySlug } from "@/lib/cafes.functions";
import { listCustomers, createCustomer } from "@/lib/customers.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/EmptyState";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/cafe/$slug/customers")({
  component: CustomersPage,
});

function CustomersPage() {
  const { slug } = Route.useParams();
  const getCafe = useServerFn(getCafeBySlug);
  const { data: cafe } = useQuery({ queryKey: ["cafe", slug], queryFn: () => getCafe({ data: { slug } }) });
  const cafeId = cafe?.id;
  const list = useServerFn(listCustomers);
  const create = useServerFn(createCustomer);
  const q = useQuery({ queryKey: ["customers", cafeId], queryFn: () => list({ data: { cafe_id: cafeId! } }), enabled: !!cafeId });
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: create,
    onSuccess: () => { toast.success("Added"); qc.invalidateQueries({ queryKey: ["customers", cafeId] }); setOpen(false); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  if (!cafeId) return <div className="h-40 animate-pulse rounded-2xl border border-border/40 bg-card/30" />;

  const filtered = (q.data ?? []).filter((c) =>
    !search || c.full_name.toLowerCase().includes(search.toLowerCase()) || (c.phone ?? "").includes(search),
  );

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Input placeholder="Search name or phone…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="gap-2" style={{ background: "var(--gradient-brand-hot)" }}><Plus className="h-4 w-4" /> Add customer</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add customer</DialogTitle></DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                m.mutate({ data: { cafe_id: cafeId, full_name: String(fd.get("full_name")), phone: String(fd.get("phone") || "") || null, email: String(fd.get("email") || "") || null } });
              }}
              className="space-y-3"
            >
              <div className="space-y-1"><Label>Name</Label><Input name="full_name" required /></div>
              <div className="space-y-1"><Label>Phone</Label><Input name="phone" /></div>
              <div className="space-y-1"><Label>Email</Label><Input name="email" type="email" /></div>
              <DialogFooter><Button type="submit" style={{ background: "var(--gradient-brand-hot)" }}>Add</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mt-4">
        {q.isLoading ? (
          <div className="h-40 animate-pulse rounded-2xl border border-border/40 bg-card/30" />
        ) : filtered.length === 0 ? (
          <EmptyState icon={Users} title="No customers" description="Add your first customer or wait for sign-ups." />
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((c) => (
              <div key={c.id} className="rounded-2xl border border-border/60 bg-card/40 p-4 backdrop-blur">
                <div className="font-medium">{c.full_name}</div>
                <div className="mt-1 font-mono text-xs text-muted-foreground">{c.phone ?? "—"}{c.email ? ` · ${c.email}` : ""}</div>
                <div className="mt-3 text-xs text-azure">Wallet: ₹{c.wallet_balance}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
