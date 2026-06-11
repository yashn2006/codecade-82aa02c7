import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Image as ImageIcon, Save, ExternalLink } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { getCafeBySlug } from "@/lib/cafes.functions";
import { getCafePage, updateCafePage } from "@/lib/cafe-page.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/cafe/$slug/page")({
  head: () => ({
    meta: [
      { title: "Public Page — CoreCade" },
      { name: "description", content: "Edit your café's public CoreCade landing page." },
      { property: "og:title", content: "Public Page — CoreCade" },
      { property: "og:description", content: "Edit your café's public CoreCade landing page." },
    ],
  }),
  component: PageEditor,
});

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

function PageEditor() {
  const { slug } = Route.useParams();
  const getCafe = useServerFn(getCafeBySlug);
  const { data: cafe } = useQuery({ queryKey: ["cafe", slug], queryFn: () => getCafe({ data: { slug } }) });
  const cafeId = cafe?.id;

  const getPage = useServerFn(getCafePage);
  const save = useServerFn(updateCafePage);
  const qc = useQueryClient();

  const pageQ = useQuery({ queryKey: ["cafe-page", cafeId], queryFn: () => getPage({ data: { cafe_id: cafeId! } }), enabled: !!cafeId });

  const [form, setForm] = useState({
    tagline: "", hero_url: "", about: "",
    hours: Object.fromEntries(DAYS.map((d) => [d, ""])) as Record<string, string>,
    socials: { instagram: "", youtube: "", discord: "" } as Record<string, string>,
    gallery: "" as string,
  });

  useEffect(() => {
    const p = pageQ.data;
    if (p) {
      setForm({
        tagline: p.tagline ?? "",
        hero_url: p.hero_url ?? "",
        about: p.about ?? "",
        hours: { ...Object.fromEntries(DAYS.map((d) => [d, ""])), ...(p.hours ?? {}) },
        socials: { instagram: "", youtube: "", discord: "", ...(p.socials ?? {}) },
        gallery: Array.isArray(p.gallery) ? p.gallery.join("\n") : "",
      });
    }
  }, [pageQ.data]);

  const mut = useMutation({
    mutationFn: save,
    onSuccess: () => { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["cafe-page", cafeId] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  if (!cafeId) return <div className="h-40 animate-pulse rounded-2xl border border-border/40 bg-card/30" />;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    mut.mutate({ data: {
      cafe_id: cafeId!,
      tagline: form.tagline || null,
      hero_url: form.hero_url || null,
      about: form.about || null,
      hours: form.hours,
      socials: Object.fromEntries(Object.entries(form.socials).filter(([, v]) => v)),
      gallery: form.gallery.split("\n").map((s) => s.trim()).filter(Boolean),
    } });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <form onSubmit={submit} className="space-y-5 rounded-2xl border border-border/60 bg-card/40 p-5 backdrop-blur">
        <div className="space-y-1"><Label>Tagline</Label><Input value={form.tagline} onChange={(e) => setForm({ ...form, tagline: e.target.value })} placeholder="The fastest rigs in town" /></div>
        <div className="space-y-1"><Label>Hero image URL</Label><Input value={form.hero_url} onChange={(e) => setForm({ ...form, hero_url: e.target.value })} placeholder="https://…" /></div>
        <div className="space-y-1"><Label>About</Label><Textarea rows={5} value={form.about} onChange={(e) => setForm({ ...form, about: e.target.value })} /></div>

        <div>
          <Label>Opening hours</Label>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {DAYS.map((d) => (
              <div key={d} className="flex items-center gap-2">
                <span className="w-10 text-xs uppercase text-muted-foreground">{d}</span>
                <Input value={form.hours[d]} onChange={(e) => setForm({ ...form, hours: { ...form.hours, [d]: e.target.value } })} placeholder="10am - 11pm" />
              </div>
            ))}
          </div>
        </div>

        <div>
          <Label>Socials</Label>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {(["instagram", "youtube", "discord"] as const).map((s) => (
              <Input key={s} value={form.socials[s]} onChange={(e) => setForm({ ...form, socials: { ...form.socials, [s]: e.target.value } })} placeholder={s} />
            ))}
          </div>
        </div>

        <div className="space-y-1"><Label>Gallery (one image URL per line)</Label><Textarea rows={4} value={form.gallery} onChange={(e) => setForm({ ...form, gallery: e.target.value })} placeholder="https://...&#10;https://..." /></div>

        <Button type="submit" className="gap-2" style={{ background: "var(--gradient-brand-hot)" }}>
          <Save className="h-4 w-4" /> Save page
        </Button>
      </form>

      <aside className="space-y-3">
        <div className="rounded-2xl border border-border/60 bg-card/40 p-5 backdrop-blur">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Your public URL</div>
          <div className="mt-2 break-all rounded-lg border border-border/40 bg-background/40 p-2 font-mono text-xs">/c/{slug}</div>
          <Link to="/c/$slug" params={{ slug }} target="_blank">
            <Button variant="outline" className="mt-3 w-full gap-2"><ExternalLink className="h-4 w-4" /> Open public page</Button>
          </Link>
        </div>
        {form.hero_url && (
          <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/40">
            <img src={form.hero_url} alt="Hero preview" className="aspect-[16/9] w-full object-cover" />
            <div className="p-3 text-xs text-muted-foreground"><ImageIcon className="mr-1 inline h-3 w-3" /> Hero preview</div>
          </div>
        )}
      </aside>
    </div>
  );
}
