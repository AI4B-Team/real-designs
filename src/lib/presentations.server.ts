import { createClient } from "@supabase/supabase-js";

/** Publishable-key client used for the token-gated public share RPCs. */
export function publicShareClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input: any, init: any) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

/** Turn a stored room-photo path into a short-lived signed URL. */
export async function signRoomPhoto(path: string | null) {
  if (!path || /^(https?:|\/|data:)/.test(path)) return path;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.storage.from("room-photos").createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}
