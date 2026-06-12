import { useRef, type ReactNode } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";
import { Button } from "@/components/ui/button";
import type { ComponentProps } from "react";

type Props = ComponentProps<typeof Button> & { children: ReactNode; magnetStrength?: number };

/** Subtly pulls toward the cursor on hover. Wraps shadcn Button. */
export function MagneticButton({ children, magnetStrength = 0.35, className, ...rest }: Props) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 200, damping: 18 });
  const sy = useSpring(y, { stiffness: 200, damping: 18 });
  const ref = useRef<HTMLDivElement>(null);

  return (
    <motion.div
      ref={ref}
      style={{ x: sx, y: sy, display: "inline-block" }}
      onPointerMove={(e) => {
        const r = ref.current?.getBoundingClientRect(); if (!r) return;
        x.set((e.clientX - r.left - r.width / 2) * magnetStrength);
        y.set((e.clientY - r.top - r.height / 2) * magnetStrength);
      }}
      onPointerLeave={() => { x.set(0); y.set(0); }}
    >
      <Button className={className} {...rest}>{children}</Button>
    </motion.div>
  );
}
