/**
 * Structured server-side error reporting. Server-only.
 *
 * One shape for every server failure: route, operation, workspace, request and
 * correlation IDs, provider and a safe error code. The message is redacted
 * before it is written anywhere, and secrets, tokens, payment data and signed
 * image URLs never appear in the record.
 */

import { redactText, redactValue } from "./redact";
import { newCorrelationId } from "./correlation";
import type { ProviderKey } from "./providers";
import type { Operation } from "./retry";

export interface ErrorContext {
  route: string;
  operation: Operation | string;
  workspaceId?: string | null;
  requestId?: string | null;
  correlationId?: string | null;
  provider?: ProviderKey | null;
  /** Extra, non-sensitive breadcrumbs. Redacted before writing. */
  meta?: Record<string, unknown>;
}

export interface ErrorRecord {
  route: string;
  operation: Operation | string;
  workspaceId: string | null;
  requestId: string | null;
  provider: ProviderKey | null;
  correlationId: string;
  code: string;
  message: string;
  severity: "error" | "warning";
  at: string;
  meta: Record<string, unknown>;
}

/** Map an unknown throw onto a short, stable, non-revealing code. */
export function safeErrorCode(error: unknown): string {
  const status =
    (error as { status?: number; statusCode?: number })?.status ??
    (error as { statusCode?: number })?.statusCode;
  if (typeof status === "number") return `http_${status}`;
  const raw = String((error as { code?: string })?.code ?? (error as Error)?.message ?? "");
  if (/timeout|etimedout/i.test(raw)) return "timeout";
  if (/abort/i.test(raw)) return "aborted";
  if (/econnreset|network|fetch failed|upstream/i.test(raw)) return "network";
  if (/not found/i.test(raw)) return "not_found";
  if (/permission|denied|rls|unauthor/i.test(raw)) return "forbidden";
  if (/quota|rate limit|429/i.test(raw)) return "rate_limited";
  if (/insufficient/i.test(raw)) return "insufficient_credits";
  const symbolic = raw.match(/^[a-z][a-z0-9_]{2,40}$/i);
  return symbolic ? symbolic[0].toLowerCase() : "unhandled";
}

export function buildErrorRecord(
  error: unknown,
  ctx: ErrorContext,
  severity: "error" | "warning" = "error",
): ErrorRecord {
  return {
    route: ctx.route,
    operation: ctx.operation,
    workspaceId: ctx.workspaceId ?? null,
    requestId: ctx.requestId ?? null,
    correlationId: ctx.correlationId ?? newCorrelationId(),
    provider: ctx.provider ?? null,
    code: safeErrorCode(error),
    message: redactText(String((error as Error)?.message ?? error ?? "")).slice(0, 500),
    severity,
    at: new Date().toISOString(),
    meta: (redactValue(ctx.meta ?? {}) as Record<string, unknown>) ?? {},
  };
}

/**
 * Report a server failure. Writes a single structured log line and best-effort
 * persists it for the alerting queries. Never throws: reporting must not be
 * able to break the request it is describing.
 */
export async function reportServerError(
  error: unknown,
  ctx: ErrorContext,
  severity: "error" | "warning" = "error",
): Promise<ErrorRecord> {
  const record = buildErrorRecord(error, ctx, severity);
  try {
    console.error(`[rd.error] ${JSON.stringify(record)}`);
  } catch {
    /* logging must never throw */
  }
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("ops_error_events").insert({
      route: record.route,
      operation: String(record.operation),
      workspace_id: record.workspaceId,
      request_id: record.requestId,
      correlation_id: record.correlationId,
      provider: record.provider,
      code: record.code,
      message: record.message,
      severity: record.severity,
      meta: record.meta as never,
    });
  } catch {
    /* persistence is best effort; the log line is the source of truth */
  }
  return record;
}
