import { motion } from "framer-motion";
import { Sparkles, AlertOctagon, Clock } from "lucide-react";
import { Link } from "@tanstack/react-router";

export type TrialInfo = {
  plan?: string | null;
  subscription_status?: string | null;
  trial_ends_at?: string | null;
};

function daysLeft(endsAt: string | null | undefined): number {
  if (!endsAt) return 0;
  const ms = new Date(endsAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

export function TrialBanner({ cafe }: { cafe: TrialInfo | null | undefined }) {
  if (!cafe) return null;
  const status = cafe.subscription_status ?? "trialing";
  if (status === "active") return null;
  const left = daysLeft(cafe.trial_ends_at);
  const expired = status === "expired" || left === 0;

  if (expired) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
        className="mb-4 overflow-hidden rounded-2xl border border-rose-500/40 bg-gradient-to-r from-rose-500/15 via-card/60 to-rose-500/10 p-4 backdrop-blur"
      >
        <div className="flex flex-wrap items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-rose-500/20 text-rose-300">
            <AlertOctagon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-display text-base font-bold text-rose-200">Free trial ended — café in read-only mode</div>
            <div className="text-xs text-foreground/70">Upgrade to a paid plan to take new bookings, run sessions and access POS.</div>
          </div>
          <Link to="/" hash="pricing" className="inline-flex items-center gap-1.5 rounded-full bg-rose-500 px-4 py-1.5 text-xs font-semibold text-white hover:bg-rose-400">
            <Sparkles className="h-3.5 w-3.5" /> Upgrade now
          </Link>
        </div>
      </motion.div>
    );
  }

  const urgent = left <= 3;
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
      className={`mb-4 overflow-hidden rounded-2xl border p-3 backdrop-blur ${
        urgent ? "border-amber-400/40 bg-amber-400/10" : "border-primary/30 bg-primary/5"
      }`}
    >
      <div className="flex flex-wrap items-center gap-3">
        <div className={`grid h-8 w-8 place-items-center rounded-lg ${urgent ? "bg-amber-400/20 text-amber-200" : "bg-primary/20 text-primary"}`}>
          <Clock className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1 text-sm">
          <span className="font-semibold">Free trial:</span>{" "}
          <span className={urgent ? "text-amber-200" : "text-foreground/80"}>
            {left} {left === 1 ? "day" : "days"} left
          </span>
          <span className="ml-2 text-xs text-muted-foreground">— ends {new Date(cafe.trial_ends_at!).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</span>
        </div>
        <Link to="/" hash="pricing" className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/15 px-3 py-1 text-xs font-semibold text-primary hover:bg-primary/25">
          <Sparkles className="h-3 w-3" /> Upgrade
        </Link>
      </div>
    </motion.div>
  );
}
