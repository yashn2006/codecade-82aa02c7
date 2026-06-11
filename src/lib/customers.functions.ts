import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/supabase/auth-middleware";

export const listCustomers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ cafe_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("customers")
      .select("id, full_name, phone, email, wallet_balance, created_at")
      .eq("cafe_id", data.cafe_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      cafe_id: z.string().uuid(),
      full_name: z.string().min(1).max(120),
      phone: z.string().max(20).optional().nullable(),
      email: z.string().email().max(200).optional().nullable().or(z.literal("")),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("customers")
      .insert({
        cafe_id: data.cafe_id,
        full_name: data.full_name,
        phone: data.phone || null,
        email: data.email || null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });
