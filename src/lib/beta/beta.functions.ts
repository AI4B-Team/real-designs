import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Beta state for the signed-in account: whether closed beta gating is on, the
 * allowlist result and the resolved feature map. The client mirrors this, but
 * every held-back server action re-checks it with assertBetaFeature.
 */
export const getBetaState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { featureStateFor } = await import("./guard.server");
    const email = (context.claims as { email?: string } | null)?.email ?? null;
    const { readiness, features } = await featureStateFor(email);
    return {
      betaMode: readiness.betaMode,
      allowlisted: readiness.allowlisted,
      stripeReady: !!readiness.stripeReady,
      emailReady: !!readiness.emailReady,
      features,
    };
  });
