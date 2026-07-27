import { Sparkles, AlertTriangle, Clock } from "lucide-react";
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

/** Slim 40px sticky strip. Renders nothing on an active subscription. */
export function TrialBanner({ cafe }: { cafe: TrialInfo | null | undefined }) {
  if (!cafe) return null;
  const status = cafe.subscription_status ?? "trialing";
  if (status === "active") return null;
  const left = daysLeft(cafe.trial_ends_at);
  const expired = status === "expired" || left === 0;
  const urgent = expired || left <= 3;

  return (
    <div
      className="flex h-10 items-center justify-between gap-3 px-3 sm:px-4"
      style={{
        background: expired ? "rgba(239,68,68,0.1)" : urgent ? "rgba(245,158,11,0.1)" : "rgba(255,0,200,0.07)",
        borderBottom: `1px solid ${expired ? "rgba(239,68,68,0.3)" : urgent ? "rgba(245,158,11,0.3)" : "rgba(255,0,200,0.25)"}`,
        backdropFilter: "blur(16px)",
      }}
    >
      <div className="flex min-w-0 items-center gap-2 text-[12px]">
        {expired
          ? <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-rose-300" />
          : <Clock className={`h-3.5 w-3.5 shrink-0 ${urgent ? "text-amber-300" : "text-primary"}`} />}
        <span className="truncate">
          {expired ? (
            <><span className="font-semibold text-rose-200">Trial ended</span>
              <span className="text-foreground/70"> · Upgrade to unlock all features</span></>
          ) : (
            <><span className="font-semibold">{left} {left === 1 ? "day" : "days"} left</span>
              <span className="text-foreground/70"> in your free trial</span></>
          )}
        </span>
      </div>
      <Link
        to="/"
        hash="pricing"
        className="inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold text-primary-foreground"
        style={{ background: "var(--gradient-brand-hot)" }}
      >
        <Sparkles className="h-3 w-3" /> Upgrade →
      </Link>
    </div>
  );
}
