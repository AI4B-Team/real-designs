import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Batch persistence.
 *
 * A batch is durable on its own: it records who ran it, what was applied, the
 * photographs it touched and the per-photo success or failure. Each successful
 * photograph still gets its own saved version through the normal editor save —
 * this row only ties them together so a refresh restores the progress and an
 * undo knows exactly what to reverse.
 */

const Photo = z.object({
  key: z.string().max(200),
  label: z.string().max(160).default(""),
  status: z.enum(["pending", "running", "done", "failed", "undone"]),
  versionId: z.string().max(200).nullable().default(null),
  error: z.string().max(400).nullable().default(null),
  before: z.any().nullable().default(null),
});

const Input = z.object({
  batch_id: z.string().min(1).max(80),
  kind: z.enum(["adjustments", "auto-enhance", "generative", "privacy", "disclosure"]),
  settings: z.record(z.string(), z.any()).default({}),
  source_key: z.string().max(200).nullable().default(null),
  property_id: z.string().uuid().nullable().optional(),
  photos: z.array(Photo).max(300).default([]),
});

export const saveBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const done = data.photos.filter((p) => p.status === "done").length;
    const failed = data.photos.filter((p) => p.status === "failed").length;
    const row = {
      batch_id: data.batch_id,
      user_id: userId,
      kind: data.kind,
      settings: data.settings,
      source_key: data.source_key,
      property_id: data.property_id ?? null,
      photos: data.photos,
      photo_count: data.photos.length,
      success_count: done,
      failure_count: failed,
      completed: data.photos.every((p) => p.status !== "pending" && p.status !== "running"),
      updated_at: new Date().toISOString(),
    };
    const { data: existing } = await supabase
      .from("photo_batches")
      .select("id")
      .eq("batch_id", data.batch_id)
      .maybeSingle();
    if (existing?.id) {
      const { data: out, error } = await supabase
        .from("photo_batches")
        .update(row as any)
        .eq("id", existing.id)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return out;
    }
    const { data: out, error } = await supabase
      .from("photo_batches")
      .insert(row as any)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return out;
  });

export const listBatches = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ limit: z.number().int().min(1).max(50).default(10) }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("photo_batches")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
