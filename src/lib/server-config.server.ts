/**
 * Startup validation for server configuration.
 *
 * `process.env` is read here, inside a function, so the value is resolved at
 * request time on the edge runtime and never captured at module scope.
 */

import { describeConfigReport, validateServerConfig, type ConfigReport } from "@/lib/server-config";

let logged = false;

export function readServerConfig(): ConfigReport {
  const report = validateServerConfig(process.env as Record<string, string | undefined>);
  if (!logged) {
    logged = true;
    if (!report.ok) console.error("[config] " + describeConfigReport(report));
    for (const w of report.warnings) console.warn("[config] " + w);
  }
  return report;
}

/** Throw a user-safe error before doing work that cannot succeed without config. */
export function assertServerConfig(): void {
  const report = readServerConfig();
  if (!report.ok)
    throw new Error("This feature is temporarily unavailable. Please try again shortly.");
}
