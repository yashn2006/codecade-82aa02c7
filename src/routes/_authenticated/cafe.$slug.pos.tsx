import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ShoppingCart, Trash2, Receipt, Plus, Minus, Leaf, Beef } from "lucide-react";
import { getCafeBySlug } from "@/lib/cafes.functions";
import { listMenu } from "@/lib/menu.functions";
import { createOrder, settleOrder, listRecentOrders, voidOrder } from "@/lib/pos.functions";
import { listSessions } from "@/lib/sessions.functions";
import { listCustomers } from "@/lib/customers.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/EmptyState";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";

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

  const list = useServerFn(listMenu);
  const lSes = useServerFn(listSessions);
  const lCus = useServerFn(listCustomers);
  const lOrd = useServerFn(listRecentOrders);
  const create = useServerFn(createOrder);
  const settle = useServerFn(settleOrder);
  const cancel = useServerFn(voidOrder);

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
  const [settleOpen, setSettleOpen] = useState(false);
  const [pendingOrder, setPendingOrder] = useState<{ id: string; subtotal: number } | null>(null);

  const cats = menuQ.data?.categories ?? [];
  const items: Item[] = useMemo(() => {
    const all = (menuQ.data?.items ?? []) as Item[];
    return all.filter((i) => i.is_active && (category === "all" || i.category_id === category));
  }, [menuQ.data, category]);

  const subtotal = cart.reduce((s, c) => s + c.unit_price * c.qty, 0);
  const activeSessions = (sesQ.data ?? []).filter((s: { status: string }) => s.status === "active");

  function add(it: Item) {
    setCart((prev) => {
      const ex = prev.find((p) => p.item_id === it.id);
      if (ex) return prev.map((p) => (p.item_id === it.id ? { ...p, qty: p.qty + 1 } : p));
      return [...prev, { item_id: it.id, name: it.name, unit_price: it.price, qty: 1 }];
    });
  }
  function bump(id: string, delta: number) {
    setCart((prev) => prev
      .map((p) => (p.item_id === id ? { ...p, qty: p.qty + delta } : p))
      .filter((p) => p.qty > 0));
  }

  const placeOrder = useMutation({
    mutationFn: create,
    onSuccess: (order) => {
      setPendingOrder({ id: order.id, subtotal: order.subtotal });
      setCart([]); setSessionId(""); setCustomerId("");
      setSettleOpen(true);
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const finish = useMutation({
    mutationFn: settle,
    onSuccess: () => { toast.success("Settled"); setSettleOpen(false); setPendingOrder(null); refresh(); qc.invalidateQueries({ queryKey: ["customers", cafeId] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const voidIt = useMutation({ mutationFn: cancel, onSuccess: () => { toast.success("Voided"); refresh(); } });

  if (!cafeId) return <div className="h-40 animate-pulse rounded-2xl border border-border/40 bg-card/30" />;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      {/* Menu */}
      <div>
        <div className="flex flex-wrap gap-2">
          <Chip active={category === "all"} onClick={() => setCategory("all")}>All</Chip>
          {cats.map((c: { id: string; name: string }) => (
            <Chip key={c.id} active={category === c.id} onClick={() => setCategory(c.id)}>{c.name}</Chip>
          ))}
        </div>
        {items.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              icon={Receipt}
              title={menuQ.isLoading ? "Loading menu…" : "No items yet"}
              description="Add categories and items in the Menu tab to start selling at POS."
              action={
                <Link to="/cafe/$slug/menu" params={{ slug }}>
                  <Button style={{ background: "var(--gradient-brand-hot)" }} className="gap-2">
                    <Plus className="h-4 w-4" /> Go to Menu
                  </Button>
                </Link>
              }
            />
          </div>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {items.map((it) => {
              const out = it.stock !== null && it.stock <= 0;
              return (
                <button
                  key={it.id}
                  disabled={out}
                  onClick={() => add(it)}
                  className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card/40 p-4 text-left backdrop-blur transition hover:border-primary/40 hover:bg-card/60 disabled:opacity-50"
                >
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

        {/* Recent orders */}
        <div className="mt-8">
          <div className="mb-2 text-sm font-semibold">Recent orders</div>
          <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/40">
            {(ordersQ.data ?? []).length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">No orders yet</div>
            ) : (ordersQ.data ?? []).map((o: { id: string; status: string; subtotal: number; payment_method: string | null; created_at: string; order_items: { name: string; qty: number }[] }) => (
              <div key={o.id} className="flex items-center justify-between border-b border-border/40 px-4 py-3 last:border-0">
                <div className="min-w-0">
                  <div className="truncate text-sm">{o.order_items.map((i) => `${i.qty}× ${i.name}`).join(", ")}</div>
                  <div className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    {new Date(o.created_at).toLocaleTimeString()} · {o.payment_method ?? "—"}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="font-display font-bold">₹{o.subtotal}</div>
                  <Badge variant={o.status === "paid" ? "default" : o.status === "void" ? "secondary" : "outline"}>{o.status}</Badge>
                  {o.status === "open" && (
                    <Button size="sm" variant="ghost" onClick={() => voidIt.mutate({ data: { id: o.id } })}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Cart */}
      <aside className="sticky top-24 h-fit rounded-2xl border border-border/60 bg-card/60 p-4 backdrop-blur-xl">
        <div className="flex items-center gap-2 font-display text-lg font-bold">
          <ShoppingCart className="h-5 w-5 text-primary" /> Cart
        </div>
        <div className="mt-3 max-h-72 space-y-2 overflow-y-auto">
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
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div className="text-xs text-muted-foreground">Subtotal</div>
          <div className="font-display text-2xl font-extrabold text-gradient">₹{subtotal}</div>
        </div>
        <Button
          disabled={cart.length === 0 || placeOrder.isPending}
          className="mt-3 w-full"
          style={{ background: "var(--gradient-brand-hot)" }}
          onClick={() => placeOrder.mutate({ data: { cafe_id: cafeId, customer_id: customerId || null, session_id: sessionId || null, items: cart } })}
        >
          Place order
        </Button>
      </aside>

      <Dialog open={settleOpen} onOpenChange={setSettleOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Settle ₹{pendingOrder?.subtotal}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-3 gap-2">
            {(["cash", "wallet", "tab"] as const).map((m) => (
              <Button
                key={m}
                variant="outline"
                onClick={() => pendingOrder && finish.mutate({ data: { order_id: pendingOrder.id, payment_method: m } })}
                className="h-16 capitalize"
              >
                {m === "tab" ? "Add to tab" : m}
              </Button>
            ))}
          </div>
          <DialogFooter><Button variant="ghost" onClick={() => setSettleOpen(false)}>Later</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition ${active ? "border-primary/60 bg-primary/15 text-foreground" : "border-border/60 bg-card/40 text-muted-foreground hover:text-foreground"}`}
    >
      {children}
    </button>
  );
}
