import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Trophy, CalendarClock, Users, Crown, ArrowLeft, Check } from "lucide-react";
import { getPublicTournament, publicRegisterTournament } from "@/lib/tournaments-public.functions";
import { AuroraBackground } from "@/components/AuroraBackground";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/c/$slug/tournaments/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `Tournament Registration · CoreCade` },
      { name: "description", content: `Register your team for the upcoming tournament at ${params.slug}.` },
      { property: "og:title", content: `Tournament · ${params.slug}` },
      { property: "og:description", content: "Register your team — limited slots." },
    ],
  }),
  component: PublicTournamentPage,
});

function PublicTournamentPage() {
  const { slug, id } = Route.useParams();
  const fn = useServerFn(getPublicTournament);
  const reg = useServerFn(publicRegisterTournament);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["pub-tourn", slug, id],
    queryFn: () => fn({ data: { slug, id } }),
    refetchInterval: 30_000,
  });

  const [team, setTeam] = useState("");
  const [contact, setContact] = useState("");
  const [done, setDone] = useState(false);

  const m = useMutation({
    mutationFn: reg,
    onSuccess: () => { toast.success("Registered! See you at the cafe."); setDone(true); refetch(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  if (isLoading) return <div className="min-h-screen" />;
  if (error || !data) return (
    <div className="flex min-h-screen items-center justify-center text-center">
      <div>
        <div className="font-display text-2xl font-bold">Tournament not found</div>
        <Link to="/c/$slug" params={{ slug }} className="mt-3 inline-block text-sm text-primary underline">Back to café</Link>
      </div>
    </div>
  );

  const { cafe, tournament, registered } = data;
  const closed = tournament.status !== "upcoming";
  const full = registered >= tournament.capacity;

  return (
    <div className="relative min-h-screen overflow-hidden">
      <AuroraBackground />

      <div className="mx-auto max-w-3xl px-4 py-8">
        <Link to="/c/$slug" params={{ slug }} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3 w-3" /> {cafe.name}
        </Link>

        <div className="relative mt-4 overflow-hidden rounded-3xl border border-border/60 bg-card/60 p-6 backdrop-blur-xl sm:p-10">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-primary/30 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 -left-16 h-56 w-56 rounded-full bg-accent/30 blur-3xl" />

          <div className="relative">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-primary">
              <Trophy className="h-3 w-3" /> {tournament.game}
            </div>
            <h1 className="mt-3 font-display text-4xl font-extrabold leading-tight sm:text-5xl">{tournament.title}</h1>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <Stat icon={CalendarClock} label="Starts" value={new Date(tournament.starts_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })} />
              <Stat icon={Users} label="Slots" value={`${registered} / ${tournament.capacity}`} />
              <Stat icon={Crown} label="Prize pool" value={`₹${tournament.prize_pool}`} />
            </div>

            <div className="mt-5 flex flex-wrap gap-2 text-sm">
              <Badge variant="outline">Format: {tournament.format}</Badge>
              <Badge variant="outline">Entry: ₹{tournament.entry_fee}</Badge>
              <Badge variant={closed ? "secondary" : full ? "destructive" : "default"} style={!closed && !full ? { background: "var(--gradient-brand-cool)" } : undefined}>
                {closed ? tournament.status : full ? "Full" : "Open"}
              </Badge>
            </div>

            {tournament.rules && (
              <div className="mt-6 rounded-xl border border-border/40 bg-background/30 p-4">
                <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Rules</div>
                <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{tournament.rules}</p>
              </div>
            )}

            {tournament.winner_team && (
              <div className="mt-6 rounded-xl border border-amber-400/40 bg-amber-400/10 p-4">
                <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-amber-300"><Crown className="h-3 w-3" /> Champion</div>
                <div className="mt-1 font-display text-2xl font-bold text-amber-200">{tournament.winner_team}</div>
              </div>
            )}

            {/* Registration form */}
            {!closed && !full && !done && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (team.trim().length < 2) return toast.error("Team name too short");
                  if (contact.trim().length < 5) return toast.error("Add a valid phone or email");
                  m.mutate({ data: { tournament_id: id, team_name: team.trim(), contact: contact.trim() } });
                }}
                className="mt-6 grid gap-3 sm:grid-cols-[1fr_1fr_auto]"
              >
                <div className="space-y-1">
                  <Label className="text-xs">Team / player name</Label>
                  <Input value={team} onChange={(e) => setTeam(e.target.value)} placeholder="Phantom Squad" required maxLength={80} className="h-11" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Phone / email</Label>
                  <Input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="+91 98765 43210" required maxLength={80} className="h-11" />
                </div>
                <div className="flex items-end">
                  <Button type="submit" disabled={m.isPending} className="h-11 w-full gap-2 sm:w-auto" style={{ background: "var(--gradient-brand-hot)" }}>
                    {m.isPending ? "Registering…" : "Register team"}
                  </Button>
                </div>
              </form>
            )}

            {done && (
              <div className="mt-6 flex items-center gap-3 rounded-xl border border-emerald-400/40 bg-emerald-500/10 p-4">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-emerald-500 text-white"><Check className="h-5 w-5" /></div>
                <div>
                  <div className="font-bold">You're in!</div>
                  <div className="text-xs text-muted-foreground">Show up at {cafe.name} on the start date. We'll contact you on {contact}.</div>
                </div>
              </div>
            )}

            {(closed || full) && !done && (
              <div className="mt-6 rounded-xl border border-border/40 bg-background/30 p-4 text-center text-sm text-muted-foreground">
                {full ? "All slots are taken." : "Registration is closed for this tournament."}
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 text-center text-xs text-muted-foreground">
          Hosted by <span className="font-semibold text-foreground">{cafe.name}</span>{cafe.city && ` · ${cafe.city}`} · Powered by <span className="text-gradient font-semibold">CoreCade</span>
        </div>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Trophy; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/40 bg-background/30 p-3">
      <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className="mt-1 font-display text-lg font-bold">{value}</div>
    </div>
  );
}
