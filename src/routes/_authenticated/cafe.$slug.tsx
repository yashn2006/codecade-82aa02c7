import { createFileRoute } from "@tanstack/react-router";
import { Gamepad2 } from "lucide-react";
import { PortalShell } from "./portal";

export const Route = createFileRoute("/_authenticated/cafe/$slug")({
  head: () => ({ meta: [{ title: "Café — CoreCade" }] }),
  component: CafeOwner,
});

function CafeOwner() {
  const { slug } = Route.useParams();
  return (
    <PortalShell title="Café dashboard" subtitle={`Workspace: ${slug}`} badge="Café Owner">
      <div className="mt-12 rounded-2xl border border-border/60 bg-card/40 p-10 text-center backdrop-blur">
        <Gamepad2 className="mx-auto h-12 w-12 text-violet" />
        <h2 className="mt-4 font-display text-2xl font-bold">Your café, ready for liftoff</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Devices, sessions, bookings, memberships — all unlock in Phase 2.
        </p>
      </div>
    </PortalShell>
  );
}
