/**
 * Redaction rules for anything that leaves the server as a log line, an alert
 * payload or a health response.
 *
 * The rule is simple and absolute: secrets, credentials, payment data and
 * private object URLs never reach a log. Signed storage URLs are treated as
 * credentials because the query string IS the access grant.
 */

const SECRET_KEY_PATTERN =
  /(api[_-]?key|secret|token|password|passwd|authorization|auth|bearer|cookie|session|service[_-]?role|signature|card|cvc|cvv|pan|iban|account[_-]?number|client[_-]?secret|refresh)/i;

const SIGNED_URL_PATTERN = /https?:\/\/[^\s"']+/gi;
const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\b/g;
const KEYLIKE_PATTERN = /\b(sb_(?:secret|publishable)_[A-Za-z0-9_-]{8,}|sk_[a-z]+_[A-Za-z0-9]{8,}|whsec_[A-Za-z0-9]{8,}|re_[A-Za-z0-9]{8,})\b/g;
const CARD_PATTERN = /\b(?:\d[ -]?){13,19}\b/g;

export const REDACTED = "[redacted]";

/** Keep the shape of a URL (host + path) but drop credentials and queries. */
export function redactUrl(value: string): string {
  try {
    const url = new URL(value);
    const signed = url.searchParams.has("token") || url.searchParams.has("X-Amz-Signature");
    const isStorage = /\/storage\/v1\/object\//.test(url.pathname);
    if (signed || isStorage) return `${url.origin}${url.pathname.split("/").slice(0, 5).join("/")}/[object]`;
    url.search = "";
    url.username = "";
    url.password = "";
    return url.toString();
  } catch {
    return REDACTED;
  }
}

/** Scrub a free-text string (error message, stack line, note). */
export function redactText(input: string): string {
  return input
    .replace(JWT_PATTERN, REDACTED)
    .replace(KEYLIKE_PATTERN, REDACTED)
    .replace(SIGNED_URL_PATTERN, (m) => redactUrl(m))
    .replace(CARD_PATTERN, (m) => (m.replace(/\D/g, "").length >= 13 ? REDACTED : m));
}

/** Scrub an arbitrary structure before it is serialized into a log. */
export function redactValue(value: unknown, depth = 0): unknown {
  if (depth > 6) return REDACTED;
  if (value == null) return value;
  if (typeof value === "string") return redactText(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => redactValue(v, depth + 1));
  if (value instanceof Error) return redactText(`${value.name}: ${value.message}`);
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SECRET_KEY_PATTERN.test(k) ? REDACTED : redactValue(v, depth + 1);
    }
    return out;
  }
  return REDACTED;
}

/** True when a payload still carries something that must never be logged. */
export function containsSensitive(value: unknown): boolean {
  const serialized = JSON.stringify(redactValue(value)) ?? "";
  return JSON.stringify(value ?? null) !== serialized;
}
