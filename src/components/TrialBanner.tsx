import { Sparkles, AlertTriangle, Clock, Zap } from "lucide-react";
import { Link } from "@tanstack/react-router";

export type TrialInfo = {
  plan?: string | null;
  subscription_status?: string | null;
  trial_ends_at?: string | null;
};

const TRIAL_LENGTH_DAYS = 15;

function daysLeft(endsAt: string | null | undefined): number {
  if (!endsAt) return 0;
  const ms = new Date(endsAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

/** Slim 40px sticky strip with a countdown progress bar. Hidden on active subs. */
export function TrialBanner({ cafe }: { cafe: TrialInfo | null | undefined }) {
  if (!cafe) return null;
  const status = cafe.subscription_status ?? "trialing";
  if (status === "active") return null;
  const left = daysLeft(cafe.trial_ends_at);
  const expired = status === "expired" || left === 0;

  const tone = expired || left <= 5
    ? { key: "red", accent: "#f43f5e", bg: "rgba(244,63,94,0.10)", border: "rgba(244,63,94,0.32)" }
    : left <= 10
      ? { key: "amber", accent: "#f59e0b", bg: "rgba(245,158,11,0.10)", border: "rgba(245,158,11,0.32)" }
      : { key: "green", accent: "#22c55e", bg: "rgba(34,197,94,0.09)", border: "rgba(34,197,94,0.28)" };

  const pct = Math.max(0, Math.min(100, (left / TRIAL_LENGTH_DAYS) * 100));
  const urgent = expired || left <= 5;

  return (
    <div
      className="relative flex h-10 items-center justify-between gap-3 px-3 sm:px-4"
      style={{ background: tone.bg, borderBottom: `1px solid ${tone.border}`, backdropFilter: "blur(16px)" }}
    >
      {/* countdown progress bar */}
      <span className="pointer-events-none absolute inset-x-0 bottom-0 h-[3px] bg-white/5" aria-hidden>
        <span
          className="block h-full transition-[width] duration-700"
          style={{
            width: `${expired ? 100 : pct}%`,
            background: `linear-gradient(90deg, ${tone.accent}, ${tone.accent}66)`,
            boxShadow: `0 0 12px ${tone.accent}`,
          }}
        />
      </span>

      <div className="flex min-w-0 items-center gap-2 text-[12px]">
        {expired
          ? <AlertTriangle className="h-3.5 w-3.5 shrink-0" style={{ color: tone.accent }} />
          : <Clock className={`h-3.5 w-3.5 shrink-0 ${urgent ? "animate-dot-pulse" : ""}`} style={{ color: tone.accent }} />}
        <span className={`truncate ${urgent ? "animate-pulse-soft" : ""}`}>
          {expired ? (
            <><span className="font-semibold" style={{ color: tone.accent }}>Trial ended</span>
              <span className="text-foreground/70"> · Upgrade to unlock all features</span></>
          ) : (
            <><span className="font-semibold" style={{ color: tone.accent }}>{left} {left === 1 ? "day" : "days"} left</span>
              <span className="text-foreground/70"> in your free trial</span></>
          )}
        </span>
        <span className="hidden shrink-0 font-mono text-[10px] text-foreground/40 sm:inline">
          {expired ? "0" : left}/{TRIAL_LENGTH_DAYS}d
        </span>
      </div>

      <Link
        to="/"
        hash="pricing"
        className="btn-glow-magenta inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold text-primary-foreground transition hover:brightness-110"
        style={{ background: "var(--gradient-brand-hot)" }}
      >
        <Zap className="h-3 w-3" /> Upgrade
        <Sparkles className="h-3 w-3 opacity-70" />
      </Link>
    </div>
  );
}
