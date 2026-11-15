import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Wallet,
  Plus,
  Minus,
  Receipt,
  Download,
  FileText,
  CreditCard,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Users,
  Copy,
  IndianRupee,
} from "lucide-react";
import { getCafeBySlug } from "@/lib/cafes.functions";
import { listCustomers } from "@/lib/customers.functions";
import {
  adjustWallet,
  listWalletTransactions,
  exportWalletCSV,
  listWalletTopupRequests,
  reviewWalletTopupRequest,
} from "@/lib/wallet.functions";
import { createTopupOrder, verifyTopupPayment, getRazorpayConfig } from "@/lib/razorpay.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/EmptyState";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { PrintableStatement, type StatementTx } from "@/components/PrintableStatement";
import { cn } from "@/lib/utils";

type RzpOpts = {
  key: string;
  amount: number;
  currency: string;
  order_id: string;
  name: string;
  description: string;
  handler: (r: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => void;
  prefill?: { name?: string; email?: string; contact?: string };
  modal?: { ondismiss?: () => void };
  theme?: { color?: string };
};
declare global {
  interface Window {
    Razorpay?: new (o: RzpOpts) => { open: () => void };
  }
}

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
      { name: "description", content: "Customer wallets, verified UPI top-ups and refunds." },
      { property: "og:title", content: "Wallet — CoreCade" },
      { property: "og:description", content: "Customer wallets, verified UPI top-ups and refunds." },
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
  const lReqs = useServerFn(listWalletTopupRequests);
  const reviewReqFn = useServerFn(reviewWalletTopupRequest);
  const adj = useServerFn(adjustWallet);
  const csvFn = useServerFn(exportWalletCSV);

  const customersQ = useQuery({
    queryKey: ["customers", cafeId],
    queryFn: () => lCus({ data: { cafe_id: cafeId! } }),
    enabled: !!cafeId,
  });
  const txQ = useQuery({
    queryKey: ["wallet-tx", cafeId],
    queryFn: () => lTx({ data: { cafe_id: cafeId! } }),
    enabled: !!cafeId,
    refetchInterval: 20_000,
  });
  const reqsQ = useQuery({
    queryKey: ["wallet-topup-reqs", cafeId],
    queryFn: () => lReqs({ data: { cafe_id: cafeId! } }),
    enabled: !!cafeId,
    refetchInterval: 15_000,
  });

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

  const reviewM = useMutation({
    mutationFn: reviewReqFn,
    onSuccess: (res) => {
      toast.success(res.status === "paid" ? "UPI payment verified & wallet credited" : "Top-up request rejected");
      qc.invalidateQueries({ queryKey: ["wallet-topup-reqs", cafeId] });
      qc.invalidateQueries({ queryKey: ["customers", cafeId] });
      qc.invalidateQueries({ queryKey: ["wallet-tx", cafeId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Review failed"),
  });

  const [query, setQuery] = useState("");
  const [sel, setSel] = useState<null | { id: string; name: string; balance: number; sign: 1 | -1 }>(null);
  const [statementFor, setStatementFor] = useState<null | { id: string; name: string; phone: string | null; balance: number }>(null);
  const [rzpBusy, setRzpBusy] = useState(false);

  const rzpCfgFn = useServerFn(getRazorpayConfig);
  const rzpCfgQ = useQuery({ queryKey: ["rzp-cfg"], queryFn: () => rzpCfgFn() });
  const createOrderFn = useServerFn(createTopupOrder);
  const verifyFn = useServerFn(verifyTopupPayment);

  useEffect(() => {
    void loadRazorpayScript();
  }, []);

  const customers = useMemo(() => customersQ.data ?? [], [customersQ.data]);
  const filteredCustomers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        (c.full_name ?? "").toLowerCase().includes(q) ||
        (c.phone ?? "").toLowerCase().includes(q),
    );
  }, [customers, query]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const topupRequests = useMemo(() => (reqsQ.data ?? []) as any[], [reqsQ.data]);
  const pendingRequests = useMemo(
    () => topupRequests.filter((r) => r.status === "created"),
    [topupRequests],
  );

  const totalLiability = useMemo(
    () => customers.reduce((s, c) => s + Number(c.wallet_balance ?? 0), 0),
    [customers],
  );
  const fundedCount = useMemo(
    () => customers.filter((c) => Number(c.wallet_balance ?? 0) > 0).length,
    [customers],
  );
  const pendingValue = useMemo(
    () => pendingRequests.reduce((s, r) => s + Number(r.amount ?? 0), 0),
    [pendingRequests],
  );

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
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Verify failed");
          }
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
      a.href = url;
      a.download = `wallet-statement-${cafeId}-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${r.count} rows`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <div className="space-y-6">
      {/* KPI Overview */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="liquid-glass-card rounded-2xl border border-white/10 p-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Customer wallet pool</span>
            <IndianRupee className="h-4 w-4 text-primary" />
          </div>
          <div className="mt-2 font-display text-2xl font-extrabold tabular-nums">
            ₹{totalLiability.toLocaleString("en-IN")}
          </div>
        </div>
        <div className="liquid-glass-card rounded-2xl border border-white/10 p-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Pending UPI checks</span>
            <Clock className={cn("h-4 w-4", pendingRequests.length > 0 ? "text-amber-400" : "text-muted-foreground")} />
          </div>
          <div className="mt-2 flex items-baseline gap-2 font-display text-2xl font-extrabold tabular-nums">
            <span>{pendingRequests.length}</span>
            {pendingValue > 0 && (
              <span className="font-mono text-xs font-semibold text-amber-300">
                · ₹{pendingValue.toLocaleString("en-IN")}
              </span>
            )}
          </div>
        </div>
        <div className="liquid-glass-card rounded-2xl border border-white/10 p-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Funded player wallets</span>
            <Users className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-2 font-display text-2xl font-extrabold tabular-nums">
            {fundedCount} <span className="text-sm font-normal text-muted-foreground">/ {customers.length}</span>
          </div>
        </div>
      </div>

      {/* Pending UPI Verification Queue */}
      {pendingRequests.length > 0 && (
        <section className="rounded-2xl border border-amber-500/35 bg-amber-500/[0.06] p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-amber-300">Action Required</div>
              <h2 className="mt-0.5 font-display text-lg font-bold">Pending UPI Top-Up Proofs</h2>
            </div>
            <Badge variant="outline" className="border-amber-400/40 bg-amber-400/15 font-mono text-xs text-amber-200 tabular-nums">
              {pendingRequests.length} awaiting check
            </Badge>
          </div>

          <div className="mt-4 space-y-2.5">
            {pendingRequests.map((req) => {
              const utr = String(req.notes?.utr_number ?? String(req.razorpay_payment_id ?? "").replace(/^UTR:/, ""));
              return (
                <div
                  key={req.id}
                  className="flex flex-col gap-3 rounded-xl border border-white/10 bg-card/70 p-3.5 backdrop-blur sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-foreground">{req.customers?.full_name ?? "Customer"}</span>
                      <span className="text-muted-foreground">·</span>
                      <span className="font-mono text-sm font-bold text-primary tabular-nums">₹{req.amount}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(utr);
                          toast.success("UTR copied");
                        }}
                        className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 font-mono text-[11px] text-foreground hover:border-primary/40"
                      >
                        UTR: {utr} <Copy className="h-3 w-3 text-primary" />
                      </button>
                      <span>{req.customers?.phone ?? "—"}</span>
                      <span aria-hidden>·</span>
                      <span className="font-mono text-[11px]">
                        {new Date(req.created_at).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      disabled={reviewM.isPending}
                      className="min-h-[40px] flex-1 sm:flex-initial gap-1.5"
                      onClick={() => reviewM.mutate({ data: { id: req.id, cafe_id: cafeId, action: "approve" } })}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> Approve &amp; Credit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={reviewM.isPending}
                      className="min-h-[40px] flex-1 sm:flex-initial gap-1.5 border-rose-500/30 text-rose-300 hover:bg-rose-500/10"
                      onClick={() => reviewM.mutate({ data: { id: req.id, cafe_id: cafeId, action: "reject" } })}
                    >
                      <XCircle className="h-3.5 w-3.5" /> Reject
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative min-w-0 w-full sm:min-w-[210px] sm:flex-1 sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search player or phone…"
                className="h-10 pl-9"
              />
            </div>
            <Button size="sm" variant="outline" className="min-h-[40px] gap-2 rounded-xl" onClick={downloadCSV}>
              <Download className="h-4 w-4" /> Export CSV
            </Button>
          </div>

          <div className="mt-3 space-y-2.5">
            {filteredCustomers.length === 0 ? (
              <EmptyState
                icon={Wallet}
                title={customers.length === 0 ? "No customers" : "No matching customers"}
                description={customers.length === 0 ? "Add customers first to manage their wallets." : "Try a different name or phone number."}
              />
            ) : (
              filteredCustomers.map((c) => (
                <div
                  key={c.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-card/45 p-4 backdrop-blur transition hover:border-white/20"
                >
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-foreground">{c.full_name}</div>
                    <div className="font-mono text-xs text-muted-foreground">{c.phone ?? "—"}</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <div className="mr-1 text-right">
                      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Balance</div>
                      <div className="font-display text-xl font-bold tabular-nums text-gradient">₹{c.wallet_balance}</div>
                    </div>
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-11 w-11 rounded-xl"
                      onClick={() => setSel({ id: c.id, name: c.full_name, balance: c.wallet_balance, sign: 1 })}
                      title="Add funds"
                      aria-label={`Add funds for ${c.full_name}`}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-11 w-11 rounded-xl"
                      onClick={() => setSel({ id: c.id, name: c.full_name, balance: c.wallet_balance, sign: -1 })}
                      title="Deduct funds"
                      aria-label={`Deduct funds for ${c.full_name}`}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-11 w-11 rounded-xl"
                      onClick={() => setStatementFor({ id: c.id, name: c.full_name, phone: c.phone, balance: c.wallet_balance })}
                      title="Print statement"
                      aria-label={`Print statement for ${c.full_name}`}
                    >
                      <FileText className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <aside className="min-w-0">
          <div className="rounded-2xl border border-white/10 bg-card/45 p-4 backdrop-blur">
            <div className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-azure" />
              <div className="text-sm font-semibold">Recent wallet activity</div>
            </div>
            <div className="mt-3 max-h-[520px] space-y-2 overflow-y-auto pr-0.5">
              {(txQ.data ?? []).length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/40 p-6 text-center text-xs text-muted-foreground">
                  No transactions yet
                </div>
              ) : (
                (txQ.data ?? []).map((t) => {
                  const positive = t.amount > 0;
                  return (
                    <div key={t.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-semibold">{(t.customers as { full_name?: string } | null)?.full_name ?? "—"}</span>
                        <span className={`shrink-0 font-mono font-bold tabular-nums ${positive ? "text-emerald-400" : "text-rose-400"}`}>
                          {positive ? "+" : ""}₹{t.amount}
                        </span>
                      </div>
                      <div className="mt-1.5 flex items-center justify-between text-muted-foreground">
                        <span className="font-mono text-[10px] uppercase tracking-wider">{t.kind}</span>
                        <span className="font-mono text-[11px] tabular-nums">
                          {new Date(t.created_at).toLocaleString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      {t.note && <div className="mt-1 break-words text-[11px] text-muted-foreground">{t.note}</div>}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </aside>
      </div>

      <Dialog open={!!sel} onOpenChange={(v) => !v && setSel(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {sel?.sign === 1 ? "Top up" : "Deduct from"} {sel?.name}&apos;s wallet
            </DialogTitle>
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
              Current balance: <span className="font-mono font-semibold text-foreground tabular-nums">₹{sel?.balance}</span>
            </div>
            <div className="space-y-1">
              <Label>Amount (₹)</Label>
              <Input name="amount" type="number" min={1} required autoFocus className="h-11 font-mono" />
            </div>
            <div className="space-y-1">
              <Label>Note (optional)</Label>
              <Input name="note" placeholder="Cash, UPI verified, refund…" className="h-11" />
            </div>
            <DialogFooter className="flex-col gap-2 sm:flex-row">
              <Button type="submit" disabled={m.isPending} className="min-h-[42px]" style={{ background: "var(--gradient-brand-hot)" }}>
                {m.isPending ? "Saving…" : sel?.sign === 1 ? "Add (counter)" : "Deduct"}
              </Button>
              {sel?.sign === 1 && rzpCfgQ.data?.enabled && (
                <Button type="button" variant="outline" onClick={payRazorpay} disabled={rzpBusy} className="min-h-[42px] gap-2">
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
