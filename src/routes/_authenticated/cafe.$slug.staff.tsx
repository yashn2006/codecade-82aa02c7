import { createFileRoute } from "@tanstack/react-router";
import { Settings } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";

export const Route = createFileRoute("/_authenticated/cafe/$slug/staff")({
  component: StaffPage,
});

function StaffPage() {
  return (
    <EmptyState
      icon={Settings}
      title="Staff &amp; permissions"
      description="Invite staff and scope what they can do. Coming in Phase 2B with the rest of the team management features."
    />
  );
}
