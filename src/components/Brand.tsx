import { Link } from "@tanstack/react-router";

export function BrandMark({ size = 36, className = "" }: { size?: number; className?: string }) {
  return (
    <div
      className={`relative inline-flex shrink-0 items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      <div
        className="pointer-events-none absolute inset-0 rounded-xl opacity-60 blur-md"
        style={{ background: "linear-gradient(135deg, #ff006e, #7000ff)" }}
        aria-hidden
      />
      <div className="relative flex h-full w-full items-center justify-center rounded-xl border border-white/20 bg-gradient-to-br from-primary/30 via-[#0e0c1a] to-accent/30 shadow-[0_0_20px_oklch(0.7_0.26_335/0.5)] backdrop-blur">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-white"
          style={{ width: Math.round(size * 0.56), height: Math.round(size * 0.56) }}
        >
          <path d="M6 11h4M8 9v4M15 12h.01M18 10h.01" />
          <rect width="20" height="12" x="2" y="6" rx="6" />
        </svg>
      </div>
    </div>
  );
}

export function BrandLockup({
  size = 32,
  badge,
  to = "/",
  params,
}: {
  size?: number;
  badge?: string;
  to?: string;
  params?: Record<string, string>;
}) {
  return (
    <Link
      to={to as never}
      params={params as never}
      className="group inline-flex items-center gap-2.5 leading-none"
    >
      <BrandMark size={size} className="transition-transform group-hover:scale-105" />
      <span className="inline-flex items-baseline gap-2 leading-none">
        <span
          className="font-display font-extrabold tracking-tight leading-none"
          style={{ fontSize: `${Math.round(size * 0.58)}px` }}
        >
          <span className="text-foreground">core</span>
          <span className="text-gradient">cade</span>
        </span>
        {badge && (
          <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em] text-primary">
            {badge}
          </span>
        )}
      </span>
    </Link>
  );
}
