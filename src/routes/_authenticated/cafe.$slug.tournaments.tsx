import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Trophy, Plus, Trash2, Users, IndianRupee, CalendarClock } from "lucide-react";
import { getCafeBySlug } from "@/lib/cafes.functions";
import { listTournaments, upsertTournament, deleteTournament, listRegistrations, registerForTournament } from "@/lib/tournaments.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/EmptyState";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/cafe/$slug/tournaments")({
  head: () => ({
    meta: [
      { title: "Tournaments — CoreCade" },
      { name: "description", content: "Plan brackets, registrations and live tournament ops." },
      { property: "og:title", content: "Tournaments — CoreCade" },
      { property: "og:description", content: "Plan brackets, registrations and live tournament ops." },
    ],
  }),
  component: TournamentsPage,
});

type T = {
  id: string; cafe_id: string; title: string; game: string; format: "solo" | "duo" | "squad";
  entry_fee: number; prize_pool: number; capacity: number; starts_at: string;
  status: "upcoming" | "live" | "completed" | "cancelled"; banner_url: string | null; rules: string | null;
  tournament_registrations?: { count: number }[];
};

function TournamentsPage() {
  const { slug } = Route.useParams();
  const getCafe = useServerFn(getCafeBySlug);
  const { data: cafe } = useQuery({ queryKey: ["cafe", slug], queryFn: () => getCafe({ data: { slug } }) });
  const cafeId = cafe?.id;

  const list = useServerFn(listTournaments);
  const up = useServerFn(upsertTournament);
  const del = useServerFn(deleteTournament);
  const regs = useServerFn(listRegistrations);
  const reg = useServerFn(registerForTournament);

  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["tourns", cafeId], queryFn: () => list({ data: { cafe_id: cafeId! } }), enabled: !!cafeId });
  const refresh = () => qc.invalidateQueries({ queryKey: ["tourns", cafeId] });

  const save = useMutation({
    mutationFn: up,
    onSuccess: () => { toast.success("Saved"); refresh(); setEdit(null); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const rm = useMutation({ mutationFn: del, onSuccess: () => { toast.success("Deleted"); refresh(); } });
  const addReg = useMutation({
    mutationFn: reg,
    onSuccess: () => { toast.success("Registered"); qc.invalidateQueries({ queryKey: ["regs"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const [edit, setEdit] = useState<Partial<T> | null>(null);
  const [view, setView] = useState<T | null>(null);
  const regsQ = useQuery({
    queryKey: ["regs", view?.id],
    queryFn: () => regs({ data: { tournament_id: view!.id } }),
    enabled: !!view,
  });

  if (!cafeId) return <div className="h-40 animate-pulse rounded-2xl border border-border/40 bg-card/30" />;
  const rows = (q.data ?? []) as T[];

  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">{rows.length} tournaments</div>
        <Button className="gap-2" style={{ background: "var(--gradient-brand-hot)" }} onClick={() => setEdit({ cafe_id: cafeId, format: "solo", status: "upcoming", capacity: 16, starts_at: new Date(Date.now() + 86400000).toISOString().slice(0, 16) })}>
          <Plus className="h-4 w-4" /> New tournament
        </Button>
      </div>

      <div className="mt-4">
        {rows.length === 0 ? (
          <EmptyState icon={Trophy} title="No tournaments" description="Run weekend brackets and fill seats fast." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((t) => {
              const regCount = t.tournament_registrations?.[0]?.count ?? 0;
              return (
                <div key={t.id} className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/40 p-5 backdrop-blur">
                  <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-primary/20 blur-3xl" />
                  <div className="relative flex items-start justify-between">
                    <div>
                      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{t.game} · {t.format}</div>
                      <h3 className="mt-1 font-display text-xl font-bold leading-tight">{t.title}</h3>
                    </div>
                    <Badge variant={t.status === "live" ? "default" : t.status === "completed" ? "secondary" : "outline"} className="capitalize">{t.status}</Badge>
                  </div>
                  <div className="relative mt-4 grid grid-cols-3 gap-2 text-center">
                    <Stat icon={IndianRupee} label="Entry" value={`₹${t.entry_fee}`} />
                    <Stat icon={Trophy} label="Pool" value={`₹${t.prize_pool}`} />
                    <Stat icon={Users} label="Seats" value={`${regCount}/${t.capacity}`} />
                  </div>
                  <div className="relative mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CalendarClock className="h-3.5 w-3.5" /> {new Date(t.starts_at).toLocaleString()}
                  </div>
                  <div className="relative mt-3 flex flex-wrap items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => setView(t)}>Roster</Button>
                    <a href={`/cafe/${slug}/tournaments/${t.id}`} className="inline-flex h-9 items-center justify-center rounded-md bg-primary/10 px-3 text-xs font-semibold text-primary hover:bg-primary/20">
                      <Trophy className="mr-1 h-3 w-3" /> Bracket
                    </a>
                    <Button size="sm" variant="ghost" onClick={() => setEdit(t)}>Edit</Button>
                    <Button size="icon" variant="ghost" className="ml-auto" onClick={() => { if (confirm("Delete?")) rm.mutate({ data: { id: t.id } }); }}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={!!edit} onOpenChange={(v) => !v && setEdit(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{edit?.id ? "Edit tournament" : "New tournament"}</DialogTitle></DialogHeader>
          {edit && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                save.mutate({ data: {
                  id: edit.id,
                  cafe_id: cafeId,
                  title: String(fd.get("title")),
                  game: String(fd.get("game")),
                  format: fd.get("format") as "solo" | "duo" | "squad",
                  entry_fee: Number(fd.get("entry_fee")),
                  prize_pool: Number(fd.get("prize_pool")),
                  capacity: Number(fd.get("capacity")),
                  starts_at: new Date(String(fd.get("starts_at"))).toISOString(),
                  status: fd.get("status") as T["status"],
                  banner_url: (fd.get("banner_url") as string) || null,
                  rules: (fd.get("rules") as string) || null,
                } });
              }}
              className="space-y-3"
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1 sm:col-span-2"><Label>Title</Label><Input name="title" defaultValue={edit.title ?? ""} required /></div>
                <div className="space-y-1"><Label>Game</Label><Input name="game" defaultValue={edit.game ?? ""} placeholder="BGMI / Valorant" required /></div>
                <div className="space-y-1">
                  <Label>Format</Label>
                  <select name="format" defaultValue={edit.format ?? "solo"} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                    <option value="solo">Solo</option><option value="duo">Duo</option><option value="squad">Squad</option>
                  </select>
                </div>
                <div className="space-y-1"><Label>Entry fee (₹)</Label><Input name="entry_fee" type="number" min={0} defaultValue={edit.entry_fee ?? 0} required /></div>
                <div className="space-y-1"><Label>Prize pool (₹)</Label><Input name="prize_pool" type="number" min={0} defaultValue={edit.prize_pool ?? 0} required /></div>
                <div className="space-y-1"><Label>Capacity</Label><Input name="capacity" type="number" min={2} defaultValue={edit.capacity ?? 16} required /></div>
                <div className="space-y-1">
                  <Label>Status</Label>
                  <select name="status" defaultValue={edit.status ?? "upcoming"} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                    <option value="upcoming">Upcoming</option><option value="live">Live</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option>
                  </select>
                </div>
                <div className="space-y-1 sm:col-span-2"><Label>Starts at</Label><Input name="starts_at" type="datetime-local" defaultValue={typeof edit.starts_at === "string" ? edit.starts_at.slice(0, 16) : ""} required /></div>
                <div className="space-y-1 sm:col-span-2"><Label>Banner URL</Label><Input name="banner_url" defaultValue={edit.banner_url ?? ""} placeholder="https://…" /></div>
                <div className="space-y-1 sm:col-span-2"><Label>Rules</Label><Textarea name="rules" defaultValue={edit.rules ?? ""} rows={3} /></div>
              </div>
              <DialogFooter><Button type="submit" style={{ background: "var(--gradient-brand-hot)" }}>{edit.id ? "Save" : "Create"}</Button></DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!view} onOpenChange={(v) => !v && setView(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{view?.title} — Roster</DialogTitle></DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              if (!view) return;
              addReg.mutate({ data: {
                tournament_id: view.id,
                team_name: String(fd.get("team_name")),
                contact: (fd.get("contact") as string) || undefined,
                paid: fd.get("paid") === "on",
              } });
              (e.currentTarget as HTMLFormElement).reset();
            }}
            className="flex flex-wrap items-end gap-2"
          >
            <div className="flex-1 space-y-1"><Label>Team / player</Label><Input name="team_name" required /></div>
            <div className="space-y-1"><Label>Contact</Label><Input name="contact" placeholder="phone" /></div>
            <label className="flex items-center gap-1 text-xs"><input type="checkbox" name="paid" /> Paid</label>
            <Button type="submit" size="sm">Add</Button>
          </form>
          <div className="mt-3 max-h-64 overflow-y-auto rounded-xl border border-border/40">
            {(regsQ.data ?? []).length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">No registrations</div>
            ) : (regsQ.data ?? []).map((r: { id: string; team_name: string; contact: string | null; paid: boolean; seat_no: number | null }, i: number) => (
              <div key={r.id} className="flex items-center justify-between border-b border-border/40 px-3 py-2 text-sm last:border-0">
                <span className="font-mono text-xs text-muted-foreground">#{r.seat_no ?? i + 1}</span>
                <span className="flex-1 px-3 font-medium">{r.team_name}</span>
                <span className="text-xs text-muted-foreground">{r.contact ?? "—"}</span>
                <Badge className="ml-2" variant={r.paid ? "default" : "secondary"}>{r.paid ? "Paid" : "Unpaid"}</Badge>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Trophy; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/40 bg-background/40 p-2">
      <div className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground"><Icon className="h-3 w-3" />{label}</div>
      <div className="mt-0.5 font-display font-bold">{value}</div>
    </div>
  );
}
