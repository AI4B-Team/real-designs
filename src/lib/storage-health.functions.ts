import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Storage readiness for the UI.
 *
 * Everyone signed in gets the plain "ok" flag and, at worst, a short neutral
 * sentence. The administrator detail — which bucket is missing, how to fix it —
 * is returned only to workspace admins; for everyone else it stays in the
 * server log where it belongs.
 */
export const getStorageHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { checkStorageHealth } = await import("@/lib/storage-health.server");
    const health = await checkStorageHealth();

    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });

    return {
      ok: health.ok,
      message: health.userMessage,
      ...(isAdmin
        ? {
            adminMessage: health.adminMessage,
            missing: health.missing,
            publicBuckets: health.publicBuckets,
            stages: health.stages,
          }
        : {}),
    };
  });
