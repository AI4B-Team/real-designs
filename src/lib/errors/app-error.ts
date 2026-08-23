/**
 * Canonical application error model (Phase 0D).
 *
 * One shape for every failure the product can produce, on the client and on
 * the server. The rules it enforces:
 *
 *   - a user never sees a stack trace, a provider response, a token, a signed
 *     URL or a database detail;
 *   - a failure that the system can name is never reported as
 *     "Something went wrong";
 *   - every critical failure carries a correlation ID that also appears in the
 *     structured log line, so support can trace it;
 *   - retryability is a property of the failure, not a guess made at the call
 *     site.
 *
 * This module is isomorphic: it must not import server-only code.
 */

import { newCorrelationId } from "@/lib/obs/correlation";
import { redactText, redactValue } from "@/lib/obs/redact";

/* ----------------------------------------------------------------- taxonomy */

export type ErrorCategory =
  | "authentication"
  | "authorization"
  | "validation"
  | "network"
  | "provider"
  | "upload"
  | "storage"
  | "persistence"
  | "generation"
  | "credits"
  | "navigation"
  | "unsupported"
  | "unknown";

/**
 * Severity drives what has to happen, not how loud the copy is.
 *  critical — money, auth or durable data is at stake; always observable.
 *  high     — the user's explicit action failed; always surfaced with a next step.
 *  medium   — a secondary feature failed; surfaced once, no blocking UI.
 *  low      — cosmetic or optional enhancement; diagnosable in logs only.
 */
export type ErrorSeverity = "critical" | "high" | "medium" | "low";

export const ERROR_CATEGORIES: ErrorCategory[] = [
  "authentication",
  "authorization",
  "validation",
  "network",
  "provider",
  "upload",
  "storage",
  "persistence",
  "generation",
  "credits",
  "navigation",
  "unsupported",
  "unknown",
];

/** Non-sensitive breadcrumbs that identify the work that failed. */
export interface AppErrorContext {
  jobId?: string | null;
  batchId?: string | null;
  draftId?: string | null;
  assetId?: string | null;
  versionId?: string | null;
  [key: string]: unknown;
}

export interface AppErrorInit {
  code?: string;
  category?: ErrorCategory;
  severity?: ErrorSeverity;
  operation: string;
  userMessage?: string;
  technicalMessage?: string;
  retryable?: boolean;
  cause?: unknown;
  context?: AppErrorContext;
  correlationId?: string;
}

/* ------------------------------------------------------------------ copy */

/**
 * Honest, specific default wording per category. "Something went wrong" is the
 * last resort for a genuinely unclassifiable failure only.
 */
const CATEGORY_MESSAGE: Record<ErrorCategory, string> = {
  authentication: "Your session expired. Sign in again — nothing you entered was lost.",
  authorization: "You don't have permission to do that.",
  validation: "Some details need fixing before this can continue.",
  network: "We couldn't reach the server. Check your connection and try again.",
  provider: "A service we depend on isn't responding right now.",
  upload: "Upload failed. The file didn't reach storage, and nothing was charged.",
  storage: "Source is unavailable. We couldn't read that file from storage.",
  persistence: "Save failed. Your changes are still here — try saving again.",
  generation: "Generation failed. Any credits held for it have been returned.",
  credits: "Credit reconciliation failed. Your balance was not changed.",
  navigation: "That screen couldn't be opened.",
  unsupported: "That isn't supported here.",
  unknown: "Something went wrong. The action didn't complete.",
};

/** Specific codes that deserve wording of their own. */
const CODE_MESSAGE: Record<string, string> = {
  session_expired: "Your session expired. Sign in again — nothing you entered was lost.",
  permission_denied: "You don't have permission to do that.",
  upload_timeout: "Upload timed out. Nothing was charged — try that file again.",
  upload_rejected: "That file was rejected. Use a JPG, PNG or WebP photo.",
  file_too_large: "That file is too large. Use a photo under 15 MB.",
  storage_unavailable: "Source is unavailable. We couldn't read that file from storage.",
  draft_save_failed: "Save failed. Your work is still on screen — try saving again.",
  presentation_load_failed: "Presentation could not be loaded.",
  presentation_expired: "This presentation link has expired or was revoked.",
  insufficient_credits: "You don't have enough credits for this.",
  credit_reconciliation_failed: "Credit reconciliation failed. Your balance was not changed.",
  generation_failed: "Generation failed. Any credits held for it have been returned.",
  generation_timeout: "Generation took too long and was stopped. Your credits were returned.",
  provider_unavailable: "Generation is temporarily unavailable. No credits were spent.",
  rate_limited: "Too many requests right now. Wait a moment and try again.",
  module_mount_failed: "Part of this screen couldn't load. The rest still works.",
  offline: "You appear to be offline. We'll keep your work — reconnect and try again.",
};

const RETRYABLE_CATEGORIES: ErrorCategory[] = ["network", "provider", "storage", "upload"];
const NON_RETRYABLE_CATEGORIES: ErrorCategory[] = [
  "authentication",
  "authorization",
  "validation",
  "unsupported",
];

const CRITICAL_CATEGORIES: ErrorCategory[] = ["credits", "generation", "persistence"];

/** Default user-facing sentence for a code/category pair. */
export function defaultUserMessage(code: string, category: ErrorCategory): string {
  return CODE_MESSAGE[code] ?? CATEGORY_MESSAGE[category] ?? CATEGORY_MESSAGE.unknown;
}

/* ------------------------------------------------------------------ model */

export class AppError extends Error {
  readonly code: string;
  readonly category: ErrorCategory;
  readonly severity: ErrorSeverity;
  readonly operation: string;
  readonly userMessage: string;
  readonly technicalMessage: string;
  readonly retryable: boolean;
  override readonly cause: unknown;
  readonly context: AppErrorContext;
  readonly jobId: string | null;
  readonly batchId: string | null;
  readonly draftId: string | null;
  readonly assetId: string | null;
  readonly versionId: string | null;
  readonly timestamp: string;
  readonly correlationId: string;
  readonly isAppError = true as const;

  constructor(init: AppErrorInit) {
    const category = init.category ?? "unknown";
    const code = init.code ?? category;
    const userMessage = init.userMessage ?? defaultUserMessage(code, category);
    super(userMessage);
    this.name = "AppError";
    this.code = code;
    this.category = category;
    this.severity = init.severity ?? (CRITICAL_CATEGORIES.includes(category) ? "critical" : "high");
    this.operation = init.operation;
    this.userMessage = userMessage;
    /* Technical detail is redacted at construction: there is no later point
       where someone can forget to do it. */
    this.technicalMessage = redactText(
      String(init.technicalMessage ?? describeCause(init.cause) ?? userMessage),
    ).slice(0, 500);
    this.retryable =
      init.retryable ??
      (NON_RETRYABLE_CATEGORIES.includes(category)
        ? false
        : RETRYABLE_CATEGORIES.includes(category) || category === "generation");
    this.cause = init.cause;
    const ctx = init.context ?? {};
    this.context = ctx;
    this.jobId = (ctx.jobId as string | undefined) ?? null;
    this.batchId = (ctx.batchId as string | undefined) ?? null;
    this.draftId = (ctx.draftId as string | undefined) ?? null;
    this.assetId = (ctx.assetId as string | undefined) ?? null;
    this.versionId = (ctx.versionId as string | undefined) ?? null;
    this.timestamp = new Date().toISOString();
    this.correlationId = init.correlationId ?? newCorrelationId();
  }

  /** Log/telemetry projection. Contains no stack, no cause chain, no secrets. */
  toRecord(): Record<string, unknown> {
    return {
      code: this.code,
      category: this.category,
      severity: this.severity,
      operation: this.operation,
      message: this.technicalMessage,
      retryable: this.retryable,
      correlationId: this.correlationId,
      timestamp: this.timestamp,
      jobId: this.jobId,
      batchId: this.batchId,
      draftId: this.draftId,
      assetId: this.assetId,
      versionId: this.versionId,
      context: redactValue(stripIds(this.context)) as Record<string, unknown>,
    };
  }

  /** The only projection that may cross the wire to a browser or a recipient. */
  toUserFacing(): {
    ok: false;
    code: string;
    category: ErrorCategory;
    message: string;
    retryable: boolean;
    correlationId: string;
  } {
    return {
      ok: false,
      code: this.code,
      category: this.category,
      message: this.userMessage,
      retryable: this.retryable,
      correlationId: this.correlationId,
    };
  }
}

function stripIds(ctx: AppErrorContext): Record<string, unknown> {
  const { jobId, batchId, draftId, assetId, versionId, ...rest } = ctx;
  void jobId;
  void batchId;
  void draftId;
  void assetId;
  void versionId;
  return rest;
}

function describeCause(cause: unknown): string | undefined {
  if (cause == null) return undefined;
  if (cause instanceof Error) return `${cause.name}: ${cause.message}`;
  if (typeof cause === "string") return cause;
  try {
    return JSON.stringify(cause)?.slice(0, 500);
  } catch {
    return String(cause);
  }
}

export function isAppError(value: unknown): value is AppError {
  return value instanceof AppError || (value as AppError | null)?.isAppError === true;
}

/* -------------------------------------------------------------- classifier */

interface ClassifyDefaults {
  operation: string;
  category?: ErrorCategory;
  severity?: ErrorSeverity;
  code?: string;
  userMessage?: string;
  context?: AppErrorContext;
  correlationId?: string;
}

/**
 * Map an arbitrary throw onto the canonical model. Unknown throws keep their
 * caller-declared category so a failure inside, say, the upload path is never
 * misreported as generic.
 */
export function toAppError(error: unknown, defaults: ClassifyDefaults): AppError {
  if (isAppError(error)) return error;

  const status = statusOf(error);
  const raw = String((error as Error)?.message ?? error ?? "");
  const guessed = classify(raw, status);
  const category = guessed?.category ?? defaults.category ?? "unknown";
  const code = guessed?.code ?? defaults.code ?? category;

  return new AppError({
    code,
    category,
    severity: defaults.severity,
    operation: defaults.operation,
    userMessage: defaults.userMessage ?? defaultUserMessage(code, category),
    technicalMessage: raw,
    cause: error,
    context: defaults.context,
    correlationId: defaults.correlationId,
    retryable: guessed?.retryable,
  });
}

function statusOf(error: unknown): number | undefined {
  const e = error as { status?: unknown; statusCode?: unknown } | null;
  const v = e?.status ?? e?.statusCode;
  return typeof v === "number" ? v : undefined;
}

function classify(
  raw: string,
  status: number | undefined,
): { category: ErrorCategory; code: string; retryable?: boolean } | null {
  if (status === 401 || /\b(jwt expired|not authenticated|unauthori[sz]ed)\b/i.test(raw))
    return { category: "authentication", code: "session_expired", retryable: false };
  if (status === 403 || /\b(forbidden|permission denied|row-level security|rls)\b/i.test(raw))
    return { category: "authorization", code: "permission_denied", retryable: false };
  if (status === 429 || /rate limit|too many requests/i.test(raw))
    return { category: "provider", code: "rate_limited", retryable: true };
  if (status === 402 || /insufficient (credits|balance)/i.test(raw))
    return { category: "credits", code: "insufficient_credits", retryable: false };
  if (/timed? ?out|etimedout|deadline/i.test(raw))
    return { category: "network", code: "timeout", retryable: true };
  if (/failed to fetch|network ?error|econnreset|fetch failed|offline/i.test(raw))
    return { category: "network", code: "network_unreachable", retryable: true };
  if (status != null && status >= 500)
    return { category: "provider", code: "provider_unavailable", retryable: true };
  return null;
}

/* -------------------------------------------------------- result helpers */

export type Failure = ReturnType<AppError["toUserFacing"]>;
export type Result<T> = { ok: true; data: T } | Failure;

export function ok<T>(data: T): Result<T> {
  return { ok: true, data };
}

export function failure(error: AppError): Failure {
  return error.toUserFacing();
}
