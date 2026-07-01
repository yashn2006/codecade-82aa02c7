import { useRef } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useIsMobile } from "@/hooks/use-mobile";

/**
 * Immersive 3D hero backdrop for owner console headers.
 * Cursor-tilted parallax stage with orbiting rings, glowing core,
 * scan grid, drifting particles, and a holographic gradient.
 */
export function HeroBackdrop3D() {
  const isMobile = useIsMobile();
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rx = useSpring(useTransform(my, [-1, 1], [6, -6]), { stiffness: 120, damping: 18 });
  const ry = useSpring(useTransform(mx, [-1, 1], [-8, 8]), { stiffness: 120, damping: 18 });
  const px = useSpring(useTransform(mx, [-1, 1], [-18, 18]), { stiffness: 80, damping: 20 });
  const py = useSpring(useTransform(my, [-1, 1], [-12, 12]), { stiffness: 80, damping: 20 });

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    if (isMobile) return;
    const r = e.currentTarget.getBoundingClientRect();
    mx.set(((e.clientX - r.left) / r.width) * 2 - 1);
    my.set(((e.clientY - r.top) / r.height) * 2 - 1);
  }
  function onLeave() { mx.set(0); my.set(0); }

  if (isMobile) {
    return (
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at top, rgba(120,40,200,.25), transparent 60%)" }} />
      </div>
    );
  }

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className="pointer-events-auto absolute inset-0 -z-10 overflow-hidden"
      aria-hidden
      style={{ perspective: 1400 }}
    >
      {/* base gradient wash */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,oklch(0.32_0.18_320/0.45),transparent_55%),radial-gradient(ellipse_at_bottom_right,oklch(0.32_0.2_260/0.4),transparent_55%)]" />
      {/* grid */}
      <div className="absolute inset-0 grid-arcade opacity-40" />
      {/* top hairline */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/70 to-transparent" />

      {/* parallax 3D stage */}
      <motion.div
        style={{ rotateX: rx, rotateY: ry, transformStyle: "preserve-3d" }}
        className="absolute inset-0"
      >
        {/* glowing orb core */}
        <motion.div
          style={{ x: px, y: py }}
          className="absolute left-1/2 top-1/2 h-[280px] w-[280px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[80px]"
        >
          <div
            className="h-full w-full rounded-full opacity-70 animate-pulse-soft"
            style={{ background: "radial-gradient(circle, oklch(0.72 0.26 330 / 0.85), transparent 65%)" }}
          />
        </motion.div>

        {/* orbiting rings */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 32, repeat: Infinity, ease: "linear" }}
            className="h-[420px] w-[420px] rounded-full border border-primary/30"
            style={{ boxShadow: "0 0 60px -20px oklch(0.72 0.26 330 / 0.6) inset" }}
          >
            <span className="absolute left-1/2 top-0 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow-[0_0_18px_4px_oklch(0.72_0.26_330/0.7)]" />
          </motion.div>
          <motion.div
            animate={{ rotate: -360 }}
            transition={{ duration: 22, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0 m-auto h-[300px] w-[300px] rounded-full border border-accent/30"
          >
            <span className="absolute right-0 top-1/2 h-1.5 w-1.5 -translate-y-1/2 translate-x-1/2 rounded-full bg-accent shadow-[0_0_14px_3px_oklch(0.74_0.21_15/0.7)]" />
          </motion.div>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0 m-auto h-[180px] w-[180px] rounded-full border border-violet/40"
          />
        </div>

        {/* floating shards */}
        {SHARDS.map((s, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: [0, -8, 0] }}
            transition={{ duration: 6 + i, repeat: Infinity, ease: "easeInOut", delay: i * 0.3 }}
            className={`absolute h-1.5 w-1.5 rounded-full ${s.c}`}
            style={{ left: s.x, top: s.y, boxShadow: `0 0 12px 2px currentColor` }}
          />
        ))}
      </motion.div>

      {/* bottom soft fade so content stays readable */}
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-background/80 to-transparent" />
    </div>
  );
}

const SHARDS = [
  { x: "12%", y: "22%", c: "text-primary" },
  { x: "88%", y: "30%", c: "text-accent" },
  { x: "24%", y: "70%", c: "text-violet" },
  { x: "72%", y: "78%", c: "text-magenta" },
  { x: "50%", y: "12%", c: "text-primary" },
  { x: "40%", y: "85%", c: "text-accent" },
];
