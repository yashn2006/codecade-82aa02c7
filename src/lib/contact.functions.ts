import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const ContactSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().max(200),
  phone: z.string().max(20).optional().nullable(),
  message: z.string().min(5).max(2000),
});

export const submitContact = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => ContactSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/lib/supabase/client.server");
    const { error } = await supabaseAdmin.from("contacts").insert({
      name: data.name,
      email: data.email,
      phone: data.phone ?? null,
      message: data.message,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
