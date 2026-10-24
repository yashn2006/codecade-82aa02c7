import { createFileRoute } from "@tanstack/react-router";
import { FloorScene } from "@/components/livefloor/FloorScene";
import { stationCodes, type FloorDevice } from "@/lib/live-floor";

export const Route = createFileRoute("/lf-preview-tmp")({ component: P });

const statuses = ["in_use", "available", "reserved", "in_use", "maintenance", "suspended", "in_use", "available"];
const types = ["pc", "pc", "pc", "console", "pc", "console", "racing", "vr", "pc", "pc", "console", "pc"];
const devices: FloorDevice[] = types.map((t, i) => ({
  id: `d${i}`, name: `${t.toUpperCase()} ${i + 1}`, type: t, hourly_rate: 100, status: statuses[i % statuses.length],
}));

function P() {
  return (
    <div className="lf-root p-6">
      <FloorScene devices={devices} codes={stationCodes(devices)} sessionsByDevice={new Map()} bookingsByDevice={new Map()} selectedId="d1" onSelect={() => {}} />
    </div>
  );
}
