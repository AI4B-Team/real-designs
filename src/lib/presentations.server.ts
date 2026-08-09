
/** Turn a stored room-photo path into a short-lived signed URL. */
export async function signRoomPhoto(path: string | null) {
  if (!path || /^(https?:|\/|data:)/.test(path)) return path;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.storage.from("room-photos").createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}
