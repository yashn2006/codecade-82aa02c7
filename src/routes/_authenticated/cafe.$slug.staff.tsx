import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import {
  ShieldCheck, Plus, Trash2, Mail, Sparkles, Activity, CalendarRange, Users as UsersIcon, Wallet, Check,
} from "lucide-react";
import { getCafeBySlug } from "@/lib/cafes.functions";
import { listStaff, inviteStaff, removeStaff } from "@/lib/staff.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/EmptyState";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/cafe/$slug/staff")({
  head: () => ({
    meta: [
      { title: "Staff — CoreCade" },
      { name: "description", content: "Invite staff, assign roles and shifts." },
      { property: "og:title", content: "Staff — CoreCade" },
      { property: "og:description", content: "Invite staff, assign roles and shifts." },
    ],
  }),
  component: StaffPage,
});

const PERMS = [
  { key: "sessions",  label: "Sessions",  icon: Activity,      hint: "Start, end, and control live stations." },
  { key: "bookings",  label: "Bookings",  icon: CalendarRange, hint: "Manage reservations and the day's schedule." },
  { key: "customers", label: "Customers", icon: UsersIcon,     hint: "Add, edit, and view customer records." },
  { key: "wallet",    label: "Wallet",    icon: Wallet,        hint: "Top-up wallets and approve refunds." },
] as const;
type PermKey = typeof PERMS[number]["key"];

function StaffPage() {
  const { slug } = Route.useParams();
  const getCafe = useServerFn(getCafeBySlug);
  const { data: cafe } = useQuery({ queryKey: ["cafe", slug], queryFn: () => getCafe({ data: { slug } }) });
  const cafeId = cafe?.id;
  const list = useServerFn(listStaff);
  const invite = useServerFn(inviteStaff);
  const remove = useServerFn(removeStaff);

  const q = useQuery({ queryKey: ["staff", cafeId], queryFn: () => list({ data: { cafe_id: cafeId! } }), enabled: !!cafeId });
  const qc = useQueryClient();
  const inviteM = useMutation({
    mutationFn: invite,
    onSuccess: () => { toast.success("Invite sent — they'll get an email."); qc.invalidateQueries({ queryKey: ["staff", cafeId] }); setOpen(false); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const removeM = useMutation({
    mutationFn: remove,
    onSuccess: () => { toast.success("Removed"); qc.invalidateQueries({ queryKey: ["staff", cafeId] }); },
  });
  const [open, setOpen] = useState(false);
  const [perms, setPerms] = useState<PermKey[]>(["sessions", "bookings"]);
  const [email, setEmail] = useState("");

  if (!cafeId) return <div className="h-40 animate-pulse rounded-2xl border border-border/40 bg-card/30" />;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Crew</div>
          <div className="text-sm text-muted-foreground">{q.data?.length ?? 0} staff member{(q.data?.length ?? 0) === 1 ? "" : "s"}</div>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 text-primary-foreground glow-magenta" style={{ background: "var(--gradient-brand-hot)" }}>
              <Plus className="h-4 w-4" /> Invite staff
            </Button>
          </DialogTrigger>
          <DialogContent className="overflow-hidden p-0 sm:max-w-2xl">
            <div className="grid gap-0 md:grid-cols-[240px_1fr]">
              {/* Left — explainer pane */}
              <div className="relative overflow-hidden border-b border-border bg-gradient-to-br from-magenta/15 via-card to-violet/15 p-6 md:border-b-0 md:border-r">
                <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-magenta/30 blur-3xl" />
                <div className="relative">
                  <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-magenta to-rose text-primary-foreground shadow-magenta">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div className="mt-4 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                    Role · cafe staff
                  </div>
                  <div className="mt-1 font-display text-lg font-bold leading-tight">
                    Trusted teammate, scoped permissions.
                  </div>
                  <ul className="mt-4 space-y-2 text-xs text-muted-foreground">
                    <li className="flex items-start gap-2"><Check className="mt-0.5 h-3 w-3 text-emerald-400 shrink-0" /> Access only what you grant</li>
                    <li className="flex items-start gap-2"><Check className="mt-0.5 h-3 w-3 text-emerald-400 shrink-0" /> Email invite — no shared passwords</li>
                    <li className="flex items-start gap-2"><Check className="mt-0.5 h-3 w-3 text-emerald-400 shrink-0" /> Revoke any time</li>
                  </ul>

                  {/* Live chips preview */}
                  <div className="mt-5">
                    <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground">Will get</div>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {perms.length === 0 ? (
                        <Badge variant="secondary" className="text-[10px]">view-only</Badge>
                      ) : perms.map((p) => (
                        <Badge key={p} variant="outline" className="text-[10px]">{p}</Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right — form */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  inviteM.mutate({ data: { cafe_id: cafeId, email, permissions: perms } });
                }}
                className="space-y-4 p-6"
              >
                <DialogHeader className="space-y-1">
                  <DialogTitle className="flex items-center gap-2 text-lg">
                    <Sparkles className="h-4 w-4 text-primary" /> Invite a staff member
                  </DialogTitle>
                  <p className="text-xs text-muted-foreground">They'll receive an email with a join link.</p>
                </DialogHeader>

                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="email"
                      required
                      placeholder="staff@example.com"
                      className="h-11 pl-10"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoFocus
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Permissions</Label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {PERMS.map((p) => {
                      const active = perms.includes(p.key);
                      const Icon = p.icon;
                      return (
                        <button
                          key={p.key}
                          type="button"
                          onClick={() => setPerms((cur) => active ? cur.filter((x) => x !== p.key) : [...cur, p.key])}
                          className={`group relative flex items-start gap-2.5 rounded-xl border p-3 text-left transition-all ${
                            active
                              ? "border-primary bg-primary/10 shadow-soft"
                              : "border-border bg-card hover:border-primary/40 hover:bg-secondary"
                          }`}
                        >
                          <div className={`grid h-7 w-7 shrink-0 place-items-center rounded-md transition ${active ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground group-hover:text-foreground"}`}>
                            <Icon className="h-3.5 w-3.5" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold">{p.label}</div>
                            <div className="text-[11px] leading-snug text-muted-foreground">{p.hint}</div>
                          </div>
                          {active && (
                            <motion.div
                              layoutId={`perm-check-${p.key}`}
                              className="absolute right-2 top-2 grid h-4 w-4 place-items-center rounded-full bg-primary text-primary-foreground"
                            >
                              <Check className="h-2.5 w-2.5" />
                            </motion.div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setPerms([])}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Clear all
                  </button>
                  <Button
                    type="submit"
                    disabled={inviteM.isPending}
                    className="gap-1.5 text-primary-foreground glow-magenta"
                    style={{ background: "var(--gradient-brand-hot)" }}
                  >
                    <Mail className="h-4 w-4" /> {inviteM.isPending ? "Sending…" : "Send invite"}
                  </Button>
                </div>
              </form>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mt-4">
        {q.isLoading ? (
          <div className="h-40 animate-pulse rounded-2xl border border-border/40 bg-card/30" />
        ) : (q.data?.length ?? 0) === 0 ? (
          <EmptyState icon={ShieldCheck} title="No staff yet" description="Invite trusted teammates to run the floor with you." />
        ) : (
          <div className="space-y-2">
            {(q.data ?? []).map((s, i) => {
              const prof = s.profiles as { email?: string; full_name?: string } | null;
              const sPerms = (s.permissions as string[]) ?? [];
              return (
                <motion.div
                  key={s.id}
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card/40 p-4 backdrop-blur hover:border-primary/40 transition"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary to-accent text-primary-foreground font-bold text-xs">
                      {(prof?.full_name?.[0] || prof?.email?.[0] || "?").toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate font-medium">{prof?.full_name || prof?.email || "—"}</div>
                      <div className="truncate font-mono text-xs text-muted-foreground"><Mail className="mr-1 inline h-3 w-3" />{prof?.email}</div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {sPerms.length === 0 ? (
                      <Badge variant="secondary">view-only</Badge>
                    ) : sPerms.map((p) => <Badge key={p} variant="outline">{p}</Badge>)}
                    <Button size="icon" variant="ghost" onClick={() => { if (confirm("Remove this staff member?")) removeM.mutate({ data: { cafe_id: cafeId, staff_user_id: s.staff_user_id } }); }}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
