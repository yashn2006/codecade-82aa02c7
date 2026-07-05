import { createFileRoute } from "@tanstack/react-router";
import md from "@/content/legal/refund.md?raw";
import { LegalPage } from "@/components/LegalPage";

export const Route = createFileRoute("/refund-policy")({
  head: () => ({
    meta: [
      { title: "Refund Policy — CoreCade" },
      { name: "description", content: "CoreCade Refund & Cancellation Policy." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => <LegalPage title="Refund & Cancellation Policy" markdown={md} />,
});
