import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase/client";

// Short synthesized "coin drop" — no asset needed.
function playCoin() {
  try {
    const AC = (window.AudioContext || (window as any).webkitAudioContext);
    if (!AC) return;
    const ctx = new AC();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "triangle";
    o.frequency.setValueAtTime(880, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.08);
    g.gain.setValueAtTime(0.15, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    o.connect(g).connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + 0.26);
  } catch { /* ignore */ }
}

type Options = { cafeId?: string | null; userId?: string | null };

/**
 * Subscribe to booking / message / payment inserts and surface toasts.
 * Also invalidates related React Query keys so lists refresh live.
 */
export function useRealtime({ cafeId, userId }: Options) {
  const qc = useQueryClient();
  const mounted = useRef(false);

  useEffect(() => {
    if (!cafeId && !userId) return;
    mounted.current = true;
    const channels: ReturnType<typeof supabase.channel>[] = [];

    if (cafeId) {
      const bookings = supabase
        .channel(`rt:bookings:${cafeId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "bookings", filter: `cafe_id=eq.${cafeId}` },
          (payload) => {
            const row: any = payload.new;
            toast.success(`New booking${row?.customer_name ? ` from ${row.customer_name}` : ""}`, {
              description: row?.starts_at ? new Date(row.starts_at).toLocaleString() : undefined,
            });
            qc.invalidateQueries({ queryKey: ["bookings"] });
          },
        )
        .subscribe();
      channels.push(bookings);

      const payments = supabase
        .channel(`rt:payments:${cafeId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "revenue_entries", filter: `cafe_id=eq.${cafeId}` },
          (payload) => {
            const row: any = payload.new;
            const amt = Number(row?.amount ?? 0);
            playCoin();
            toast.success(`Payment received ₹${amt.toLocaleString("en-IN")}`, {
              description: row?.method ? `via ${row.method}` : undefined,
            });
            qc.invalidateQueries({ queryKey: ["revenue"] });
          },
        )
        .subscribe();
      channels.push(payments);
    }

    if (userId) {
      const messages = supabase
        .channel(`rt:msg:${userId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "admin_messages", filter: `recipient_id=eq.${userId}` },
          (payload) => {
            const row: any = payload.new;
            toast(`New message${row?.subject ? `: ${row.subject}` : ""}`, {
              description: row?.body?.slice(0, 120),
            });
            qc.invalidateQueries({ queryKey: ["admin_messages"] });
            qc.invalidateQueries({ queryKey: ["notifications"] });
          },
        )
        .subscribe();
      channels.push(messages);
    }

    return () => {
      mounted.current = false;
      channels.forEach((c) => supabase.removeChannel(c));
    };
  }, [cafeId, userId, qc]);
}
