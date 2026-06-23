import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion";
import {
  MapPin, Phone, Mail, Trophy, Leaf, Beef, CalendarClock,
  Instagram, Youtube, MessageCircle, X, ChevronLeft, ChevronRight,
  Zap, Star, Joystick, ArrowRight,
} from "lucide-react";
import { getPublicCafe } from "@/lib/cafe-page.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MaintenanceBanner } from "@/components/MaintenanceBanner";
import { isMaintenanceActive } from "@/lib/maintenance";
import { supabase } from "@/lib/supabase/client";

export const Route = createFileRoute("/c/$slug")({
  head: ({ params, loaderData }) => {
    const cafe = (loaderData as any)?.cafe;
    const page = (loaderData as any)?.page;
    const name = cafe?.name || params.slug;
    const city = cafe?.city ? `, ${cafe.city}` : "";
    const desc =
      page?.tagline ||
      page?.about ||
      `Book PCs, consoles, snacks and tournaments at ${name}${city}.`;
    const img = page?.cover_url || page?.logo_url || undefined;
    const url = `https://codecade.lovable.app/c/${params.slug}`;
    const ld = {
      "@context": "https://schema.org",
      "@type": "LocalBusiness",
      name,
      description: desc,
      url,
      ...(img ? { image: img } : {}),
      ...(cafe?.address ? { address: { "@type": "PostalAddress", streetAddress: cafe.address, addressLocality: cafe.city } } : {}),
      ...(cafe?.phone ? { telephone: cafe.phone } : {}),
    };
    return {
      meta: [
        { title: `${name} — Gaming Café · CoreCade` },
        { name: "description", content: desc },
        { property: "og:title", content: `${name} — Gaming Café` },
        { property: "og:description", content: desc },
        { property: "og:type", content: "website" },
        { property: "og:url", content: url },
        ...(img ? [{ property: "og:image", content: img }] : []),
        { name: "twitter:card", content: img ? "summary_large_image" : "summary" },
        { name: "twitter:title", content: `${name} — Gaming Café` },
        { name: "twitter:description", content: desc },
        ...(img ? [{ name: "twitter:image", content: img }] : []),
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [{ type: "application/ld+json", children: JSON.stringify(ld) }],
    };
  },
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
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["public-cafe", slug],
    queryFn: () => fn({ data: { slug } }),
    refetchInterval: 20_000,
  });

  // Realtime: refresh when this café or its page changes (theme, logo, hours, etc.)
  useEffect(() => {
    const cafeId = data?.cafe?.id;
    if (!cafeId) return;
    const ch = supabase
      .channel(`public-cafe:${cafeId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "cafe_pages", filter: `cafe_id=eq.${cafeId}` },
        () => qc.invalidateQueries({ queryKey: ["public-cafe", slug] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "cafes", filter: `id=eq.${cafeId}` },
        () => qc.invalidateQueries({ queryKey: ["public-cafe", slug] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [data?.cafe?.id, qc, slug]);

  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 220]);
  const heroScale = useTransform(scrollYProgress, [0, 1], [1, 1.18]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.9], [1, 0.15]);
  const titleY = useTransform(scrollYProgress, [0, 1], [0, -80]);

  const [lightbox, setLightbox] = useState<number | null>(null);

  if (isLoading)
    return (
      <div className="grid min-h-screen place-items-center bg-[#04030c] text-white">
        <div className="h-12 w-12 animate-spin rounded-full border-2 border-fuchsia-500/40 border-t-fuchsia-400" />
      </div>
    );
  if (error || !data)
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#04030c] text-center text-white">
        <div>
          <div className="font-display text-2xl font-bold">Café not found</div>
          <Link to="/discover" className="mt-3 inline-block text-sm text-fuchsia-300 underline">Browse arenas</Link>
        </div>
      </div>
    );

  const { cafe, page, devices, menu, tournaments, activeDeviceIds, platform } = data;
  const freeCount = devices.filter((d) => !activeDeviceIds.includes(d.id) && d.status !== "maintenance").length;
  const heroUrl = page?.hero_url ?? cafe.cover_url;
  const theme = (page?.theme ?? {}) as { accent?: string; bg?: string; mode?: string; logo?: string };
  const accent = theme.accent ?? "#ff52e0";
  const bg = theme.bg ?? "#04030c";
  const isLight = theme.mode === "minimal";
  const logoUrl = theme.logo ?? null;
  const social = (page?.socials ?? {}) as Record<string, string>;
  const gallery = (page?.gallery ?? []) as string[];
  const mapUrl = (page?.map_url ?? null) as string | null;
  const upiId = (page as { upi_id?: string | null } | null)?.upi_id ?? null;
  const upiQr = (page as { upi_qr_url?: string | null } | null)?.upi_qr_url ?? null;
  const cafeMaint = {
    starts_at: (cafe as { maintenance_starts_at?: string | null }).maintenance_starts_at ?? null,
    ends_at: (cafe as { maintenance_ends_at?: string | null }).maintenance_ends_at ?? null,
    message: (cafe as { maintenance_message?: string | null }).maintenance_message ?? null,
  };
  const inMaintenance = isMaintenanceActive(cafeMaint) || isMaintenanceActive(platform);

  return (
    <div
      className={`relative min-h-screen overflow-x-hidden antialiased ${isLight ? "text-neutral-900" : "text-white"}`}
      style={{ background: bg }}
    >
      {/* Ambient backdrop — driven by theme accent */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -left-40 top-1/3 h-[420px] w-[420px] rounded-full blur-[140px]" style={{ background: `${accent}33` }} />
        <div className="absolute -right-40 top-2/3 h-[420px] w-[420px] rounded-full bg-blue-600/20 blur-[140px]" />
        <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at top, ${accent}22, transparent 60%)` }} />
      </div>


      {/* Top nav */}
      <header className="sticky top-0 z-40">
        <div className="mx-auto mt-3 max-w-6xl px-4">
          <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-[#0b0820]/70 px-4 py-2.5 backdrop-blur-2xl">
            <Link to="/discover" className="flex items-center gap-2.5">
              <div className="grid h-8 w-8 place-items-center rounded-lg" style={{ background: "linear-gradient(135deg,#ff52e0,#7b2fff,#2d8eff)", boxShadow: "0 0 18px rgba(255,82,224,.5)" }}>
                <Joystick className="h-4 w-4 text-white" />
              </div>
              <span className="font-display text-sm font-black tracking-[0.2em]">CORECADE</span>
            </Link>
            <div className="flex items-center gap-2">
              <Link to="/discover"><Button size="sm" variant="ghost" className="border border-white/15 bg-transparent text-white hover:bg-white/10">All arenas</Button></Link>
              <Link to="/auth"><Button size="sm" className="border-0 bg-gradient-to-r from-fuchsia-500 via-violet-500 to-blue-500 text-white">Sign in</Button></Link>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto mt-4 max-w-6xl space-y-3 px-4">
        <MaintenanceBanner window={platform} title="CoreCade network maintenance" />
        <MaintenanceBanner window={cafeMaint} title={`${cafe.name} is in maintenance`} />
      </div>

      {/* HERO — parallax */}
      <section ref={heroRef} className="relative mx-auto mt-6 max-w-6xl px-4">
        <div className="relative overflow-hidden rounded-3xl border border-white/10">
          <motion.div style={{ y: heroY, scale: heroScale, opacity: heroOpacity }} className="absolute inset-0">
            {heroUrl ? (
              <img src={heroUrl} alt={cafe.name} className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full bg-[conic-gradient(from_220deg_at_50%_50%,#7b2fff,#ff52e0,#2d8eff,#7b2fff)]" />
            )}
          </motion.div>
          <div className="relative aspect-[21/9] w-full">
            <div className="absolute inset-0 bg-gradient-to-t from-[#04030c] via-[#04030c]/60 to-transparent" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(255,82,224,.25),transparent_60%)]" />
            <motion.div style={{ y: titleY }} className="absolute inset-x-0 bottom-0 p-6 sm:p-10">
              {logoUrl && (
                <motion.img
                  src={logoUrl} alt={`${cafe.name} logo`}
                  initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
                  className="mb-4 h-14 w-auto rounded-xl object-contain bg-black/30 p-1.5 backdrop-blur border border-white/10"
                />
              )}
              <motion.div
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-[0.3em] backdrop-blur border"
                style={{ borderColor: `${accent}66`, backgroundColor: `${accent}1a`, color: accent }}
              >
                <MapPin className="h-3 w-3" />{cafe.city ?? "Gaming Café"}
              </motion.div>
              <motion.h1
                initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.1 }}
                className="mt-3 font-display text-4xl font-black leading-[1.05] sm:text-6xl"
                style={{ textShadow: `0 0 40px ${accent}66` }}
              >
                {cafe.name}
              </motion.h1>

              {page?.tagline && (
                <motion.p
                  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.2 }}
                  className="mt-3 max-w-2xl text-base text-white/70 sm:text-lg"
                >{page.tagline}</motion.p>
              )}
              <motion.div
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.3 }}
                className="mt-5 flex flex-wrap items-center gap-3"
              >
                {inMaintenance ? (
                  <Button size="lg" disabled variant="outline" className="cursor-not-allowed border-white/20">Bookings paused · maintenance</Button>
                ) : (
                  <Link to="/portal">
                    <Button size="lg" className="border-0 bg-gradient-to-r from-fuchsia-500 via-violet-500 to-blue-500 text-white shadow-[0_0_36px_rgba(255,82,224,.55)] hover:opacity-95">
                      Book a rig <ArrowRight className="ml-1.5 h-4 w-4" />
                    </Button>
                  </Link>
                )}
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-200 backdrop-blur">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                  </span>
                  <span className="font-mono">{freeCount}/{devices.length}</span> stations free
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* PRICING */}
      {devices.length > 0 && (
        <Section title="Stations & pricing" icon={Zap}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {devices.map((d, i) => {
              const busy = activeDeviceIds.includes(d.id);
              const maint = d.status === "maintenance";
              return (
                <motion.div
                  key={d.id}
                  initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-50px" }}
                  transition={{ duration: 0.5, delay: i * 0.04 }}
                  whileHover={{ y: -4 }}
                  className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl transition hover:border-fuchsia-400/40"
                >
                  <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-fuchsia-500/20 opacity-0 blur-3xl transition group-hover:opacity-100" />
                  <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-fuchsia-300">{d.type}</div>
                  <div className="mt-1 font-semibold">{d.name}</div>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="font-display text-3xl font-black bg-gradient-to-br from-fuchsia-300 via-violet-300 to-blue-300 bg-clip-text text-transparent">₹{d.hourly_rate}</span>
                    <span className="text-xs text-white/50">/ hr</span>
                  </div>
                  <div className="mt-3">
                    {busy ? (
                      <Badge variant="secondary" className="bg-white/10 text-white/70">In use</Badge>
                    ) : maint ? (
                      <Badge variant="outline" className="border-amber-400/40 text-amber-300">Maintenance</Badge>
                    ) : (
                      <Badge className="border-0 bg-gradient-to-r from-emerald-500 to-teal-500 text-white">Available</Badge>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </Section>
      )}

      {/* TOURNAMENTS */}
      {tournaments.length > 0 && (
        <Section title="Upcoming tournaments" icon={Trophy}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {tournaments.map((t, i) => (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.05 }}
                className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl transition hover:border-amber-400/40"
              >
                <div className="pointer-events-none absolute -right-14 -top-14 h-40 w-40 rounded-full bg-amber-500/20 blur-3xl" />
                <Trophy className="relative h-5 w-5 text-amber-300" />
                <div className="relative mt-2 font-mono text-[10px] uppercase tracking-[0.2em] text-white/50">{t.game}</div>
                <h3 className="relative font-display text-lg font-bold">{t.title}</h3>
                <div className="relative mt-2 text-xs text-white/60"><CalendarClock className="mr-1 inline h-3 w-3" />{new Date(t.starts_at).toLocaleString()}</div>
                <div className="relative mt-4 flex items-center justify-between border-t border-white/10 pt-3 text-sm">
                  <span className="text-white/60">Entry <b className="text-white">₹{t.entry_fee}</b></span>
                  <span className="text-white/60">Prize <b className="bg-gradient-to-r from-amber-300 to-fuchsia-300 bg-clip-text text-transparent">₹{t.prize_pool}</b></span>
                </div>
              </motion.div>
            ))}
          </div>
        </Section>
      )}

      {/* MENU */}
      {menu.items.length > 0 && (
        <Section title="Café menu" icon={Star}>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {menu.items.slice(0, 12).map((it, i) => (
              <motion.div
                key={it.id}
                initial={{ opacity: 0, x: -10 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.02 }}
                className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 backdrop-blur transition hover:border-fuchsia-400/30 hover:bg-white/[0.06]"
              >
                <div className="flex items-center gap-2">
                  {it.is_veg ? <Leaf className="h-3.5 w-3.5 text-emerald-400" /> : <Beef className="h-3.5 w-3.5 text-rose-400" />}
                  <span className="text-sm font-medium">{it.name}</span>
                </div>
                <span className="font-mono text-sm text-fuchsia-200">₹{it.price}</span>
              </motion.div>
            ))}
          </div>
        </Section>
      )}

      {/* GALLERY w/ lightbox */}
      {gallery.length > 0 && (
        <Section title="Inside the café">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {gallery.map((url, i) => (
              <motion.button
                key={i}
                onClick={() => setLightbox(i)}
                initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.04 }}
                whileHover={{ scale: 1.02 }}
                className="group relative aspect-square overflow-hidden rounded-2xl border border-white/10 bg-black/30"
              >
                <img src={url} alt={`Gallery ${i + 1}`} className="h-full w-full object-cover transition duration-500 group-hover:scale-110" loading="lazy" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 transition group-hover:opacity-100" />
              </motion.button>
            ))}
          </div>
        </Section>
      )}

      {/* ABOUT + CONTACT */}
      <Section title="About & visit">
        <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl">
            <h3 className="font-display text-xl font-bold">About</h3>
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-white/70">{page?.about ?? cafe.description ?? "Drop in and play."}</p>
          </div>
          <div className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl">
            <h3 className="font-display text-lg font-bold">Visit</h3>
            {cafe.address && <div className="flex items-start gap-2 text-sm text-white/80"><MapPin className="mt-0.5 h-4 w-4 text-fuchsia-300" />{cafe.address}, {cafe.city}</div>}
            {cafe.phone && <div className="flex items-center gap-2 text-sm text-white/80"><Phone className="h-4 w-4 text-fuchsia-300" />{cafe.phone}</div>}
            {cafe.email && <div className="flex items-center gap-2 text-sm text-white/80"><Mail className="h-4 w-4 text-fuchsia-300" />{cafe.email}</div>}
            {page?.hours && Object.keys(page.hours).length > 0 && (
              <div className="mt-3 border-t border-white/10 pt-3 text-xs">
                {Object.entries(page.hours).map(([d, h]) => h ? (
                  <div key={d} className="flex justify-between py-0.5"><span className="uppercase text-white/50">{d}</span><span className="text-white/80">{String(h)}</span></div>
                ) : null)}
              </div>
            )}
            <div className="mt-3 flex gap-2">
              {social.instagram && <a href={social.instagram} target="_blank" rel="noreferrer" className="rounded-lg border border-white/15 p-2 transition hover:border-fuchsia-400/50 hover:bg-white/5"><Instagram className="h-4 w-4" /></a>}
              {social.youtube && <a href={social.youtube} target="_blank" rel="noreferrer" className="rounded-lg border border-white/15 p-2 transition hover:border-fuchsia-400/50 hover:bg-white/5"><Youtube className="h-4 w-4" /></a>}
              {social.discord && <a href={social.discord} target="_blank" rel="noreferrer" className="rounded-lg border border-white/15 p-2 transition hover:border-fuchsia-400/50 hover:bg-white/5"><MessageCircle className="h-4 w-4" /></a>}
            </div>
          </div>
        </div>
      </Section>

      {mapUrl && (
        <Section title="Find us">
          <div className="overflow-hidden rounded-2xl border border-white/10">
            <iframe src={mapUrl} className="aspect-[21/9] w-full" loading="lazy" referrerPolicy="no-referrer-when-downgrade" title={`${cafe.name} on map`} />
          </div>
        </Section>
      )}

      {(upiId || upiQr) && (
        <Section title="Pay via UPI" icon={Zap}>
          <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-center rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl">
            {upiQr && (
              <div className="grid place-items-center rounded-2xl bg-white p-3 shadow-[0_0_40px_rgba(255,82,224,.25)]">
                <img src={upiQr} alt="UPI QR" className="h-44 w-44 object-contain" />
              </div>
            )}
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/50">UPI ID</div>
              {upiId ? (
                <button
                  type="button"
                  onClick={() => { navigator.clipboard?.writeText(upiId); }}
                  className="mt-1 break-all font-display text-xl font-bold sm:text-2xl"
                  style={{ color: accent }}
                  title="Click to copy"
                >
                  {upiId}
                </button>
              ) : (
                <div className="mt-1 text-sm text-white/60">Scan the QR with any UPI app.</div>
              )}
              <p className="mt-3 text-sm text-white/65">Pay directly to the café. Show the payment screen at the counter to start your session.</p>
              {upiId && (
                <a
                  href={`upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(cafe.name)}&cu=INR`}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white"
                  style={{ background: `linear-gradient(135deg, ${accent}, #7b2fff)` }}
                >
                  Open in UPI app <ArrowRight className="h-4 w-4" />
                </a>
              )}
            </div>
          </div>
        </Section>
      )}


      <footer className="mx-auto mt-16 max-w-6xl px-4 py-10 text-center text-xs text-white/40">
        Powered by <span className="bg-gradient-to-r from-fuchsia-300 via-violet-300 to-blue-300 bg-clip-text font-semibold text-transparent">CoreCade</span>
      </footer>

      {/* STICKY MOBILE CTA */}
      {!inMaintenance && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#04030c]/90 p-3 backdrop-blur-2xl sm:hidden">
          <Link to="/portal" className="block">
            <Button size="lg" className="w-full border-0 bg-gradient-to-r from-fuchsia-500 via-violet-500 to-blue-500 text-white shadow-[0_0_28px_rgba(255,82,224,.5)]">
              Book a rig at {cafe.name} <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      )}

      {/* LIGHTBOX */}
      <AnimatePresence>
        {lightbox !== null && (
          <Lightbox images={gallery} index={lightbox} onClose={() => setLightbox(null)} onIndex={setLightbox} />
        )}
      </AnimatePresence>
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon?: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <section className="mx-auto mt-14 max-w-6xl px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.5 }}
        className="mb-5 flex items-center gap-3"
      >
        {Icon && (
          <span className="grid h-9 w-9 place-items-center rounded-xl border border-fuchsia-400/30 bg-fuchsia-500/10">
            <Icon className="h-4 w-4 text-fuchsia-300" />
          </span>
        )}
        <h2 className="font-display text-2xl font-black sm:text-3xl">{title}</h2>
        <div className="ml-2 h-px flex-1 bg-gradient-to-r from-fuchsia-500/40 via-violet-500/20 to-transparent" />
      </motion.div>
      {children}
    </section>
  );
}

function Lightbox({ images, index, onClose, onIndex }: {
  images: string[]; index: number; onClose: () => void; onIndex: (i: number) => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onIndex((index + 1) % images.length);
      if (e.key === "ArrowLeft") onIndex((index - 1 + images.length) % images.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, images.length, onClose, onIndex]);

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] grid place-items-center bg-black/95 p-4 backdrop-blur-xl"
      onClick={onClose}
    >
      <button onClick={onClose} className="absolute right-5 top-5 rounded-full border border-white/20 bg-white/10 p-2 text-white transition hover:bg-white/20">
        <X className="h-5 w-5" />
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onIndex((index - 1 + images.length) % images.length); }}
        className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full border border-white/20 bg-white/10 p-2 text-white transition hover:bg-white/20 sm:left-8"
      ><ChevronLeft className="h-6 w-6" /></button>
      <button
        onClick={(e) => { e.stopPropagation(); onIndex((index + 1) % images.length); }}
        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full border border-white/20 bg-white/10 p-2 text-white transition hover:bg-white/20 sm:right-8"
      ><ChevronRight className="h-6 w-6" /></button>
      <motion.img
        key={index}
        initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        src={images[index]} alt=""
        className="max-h-[88vh] max-w-[92vw] rounded-2xl object-contain shadow-[0_0_80px_rgba(255,82,224,.3)]"
        onClick={(e) => e.stopPropagation()}
      />
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full border border-white/20 bg-black/50 px-3 py-1 font-mono text-xs text-white/80 backdrop-blur">
        {index + 1} / {images.length}
      </div>
    </motion.div>
  );
}
