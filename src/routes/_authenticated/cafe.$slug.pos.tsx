import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ShoppingCart, Trash2, Receipt, Plus, Minus, Leaf, Beef, Printer, RotateCcw, FileBarChart } from "lucide-react";
import { getCafeBySlug } from "@/lib/cafes.functions";
import { listMenu } from "@/lib/menu.functions";
import { createOrder, settleOrder, listRecentOrders, voidOrder, refundOrder, dailyZReport, getOrderForReceipt } from "@/lib/pos.functions";
import { listSessions } from "@/lib/sessions.functions";
import { listCustomers } from "@/lib/customers.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/EmptyState";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { PrintableReceipt, type ReceiptOrder } from "@/components/PrintableReceipt";

export const Route = createFileRoute("/_authenticated/cafe/$slug/pos")({
  head: () => ({
    meta: [
      { title: "POS — CoreCade" },
      { name: "description", content: "Ring up sessions, snacks and merch at the counter." },
      { property: "og:title", content: "POS — CoreCade" },
      { property: "og:description", content: "Ring up sessions, snacks and merch at the counter." },
    ],
  }),
  component: POSPage,
});

type CartLine = { item_id: string; name: string; unit_price: number; qty: number };
type Item = { id: string; name: string; price: number; stock: number | null; is_active: boolean; is_veg: boolean; category_id: string | null };

function POSPage() {
  const { slug } = Route.useParams();
  const getCafe = useServerFn(getCafeBySlug);
  const { data: cafe } = useQuery({ queryKey: ["cafe", slug], queryFn: () => getCafe({ data: { slug } }) });
  const cafeId = cafe?.id;
  const defaultGst = ((cafe as { default_gst_rate?: number } | undefined)?.default_gst_rate) ?? 0;

  const list = useServerFn(listMenu);
  const lSes = useServerFn(listSessions);
  const lCus = useServerFn(listCustomers);
  const lOrd = useServerFn(listRecentOrders);
  const create = useServerFn(createOrder);
  const settle = useServerFn(settleOrder);
  const cancel = useServerFn(voidOrder);
  const refund = useServerFn(refundOrder);
  const z = useServerFn(dailyZReport);
  const getOrder = useServerFn(getOrderForReceipt);

  const menuQ = useQuery({ queryKey: ["menu", cafeId], queryFn: () => list({ data: { cafe_id: cafeId! } }), enabled: !!cafeId });
  const sesQ = useQuery({ queryKey: ["sessions", cafeId], queryFn: () => lSes({ data: { cafe_id: cafeId! } }), enabled: !!cafeId, refetchInterval: 10_000 });
  const cusQ = useQuery({ queryKey: ["customers", cafeId], queryFn: () => lCus({ data: { cafe_id: cafeId! } }), enabled: !!cafeId });
  const ordersQ = useQuery({ queryKey: ["orders", cafeId], queryFn: () => lOrd({ data: { cafe_id: cafeId! } }), enabled: !!cafeId, refetchInterval: 15_000 });

  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ["orders", cafeId] });

  const [cart, setCart] = useState<CartLine[]>([]);
  const [category, setCategory] = useState<string | "all">("all");
  const [sessionId, setSessionId] = useState<string>("");
  const [customerId, setCustomerId] = useState<string>("");
  const [discount, setDiscount] = useState(0);
  const [gstRate, setGstRate] = useState<number>(Number(defaultGst));
  const [settleOpen, setSettleOpen] = useState(false);
  const [pendingOrder, setPendingOrder] = useState<{ id: string; total: number } | null>(null);
  const [receiptOrder, setReceiptOrder] = useState<ReceiptOrder | null>(null);
  const [refundFor, setRefundFor] = useState<{ id: string; max: number } | null>(null);
  const [zOpen, setZOpen] = useState(false);

  const cats = menuQ.data?.categories ?? [];
  const items: Item[] = useMemo(() => {
    const all = (menuQ.data?.items ?? []) as Item[];
    return all.filter((i) => i.is_active && (category === "all" || i.category_id === category));
  }, [menuQ.data, category]);

  const subtotal = cart.reduce((s, c) => s + c.unit_price * c.qty, 0);
  const discountClamped = Math.min(discount, subtotal);
  const taxable = subtotal - discountClamped;
  const tax = Math.round((taxable * gstRate) / 100);
  const total = taxable + tax;
  const activeSessions = (sesQ.data ?? []).filter((s: { status: string }) => s.status === "active");

  function add(it: Item) {
    setCart((prev) => {
      const ex = prev.find((p) => p.item_id === it.id);
      if (ex) return prev.map((p) => (p.item_id === it.id ? { ...p, qty: p.qty + 1 } : p));
      return [...prev, { item_id: it.id, name: it.name, unit_price: it.price, qty: 1 }];
    });
  }
  function bump(id: string, delta: number) {
    setCart((prev) => prev.map((p) => (p.item_id === id ? { ...p, qty: p.qty + delta } : p)).filter((p) => p.qty > 0));
  }

  const placeOrder = useMutation({
    mutationFn: create,
    onSuccess: (order) => {
      setPendingOrder({ id: order.id, total: order.total_amount || order.subtotal });
      setCart([]); setSessionId(""); setCustomerId(""); setDiscount(0);
      setSettleOpen(true);
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const finish = useMutation({
    mutationFn: settle,
    onSuccess: async (_, vars) => {
      toast.success("Settled");
      setSettleOpen(false);
      // Auto-fetch + print receipt
      if (pendingOrder) {
        try {
          const full = (await getOrder({ data: { id: vars.data.order_id } })) as unknown as ReceiptOrder;
          setReceiptOrder(full);
        } catch { /* ignore */ }
      }
      setPendingOrder(null);
      refresh();
      qc.invalidateQueries({ queryKey: ["customers", cafeId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const voidIt = useMutation({ mutationFn: cancel, onSuccess: () => { toast.success("Voided"); refresh(); } });
  const refundM = useMutation({
    mutationFn: refund,
    onSuccess: () => { toast.success("Refunded"); setRefundFor(null); refresh(); qc.invalidateQueries({ queryKey: ["customers", cafeId] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  async function printOrder(id: string) {
    try {
      const full = (await getOrder({ data: { id } })) as unknown as ReceiptOrder;
      setReceiptOrder(full);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  }

  if (!cafeId) return <div className="h-40 animate-pulse rounded-2xl border border-border/40 bg-card/30" />;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-2">
            <Chip active={category === "all"} onClick={() => setCategory("all")}>All</Chip>
            {cats.map((c: { id: string; name: string }) => (
              <Chip key={c.id} active={category === c.id} onClick={() => setCategory(c.id)}>{c.name}</Chip>
            ))}
          </div>
          <div className="ml-auto">
            <Button size="sm" variant="outline" className="gap-2" onClick={() => setZOpen(true)}>
              <FileBarChart className="h-4 w-4" /> Z-Report
            </Button>
          </div>
        </div>
        {items.length === 0 ? (
          <div className="mt-6">
            <EmptyState icon={Receipt} title={menuQ.isLoading ? "Loading menu…" : "No items yet"} description="Add categories and items in the Menu tab to start selling at POS." action={
              <Link to="/cafe/$slug/menu" params={{ slug }}>
                <Button style={{ background: "var(--gradient-brand-hot)" }} className="gap-2"><Plus className="h-4 w-4" /> Go to Menu</Button>
              </Link>
            } />
          </div>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {items.map((it) => {
              const out = it.stock !== null && it.stock <= 0;
              return (
                <button key={it.id} disabled={out} onClick={() => add(it)} className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card/40 p-4 text-left backdrop-blur transition hover:border-primary/40 hover:bg-card/60 disabled:opacity-50">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {it.is_veg ? <Leaf className="h-3.5 w-3.5 text-emerald-400" /> : <Beef className="h-3.5 w-3.5 text-rose-400" />}
                    {it.stock !== null && <span>{it.stock} left</span>}
                  </div>
                  <div className="mt-1 font-semibold">{it.name}</div>
                  <div className="mt-2 font-display text-xl font-extrabold text-gradient">₹{it.price}</div>
                  {out && <Badge className="absolute right-2 top-2" variant="secondary">Out</Badge>}
                </button>
              );
            })}
          </div>
        )}

        <div className="mt-8">
          <div className="mb-2 text-sm font-semibold">Recent orders</div>
          <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/40">
            {(ordersQ.data ?? []).length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">No orders yet</div>
            ) : (ordersQ.data ?? []).map((o: {
              id: string; status: string; subtotal: number; total_amount: number; refund_amount: number;
              receipt_no: string | null; payment_method: string | null; created_at: string;
              order_items: { name: string; qty: number }[]
            }) => {
              const tot = o.total_amount || o.subtotal;
              const refundable = (o.status === "paid" || o.status === "refunded") && tot - (o.refund_amount || 0) > 0;
              return (
                <div key={o.id} className="flex items-center justify-between border-b border-border/40 px-4 py-3 last:border-0">
                  <div className="min-w-0">
                    <div className="truncate text-sm">{o.order_items.map((i) => `${i.qty}× ${i.name}`).join(", ")}</div>
                    <div className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      {o.receipt_no ?? o.id.slice(0, 6)} · {new Date(o.created_at).toLocaleTimeString()} · {o.payment_method ?? "—"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="font-display font-bold">₹{tot}</div>
                    <Badge variant={o.status === "paid" ? "default" : o.status === "void" ? "secondary" : o.status === "refunded" ? "destructive" : "outline"}>{o.status}</Badge>
                    {(o.status === "paid" || o.status === "refunded") && (
                      <Button size="icon" variant="ghost" title="Print receipt" onClick={() => printOrder(o.id)}>
                        <Printer className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {refundable && (
                      <Button size="icon" variant="ghost" title="Refund" onClick={() => setRefundFor({ id: o.id, max: tot - (o.refund_amount || 0) })}>
                        <RotateCcw className="h-3.5 w-3.5 text-amber-400" />
                      </Button>
                    )}
                    {o.status === "open" && (
                      <Button size="sm" variant="ghost" onClick={() => voidIt.mutate({ data: { id: o.id } })}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <aside className="sticky top-24 h-fit rounded-2xl border border-border/60 bg-card/60 p-4 backdrop-blur-xl">
        <div className="flex items-center gap-2 font-display text-lg font-bold">
          <ShoppingCart className="h-5 w-5 text-primary" /> Cart
        </div>
        <div className="mt-3 max-h-60 space-y-2 overflow-y-auto">
          {cart.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/60 p-6 text-center text-xs text-muted-foreground">Tap items to add</div>
          ) : cart.map((c) => (
            <div key={c.item_id} className="flex items-center gap-2 rounded-lg border border-border/40 bg-background/40 p-2">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{c.name}</div>
                <div className="font-mono text-[10px] text-muted-foreground">₹{c.unit_price} ea</div>
              </div>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => bump(c.item_id, -1)}><Minus className="h-3.5 w-3.5" /></Button>
              <span className="w-6 text-center text-sm">{c.qty}</span>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => bump(c.item_id, 1)}><Plus className="h-3.5 w-3.5" /></Button>
            </div>
          ))}
        </div>

        <div className="mt-3 space-y-2">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Attach session (optional)</label>
            <select value={sessionId} onChange={(e) => setSessionId(e.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="">None</option>
              {activeSessions.map((s) => {
                const dev = Array.isArray(s.devices) ? s.devices[0] : s.devices;
                const cus = Array.isArray(s.customers) ? s.customers[0] : s.customers;
                return <option key={s.id} value={s.id}>{dev?.name ?? "—"} · {cus?.full_name ?? "Walk-in"}</option>;
              })}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Customer (optional)</label>
            <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="">Walk-in</option>
              {(cusQ.data ?? []).map((c: { id: string; full_name: string }) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Discount ₹</label>
              <Input type="number" min={0} value={discount} onChange={(e) => setDiscount(Math.max(0, Number(e.target.value) || 0))} className="h-9" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">GST %</label>
              <Input type="number" min={0} max={50} step={0.5} value={gstRate} onChange={(e) => setGstRate(Math.max(0, Number(e.target.value) || 0))} className="h-9" />
            </div>
          </div>
        </div>

        <div className="mt-4 space-y-1 rounded-xl border border-border/40 bg-background/30 p-3 text-xs">
          <Row k="Subtotal" v={`₹${subtotal}`} />
          {discountClamped > 0 && <Row k="Discount" v={`-₹${discountClamped}`} muted />}
          {tax > 0 && <Row k={`GST (${gstRate}%)`} v={`₹${tax}`} muted />}
          <div className="mt-1 flex items-center justify-between border-t border-border/40 pt-2">
            <span className="text-xs text-muted-foreground">Total</span>
            <span className="font-display text-2xl font-extrabold text-gradient">₹{total}</span>
          </div>
        </div>
        <Button disabled={cart.length === 0 || placeOrder.isPending} className="mt-3 w-full" style={{ background: "var(--gradient-brand-hot)" }}
          onClick={() => placeOrder.mutate({ data: {
            cafe_id: cafeId, customer_id: customerId || null, session_id: sessionId || null,
            items: cart, discount_amount: discountClamped, gst_rate: gstRate,
          } })}
        >
          Place order
        </Button>
      </aside>

      <Dialog open={settleOpen} onOpenChange={setSettleOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Settle ₹{pendingOrder?.total}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-3 gap-2">
            {(["cash", "wallet", "tab"] as const).map((m) => (
              <Button key={m} variant="outline" onClick={() => pendingOrder && finish.mutate({ data: { order_id: pendingOrder.id, payment_method: m } })} className="h-16 capitalize">
                {m === "tab" ? "Add to tab" : m}
              </Button>
            ))}
          </div>
          <DialogFooter><Button variant="ghost" onClick={() => setSettleOpen(false)}>Later</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!refundFor} onOpenChange={(v) => !v && setRefundFor(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Refund order</DialogTitle></DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            if (!refundFor) return;
            const fd = new FormData(e.currentTarget);
            const amount = Number(fd.get("amount")) || 0;
            const reason = String(fd.get("reason") || "").trim();
            if (amount <= 0 || amount > refundFor.max) return toast.error(`Amount 1-${refundFor.max}`);
            if (!reason) return toast.error("Reason required");
            refundM.mutate({ data: { order_id: refundFor.id, amount, reason } });
          }} className="space-y-3">
            <div className="rounded-md border border-border/40 p-2 text-xs text-muted-foreground">Refundable: <b className="text-foreground">₹{refundFor?.max}</b>{" "}— wallet-paid orders auto-credit back.</div>
            <div className="space-y-1"><Label>Amount</Label><Input name="amount" type="number" min={1} max={refundFor?.max} defaultValue={refundFor?.max} required /></div>
            <div className="space-y-1"><Label>Reason</Label><Input name="reason" placeholder="Customer complaint, wrong order…" required /></div>
            <DialogFooter><Button type="submit" disabled={refundM.isPending} variant="destructive">{refundM.isPending ? "…" : "Refund"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ZReportDialog open={zOpen} onClose={() => setZOpen(false)} cafeId={cafeId} z={z} cafeName={cafe?.name ?? ""} />

      {receiptOrder && <PrintableReceipt order={receiptOrder} onClose={() => setReceiptOrder(null)} />}
    </div>
  );
}

function Row({ k, v, muted }: { k: string; v: string; muted?: boolean }) {
  return <div className={`flex items-center justify-between ${muted ? "text-muted-foreground" : ""}`}><span>{k}</span><span className="font-mono">{v}</span></div>;
}

function ZReportDialog({ open, onClose, cafeId, z, cafeName }: { open: boolean; onClose: () => void; cafeId: string; z: ReturnType<typeof useServerFn<typeof dailyZReport>>; cafeName: string }) {
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const q = useQuery({
    queryKey: ["z-report", cafeId, date],
    queryFn: () => z({ data: { cafe_id: cafeId, date } }),
    enabled: open,
  });
  const r = q.data;
  function printZ() { window.print(); }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Daily Z-Report</DialogTitle></DialogHeader>
        <div className="flex items-center gap-2">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9 w-auto" />
          <Button size="sm" variant="outline" onClick={printZ} className="gap-2"><Printer className="h-4 w-4" /> Print</Button>
        </div>
        <div id="z-print" className="space-y-3 rounded-xl border border-border/60 bg-background/30 p-4 font-mono text-xs print:bg-white print:text-black">
          <div className="text-center">
            <div className="text-sm font-bold uppercase">{cafeName} — Z-Report</div>
            <div className="opacity-70">{new Date(date).toLocaleDateString("en-IN", { dateStyle: "full" })}</div>
          </div>
          <div className="border-t border-dashed border-border/60 pt-2">
            <ZRow k="Orders (placed)" v={r?.orderCount ?? 0} />
            <ZRow k="Paid" v={r?.paidCount ?? 0} />
            <ZRow k="Voided" v={r?.voidCount ?? 0} />
          </div>
          <div className="border-t border-dashed border-border/60 pt-2">
            <ZRow k="Gross subtotal" v={`₹${r?.gross ?? 0}`} />
            <ZRow k="Discount" v={`-₹${r?.discount ?? 0}`} />
            <ZRow k="Tax (GST)" v={`₹${r?.tax ?? 0}`} />
            <ZRow k="Refunds" v={`-₹${r?.refund ?? 0}`} />
            <div className="mt-1 border-t border-border/60 pt-1 font-bold">
              <ZRow k="NET ORDERS" v={`₹${r?.net ?? 0}`} />
            </div>
            <ZRow k="Sessions" v={`${r?.sessionCount ?? 0} · ₹${r?.sessionRevenue ?? 0}`} />
            <div className="mt-1 border-t border-border/60 pt-1 text-sm font-extrabold">
              <ZRow k="GRAND TOTAL" v={`₹${(r?.net ?? 0) + (r?.sessionRevenue ?? 0)}`} />
            </div>
          </div>
          <div className="border-t border-dashed border-border/60 pt-2">
            <div className="mb-1 opacity-70">By payment method</div>
            {Object.entries(r?.byMethod ?? {}).length === 0
              ? <div className="opacity-60">No paid orders.</div>
              : Object.entries(r?.byMethod ?? {}).map(([m, x]) => (
                <ZRow key={m} k={m.toUpperCase()} v={`${x.count} · ₹${x.total}`} />
              ))}
          </div>
        </div>
        <style>{`
          @media print {
            body * { visibility: hidden !important; }
            #z-print, #z-print * { visibility: visible !important; }
            #z-print { position: absolute; left: 0; top: 0; width: 100%; }
          }
        `}</style>
      </DialogContent>
    </Dialog>
  );
}

function ZRow({ k, v }: { k: string; v: string | number }) {
  return <div className="flex justify-between"><span>{k}</span><span>{v}</span></div>;
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`rounded-full border px-3 py-1 text-xs font-medium transition ${active ? "border-primary/60 bg-primary/15 text-foreground" : "border-border/60 bg-card/40 text-muted-foreground hover:text-foreground"}`}>
      {children}
    </button>
  );
}
