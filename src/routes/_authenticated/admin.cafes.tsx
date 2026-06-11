import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { Plus, Building2, Power, PowerOff, Lock, Unlock, Wrench, MoreHorizontal, Trash2, ExternalLink, LayoutDashboard, Cpu, CalendarClock, Users as UsersIcon, ShoppingBag, Wallet, Receipt, UserCog, Utensils, Map as MapIcon, BadgePercent, Trophy, FileEdit, BarChart3 } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { listAllCafes, setCafeRestriction, deleteCafe, cafeDeepStats } from "@/lib/admin.functions";
import { createCafe, toggleCafeActive } from "@/lib/cafes.functions";
import { MaintenanceScheduler } from "@/components/MaintenanceScheduler";
import { isMaintenanceActive } from "@/lib/maintenance";


export const Route = createFileRoute("/_authenticated/admin/cafes")({
  component: CafesPanel,
});

type CafeRow = {
  id: string; slug: string; name: string; city: string | null;
  is_active: boolean; restricted_message?: string | null;
  maintenance_starts_at: string | null;
  maintenance_ends_at: string | null;
  maintenance_message: string | null;
  profiles: unknown;
};

function CafesPanel() {
  const fn = useServerFn(listAllCafes);
  const { data, isLoading } = useQuery({ queryKey: ["admin-cafes"], queryFn: () => fn() });
  const qc = useQueryClient();
  const create = useServerFn(createCafe);
  const [open, setOpen] = useState(false);
  const m = useMutation({
    mutationFn: create,
    onSuccess: () => {
      toast.success("Café created");
      qc.invalidateQueries({ queryKey: ["admin-cafes"] });
      qc.invalidateQueries({ queryKey: ["admin-overview"] });
      setOpen(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const cafes = (data ?? []) as CafeRow[];
  const buckets = useMemo(() => ({
    all: cafes,
    active: cafes.filter((c) => c.is_active && !c.restricted_message && !isMaintenanceActive({
      starts_at: c.maintenance_starts_at, ends_at: c.maintenance_ends_at, message: c.maintenance_message,
    })),
    maintenance: cafes.filter((c) => isMaintenanceActive({
      starts_at: c.maintenance_starts_at, ends_at: c.maintenance_ends_at, message: c.maintenance_message,
    })),
    paused: cafes.filter((c) => !c.is_active),
    restricted: cafes.filter((c) => !!c.restricted_message),
  }), [cafes]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">{cafes.length} cafés on network</div>
        <div className="flex flex-wrap items-center gap-2">
          <ExportButton kind="cafes" />
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2" style={{ background: "var(--gradient-brand-hot)" }}>
                <Plus className="h-4 w-4" /> Onboard café
              </Button>
            </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader><DialogTitle>Onboard a café</DialogTitle></DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                m.mutate({
                  data: {
                    name: String(fd.get("name")),
                    slug: String(fd.get("slug")).toLowerCase().trim(),
                    owner_email: String(fd.get("owner_email")),
                    city: String(fd.get("city") || "") || null,
                    state: String(fd.get("state") || "") || null,
                    address: String(fd.get("address") || "") || null,
                    phone: String(fd.get("phone") || "") || null,
                    email: String(fd.get("email") || "") || null,
                    description: String(fd.get("description") || "") || null,
                  },
                });
              }}
              className="space-y-3"
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <Field name="name" label="Café name" required />
                <Field name="slug" label="URL slug" placeholder="my-cafe" required />
                <Field name="owner_email" label="Owner email" type="email" required />
                <Field name="phone" label="Phone" />
                <Field name="city" label="City" />
                <Field name="state" label="State" />
              </div>
              <Field name="address" label="Address" />
              <div className="space-y-1">
                <Label>Description</Label>
                <Textarea name="description" rows={2} />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={m.isPending} className="gap-2" style={{ background: "var(--gradient-brand-hot)" }}>
                  {m.isPending ? "Creating…" : "Create café"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>


      <Tabs defaultValue="all" className="mt-5">
        <TabsList className="glass-strong flex-wrap rounded-2xl p-1">
          <TabsTrigger value="all">All <Badge variant="secondary" className="ml-2">{buckets.all.length}</Badge></TabsTrigger>
          <TabsTrigger value="active">Live <Badge variant="secondary" className="ml-2">{buckets.active.length}</Badge></TabsTrigger>
          <TabsTrigger value="maintenance">Maintenance <Badge variant="secondary" className="ml-2">{buckets.maintenance.length}</Badge></TabsTrigger>
          <TabsTrigger value="paused">Paused <Badge variant="secondary" className="ml-2">{buckets.paused.length}</Badge></TabsTrigger>
          <TabsTrigger value="restricted">Restricted <Badge variant="secondary" className="ml-2">{buckets.restricted.length}</Badge></TabsTrigger>
        </TabsList>
        {(["all", "active", "maintenance", "paused", "restricted"] as const).map((k) => (
          <TabsContent key={k} value={k} className="mt-5">
            {isLoading ? (
              <div className="h-40 animate-pulse rounded-2xl border border-border/40 bg-card/30" />
            ) : buckets[k].length === 0 ? (
              <EmptyState icon={Building2} title="Nothing here" description="No cafés in this bucket yet." />
            ) : (
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {buckets[k].map((c, i) => <CafeAdminCard key={c.id} cafe={c} index={i} />)}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function CafeAdminCard({ cafe, index }: { cafe: CafeRow; index: number }) {
  const owner = cafe.profiles as { email?: string } | null;
  const qc = useQueryClient();
  const toggle = useServerFn(toggleCafeActive);
  const restrict = useServerFn(setCafeRestriction);
  const del = useServerFn(deleteCafe);
  const statsFn = useServerFn(cafeDeepStats);
  const [restrictOpen, setRestrictOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const stats = useQuery({
    queryKey: ["cafe-deep-stats", cafe.id],
    queryFn: () => statsFn({ data: { cafe_id: cafe.id } }),
    enabled: statsOpen,
  });
  const tM = useMutation({
    mutationFn: toggle,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-cafes"] }); qc.invalidateQueries({ queryKey: ["admin-overview"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const rM = useMutation({
    mutationFn: restrict,
    onSuccess: () => {
      toast.success("Restriction updated");
      qc.invalidateQueries({ queryKey: ["admin-cafes"] });
      setRestrictOpen(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const dM = useMutation({
    mutationFn: del,
    onSuccess: () => {
      toast.success("Café deleted");
      qc.invalidateQueries({ queryKey: ["admin-cafes"] });
      qc.invalidateQueries({ queryKey: ["admin-overview"] });
      setConfirmDelete(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const isRestricted = !!cafe.restricted_message;
  const maintWindow = {
    starts_at: cafe.maintenance_starts_at,
    ends_at: cafe.maintenance_ends_at,
    message: cafe.maintenance_message,
  };
  const inMaintenance = isMaintenanceActive(maintWindow);

  const consolePages = [
    { to: "/cafe/$slug", label: "Overview", icon: LayoutDashboard },
    { to: "/cafe/$slug/devices", label: "Devices", icon: Cpu },
    { to: "/cafe/$slug/floor", label: "Floor map", icon: MapIcon },
    { to: "/cafe/$slug/bookings", label: "Bookings", icon: CalendarClock },
    { to: "/cafe/$slug/customers", label: "Customers", icon: UsersIcon },
    { to: "/cafe/$slug/pos", label: "POS", icon: ShoppingBag },
    { to: "/cafe/$slug/ledger", label: "Ledger", icon: Receipt },
    { to: "/cafe/$slug/wallet", label: "Wallet", icon: Wallet },
    { to: "/cafe/$slug/menu", label: "Menu", icon: Utensils },
    { to: "/cafe/$slug/memberships", label: "Memberships", icon: BadgePercent },
    { to: "/cafe/$slug/tournaments", label: "Tournaments", icon: Trophy },
    { to: "/cafe/$slug/staff", label: "Staff", icon: UserCog },
    { to: "/cafe/$slug/page", label: "Public page", icon: FileEdit },
  ] as const;


  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }}
      className={`group relative overflow-hidden rounded-2xl border bg-card/40 p-5 backdrop-blur hover-lift ${
        isRestricted ? "border-destructive/50 hover:border-destructive" :
        inMaintenance ? "border-amber-500/50 hover:border-amber-400" :
        "border-border/60 hover:border-primary/40"
      }`}
    >
      <div className={`absolute -right-8 -top-8 h-32 w-32 rounded-full blur-2xl ${
        isRestricted ? "bg-destructive/20" : inMaintenance ? "bg-amber-500/20" : "bg-violet/20"
      }`} />
      <div className="relative flex items-start justify-between gap-3">
        <Link to="/cafe/$slug" params={{ slug: cafe.slug }} className="block min-w-0">
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{cafe.city ?? "—"}</div>
          <h3 className="mt-1 truncate font-display text-lg font-bold">{cafe.name}</h3>
          <div className="mt-1 font-mono text-xs text-azure">/{cafe.slug}</div>
        </Link>
        <div className="flex flex-col items-end gap-1.5">
          <Badge variant={cafe.is_active ? "default" : "secondary"}>{cafe.is_active ? "Live" : "Off"}</Badge>
          {inMaintenance && <Badge className="gap-1 bg-amber-500/20 text-amber-200 hover:bg-amber-500/30">Maintenance</Badge>}
          {isRestricted && <Badge variant="destructive" className="gap-1"><Lock className="h-3 w-3" /> Restricted</Badge>}
        </div>
      </div>
      {isRestricted && (
        <p className="relative mt-3 line-clamp-2 rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-foreground/80">
          “{cafe.restricted_message}”
        </p>
      )}
      {inMaintenance && cafe.maintenance_message && (
        <p className="relative mt-3 line-clamp-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-xs text-foreground/80">
          “{cafe.maintenance_message}”
        </p>
      )}
      <div className="relative mt-4 flex flex-wrap items-end justify-between gap-2">
        <div className="min-w-0 text-xs text-muted-foreground">
          Owner: <span className="truncate text-foreground">{owner?.email ?? "—"}</span>
        </div>
        <div className="flex flex-wrap shrink-0 gap-1">
          <Button
            size="sm" variant="ghost"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); tM.mutate({ data: { id: cafe.id, is_active: !cafe.is_active } }); }}
            className="h-7 gap-1 text-xs"
            title={cafe.is_active ? "Pause" : "Resume"}
          >
            {cafe.is_active ? <PowerOff className="h-3 w-3" /> : <Power className="h-3 w-3" />}
            {cafe.is_active ? "Pause" : "Resume"}
          </Button>
          <MaintenanceScheduler
            scope={{ kind: "cafe", cafeId: cafe.id, cafeName: cafe.name }}
            current={maintWindow}
            onSaved={() => qc.invalidateQueries({ queryKey: ["admin-cafes"] })}
            trigger={
              <Button size="sm" variant="ghost" className={`h-7 gap-1 text-xs ${inMaintenance ? "text-amber-300" : ""}`}>
                <Wrench className="h-3 w-3" /> Maintenance
              </Button>
            }
          />
          <Button
            size="sm" variant="ghost"
            onClick={(e) => {
              e.preventDefault(); e.stopPropagation();
              if (isRestricted) rM.mutate({ data: { id: cafe.id, restricted_message: null } });
              else setRestrictOpen(true);
            }}
            className={`h-7 gap-1 text-xs ${isRestricted ? "text-emerald-400" : "text-destructive"}`}
          >
            {isRestricted ? <Unlock className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
            {isRestricted ? "Unlock" : "Restrict"}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Jump into café console
              </DropdownMenuLabel>
              {consolePages.map((p) => (
                <DropdownMenuItem key={p.to} asChild>
                  <Link to={p.to} params={{ slug: cafe.slug }} className="flex items-center gap-2">
                    <p.icon className="h-3.5 w-3.5" /> {p.label}
                  </Link>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setStatsOpen(true)}>
                <BarChart3 className="mr-2 h-3.5 w-3.5" /> Deep stats
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href={`/c/${cafe.slug}`} target="_blank" rel="noreferrer" className="flex items-center gap-2">
                  <ExternalLink className="h-3.5 w-3.5" /> Open public page
                </a>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={() => setConfirmDelete(true)}
              >
                <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete café
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Deep stats dialog */}
      <Dialog open={statsOpen} onOpenChange={setStatsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><BarChart3 className="h-4 w-4" /> {cafe.name} — live stats</DialogTitle>
            <DialogDescription>Aggregated from the cafés database tables.</DialogDescription>
          </DialogHeader>
          {stats.isLoading || !stats.data ? (
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-card/60" />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 text-sm">
              <StatBox label="Devices" value={stats.data.devices} />
              <StatBox label="Customers" value={stats.data.customers} />
              <StatBox label="Staff" value={stats.data.staff} />
              <StatBox label="Sessions (all-time)" value={stats.data.sessionsTotal} />
              <StatBox label="Sessions today" value={stats.data.sessionsToday} />
              <StatBox label="Revenue today" value={`₹${stats.data.revenueToday.toLocaleString("en-IN")}`} />
              <StatBox label="Revenue (all)" value={`₹${stats.data.revenueAll.toLocaleString("en-IN")}`} className="col-span-2" />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive"><Trash2 className="h-4 w-4" /> Delete {cafe.name}?</DialogTitle>
            <DialogDescription>
              This permanently removes the café, all its devices, customers, sessions and history. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            <Button variant="destructive" disabled={dM.isPending} onClick={() => dM.mutate({ data: { id: cafe.id } })}>
              {dM.isPending ? "Deleting…" : "Delete forever"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      <Dialog open={restrictOpen} onOpenChange={setRestrictOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Lock className="h-4 w-4" /> Restrict {cafe.name}
            </DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const message = String(fd.get("message") || "").trim();
              if (!message) { toast.error("Add a reason — the owner will see it."); return; }
              rM.mutate({ data: { id: cafe.id, restricted_message: message } });
            }}
            className="space-y-3"
          >
            <p className="text-xs text-muted-foreground">
              The owner's portal will be locked and this message will be shown. Lift the restriction any time.
            </p>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Reason / message</Label>
              <Textarea name="message" rows={4} required defaultValue={cafe.restricted_message ?? ""} />
            </div>
            <DialogFooter>
              <Button type="submit" variant="destructive" disabled={rM.isPending}>
                {rM.isPending ? "Applying…" : "Restrict café"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

function Field({ name, label, placeholder, type = "text", required }: { name: string; label: string; placeholder?: string; type?: string; required?: boolean }) {
  return (
    <div className="space-y-1">
      <Label htmlFor={name}>{label}{required && <span className="text-destructive"> *</span>}</Label>
      <Input id={name} name={name} type={type} placeholder={placeholder} required={required} />
    </div>
  );
}

function StatBox({ label, value, className = "" }: { label: string; value: number | string; className?: string }) {
  return (
    <div className={`rounded-xl border border-border/60 bg-card/40 p-3 ${className}`}>
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-xl font-bold">{value}</div>
    </div>
  );
}

