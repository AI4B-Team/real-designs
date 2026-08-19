import { supabase } from "@/integrations/supabase/client";
import { assertUploadAllowed, buildObjectPath } from "@/lib/storage-paths";


/**
 * Room photo storage (private bucket "room-photos").
 * Objects live under `${user.id}/...` — storage RLS scopes every read and
 * write to the owning folder, so a path is never trusted from the client.
 */

const BUCKET = "room-photos";

/**
 * Sample/demo rows store the *source* path of a bundled asset (e.g.
 * "/src/assets/room-before.jpg"). That path only resolves in dev — a
 * production build emits hashed filenames — so map it back to the real
 * bundled URL at render time.
 */
const BUNDLED = import.meta.glob("/src/assets/*.{jpg,jpeg,png,webp}", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

export function bundledPhotoUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const name = /(?:^|\/)([^/]+\.(?:jpe?g|png|webp))$/i.exec(path)?.[1];
  if (!name) return null;
  const direct = BUNDLED["/src/assets/" + name];
  if (direct) return direct;
  // Built filenames carry a content hash: room-before-B1a2c3.jpg
  const base = name.replace(/-[A-Za-z0-9_-]{6,}(\.[a-z]+)$/i, "$1");
  return BUNDLED["/src/assets/" + base] ?? null;
}

/** Resolve any stored photo reference to a displayable URL. */
export async function resolvePhotoUrl(
  path: string | null | undefined,
  opts?: { expiresIn?: number; force?: boolean },
): Promise<string | null> {
  if (!path) return null;
  if (/^\/(?:src\/)?assets\//.test(path)) return bundledPhotoUrl(path) ?? path;
  if (isStoredPhoto(path)) return roomPhotoUrl(path, opts?.expiresIn ?? 3600, opts?.force);
  return path;
}

export function isStoredPhoto(path: string | null | undefined): boolean {
  if (!path) return false;
  // Local uploads use browser object URLs until the video is saved. They are
  // already displayable and must never be sent to storage for URL signing.
  return !/^(https?:|blob:|\/|data:)/.test(path);
}

export async function uploadRoomPhoto(file: File): Promise<string> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error("Sign in to upload photos.");
  assertUploadAllowed("room-photos", file);

  // Sanitized original name + UUID: readable in the bucket, impossible to
  // collide, and nothing from the filename can act as path structure.
  const path = buildObjectPath(uid, file.name, { fallbackExt: "jpg" });


  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
  if (error) throw new Error(error.message);

  return path;
}

/* Signed URLs are memoized per path (until shortly before they expire) so that
   re-rendering a gallery reuses the same URL instead of re-signing every tile,
   which made thumbnails blank out for a moment on each repaint.
   Concurrent callers share one in-flight request, and a path that storage
   cannot sign (deleted or missing object) is remembered for a short while so a
   gallery does not fire the same failing request once per tile. */
const SIGNED = new Map<string, { url: string; exp: number }>();
const PENDING = new Map<string, Promise<string | null>>();
const MISSING = new Map<string, number>();
const MISS_TTL = 60_000;

export async function roomPhotoUrl(path: string, expiresIn = 3600, force = false): Promise<string | null> {
  if (!isStoredPhoto(path)) return path;
  if (force) {
    SIGNED.delete(path);
    MISSING.delete(path);
  }
  const hit = SIGNED.get(path);
  if (!force && hit && hit.exp > Date.now()) return hit.url;
  const missed = MISSING.get(path);
  if (!force && missed && missed > Date.now()) return null;
  const inflight = PENDING.get(path);
  if (inflight && !force) return inflight;

  const req = (async () => {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresIn);
    const url = error ? null : (data?.signedUrl ?? null);
    if (url) {
      MISSING.delete(path);
      SIGNED.set(path, { url, exp: Date.now() + Math.max(30, expiresIn - 60) * 1000 });
    } else {
      MISSING.set(path, Date.now() + MISS_TTL);
    }
    return url;
  })().finally(() => PENDING.delete(path));

  PENDING.set(path, req);
  return req;
}

/**
 * When the currently memoized signed URL for a path actually stops working.
 *
 * A URL signed for one hour by one caller is reused by every later caller, so
 * a caller that *asked* for six hours must not assume it holds a six hour URL:
 * that mismatch is what made whole grids of thumbnails expire at once. Callers
 * cache against this real expiry instead of the lifetime they requested.
 */
export function signedPhotoExpiry(path: string | null | undefined): number | null {
  if (!path) return null;
  const hit = SIGNED.get(path);
  return hit ? hit.exp : null;
}


export async function deleteRoomPhoto(path: string): Promise<void> {
  if (!isStoredPhoto(path)) return;
  SIGNED.delete(path);
  MISSING.delete(path);
  await supabase.storage.from(BUCKET).remove([path]);
}

/** Persist a generated render (data URL) into the user's private bucket. */
export async function uploadRenderDataUrl(dataUrl: string): Promise<string> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error("Sign in to save renders.");
  if (!/^data:image\//.test(dataUrl)) throw new Error("That render is not an image.");

  const blob = await (await fetch(dataUrl)).blob();
  const ext = (blob.type.split("/")[1] || "png").replace(/[^a-z0-9]/g, "") || "png";
  const path = `${uid}/renders/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { cacheControl: "3600", upsert: false, contentType: blob.type || "image/png" });
  if (error) throw new Error(error.message);

  return path;
}
