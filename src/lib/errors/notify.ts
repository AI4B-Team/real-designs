/**
 * Centralized user-facing failure notification (Phase 0D).
 *
 * The problem this solves: the same failure used to be surfaced by the caller,
 * by the wrapper that caught it again and by a global handler, so a single
 * upload timeout produced three toasts. Every user-visible failure now goes
 * through `notifyError`, which:
 *
 *   - reports the structured record exactly once;
 *   - shows at most one message per (code + operation) inside a short window;
 *   - never shows technical detail — only the model's `userMessage`, plus the
 *     correlation reference for critical failures;
 *   - offers Retry only when the failure is actually retryable and the caller
 *     provided a safe retry.
 *
 * Low-severity failures are reported and never shown.
 */

import { rdToast } from "@/lib/rd-toast";
import { AppError, isAppError, toAppError, type AppErrorContext, type ErrorCategory, type ErrorSeverity } from "./app-error";
import { reportError } from "./report";

const DEDUPE_WINDOW_MS = 6000;
const seen = new Map<string, number>();

export function resetNotifyDedupe(): void {
  seen.clear();
}

function shouldShow(key: string, now: number): boolean {
  const last = seen.get(key);
  /* Housekeeping: the map only ever holds keys from the current window. */
  for (const [k, at] of seen) if (now - at > DEDUPE_WINDOW_MS) seen.delete(k);
  if (last != null && now - last < DEDUPE_WINDOW_MS) return false;
  seen.set(key, now);
  return true;
}

export interface NotifyOptions {
  operation: string;
  category?: ErrorCategory | undefined;
  severity?: ErrorSeverity | undefined;
  code?: string | undefined;
  userMessage?: string | undefined;
  context?: AppErrorContext | undefined;
  /** A safe repeat of the same user intent. Offered only when retryable. */
  retry?: (() => void) | undefined;
  /** Force-suppress the toast but keep the structured record. */
  silent?: boolean | undefined;
  now?: number | undefined;
}

export interface NotifyResult {
  error: AppError;
  shown: boolean;
  message: string;
  retryOffered: boolean;
}

/** Report a failure once and, when it matters to the user, show it once. */
export function notifyError(error: unknown, opts: NotifyOptions): NotifyResult {
  const app: AppError = isAppError(error) ? error : toAppError(error, opts);
  reportError(app, opts);

  const now = opts.now ?? Date.now();
  const key = `${app.code}|${app.operation}`;
  const wanted = !opts.silent && app.severity !== "low";
  const shown = wanted && shouldShow(key, now);

  const message =
    app.severity === "critical"
      ? `${app.userMessage} (Ref ${app.correlationId})`
      : app.userMessage;

  const retryOffered = shown && app.retryable && typeof opts.retry === "function";

  if (shown && typeof document !== "undefined") {
    rdToast(message, "error");
    if (retryOffered) mountRetry(message, opts.retry!);
  }

  return { error: app, shown, message, retryOffered };
}

/**
 * Inline projection for surfaces that own their own error area (forms, panels)
 * and must not raise a toast. Still reported once.
 */
export function inlineError(error: unknown, opts: NotifyOptions): NotifyResult {
  return notifyError(error, { ...opts, silent: true });
}

const RETRY_ID = "rd-error-retry";

function mountRetry(message: string, retry: () => void): void {
  document.getElementById(RETRY_ID)?.remove();
  const bar = document.createElement("div");
  bar.id = RETRY_ID;
  bar.setAttribute("role", "alert");
  bar.style.cssText =
    "position:fixed;z-index:100000;bottom:78px;left:50%;transform:translateX(-50%);display:flex;gap:12px;align-items:center;background:#141414;color:#fff;border:1px solid rgba(255,255,255,.16);border-radius:999px;padding:9px 10px 9px 18px;font:500 13px/1.35 'DM Sans',system-ui,sans-serif";
  const text = document.createElement("span");
  text.textContent = message;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = "Retry";
  btn.style.cssText =
    "border:0;border-radius:999px;background:#CC0000;color:#fff;padding:7px 16px;font:700 12.5px/1 'DM Sans',system-ui,sans-serif;cursor:pointer";
  btn.addEventListener("click", () => {
    bar.remove();
    retry();
  });
  bar.append(text, btn);
  document.body.appendChild(bar);
  window.setTimeout(() => bar.remove(), 12000);
}
