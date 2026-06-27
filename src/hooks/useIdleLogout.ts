import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/lib/supabase/client";
import { toast } from "sonner";

/**
 * Sign the user out after `timeoutMs` of inactivity (no mouse, key, touch, scroll).
 * Activity in any open tab resets the timer (cross-tab via localStorage ping).
 */
export function useIdleLogout(timeoutMs = 30 * 60 * 1000) {
  const navigate = useNavigate();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const STORAGE_KEY = "cc:last-activity";
    let timer: number | undefined;

    const signOut = async () => {
      try { await supabase.auth.signOut(); } catch {}
      toast.message("Signed out for inactivity", {
        description: "You were idle for 30 minutes.",
      });
      navigate({ to: "/auth", replace: true });
    };

    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(signOut, timeoutMs);
    };

    const bump = () => {
      try { localStorage.setItem(STORAGE_KEY, String(Date.now())); } catch {}
      schedule();
    };

    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) schedule();
    };

    const events: (keyof WindowEventMap)[] = [
      "mousemove", "mousedown", "keydown", "touchstart", "scroll", "visibilitychange",
    ];
    events.forEach((ev) => window.addEventListener(ev, bump, { passive: true }));
    window.addEventListener("storage", onStorage);
    schedule();

    return () => {
      window.clearTimeout(timer);
      events.forEach((ev) => window.removeEventListener(ev, bump));
      window.removeEventListener("storage", onStorage);
    };
  }, [navigate, timeoutMs]);
}
