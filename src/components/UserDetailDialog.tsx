import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { userDetail, setUserBan } from "@/lib/admin.functions";
import { toast } from "sonner";
import { Shield, ShieldOff, Copy, Fingerprint, Mail, Phone, KeySquare, Clock, Building2, History } from "lucide-react";

type Props = { userId: string | null; open: boolean; onOpenChange: (v: boolean) => void; onChanged?: () => void };

function fmt(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function UserDetailDialog({ userId, open, onOpenChange, onChanged }: Props) {
  const fn = useServerFn(userDetail);
  const ban = useServerFn(setUserBan);
  const q = useQuery({
    queryKey: ["user-detail", userId],
    queryFn: () => fn({ data: { user_id: userId! } }),
    enabled: open && !!userId,
  });
  const d = q.data;
  const a = d?.auth ?? null;
  const isBanned = a?.banned_until ? new Date(a.banned_until).getTime() > Date.now() : false;

  async function applyBan(duration: "none" | "1h" | "24h" | "7d" | "30d" | "permanent") {
    if (!userId) return;
    try {
      await ban({ data: { user_id: userId, duration } });
      toast.success(duration === "none" ? "User unrestricted" : `Restricted (${duration})`);
      q.refetch();
      onChanged?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text).then(() => toast.success("Copied"));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Fingerprint className="h-4 w-4" />
            {a?.email ?? d?.profile?.email ?? "User"}
            {isBanned && <Badge variant="destructive" className="ml-2">Restricted</Badge>}
            {a?.email_confirmed_at && <Badge variant="outline" className="ml-1">Email verified</Badge>}
          </DialogTitle>
          <DialogDescription className="font-mono text-[11px] break-all">
            {userId}
            {userId && <button className="ml-1.5 inline-flex" onClick={() => copy(userId)}><Copy className="h-3 w-3" /></button>}
          </DialogDescription>
        </DialogHeader>

        {q.isLoading || !d ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-card/60" />)}
          </div>
        ) : (
          <Tabs defaultValue="overview">
            <TabsList className="glass-strong rounded-2xl p-1">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="auth">Auth & identities</TabsTrigger>
              <TabsTrigger value="cafes">Cafés & roles</TabsTrigger>
              <TabsTrigger value="audit">Audit trail</TabsTrigger>
              <TabsTrigger value="moderation">Moderation</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-3 space-y-3">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Stat icon={Mail} label="Email" value={a?.email ?? "—"} mono />
                <Stat icon={Phone} label="Phone" value={a?.phone ?? "—"} mono />
                <Stat icon={Clock} label="Joined" value={fmt(a?.created_at)} />
                <Stat icon={Clock} label="Last sign-in" value={fmt(a?.last_sign_in_at)} />
                <Stat icon={KeySquare} label="Providers" value={(a?.identities ?? []).map((i) => i.provider).join(", ") || "email"} />
                <Stat icon={Shield} label="Roles" value={(d.roles ?? []).map((r) => r.role).join(", ") || "—"} />
              </div>
              {a?.banned_until && (
                <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                  Restricted until {fmt(a.banned_until)}
                </div>
              )}
            </TabsContent>

            <TabsContent value="auth" className="mt-3 space-y-3">
              <Section title="auth.users record">
                <pre className="overflow-auto rounded-xl border border-border/50 bg-background/40 p-3 font-mono text-[11px]">
{JSON.stringify(a, null, 2)}
                </pre>
              </Section>
              <Section title="Linked identities">
                {(a?.identities ?? []).length === 0 ? <Empty>None.</Empty> : (a?.identities ?? []).map((i, idx) => (
                  <div key={idx} className="rounded-xl border border-border/50 bg-card/40 p-3 text-sm">
                    <div className="flex flex-wrap justify-between gap-2">
                      <div className="font-medium capitalize">{i.provider}</div>
                      <div className="font-mono text-xs text-muted-foreground">{i.email ?? "—"}</div>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">Linked {fmt(i.created_at)} · last sign-in {fmt(i.last_sign_in_at)}</div>
                  </div>
                ))}
              </Section>
            </TabsContent>

            <TabsContent value="cafes" className="mt-3 space-y-3">
              <Section title="Owned cafés">
                {d.ownedCafes.length === 0 ? <Empty>No cafés owned.</Empty> : d.ownedCafes.map((c) => (
                  <div key={c.id} className="flex items-center justify-between rounded-xl border border-border/50 bg-card/40 p-3 text-sm">
                    <div className="flex items-center gap-2"><Building2 className="h-4 w-4 text-primary" /><span className="font-medium">{c.name}</span><span className="text-xs text-muted-foreground">/{c.slug}</span></div>
                    <Badge variant={c.is_active ? "default" : "outline"}>{c.is_active ? "active" : "paused"}</Badge>
                  </div>
                ))}
              </Section>
              <Section title="All role grants">
                {d.roles.length === 0 ? <Empty>No role grants.</Empty> : d.roles.map((r, i) => (
                  <div key={i} className="flex items-center justify-between rounded-xl border border-border/50 bg-card/40 p-3 text-sm">
                    <div className="font-mono">{r.role}</div>
                    <div className="text-xs text-muted-foreground">{(r.cafes as { name?: string } | null)?.name ?? "platform-wide"}</div>
                  </div>
                ))}
              </Section>
            </TabsContent>

            <TabsContent value="audit" className="mt-3">
              <Section title="Recent actions (latest 40)">
                {d.audit.length === 0 ? <Empty>No recorded actions.</Empty> : (
                  <div className="max-h-96 overflow-y-auto rounded-xl border border-border/40">
                    {d.audit.map((r) => (
                      <div key={r.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-border/30 px-3 py-2 text-xs last:border-0">
                        <div className="font-mono text-azure">{fmt(r.created_at)}</div>
                        <div className="font-mono">{r.action} <span className="text-muted-foreground">· {r.resource_type ?? "—"}</span></div>
                        <div className="text-muted-foreground">{(r.cafes as { name?: string } | null)?.name ?? "—"}</div>
                      </div>
                    ))}
                  </div>
                )}
              </Section>
            </TabsContent>

            <TabsContent value="moderation" className="mt-3 space-y-3">
              <div className="rounded-2xl border border-border/60 bg-card/40 p-4">
                <div className="flex items-center gap-2 font-medium"><Shield className="h-4 w-4" /> Restrict access</div>
                <p className="mt-1 text-xs text-muted-foreground">A restricted user cannot sign in until the period ends. Their data is preserved.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(["1h", "24h", "7d", "30d", "permanent"] as const).map((dur) => (
                    <Button key={dur} size="sm" variant="outline" onClick={() => applyBan(dur)}>{dur}</Button>
                  ))}
                  <Button size="sm" variant="secondary" className="gap-1" onClick={() => applyBan("none")}>
                    <ShieldOff className="h-3.5 w-3.5" /> Lift restriction
                  </Button>
                </div>
              </div>
              <div className="rounded-2xl border border-border/60 bg-card/40 p-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-2 font-medium text-foreground"><History className="h-4 w-4" /> Tip</div>
                Use "Set password" or "Generate recovery link" from the user row menu to help a locked-out user regain access.
              </div>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Stat({ icon: Icon, label, value, mono }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/40 p-3">
      <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground"><Icon className="h-3 w-3" /> {label}</div>
      <div className={`mt-1 truncate text-sm ${mono ? "font-mono" : ""}`} title={value}>{value}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{title}</div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-dashed border-border/40 p-3 text-xs text-muted-foreground">{children}</div>;
}
