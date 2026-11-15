import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/cafe/$slug/ledger")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/cafe/$slug/wallet", params: { slug: params.slug } });
  },
  component: () => null,
});
