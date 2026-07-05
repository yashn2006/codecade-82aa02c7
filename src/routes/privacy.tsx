import { createFileRoute } from "@tanstack/react-router";
import md from "@/content/legal/privacy.md?raw";
import { LegalPage } from "@/components/LegalPage";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — CoreCade" },
      { name: "description", content: "CoreCade Privacy Policy." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => <LegalPage title="Privacy Policy" markdown={md} />,
});
