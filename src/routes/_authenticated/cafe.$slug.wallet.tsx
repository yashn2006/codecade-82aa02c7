import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Wallet, Plus, Minus, Receipt, Download } from "lucide-react";
import { getCafeBySlug } from "@/lib/cafes.functions";
import { listCustomers } from "@/lib/customers.functions";
import { adjustWallet, listWalletTransactions, exportWalletCSV } from "@/lib/wallet.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/EmptyState";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/cafe/$slug/wallet")({
  head: () => ({
    meta: [
      { title: "Wallet — CoreCade" },
      { name: "description", content: "Top-ups, refunds and customer wallet ledgers." },
      { property: "og:title", content: "Wallet — CoreCade" },
      { property: "og:description", content: "Top-ups, refunds and customer wallet ledgers." },
    ],
  }),
  component: WalletPage,
});

function WalletPage() {
  const { slug } = Route.useParams();
  const getCafe = useServerFn(getCafeBySlug);
  const { data: cafe } = useQuery({ queryKey: ["cafe", slug], queryFn: () => getCafe({ data: { slug } }) });
  const cafeId = cafe?.id;

  const lCus = useServerFn(listCustomers);
  const lTx = useServerFn(listWalletTransactions);
  const adj = useServerFn(adjustWallet);

  const customersQ = useQuery({ queryKey: ["customers", cafeId], queryFn: () => lCus({ data: { cafe_id: cafeId! } }), enabled: !!cafeId });
  const txQ = useQuery({ queryKey: ["wallet-tx", cafeId], queryFn: () => lTx({ data: { cafe_id: cafeId! } }), enabled: !!cafeId });
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: adj,
    onSuccess: () => {
      toast.success("Wallet updated");
      qc.invalidateQueries({ queryKey: ["customers", cafeId] });
      qc.invalidateQueries({ queryKey: ["wallet-tx", cafeId] });
      setSel(null);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const [sel, setSel] = useState<null | { id: string; name: string; balance: number; sign: 1 | -1 }>(null);

  if (!cafeId) return <div className="h-40 animate-pulse rounded-2xl border border-border/40 bg-card/30" />;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div>
        <div className="text-sm text-muted-foreground">Customer wallets</div>
        <div className="mt-3 space-y-2">
          {(customersQ.data ?? []).length === 0 ? (
            <EmptyState icon={Wallet} title="No customers" description="Add customers first to manage their wallets." />
          ) : (customersQ.data ?? []).map((c) => (
            <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card/40 p-4 backdrop-blur">
              <div>
                <div className="font-medium">{c.full_name}</div>
                <div className="font-mono text-xs text-muted-foreground">{c.phone ?? "—"}</div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Balance</div>
                  <div className="font-display text-xl font-bold text-gradient">₹{c.wallet_balance}</div>
                </div>
                <Button size="icon" variant="outline" onClick={() => setSel({ id: c.id, name: c.full_name, balance: c.wallet_balance, sign: 1 })}>
                  <Plus className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="outline" onClick={() => setSel({ id: c.id, name: c.full_name, balance: c.wallet_balance, sign: -1 })}>
                  <Minus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <aside>
        <div className="rounded-2xl border border-border/60 bg-card/40 p-4 backdrop-blur">
          <div className="flex items-center gap-2"><Receipt className="h-4 w-4 text-azure" /><div className="text-sm font-medium">Recent transactions</div></div>
          <div className="mt-3 space-y-2 max-h-[480px] overflow-y-auto">
            {(txQ.data ?? []).length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/40 p-6 text-center text-xs text-muted-foreground">No transactions yet</div>
            ) : (txQ.data ?? []).map((t) => {
              const positive = t.amount > 0;
              return (
                <div key={t.id} className="rounded-xl border border-border/40 p-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{(t.customers as { full_name?: string } | null)?.full_name ?? "—"}</span>
                    <span className={`font-mono ${positive ? "text-emerald-400" : "text-rose-400"}`}>{positive ? "+" : ""}₹{t.amount}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-muted-foreground">
                    <Badge variant="outline" className="text-[10px]">{t.kind}</Badge>
                    <span className="font-mono">{new Date(t.created_at).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                  {t.note && <div className="mt-1 text-muted-foreground">{t.note}</div>}
                </div>
              );
            })}
          </div>
        </div>
      </aside>

      <Dialog open={!!sel} onOpenChange={(v) => !v && setSel(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{sel?.sign === 1 ? "Top up" : "Deduct from"} {sel?.name}'s wallet</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!sel) return;
              const fd = new FormData(e.currentTarget);
              const amt = Number(fd.get("amount")) || 0;
              if (amt <= 0) return toast.error("Amount must be > 0");
              m.mutate({
                data: {
                  customer_id: sel.id,
                  cafe_id: cafeId,
                  amount: sel.sign * amt,
                  kind: sel.sign === 1 ? "topup" : "adjust",
                  note: String(fd.get("note") || "") || null,
                },
              });
            }}
            className="space-y-3"
          >
            <div className="rounded-xl border border-border/40 p-3 text-xs text-muted-foreground">
              Current balance: <span className="font-mono text-foreground">₹{sel?.balance}</span>
            </div>
            <div className="space-y-1"><Label>Amount (₹)</Label><Input name="amount" type="number" min={1} required autoFocus /></div>
            <div className="space-y-1"><Label>Note (optional)</Label><Input name="note" placeholder="Cash, UPI, refund…" /></div>
            <DialogFooter>
              <Button type="submit" disabled={m.isPending} style={{ background: "var(--gradient-brand-hot)" }}>
                {m.isPending ? "Saving…" : sel?.sign === 1 ? "Add" : "Deduct"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
