import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ArrowLeft, Trophy, Shuffle, Crown, Wallet } from "lucide-react";
import { getCafeBySlug } from "@/lib/cafes.functions";
import { listTournaments, listRegistrations, listMatches, generateBracket, setMatchResult, payoutTournament } from "@/lib/tournaments.functions";
import { listCustomers } from "@/lib/customers.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/EmptyState";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/cafe/$slug/tournaments/$id")({
  head: () => ({
    meta: [
      { title: "Tournament Bracket — CoreCade" },
      { name: "description", content: "Live bracket, scores and registrations." },
    ],
  }),
  component: BracketPage,
});

function BracketPage() {
  const { slug, id } = Route.useParams();
  const nav = useNavigate();
  const getCafe = useServerFn(getCafeBySlug);
  const { data: cafe } = useQuery({ queryKey: ["cafe", slug], queryFn: () => getCafe({ data: { slug } }) });
  const lT = useServerFn(listTournaments);
  const lR = useServerFn(listRegistrations);
  const lM = useServerFn(listMatches);
  const gen = useServerFn(generateBracket);
  const setRes = useServerFn(setMatchResult);
  const payFn = useServerFn(payoutTournament);
  const lCus = useServerFn(listCustomers);
  const qc = useQueryClient();

  const tournQ = useQuery({ queryKey: ["tourns", cafe?.id], queryFn: () => lT({ data: { cafe_id: cafe!.id } }), enabled: !!cafe?.id });
  const tournament = (tournQ.data ?? []).find((t) => t.id === id);
  const regsQ = useQuery({ queryKey: ["regs", id], queryFn: () => lR({ data: { tournament_id: id } }) });
  const matchQ = useQuery({ queryKey: ["matches", id], queryFn: () => lM({ data: { tournament_id: id } }) });
  const cusQ = useQuery({ queryKey: ["customers", cafe?.id], queryFn: () => lCus({ data: { cafe_id: cafe!.id } }), enabled: !!cafe?.id });

  const genM = useMutation({
    mutationFn: gen,
    onSuccess: () => { toast.success("Bracket generated"); qc.invalidateQueries({ queryKey: ["matches", id] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const resM = useMutation({
    mutationFn: setRes,
    onSuccess: () => { toast.success("Result saved"); qc.invalidateQueries({ queryKey: ["matches", id] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const payM = useMutation({
    mutationFn: payFn,
    onSuccess: () => {
      toast.success("Prize paid out to winner's wallet");
      qc.invalidateQueries({ queryKey: ["tourns", cafe?.id] });
      qc.invalidateQueries({ queryKey: ["customers", cafe?.id] });
      setPayoutOpen(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const [payoutOpen, setPayoutOpen] = useState(false);

  const matches = matchQ.data ?? [];
  const roundsMap = new Map<number, typeof matches>();
  for (const m of matches) {
    const arr = roundsMap.get(m.round) ?? [];
    arr.push(m);
    roundsMap.set(m.round, arr);
  }
  const rounds = Array.from(roundsMap.entries()).sort(([a], [b]) => a - b);

  return (
    <div>
      <button onClick={() => nav({ to: "/cafe/$slug/tournaments", params: { slug } })} className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3 w-3" /> All tournaments
      </button>

      {!tournament ? (
        <div className="h-40 animate-pulse rounded-2xl border border-border/40 bg-card/30" />
      ) : (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card/40 p-4 backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-primary to-accent text-primary-foreground"><Trophy className="h-5 w-5" /></div>
            <div>
              <div className="font-display text-xl font-bold">{tournament.title}</div>
              <div className="text-xs text-muted-foreground">{tournament.game} · {tournament.format} · {(regsQ.data ?? []).length}/{tournament.capacity} teams · Prize ₹{tournament.prize_pool}</div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(() => {
              const finalRound = rounds.length > 0 ? rounds[rounds.length - 1] : null;
              const finalMatch = finalRound?.[1]?.[0];
              const champion = finalMatch?.winner && finalMatch.winner !== "BYE" ? finalMatch.winner : null;
              const t = tournament as { paid_out_at?: string | null; winner_team?: string | null; prize_pool: number; payout_amount?: number };
              const paidOut = !!t.paid_out_at;
              return (
                <>
                  {champion && !paidOut && (
                    <Button onClick={() => setPayoutOpen(true)} className="gap-2" variant="outline">
                      <Crown className="h-4 w-4 text-amber-400" /> Payout to {champion}
                    </Button>
                  )}
                  {paidOut && (
                    <Badge className="gap-1 bg-amber-500/20 text-amber-200">
                      <Crown className="h-3 w-3" /> ₹{t.payout_amount} paid to {t.winner_team}
                    </Badge>
                  )}
                  <Button onClick={() => { if (confirm("Regenerate bracket? Existing matches will be wiped.")) genM.mutate({ data: { tournament_id: id } }); }} className="gap-2" style={{ background: "var(--gradient-brand-hot)" }}>
                    <Shuffle className="h-4 w-4" /> {matches.length === 0 ? "Generate" : "Regenerate"} bracket
                  </Button>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {matches.length === 0 ? (
        <EmptyState icon={Trophy} title="Bracket not generated yet" description="Click Generate to seed teams into a single-elimination bracket." />
      ) : (
        <div className="overflow-x-auto">
          <div className="flex min-w-max gap-6 py-2">
            {rounds.map(([round, ms]) => (
              <div key={round} className="flex flex-col gap-3">
                <div className="text-center font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                  {round === rounds[rounds.length - 1][0] ? "Final" : `Round ${round}`}
                </div>
                {ms.sort((a, b) => a.match_index - b.match_index).map((m) => (
                  <MatchCard key={m.id} m={m} onPick={(winner) => resM.mutate({ data: { match_id: m.id, winner } })} />
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

type Match = { id: string; round: number; match_index: number; team_a: string; team_b: string; score_a: number | null; score_b: number | null; winner: string | null };
function MatchCard({ m, onPick }: { m: Match; onPick: (w: "a" | "b") => void }) {
  const [scoreA, setScoreA] = useState<string>(m.score_a?.toString() ?? "");
  const [scoreB, setScoreB] = useState<string>(m.score_b?.toString() ?? "");
  const ready = m.team_a && m.team_b && m.team_a !== "BYE" && m.team_b !== "BYE";
  return (
    <div className="w-56 rounded-xl border border-border/60 bg-card/60 p-2 backdrop-blur">
      <Row team={m.team_a} score={scoreA} setScore={setScoreA} winner={m.winner === m.team_a} canPick={!!ready && !m.winner} onPick={() => onPick("a")} />
      <div className="my-1 text-center text-[9px] font-mono uppercase tracking-wider text-muted-foreground">vs</div>
      <Row team={m.team_b} score={scoreB} setScore={setScoreB} winner={m.winner === m.team_b} canPick={!!ready && !m.winner} onPick={() => onPick("b")} />
      {m.winner && (
        <Badge className="mt-2 w-full justify-center gap-1 bg-primary/20 text-primary"><Crown className="h-3 w-3" />{m.winner}</Badge>
      )}

      {/* Payout dialog */}
      <Dialog open={payoutOpen} onOpenChange={setPayoutOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Wallet className="h-4 w-4 text-primary" /> Pay out tournament prize</DialogTitle></DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const customer_id = String(fd.get("customer_id") || "");
              const winner_team = String(fd.get("winner_team") || "").trim();
              const amount = Number(fd.get("amount")) || 0;
              if (!customer_id) return toast.error("Pick the winning customer");
              if (!winner_team) return toast.error("Team name required");
              if (amount <= 0) return toast.error("Amount must be > 0");
              if (!confirm(`Credit ₹${amount} to ${winner_team}'s wallet? This cannot be undone.`)) return;
              payM.mutate({ data: { tournament_id: id, customer_id, winner_team, amount } });
            }}
            className="space-y-3"
          >
            <div className="space-y-1">
              <Label>Winner team / player</Label>
              <Input name="winner_team" required defaultValue={(() => {
                const finalRound = rounds.length > 0 ? rounds[rounds.length - 1] : null;
                return finalRound?.[1]?.[0]?.winner ?? "";
              })()} />
            </div>
            <div className="space-y-1">
              <Label>Credit to customer</Label>
              <select name="customer_id" required className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="">— select customer —</option>
                {(cusQ.data ?? []).map((c: { id: string; full_name: string; phone: string | null }) => (
                  <option key={c.id} value={c.id}>{c.full_name} {c.phone ? `· ${c.phone}` : ""}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Amount (₹)</Label>
              <Input name="amount" type="number" min={1} defaultValue={tournament?.prize_pool ?? 0} required />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setPayoutOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={payM.isPending} style={{ background: "var(--gradient-brand-hot)" }}>
                {payM.isPending ? "Paying…" : "Confirm payout"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

type Match = { id: string; round: number; match_index: number; team_a: string; team_b: string; score_a: number | null; score_b: number | null; winner: string | null };
function MatchCard({ m, onPick }: { m: Match; onPick: (w: "a" | "b") => void }) {
  const [scoreA, setScoreA] = useState<string>(m.score_a?.toString() ?? "");
  const [scoreB, setScoreB] = useState<string>(m.score_b?.toString() ?? "");
  const ready = m.team_a && m.team_b && m.team_a !== "BYE" && m.team_b !== "BYE";
  return (
    <div className="w-56 rounded-xl border border-border/60 bg-card/60 p-2 backdrop-blur">
      <Row team={m.team_a} score={scoreA} setScore={setScoreA} winner={m.winner === m.team_a} canPick={!!ready && !m.winner} onPick={() => onPick("a")} />
      <div className="my-1 text-center text-[9px] font-mono uppercase tracking-wider text-muted-foreground">vs</div>
      <Row team={m.team_b} score={scoreB} setScore={setScoreB} winner={m.winner === m.team_b} canPick={!!ready && !m.winner} onPick={() => onPick("b")} />
      {m.winner && (
        <Badge className="mt-2 w-full justify-center gap-1 bg-primary/20 text-primary"><Crown className="h-3 w-3" />{m.winner}</Badge>
      )}
    </div>
  );
}

function Row({ team, score, setScore, winner, canPick, onPick }: { team: string; score: string; setScore: (s: string) => void; winner: boolean; canPick: boolean; onPick: () => void }) {
  return (
    <button
      type="button"
      disabled={!canPick}
      onClick={onPick}
      className={`flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left text-xs transition ${winner ? "border-primary bg-primary/10" : "border-border/40 hover:border-primary/40"} ${!canPick && !winner ? "opacity-60" : ""}`}
    >
      <span className="min-w-0 flex-1 truncate font-medium">{team || "—"}</span>
      <input
        type="number"
        value={score}
        onChange={(e) => setScore(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        className="h-6 w-10 rounded border border-input bg-background px-1 text-center font-mono text-[11px]"
      />
    </button>
  );
}
