/**
 * Structured client-side telemetry for the canonical error model (Phase 0D).
 *
 * Every corrected failure path calls `reportError`. It writes exactly one
 * structured line — never a stack, never a token, never a signed URL — and
 * keeps a small in-memory ring buffer so tests and the dev console can assert
 * that a failure stayed diagnosable even when it was deliberately not shown to
 * the user.
 *
 * The server has its own sink (`src/lib/obs/report.server.ts`); this module is
 * the browser side of the same boundary and shares the redaction rules.
 */

import { AppError, isAppError, toAppError, type AppErrorContext, type ErrorCategory, type ErrorSeverity } from "./app-error";

const BUFFER_LIMIT = 100;
const buffer: Record<string, unknown>[] = [];

export type ErrorSink = (record: Record<string, unknown>) => void;

let sink: ErrorSink | null = null;

/** Route structured records somewhere else (analytics, tests). */
export function setErrorSink(next: ErrorSink | null): void {
  sink = next;
}

export function recentErrors(): Record<string, unknown>[] {
  return buffer.slice();
}

export function clearRecentErrors(): void {
  buffer.length = 0;
}

/**
 * Record a failure. Returns the canonical error so a caller can surface it,
 * rethrow it or return it as a typed failure without a second conversion.
 */
export function reportError(
  error: unknown,
  defaults: {
    operation: string;
    category?: ErrorCategory | undefined;
    severity?: ErrorSeverity | undefined;
    code?: string | undefined;
    userMessage?: string | undefined;
    context?: AppErrorContext | undefined;
  },
): AppError {
  const app = isAppError(error) ? error : toAppError(error, defaults);
  const record = app.toRecord();
  buffer.push(record);
  if (buffer.length > BUFFER_LIMIT) buffer.shift();
  try {
    /* One line, one JSON object: greppable in production, readable in dev. */
    const line = `[rd.error] ${JSON.stringify(record)}`;
    if (app.severity === "low") console.debug(line);
    else if (app.severity === "medium") console.warn(line);
    else console.error(line);
  } catch {
    /* telemetry must never break the path it is describing */
  }
  try {
    sink?.(record);
  } catch {
    /* a bad sink must never break the path it is describing */
  }
  return app;
}

/**
 * Optional, non-critical work: run it, and if it fails keep the app moving but
 * leave a diagnosable record instead of an empty catch.
 */
export async function tolerate<T>(
  operation: string,
  work: () => T | Promise<T>,
  opts?: { category?: ErrorCategory; severity?: ErrorSeverity; context?: AppErrorContext },
): Promise<T | null> {
  try {
    return await work();
  } catch (e) {
    reportError(e, {
      operation,
      category: opts?.category ?? "unknown",
      severity: opts?.severity ?? "low",
      context: opts?.context,
    });
    return null;
  }
}
