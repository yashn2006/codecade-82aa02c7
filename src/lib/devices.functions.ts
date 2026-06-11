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
    const { error } = await context.supabase
      .from("devices")
      .update(data.patch)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
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
