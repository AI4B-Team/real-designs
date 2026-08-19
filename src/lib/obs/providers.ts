/**
 * The external providers REAL DESIGNS depends on, and how a probe result is
 * turned into a status. Pure so it can be unit tested and reused by both the
 * health endpoint and the in-app status surfaces.
 */

export type ProviderKey = "supabase" | "ai" | "storage" | "stripe" | "email" | "listing";

export type ProviderState = "operational" | "degraded" | "down" | "not_configured";

export interface ProviderDef {
  key: ProviderKey;
  name: string;
  /** Whether a failure blocks the core product. */
  critical: boolean;
  /** Milliseconds past which a healthy answer is still considered slow. */
  degradedAfterMs: number;
  userImpact: string;
}

export const PROVIDERS: ProviderDef[] = [
  {
    key: "supabase",
    name: "Database & Auth",
    critical: true,
    degradedAfterMs: 1500,
    userImpact: "Signing in and loading projects may fail.",
  },
  {
    key: "ai",
    name: "AI Generation",
    critical: true,
    degradedAfterMs: 4000,
    userImpact: "New designs, videos and plans may be slow or unavailable.",
  },
  {
    key: "storage",
    name: "Photo Storage",
    critical: true,
    degradedAfterMs: 2000,
    userImpact: "Uploads and photo previews may fail.",
  },
  {
    key: "stripe",
    name: "Billing",
    critical: false,
    degradedAfterMs: 3000,
    userImpact: "Plan changes and credit top-ups may be delayed.",
  },
  {
    key: "email",
    name: "Email Delivery",
    critical: false,
    degradedAfterMs: 3000,
    userImpact: "Notification emails may be delayed.",
  },
  {
    key: "listing",
    name: "Listing Data",
    critical: false,
    degradedAfterMs: 5000,
    userImpact: "Address import falls back to manual upload.",
  },
];

export interface ProviderProbe {
  key: ProviderKey;
  configured: boolean;
  ok: boolean;
  latencyMs: number;
  /** Short, safe classification such as "timeout" or "http_503". Never a raw message. */
  code?: string;
}

export interface ProviderStatus extends ProviderProbe {
  name: string;
  critical: boolean;
  state: ProviderState;
  userImpact: string | null;
}

export function classifyProbe(probe: ProviderProbe): ProviderStatus {
  const def = PROVIDERS.find((p) => p.key === probe.key)!;
  let state: ProviderState;
  if (!probe.configured) state = "not_configured";
  else if (!probe.ok) state = "down";
  else if (probe.latencyMs > def.degradedAfterMs) state = "degraded";
  else state = "operational";
  return {
    ...probe,
    name: def.name,
    critical: def.critical,
    state,
    userImpact: state === "operational" || state === "not_configured" ? null : def.userImpact,
  };
}

export type OverallState = "operational" | "degraded" | "outage";

export function overallState(statuses: ProviderStatus[]): OverallState {
  if (statuses.some((s) => s.critical && s.state === "down")) return "outage";
  if (statuses.some((s) => s.state === "down" || s.state === "degraded")) return "degraded";
  return "operational";
}
