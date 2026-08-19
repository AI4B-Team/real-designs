/**
 * Retry policy.
 *
 * Only safe, idempotent operations are ever repeated. Anything that spends
 * credits, starts a generation or writes billing state is retried exactly zero
 * times by this helper — those paths go through the idempotency layer instead.
 */

export type Operation =
  | "read"
  | "signed_url"
  | "storage_upload"
  | "storage_delete"
  | "ai_generate"
  | "credit_charge"
  | "webhook_deliver"
  | "email_send";

const IDEMPOTENT: Operation[] = ["read", "signed_url", "storage_upload", "storage_delete"];

export function isRetryable(op: Operation): boolean {
  return IDEMPOTENT.includes(op);
}

/** Transient transport failures only — never a 4xx that will fail again. */
export function isTransient(code: string | number | undefined): boolean {
  if (code == null) return false;
  const n = typeof code === "number" ? code : Number(code.replace(/\D+/g, ""));
  if (Number.isFinite(n) && n >= 400 && n < 500 && n !== 408 && n !== 429) return false;
  if (typeof code === "string" && /timeout|econnreset|etimedout|upstream|network|fetch failed/i.test(code))
    return true;
  return Number.isFinite(n) ? n >= 500 || n === 408 || n === 429 : false;
}

export function backoffMs(attempt: number, baseMs = 250, capMs = 4000): number {
  const exp = Math.min(capMs, baseMs * 2 ** attempt);
  return Math.round(exp * (0.7 + Math.random() * 0.3));
}

export async function retrySafe<T>(
  op: Operation,
  run: () => Promise<T>,
  { attempts = 3, sleep = (ms: number) => new Promise((r) => setTimeout(r, ms)) } = {},
): Promise<T> {
  const max = isRetryable(op) ? attempts : 1;
  let last: unknown;
  for (let i = 0; i < max; i += 1) {
    try {
      return await run();
    } catch (e) {
      last = e;
      const code = (e as { status?: number; code?: string })?.status ?? (e as { code?: string })?.code ?? (e as Error)?.message;
      if (i === max - 1 || !isTransient(code)) break;
      await sleep(backoffMs(i));
    }
  }
  throw last instanceof Error ? last : new Error(String(last));
}
