import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Durable favorites. The heart lives on the user's account, not in a browser
 * cache, so it survives a refresh, a new sign-in and a different device. The
 * favorited asset itself is never read, copied or modified here.
 */

const KINDS = ["media", "design", "version", "project"] as const;

const Ref = z.object({
  kind: z.enum(KINDS),
  id: z.string().min(1).max(200),
  favorite: z.boolean(),
});

export const listFavorites = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("user_favorites")
      .select("item_kind,item_id")
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return (data || []).map((r: any) => ({ kind: r.item_kind as string, id: r.item_id as string }));
  });

export const setFavorite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Ref.parse(d))
  .handler(async ({ data, context }) => {
    if (data.favorite) {
      const { error } = await context.supabase
        .from("user_favorites")
        .upsert(
          { user_id: context.userId, item_kind: data.kind, item_id: data.id },
          { onConflict: "user_id,item_kind,item_id" },
        );
      if (error) throw new Error(error.message);
    } else {
      const { error } = await context.supabase
        .from("user_favorites")
        .delete()
        .eq("user_id", context.userId)
        .eq("item_kind", data.kind)
        .eq("item_id", data.id);
      if (error) throw new Error(error.message);
    }
    return { ok: true, favorite: data.favorite };
  });
