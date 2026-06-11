import { Meteors } from "@/components/Meteors";

/**
 * Obsidian ambience — magenta/rose/violet glow blobs, scan grid + meteors.
 * `immersive` adds a denser meteor shower + extra glow for owner consoles.
 */
export function AuroraBackground({
  intensity = "default",
}: {
  intensity?: "default" | "hero" | "immersive";
}) {
  const hero = intensity === "hero";
  const immersive = intensity === "immersive";
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden grain -z-10" aria-hidden>
      <div
        className="absolute -top-40 -left-40 h-[640px] w-[640px] rounded-full blur-[120px] opacity-60 animate-blob"
        style={{ background: "radial-gradient(circle, oklch(0.7 0.26 335 / 0.55), transparent 65%)" }}
      />
      <div
        className="absolute -top-32 right-[-12rem] h-[560px] w-[560px] rounded-full blur-[120px] opacity-55 animate-blob"
        style={{
          background: "radial-gradient(circle, oklch(0.74 0.21 15 / 0.45), transparent 65%)",
          animationDelay: "-6s",
        }}
      />
      <div
        className="absolute bottom-[-12rem] left-1/3 h-[640px] w-[640px] rounded-full blur-[140px] opacity-50 animate-blob"
        style={{
          background: "radial-gradient(circle, oklch(0.65 0.25 295 / 0.45), transparent 65%)",
          animationDelay: "-12s",
        }}
      />
      {(hero || immersive) && (
        <div
          className="absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[100px] opacity-40 animate-pulse-soft"
          style={{ background: "radial-gradient(circle, oklch(0.74 0.21 15 / 0.55), transparent 70%)" }}
        />
      )}
      {immersive && (
        <div
          className="absolute right-[-10rem] bottom-[-6rem] h-[480px] w-[480px] rounded-full blur-[120px] opacity-50 animate-blob"
          style={{
            background: "radial-gradient(circle, oklch(0.78 0.18 200 / 0.45), transparent 65%)",
            animationDelay: "-9s",
          }}
        />
      )}

      <div className="absolute inset-0 grid-arcade" />
      <Meteors count={immersive ? 22 : hero ? 14 : 8} />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
    </div>
  );
}
