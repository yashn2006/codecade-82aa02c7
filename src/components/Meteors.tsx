import { useMemo } from "react";
import { useIsMobile } from "@/hooks/use-mobile";

/**
 * Pure-CSS meteor shower. Slants left→right with neon trails.
 * Sits inside any `relative` container with overflow-hidden.
 */
export function Meteors({ count = 18, className = "" }: { count?: number; className?: string }) {
  const isMobile = useIsMobile();
  const effectiveCount = isMobile ? 0 : count;
  const meteors = useMemo(
    () =>
      Array.from({ length: effectiveCount }).map((_, i) => ({
        id: i,
        top: Math.random() * 60 - 20, // %
        left: Math.random() * 100, // %
        delay: Math.random() * 8, // s
        duration: 3 + Math.random() * 6, // s
        size: 0.5 + Math.random() * 1.5, // px
      })),
    [effectiveCount],
  );

  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden>
      {meteors.map((m) => (
        <span
          key={m.id}
          className="absolute block"
          style={{
            top: `${m.top}%`,
            left: `${m.left}%`,
            width: `${m.size}px`,
            height: `${m.size}px`,
            background: "white",
            borderRadius: "9999px",
            boxShadow: "0 0 8px 1px rgba(255,255,255,0.6)",
            transform: "rotate(215deg)",
            animation: `meteor ${m.duration}s linear ${m.delay}s infinite`,
            opacity: 0,
          }}
        >
          <span
            className="absolute top-1/2 -translate-y-1/2"
            style={{
              left: "100%",
              width: "120px",
              height: "1px",
              background: "linear-gradient(90deg, rgba(244,114,232,0.85), transparent)",
            }}
          />
        </span>
      ))}
      <style>{`
        @keyframes meteor {
          0%   { transform: translate(0,0) rotate(215deg); opacity: 0; }
          10%  { opacity: 1; }
          70%  { opacity: 1; }
          100% { transform: translate(-700px, 700px) rotate(215deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
