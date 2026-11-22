import type { SupabaseClient } from "@supabase/supabase-js";

export type WriteAuditInput = {
  cafeId: string | null | undefined;
  actorId: string | null | undefined;
  action: string;
  resourceType?: string | null;
  resourceId?: string | null;
  meta?: Record<string, unknown>;
  supabase?: SupabaseClient;
};

export async function writeAudit({
  cafeId,
  actorId,
  action,
  resourceType = null,
  resourceId = null,
  meta = {},
  supabase,
}: WriteAuditInput): Promise<void> {
  if (!cafeId) return;
  try {
    const { hasSupabaseAdminKey, supabaseAdmin } = await import("@/lib/supabase/client.server");
    const db = hasSupabaseAdminKey() ? supabaseAdmin : supabase;
    if (!db) return;

    let actorEmail: string | null = null;
    if (actorId) {
      const { data: profile } = await db
        .from("profiles")
        .select("email")
        .eq("id", actorId)
        .maybeSingle();
      actorEmail = (profile as { email?: string | null } | null)?.email ?? null;
    }

    const { error } = await db.from("audit_logs").insert({
      cafe_id: cafeId,
      actor_id: actorId ?? null,
      actor_email: actorEmail,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      meta,
    });
    if (error) {
      console.warn("Audit write failed:", error.message);
    }
  } catch (err) {
    console.warn("Audit write failed:", err);
  }
}
