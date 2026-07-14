import { Link } from "@tanstack/react-router";
import markAsset from "@/assets/corecade-mark.png.asset.json";

export function BrandMark({ size = 36, className = "" }: { size?: number; className?: string }) {
  return (
    <div
      className={`relative inline-flex shrink-0 items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      <div
        className="pointer-events-none absolute inset-[18%] rounded-full opacity-50 blur-lg"
        style={{ background: "var(--gradient-brand)" }}
        aria-hidden
      />
      <img
        src={markAsset.url}
        alt="CoreCade"
        width={size}
        height={size}
        className="relative block h-full w-full object-contain"
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
  // Use `to as never` + `params as never` so any generated route path is
  // accepted (dashboards pass "/cafe/$slug" with { slug }). TanStack still
  // resolves it correctly at runtime.
  return (
    <Link to={to as never} params={params as never} className="group inline-flex items-center gap-2.5 leading-none">
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

