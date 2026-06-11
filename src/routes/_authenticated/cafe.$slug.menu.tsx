import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Trash2, UtensilsCrossed, Leaf, Beef } from "lucide-react";
import { getCafeBySlug } from "@/lib/cafes.functions";
import { listMenu, upsertCategory, deleteCategory, upsertItem, deleteItem } from "@/lib/menu.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/EmptyState";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/cafe/$slug/menu")({
  component: MenuPage,
});

type MItem = {
  id: string; cafe_id: string; category_id: string | null;
  name: string; description: string | null; price: number;
  stock: number | null; is_veg: boolean; is_active: boolean; image_url: string | null;
};

function MenuPage() {
  const { slug } = Route.useParams();
  const getCafe = useServerFn(getCafeBySlug);
  const { data: cafe } = useQuery({ queryKey: ["cafe", slug], queryFn: () => getCafe({ data: { slug } }) });
  const cafeId = cafe?.id;

  const list = useServerFn(listMenu);
  const upCat = useServerFn(upsertCategory);
  const delCat = useServerFn(deleteCategory);
  const upItem = useServerFn(upsertItem);
  const delItem = useServerFn(deleteItem);

  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["menu", cafeId],
    queryFn: () => list({ data: { cafe_id: cafeId! } }),
    enabled: !!cafeId,
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["menu", cafeId] });

  const saveItem = useMutation({
    mutationFn: upItem,
    onSuccess: () => { toast.success("Saved"); refresh(); setEdit(null); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const rmItem = useMutation({ mutationFn: delItem, onSuccess: () => { toast.success("Deleted"); refresh(); } });
  const saveCat = useMutation({
    mutationFn: upCat,
    onSuccess: () => { toast.success("Saved"); refresh(); setCatOpen(false); },
  });
  const rmCat = useMutation({ mutationFn: delCat, onSuccess: () => { toast.success("Deleted"); refresh(); } });

  const [edit, setEdit] = useState<Partial<MItem> | null>(null);
  const [catOpen, setCatOpen] = useState(false);

  if (!cafeId) return <div className="h-40 animate-pulse rounded-2xl border border-border/40 bg-card/30" />;

  const cats = q.data?.categories ?? [];
  const items = (q.data?.items ?? []) as MItem[];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-muted-foreground">{items.length} items · {cats.length} categories</div>
        <div className="flex gap-2">
          <Dialog open={catOpen} onOpenChange={setCatOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2"><Plus className="h-4 w-4" /> Category</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New category</DialogTitle></DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  saveCat.mutate({ data: { cafe_id: cafeId, name: String(fd.get("name")), sort_order: Number(fd.get("sort")) || 0 } });
                }}
                className="space-y-3"
              >
                <div className="space-y-1"><Label>Name</Label><Input name="name" required placeholder="Snacks" /></div>
                <div className="space-y-1"><Label>Sort order</Label><Input name="sort" type="number" defaultValue={0} /></div>
                <DialogFooter><Button type="submit">Save</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          <Button className="gap-2" style={{ background: "var(--gradient-brand-hot)" }} onClick={() => setEdit({ cafe_id: cafeId, is_veg: true, is_active: true, price: 0 })}>
            <Plus className="h-4 w-4" /> New item
          </Button>
        </div>
      </div>

      {cats.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {cats.map((c: { id: string; name: string }) => (
            <span key={c.id} className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/40 px-3 py-1 text-xs">
              {c.name}
              <button onClick={() => { if (confirm("Delete category?")) rmCat.mutate({ data: { id: c.id } }); }} className="text-muted-foreground hover:text-destructive">×</button>
            </span>
          ))}
        </div>
      )}

      {items.length === 0 ? (
        <EmptyState icon={UtensilsCrossed} title="No menu items" description="Add snacks, drinks, combos. They'll show in POS and on your public page." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((it) => (
            <div key={it.id} className="group rounded-2xl border border-border/60 bg-card/40 p-4 backdrop-blur">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    {it.is_veg ? <Leaf className="h-3.5 w-3.5 text-emerald-400" /> : <Beef className="h-3.5 w-3.5 text-rose-400" />}
                    <h3 className="truncate font-semibold">{it.name}</h3>
                  </div>
                  {it.description && <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{it.description}</div>}
                </div>
                {!it.is_active && <Badge variant="secondary">Hidden</Badge>}
              </div>
              <div className="mt-3 flex items-end justify-between">
                <div className="font-display text-2xl font-extrabold text-gradient">₹{it.price}</div>
                <div className="text-right text-xs text-muted-foreground">
                  {it.stock === null ? "Unlimited" : `${it.stock} in stock`}
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => setEdit(it)}>Edit</Button>
                <Button size="icon" variant="ghost" onClick={() => { if (confirm("Delete item?")) rmItem.mutate({ data: { id: it.id } }); }}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!edit} onOpenChange={(v) => !v && setEdit(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{edit?.id ? "Edit item" : "New item"}</DialogTitle></DialogHeader>
          {edit && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const payload = {
                  id: edit.id,
                  cafe_id: cafeId,
                  category_id: (fd.get("category_id") as string) || null,
                  name: String(fd.get("name")),
                  description: (fd.get("description") as string) || null,
                  price: Number(fd.get("price")),
                  stock: fd.get("stock") === "" ? null : Number(fd.get("stock")),
                  is_veg: fd.get("is_veg") === "on",
                  is_active: fd.get("is_active") === "on",
                  image_url: (fd.get("image_url") as string) || null,
                };
                saveItem.mutate({ data: payload });
              }}
              className="space-y-3"
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1 sm:col-span-2"><Label>Name</Label><Input name="name" defaultValue={edit.name ?? ""} required /></div>
                <div className="space-y-1"><Label>Price (₹)</Label><Input name="price" type="number" min={0} defaultValue={edit.price ?? 0} required /></div>
                <div className="space-y-1"><Label>Stock (blank = ∞)</Label><Input name="stock" type="number" min={0} defaultValue={edit.stock ?? ""} /></div>
                <div className="space-y-1 sm:col-span-2">
                  <Label>Category</Label>
                  <select name="category_id" defaultValue={edit.category_id ?? ""} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                    <option value="">— None —</option>
                    {cats.map((c: { id: string; name: string }) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1 sm:col-span-2"><Label>Description</Label><Textarea name="description" defaultValue={edit.description ?? ""} rows={2} /></div>
                <div className="space-y-1 sm:col-span-2"><Label>Image URL</Label><Input name="image_url" defaultValue={edit.image_url ?? ""} placeholder="https://…" /></div>
              </div>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 text-sm"><Switch name="is_veg" defaultChecked={edit.is_veg ?? true} /> Veg</label>
                <label className="flex items-center gap-2 text-sm"><Switch name="is_active" defaultChecked={edit.is_active ?? true} /> Active</label>
              </div>
              <DialogFooter><Button type="submit" style={{ background: "var(--gradient-brand-hot)" }}>{edit.id ? "Save" : "Create"}</Button></DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
