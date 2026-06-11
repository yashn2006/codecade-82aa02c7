import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import {
  Shield, Users, Building2, FileText, Activity, Plus, Search, Check, X, TrendingUp, Power, PowerOff, ArrowUpRight,
} from "lucide-react";
import { ConsoleShell } from "@/components/ConsoleShell";
import { StatCard } from "@/components/StatCard";
import { EmptyState } from "@/components/EmptyState";
import { Sparkline } from "@/components/Sparkline";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { adminOverview, listAllCafes, listContacts, setContactStatus, searchUsers, grantRole, revokeRole } from "@/lib/admin.functions";
import { createCafe, toggleCafeActive } from "@/lib/cafes.functions";
import { getNetworkAnalytics } from "@/lib/analytics.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Super Admin — CoreCade" }] }),
  component: Admin,
});

function Admin() {
  return (
    <ConsoleShell
      badge="Super Admin"
      title="Network command center"
      subtitle="Cafés, users, leads — the whole platform from one console."
      nav={[
        { label: "Overview", icon: Shield, to: "/admin", exact: true },
      ]}
    >
      <Tabs defaultValue="overview" className="mt-2">
        <TabsList className="glass-strong w-full justify-start overflow-x-auto rounded-2xl p-1">
          <TabsTrigger value="overview"><Activity className="mr-2 h-3.5 w-3.5" />Overview</TabsTrigger>
          <TabsTrigger value="cafes"><Building2 className="mr-2 h-3.5 w-3.5" />Cafés</TabsTrigger>
          <TabsTrigger value="users"><Users className="mr-2 h-3.5 w-3.5" />Users &amp; roles</TabsTrigger>
          <TabsTrigger value="leads"><FileText className="mr-2 h-3.5 w-3.5" />Leads</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6"><OverviewPanel /></TabsContent>
        <TabsContent value="cafes" className="mt-6"><CafesPanel /></TabsContent>
        <TabsContent value="users" className="mt-6"><UsersPanel /></TabsContent>
        <TabsContent value="leads" className="mt-6"><LeadsPanel /></TabsContent>
      </Tabs>
    </ConsoleShell>
  );
}

function OverviewPanel() {
  const ovFn = useServerFn(adminOverview);
  const anFn = useServerFn(getNetworkAnalytics);
  const ov = useQuery({ queryKey: ["admin-overview"], queryFn: () => ovFn(), refetchInterval: 15000 });
  const an = useQuery({ queryKey: ["admin-analytics"], queryFn: () => anFn(), refetchInterval: 15000 });
  const s = ov.data ?? { cafes: 0, users: 0, activeSessions: 0, newLeads: 0 };
  const a = an.data;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Building2} label="Cafés" value={s.cafes} accent="violet" delay={0} />
        <StatCard icon={Users} label="Users" value={s.users} accent="azure" delay={0.05} />
        <StatCard icon={Activity} label="Active sessions" value={s.activeSessions} accent="magenta" delay={0.1} hint="Live" />
        <StatCard icon={FileText} label="New leads" value={s.newLeads} accent="violet" delay={0.15} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        {/* Network revenue trend */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/40 p-5 backdrop-blur">
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-violet/30 blur-3xl" />
          <div className="relative flex items-start justify-between">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Network pulse · last 7 days</div>
              <div className="font-display text-2xl font-extrabold">Revenue trend</div>
            </div>
            <div className="text-right">
              <div className="flex items-center justify-end gap-1 font-mono text-[10px] text-azure"><TrendingUp className="h-3 w-3" /> TODAY</div>
              <div className="font-display text-2xl font-extrabold text-gradient">₹{(a?.revenueToday ?? 0).toLocaleString("en-IN")}</div>
              <div className="font-mono text-[10px] text-muted-foreground">{a?.sessionsToday ?? 0} sessions</div>
            </div>
          </div>
          <div className="relative mt-4">
            <Sparkline data={a?.weekSeries ?? []} accent="violet" height={96} />
          </div>
          <div className="relative mt-1 flex justify-between font-mono text-[10px] text-muted-foreground">
            {(a?.weekSeries ?? []).map((p) => (
              <span key={p.d}>{new Date(p.d).toLocaleDateString("en-IN", { weekday: "short" })}</span>
            ))}
          </div>
        </motion.div>

        {/* Latest cafés */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="rounded-2xl border border-border/60 bg-card/40 p-5 backdrop-blur">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Newest cafés</div>
          <div className="mt-1 font-display text-xl font-bold">On the network</div>
          <div className="mt-3 space-y-1.5">
            {(a?.newCafes ?? []).length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/40 p-6 text-center text-xs text-muted-foreground">No cafés yet.</div>
            ) : (a?.newCafes ?? []).map((c) => (
              <Link key={c.id} to="/cafe/$slug" params={{ slug: c.slug }} className="flex items-center justify-between rounded-xl border border-border/40 px-3 py-2 text-sm transition hover:border-primary/40 hover:bg-background/40">
                <div>
                  <div className="font-medium">{c.name}</div>
                  <div className="font-mono text-[10px] text-muted-foreground">{c.city ?? "—"} · /{c.slug}</div>
                </div>
                <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
              </Link>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Recent activity */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <div className="flex items-center justify-between">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Live feed</div>
            <h3 className="font-display text-xl font-bold">Recent sessions across the network</h3>
          </div>
        </div>
        <div className="mt-3 overflow-hidden rounded-2xl border border-border/60 bg-card/30 backdrop-blur">
          {(a?.recent ?? []).length === 0 ? (
            <EmptyState icon={Activity} title="No sessions yet" description="When cafés go live, you'll see their pulse here." />
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-border/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr><th className="p-3">When</th><th className="p-3">Café</th><th className="p-3">Device</th><th className="p-3">Customer</th><th className="p-3 text-right">Amount</th><th className="p-3">Status</th></tr>
              </thead>
              <tbody>
                {(a?.recent ?? []).map((s, i) => (
                  <motion.tr key={s.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }} className="border-b border-border/30 last:border-0">
                    <td className="p-3 font-mono text-xs text-azure">{new Date(s.started_at).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                    <td className="p-3">{(s.cafes as { name?: string } | null)?.name ?? "—"}</td>
                    <td className="p-3 font-mono text-xs">{(s.devices as { name?: string } | null)?.name ?? "—"}</td>
                    <td className="p-3">{(s.customers as { full_name?: string } | null)?.full_name ?? "Walk-in"}</td>
                    <td className="p-3 text-right font-mono">{s.amount != null ? `₹${s.amount}` : "—"}</td>
                    <td className="p-3"><Badge variant={s.status === "active" ? "default" : "outline"}>{s.status}</Badge></td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function CafesPanel() {
  const fn = useServerFn(listAllCafes);
  const { data, isLoading } = useQuery({ queryKey: ["admin-cafes"], queryFn: () => fn() });
  const qc = useQueryClient();
  const create = useServerFn(createCafe);
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
  const [open, setOpen] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">{data?.length ?? 0} cafés on network</div>
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

      <div className="mt-4">
        {isLoading ? (
          <div className="h-40 animate-pulse rounded-2xl border border-border/40 bg-card/30" />
        ) : !data || data.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="No cafés yet"
            description="Onboard your first café to start the network."
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {data.map((c, i) => <CafeAdminCard key={c.id} cafe={c} index={i} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function CafeAdminCard({ cafe, index }: { cafe: { id: string; slug: string; name: string; city: string | null; is_active: boolean; profiles: unknown }; index: number }) {
  const owner = cafe.profiles as { email?: string } | null;
  const qc = useQueryClient();
  const toggle = useServerFn(toggleCafeActive);
  const tM = useMutation({
    mutationFn: toggle,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-cafes"] }); qc.invalidateQueries({ queryKey: ["admin-overview"] }); },
  });
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }}
      className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card/40 p-5 backdrop-blur hover-lift hover:border-primary/40"
    >
      <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-violet/20 blur-2xl" />
      <div className="relative flex items-start justify-between">
        <Link to="/cafe/$slug" params={{ slug: cafe.slug }} className="block">
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{cafe.city ?? "—"}</div>
          <h3 className="mt-1 font-display text-lg font-bold">{cafe.name}</h3>
          <div className="mt-1 font-mono text-xs text-azure">/{cafe.slug}</div>
        </Link>
        <Badge variant={cafe.is_active ? "default" : "secondary"}>{cafe.is_active ? "Live" : "Off"}</Badge>
      </div>
      <div className="relative mt-4 flex items-end justify-between">
        <div className="text-xs text-muted-foreground">
          Owner: <span className="text-foreground">{owner?.email ?? "—"}</span>
        </div>
        <Button
          size="sm" variant="ghost"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); tM.mutate({ data: { id: cafe.id, is_active: !cafe.is_active } }); }}
          className="gap-1.5"
        >
          {cafe.is_active ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
          {cafe.is_active ? "Pause" : "Resume"}
        </Button>
      </div>
    </motion.div>
  );
}

function UsersPanel() {
  const [q, setQ] = useState("");
  const fn = useServerFn(searchUsers);
  const { data, refetch, isFetching } = useQuery({
    queryKey: ["admin-users", q],
    queryFn: () => fn({ data: { q } }),
  });
  const grant = useServerFn(grantRole);
  const revoke = useServerFn(revokeRole);
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-users"] });

  const roles = ["super_admin", "cafe_owner", "cafe_staff", "customer"] as const;

  return (
    <div>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-10" placeholder="Search by email…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Button variant="outline" onClick={() => refetch()}>{isFetching ? "…" : "Search"}</Button>
      </div>
      <div className="mt-4 space-y-2">
        {(data ?? []).map((u) => {
          const userRoles = (u.user_roles as Array<{ role: string; cafe_id: string | null }>) ?? [];
          return (
            <div key={u.id} className="rounded-2xl border border-border/60 bg-card/40 p-4 backdrop-blur">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-medium">{u.full_name || "—"}</div>
                  <div className="font-mono text-xs text-muted-foreground">{u.email}</div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {userRoles.map((r, i) => (
                    <Badge key={i} variant="outline" className="gap-1.5">
                      {r.role}
                      <button
                        className="text-muted-foreground hover:text-destructive"
                        onClick={async () => {
                          await revoke({ data: { user_id: u.id, role: r.role as typeof roles[number], cafe_id: r.cafe_id } });
                          toast.success("Revoked");
                          refresh();
                        }}
                      ><X className="h-3 w-3" /></button>
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {roles.map((r) => (
                  <Button
                    key={r} size="sm" variant="ghost"
                    className="h-7 text-xs"
                    onClick={async () => {
                      await grant({ data: { user_id: u.id, role: r } });
                      toast.success(`Granted ${r}`);
                      refresh();
                    }}
                  >+ {r}</Button>
                ))}
              </div>
            </div>
          );
        })}
        {(data?.length ?? 0) === 0 && (
          <EmptyState icon={Users} title="No users found" description="Try a different email." />
        )}
      </div>
    </div>
  );
}

function LeadsPanel() {
  const fn = useServerFn(listContacts);
  const set = useServerFn(setContactStatus);
  const { data } = useQuery({ queryKey: ["admin-leads"], queryFn: () => fn() });
  const qc = useQueryClient();
  return (
    <div className="space-y-2">
      {(data ?? []).map((c) => (
        <div key={c.id} className="rounded-2xl border border-border/60 bg-card/40 p-4 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="font-medium">{c.name}</div>
              <div className="font-mono text-xs text-muted-foreground">{c.email}{c.phone ? ` · ${c.phone}` : ""}</div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={c.status === "new" ? "default" : "secondary"}>{c.status}</Badge>
              {c.status === "new" && (
                <Button size="sm" variant="outline" className="h-7 gap-1.5"
                  onClick={async () => {
                    await set({ data: { id: c.id, status: "resolved" } });
                    qc.invalidateQueries({ queryKey: ["admin-leads"] });
                  }}
                ><Check className="h-3 w-3" /> Resolve</Button>
              )}
            </div>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{c.message}</p>
        </div>
      ))}
      {(data?.length ?? 0) === 0 && (
        <EmptyState icon={FileText} title="Inbox zero" description="No new leads. The landing form will deliver them here." />
      )}
    </div>
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
