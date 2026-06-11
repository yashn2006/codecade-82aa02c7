import { useEffect, useRef, useState } from "react";

export function AnimatedNumber({
  value,
  duration = 1400,
  prefix = "",
  suffix = "",
  format,
  className = "",
}: {
  value: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  format?: (n: number) => string;
  className?: string;
}) {
  const [n, setN] = useState(0);
  const startedRef = useRef(false);
  const elRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !startedRef.current) {
          startedRef.current = true;
          const start = performance.now();
          const step = (t: number) => {
            const p = Math.min(1, (t - start) / duration);
            const eased = 1 - Math.pow(1 - p, 3);
            setN(value * eased);
            if (p < 1) requestAnimationFrame(step);
            else setN(value);
          };
          requestAnimationFrame(step);
        }
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [value, duration]);

  const display = format ? format(n) : Math.round(n).toLocaleString("en-IN");
  return (
    <span ref={elRef} className={className}>
      {prefix}
      {display}
      {suffix}
    </span>
  );
}
