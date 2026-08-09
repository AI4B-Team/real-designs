import { supabase } from "@/integrations/supabase/client";

/**
 * Room photo storage (private bucket "room-photos").
 * Objects live under `${user.id}/...` — storage RLS scopes every read and
 * write to the owning folder, so a path is never trusted from the client.
 */

const BUCKET = "room-photos";

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

export async function roomPhotoUrl(path: string, expiresIn = 3600): Promise<string | null> {
  if (!isStoredPhoto(path)) return path;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresIn);
  if (error) return null;
  return data?.signedUrl ?? null;
}

export async function deleteRoomPhoto(path: string): Promise<void> {
  if (!isStoredPhoto(path)) return;
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
