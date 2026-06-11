/**
 * Layered ambient background:
 *  - three animated color blobs (CSS keyframes, GPU-only transforms)
 *  - faint arcade grid with vignette mask
 *  - SVG film grain overlay
 *
 * Pure CSS — no canvas, no rAF, zero CPU after initial paint.
 */
export function AuroraBackground({ intensity = "default" }: { intensity?: "default" | "hero" }) {
  const hero = intensity === "hero";
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden grain" aria-hidden>
      {/* Blobs */}
      <div
        className="absolute -top-40 -left-40 h-[640px] w-[640px] rounded-full blur-[120px] opacity-60 animate-blob"
        style={{ background: "radial-gradient(circle, oklch(0.62 0.27 295 / 0.55), transparent 65%)" }}
      />
      <div
        className="absolute -top-32 right-[-12rem] h-[560px] w-[560px] rounded-full blur-[120px] opacity-55 animate-blob"
        style={{
          background: "radial-gradient(circle, oklch(0.65 0.24 255 / 0.55), transparent 65%)",
          animationDelay: "-6s",
        }}
      />
      <div
        className="absolute bottom-[-12rem] left-1/3 h-[640px] w-[640px] rounded-full blur-[140px] opacity-50 animate-blob"
        style={{
          background: "radial-gradient(circle, oklch(0.68 0.29 330 / 0.5), transparent 65%)",
          animationDelay: "-12s",
        }}
      />
      {hero && (
        <div
          className="absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[100px] opacity-40 animate-pulse-soft"
          style={{ background: "radial-gradient(circle, oklch(0.7 0.28 290 / 0.55), transparent 70%)" }}
        />
      )}

      {/* Arcade grid */}
      <div className="absolute inset-0 grid-arcade" />

      {/* Top scan line */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
    </div>
  );
}
