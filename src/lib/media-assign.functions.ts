import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * One record, many views: media rows keep living where they were created and
 * gain (or lose) a property link here. Nothing is copied, so Media and the
 * property page always read the same row.
 *
 * Ownership is enforced twice: RLS scopes every statement to the signed-in
 * user, and the property itself is re-read against `owner_id` before any row
 * is pointed at it.
 */

const ItemSchema = z.object({
  kind: z.enum(["upload", "video", "presentation"]),
  id: z.string().uuid(),
});

const InputSchema = z.object({
  items: z.array(ItemSchema).min(1).max(200),
  /** null unassigns the items and returns them to the unassigned bucket. */
  property_id: z.string().uuid().nullable(),
});

export const assignMediaToProperty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    let label: string | null = null;
    if (data.property_id) {
      const { data: prop, error } = await supabase
        .from("properties")
        .select("id, address, owner_id")
        .eq("id", data.property_id)
        .eq("owner_id", userId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!prop) throw new Error("That property is not in your workspace.");
      label = (prop as any).address ?? null;
    }

    const ids = (kind: string) => data.items.filter((i) => i.kind === kind).map((i) => i.id);
    const uploads = ids("upload");
    const videos = ids("video");
    const packages = ids("presentation");
    let moved = 0;

    if (uploads.length) {
      const { error, count } = await supabase
        .from("property_media_assets")
        .update({ property_id: data.property_id, property_label: label } as any, { count: "exact" })
        .in("id", uploads)
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
      moved += count ?? uploads.length;
    }
    if (videos.length) {
      const { error, count } = await supabase
        .from("video_projects")
        .update({ property_id: data.property_id, property_label: label } as any, { count: "exact" })
        .in("id", videos)
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
      moved += count ?? videos.length;
    }
    if (packages.length) {
      const { error, count } = await supabase
        .from("presentation_packages")
        .update({ property_id: data.property_id, property_label: label } as any, { count: "exact" })
        .in("id", packages)
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
      moved += count ?? packages.length;
    }

    return { moved, property_id: data.property_id, property_label: label };
  });
