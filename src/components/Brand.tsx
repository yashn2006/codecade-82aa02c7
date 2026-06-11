import { Link } from "@tanstack/react-router";
import markAsset from "@/assets/corecade-mark.png.asset.json";

export function BrandMark({ size = 36, className = "" }: { size?: number; className?: string }) {
  return (
    <div
      className={`relative shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      <div
        className="absolute inset-0 rounded-xl blur-md opacity-70"
        style={{ background: "var(--gradient-brand)" }}
        aria-hidden
      />
      <img
        src={markAsset.url}
        alt="CoreCade"
        width={size}
        height={size}
        className="relative h-full w-full object-contain drop-shadow-[0_0_18px_oklch(0.62_0.27_295/0.6)]"
      />
    </div>
  );
}

export function BrandLockup({ size = 36, badge, to = "/" }: { size?: number; badge?: string; to?: string }) {
  return (
    <Link to={to} className="group flex items-center gap-2.5">
      <BrandMark size={size} className="transition-transform group-hover:scale-105" />
      <div className="flex items-baseline gap-2">
        <span className="font-display text-[1.05rem] font-extrabold tracking-tight">
          <span className="text-foreground">core</span>
          <span className="text-gradient">cade</span>
        </span>
        {badge && (
          <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em] text-primary">
            {badge}
          </span>
        )}
      </div>
    </Link>
  );
}
