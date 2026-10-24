import pcArt from "@/assets/livefloor/station-pc.webp";
import consoleArt from "@/assets/livefloor/station-console.webp";
import vrArt from "@/assets/livefloor/station-vr.webp";
import racingArt from "@/assets/livefloor/station-racing.webp";

/** Top-down 3D render for each station type. All share one 640×560 canvas, bottom-aligned. */
export const STATION_ART: Record<string, string> = {
  pc: pcArt,
  console: consoleArt,
  vr: vrArt,
  racing: racingArt,
  other: pcArt,
};

export const STATION_ART_SIZE = { width: 640, height: 560 } as const;

export function stationArt(type: string | null | undefined): string {
  return STATION_ART[type ?? "pc"] ?? pcArt;
}
