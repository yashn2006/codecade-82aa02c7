import { createFileRoute } from "@tanstack/react-router";
import { Users } from "lucide-react";
import { PortalShell } from "./portal";

export const Route = createFileRoute("/_authenticated/cafe/$slug/staff")({
  head: () => ({ meta: [{ title: "Staff — Giganexa" }] }),
  component: StaffView,
});

function StaffView() {
  const { slug } = Route.useParams();
  return (
    <PortalShell title="Staff console" subtitle={`Workspace: ${slug}`} badge="Staff">
      <div className="mt-12 glass rounded-2xl p-10 text-center">
        <Users className="mx-auto h-12 w-12 text-primary" />
        <h2 className="mt-4 font-display text-2xl font-bold">Staff tools land in Phase 2</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Quick session start/stop, customer lookup, device toggles.
        </p>
      </div>
    </PortalShell>
  );
}
