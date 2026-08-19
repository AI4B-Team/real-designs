/**
 * Canonical object naming for every REAL DESIGNS bucket.
 *
 * Three rules, applied everywhere a file is written:
 *  1. the first path segment is the owner's user id, because storage RLS
 *     scopes reads and writes to that folder;
 *  2. the object name carries a UUID, so two uploads of "IMG_0001.jpg" can
 *     never collide or overwrite one another;
 *  3. the original filename is sanitized before it is reused, so nothing that
 *     a filesystem or a URL treats as structure survives ("../", "/", control
 *     characters, leading dots).
 *
 * Callers store the returned PATH, never a signed URL — signatures expire,
 * paths do not.
 */

export const BUCKETS = {
  roomPhotos: "room-photos",
  revealVideos: "reveal-videos",
  userAudio: "user-audio",
} as const;

export type BucketName = (typeof BUCKETS)[keyof typeof BUCKETS];

/** Per-bucket upload contract, mirrored by the bucket configuration itself. */
export const BUCKET_LIMITS: Record<BucketName, { maxBytes: number; mime: RegExp; label: string }> = {
  "room-photos": { maxBytes: 15 * 1024 * 1024, mime: /^image\//, label: "Photos must be an image under 15 MB." },
  "reveal-videos": { maxBytes: 200 * 1024 * 1024, mime: /^video\//, label: "Videos must be a video file under 200 MB." },
  "user-audio": { maxBytes: 25 * 1024 * 1024, mime: /^audio\//, label: "Audio must be an audio file under 25 MB." },
};

const MAX_STEM = 48;

/** Strip everything that could act as path structure or shell/URL syntax. */
export function sanitizeFileName(name: string): string {
  const base = (name.split(/[\\/]/).pop() ?? "").normalize("NFKD");
  const cleaned = base
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^[.\-]+/, "")
    .replace(/-{2,}/g, "-");
  return cleaned.slice(0, 120);
}

/** Lowercase, alphanumeric extension; falls back to the given default. */
export function safeExtension(name: string, fallback = "bin"): string {
  const ext = sanitizeFileName(name).split(".").pop() ?? "";
  const clean = ext.toLowerCase().replace(/[^a-z0-9]/g, "");
  return clean && clean.length <= 8 && clean !== sanitizeFileName(name).toLowerCase() ? clean : fallback;
}

/**
 * `<userId>/<sanitized-stem>-<uuid>.<ext>` — owner-scoped, readable and
 * collision resistant.
 */
export function buildObjectPath(userId: string, fileName: string, opts?: { prefix?: string; fallbackExt?: string }): string {
  if (!/^[0-9a-f-]{36}$/i.test(userId)) throw new Error("A signed-in user is required to upload files.");
  const ext = safeExtension(fileName, opts?.fallbackExt ?? "bin");
  const stem =
    sanitizeFileName(fileName)
      .replace(/\.[^.]*$/, "")
      .slice(0, MAX_STEM) || "file";
  const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const prefix = opts?.prefix ? `${sanitizeFileName(opts.prefix)}/` : "";
  return `${userId}/${prefix}${stem}-${id}.${ext}`;
}

/** True when a stored path belongs to the given user's folder. */
export function isOwnedPath(path: string | null | undefined, userId: string): boolean {
  if (!path) return false;
  return path.startsWith(`${userId}/`) && !path.includes("..");
}

/** Validate a file against its bucket contract before any network call. */
export function assertUploadAllowed(bucket: BucketName, file: { type: string; size: number }): void {
  const limit = BUCKET_LIMITS[bucket];
  if (!limit.mime.test(file.type || "")) throw new Error(limit.label);
  if (file.size > limit.maxBytes) throw new Error(limit.label);
}
