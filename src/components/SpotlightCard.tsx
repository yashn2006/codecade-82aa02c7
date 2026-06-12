import { useRef, type ReactNode, type HTMLAttributes } from "react";
import { motion, useMotionValue, useMotionTemplate } from "framer-motion";

type Props = {
  children: ReactNode;
  className?: string;
  /** spotlight color in oklch var or hex/oklch literal */
  color?: string;
  /** spotlight radius px */
  size?: number;
} & Omit<HTMLAttributes<HTMLDivElement>, "color">;

/**
 * Hover card with a cursor-following spotlight + soft border-glow.
 * Drop-in wrapper for any panel — preserves children.
 */
export function SpotlightCard({
  children,
  className = "",
  color = "oklch(var(--primary) / 0.18)",
  size = 280,
  ...rest
}: Props) {
  const x = useMotionValue(-9999);
  const y = useMotionValue(-9999);
  const ref = useRef<HTMLDivElement>(null);

  const bg = useMotionTemplate`radial-gradient(${size}px circle at ${x}px ${y}px, ${color}, transparent 70%)`;

  return (
    <div
      ref={ref}
      onPointerMove={(e) => {
        const r = ref.current?.getBoundingClientRect(); if (!r) return;
        x.set(e.clientX - r.left); y.set(e.clientY - r.top);
      }}
      onPointerLeave={() => { x.set(-9999); y.set(-9999); }}
      className={`group relative overflow-hidden rounded-2xl border border-border/60 bg-card/40 backdrop-blur transition-colors hover:border-primary/40 ${className}`}
      {...rest}
    >
      <motion.div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" style={{ background: bg }} />
      <div className="relative">{children}</div>
    </div>
  );
}
