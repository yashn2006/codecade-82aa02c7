import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  MapPin,
  Star,
  Map as MapIcon,
  LayoutGrid,
  Filter,
  Gamepad2,
  Clock,
  Monitor,
  Zap,
  ArrowRight,
  ShieldCheck,
  Compass,
  Cpu,
  Trophy,
  X,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { listPublicCafes } from "@/lib/discover.functions";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { BrandLockup } from "@/components/Brand";
import { BookingFlow } from "@/components/BookingFlow";
import discoverBg from "@/assets/images/discover_cyber_arena_1794330285407.jpg";
import stationHeroImg from "@/assets/livefloor/station-hero.jpg";

export const Route = createFileRoute("/discover")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Find Your Perfect Arena — CoreCade" },
      {
        name: "description",
        content: "Discover and book high-refresh RTX 40-series rigs, PS5 Pro setups and immersive VR bays across India's premier esports cafés.",
      },
      { property: "og:title", content: "Find Your Perfect Arena — CoreCade" },
      {
        property: "og:description",
        content: "Discover and book high-refresh RTX 40-series rigs, PS5 Pro setups and immersive VR bays across India's premier esports cafés.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DiscoverPage,
});

type Cafe = {
  id: string;
  slug: string;
  name: string;
  city: string | null;
  state: string | null;
  address?: string | null;
  description: string | null;
  cover_url: string | null;
  open_time?: string | null;
  close_time?: string | null;
  min_rate?: number;
  device_count?: number;
  active_sessions?: number;
  free_count?: number;
  device_types?: string[];
};

const POPULAR_CITIES = ["All Cities", "Mumbai", "Bengaluru", "Delhi NCR", "Pune", "Hyderabad", "Chennai"];

const HARDWARE_FILTERS = [
  { id: "all", label: "All Stations", icon: Gamepad2 },
  { id: "pc", label: "RTX Rigs", icon: Monitor },
  { id: "console", label: "PS5 & Consoles", icon: Cpu },
  { id: "vr", label: "VR & Racing", icon: Zap },
];

function DiscoverPage() {
  const fetchCafes = useServerFn(listPublicCafes);
  const { data: cafes = [], isLoading } = useQuery<Cafe[]>({
    queryKey: ["public-cafes"],
    queryFn: () => fetchCafes(),
    refetchInterval: 30_000,
  });

  const [query, setQuery] = useState("");
  const [selectedCity, setSelectedCity] = useState("All Cities");
  const [selectedHardware, setSelectedHardware] = useState("all");
  const [liveOnly, setLiveOnly] = useState(false);
  const [view, setView] = useState<"grid" | "map">("grid");
  const [selectedCafeForBooking, setSelectedCafeForBooking] = useState<Cafe | null>(null);
  const [quickPeekCafe, setQuickPeekCafe] = useState<Cafe | null>(null);

  const [signedIn, setSignedIn] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setSignedIn(!!data.user);
      setUserEmail(data.user?.email ?? null);
    });

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const cities = useMemo(() => {
    const list = new Set<string>();
    cafes.forEach((c) => {
      if (c.city) list.add(c.city.trim());
    });
    return Array.from(list).sort();
  }, [cafes]);

  const filteredCafes = useMemo(() => {
    const q = query.trim().toLowerCase();
    return cafes.filter((c) => {
      if (selectedCity !== "All Cities") {
        const cityMatch = c.city?.toLowerCase() === selectedCity.toLowerCase() ||
          (selectedCity === "Delhi NCR" && (c.city?.toLowerCase().includes("delhi") || c.city?.toLowerCase().includes("noida") || c.city?.toLowerCase().includes("gurgaon")));
        if (!cityMatch) return false;
      }
      if (selectedHardware !== "all") {
        const types = (c.device_types ?? []).map((t) => t.toLowerCase());
        if (selectedHardware === "pc" && !types.some((t) => t.includes("pc") || t.includes("rig"))) return false;
        if (selectedHardware === "console" && !types.some((t) => t.includes("ps") || t.includes("xbox") || t.includes("console"))) return false;
        if (selectedHardware === "vr" && !types.some((t) => t.includes("vr") || t.includes("sim") || t.includes("racing"))) return false;
      }
      if (liveOnly && (c.active_sessions ?? 0) === 0) return false;
      if (q) {
        const match = [c.name, c.city, c.state, c.description, c.address].some((v) =>
          v?.toLowerCase().includes(q)
        );
        if (!match) return false;
      }
      return true;
    });
  }, [cafes, query, selectedCity, selectedHardware, liveOnly]);

  const totalRigs = useMemo(() => cafes.reduce((sum, c) => sum + (c.device_count ?? 16), 0), [cafes]);
  const activeSessionsCount = useMemo(() => cafes.reduce((sum, c) => sum + (c.active_sessions ?? 0), 0), [cafes]);

  return (
    <div className="relative min-h-screen bg-[#07060d] text-foreground antialiased selection:bg-primary selection:text-white">
      {/* Background Cyber Atmosphere */}
      <div
        className="pointer-events-none fixed inset-0 z-0 bg-cover bg-center opacity-30 mix-blend-screen filter blur-[2px]"
        style={{
          backgroundImage: `url(${discoverBg})`,
          maskImage: "radial-gradient(circle at 50% 25%, black 40%, transparent 90%)",
        }}
        aria-hidden
      />
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(244,63,94,0.18),rgba(255,255,255,0))]" />
      <div className="pointer-events-none fixed inset-0 z-0 bg-grid-pattern opacity-[0.03]" />

      <div className="relative z-10 flex min-h-screen flex-col">
        {/* Top Navbar */}
        <header className="mobile-keep-blur sticky top-0 z-40 border-b border-white/[0.08] bg-[#07060d]/80 backdrop-blur-xl transition-all">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2.5 sm:px-6 sm:py-3.5 lg:px-8">
            <div className="flex items-center gap-6">
              <BrandLockup size={28} to="/" />
              <div className="hidden items-center gap-2 border-l border-white/10 pl-6 text-xs text-muted-foreground md:flex">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
                <span>{cafes.length} Arenas Online</span>
                <span className="text-white/20">·</span>
                <span className="font-mono text-emerald-400">{activeSessionsCount} Active Gamers</span>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <Link
                to="/features"
                className="hidden text-xs font-semibold text-muted-foreground transition hover:text-white sm:block"
              >
                Features
              </Link>
              {signedIn ? (
                <Link to="/portal">
                  <Button
                    size="sm"
                    className="min-h-[40px] gap-2 text-xs font-semibold text-white shadow-lg transition-transform hover:-translate-y-0.5"
                    style={{ background: "var(--gradient-brand-hot)" }}
                  >
                    <Compass className="h-3.5 w-3.5" />
                    <span>Gamer Portal</span>
                  </Button>
                </Link>
              ) : (
                <div className="flex items-center gap-2">
                  <Link to="/auth">
                    <Button variant="ghost" size="sm" className="min-h-[40px] text-xs text-white/80 hover:bg-white/10 hover:text-white">
                      Sign in
                    </Button>
                  </Link>
                  <Link to="/auth">
                    <Button
                      size="sm"
                      className="min-h-[40px] text-xs font-semibold text-white shadow-md transition-transform hover:-translate-y-0.5"
                      style={{ background: "var(--gradient-brand-hot)" }}
                    >
                      Join Free
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* HERO SECTION */}
        <section className="relative overflow-hidden px-4 pt-12 pb-10 sm:px-6 sm:pt-20 lg:px-8">
          <div className="mx-auto max-w-5xl text-center">
            {/* Cyber Kicker */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1 text-xs font-semibold text-primary backdrop-blur"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Real-Time Esports & Gaming Café Locator</span>
            </motion.div>

            {/* Giant Display Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="mt-4 font-display text-4xl font-black tracking-tight sm:text-6xl lg:text-7xl"
            >
              FIND YOUR <span className="text-gradient-hot">PERFECT ARENA</span>.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg"
            >
              Book 240Hz RTX 40-series rigs, 4K PS5 consoles and high-octane racing simulators with guaranteed seat locks in under 30 seconds.
            </motion.p>

            {/* HUD Telemetry Banner */}
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.15 }}
              className="mx-auto mt-8 grid max-w-3xl grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-2 backdrop-blur-xl sm:grid-cols-4"
            >
              <div className="rounded-xl border border-white/5 bg-black/30 p-2.5 text-center">
                <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Total Stations</div>
                <div className="mt-0.5 font-display text-xl font-extrabold text-white">{totalRigs}+</div>
              </div>
              <div className="rounded-xl border border-white/5 bg-black/30 p-2.5 text-center">
                <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Starting Rate</div>
                <div className="mt-0.5 font-display text-xl font-extrabold text-emerald-400">₹60 / hr</div>
              </div>
              <div className="rounded-xl border border-white/5 bg-black/30 p-2.5 text-center">
                <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Verified Cafés</div>
                <div className="mt-0.5 font-display text-xl font-extrabold text-primary">{cafes.length}</div>
              </div>
              <div className="rounded-xl border border-white/5 bg-black/30 p-2.5 text-center">
                <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Seat Lock</div>
                <div className="mt-0.5 font-display text-xl font-extrabold text-amber-300">Instant</div>
              </div>
            </motion.div>

            {/* Next-Gen Interactive Search Deck */}
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="relative mx-auto mt-8 max-w-3xl"
            >
              <div className="group relative flex items-center rounded-2xl border border-white/15 bg-black/60 p-2 shadow-[0_0_50px_-15px_oklch(0.7_0.26_335/0.4)] backdrop-blur-2xl transition-all focus-within:border-primary/60 focus-within:shadow-[0_0_60px_-10px_oklch(0.7_0.26_335/0.6)]">
                <Search className="ml-3 h-5 w-5 text-muted-foreground transition group-focus-within:text-primary" />
                <Input
                  ref={searchInputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search arena name, locality, or gaming hardware (press '/' to focus)..."
                  className="h-12 border-0 bg-transparent text-sm placeholder:text-muted-foreground/60 focus-visible:ring-0 focus-visible:ring-offset-0 sm:text-base"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="mr-2 rounded-lg p-1.5 text-muted-foreground hover:bg-white/10 hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
                <Button
                  type="button"
                  onClick={() => searchInputRef.current?.focus()}
                  className="hidden h-10 px-5 text-xs font-bold text-white shadow-md sm:flex"
                  style={{ background: "var(--gradient-brand-hot)" }}
                >
                  Locate Rigs
                </Button>
              </div>

              {/* City quick filter pills — swipeable rail on mobile */}
              <div className="-mx-4 mt-4 flex flex-nowrap items-center justify-start gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:justify-center sm:px-0">
                {POPULAR_CITIES.map((c) => {
                  const isSelected = selectedCity === c;
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setSelectedCity(c)}
                      className={`min-h-[40px] shrink-0 snap-start rounded-full border px-4 py-1.5 text-xs font-semibold transition ${
                        isSelected
                          ? "border-primary bg-primary/20 text-white shadow-[0_0_15px_-3px_oklch(0.7_0.26_335/0.7)]"
                          : "border-white/10 bg-white/[0.03] text-muted-foreground hover:border-white/20 hover:text-white"
                      }`}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </div>
        </section>

        {/* MAIN BODY: FILTERS & ARENA SHOWCASE */}
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-24 sm:px-6 lg:px-8">
          {/* Controls Bar */}
          <div className="mb-6 flex flex-col gap-3.5 border-b border-white/[0.08] pb-4 sm:flex-row sm:items-center sm:justify-between">
            {/* Hardware category filters — swipeable rail on mobile */}
            <div className="-mx-4 flex flex-nowrap items-center gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0 sm:pb-0">
              {HARDWARE_FILTERS.map((h) => {
                const Icon = h.icon;
                const isSelected = selectedHardware === h.id;
                return (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => setSelectedHardware(h.id)}
                    className={`flex min-h-[44px] shrink-0 snap-start items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold transition ${
                      isSelected
                        ? "border-primary bg-primary/15 text-white shadow-[0_0_20px_-4px_oklch(0.7_0.26_335/0.8)]"
                        : "border-white/10 bg-white/[0.03] text-muted-foreground hover:border-white/20 hover:text-white"
                    }`}
                  >
                    <Icon className={`h-3.5 w-3.5 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                    <span>{h.label}</span>
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => setLiveOnly(!liveOnly)}
                className={`flex min-h-[44px] shrink-0 snap-start items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold transition ${
                  liveOnly
                    ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-300 shadow-[0_0_20px_-4px_rgba(16,185,129,0.7)]"
                    : "border-white/10 bg-white/[0.03] text-muted-foreground hover:border-white/20 hover:text-white"
                }`}
              >
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
                <span>Live Action Only</span>
              </button>
            </div>

            {/* View switcher & count */}
            <div className="flex items-center justify-between gap-3 sm:justify-end">
              <span className="text-xs text-muted-foreground">
                Showing <strong className="text-foreground">{filteredCafes.length}</strong> {filteredCafes.length === 1 ? "arena" : "arenas"}
              </span>

              <div className="flex rounded-xl border border-white/10 bg-white/[0.03] p-1">
                <button
                  type="button"
                  onClick={() => setView("grid")}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    view === "grid" ? "bg-white/15 text-white shadow" : "text-muted-foreground hover:text-white"
                  }`}
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                  <span>Grid</span>
                </button>
                <button
                  type="button"
                  onClick={() => setView("map")}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    view === "map" ? "bg-white/15 text-white shadow" : "text-muted-foreground hover:text-white"
                  }`}
                >
                  <MapIcon className="h-3.5 w-3.5" />
                  <span>Map</span>
                </button>
              </div>
            </div>
          </div>

          {/* Arenas Grid */}
          {isLoading ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-96 animate-pulse rounded-3xl border border-white/5 bg-white/[0.02]" />
              ))}
            </div>
          ) : filteredCafes.length === 0 ? (
            <div className="my-16 flex flex-col items-center justify-center rounded-3xl border border-white/10 bg-white/[0.02] p-12 text-center">
              <Gamepad2 className="h-16 w-16 text-muted-foreground/40" />
              <h3 className="mt-4 font-display text-xl font-bold text-white">No Arenas Match Your Criteria</h3>
              <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                Try switching city to "All Cities" or clearing hardware filters to discover available gaming rigs.
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  setQuery("");
                  setSelectedCity("All Cities");
                  setSelectedHardware("all");
                  setLiveOnly(false);
                }}
                className="mt-5 border-white/20 text-xs"
              >
                Reset All Filters
              </Button>
            </div>
          ) : view === "grid" ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filteredCafes.map((cafe, idx) => (
                <ArenaCard
                  key={cafe.id}
                  cafe={cafe}
                  index={idx}
                  onQuickPeek={() => setQuickPeekCafe(cafe)}
                  onBookDirect={() => setSelectedCafeForBooking(cafe)}
                />
              ))}
            </div>
          ) : (
            <ArenaMapView cafes={filteredCafes} onSelectCafe={(c) => setQuickPeekCafe(c)} />
          )}
        </main>

        {/* Quick Peek Drawer / Modal */}
        {quickPeekCafe && (
          <Dialog open={!!quickPeekCafe} onOpenChange={(open) => !open && setQuickPeekCafe(null)}>
            <DialogContent className="max-w-xl border-white/15 bg-[#0e0c1a] p-0 text-foreground overflow-hidden">
              <div className="relative h-48 w-full overflow-hidden bg-black/60">
                <img
                  src={quickPeekCafe.cover_url || stationHeroImg}
                  alt={quickPeekCafe.name}
                  className="h-full w-full object-cover"
                  onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = stationHeroImg; }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0e0c1a] via-black/40 to-transparent" />
                <div className="absolute bottom-4 left-6 right-6">
                  <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-primary">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    <span>Verified CoreCade Partner</span>
                  </div>
                  <DialogTitle className="mt-1 font-display text-2xl font-extrabold text-white">
                    {quickPeekCafe.name}
                  </DialogTitle>
                </div>
              </div>

              <div className="space-y-4 p-6">
                <div className="flex items-start gap-2 text-xs text-muted-foreground">
                  <MapPin className="h-4 w-4 shrink-0 text-primary mt-0.5" />
                  <span>{quickPeekCafe.address || [quickPeekCafe.city, quickPeekCafe.state].filter(Boolean).join(", ") || "Location details on arrival"}</span>
                </div>

                {quickPeekCafe.description && (
                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                    {quickPeekCafe.description}
                  </p>
                )}

                <div className="grid grid-cols-3 gap-2 py-2">
                  <div className="rounded-xl border border-white/5 bg-white/[0.03] p-3 text-center">
                    <div className="font-mono text-[10px] text-muted-foreground uppercase">Rate</div>
                    <div className="mt-0.5 font-display text-lg font-bold text-emerald-400">₹{quickPeekCafe.min_rate ?? 80}/hr</div>
                  </div>
                  <div className="rounded-xl border border-white/5 bg-white/[0.03] p-3 text-center">
                    <div className="font-mono text-[10px] text-muted-foreground uppercase">Total Rigs</div>
                    <div className="mt-0.5 font-display text-lg font-bold text-white">{quickPeekCafe.device_count ?? 16}</div>
                  </div>
                  <div className="rounded-xl border border-white/5 bg-white/[0.03] p-3 text-center">
                    <div className="font-mono text-[10px] text-muted-foreground uppercase">Status</div>
                    <div className="mt-0.5 font-display text-lg font-bold text-primary">
                      {quickPeekCafe.free_count ?? 12} Free
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <Button
                    onClick={() => {
                      const c = quickPeekCafe;
                      setQuickPeekCafe(null);
                      setSelectedCafeForBooking(c);
                    }}
                    className="flex-1 h-12 text-xs font-bold text-white shadow-lg transition-transform hover:-translate-y-0.5"
                    style={{ background: "var(--gradient-brand-hot)" }}
                  >
                    <Zap className="h-4 w-4 mr-1.5" /> Book Station Now
                  </Button>
                  <Link to="/c/$slug" params={{ slug: quickPeekCafe.slug }} className="flex-1">
                    <Button variant="outline" className="w-full h-12 border-white/15 text-xs font-semibold">
                      Full Arena Page →
                    </Button>
                  </Link>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Interactive Direct Booking Flow Modal */}
        {selectedCafeForBooking && (
          <BookingFlow
            open={!!selectedCafeForBooking}
            onOpenChange={(open) => !open && setSelectedCafeForBooking(null)}
            cafe={{ id: selectedCafeForBooking.id, name: selectedCafeForBooking.name, city: selectedCafeForBooking.city }}
            onBooked={() => {
              setSelectedCafeForBooking(null);
            }}
          />
        )}

        {/* Footer */}
        <footer className="border-t border-white/[0.08] bg-black/40 py-8 text-center text-xs text-muted-foreground">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-2">
              <span className="font-display font-bold text-white">CoreCade</span>
              <span>· India’s Gaming & Esports Infrastructure</span>
            </div>
            <div className="flex items-center gap-4">
              <Link to="/portal" className="hover:text-white transition">Gamer Portal</Link>
              <Link to="/owner" className="hover:text-white transition">Café Owners</Link>
              <Link to="/terms" className="hover:text-white transition">Terms</Link>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

/* =========================================================================
   ARENA CARD COMPONENT (3D Hover, Occupancy, Hardware Specs, Quick Booking)
   ========================================================================= */

function ArenaCard({
  cafe,
  index,
  onQuickPeek,
  onBookDirect,
}: {
  cafe: Cafe;
  index: number;
  onQuickPeek: () => void;
  onBookDirect: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const total = cafe.device_count ?? 16;
  const active = cafe.active_sessions ?? 0;
  const free = Math.max(0, total - active);
  const minRate = cafe.min_rate ?? 80;
  const coverUrl = cafe.cover_url || stationHeroImg;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index * 0.05, 0.3) }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-white/10 bg-[#0d0b17] shadow-lg transition-all duration-300 hover:-translate-y-1 hover:border-primary/50 hover:shadow-[0_0_35px_-8px_oklch(0.7_0.26_335/0.5)]"
    >
      <div>
        {/* Cover Media Header */}
        <div className="relative h-44 w-full overflow-hidden bg-black/60">
          <img
            src={coverUrl}
            alt={cafe.name}
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
            loading="lazy"
            onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = stationHeroImg; }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0d0b17] via-black/30 to-transparent" />

          {/* Occupancy pill */}
          <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-black/70 px-2.5 py-1 text-[11px] font-bold text-emerald-300 backdrop-blur-md">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            <span>{free} / {total} Free</span>
          </div>

          {/* Rating */}
          <div className="absolute top-3 right-3 flex items-center gap-1 rounded-full border border-white/10 bg-black/70 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur-md">
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
            <span>4.9</span>
          </div>

          {/* Location Badge */}
          <div className="absolute bottom-3 left-4 flex items-center gap-1.5 text-xs font-semibold text-white/90 drop-shadow">
            <MapPin className="h-3.5 w-3.5 text-primary" />
            <span>{[cafe.city, cafe.state].filter(Boolean).join(", ") || "India"}</span>
          </div>
        </div>

        {/* Card Body */}
        <div className="p-5">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-display text-xl font-extrabold tracking-tight text-white group-hover:text-primary transition-colors">
              {cafe.name}
            </h3>
          </div>

          {cafe.description && (
            <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
              {cafe.description}
            </p>
          )}

          {/* Hardware Chips */}
          <div className="mt-3.5 flex flex-wrap gap-1.5">
            {(cafe.device_types && cafe.device_types.length > 0
              ? cafe.device_types
              : ["RTX 40-Series", "240Hz", "PS5 Pro"]
            ).map((tag) => (
              <span
                key={tag}
                className="rounded-lg border border-white/5 bg-white/[0.04] px-2 py-0.5 text-[10px] font-mono text-white/70"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Card Footer */}
      <div className="border-t border-white/[0.06] bg-black/20 p-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono uppercase text-muted-foreground block">Starting at</span>
            <div className="flex items-baseline gap-1">
              <span className="font-display text-lg font-black text-white">₹{minRate}</span>
              <span className="text-xs text-muted-foreground">/hr</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onQuickPeek}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/80 hover:bg-white/10 hover:text-white transition"
            >
              Details
            </button>
            <Button
              size="sm"
              onClick={onBookDirect}
              className="gap-1.5 text-xs font-bold text-white shadow-md transition-transform hover:-translate-y-0.5"
              style={{ background: "var(--gradient-brand-hot)" }}
            >
              <span>Book</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* =========================================================================
   ARENA MAP VIEW
   ========================================================================= */

function ArenaMapView({ cafes, onSelectCafe }: { cafes: Cafe[]; onSelectCafe: (c: Cafe) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  useEffect(() => {
    const loadLeaflet = async () => {
      if (!document.getElementById("leaflet-css")) {
        const link = document.createElement("link");
        link.id = "leaflet-css";
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
      }
      if (!(window as any).L) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
          script.onload = () => resolve();
          script.onerror = () => reject();
          document.body.appendChild(script);
        });
      }
      setMapLoaded(true);
    };
    loadLeaflet().catch(() => {});
  }, []);

  useEffect(() => {
    if (!mapLoaded || !containerRef.current) return;
    const L = (window as any).L;
    const map = L.map(containerRef.current, { zoomControl: true, attributionControl: false }).setView([20.5937, 78.9629], 5);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      subdomains: "abcd",
      maxZoom: 19,
    }).addTo(map);

    const CITY_COORDS: Record<string, [number, number]> = {
      mumbai: [19.076, 72.8777],
      delhi: [28.7041, 77.1025],
      bangalore: [12.9716, 77.5946],
      bengaluru: [12.9716, 77.5946],
      pune: [18.5204, 73.8567],
      hyderabad: [17.385, 78.4867],
      chennai: [13.0827, 80.2707],
      kolkata: [22.5726, 88.3639],
      ahmedabad: [23.0225, 72.5714],
      jaipur: [26.9124, 75.7873],
    };

    const icon = L.divIcon({
      className: "cc-custom-marker",
      html: `<div style="width:26px;height:26px;border-radius:50%;background:#ff006e;border:3px solid #fff;box-shadow:0 0 16px rgba(255,0,110,0.8), 0 4px 10px rgba(0,0,0,0.6);display:grid;place-items:center;"><div style="width:6px;height:6px;border-radius:50%;background:#fff;"></div></div>`,
      iconSize: [26, 26],
      iconAnchor: [13, 13],
    });

    const markers: [number, number][] = [];
    cafes.forEach((c) => {
      const cityKey = (c.city ?? "").toLowerCase();
      const baseCoord = CITY_COORDS[cityKey];
      if (!baseCoord) return;

      const jittered: [number, number] = [
        baseCoord[0] + (Math.random() - 0.5) * 0.04,
        baseCoord[1] + (Math.random() - 0.5) * 0.04,
      ];
      markers.push(jittered);

      const m = L.marker(jittered, { icon }).addTo(map);
      m.bindPopup(
        `<div style="font-family:sans-serif;color:#fff;background:#0d0b17;padding:8px 10px;border-radius:12px;border:1px solid rgba(255,255,255,0.15);min-width:180px;">
          <div style="font-weight:800;font-size:14px;color:#ff006e;">${c.name}</div>
          <div style="font-size:11px;color:#999;margin-top:2px;">${c.city ?? "Arena"} · ₹${c.min_rate ?? 80}/hr</div>
          <div style="margin-top:8px;">
            <a href="/c/${c.slug}" style="display:inline-block;padding:5px 12px;background:#ff006e;color:#fff;border-radius:20px;text-decoration:none;font-size:11px;font-weight:700;">Open Arena →</a>
          </div>
        </div>`,
        { className: "dark-popup" }
      );
    });

    if (markers.length > 0) {
      map.fitBounds(markers, { padding: [50, 50], maxZoom: 12 });
    }

    return () => {
      map.remove();
    };
  }, [mapLoaded, cafes]);

  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#0d0b17] shadow-2xl">
      <div ref={containerRef} style={{ height: "600px", width: "100%" }} />
    </div>
  );
}
