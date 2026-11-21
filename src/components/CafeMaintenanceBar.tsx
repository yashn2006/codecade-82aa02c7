import { Wrench } from "lucide-react";
import { MaintenanceScheduler } from "@/components/MaintenanceScheduler";
import { Button } from "@/components/ui/button";
import { isMaintenanceActive } from "@/lib/maintenance";

export type CafeMaintenanceInfo = {
  id: string;
  name: string;
  maintenance_starts_at?: string | null;
  maintenance_ends_at?: string | null;
  maintenance_message?: string | null;
};

export function CafeMaintenanceBar({
  cafe,
  locked = false,
  onSaved,
}: {
  cafe: CafeMaintenanceInfo | null | undefined;
  locked?: boolean;
  onSaved?: () => void;
}) {
  if (!cafe || locked) return null;

  const cafeMaint = {
    starts_at: cafe.maintenance_starts_at ?? null,
    ends_at: cafe.maintenance_ends_at ?? null,
    message: cafe.maintenance_message ?? null,
  };
  const cafeInMaint = isMaintenanceActive(cafeMaint);

  return (
    <div className="liquid-glass-card rounded-2xl p-3 sm:px-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border border-white/10 shadow-lg">
      <div className="flex min-w-0 items-center gap-2.5 text-xs text-muted-foreground">
        <span
          className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${
            cafeInMaint
              ? "bg-amber-400/20 text-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.4)]"
              : "bg-white/[0.06] text-foreground/75"
          }`}
        >
          <Wrench className="h-4 w-4" />
        </span>
        {cafeInMaint ? (
          <span className="font-semibold text-amber-200 leading-snug">
            Maintenance active — public bookings paused.
          </span>
        ) : (
          <span className="text-foreground/85 leading-snug">
            Need to pause for an hour? Schedule maintenance so customers see why.
          </span>
        )}
      </div>
      <div className="shrink-0">
        <MaintenanceScheduler
          scope={{ kind: "cafe", cafeId: cafe.id, cafeName: cafe.name }}
          current={cafeMaint}
          onSaved={onSaved}
          trigger={
            <Button
              size="sm"
              variant={cafeInMaint ? "destructive" : "outline"}
              className="gap-1.5 min-h-[42px] sm:min-h-[36px] sm:h-9 w-full sm:w-auto text-xs font-semibold rounded-xl border-white/10 hover:bg-white/10 whitespace-nowrap"
            >
              <Wrench className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">
                {cafeInMaint ? "Edit maintenance" : "Schedule maintenance"}
              </span>
            </Button>
          }
        />
      </div>
    </div>
  );
}
