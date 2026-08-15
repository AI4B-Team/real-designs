/**
 * Small retry helper for database reads.
 *
 * The managed Postgres connection occasionally drops a request ("upstream
 * connect error"), which surfaced as a 500 and a blank screen. Read queries are
 * safe to repeat, so retry a couple of times with a short backoff before
 * failing.
 */
export async function withRetry<T>(run: () => Promise<T>, attempts = 3, baseDelayMs = 250): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await run();
    } catch (e) {
      lastErr = e;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, baseDelayMs * (i + 1)));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}
