import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Imports photos from public Google Drive / Dropbox share links (allowlisted hosts only). */
export const importCloudPhotos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ urls: z.array(z.string().min(8).max(1000)).min(1).max(20) }).parse(d))
  .handler(async ({ data }) => {
    const { normalizeCloudLink, fetchCloudFile } = await import("@/lib/cloud-import.server");
    const files: Array<{ name: string; type: string; size: number; data: string }> = [];
    const errors: Array<{ url: string; message: string }> = [];
    for (const raw of data.urls) {
      const norm = normalizeCloudLink(raw);
      if (!norm.ok) {
        errors.push({ url: raw, message: norm.message });
        continue;
      }
      try {
        const got = await fetchCloudFile(norm.link);
        if (got.ok) files.push({ name: got.name, type: got.type, size: got.size, data: got.data });
        else errors.push({ url: raw, message: got.message });
      } catch (e) {
        errors.push({ url: raw, message: e instanceof Error ? e.message : "Download failed" });
      }
    }
    return { files, errors };
  });
