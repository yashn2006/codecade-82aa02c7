import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Compass, CalendarRange, User as UserIcon, Gamepad2, MapPin } from "lucide-react";
import { motion } from "framer-motion";
import { ConsoleShell } from "@/components/ConsoleShell";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/EmptyState";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { listPublicCafes, cafeDeviceTypes } from "@/lib/discover.functions";
import { listMyBookings, customerCreateBooking } from "@/lib/bookings.functions";
import { getMyRoles } from "@/lib/me.functions";
import { getMyOwnedCafes } from "@/lib/cafes.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/portal")({
  head: () => ({ meta: [{ title: "Portal — CoreCade" }] }),
  component: Portal,
});

function Portal() {
  const fetchRoles = useServerFn(getMyRoles);
  const fetchOwned = useServerFn(getMyOwnedCafes);
  const { data: roleData } = useQuery({ queryKey: ["my-roles"], queryFn: () => fetchRoles() });
  const { data: ownedCafes } = useQuery({ queryKey: ["my-owned-cafes"], queryFn: () => fetchOwned() });
  const roles = roleData?.roles ?? [];
  const isSuper = roles.some((r) => r.role === "super_admin");
  const ownerCafe = (ownedCafes ?? [])[0];

  return (
    <ConsoleShell
      badge="Customer"
      title="Welcome to CoreCade"
      subtitle="Find a café. Book a rig. Game on."
      nav={[
        { label: "Discover", icon: Compass, to: "/portal", exact: true },
      ]}
    >
      {(isSuper || ownerCafe) && (
        <div className="mb-6 flex flex-wrap gap-2">
          {isSuper && <Link to="/admin"><Button variant="outline" size="sm">Open Super Admin →</Button></Link>}
          {ownerCafe && <Link to="/cafe/$slug" params={{ slug: ownerCafe.slug }}><Button variant="outline" size="sm">Open {ownerCafe.name} console →</Button></Link>}
        </div>
      )}

      <Tabs defaultValue="discover">
        <TabsList className="glass-strong w-full justify-start rounded-2xl p-1">
          <TabsTrigger value="discover"><Compass className="mr-2 h-3.5 w-3.5" />Discover</TabsTrigger>
          <TabsTrigger value="bookings"><CalendarRange className="mr-2 h-3.5 w-3.5" />My bookings</TabsTrigger>
          <TabsTrigger value="profile"><UserIcon className="mr-2 h-3.5 w-3.5" />Profile</TabsTrigger>
        </TabsList>
        <TabsContent value="discover" className="mt-6"><DiscoverPanel /></TabsContent>
        <TabsContent value="bookings" className="mt-6"><MyBookingsPanel /></TabsContent>
        <TabsContent value="profile" className="mt-6"><ProfilePanel /></TabsContent>
      </Tabs>
    </ConsoleShell>
  );
}

function DiscoverPanel() {
  const fn = useServerFn(listPublicCafes);
  const { data, isLoading } = useQuery({ queryKey: ["public-cafes"], queryFn: () => fn() });
  const [city, setCity] = useState("");
  const filtered = (data ?? []).filter((c) => !city || (c.city ?? "").toLowerCase().includes(city.toLowerCase()));

  return (
    <div>
      <Input placeholder="Filter by city…" value={city} onChange={(e) => setCity(e.target.value)} className="max-w-xs" />
      <div className="mt-4">
        {isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-40 animate-pulse rounded-2xl border border-border/40 bg-card/30" />)}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={Gamepad2} title="No cafés yet" description="New cafés are joining every week." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((c, i) => <CafeCard key={c.id} cafe={c} index={i} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function CafeCard({ cafe, index }: { cafe: { id: string; slug: string; name: string; city: string | null; description: string | null }; index: number }) {
  const [open, setOpen] = useState(false);
  const types = useServerFn(cafeDeviceTypes);
  const tQ = useQuery({ queryKey: ["cafe-types", cafe.id], queryFn: () => types({ data: { cafe_id: cafe.id } }), enabled: open });
  const create = useServerFn(customerCreateBooking);
  const m = useMutation({
    mutationFn: create,
    onSuccess: () => { toast.success("Booking requested · check My bookings"); setOpen(false); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const accents = ["violet", "azure", "magenta"] as const;
  const accent = accents[index % 3];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }}
      className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card/40 p-5 backdrop-blur hover-lift hover:border-primary/40"
    >
      <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full blur-2xl opacity-60" style={{ background: `oklch(var(--${accent}) / 0.4)` }} />
      <div className="relative">
        <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          <MapPin className="h-3 w-3" />{cafe.city ?? "—"}
        </div>
        <h3 className="mt-1 font-display text-xl font-bold">{cafe.name}</h3>
        {cafe.description && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{cafe.description}</p>}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="mt-4 w-full" style={{ background: "var(--gradient-brand-hot)" }}>Book a slot</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Book at {cafe.name}</DialogTitle></DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                m.mutate({
                  data: {
                    cafe_id: cafe.id,
                    device_type: String(fd.get("device_type")),
                    scheduled_at: new Date(String(fd.get("scheduled_at"))).toISOString(),
                    duration_minutes: Number(fd.get("duration_minutes")),
                  },
                });
              }}
              className="space-y-3"
            >
              <div className="space-y-1">
                <Label>Device type</Label>
                <select name="device_type" required className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                  <option value="">Select…</option>
                  {(tQ.data ?? []).map((t) => (
                    <option key={t.type} value={t.type}>{t.type.toUpperCase()} · from ₹{t.min_rate}/hr · {t.count} available</option>
                  ))}
                </select>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1"><Label>Date &amp; time</Label><Input name="scheduled_at" type="datetime-local" required /></div>
                <div className="space-y-1"><Label>Duration (min)</Label><Input name="duration_minutes" type="number" defaultValue={60} required /></div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={m.isPending} style={{ background: "var(--gradient-brand-hot)" }}>
                  {m.isPending ? "Booking…" : "Request booking"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </motion.div>
  );
}

function MyBookingsPanel() {
  const fn = useServerFn(listMyBookings);
  const { data, isLoading } = useQuery({ queryKey: ["my-bookings"], queryFn: () => fn() });
  if (isLoading) return <div className="h-40 animate-pulse rounded-2xl border border-border/40 bg-card/30" />;
  if (!data || data.length === 0) return <EmptyState icon={CalendarRange} title="No bookings yet" description="Pick a café in Discover and book your first session." />;
  return (
    <div className="space-y-2">
      {data.map((b) => (
        <div key={b.id} className="rounded-2xl border border-border/60 bg-card/40 p-4 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="font-display text-lg font-bold">{(b.cafes as { name?: string } | null)?.name ?? "—"}</div>
              <div className="mt-0.5 font-mono text-xs text-azure">
                {new Date(b.scheduled_at).toLocaleString("en-IN")} · {b.duration_minutes}m · {(b.devices as { type?: string } | null)?.type?.toUpperCase()}
              </div>
            </div>
            <Badge variant={b.status === "confirmed" ? "default" : b.status === "cancelled" ? "destructive" : "secondary"}>{b.status}</Badge>
          </div>
        </div>
      ))}
    </div>
  );
}

function ProfilePanel() {
  return (
    <EmptyState
      icon={UserIcon}
      title="Profile editing"
      description="Phase 2B will let you update your name, phone, and avatar. For now you're all set."
    />
  );
}
