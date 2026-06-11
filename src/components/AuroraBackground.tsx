/**
 * Soft daylight ambience — pastel violet/coral/magenta blobs on cream.
 */
export function AuroraBackground({ intensity = "default" }: { intensity?: "default" | "hero" }) {
  const hero = intensity === "hero";
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden grain -z-10" aria-hidden>
      <div
        className="absolute -top-40 -left-40 h-[640px] w-[640px] rounded-full blur-[120px] opacity-50 animate-blob"
        style={{ background: "radial-gradient(circle, oklch(0.55 0.26 292 / 0.32), transparent 65%)" }}
      />
      <div
        className="absolute -top-32 right-[-12rem] h-[560px] w-[560px] rounded-full blur-[120px] opacity-45 animate-blob"
        style={{
          background: "radial-gradient(circle, oklch(0.7 0.22 25 / 0.30), transparent 65%)",
          animationDelay: "-6s",
        }}
      />
      <div
        className="absolute bottom-[-12rem] left-1/3 h-[640px] w-[640px] rounded-full blur-[140px] opacity-40 animate-blob"
        style={{
          background: "radial-gradient(circle, oklch(0.62 0.26 335 / 0.28), transparent 65%)",
          animationDelay: "-12s",
        }}
      />
      {hero && (
        <div
          className="absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[100px] opacity-30 animate-pulse-soft"
          style={{ background: "radial-gradient(circle, oklch(0.7 0.22 25 / 0.4), transparent 70%)" }}
        />
      )}

      <div className="absolute inset-0 grid-arcade" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
    </div>
  );
}
