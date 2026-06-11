import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";

/**
 * Subscribe to postgres changes that matter to the super-admin console and
 * invalidate the related react-query keys so every panel updates in real time.
 */
export function useAdminRealtime() {
  const qc = useQueryClient();
  useEffect(() => {
    const channel = supabase
      .channel("admin-command-center")
      .on("postgres_changes", { event: "*", schema: "public", table: "cafes" }, () => {
        qc.invalidateQueries({ queryKey: ["admin-overview"] });
        qc.invalidateQueries({ queryKey: ["admin-cafes"] });
        qc.invalidateQueries({ queryKey: ["admin-analytics"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => {
        qc.invalidateQueries({ queryKey: ["admin-overview"] });
        qc.invalidateQueries({ queryKey: ["admin-users"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "user_roles" }, () => {
        qc.invalidateQueries({ queryKey: ["admin-users"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "sessions" }, () => {
        qc.invalidateQueries({ queryKey: ["admin-overview"] });
        qc.invalidateQueries({ queryKey: ["admin-analytics"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "contacts" }, () => {
        qc.invalidateQueries({ queryKey: ["admin-overview"] });
        qc.invalidateQueries({ queryKey: ["admin-leads"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "platform_settings" }, () => {
        qc.invalidateQueries({ queryKey: ["platform-maintenance"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);
}
