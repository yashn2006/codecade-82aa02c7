import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { LifeBuoy } from "lucide-react";
import { motion } from "framer-motion";
import { SupportTickets } from "@/components/SupportTickets";
import { getCafeBySlug } from "@/lib/cafes.functions";

export const Route = createFileRoute("/_authenticated/cafe/$slug/support")({
  head: () => ({
    meta: [
      { title: "Support — Café Console" },
      { name: "description", content: "Open and track support tickets for this café." },
    ],
  }),
  component: CafeSupportPage,
});

function CafeSupportPage() {
  const { slug } = Route.useParams();
  const fn = useServerFn(getCafeBySlug);
  const { data: cafe } = useQuery({ queryKey: ["cafe", slug], queryFn: () => fn({ data: { slug } }) });
  const cafeId = (cafe as { id?: string } | undefined)?.id ?? null;

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
        className="overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-primary/10 via-card/40 to-violet-500/10 p-6 backdrop-blur"
      >
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/20 text-primary">
            <LifeBuoy className="h-6 w-6" />
          </div>
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              Café support
            </div>
            <h2 className="font-display text-2xl font-extrabold tracking-tight">
              Tickets for {cafe?.name ?? "this café"}
            </h2>
            <p className="text-xs text-muted-foreground">
              Anything you raise here is tagged to this café — CoreCade can resolve faster with the right context.
            </p>
          </div>
        </div>
      </motion.div>

      <SupportTickets role="owner" cafeId={cafeId} />
    </div>
  );
}
