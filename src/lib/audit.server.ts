export type WriteAuditInput = {
  cafeId: string | null | undefined;
  actorId: string | null | undefined;
  action: string;
  resourceType?: string | null;
  resourceId?: string | null;
  meta?: Record<string, unknown>;
};

export async function writeAudit({
  cafeId,
  actorId,
  action,
  resourceType = null,
  resourceId = null,
  meta = {},
}: WriteAuditInput): Promise<void> {
  if (!cafeId) return;
  try {
    const { supabaseAdmin } = await import("@/lib/supabase/client.server");
    let actorEmail: string | null = null;
    if (actorId) {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("email")
        .eq("id", actorId)
        .maybeSingle();
      actorEmail = (profile as { email?: string | null } | null)?.email ?? null;
    }

    const { error } = await supabaseAdmin.from("audit_logs").insert({
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
