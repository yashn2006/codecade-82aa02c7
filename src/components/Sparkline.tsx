import { motion } from "framer-motion";

export function Sparkline({
  data,
  accent = "violet",
  height = 56,
}: {
  data: { d: string; v: number }[];
  accent?: "violet" | "azure" | "magenta";
  height?: number;
}) {
  const max = Math.max(1, ...data.map((p) => p.v));
  const w = 100;
  const step = data.length > 1 ? w / (data.length - 1) : w;
  const pts = data.map((p, i) => [i * step, height - (p.v / max) * (height - 6) - 3] as const);
  const path = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
  const fill = `${path} L${w},${height} L0,${height} Z`;
  const accentVar = `var(--${accent})`;
  return (
    <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" className="block h-14 w-full">
      <defs>
        <linearGradient id={`spark-${accent}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={`oklch(${accentVar} / 0.55)`} />
          <stop offset="100%" stopColor={`oklch(${accentVar} / 0)`} />
        </linearGradient>
      </defs>
      <motion.path
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.9, ease: "easeOut" }}
        d={path}
        fill="none"
        stroke={`oklch(${accentVar} / 1)`}
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
      <motion.path
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4, duration: 0.6 }}
        d={fill} fill={`url(#spark-${accent})`}
      />
    </svg>
  );
}
