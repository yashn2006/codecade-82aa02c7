import { createFileRoute, Link } from "@tanstack/react-router";
import md from "@/content/legal/terms.md?raw";
import { LegalPage } from "@/components/LegalPage";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — CoreCade" },
      { name: "description", content: "CoreCade Terms of Service." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => <LegalPage title="Terms of Service" markdown={md} />,
});
