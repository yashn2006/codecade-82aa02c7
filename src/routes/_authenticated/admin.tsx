import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import {
  Shield, Users, Building2, FileText, Activity, Plus, Search, Check, X,
} from "lucide-react";
import { ConsoleShell } from "@/components/ConsoleShell";
import { StatCard } from "@/components/StatCard";
import { EmptyState } from "@/components/EmptyState";
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
import { createCafe } from "@/lib/cafes.functions";

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
  const fn = useServerFn(adminOverview);
  const { data } = useQuery({ queryKey: ["admin-overview"], queryFn: () => fn(), refetchInterval: 15000 });
  const s = data ?? { cafes: 0, users: 0, activeSessions: 0, newLeads: 0 };
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard icon={Building2} label="Cafés" value={s.cafes} accent="violet" delay={0} />
      <StatCard icon={Users} label="Users" value={s.users} accent="azure" delay={0.05} />
      <StatCard icon={Activity} label="Active sessions" value={s.activeSessions} accent="magenta" delay={0.1} hint="Live" />
      <StatCard icon={FileText} label="New leads" value={s.newLeads} accent="violet" delay={0.15} />
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
            {data.map((c, i) => {
              const owner = c.profiles as { email?: string } | null;
              return (
                <motion.a
                  key={c.id}
                  href={`/cafe/${c.slug}`}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                  className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card/40 p-5 backdrop-blur hover-lift hover:border-primary/40"
                >
                  <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-violet/20 blur-2xl" />
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                        {c.city ?? "—"}
                      </div>
                      <h3 className="mt-1 font-display text-lg font-bold">{c.name}</h3>
                      <div className="mt-1 font-mono text-xs text-azure">/{c.slug}</div>
                    </div>
                    <Badge variant={c.is_active ? "default" : "secondary"}>
                      {c.is_active ? "Live" : "Off"}
                    </Badge>
                  </div>
                  <div className="mt-4 text-xs text-muted-foreground">
                    Owner: <span className="text-foreground">{owner?.email ?? "—"}</span>
                  </div>
                </motion.a>
              );
            })}
          </div>
        )}
      </div>
    </div>
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
