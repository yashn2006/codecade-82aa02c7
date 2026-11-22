import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/supabase/auth-middleware";

export const DEVICE_STATUSES = ["available", "in_use", "reserved", "suspended", "maintenance"] as const;
export type DeviceStatus = (typeof DEVICE_STATUSES)[number];

const DeviceInput = z.object({
  cafe_id: z.string().uuid(),
  name: z.string().min(1).max(80),
  type: z.enum(["pc", "console", "vr", "racing", "other"]),
  hourly_rate: z.number().int().min(0).max(100000),
  status: z.enum(DEVICE_STATUSES).optional(),
  notes: z.string().max(280).nullable().optional(),
  pos_x: z.number().int().min(0).max(60).nullable().optional(),
  pos_y: z.number().int().min(0).max(60).nullable().optional(),
  zone: z.string().max(40).nullable().optional(),
  zone_color: z.string().max(20).nullable().optional(),
  specs: z.record(z.string(), z.any()).nullable().optional(),
});

export const listDevices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ cafe_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { assertCafeAccess } = await import("@/lib/staff-access.server");
    await assertCafeAccess(context.userId, data.cafe_id, undefined, context.supabase);
    // Auto-expire suspensions opportunistically (best-effort, ignore errors).
    await context.supabase.rpc("expire_device_suspensions").then(() => {}, () => {});
    const { data: rows, error } = await context.supabase
      .from("devices")
      .select("*")
      .eq("cafe_id", data.cafe_id)
      .order("name");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => DeviceInput.parse(d))
  .handler(async ({ data, context }) => {
    const { assertCafeAccess } = await import("@/lib/staff-access.server");
    await assertCafeAccess(context.userId, data.cafe_id, "manage_devices", context.supabase);
    const { error, data: row } = await context.supabase
      .from("devices")
      .insert(data)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      patch: DeviceInput.partial(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { assertCafeAccess, lookupCafeId } = await import("@/lib/staff-access.server");
    const cafeId = await lookupCafeId("devices", data.id, context.supabase);
    await assertCafeAccess(context.userId, cafeId, "manage_devices", context.supabase);
    const rateChanged = data.patch.hourly_rate !== undefined;
    const prev = rateChanged
      ? (
          await context.supabase
            .from("devices")
            .select("cafe_id, name, hourly_rate")
            .eq("id", data.id)
            .maybeSingle()
        ).data
      : null;

    const { error } = await context.supabase
      .from("devices")
      .update(data.patch)
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    if (rateChanged && prev && prev.hourly_rate !== data.patch.hourly_rate) {
      const { writeAudit } = await import("@/lib/audit.server");
      await writeAudit({
        supabase: context.supabase,
        cafeId: prev.cafe_id,
        actorId: context.userId,
        action: "device.price_changed",
        resourceType: "device",
        resourceId: data.id,
        meta: {
          name: data.patch.name ?? prev.name,
          previous_rate: prev.hourly_rate,
          new_rate: data.patch.hourly_rate,
        },
      });
    }
    return { ok: true };
  });

export const deleteDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { assertCafeAccess, lookupCafeId } = await import("@/lib/staff-access.server");
    const cafeId = await lookupCafeId("devices", data.id, context.supabase);
    await assertCafeAccess(context.userId, cafeId, "manage_devices", context.supabase);
    const { error } = await context.supabase.from("devices").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Quick floor-control: set station status with optional suspend timer.
 * - status = "suspended" + suspend_minutes -> sets suspend_until = now + minutes
 * - any other status -> clears suspend_until
 */
export const setDeviceStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      status: z.enum(DEVICE_STATUSES),
      suspend_minutes: z.number().int().min(1).max(720).optional(),
      notes: z.string().max(280).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { hasSupabaseAdminKey, supabaseAdmin } = await import("@/lib/supabase/client.server");
    const db = hasSupabaseAdminKey() ? supabaseAdmin : context.supabase;
    const { data: dev } = await db
      .from("devices")
      .select("cafe_id, status")
      .eq("id", data.id)
      .maybeSingle();
    if (!dev) throw new Error("Device not found");
    const { assertCafeAccess } = await import("@/lib/staff-access.server");
    const needsDeviceAdmin =
      data.status === "maintenance" ||
      data.status === "suspended" ||
      dev.status === "maintenance" ||
      dev.status === "suspended" ||
      data.notes !== undefined;
    await assertCafeAccess(
      context.userId,
      dev.cafe_id,
      needsDeviceAdmin ? "manage_devices" : ["manage_devices", "create_bookings", "start_sessions"],
      context.supabase,
    );
    const patch: Record<string, unknown> = { status: data.status };
    if (data.status === "suspended" && data.suspend_minutes) {
      patch.suspend_until = new Date(Date.now() + data.suspend_minutes * 60_000).toISOString();
    } else {
      patch.suspend_until = null;
    }
    if (data.notes !== undefined) patch.notes = data.notes;
    const { error } = await context.supabase.from("devices").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Fast drag-and-drop placement on the floor builder grid. */
export const placeDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      pos_x: z.number().int().min(0).max(60).nullable(),
      pos_y: z.number().int().min(0).max(60).nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { assertCafeAccess, lookupCafeId } = await import("@/lib/staff-access.server");
    const cafeId = await lookupCafeId("devices", data.id, context.supabase);
    await assertCafeAccess(context.userId, cafeId, "manage_devices", context.supabase);
    const { error } = await context.supabase
      .from("devices")
      .update({ pos_x: data.pos_x, pos_y: data.pos_y })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
