/**
 * Correlation IDs.
 *
 * Every user-visible failure carries a short reference the person can read out
 * to support, and that reference is the same ID present on the server log line
 * and on any alert raised by the same operation.
 */

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function newCorrelationId(prefix = "RD"): string {
  const bytes = new Uint8Array(8);
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  let out = "";
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return `${prefix}-${out.slice(0, 4)}-${out.slice(4, 8)}`;
}

export const CORRELATION_HEADER = "x-correlation-id";

const VALID = /^[A-Z]{2}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

export function isCorrelationId(value: unknown): value is string {
  return typeof value === "string" && VALID.test(value);
}

/** Reuse an inbound ID when it is well formed, otherwise mint a fresh one. */
export function correlationIdFrom(headers: {
  get(name: string): string | null;
}): string {
  const inbound = headers.get(CORRELATION_HEADER);
  return isCorrelationId(inbound) ? inbound : newCorrelationId();
}

/** Wording appended to a user-facing failure so support can trace it. */
export function supportReference(id: string): string {
  return `Reference ${id}. Share this code with support and we can trace exactly what happened.`;
}
