import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Wallet, Plus, Minus, Receipt, Download, FileText, CreditCard } from "lucide-react";
import { getCafeBySlug } from "@/lib/cafes.functions";
import { listCustomers } from "@/lib/customers.functions";
import { adjustWallet, listWalletTransactions, exportWalletCSV } from "@/lib/wallet.functions";
import { createTopupOrder, verifyTopupPayment, getRazorpayConfig } from "@/lib/razorpay.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/EmptyState";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { PrintableStatement, type StatementTx } from "@/components/PrintableStatement";

// Razorpay window type is declared once in src/components/BookingFlow.tsx

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if (window.Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

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
  const csvFn = useServerFn(exportWalletCSV);

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
  const [statementFor, setStatementFor] = useState<null | { id: string; name: string; phone: string | null; balance: number }>(null);
  const [rzpBusy, setRzpBusy] = useState(false);

  const rzpCfgFn = useServerFn(getRazorpayConfig);
  const rzpCfgQ = useQuery({ queryKey: ["rzp-cfg"], queryFn: () => rzpCfgFn() });
  const createOrderFn = useServerFn(createTopupOrder);
  const verifyFn = useServerFn(verifyTopupPayment);

  useEffect(() => { void loadRazorpayScript(); }, []);

  async function payRazorpay() {
    if (!sel || !cafeId) return;
    const fd = document.getElementById("wallet-form") as HTMLFormElement | null;
    const amt = Number(new FormData(fd ?? undefined).get("amount")) || 0;
    if (amt <= 0) return toast.error("Enter amount first");
    if (!rzpCfgQ.data?.enabled) return toast.error("Razorpay not configured");
    setRzpBusy(true);
    try {
      const ok = await loadRazorpayScript();
      if (!ok || !window.Razorpay) throw new Error("Could not load Razorpay");
      const order = await createOrderFn({ data: { cafe_id: cafeId, customer_id: sel.id, amount: amt } });
      const rzp = new window.Razorpay({
        key: order.key_id,
        amount: order.amount * 100,
        currency: order.currency,
        name: cafe?.name ?? "CoreCade",
        description: `Wallet top-up — ${sel.name}`,
        order_id: order.order_id,
        prefill: { name: sel.name },
        theme: { color: "#ec4899" },
        handler: async (resp: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          try {
            await verifyFn({ data: { topup_id: order.topup_id, ...resp } });
            toast.success(`₹${amt} added via Razorpay`);
            qc.invalidateQueries({ queryKey: ["customers", cafeId] });
            qc.invalidateQueries({ queryKey: ["wallet-tx", cafeId] });
            setSel(null);
          } catch (e) { toast.error(e instanceof Error ? e.message : "Verify failed"); }
        },
        modal: { ondismiss: () => setRzpBusy(false) },
      });
      rzp.open();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Razorpay failed");
    } finally {
      setRzpBusy(false);
    }
  }

  const stmtTxQ = useQuery({
    queryKey: ["wallet-tx", "customer", statementFor?.id],
    queryFn: () => lTx({ data: { customer_id: statementFor!.id } }),
    enabled: !!statementFor,
  });

  if (!cafeId) return <div className="h-40 animate-pulse rounded-2xl border border-border/40 bg-card/30" />;

  async function downloadCSV() {
    try {
      const r = await csvFn({ data: { cafe_id: cafeId! } });
      const blob = new Blob([r.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `wallet-statement-${cafeId}-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${r.count} rows`);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div>
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm text-muted-foreground">Customer wallets</div>
          <Button size="sm" variant="outline" className="gap-2" onClick={downloadCSV}>
            <Download className="h-4 w-4" /> Statement CSV
          </Button>
        </div>
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
                <Button size="icon" variant="outline" onClick={() => setSel({ id: c.id, name: c.full_name, balance: c.wallet_balance, sign: 1 })} title="Add">
                  <Plus className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="outline" onClick={() => setSel({ id: c.id, name: c.full_name, balance: c.wallet_balance, sign: -1 })} title="Deduct">
                  <Minus className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="outline" onClick={() => setStatementFor({ id: c.id, name: c.full_name, phone: c.phone, balance: c.wallet_balance })} title="Print statement">
                  <FileText className="h-4 w-4" />
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
            id="wallet-form"
          >
            <div className="rounded-xl border border-border/40 p-3 text-xs text-muted-foreground">
              Current balance: <span className="font-mono text-foreground">₹{sel?.balance}</span>
            </div>
            <div className="space-y-1"><Label>Amount (₹)</Label><Input name="amount" type="number" min={1} required autoFocus /></div>
            <div className="space-y-1"><Label>Note (optional)</Label><Input name="note" placeholder="Cash, UPI, refund…" /></div>
            <DialogFooter className="flex-col gap-2 sm:flex-row">
              <Button type="submit" disabled={m.isPending} style={{ background: "var(--gradient-brand-hot)" }}>
                {m.isPending ? "Saving…" : sel?.sign === 1 ? "Add (cash)" : "Deduct"}
              </Button>
              {sel?.sign === 1 && rzpCfgQ.data?.enabled && (
                <Button type="button" variant="outline" onClick={payRazorpay} disabled={rzpBusy} className="gap-2">
                  <CreditCard className="h-4 w-4" /> {rzpBusy ? "Opening…" : "Pay with Razorpay"}
                </Button>
              )}
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {statementFor && stmtTxQ.data && (
        <PrintableStatement
          cafeName={cafe?.name ?? "Café"}
          customerName={statementFor.name}
          customerPhone={statementFor.phone}
          balance={statementFor.balance}
          transactions={(stmtTxQ.data as unknown as StatementTx[]) ?? []}
          onClose={() => setStatementFor(null)}
        />
      )}
    </div>
  );
}
