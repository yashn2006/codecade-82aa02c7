import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import {
  ShieldCheck, Plus, Trash2, Mail, Activity, CalendarRange, Users as UsersIcon, Wallet,
  Check, StopCircle, Receipt, TrendingUp, UtensilsCrossed, Monitor, KeyRound, Copy,
  MessageCircle, AlertTriangle, Lock, Power, User,
} from "lucide-react";
import { getCafeBySlug } from "@/lib/cafes.functions";
import {
  listStaff, inviteStaff, removeStaff, updateStaffPermissions,
  createStaffWithPin, resetStaffPin, setStaffActive,
  STAFF_PERMS, STAFF_PERM_META, type StaffPerm,
} from "@/lib/staff.functions";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/EmptyState";
import { QueryBoundary } from "@/components/QueryBoundary";
import { CafeAccessGuard } from "@/hooks/useCafeAccess";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { ConfirmModal } from "@/components/ConfirmDialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/cafe/$slug/staff")({
  head: () => ({
    meta: [
      { title: "Staff — CoreCade" },
      { name: "description", content: "Create PIN-based floor logins, manage staff permissions, and send invites." },
      { property: "og:title", content: "Staff — CoreCade" },
      { property: "og:description", content: "Create PIN-based floor logins, manage staff permissions, and send invites." },
    ],
  }),
  component: StaffPage,
});

const PERM_ICONS: Record<StaffPerm, typeof Activity> = {
  start_sessions: Activity,
  end_sessions: StopCircle,
  create_bookings: CalendarRange,
  register_customers: UsersIcon,
  manage_wallet: Wallet,
  generate_bills: Receipt,
  view_revenue: TrendingUp,
  manage_menu: UtensilsCrossed,
  manage_devices: Monitor,
};

const COUNTER_STAFF_PRESET: StaffPerm[] = [
  "start_sessions",
  "end_sessions",
  "create_bookings",
  "register_customers",
  "generate_bills",
];

const MANAGER_PRESET: StaffPerm[] = [...STAFF_PERMS];

type OneTimeCredentials = {
  title: string;
  displayName: string;
  username?: string | null;
  cafeCode: string;
  pin: string;
};

type StaffRow = {
  id: string;
  staff_user_id: string;
  permissions: unknown;
  username?: string | null;
  login_email?: string | null;
  display_name?: string | null;
  must_change_pin?: boolean | null;
  failed_attempts?: number | null;
  locked_until?: string | null;
  is_active?: boolean | null;
  last_seen_at?: string | null;
  created_at: string;
  profiles: { email?: string; full_name?: string } | null;
};

function isSyntheticEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.endsWith("@staff.corecade.invalid") || email.endsWith("@staff.corecade.example");
}

function formatLastSeen(iso: string | null | undefined): string {
  if (!iso) return "Never signed in";
  const diffMs = Date.now() - new Date(iso).getTime();
  if (diffMs < 5 * 60 * 1000) return "Online now";
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function StaffPage() {
  const { slug } = Route.useParams();
  const getCafe = useServerFn(getCafeBySlug);
  const cafeQ = useQuery({ queryKey: ["cafe", slug], queryFn: () => getCafe({ data: { slug } }) });
  const cafe = cafeQ.data as ({ id?: string } | undefined);
  if (cafeQ.isError || !cafe?.id) {
    return (
      <QueryBoundary queries={[cafeQ]} loading={!cafeQ.isError && !cafe?.id} errorTitle="Couldn't load staff">
        {null}
      </QueryBoundary>
    );
  }
  return (
    <CafeAccessGuard cafeId={cafe.id} slug={slug} requireOwner>
      <StaffPageContent />
    </CafeAccessGuard>
  );
}

function StaffPageContent() {
  const { slug } = Route.useParams();
  const getCafe = useServerFn(getCafeBySlug);
  const cafeQ = useQuery({ queryKey: ["cafe", slug], queryFn: () => getCafe({ data: { slug } }) });
  const cafe = cafeQ.data as ({ id: string; name?: string; staff_code?: string | null } | undefined);
  const cafeId = cafe?.id;
  const staffCode = cafe?.staff_code ?? "";

  const listFn = useServerFn(listStaff);
  const inviteFn = useServerFn(inviteStaff);
  const createPinFn = useServerFn(createStaffWithPin);
  const resetPinFn = useServerFn(resetStaffPin);
  const setActiveFn = useServerFn(setStaffActive);
  const removeFn = useServerFn(removeStaff);
  const updatePFn = useServerFn(updateStaffPermissions);

  const q = useQuery({
    queryKey: ["staff", cafeId],
    queryFn: () => listFn({ data: { cafe_id: cafeId! } }),
    enabled: !!cafeId,
  });
  const qc = useQueryClient();

  const [addOpen, setAddOpen] = useState(false);
  const [addTab, setAddTab] = useState<"pin" | "email">("pin");
  const [perms, setPerms] = useState<StaffPerm[]>(COUNTER_STAFF_PRESET);

  // PIN tab state
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);

  // Email invite tab state
  const [email, setEmail] = useState("");
  const [emailConfirming, setEmailConfirming] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailSuccess, setEmailSuccess] = useState<string | null>(null);

  // One-time credential modal state (after create or reset PIN)
  const [credentials, setCredentials] = useState<OneTimeCredentials | null>(null);

  // Remove confirm state
  const [removeTarget, setRemoveTarget] = useState<{ staffUserId: string; label: string } | null>(null);

  const resetAddForm = () => {
    setDisplayName("");
    setUsername("");
    setPinError(null);
    setEmail("");
    setEmailConfirming(false);
    setEmailError(null);
    setEmailSuccess(null);
    setPerms(COUNTER_STAFF_PRESET);
  };

  const createPinM = useMutation({
    mutationFn: createPinFn,
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["staff", cafeId] });
      setAddOpen(false);
      resetAddForm();
      setCredentials({
        title: "Staff PIN created",
        displayName: res.display_name,
        username: res.username,
        cafeCode: res.cafe_code || staffCode,
        pin: res.pin,
      });
      toast.success(`Created @${res.username}`);
    },
    onError: (e) => {
      const msg = e instanceof Error ? e.message : "Failed to create staff";
      setPinError(msg);
      toast.error(msg);
    },
  });

  const inviteM = useMutation({
    mutationFn: inviteFn,
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["staff", cafeId] });
      const msg = (res as { alreadyRegistered?: boolean })?.alreadyRegistered
        ? `Access granted to ${email.trim().toLowerCase()} — they can sign in with their existing CoreCade account.`
        : `Invite email sent to ${email.trim().toLowerCase()} — they'll land on /reset-password to set a password.`;
      setEmailSuccess(msg);
      setEmailConfirming(false);
      setEmailError(null);
      setEmail("");
      toast.success("Staff invite processed");
    },
    onError: (e) => {
      const msg = e instanceof Error ? e.message : "Failed to send invite";
      setEmailError(msg);
      setEmailConfirming(false);
      toast.error(msg);
    },
  });

  const resetPinM = useMutation({
    mutationFn: (vars: { cafe_id: string; staff_user_id: string }) => resetPinFn({ data: vars }),
    onSuccess: (res, vars) => {
      qc.invalidateQueries({ queryKey: ["staff", cafeId] });
      const rows = (q.data ?? []) as StaffRow[];
      const target = rows.find((r) => r.staff_user_id === vars.staff_user_id);
      const prof = target?.profiles;
      setCredentials({
        title: "PIN reset — new temporary PIN",
        displayName: target?.display_name || prof?.full_name || target?.username || "Staff member",
        username: target?.username ?? null,
        cafeCode: staffCode,
        pin: res.pin,
      });
      toast.success("PIN reset and account unlocked");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to reset PIN"),
  });

  const activeM = useMutation({
    mutationFn: setActiveFn,
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["staff", cafeId] });
      toast.success(res.is_active ? "Staff account activated" : "Staff account deactivated");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to update status"),
  });

  const removeM = useMutation({
    mutationFn: removeFn,
    onSuccess: () => {
      toast.success("Staff removed");
      qc.invalidateQueries({ queryKey: ["staff", cafeId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to remove"),
  });

  const updateM = useMutation({
    mutationFn: updatePFn,
    onSuccess: () => {
      toast.success("Permissions updated");
      qc.invalidateQueries({ queryKey: ["staff", cafeId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to update permissions"),
  });

  if (cafeQ.isError || !cafeId) {
    return (
      <QueryBoundary queries={[cafeQ]} loading={!cafeQ.isError && !cafeId} errorTitle="Couldn't load staff">
        {null}
      </QueryBoundary>
    );
  }

  const copyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Could not copy to clipboard");
    }
  };

  const loginUrl = typeof window !== "undefined" ? `${window.location.origin}/staff-login` : "/staff-login";

  const buildShareText = (c: OneTimeCredentials) => {
    return [
      `CoreCade Staff Login — ${cafe?.name ?? "Café"}`,
      `Login page: ${loginUrl}`,
      c.cafeCode ? `Café code: ${c.cafeCode}` : null,
      c.username ? `Username: ${c.username}` : null,
      `Temporary PIN: ${c.pin}`,
      `(You'll be asked to pick a new 6-digit PIN on first login.)`,
    ]
      .filter(Boolean)
      .join("\n");
  };

  const staffRows = (q.data ?? []) as StaffRow[];

  return (
    <div className="space-y-6">
      {/* Café code banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-primary/25 bg-gradient-to-r from-primary/10 via-card/70 to-accent/10 p-4 backdrop-blur">
        <div className="min-w-0 space-y-1">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary">
            Staff Portal Café Code
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="rounded-lg border border-border/70 bg-background/80 px-3 py-1 font-mono text-lg font-extrabold tracking-[0.25em] text-foreground">
              {staffCode || "------"}
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!staffCode}
              onClick={() => copyText(staffCode, "Café code")}
              className="gap-1.5"
            >
              <Copy className="h-3.5 w-3.5" /> Copy code
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => copyText(loginUrl, "Staff login URL")}
              className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <Copy className="h-3.5 w-3.5" /> Copy /staff-login link
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Floor teammates use this code with their username &amp; 6-digit PIN at <span className="font-mono text-foreground">/staff-login</span>.
          </p>
        </div>

        <Dialog
          open={addOpen}
          onOpenChange={(next) => {
            setAddOpen(next);
            if (!next) resetAddForm();
          }}
        >
          <DialogTrigger asChild>
            <Button className="gap-2 text-primary-foreground glow-magenta" style={{ background: "var(--gradient-brand-hot)" }}>
              <Plus className="h-4 w-4" /> Add staff
            </Button>
          </DialogTrigger>
          <DialogContent className="overflow-y-auto overflow-x-hidden p-0 sm:max-w-2xl">
            <div className="grid gap-0 md:grid-cols-[220px_1fr]">
              {/* Left explainer */}
              <div className="relative overflow-hidden border-b border-border bg-gradient-to-br from-magenta/15 via-card to-violet/15 p-5 md:border-b-0 md:border-r">
                <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-magenta/30 blur-3xl" />
                <div className="relative">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-magenta to-rose text-primary-foreground shadow-magenta">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div className="mt-3 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                    Role · cafe staff
                  </div>
                  <div className="mt-1 font-display text-lg font-bold leading-tight">
                    Scoped counter access.
                  </div>
                  <ul className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                    <li className="flex items-start gap-2"><Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-400" /> Instant 6-digit PIN setup</li>
                    <li className="flex items-start gap-2"><Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-400" /> Enforced in UI &amp; database</li>
                    <li className="flex items-start gap-2"><Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-400" /> Deactivate or reset anytime</li>
                  </ul>

                  <div className="mt-4">
                    <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
                      Selected ({perms.length})
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {perms.length === 0 ? (
                        <Badge variant="secondary" className="text-[10px]">view-only</Badge>
                      ) : perms.map((p) => (
                        <Badge key={p} variant="outline" className="text-[10px]">
                          {STAFF_PERM_META[p].label}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right form */}
              <div className="p-5 sm:p-6">
                <DialogHeader className="border-b-0 pb-2">
                  <DialogTitle className="text-lg">Add a staff member</DialogTitle>
                </DialogHeader>

                <Tabs
                  value={addTab}
                  onValueChange={(v) => {
                    setAddTab(v as "pin" | "email");
                    setPinError(null);
                    setEmailError(null);
                    setEmailSuccess(null);
                    setEmailConfirming(false);
                  }}
                  className="mt-2"
                >
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="pin" className="gap-1.5 text-xs sm:text-sm">
                      <KeyRound className="h-3.5 w-3.5" /> PIN login (recommended)
                    </TabsTrigger>
                    <TabsTrigger value="email" className="gap-1.5 text-xs sm:text-sm">
                      <Mail className="h-3.5 w-3.5" /> Email invite
                    </TabsTrigger>
                  </TabsList>

                  {/* Preset bar + permissions selector shared nicely */}
                  <div className="mt-4 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Label className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                        Permissions
                      </Label>
                      <div className="flex flex-wrap gap-1.5">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 px-2.5 text-[11px]"
                          onClick={() => setPerms(COUNTER_STAFF_PRESET)}
                        >
                          Counter staff
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 px-2.5 text-[11px]"
                          onClick={() => setPerms(MANAGER_PRESET)}
                        >
                          Manager
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-[11px] text-muted-foreground"
                          onClick={() => setPerms([])}
                        >
                          Clear
                        </Button>
                      </div>
                    </div>

                    <div className="grid max-h-[30vh] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                      {STAFF_PERMS.map((key) => {
                        const active = perms.includes(key);
                        const Icon = PERM_ICONS[key];
                        const meta = STAFF_PERM_META[key];
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() =>
                              setPerms((cur) => (active ? cur.filter((x) => x !== key) : [...cur, key]))
                            }
                            className={`group relative flex items-start gap-2.5 rounded-xl border p-2.5 text-left transition-all ${
                              active
                                ? "border-primary bg-primary/10 shadow-soft"
                                : "border-border bg-card hover:border-primary/40 hover:bg-secondary"
                            }`}
                          >
                            <div
                              className={`grid h-7 w-7 shrink-0 place-items-center rounded-md transition ${
                                active
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-secondary text-muted-foreground group-hover:text-foreground"
                              }`}
                            >
                              <Icon className="h-3.5 w-3.5" />
                            </div>
                            <div className="min-w-0 pr-4">
                              <div className="text-xs font-semibold sm:text-sm">{meta.label}</div>
                              <div className="text-[11px] leading-snug text-muted-foreground">
                                {meta.description}
                              </div>
                            </div>
                            {active && (
                              <span className="absolute right-2 top-2 grid h-4 w-4 place-items-center rounded-full bg-primary text-primary-foreground">
                                <Check className="h-2.5 w-2.5" />
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* TAB 1: PIN LOGIN */}
                  <TabsContent value="pin" className="mt-4">
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        setPinError(null);
                        createPinM.mutate({
                          data: {
                            cafe_id: cafeId,
                            display_name: displayName.trim(),
                            username: username.trim().toLowerCase(),
                            permissions: perms,
                          },
                        });
                      }}
                      className="space-y-3"
                    >
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label htmlFor="pinDisplayName" className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                            Display name
                          </Label>
                          <Input
                            id="pinDisplayName"
                            required
                            placeholder="Rohan Sharma"
                            value={displayName}
                            onChange={(e) => {
                              const next = e.target.value;
                              setDisplayName(next);
                              if (!username) {
                                setUsername(
                                  next
                                    .toLowerCase()
                                    .replace(/[^a-z0-9._-]+/g, "")
                                    .slice(0, 20),
                                );
                              }
                            }}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="pinUsername" className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                            Username
                          </Label>
                          <div className="relative">
                            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-xs text-muted-foreground">
                              @
                            </span>
                            <Input
                              id="pinUsername"
                              required
                              placeholder="rohan"
                              className="pl-7 font-mono"
                              value={username}
                              onChange={(e) =>
                                setUsername(
                                  e.target.value
                                    .toLowerCase()
                                    .replace(/[^a-z0-9._-]/g, "")
                                    .slice(0, 32),
                                )
                              }
                            />
                          </div>
                        </div>
                      </div>

                      {pinError && (
                        <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                          {pinError}
                        </div>
                      )}

                      <div className="flex items-center justify-end gap-2 pt-1">
                        <Button type="button" variant="ghost" onClick={() => setAddOpen(false)}>
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          disabled={createPinM.isPending}
                          className="gap-1.5 text-primary-foreground glow-magenta"
                          style={{ background: "var(--gradient-brand-hot)" }}
                        >
                          <KeyRound className="h-4 w-4" />
                          {createPinM.isPending ? "Creating…" : "Create PIN login"}
                        </Button>
                      </div>
                    </form>
                  </TabsContent>

                  {/* TAB 2: EMAIL INVITE */}
                  <TabsContent value="email" className="mt-4">
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        setEmailError(null);
                        setEmailSuccess(null);
                        if (!email.trim()) return;
                        if (!emailConfirming) {
                          setEmailConfirming(true);
                          return;
                        }
                        inviteM.mutate({
                          data: { cafe_id: cafeId, email: email.trim(), permissions: perms },
                        });
                      }}
                      className="space-y-3"
                    >
                      <div className="space-y-1.5">
                        <Label htmlFor="inviteEmail" className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                          Email address
                        </Label>
                        <div className="relative">
                          <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            id="inviteEmail"
                            type="email"
                            required
                            placeholder="staff@example.com"
                            className="pl-9"
                            value={email}
                            onChange={(e) => {
                              setEmail(e.target.value);
                              setEmailConfirming(false);
                              setEmailError(null);
                              setEmailSuccess(null);
                            }}
                          />
                        </div>
                      </div>

                      {emailConfirming && (
                        <div className="rounded-xl border border-primary/40 bg-primary/10 p-3 text-xs space-y-1">
                          <div className="font-semibold text-foreground">
                            Confirm email invite to <span className="font-mono">{email.trim().toLowerCase()}</span>?
                          </div>
                          <div className="text-muted-foreground">
                            They will receive a setup link to <span className="font-mono">/reset-password</span> with{" "}
                            {perms.length === 0 ? "view-only access" : `${perms.length} permission(s)`}.
                          </div>
                        </div>
                      )}

                      {emailError && (
                        <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                          {emailError}
                        </div>
                      )}

                      {emailSuccess && (
                        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
                          {emailSuccess}
                        </div>
                      )}

                      <div className="flex items-center justify-end gap-2 pt-1">
                        {emailConfirming ? (
                          <>
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() => setEmailConfirming(false)}
                              disabled={inviteM.isPending}
                            >
                              Back
                            </Button>
                            <Button
                              type="submit"
                              disabled={inviteM.isPending}
                              className="gap-1.5 text-primary-foreground glow-magenta"
                              style={{ background: "var(--gradient-brand-hot)" }}
                            >
                              <Mail className="h-4 w-4" />
                              {inviteM.isPending ? "Sending…" : "Confirm & send invite"}
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button type="button" variant="ghost" onClick={() => setAddOpen(false)}>
                              Close
                            </Button>
                            <Button
                              type="submit"
                              disabled={inviteM.isPending || !email.trim()}
                              className="gap-1.5 text-primary-foreground glow-magenta"
                              style={{ background: "var(--gradient-brand-hot)" }}
                            >
                              <Mail className="h-4 w-4" /> Review &amp; send invite
                            </Button>
                          </>
                        )}
                      </div>
                    </form>
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Staff list */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Crew</div>
            <div className="text-sm text-muted-foreground">
              {staffRows.length} staff member{staffRows.length === 1 ? "" : "s"}
            </div>
          </div>
        </div>

        <QueryBoundary queries={[q]} errorTitle="Couldn't load staff">
          {staffRows.length === 0 ? (
            <EmptyState
              icon={ShieldCheck}
              title="No staff yet"
              description="Create a PIN login or send an email invite so teammates can help run the floor."
            />
          ) : (
            <div className="space-y-2.5">
              {staffRows.map((s, i) => {
                const prof = s.profiles;
                const sPerms = ((s.permissions as string[]) ?? []) as StaffPerm[];
                const isActive = s.is_active !== false;
                const isLocked = Boolean(s.locked_until && new Date(s.locked_until).getTime() > Date.now());
                const online = Boolean(
                  s.last_seen_at && Date.now() - new Date(s.last_seen_at).getTime() < 5 * 60 * 1000,
                );
                const label = s.display_name || prof?.full_name || (s.username ? `@${s.username}` : prof?.email) || "Staff member";
                const showEmail = prof?.email && !isSyntheticEmail(prof.email) ? prof.email : null;

                return (
                  <motion.div
                    key={s.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4 backdrop-blur transition ${
                      !isActive
                        ? "border-border/40 bg-card/25 opacity-75"
                        : "border-border/60 bg-card/40 hover:border-primary/40"
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="relative grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary to-accent text-xs font-bold text-primary-foreground">
                        {(label[0] || "?").toUpperCase()}
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-background ${
                            online ? "bg-emerald-400" : "bg-muted-foreground/40"
                          }`}
                        />
                      </div>
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate font-semibold">{label}</span>
                          {s.username && (
                            <Badge variant="outline" className="font-mono text-[10px]">
                              @{s.username}
                            </Badge>
                          )}
                          {isLocked && (
                            <Badge variant="destructive" className="gap-1 text-[10px]">
                              <Lock className="h-2.5 w-2.5" /> Locked
                            </Badge>
                          )}
                          {!isActive && (
                            <Badge variant="secondary" className="text-[10px]">
                              Deactivated
                            </Badge>
                          )}
                          {s.must_change_pin && s.login_email && (
                            <Badge variant="outline" className="border-amber-500/40 text-[10px] text-amber-300">
                              Needs PIN change
                            </Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 font-mono text-[11px] text-muted-foreground">
                          {showEmail ? (
                            <span className="truncate">
                              <Mail className="mr-1 inline h-3 w-3" />
                              {showEmail}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1">
                              <KeyRound className="h-3 w-3" /> PIN login
                            </span>
                          )}
                          <span>·</span>
                          <span>{formatLastSeen(s.last_seen_at)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {sPerms.length === 0 ? (
                        <Badge variant="secondary">view-only</Badge>
                      ) : (
                        sPerms.map((p) => (
                          <Badge key={p} variant="outline" className="text-[11px]">
                            {STAFF_PERM_META[p]?.label ?? p}
                          </Badge>
                        ))
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {(s.login_email || s.username) && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={resetPinM.isPending}
                          onClick={() =>
                            resetPinM.mutate({ cafe_id: cafeId, staff_user_id: s.staff_user_id })
                          }
                          className="h-8 gap-1.5 text-xs"
                        >
                          <KeyRound className="h-3.5 w-3.5" /> Reset PIN
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant={isActive ? "outline" : "default"}
                        disabled={activeM.isPending}
                        onClick={() =>
                          activeM.mutate({
                            data: { cafe_id: cafeId, staff_user_id: s.staff_user_id, active: !isActive },
                          })
                        }
                        className="h-8 gap-1.5 text-xs"
                      >
                        <Power className="h-3.5 w-3.5" />
                        {isActive ? "Deactivate" : "Activate"}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => setRemoveTarget({ staffUserId: s.staff_user_id, label })}
                        title="Remove staff member"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </QueryBoundary>
      </div>

      {/* Permissions matrix */}
      {staffRows.length > 0 && (
        <div>
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-lg font-bold">Permissions matrix</h2>
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              Toggle = save instantly · Green dot = online (≤5min)
            </span>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-border/60 bg-card/40 backdrop-blur">
            <table className="w-full text-sm">
              <thead className="border-b border-border/60 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="sticky left-0 z-10 bg-card/85 p-3 backdrop-blur">Staff</th>
                  {STAFF_PERMS.map((p) => (
                    <th key={p} className="p-3 text-center font-mono" title={STAFF_PERM_META[p].description}>
                      {STAFF_PERM_META[p].label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {staffRows.map((s) => {
                  const prof = s.profiles;
                  const current = ((s.permissions as string[]) ?? []) as StaffPerm[];
                  const online = Boolean(
                    s.last_seen_at && Date.now() - new Date(s.last_seen_at).getTime() < 5 * 60 * 1000,
                  );
                  const name = s.display_name || prof?.full_name || prof?.email || s.username || "—";
                  return (
                    <tr key={s.id} className="border-b border-border/30 last:border-0">
                      <td className="sticky left-0 z-10 min-w-[140px] sm:min-w-[190px] bg-card/85 p-2.5 sm:p-3 backdrop-blur">
                        <div className="flex items-center gap-2">
                          <span
                            className={`h-2 w-2 shrink-0 rounded-full ${
                              online ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]" : "bg-muted-foreground/30"
                            }`}
                          />
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium">{name}</div>
                            <div className="truncate font-mono text-[10px] text-muted-foreground">
                              {s.username ? `@${s.username}` : prof?.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      {STAFF_PERMS.map((p) => {
                        const active = current.includes(p);
                        return (
                          <td key={p} className="p-2 text-center">
                            <Switch
                              checked={active}
                              disabled={updateM.isPending}
                              onCheckedChange={(checked) => {
                                const next = checked
                                  ? [...new Set([...current, p])]
                                  : current.filter((x) => x !== p);
                                updateM.mutate({
                                  data: { cafe_id: cafeId, staff_user_id: s.staff_user_id, permissions: next },
                                });
                              }}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* One-time PIN credentials modal */}
      <Dialog open={!!credentials} onOpenChange={(o) => !o && setCredentials(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" />
              {credentials?.title ?? "Staff login details"}
            </DialogTitle>
          </DialogHeader>

          {credentials && (
            <div className="space-y-4">
              <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                <span>
                  This 6-digit PIN is shown <strong>only once</strong> and is never stored in plain text. Copy or share it now.
                </span>
              </div>

              <div className="space-y-2.5 rounded-2xl border border-border/70 bg-background/60 p-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Staff member</span>
                  <span className="font-semibold flex items-center gap-1">
                    <User className="h-3.5 w-3.5 text-primary" /> {credentials.displayName}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Café code</span>
                  <span className="font-mono text-sm font-bold tracking-[0.2em]">{credentials.cafeCode || "—"}</span>
                </div>
                {credentials.username && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Username</span>
                    <span className="font-mono text-sm font-semibold">{credentials.username}</span>
                  </div>
                )}
                <div className="border-t border-border/60 pt-2.5 text-center">
                  <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                    Temporary 6-digit PIN
                  </div>
                  <div className="mt-1 select-all font-mono text-3xl font-extrabold tracking-[0.35em] text-primary">
                    {credentials.pin}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  onClick={() => copyText(buildShareText(credentials), "Staff credentials")}
                >
                  <Copy className="h-4 w-4" /> Copy details
                </Button>
                <Button asChild className="gap-2 bg-emerald-600 text-white hover:bg-emerald-500">
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(buildShareText(credentials))}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <MessageCircle className="h-4 w-4" /> Share on WhatsApp
                  </a>
                </Button>
              </div>

              <Button type="button" className="w-full" onClick={() => setCredentials(null)}>
                Done — I&apos;ve saved the PIN
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmModal
        open={!!removeTarget}
        onOpenChange={(o) => !o && setRemoveTarget(null)}
        title="Remove staff member?"
        description={`Revoke café console access and remove ${removeTarget?.label ?? "this staff member"}?`}
        confirmLabel="Remove Staff"
        onConfirm={() =>
          removeTarget
            ? removeM.mutateAsync({ data: { cafe_id: cafeId, staff_user_id: removeTarget.staffUserId } })
            : Promise.resolve()
        }
      />
    </div>
  );
}
