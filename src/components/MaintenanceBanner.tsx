import { Wrench } from "lucide-react";
import { motion } from "framer-motion";
import { isMaintenanceActive, maintenanceCountdown, type MaintenanceWindow } from "@/lib/maintenance";

export function MaintenanceBanner({
  window,
  title,
  variant = "default",
}: {
  window: (MaintenanceWindow & { title?: string | null }) | null | undefined;
  title?: string;
  variant?: "default" | "compact";
}) {
  if (!isMaintenanceActive(window)) return null;
  const headline = window?.title || title || "Scheduled maintenance";
  const countdown = maintenanceCountdown(window);
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative overflow-hidden rounded-2xl border border-amber-500/40 bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-rose-500/10 backdrop-blur ${
        variant === "compact" ? "px-4 py-2.5" : "p-4 sm:p-5"
      }`}
      role="alert"
    >
      <div className="pointer-events-none absolute inset-0 opacity-30 [background:repeating-linear-gradient(45deg,transparent_0_10px,oklch(0.78_0.18_75/0.18)_10px_20px)]" />
      <div className="relative flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-500/20 text-amber-300">
          <Wrench className="h-4 w-4 animate-pulse" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-amber-300">
            Maintenance in progress
          </div>
          <div className="font-display text-sm font-bold sm:text-base">{headline}</div>
          {window?.message && (
            <p className="mt-1 text-xs text-foreground/80 sm:text-sm">{window.message}</p>
          )}
          {countdown && (
            <div className="mt-1 font-mono text-[11px] text-amber-200/90">{countdown}</div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
