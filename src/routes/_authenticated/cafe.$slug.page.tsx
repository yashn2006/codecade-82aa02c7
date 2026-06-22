import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Image as ImageIcon, Save, ExternalLink, Palette, MapPin, X, IndianRupee } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { getCafeBySlug } from "@/lib/cafes.functions";
import { getCafePage, updateCafePage } from "@/lib/cafe-page.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ImageUploader } from "@/components/ImageUploader";

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
const THEME_PRESETS = [
  { mode: "dark",    label: "Midnight",  accent: "#ec4899", bg: "#0a0a1a" },
  { mode: "neon",    label: "Neon Arcade", accent: "#00f0ff", bg: "#050014" },
  { mode: "minimal", label: "Minimal",    accent: "#171717", bg: "#fafafa" },
  { mode: "arcade",  label: "Retro CRT",  accent: "#ffd000", bg: "#1a0033" },
] as const;

type Theme = { mode?: string; accent?: string; bg?: string; font?: string; logo?: string };

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
    gallery: [] as string[],
    galleryInput: "",
    theme: { mode: "dark", accent: "#ec4899", bg: "#0a0a1a" } as Theme,
    map_url: "",
    upi_id: "",
    upi_qr_url: "",
  });

  useEffect(() => {
    const p = pageQ.data as (typeof pageQ.data & { upi_id?: string | null; upi_qr_url?: string | null }) | null | undefined;
    if (p) {
      setForm((cur) => ({
        ...cur,
        tagline: p.tagline ?? "",
        hero_url: p.hero_url ?? "",
        about: p.about ?? "",
        hours: { ...Object.fromEntries(DAYS.map((d) => [d, ""])), ...(p.hours ?? {}) },
        socials: { instagram: "", youtube: "", discord: "", ...(p.socials ?? {}) },
        gallery: Array.isArray(p.gallery) ? p.gallery : [],
        theme: { mode: "dark", accent: "#ec4899", bg: "#0a0a1a", ...(p.theme ?? {}) },
        map_url: p.map_url ?? "",
        upi_id: p.upi_id ?? "",
        upi_qr_url: p.upi_qr_url ?? "",
      }));
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
      gallery: form.gallery,
      theme: form.theme,
      map_url: form.map_url || null,
      upi_id: form.upi_id.trim() || null,
      upi_qr_url: form.upi_qr_url.trim() || null,
    } });
  }

  function addGallery() {
    const v = form.galleryInput.trim();
    if (!v) return;
    if (!/^https?:\/\//.test(v)) return toast.error("Must be a URL");
    setForm((c) => ({ ...c, gallery: [...c.gallery, v], galleryInput: "" }));
  }
  function removeGallery(i: number) {
    setForm((c) => ({ ...c, gallery: c.gallery.filter((_, idx) => idx !== i) }));
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <form onSubmit={submit} className="space-y-5 rounded-2xl border border-border/60 bg-card/40 p-5 backdrop-blur">
        <div className="space-y-1"><Label>Tagline</Label><Input value={form.tagline} onChange={(e) => setForm({ ...form, tagline: e.target.value })} placeholder="The fastest rigs in town" /></div>
        <div className="space-y-1">
          <Label>Hero image</Label>
          <div className="flex gap-2">
            <Input value={form.hero_url} onChange={(e) => setForm({ ...form, hero_url: e.target.value })} placeholder="Paste URL or upload…" />
            <ImageUploader cafeId={cafeId} folder="hero" label="Upload" onUploaded={(url) => setForm((c) => ({ ...c, hero_url: url }))} />
          </div>
        </div>
        <div className="space-y-1">
          <Label>Logo (white-label)</Label>
          <div className="flex gap-2">
            <Input value={form.theme.logo ?? ""} onChange={(e) => setForm((c) => ({ ...c, theme: { ...c.theme, logo: e.target.value } }))} placeholder="Paste URL or upload — shown on your public page" />
            <ImageUploader cafeId={cafeId} folder="logo" label="Upload" onUploaded={(url) => setForm((c) => ({ ...c, theme: { ...c.theme, logo: url } }))} />
          </div>
        </div>

        <div className="space-y-1"><Label>About</Label><Textarea rows={5} value={form.about} onChange={(e) => setForm({ ...form, about: e.target.value })} /></div>

        {/* Theme picker */}
        <div>
          <Label className="flex items-center gap-2"><Palette className="h-4 w-4 text-primary" /> Theme</Label>
          <div className="mt-2 grid gap-2 sm:grid-cols-4">
            {THEME_PRESETS.map((t) => {
              const active = form.theme.mode === t.mode;
              return (
                <button
                  key={t.mode}
                  type="button"
                  onClick={() => setForm((c) => ({ ...c, theme: { ...c.theme, mode: t.mode, accent: t.accent, bg: t.bg } }))}
                  className={`group relative overflow-hidden rounded-xl border p-3 text-left transition ${active ? "border-primary shadow-soft" : "border-border hover:border-primary/40"}`}
                  style={{ background: `linear-gradient(135deg, ${t.bg}, ${t.bg}cc)` }}
                >
                  <div className="text-xs font-semibold" style={{ color: t.mode === "minimal" ? "#111" : "#fff" }}>{t.label}</div>
                  <div className="mt-2 flex gap-1">
                    <span className="h-4 w-4 rounded-full ring-1 ring-white/30" style={{ background: t.accent }} />
                    <span className="h-4 w-4 rounded-full ring-1 ring-white/30" style={{ background: t.bg }} />
                  </div>
                </button>
              );
            })}
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Accent color</Label>
              <Input type="color" value={form.theme.accent ?? "#ec4899"} onChange={(e) => setForm((c) => ({ ...c, theme: { ...c.theme, accent: e.target.value } }))} className="h-10 w-full" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Background</Label>
              <Input type="color" value={form.theme.bg ?? "#0a0a1a"} onChange={(e) => setForm((c) => ({ ...c, theme: { ...c.theme, bg: e.target.value } }))} className="h-10 w-full" />
            </div>
          </div>
        </div>

        {/* Map */}
        <div className="space-y-1">
          <Label className="flex items-center gap-2"><MapPin className="h-4 w-4 text-azure" /> Google Maps embed URL</Label>
          <Input value={form.map_url} onChange={(e) => setForm({ ...form, map_url: e.target.value })} placeholder="https://www.google.com/maps/embed?pb=…" />
          <p className="text-[11px] text-muted-foreground">In Google Maps → Share → Embed a map → copy the src URL from the iframe.</p>
        </div>

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

        {/* Gallery */}
        <div>
          <Label className="flex items-center gap-2"><ImageIcon className="h-4 w-4 text-primary" /> Gallery</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            <Input value={form.galleryInput} onChange={(e) => setForm({ ...form, galleryInput: e.target.value })} placeholder="Paste image URL…" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addGallery(); } }} className="flex-1 min-w-[180px]" />
            <Button type="button" variant="outline" onClick={addGallery}>Add URL</Button>
            <ImageUploader cafeId={cafeId} folder="gallery" label="Upload image" onUploaded={(url) => setForm((c) => ({ ...c, gallery: [...c.gallery, url] }))} />
          </div>
          {form.gallery.length > 0 && (
            <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {form.gallery.map((url, i) => (
                <div key={i} className="group relative overflow-hidden rounded-lg border border-border/60">
                  <img src={url} alt="" className="aspect-square w-full object-cover" />
                  <button type="button" onClick={() => removeGallery(i)} className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-destructive/90 text-destructive-foreground opacity-0 transition group-hover:opacity-100">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <p className="mt-2 text-[11px] text-muted-foreground">Upload directly to your café gallery bucket, or paste a hosted image URL.</p>
        </div>

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
        {form.map_url && (
          <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/40">
            <iframe src={form.map_url} className="aspect-[16/12] w-full" loading="lazy" referrerPolicy="no-referrer-when-downgrade" title="Map preview" />
            <div className="p-3 text-xs text-muted-foreground"><MapPin className="mr-1 inline h-3 w-3" /> Map preview</div>
          </div>
        )}
      </aside>
    </div>
  );
}
