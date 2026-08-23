/**
 * Stable identity for a generation input.
 *
 * A data URL can be several megabytes, so the idempotency fingerprint uses a
 * cheap but stable digest of it: byte length plus the head and tail of the
 * payload. Two identical uploads produce the same identity; two different
 * photos effectively never collide.
 */
export function imageIdentity(dataUrl: string | null | undefined): string {
  if (!dataUrl) return "none";
  const body = dataUrl.slice(dataUrl.indexOf(",") + 1);
  return `${body.length}:${body.slice(0, 48)}:${body.slice(-48)}`;
}
