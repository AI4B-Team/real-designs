/**
 * One explicit user action gets one request id.
 *
 * The server derives idempotency from the request inputs plus this id. That
 * split is deliberate:
 *
 *   - a retry of the same click (double click, network retry, refresh mid
 *     flight) reuses the id, so it replays the first attempt and is never
 *     charged twice;
 *   - a deliberate second run with identical settings gets a new id, so the
 *     user still gets a fresh variation.
 *
 * Call newRequestId() when the user commits an action, keep the value for the
 * lifetime of that attempt, and drop it once the attempt has finished.
 */
export function newRequestId(prefix = "req"): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return `${prefix}-${Date.now().toString(36)}-${rand}`;
}

const inflight = new Map<string, string>();

/**
 * A request id that survives retries of one logical action.
 *
 * `slot` names the action (e.g. "design:photo-3"). The first call creates the
 * id; later calls with the same slot reuse it until clearRequestId(slot) marks
 * the attempt finished.
 */
export function requestIdFor(slot: string): string {
  const existing = inflight.get(slot);
  if (existing) return existing;
  const id = newRequestId(slot.replace(/[^a-z0-9]+/gi, "-").slice(0, 24));
  inflight.set(slot, id);
  return id;
}

/** Mark the attempt for `slot` finished, so the next click is a new request. */
export function clearRequestId(slot: string): void {
  inflight.delete(slot);
}
