import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Users, Search, X, UserPlus, MoreHorizontal, Trash2, KeyRound, Mail, Copy } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { searchUsers, grantRole, revokeRole, adminCreateUser, deleteUser, setUserPassword, generateRecoveryLink, userActivity } from "@/lib/admin.functions";
import { ExportButton } from "./admin.cafes";
import { Activity as ActivityIcon } from "lucide-react";


export const Route = createFileRoute("/_authenticated/admin/users")({
  component: UsersPanel,
});

const ROLES = ["super_admin", "cafe_owner", "cafe_staff", "customer"] as const;
type Role = typeof ROLES[number];

type UserRow = {
  id: string; full_name: string | null; email: string;
  user_roles?: Array<{ role: string; cafe_id: string | null }>;
};

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

  const users = (data ?? []) as UserRow[];

  const buckets = useMemo(() => {
    const has = (u: UserRow, r: Role) => (u.user_roles ?? []).some((x) => x.role === r);
    return {
      all: users,
      super_admin: users.filter((u) => has(u, "super_admin")),
      cafe_owner: users.filter((u) => has(u, "cafe_owner")),
      cafe_staff: users.filter((u) => has(u, "cafe_staff")),
      customer: users.filter((u) => (u.user_roles ?? []).length === 0 || has(u, "customer")),
    };
  }, [users]);

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-10"
            placeholder="Search by email or name…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") refetch(); }}
          />
        </div>
        <Button variant="outline" onClick={() => refetch()}>{isFetching ? "…" : "Search"}</Button>
        <ExportButton kind="users" />
        <CreateUserButton onCreated={refresh} />
      </div>

      <Tabs defaultValue="all" className="mt-4">
        <TabsList className="glass-strong rounded-2xl p-1">
          <TabsTrigger value="all">All <Badge variant="secondary" className="ml-2">{buckets.all.length}</Badge></TabsTrigger>
          <TabsTrigger value="super_admin">Super admins <Badge variant="secondary" className="ml-2">{buckets.super_admin.length}</Badge></TabsTrigger>
          <TabsTrigger value="cafe_owner">Café owners <Badge variant="secondary" className="ml-2">{buckets.cafe_owner.length}</Badge></TabsTrigger>
          <TabsTrigger value="cafe_staff">Staff <Badge variant="secondary" className="ml-2">{buckets.cafe_staff.length}</Badge></TabsTrigger>
          <TabsTrigger value="customer">Customers <Badge variant="secondary" className="ml-2">{buckets.customer.length}</Badge></TabsTrigger>
        </TabsList>
        {(Object.keys(buckets) as Array<keyof typeof buckets>).map((k) => (
          <TabsContent key={k} value={k} className="mt-4 space-y-2">
            {buckets[k].length === 0 ? (
              <EmptyState icon={Users} title="No users" description="Try a different search or category." />
            ) : buckets[k].map((u) => (
              <div key={u.id} className="rounded-2xl border border-border/60 bg-card/40 p-4 backdrop-blur">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium">{u.full_name || "—"}</div>
                    <div className="truncate font-mono text-xs text-muted-foreground">{u.email}</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {(u.user_roles ?? []).map((r, i) => (
                      <Badge key={i} variant="outline" className="gap-1.5">
                        {r.role}
                        <button
                          className="text-muted-foreground hover:text-destructive"
                          aria-label={`Revoke ${r.role}`}
                          onClick={async () => {
                            await revoke({ data: { user_id: u.id, role: r.role as Role, cafe_id: r.cafe_id } });
                            toast.success("Revoked");
                            refresh();
                          }}
                        ><X className="h-3 w-3" /></button>
                      </Badge>
                    ))}
                    <UserActions user={u} onChanged={refresh} />
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {ROLES.map((r) => (
                    <Button
                      key={r} size="sm" variant="ghost" className="h-7 text-xs"
                      onClick={async () => {
                        await grant({ data: { user_id: u.id, role: r } });
                        toast.success(`Granted ${r}`);
                        refresh();
                      }}
                    >+ {r}</Button>
                  ))}
                </div>
              </div>
            ))}

          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function CreateUserButton({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const create = useServerFn(adminCreateUser);
  const m = useMutation({
    mutationFn: create,
    onSuccess: () => {
      toast.success("User created");
      onCreated();
      setOpen(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2 text-primary-foreground" style={{ background: "var(--gradient-brand-hot)" }}>
          <UserPlus className="h-4 w-4" /> Create user
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Create a new user</DialogTitle></DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const mode = String(fd.get("mode"));
            const password = String(fd.get("password") || "");
            m.mutate({
              data: {
                email: String(fd.get("email")),
                full_name: String(fd.get("full_name") || "") || null,
                role: (String(fd.get("role")) || "customer") as "super_admin" | "cafe_owner" | "cafe_staff" | "customer",
                password: mode === "password" ? password : null,
                send_invite: mode === "invite",
              },
            });
          }}
          className="space-y-3"
        >
          <div className="space-y-1"><Label>Full name</Label><Input name="full_name" placeholder="Jane Doe" /></div>
          <div className="space-y-1"><Label>Email *</Label><Input name="email" type="email" required /></div>
          <div className="space-y-1">
            <Label>Role</Label>
            <select name="role" defaultValue="customer" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="customer">Customer</option>
              <option value="cafe_staff">Café staff</option>
              <option value="cafe_owner">Café owner</option>
              <option value="super_admin">Super admin</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label>How to onboard</Label>
            <select name="mode" defaultValue="password" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="password">Set a password now</option>
              <option value="invite">Send magic-link invite email</option>
            </select>
          </div>
          <div className="space-y-1"><Label>Password (if setting now)</Label><Input name="password" type="text" placeholder="min 8 chars" minLength={8} /></div>
          <DialogFooter>
            <Button type="submit" disabled={m.isPending} className="gap-2" style={{ background: "var(--gradient-brand-hot)" }}>
              {m.isPending ? "Creating…" : "Create user"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function UserActions({ user, onChanged }: { user: UserRow; onChanged: () => void }) {
  const [pwOpen, setPwOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [actOpen, setActOpen] = useState(false);
  const [recovery, setRecovery] = useState<string | null>(null);
  const delFn = useServerFn(deleteUser);
  const pwFn = useServerFn(setUserPassword);
  const recFn = useServerFn(generateRecoveryLink);
  const actFn = useServerFn(userActivity);

  const dM = useMutation({
    mutationFn: delFn,
    onSuccess: () => { toast.success("User deleted"); onChanged(); setDelOpen(false); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const pM = useMutation({
    mutationFn: pwFn,
    onSuccess: () => { toast.success("Password updated"); setPwOpen(false); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const rM = useMutation({
    mutationFn: recFn,
    onSuccess: (res) => { setRecovery(res?.url ?? null); setLinkOpen(true); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const aQ = useQuery({
    queryKey: ["user-activity", user.id],
    queryFn: () => actFn({ data: { user_id: user.id } }),
    enabled: actOpen,
  });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0"><MoreHorizontal className="h-3.5 w-3.5" /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onSelect={() => setActOpen(true)}>
            <ActivityIcon className="mr-2 h-3.5 w-3.5" /> View activity
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setPwOpen(true)}>
            <KeyRound className="mr-2 h-3.5 w-3.5" /> Set password
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => rM.mutate({ data: { email: user.email } })} disabled={rM.isPending}>
            <Mail className="mr-2 h-3.5 w-3.5" /> {rM.isPending ? "Generating…" : "Generate recovery link"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setDelOpen(true)}>
            <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete user
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={pwOpen} onOpenChange={setPwOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><KeyRound className="h-4 w-4" /> Set password</DialogTitle>
            <DialogDescription className="truncate">{user.email}</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const password = String(fd.get("password") || "");
              if (password.length < 8) { toast.error("Min 8 characters"); return; }
              pM.mutate({ data: { user_id: user.id, password } });
            }}
            className="space-y-3"
          >
            <Input name="password" type="text" placeholder="New password" minLength={8} required />
            <DialogFooter>
              <Button type="submit" disabled={pM.isPending}>{pM.isPending ? "Saving…" : "Save password"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={delOpen} onOpenChange={setDelOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive"><Trash2 className="h-4 w-4" /> Delete user?</DialogTitle>
            <DialogDescription>
              This permanently removes <span className="font-mono">{user.email}</span> and all their roles. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDelOpen(false)}>Cancel</Button>
            <Button variant="destructive" disabled={dM.isPending} onClick={() => dM.mutate({ data: { user_id: user.id } })}>
              {dM.isPending ? "Deleting…" : "Delete forever"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Mail className="h-4 w-4" /> Recovery link</DialogTitle>
            <DialogDescription>Send this one-time link to {user.email}. It lets them set a new password.</DialogDescription>
          </DialogHeader>
          {recovery ? (
            <div className="flex items-center gap-2">
              <Input readOnly value={recovery} className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
              <Button size="icon" variant="outline" onClick={async () => {
                await navigator.clipboard.writeText(recovery);
                toast.success("Copied");
              }}><Copy className="h-4 w-4" /></Button>
            </div>
          ) : <div className="text-sm text-muted-foreground">No link generated.</div>}
        </DialogContent>
      </Dialog>

      <Dialog open={actOpen} onOpenChange={setActOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ActivityIcon className="h-4 w-4" /> Activity</DialogTitle>
            <DialogDescription className="truncate">{user.email}</DialogDescription>
          </DialogHeader>
          {aQ.isLoading || !aQ.data ? (
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-card/60" />)}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                {Object.entries((aQ.data.summary ?? {}) as Record<string, number>).map(([k, v]) => (
                  <div key={k} className="rounded-xl border border-border/60 bg-card/40 p-3">
                    <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{k.replace(/_/g, " ")}</div>
                    <div className="mt-1 font-display text-lg font-bold">{typeof v === "number" ? v.toLocaleString("en-IN") : String(v)}</div>
                  </div>
                ))}
              </div>
              <div>
                <div className="mt-3 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Recent audit</div>
                <div className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-border/40">
                  {(aQ.data.audit ?? []).length === 0 ? (
                    <div className="p-3 text-xs text-muted-foreground">No audit events.</div>
                  ) : (aQ.data.audit ?? []).map((r) => (
                    <div key={r.id} className="flex items-center justify-between border-b border-border/30 px-3 py-1.5 text-xs last:border-0">
                      <div className="font-mono text-azure">{new Date(r.created_at).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</div>
                      <div className="font-mono">{r.action}</div>
                      <div className="text-muted-foreground">{(r.cafes as { name?: string } | null)?.name ?? "—"}</div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

