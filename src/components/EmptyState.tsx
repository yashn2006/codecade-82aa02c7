import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({
  icon: Icon, title, description, action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border/60 bg-card/30 p-12 text-center backdrop-blur">
      <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-border/60 bg-background/60">
        <Icon className="h-6 w-6 text-primary" />
      </div>
      <h3 className="mt-5 font-display text-xl font-bold">{title}</h3>
      {description && <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
