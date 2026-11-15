import { Link } from "@tanstack/react-router";

export function BrandMark({ size = 36, className = "" }: { size?: number; className?: string }) {
  const radius = size >= 64 ? "rounded-2xl" : "rounded-xl";
  return (
    <div
      className={`relative inline-flex shrink-0 items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      <div
        className={`pointer-events-none absolute -inset-0.5 ${radius} opacity-65 blur-md`}
        style={{ background: "linear-gradient(135deg, #ff006e, #7000ff)" }}
        aria-hidden
      />
      <div
        className={`relative h-full w-full overflow-hidden ${radius} border border-white/20 bg-[#080210] shadow-[0_0_24px_oklch(0.7_0.26_335/0.5),inset_0_1px_0_rgba(255,255,255,0.22)]`}
      >
        <img
          src="/logo-mark.png"
          alt="CoreCade logo"
          className="h-full w-full object-cover select-none"
          draggable={false}
        />
      </div>
    </div>
  );
}

export function BrandShowcase({
  className = "",
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`group relative overflow-hidden ${compact ? "rounded-2xl" : "rounded-3xl"} border border-white/15 bg-[#080210] shadow-[0_24px_70px_-15px_oklch(0.7_0.26_335/0.45),inset_0_1px_0_rgba(255,255,255,0.2)] ${className}`}
    >
      <div
        className="pointer-events-none absolute -inset-1 opacity-0 blur-2xl transition duration-500 group-hover:opacity-60"
        style={{ background: "linear-gradient(135deg, #ff006e, #7000ff)" }}
        aria-hidden
      />
      <img
        src="/logo.png"
        alt="CoreCade — Discover · Book · Play"
        className="relative block h-full w-full object-cover select-none transition-transform duration-700 group-hover:scale-[1.02]"
        draggable={false}
      />
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-white/[0.06] via-transparent to-transparent"
        aria-hidden
      />
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
      className="group inline-flex shrink-0 items-center gap-2.5 leading-none"
    >
      <BrandMark size={size} className="transition-transform duration-200 group-hover:scale-105" />
      <span className="inline-flex items-baseline gap-2 leading-none">
        <span
          className="font-display font-extrabold tracking-tight leading-none"
          style={{ fontSize: `${Math.round(size * 0.58)}px` }}
        >
          <span className="text-white">Core</span>
          <span className="text-gradient">Cade</span>
        </span>
        {badge && (
          <span className="rounded-full border border-primary/35 bg-primary/15 px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-primary">
            {badge}
          </span>
        )}
      </span>
    </Link>
  );
}
