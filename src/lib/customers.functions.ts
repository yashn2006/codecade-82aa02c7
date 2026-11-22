import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/supabase/auth-middleware";

function phoneKey(phone: string | null | undefined): string {
  const digits = (phone ?? "").replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

export const listCustomers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ cafe_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { assertCafeAccess } = await import("@/lib/staff-access.server");
    await assertCafeAccess(context.userId, data.cafe_id, undefined, context.supabase);
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
    const { assertCafeAccess } = await import("@/lib/staff-access.server");
    await assertCafeAccess(context.userId, data.cafe_id, "register_customers", context.supabase);
    const fullName = data.full_name.trim();
    const phone = data.phone?.trim() || null;
    const email = data.email?.trim() || null;

    if (phone) {
      const targetKey = phoneKey(phone);
      const { data: candidates } = await context.supabase
        .from("customers")
        .select("*")
        .eq("cafe_id", data.cafe_id)
        .not("phone", "is", null);

      const existing = (candidates ?? []).find((c) => {
        if ((c.phone ?? "").trim() === phone) return true;
        const k = phoneKey(c.phone);
        return targetKey.length >= 6 && k === targetKey;
      });
      if (existing) return existing;
    }

    const { data: row, error } = await context.supabase
      .from("customers")
      .insert({
        cafe_id: data.cafe_id,
        full_name: fullName,
        phone,
        email,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });
