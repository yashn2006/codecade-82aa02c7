import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/supabase/auth-middleware";

export const DEVICE_COMMANDS = ["lock", "unlock", "screenshot", "message", "reboot", "kill_session"] as const;
export type DeviceCommand = typeof DEVICE_COMMANDS[number];

export const listDeviceCommands = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      cafe_id: z.string().uuid(),
      device_id: z.string().uuid().optional(),
      limit: z.number().int().min(1).max(200).default(50),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("device_commands")
      .select("id, device_id, cafe_id, command, payload, status, result, created_at, executed_at, devices(name)")
      .eq("cafe_id", data.cafe_id)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.device_id) q = q.eq("device_id", data.device_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createDeviceCommand = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      cafe_id: z.string().uuid(),
      device_id: z.string().uuid(),
      command: z.enum(DEVICE_COMMANDS),
      payload: z.record(z.string(), z.any()).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error, data: row } = await context.supabase
      .from("device_commands")
      .insert({
        cafe_id: data.cafe_id,
        device_id: data.device_id,
        command: data.command,
        payload: data.payload ?? {},
        issued_by: context.userId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const cancelDeviceCommand = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("device_commands")
      .update({ status: "cancelled" })
      .eq("id", data.id)
      .eq("status", "pending");
    if (error) throw new Error(error.message);
    return { ok: true };
  });
