import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Users, Plus } from "lucide-react";
import { getCafeBySlug } from "@/lib/cafes.functions";
import { listCustomers } from "@/lib/customers.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/EmptyState";
import { QueryBoundary } from "@/components/QueryBoundary";
import { CustomerQuickAddForm } from "@/components/CustomerQuickAdd";
import { useCafeAccess } from "@/hooks/useCafeAccess";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/cafe/$slug/customers")({
  head: () => ({
    meta: [
      { title: "Customers — CoreCade" },
      { name: "description", content: "Search regulars, view wallet balance and visit history." },
      { property: "og:title", content: "Customers — CoreCade" },
      { property: "og:description", content: "Search regulars, view wallet balance and visit history." },
    ],
  }),
  component: CustomersPage,
});

function CustomersPage() {
  const { slug } = Route.useParams();
  const getCafe = useServerFn(getCafeBySlug);
  const cafeQ = useQuery({ queryKey: ["cafe", slug], queryFn: () => getCafe({ data: { slug } }) });
  const cafe = cafeQ.data;
  const cafeId = cafe?.id;
  const { can } = useCafeAccess(cafeId);
  const canRegister = can("register_customers");
  const list = useServerFn(listCustomers);
  const q = useQuery({ queryKey: ["customers", cafeId], queryFn: () => list({ data: { cafe_id: cafeId! } }), enabled: !!cafeId });
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  if (cafeQ.isError || !cafeId) {
    return (
      <QueryBoundary queries={[cafeQ]} loading={!cafeQ.isError && !cafeId} errorTitle="Couldn't load customers">
        {null}
      </QueryBoundary>
    );
  }

  const filtered = (q.data ?? []).filter((c) =>
    !search || c.full_name.toLowerCase().includes(search.toLowerCase()) || (c.phone ?? "").includes(search),
  );

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Input placeholder="Search name or phone…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
        {canRegister && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button className="gap-2" style={{ background: "var(--gradient-brand-hot)" }}><Plus className="h-4 w-4" /> Add customer</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add customer</DialogTitle></DialogHeader>
              <CustomerQuickAddForm
                cafeId={cafeId}
                customers={q.data ?? []}
                showEmail
                submitLabel="Add customer"
                onSuccess={() => setOpen(false)}
                onCancel={() => setOpen(false)}
              />
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="mt-4">
        <QueryBoundary queries={[q]} errorTitle="Couldn't load customers">
          {filtered.length === 0 ? (
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
        </QueryBoundary>
      </div>
    </div>
  );
}
