import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Listing import API contract.
 *
 * startListingImport records the attempt, validates the URL server-side
 * (allowlisted public listing domains only, no private hosts, no arbitrary
 * proxying) and asks the authorized listing-data provider for structured data.
 * When no compliant provider is connected the import ends in
 * `provider_not_connected` — never in fabricated listing data or photos.
 */

export const startListingImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ url: z.string().min(4).max(1000), property_id: z.string().uuid().nullable().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { checkListingUrl, fetchListing } = await import("@/lib/listing-import.server");
    const supabase = context.supabase;
    const userId = context.userId;

    const check = checkListingUrl(data.url);
    if (!check.ok) {
      return { ok: false as const, status: "failed", code: check.code, message: check.message, import: null };
    }

    // Re-importing the same listing reuses the existing record instead of
    // creating a duplicate property or import row.
    const { data: existing } = await supabase
      .from("listing_imports")
      .select("*")
      .eq("user_id", userId)
      .eq("normalized_url", check.url)
      .order("created_at", { ascending: false })
      .limit(1);

    let row = existing?.[0] || null;
    if (!row) {
      const ins = await supabase
        .from("listing_imports")
        .insert({
          user_id: userId,
          source_url: data.url.slice(0, 1000),
          normalized_url: check.url,
          provider_id: check.provider.id,
          provider_name: check.provider.name,
          status: "processing",
          stage: "retrieving",
          property_id: data.property_id || null,
        })
        .select("*")
        .single();
      if (ins.error) throw new Error(ins.error.message);
      row = ins.data;
    } else {
      await supabase
        .from("listing_imports")
        .update({ status: "processing", stage: "retrieving", error_code: null, error_message: null })
        .eq("id", row.id);
    }

    let listing: Record<string, unknown> | null = null;
    let photos: Array<Record<string, unknown>> = [];
    let note = "";

    const result = await fetchListing(check.url, check.provider.id);
    if (result.ok) {
      listing = result.listing;
      photos = result.photos;
    } else {
      // No licensed provider: read the public link preview only (meta tags and
      // JSON-LD). Details fill in the project; photos still come from the user.
      const { fetchListingMeta } = await import("@/lib/listing-import.server");
      const meta = await fetchListingMeta(check.url, check.provider.id);
      if (meta.ok) {
        listing = meta.listing;
        note = "We pull the address, price, beds, baths and square footage to set up your project. Photos come from you, because listing photos usually belong to the photographer or the brokerage.";
      } else {
        const upd = await supabase
          .from("listing_imports")
          .update({ status: "failed", stage: "failed", error_code: meta.code, error_message: meta.message })
          .eq("id", row.id)
          .select("*")
          .single();
        return {
          ok: false as const,
          status: "failed",
          code: meta.code,
          message: meta.message,
          import: upd.data || row,
        };
      }
    }


    const upd = await supabase
      .from("listing_imports")
      .update({
        status: "ready",
        stage: "ready",
        listing: result.listing as any,
        photos: result.photos as any,
        photo_count: result.photos.length,
        error_code: null,
        error_message: null,
      })
      .eq("id", row.id)
      .select("*")
      .single();

    return { ok: true as const, status: "ready", code: null, message: "", import: upd.data || row };
  });

export const getListingImport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("listing_imports")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { import: row };
  });

export const listListingImports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("listing_imports")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) throw new Error(error.message);
    return { imports: data || [] };
  });

export const linkListingImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        property_id: z.string().uuid().nullable().optional(),
        video_project_id: z.string().uuid().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const patch: { property_id?: string | null; video_project_id?: string | null } = {};
    if (data.property_id !== undefined) patch.property_id = data.property_id ?? null;
    if (data.video_project_id !== undefined) patch.video_project_id = data.video_project_id ?? null;
    const { data: row, error } = await context.supabase
      .from("listing_imports")
      .update(patch)
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { import: row };
  });

/**
 * Address lookup used by the confirm-the-listing modal. Returns provider data
 * when a licensed provider is connected, otherwise reports that plainly so the
 * user can confirm the address they typed and continue.
 */
export const lookupListingByAddress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ address: z.string().min(3).max(300) }).parse(d))
  .handler(async ({ data }) => {
    const { fetchListingByAddress } = await import("@/lib/listing-import.server");
    const r = await fetchListingByAddress(data.address.trim());
    if (!r.ok) return { ok: false as const, code: r.code, message: r.message, listing: null as any, photos: [] as any };
    return { ok: true as const, code: null, message: "", listing: r.listing as any, photos: r.photos as any };
  });
