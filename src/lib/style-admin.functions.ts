import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Admin-only Style Library management. Public style IDs are immutable. */

const Override = z.object({
  style_id: z.string().min(1).max(80),
  display_name: z.string().max(80).nullable().optional(),
  short_description: z.string().max(240).nullable().optional(),
  category: z.string().max(80).nullable().optional(),
  aliases: z.array(z.string().max(80)).max(20).nullable().optional(),
  project_types: z.array(z.string().max(30)).max(6).nullable().optional(),
  preview_image: z.string().max(600).nullable().optional(),
  provider_map: z.record(z.string(), z.string().max(120)).nullable().optional(),
  generation_prompt: z.string().max(1200).nullable().optional(),
  negative_prompt: z.string().max(1200).nullable().optional(),
  sort_order: z.number().int().min(0).max(9999).nullable().optional(),
  is_featured: z.boolean().nullable().optional(),
  is_hidden: z.boolean().optional(),
  is_custom: z.boolean().optional(),
});

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error("Could not verify your access.");
  if (!data) throw new Error("Admin access is required for the Style Library.");
}

export const isStyleAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    return { admin: !!data };
  });

export const listStyleOverrides = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("style_overrides")
      .select("*")
      .order("sort_order", { ascending: true, nullsFirst: false });
    if (error) throw new Error(error.message);
    return { rows: data || [] };
  });

export const saveStyleOverride = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Override.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
    Object.entries(data).forEach(([k, v]) => {
      if (v !== undefined) row[k] = v;
    });
    const { error } = await context.supabase
      .from("style_overrides")
      .upsert(row as never, { onConflict: "style_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteStyleOverride = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ style_id: z.string().min(1).max(80) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const { error } = await context.supabase
      .from("style_overrides")
      .delete()
      .eq("style_id", data.style_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
