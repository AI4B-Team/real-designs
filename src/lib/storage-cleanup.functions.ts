import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Self-scoped maintenance: a signed-in user can sweep their own abandoned
 * uploads and stalled render jobs. The caller cannot name another workspace —
 * the user id comes from the verified session, never from the request body.
 */
export const cleanupMyUploads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ dry_run: z.boolean().optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { assertServerConfig } = await import("@/lib/server-config.server");
    assertServerConfig();
    const { cleanupAbandonedUploads } = await import("@/lib/storage-cleanup.server");
    const report = await cleanupAbandonedUploads(context.userId, { dryRun: data.dry_run ?? false });
    return { scanned: report.scanned, removed: report.removed.length, staleJobs: report.staleJobs };
  });
