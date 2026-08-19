/**
 * Server side beta enforcement. Hidden navigation is not protection: every
 * server action that belongs to a held-back feature calls assertBetaFeature so
 * a crafted request gets the same honest answer the UI gives.
 */
import {
  featureAvailable,
  unavailableMessage,
  resolveFeatures,
  type BetaReadiness,
  type FeatureKey,
} from "./features";

function configured(name: string) {
  const v = process.env[name];
  return typeof v === "string" && v.trim().length > 0;
}

/** Beta gating is on unless it is explicitly switched off for the environment. */
export function betaModeOn(): boolean {
  return (process.env["RD_BETA_MODE"] ?? "on").toLowerCase() !== "off";
}

/** Is this email on the closed beta allowlist? Errors fail closed. */
export async function isAllowlisted(email: string | null | undefined): Promise<boolean> {
  const addr = (email ?? "").trim().toLowerCase();
  if (!addr) return false;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("beta_allowlist")
      .select("email")
      .eq("email", addr)
      .maybeSingle();
    if (error) return false;
    return !!data;
  } catch (_) {
    return false;
  }
}

/** Readiness snapshot used by both the guards and the client state. */
export async function serverReadiness(email?: string | null): Promise<BetaReadiness> {
  const betaMode = betaModeOn();
  return {
    betaMode,
    allowlisted: betaMode ? await isAllowlisted(email) : true,
    stripeReady: configured("STRIPE_SECRET_KEY"),
    emailReady: configured("RESEND_API_KEY"),
  };
}

export class FeatureUnavailableError extends Error {
  readonly code = "feature_unavailable";
  constructor(readonly feature: FeatureKey) {
    super(unavailableMessage(feature));
  }
}

/**
 * Throw unless the feature is genuinely available. Call this first inside any
 * server function that belongs to a held-back beta feature.
 */
export async function assertBetaFeature(key: FeatureKey, email?: string | null): Promise<void> {
  const readiness = await serverReadiness(email);
  if (!featureAvailable(readiness, key)) throw new FeatureUnavailableError(key);
}

/** Full feature map for the signed-in account. */
export async function featureStateFor(email?: string | null) {
  const readiness = await serverReadiness(email);
  return { readiness, features: resolveFeatures(readiness) };
}
