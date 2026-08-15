import { supabase } from "@/integrations/supabase/client";

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
export async function resolvePhotoUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  if (/^\/(?:src\/)?assets\//.test(path)) return bundledPhotoUrl(path) ?? path;
  if (isStoredPhoto(path)) return roomPhotoUrl(path);
  return path;
}

export function isStoredPhoto(path: string | null | undefined): boolean {
  if (!path) return false;
  return !/^(https?:|\/|data:)/.test(path);
}

export async function uploadRoomPhoto(file: File): Promise<string> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error("Sign in to upload photos.");
  if (!file.type.startsWith("image/")) throw new Error("That file is not an image.");
  if (file.size > 15 * 1024 * 1024) throw new Error("Photos must be under 15 MB.");

  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${uid}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
  if (error) throw new Error(error.message);

  return path;
}

/* Signed URLs are memoized per path (until shortly before they expire) so that
   re-rendering a gallery reuses the same URL instead of re-signing every tile,
   which made thumbnails blank out for a moment on each repaint. */
const SIGNED = new Map<string, { url: string; exp: number }>();

export async function roomPhotoUrl(path: string, expiresIn = 3600): Promise<string | null> {
  if (!isStoredPhoto(path)) return path;
  const hit = SIGNED.get(path);
  if (hit && hit.exp > Date.now()) return hit.url;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresIn);
  if (error) return null;
  const url = data?.signedUrl ?? null;
  if (url) SIGNED.set(path, { url, exp: Date.now() + Math.max(30, expiresIn - 60) * 1000 });
  return url;
}

export async function deleteRoomPhoto(path: string): Promise<void> {
  if (!isStoredPhoto(path)) return;
  SIGNED.delete(path);
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
