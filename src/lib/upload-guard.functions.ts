import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Server-side upload verification.
 *
 * Uploads go browser → storage directly (RLS scopes writes to the owner's
 * folder), so the browser-side checks in `storage-paths.ts` are convenience,
 * not enforcement. This function is the enforcement point: it re-reads the
 * object the client just wrote, sniffs the real bytes, and removes the object
 * when it is not what it claimed to be. A caller that skips it gets an
 * unverified object that no downstream tool will accept.
 */
export const verifyUploadedObject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        bucket: z.enum(["room-photos", "reveal-videos", "user-audio"]),
        path: z.string().min(1).max(400),
        declared_type: z.string().max(200).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { isSafeStoragePath, validateUploadBytes } = await import("@/lib/upload-guard");
    const userId = context.userId;

    // Ownership first: nothing outside the caller's own folder is inspectable
    // or deletable through this function.
    if (!isSafeStoragePath(data.path, userId)) {
      return { ok: false as const, code: "forbidden_path", message: "That file path is not yours." };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const dl = await supabaseAdmin.storage.from(data.bucket).download(data.path);
    if (dl.error || !dl.data) {
      return { ok: false as const, code: "missing", message: "That upload could not be read back." };
    }

    const blob = dl.data as Blob;
    const verdict = validateUploadBytes(
      data.bucket,
      new Uint8Array(await blob.arrayBuffer()),
      data.declared_type ?? blob.type ?? null,
    );

    if (!verdict.ok) {
      // Refuse and clean up: a rejected object never stays in the bucket.
      await supabaseAdmin.storage.from(data.bucket).remove([data.path]);
      return { ok: false as const, code: verdict.code, message: verdict.message };
    }

    return {
      ok: true as const,
      kind: verdict.kind,
      width: verdict.width,
      height: verdict.height,
    };
  });
