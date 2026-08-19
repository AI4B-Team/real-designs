/**
 * Provider health probes. Server-only.
 *
 * Every probe is cheap, read-only and time-boxed. Results contain no secrets:
 * only whether a dependency is configured, whether it answered, how long it
 * took and a short classification code.
 */

import {
  classifyProbe,
  overallState,
  PROVIDERS,
  type OverallState,
  type ProviderProbe,
  type ProviderStatus,
} from "./providers";
import { safeErrorCode } from "./report.server";

const PROBE_TIMEOUT_MS = 4000;

function configured(...names: string[]): boolean {
  return names.every((n) => {
    const v = process.env[n];
    return typeof v === "string" && v.trim().length > 0;
  });
}

async function timed(
  run: () => Promise<void>,
): Promise<{ ok: boolean; latencyMs: number; code?: string }> {
  const started = Date.now();
  try {
    await Promise.race([
      run(),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(Object.assign(new Error("timeout"), { code: "timeout" })),
          PROBE_TIMEOUT_MS,
        ),
      ),
    ]);
    return { ok: true, latencyMs: Date.now() - started };
  } catch (e) {
    return { ok: false, latencyMs: Date.now() - started, code: safeErrorCode(e) };
  }
}

async function pingUrl(url: string, headers: Record<string, string> = {}) {
  return timed(async () => {
    const res = await fetch(url, { method: "GET", headers });
    if (!res.ok && res.status !== 401 && res.status !== 403) {
      throw Object.assign(new Error("bad_status"), { status: res.status });
    }
  });
}

async function probeSupabase(): Promise<ProviderProbe> {
  const isConfigured = configured("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY");
  if (!isConfigured) return { key: "supabase", configured: false, ok: false, latencyMs: 0 };
  const result = await timed(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("markets").select("id").limit(1);
    if (error) throw Object.assign(new Error("query_failed"), { code: error.code });
  });
  return { key: "supabase", configured: true, ...result };
}

async function probeStorage(): Promise<ProviderProbe> {
  const isConfigured = configured("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY");
  if (!isConfigured) return { key: "storage", configured: false, ok: false, latencyMs: 0 };
  const result = await timed(async () => {
    const { checkStorageHealth } = await import("@/lib/storage-health.server");
    const health = await checkStorageHealth({ deep: false });
    if (!health.ok)
      throw Object.assign(new Error("bucket_check_failed"), { code: "storage_unhealthy" });
  });
  return { key: "storage", configured: true, ...result };
}

async function probeAi(): Promise<ProviderProbe> {
  const isConfigured = configured("LOVABLE_API_KEY");
  if (!isConfigured) return { key: "ai", configured: false, ok: false, latencyMs: 0 };
  const result = await pingUrl("https://ai.gateway.lovable.dev/v1/models", {
    Authorization: `Bearer ${process.env["LOVABLE_API_KEY"]}`,
  });
  return { key: "ai", configured: true, ...result };
}

async function probeStripe(): Promise<ProviderProbe> {
  const isConfigured = configured("STRIPE_SECRET_KEY");
  if (!isConfigured) return { key: "stripe", configured: false, ok: false, latencyMs: 0 };
  const result = await pingUrl("https://api.stripe.com/v1/balance", {
    Authorization: `Bearer ${process.env["STRIPE_SECRET_KEY"]}`,
  });
  return { key: "stripe", configured: true, ...result };
}

async function probeEmail(): Promise<ProviderProbe> {
  const isConfigured = configured("RESEND_API_KEY");
  if (!isConfigured) return { key: "email", configured: false, ok: false, latencyMs: 0 };
  const result = await pingUrl("https://api.resend.com/domains", {
    Authorization: `Bearer ${process.env["RESEND_API_KEY"]}`,
  });
  return { key: "email", configured: true, ...result };
}

async function probeListing(): Promise<ProviderProbe> {
  const isConfigured = configured("LISTING_DATA_API_URL", "LISTING_DATA_API_KEY");
  if (!isConfigured) return { key: "listing", configured: false, ok: false, latencyMs: 0 };
  const result = await pingUrl(String(process.env["LISTING_DATA_API_URL"]), {
    Authorization: `Bearer ${process.env["LISTING_DATA_API_KEY"]}`,
  });
  return { key: "listing", configured: true, ...result };
}

export interface HealthReport {
  status: OverallState;
  checkedAt: string;
  providers: ProviderStatus[];
  jobs: { queued: number; running: number; stuck: number } | null;
}

let cache: { at: number; report: HealthReport } | null = null;
const CACHE_MS = 15_000;

export async function healthReport(force = false): Promise<HealthReport> {
  if (!force && cache && Date.now() - cache.at < CACHE_MS) return cache.report;

  const probes = await Promise.all([
    probeSupabase(),
    probeAi(),
    probeStorage(),
    probeStripe(),
    probeEmail(),
    probeListing(),
  ]);
  const byKey = new Map(probes.map((p) => [p.key, p]));
  const providers = PROVIDERS.map((def) =>
    classifyProbe(
      byKey.get(def.key) ?? { key: def.key, configured: false, ok: false, latencyMs: 0 },
    ),
  );

  let jobs: HealthReport["jobs"] = null;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("ops_jobs")
      .select("state, started_at, expected_ms")
      .in("state", ["queued", "running"])
      .limit(500);
    const rows = (data ?? []) as Array<{ state: string; started_at: string; expected_ms: number }>;
    jobs = {
      queued: rows.filter((r) => r.state === "queued").length,
      running: rows.filter((r) => r.state === "running").length,
      stuck: rows.filter((r) => Date.now() - new Date(r.started_at).getTime() > r.expected_ms * 2)
        .length,
    };
  } catch {
    jobs = null;
  }

  const report: HealthReport = {
    status: overallState(providers),
    checkedAt: new Date().toISOString(),
    providers,
    jobs,
  };
  cache = { at: Date.now(), report };
  return report;
}
