import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, MapPin, Star, Map as MapIcon, LayoutGrid, X, Filter, Gamepad2, Clock, Wifi } from "lucide-react";
import { listPublicCafes } from "@/lib/discover.functions";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import corecadeLogo from "@/assets/corecade-logo.png.asset.json";

export const Route = createFileRoute("/discover")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Find Your Arena — CoreCade" },
      { name: "description", content: "Book PCs, consoles and VR rigs at premium gaming cafés near you." },
      { property: "og:title", content: "Find Your Arena — CoreCade" },
      { property: "og:description", content: "Book PCs, consoles and VR rigs at premium gaming cafés near you." },
    ],
  }),
  component: DiscoverPage,
});

type Cafe = {
  id: string; slug: string; name: string;
  city: string | null; state: string | null;
  description: string | null; cover_url: string | null;
};

const POPULAR_CITIES = ["Mumbai", "Delhi", "Bangalore", "Pune", "Hyderabad"];

const MAGENTA = "#ff2e93";
const BG = "#0a0a0f";

function DiscoverPage() {
  const fn = useServerFn(listPublicCafes);
  const { data: cafes = [], isLoading } = useQuery<Cafe[]>({ queryKey: ["public-cafes"], queryFn: () => fn() });

  const [query, setQuery] = useState("");
  const [city, setCity] = useState<string>("all");
  const [amenities, setAmenities] = useState<string[]>([]);
  const [openNow, setOpenNow] = useState(false);
  const [minRating, setMinRating] = useState(0);
  const [view, setView] = useState<"grid" | "map">("grid");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setSignedIn(!!data.user);
      setEmail(data.user?.email ?? null);
    });
  }, []);

  const cityList = useMemo(() => {
    const s = new Set<string>();
    cafes.forEach((c) => c.city && s.add(c.city));
    return Array.from(s).sort();
  }, [cafes]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return cafes.filter((c) => {
      if (city !== "all" && c.city?.toLowerCase() !== city.toLowerCase()) return false;
      if (q && ![c.name, c.city, c.state, c.description].some((v) => v?.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [cafes, query, city]);

  return (
    <div className="min-h-screen antialiased text-white" style={{ background: BG }}>
      <Navbar signedIn={signedIn} email={email} />
      <Hero
        query={query} setQuery={setQuery}
        city={city} setCity={setCity}
        cityList={cityList}
      />

      <section className="mx-auto max-w-[1200px] px-5 pb-24 sm:px-8">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-bold sm:text-3xl">Featured Arenas</h2>
            <p className="mt-1 text-sm text-white/50">{filtered.length} {filtered.length === 1 ? "arena" : "arenas"} available</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFiltersOpen(true)}
              className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium backdrop-blur transition hover:border-white/25 hover:bg-white/10"
            >
              <Filter className="h-4 w-4" /> Filters
            </button>
            <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 p-1 backdrop-blur">
              <button
                onClick={() => setView("grid")}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${view === "grid" ? "text-white" : "text-white/50 hover:text-white/80"}`}
                style={view === "grid" ? { background: MAGENTA } : undefined}
              >
                <LayoutGrid className="h-3.5 w-3.5" /> Grid
              </button>
              <button
                onClick={() => setView("map")}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${view === "map" ? "text-white" : "text-white/50 hover:text-white/80"}`}
                style={view === "map" ? { background: MAGENTA } : undefined}
              >
                <MapIcon className="h-3.5 w-3.5" /> Map
              </button>
            </div>
          </div>
        </div>

        {view === "grid" ? (
          isLoading ? (
            <SkeletonGrid />
          ) : filtered.length === 0 ? (
            <EmptyState onClear={() => { setQuery(""); setCity("all"); setAmenities([]); setOpenNow(false); setMinRating(0); }} />
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((c, i) => (
                <CafeCard key={c.id} cafe={c} index={i} isMobile={isMobile} />
              ))}
            </div>
          )
        ) : (
          <MapView cafes={filtered} />
        )}

        <StatsRow />
      </section>

      <FiltersSheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        city={city} setCity={setCity}
        cityList={cityList}
        amenities={amenities} setAmenities={setAmenities}
        openNow={openNow} setOpenNow={setOpenNow}
        minRating={minRating} setMinRating={setMinRating}
      />

      <footer className="border-t border-white/5 py-8 text-center text-xs text-white/40">
        © {new Date().getFullYear()} CoreCade · Built for India's gaming culture
      </footer>
    </div>
  );
}

/* ============ NAVBAR ============ */
function Navbar({ signedIn, email }: { signedIn: boolean; email: string | null }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll(); window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <nav className={`fixed top-0 inset-x-0 z-40 transition-all duration-300 ${scrolled ? "border-b border-white/5 bg-[#0a0a0f]/80 backdrop-blur-xl" : ""}`}>
      <div className="mx-auto flex max-w-[1200px] items-center justify-between px-5 py-4 sm:px-8">
        <Link to="/discover" className="flex items-center gap-2.5">
          <img src={corecadeLogo.url} alt="CoreCade" className="h-8 w-auto" draggable={false} />
          <span className="font-display text-base font-black tracking-[0.18em] text-white">CORECADE</span>
        </Link>
        <div className="flex items-center gap-2">
          {signedIn ? (
            <Link to="/portal"><Button size="sm" variant="ghost" className="text-white hover:bg-white/10">{email?.split("@")[0] ?? "Portal"}</Button></Link>
          ) : (
            <>
              <Link to="/auth"><Button size="sm" variant="ghost" className="text-white/80 hover:bg-white/10">Login</Button></Link>
              <Link to="/auth">
                <Button size="sm" className="border-0 text-white" style={{ background: MAGENTA }}>Sign up</Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

/* ============ HERO ============ */
function Hero({
  query, setQuery, city, setCity, cityList,
}: { query: string; setQuery: (s: string) => void; city: string; setCity: (c: string) => void; cityList: string[] }) {
  const chips = ["all", ...POPULAR_CITIES.filter((c) => cityList.some((x) => x.toLowerCase() === c.toLowerCase())), ...cityList.filter((c) => !POPULAR_CITIES.some((p) => p.toLowerCase() === c.toLowerCase()))];
  return (
    <section className="relative pt-32 pb-14 sm:pt-40 sm:pb-20">
      <div className="mx-auto max-w-3xl px-5 text-center sm:px-8">
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
          className="mx-auto inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium text-white/80 backdrop-blur"
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          India's Gaming Cafe Network
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.05 }}
          className="mt-6 font-display text-5xl font-black tracking-tight text-white sm:text-6xl"
        >
          Find Your Perfect Arena
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }}
          className="mx-auto mt-4 max-w-xl text-base text-white/55 sm:text-lg"
        >
          Book PCs, consoles and VR rigs at gaming cafes near you.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.15 }}
          className="mx-auto mt-8 flex w-full max-w-[600px] items-center gap-2 rounded-full border border-white/10 bg-white/5 p-1.5 pl-5 backdrop-blur-xl"
        >
          <Search className="h-4 w-4 shrink-0 text-white/40" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by cafe name, city, or area..."
            className="min-w-0 flex-1 bg-transparent py-2.5 text-sm text-white placeholder:text-white/40 focus:outline-none"
          />
          <button className="shrink-0 rounded-full px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110" style={{ background: MAGENTA }}>
            Search
          </button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.2 }}
          className="mx-auto mt-6 flex flex-wrap items-center justify-center gap-2"
        >
          {chips.map((c) => {
            const active = c === city || (c === "all" && city === "all");
            const label = c === "all" ? "All Cities" : c;
            return (
              <button
                key={c}
                onClick={() => setCity(c)}
                className={`rounded-full border px-4 py-1.5 text-xs font-medium transition ${active ? "border-transparent text-white" : "border-white/10 bg-white/5 text-white/70 hover:border-white/25 hover:text-white"}`}
                style={active ? { background: MAGENTA } : undefined}
              >
                {label}
              </button>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}

/* ============ CAFE CARD ============ */
function CafeCard({ cafe, index, isMobile }: { cafe: Cafe; index: number; isMobile: boolean }) {
  const [hover, setHover] = useState(false);
  const gradient = `linear-gradient(135deg, #2a0f3f 0%, ${MAGENTA} 100%)`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
      transition={{ duration: 0.35, delay: Math.min(index * 0.04, 0.3) }}
      onMouseEnter={() => !isMobile && setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="group relative"
    >
      <Link
        to="/c/$slug" params={{ slug: cafe.slug }}
        className="block overflow-hidden rounded-2xl bg-white/[0.03] transition-all duration-300 hover:-translate-y-1 hover:bg-white/[0.06]"
        style={{ boxShadow: hover ? "0 20px 50px -20px rgba(255,46,147,.35)" : "0 0 0 1px rgba(255,255,255,.04)" }}
      >
        {/* image */}
        <div className="relative h-[200px] overflow-hidden">
          {cafe.cover_url ? (
            <img src={cafe.cover_url} alt={cafe.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
          ) : (
            <div className="h-full w-full" style={{ background: gradient }} />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />

          <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-500/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-300 backdrop-blur">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </span>
            Live
          </div>
          <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full border border-white/10 bg-black/50 px-2 py-1 text-[11px] font-semibold text-white backdrop-blur">
            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" /> 4.8
          </div>

          <h3 className="absolute bottom-3 left-4 right-4 font-display text-lg font-bold text-white drop-shadow-lg">
            {cafe.name}
          </h3>
        </div>

        {/* body */}
        <div className="p-4">
          <div className="flex items-center gap-1.5 text-[13px] text-white/50">
            <MapPin className="h-3.5 w-3.5" />
            <span className="truncate">{[cafe.city, cafe.state].filter(Boolean).join(", ") || "Location"}</span>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {["PC", "Console", "VR", "WiFi"].map((a) => (
              <span key={a} className="rounded-md bg-white/5 px-2 py-0.5 text-[10px] font-medium text-white/60">{a}</span>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between">
            <div className="text-xs text-white/50">
              from <span className="text-sm font-bold text-white">₹80</span>/hr
            </div>
            <span className="text-xs font-semibold" style={{ color: MAGENTA }}>Step Inside →</span>
          </div>
        </div>
      </Link>

      {/* hover popup */}
      <AnimatePresence>
        {hover && !isMobile && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 6 }}
            transition={{ duration: 0.18 }}
            className="pointer-events-none absolute left-1/2 top-full z-30 mt-3 w-[300px] -translate-x-1/2 overflow-hidden rounded-xl border border-white/10 bg-[#0a0a0f]/95 backdrop-blur-xl"
            style={{ boxShadow: "0 20px 60px -10px rgba(0,0,0,.7)" }}
          >
            <div className="p-4">
              <div className="font-bold text-white">{cafe.name}</div>
              <div className="mt-1 flex items-start gap-1.5 text-xs text-white/60">
                <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                <span>{[cafe.city, cafe.state].filter(Boolean).join(", ") || "India"}</span>
              </div>
            </div>
            <iframe
              title={`${cafe.name} map`}
              src={`https://www.google.com/maps?q=${encodeURIComponent((cafe.name + " " + (cafe.city ?? "")).trim())}&output=embed`}
              className="h-[140px] w-full border-0"
              loading="lazy"
            />
            <div className="flex items-center justify-between border-t border-white/5 p-3">
              <div className="flex items-center gap-1.5 text-[11px] text-white/60">
                <Clock className="h-3 w-3" /> Open · 10 AM – 2 AM
              </div>
              <span className="rounded-full px-3 py-1 text-[11px] font-semibold text-white" style={{ background: MAGENTA }}>
                Quick Book
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ============ SKELETON ============ */
function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-2xl bg-white/[0.03]">
          <div className="h-[200px] animate-pulse bg-gradient-to-r from-white/5 via-white/10 to-white/5" />
          <div className="space-y-3 p-4">
            <div className="h-4 w-2/3 animate-pulse rounded bg-white/10" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-white/5" />
            <div className="h-3 w-1/3 animate-pulse rounded bg-white/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ============ EMPTY ============ */
function EmptyState({ onClear }: { onClear: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-white/5 bg-white/[0.02] px-6 py-20 text-center">
      <Gamepad2 className="h-12 w-12 text-white/20" />
      <h3 className="mt-4 font-display text-xl font-bold text-white">No arenas found</h3>
      <p className="mt-1 text-sm text-white/50">Try a different city or clear your filters.</p>
      <button onClick={onClear} className="mt-5 rounded-full px-5 py-2 text-sm font-semibold text-white" style={{ background: MAGENTA }}>
        Clear Filters
      </button>
    </div>
  );
}

/* ============ MAP VIEW ============ */
function MapView({ cafes }: { cafes: Cafe[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Load Leaflet CSS + JS from CDN
    const loadLeaflet = async () => {
      if (!document.getElementById("leaflet-css")) {
        const link = document.createElement("link");
        link.id = "leaflet-css"; link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
      }
      if (!(window as any).L) {
        await new Promise<void>((res, rej) => {
          const s = document.createElement("script");
          s.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
          s.onload = () => res(); s.onerror = () => rej();
          document.body.appendChild(s);
        });
      }
      setReady(true);
    };
    loadLeaflet().catch(() => {});
  }, []);

  useEffect(() => {
    if (!ready || !ref.current) return;
    const L = (window as any).L;
    const map = L.map(ref.current, { zoomControl: true, attributionControl: false }).setView([20.5937, 78.9629], 5);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", { subdomains: "abcd", maxZoom: 20 }).addTo(map);

    const CITY_COORDS: Record<string, [number, number]> = {
      mumbai: [19.076, 72.8777], delhi: [28.7041, 77.1025], bangalore: [12.9716, 77.5946],
      pune: [18.5204, 73.8567], hyderabad: [17.385, 78.4867], chennai: [13.0827, 80.2707],
      kolkata: [22.5726, 88.3639], ahmedabad: [23.0225, 72.5714], jaipur: [26.9124, 75.7873],
    };

    const icon = L.divIcon({
      className: "cc-pin",
      html: `<div style="width:22px;height:22px;border-radius:50%;background:${MAGENTA};border:3px solid #fff;box-shadow:0 0 0 4px rgba(255,46,147,.25),0 4px 12px rgba(0,0,0,.5)"></div>`,
      iconSize: [22, 22], iconAnchor: [11, 11],
    });

    const bounds: [number, number][] = [];
    cafes.forEach((c) => {
      const key = c.city?.toLowerCase() ?? "";
      const coord = CITY_COORDS[key];
      if (!coord) return;
      const jitter: [number, number] = [coord[0] + (Math.random() - 0.5) * 0.05, coord[1] + (Math.random() - 0.5) * 0.05];
      bounds.push(jitter);
      L.marker(jitter, { icon }).addTo(map).bindPopup(
        `<div style="font-family:system-ui;color:#0a0a0f;padding:2px 4px"><div style="font-weight:700;font-size:14px">${c.name}</div><div style="font-size:12px;color:#555;margin:2px 0 8px">${c.city ?? ""} · ★ 4.8</div><a href="/c/${c.slug}" style="display:inline-block;padding:6px 12px;background:${MAGENTA};color:#fff;border-radius:999px;text-decoration:none;font-size:12px;font-weight:600">View Cafe</a></div>`,
      );
    });
    if (bounds.length) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 11 });

    return () => { map.remove(); };
  }, [ready, cafes]);

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10" style={{ background: "#0f0f18" }}>
      <div ref={ref} style={{ height: 600, width: "100%" }} />
    </div>
  );
}

/* ============ FILTERS ============ */
function FiltersSheet({
  open, onClose, city, setCity, cityList, amenities, setAmenities, openNow, setOpenNow, minRating, setMinRating,
}: {
  open: boolean; onClose: () => void;
  city: string; setCity: (c: string) => void; cityList: string[];
  amenities: string[]; setAmenities: (a: string[]) => void;
  openNow: boolean; setOpenNow: (v: boolean) => void;
  minRating: number; setMinRating: (v: number) => void;
}) {
  const AMENITIES = ["PC Gaming", "Console", "VR", "Studio", "WiFi", "Food"];
  const toggle = (a: string) => setAmenities(amenities.includes(a) ? amenities.filter((x) => x !== a) : [...amenities, a]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" />
          <motion.div
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 z-50 h-full w-full max-w-sm overflow-y-auto border-l border-white/10 bg-[#0a0a0f] p-6"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display text-xl font-bold">Filters</h3>
              <button onClick={onClose} className="rounded-full p-2 hover:bg-white/10"><X className="h-4 w-4" /></button>
            </div>

            <div className="mt-6">
              <label className="text-xs font-semibold uppercase tracking-wider text-white/50">City</label>
              <select value={city} onChange={(e) => setCity(e.target.value)} className="mt-2 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white focus:border-white/25 focus:outline-none">
                <option value="all">All Cities</option>
                {cityList.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="mt-6">
              <label className="text-xs font-semibold uppercase tracking-wider text-white/50">Amenities</label>
              <div className="mt-2 space-y-2">
                {AMENITIES.map((a) => (
                  <label key={a} className="flex cursor-pointer items-center gap-3 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2.5 text-sm hover:border-white/15">
                    <input type="checkbox" checked={amenities.includes(a)} onChange={() => toggle(a)} className="h-4 w-4 accent-fuchsia-500" />
                    {a}
                  </label>
                ))}
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2.5">
              <span className="text-sm font-medium">Open Now</span>
              <button onClick={() => setOpenNow(!openNow)} className={`relative h-6 w-11 rounded-full transition ${openNow ? "" : "bg-white/10"}`} style={openNow ? { background: MAGENTA } : undefined}>
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${openNow ? "left-[22px]" : "left-0.5"}`} />
              </button>
            </div>

            <div className="mt-6">
              <label className="text-xs font-semibold uppercase tracking-wider text-white/50">Minimum Rating</label>
              <div className="mt-2 flex gap-2">
                {[0, 3, 4, 4.5].map((r) => (
                  <button key={r} onClick={() => setMinRating(r)}
                    className={`flex-1 rounded-lg border px-2 py-2 text-xs font-semibold ${minRating === r ? "border-transparent text-white" : "border-white/10 bg-white/5 text-white/60"}`}
                    style={minRating === r ? { background: MAGENTA } : undefined}
                  >
                    {r === 0 ? "Any" : `${r}+★`}
                  </button>
                ))}
              </div>
            </div>

            <button onClick={onClose} className="mt-8 w-full rounded-full py-3 text-sm font-bold text-white" style={{ background: MAGENTA }}>
              Apply Filters
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ============ STATS ============ */
function StatsRow() {
  const items = [
    { n: "120+", l: "Arenas" },
    { n: "50,000+", l: "Sessions" },
    { n: "18", l: "Cities" },
    { n: "4.8★", l: "Avg Rating" },
  ];
  return (
    <div className="mt-20 grid grid-cols-2 gap-4 rounded-2xl border border-white/5 bg-white/[0.02] p-6 sm:grid-cols-4 sm:p-8">
      {items.map((it) => (
        <div key={it.l} className="text-center">
          <div className="font-display text-2xl font-black text-white sm:text-3xl">{it.n}</div>
          <div className="mt-1 text-[11px] font-medium uppercase tracking-wider text-white/40">{it.l}</div>
        </div>
      ))}
    </div>
  );
}
