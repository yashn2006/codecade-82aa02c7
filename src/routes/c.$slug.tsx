import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { MapPin, Phone, Mail, Trophy, Leaf, Beef, CalendarClock, Instagram, Youtube, MessageCircle } from "lucide-react";
import { getPublicCafe } from "@/lib/cafe-page.functions";
import { AuroraBackground } from "@/components/AuroraBackground";
import { BrandLockup } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MaintenanceBanner } from "@/components/MaintenanceBanner";
import { isMaintenanceActive } from "@/lib/maintenance";

export const Route = createFileRoute("/c/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.slug} — Gaming Café · CoreCade` },
      { name: "description", content: `Book PCs, consoles, snacks and tournaments at ${params.slug}.` },
      { property: "og:title", content: `${params.slug} — Gaming Café` },
      { property: "og:description", content: `Live availability, pricing, tournaments and more.` },
    ],
  }),
  component: PublicCafePage,
  loader: async ({ params, context }) => {
    return context.queryClient.ensureQueryData({
      queryKey: ["public-cafe", params.slug],
      queryFn: () => getPublicCafe({ data: { slug: params.slug } }),
    });
  },
});

function PublicCafePage() {
  const { slug } = Route.useParams();
  const fn = useServerFn(getPublicCafe);
  const { data, isLoading, error } = useQuery({
    queryKey: ["public-cafe", slug],
    queryFn: () => fn({ data: { slug } }),
    refetchInterval: 20_000,
  });

  if (isLoading) return <div className="min-h-screen" />;
  if (error || !data) return (
    <div className="flex min-h-screen items-center justify-center text-center">
      <div>
        <div className="font-display text-2xl font-bold">Café not found</div>
        <Link to="/" className="mt-3 inline-block text-sm text-primary underline">Back home</Link>
      </div>
    </div>
  );

  const { cafe, page, devices, menu, tournaments, activeDeviceIds, platform } = data;
  const freeCount = devices.filter((d) => !activeDeviceIds.includes(d.id) && d.status !== "maintenance").length;
  const heroUrl = page?.hero_url ?? cafe.cover_url;
  const social = (page?.socials ?? {}) as Record<string, string>;
  const gallery = (page?.gallery ?? []) as string[];
  const cafeMaint = {
    starts_at: (cafe as { maintenance_starts_at?: string | null }).maintenance_starts_at ?? null,
    ends_at: (cafe as { maintenance_ends_at?: string | null }).maintenance_ends_at ?? null,
    message: (cafe as { maintenance_message?: string | null }).maintenance_message ?? null,
  };
  const inMaintenance = isMaintenanceActive(cafeMaint) || isMaintenanceActive(platform);

  return (
    <div className="relative min-h-screen overflow-hidden">
      <AuroraBackground />

      <header className="sticky top-0 z-30">
        <div className="mx-auto mt-3 max-w-6xl px-4">
          <div className="glass-strong flex items-center justify-between rounded-2xl px-4 py-2.5">
            <BrandLockup size={26} badge={cafe.city ?? "Café"} />
            <Link to="/auth"><Button size="sm" variant="outline">Sign in</Button></Link>
          </div>
        </div>
      </header>

      <div className="mx-auto mt-4 max-w-6xl space-y-3 px-4">
        <MaintenanceBanner window={platform} title="CoreCade network maintenance" />
        <MaintenanceBanner window={cafeMaint} title={`${cafe.name} is in maintenance`} />
      </div>

      {/* HERO */}
      <section className="relative mx-auto mt-6 max-w-6xl px-4">
        <div className="relative overflow-hidden rounded-3xl border border-border/60">
          {heroUrl ? (
            <img src={heroUrl} alt={cafe.name} className="aspect-[21/9] w-full object-cover" />
          ) : (
            <div className="aspect-[21/9] w-full bg-gradient-to-br from-violet-900/40 via-fuchsia-900/30 to-cyan-900/40" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-6 sm:p-10">
            <div className="font-mono text-xs uppercase tracking-[0.3em] text-primary">{cafe.city ?? "Gaming Café"}</div>
            <h1 className="mt-2 font-display text-4xl font-extrabold leading-tight sm:text-6xl">{cafe.name}</h1>
            {page?.tagline && <p className="mt-2 max-w-2xl text-base text-muted-foreground sm:text-lg">{page.tagline}</p>}
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Link to="/portal"><Button size="lg" style={{ background: "var(--gradient-brand-hot)" }}>Book a rig</Button></Link>
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-300">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                {freeCount} of {devices.length} stations free
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PRICING */}
      {devices.length > 0 && (
        <section className="mx-auto mt-12 max-w-6xl px-4">
          <h2 className="font-display text-2xl font-bold">Stations & pricing</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {devices.map((d) => (
              <div key={d.id} className="rounded-2xl border border-border/60 bg-card/40 p-4 backdrop-blur">
                <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{d.type}</div>
                <div className="mt-1 font-semibold">{d.name}</div>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="font-display text-2xl font-extrabold text-gradient">₹{d.hourly_rate}</span>
                  <span className="text-xs text-muted-foreground">/ hr</span>
                </div>
                <div className="mt-2">
                  {activeDeviceIds.includes(d.id) ? (
                    <Badge variant="secondary">In use</Badge>
                  ) : d.status === "maintenance" ? (
                    <Badge variant="outline">Maintenance</Badge>
                  ) : (
                    <Badge style={{ background: "var(--gradient-brand-cool)" }}>Available</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* TOURNAMENTS */}
      {tournaments.length > 0 && (
        <section className="mx-auto mt-12 max-w-6xl px-4">
          <h2 className="font-display text-2xl font-bold">Upcoming tournaments</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {tournaments.map((t) => (
              <div key={t.id} className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/40 p-5 backdrop-blur">
                <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-primary/30 blur-3xl" />
                <Trophy className="relative h-5 w-5 text-primary" />
                <div className="relative mt-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{t.game}</div>
                <h3 className="relative font-display text-lg font-bold">{t.title}</h3>
                <div className="relative mt-2 text-xs text-muted-foreground"><CalendarClock className="mr-1 inline h-3 w-3" />{new Date(t.starts_at).toLocaleString()}</div>
                <div className="relative mt-3 flex items-center justify-between text-sm">
                  <span>Entry <b className="text-foreground">₹{t.entry_fee}</b></span>
                  <span>Prize <b className="text-gradient">₹{t.prize_pool}</b></span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* MENU */}
      {menu.items.length > 0 && (
        <section className="mx-auto mt-12 max-w-6xl px-4">
          <h2 className="font-display text-2xl font-bold">Café menu</h2>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {menu.items.slice(0, 12).map((it) => (
              <div key={it.id} className="flex items-center justify-between rounded-xl border border-border/40 bg-card/30 px-3 py-2">
                <div className="flex items-center gap-2">
                  {it.is_veg ? <Leaf className="h-3.5 w-3.5 text-emerald-400" /> : <Beef className="h-3.5 w-3.5 text-rose-400" />}
                  <span className="text-sm font-medium">{it.name}</span>
                </div>
                <span className="font-mono text-sm">₹{it.price}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* GALLERY */}
      {gallery.length > 0 && (
        <section className="mx-auto mt-12 max-w-6xl px-4">
          <h2 className="font-display text-2xl font-bold">Inside the café</h2>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {gallery.map((url, i) => (
              <img key={i} src={url} alt={`Gallery ${i + 1}`} className="aspect-square w-full rounded-xl border border-border/40 object-cover" loading="lazy" />
            ))}
          </div>
        </section>
      )}

      {/* ABOUT + CONTACT */}
      <section className="mx-auto mt-12 max-w-6xl px-4">
        <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
          <div className="rounded-2xl border border-border/60 bg-card/40 p-6 backdrop-blur">
            <h2 className="font-display text-2xl font-bold">About</h2>
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{page?.about ?? cafe.description ?? "Drop in and play."}</p>
          </div>
          <div className="space-y-2 rounded-2xl border border-border/60 bg-card/40 p-6 backdrop-blur">
            <h2 className="font-display text-xl font-bold">Visit</h2>
            {cafe.address && <div className="flex items-start gap-2 text-sm"><MapPin className="mt-0.5 h-4 w-4 text-primary" />{cafe.address}, {cafe.city}</div>}
            {cafe.phone && <div className="flex items-center gap-2 text-sm"><Phone className="h-4 w-4 text-primary" />{cafe.phone}</div>}
            {cafe.email && <div className="flex items-center gap-2 text-sm"><Mail className="h-4 w-4 text-primary" />{cafe.email}</div>}
            {page?.hours && Object.keys(page.hours).length > 0 && (
              <div className="mt-3 border-t border-border/40 pt-3 text-xs">
                {Object.entries(page.hours).map(([d, h]) => h ? (
                  <div key={d} className="flex justify-between py-0.5"><span className="uppercase text-muted-foreground">{d}</span><span>{String(h)}</span></div>
                ) : null)}
              </div>
            )}
            <div className="mt-3 flex gap-2">
              {social.instagram && <a href={social.instagram} target="_blank" rel="noreferrer" className="rounded-md border border-border/60 p-2 hover:bg-background/60"><Instagram className="h-4 w-4" /></a>}
              {social.youtube && <a href={social.youtube} target="_blank" rel="noreferrer" className="rounded-md border border-border/60 p-2 hover:bg-background/60"><Youtube className="h-4 w-4" /></a>}
              {social.discord && <a href={social.discord} target="_blank" rel="noreferrer" className="rounded-md border border-border/60 p-2 hover:bg-background/60"><MessageCircle className="h-4 w-4" /></a>}
            </div>
          </div>
        </div>
      </section>

      <footer className="mx-auto mt-16 max-w-6xl px-4 py-10 text-center text-xs text-muted-foreground">
        Powered by <span className="text-gradient font-semibold">CoreCade</span>
      </footer>
    </div>
  );
}
