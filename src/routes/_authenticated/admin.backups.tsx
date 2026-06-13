import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Database, Download, FileJson, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { exportDataset } from "@/lib/admin.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/backups")({
  component: BackupsPage,
});

type Kind = "cafes" | "users" | "orders" | "sessions" | "bookings" | "leads";

const DATASETS: { kind: Kind; title: string; desc: string }[] = [
  { kind: "cafes", title: "Cafés", desc: "Every café, owner mapping, status, and restrictions." },
  { kind: "users", title: "Users", desc: "All profiles with names, emails, and signup dates." },
  { kind: "orders", title: "Orders", desc: "POS orders with totals, refunds, and payment method." },
  { kind: "sessions", title: "Sessions", desc: "Device play-sessions across the network." },
  { kind: "bookings", title: "Bookings", desc: "All slot bookings (deposit, status, time window)." },
  { kind: "leads", title: "Leads", desc: "Inbound contact-form submissions." },
];

function BackupsPage() {
  const fn = useServerFn(exportDataset);
  const [busy, setBusy] = useState<Kind | null>(null);

  async function download(kind: Kind) {
    setBusy(kind);
    try {
      const rows = await fn({ data: { kind } });
      const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      a.href = url;
      a.download = `corecade-${kind}-${stamp}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${rows.length} ${kind}`);
    } catch (e: any) {
      toast.error(e?.message ?? "Export failed");
    } finally {
      setBusy(null);
    }
  }

  async function downloadAll() {
    setBusy("cafes");
    try {
      const all: Record<string, unknown> = { exported_at: new Date().toISOString() };
      for (const d of DATASETS) {
        all[d.kind] = await fn({ data: { kind: d.kind } });
      }
      const blob = new Blob([JSON.stringify(all, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      a.href = url;
      a.download = `corecade-full-backup-${stamp}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Full backup downloaded");
    } catch (e: any) {
      toast.error(e?.message ?? "Backup failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-card/60 to-cyan-500/10 p-5 backdrop-blur"
      >
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-emerald-300" />
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-300">Data & backups</div>
            </div>
            <h2 className="mt-1 font-display text-2xl font-bold">Snapshot the entire network</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Download a JSON snapshot of every key table — cafés, users, orders, sessions, bookings, and leads.
              Use it for offline analysis, audits, or to keep a cold backup outside Supabase.
            </p>
          </div>
          <Button onClick={downloadAll} disabled={!!busy} className="gap-2" style={{ background: "var(--gradient-brand-hot)" }}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Download full backup
          </Button>
        </div>
      </motion.div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {DATASETS.map((d, i) => (
          <motion.div
            key={d.kind}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
            className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/40 p-5 backdrop-blur hover-lift"
          >
            <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-emerald-500/10 blur-2xl" />
            <FileJson className="relative h-5 w-5 text-emerald-300" />
            <h3 className="relative mt-3 font-display text-lg font-bold capitalize">{d.title}</h3>
            <p className="relative mt-1 text-sm text-muted-foreground">{d.desc}</p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => download(d.kind)}
              disabled={!!busy}
              className="relative mt-4 gap-1.5"
            >
              {busy === d.kind ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              Export JSON
            </Button>
          </motion.div>
        ))}
      </div>

      <div className="rounded-2xl border border-border/60 bg-card/40 p-5 text-sm text-muted-foreground">
        <div className="flex items-center gap-2 text-foreground">
          <ShieldCheck className="h-4 w-4 text-emerald-300" />
          <span className="font-medium">Privacy & retention</span>
        </div>
        <p className="mt-1">
          Exports include personal data. Store them encrypted, share only with authorized staff,
          and delete copies you no longer need. Supabase also keeps automatic point-in-time
          backups on the database — this export is a complementary, application-level snapshot.
        </p>
      </div>
    </div>
  );
}
