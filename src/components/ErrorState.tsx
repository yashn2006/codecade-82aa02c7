import { motion } from "framer-motion";
import { AlertTriangle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ErrorState({
  title = "Something went wrong",
  description,
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-destructive/20 bg-destructive/5 p-8 text-center"
      role="alert"
    >
      <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-destructive/30 bg-card text-destructive shadow-soft">
        <AlertTriangle className="h-5 w-5" />
      </div>
      <h3 className="mt-4 font-display text-lg font-bold">{title}</h3>
      {description && <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {onRetry && (
        <Button size="sm" variant="outline" className="mt-4 gap-1.5" onClick={onRetry}>
          <RotateCw className="h-3.5 w-3.5" /> Try again
        </Button>
      )}
    </motion.div>
  );
}
