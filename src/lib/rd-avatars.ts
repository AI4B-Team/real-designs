/* AI Presenter avatars for REAL DESIGNS video builders.
   Presets ship with the app; users can also upload their own headshot,
   which is stored under the signed-in user's own storage folder. */

import ava from "@/assets/avatars/presenter-ava.jpg";
import marcus from "@/assets/avatars/presenter-marcus.jpg";
import nia from "@/assets/avatars/presenter-nia.jpg";
import kai from "@/assets/avatars/presenter-kai.jpg";
import sofia from "@/assets/avatars/presenter-sofia.jpg";
import grant from "@/assets/avatars/presenter-grant.jpg";

export type Avatar = {
  id: string;
  name: string;
  blurb: string;
  url: string;
  custom?: boolean;
  /** Text-to-speech voice this presenter speaks with. */
  voice?: string;
  /** Delivery brief that shapes tone and pacing for this presenter. */
  instructions?: string;
};

/** How the presenter appears in the rendered video. */
export type AvatarMode = "intro_bubble" | "full" | "bubble";

export const AVATAR_MODES: { id: AvatarMode; label: string; blurb: string }[] = [
  { id: "intro_bubble", label: "Intro + Corner Bubble", blurb: "Full-frame open and close, plus a small presenter bubble over the tour." },
  { id: "full", label: "Full-Frame Only", blurb: "Presenter opens and closes the video; property scenes stay clean." },
  { id: "bubble", label: "Corner Bubble Only", blurb: "Presenter stays in the corner while the property scenes play." },
];

export type AvatarConfig = {
  enabled: boolean;
  avatarId: string;
  mode: AvatarMode;
  name: string;
  title: string;
  greeting: string;
  corner: "bottom_left" | "bottom_right" | "top_left" | "top_right";
};

export function blankAvatarConfig(): AvatarConfig {
  return {
    enabled: false,
    avatarId: "ava",
    mode: "intro_bubble",
    name: "",
    title: "",
    greeting: "",
    corner: "bottom_right",
  };
}

export const PRESET_AVATARS: Avatar[] = [
  { id: "ava", name: "Ava", blurb: "Warm Listing Agent", url: ava, voice: "shimmer", instructions: "Warm, welcoming and upbeat, like a friendly listing agent greeting buyers at the door. Moderate pace." },
  { id: "marcus", name: "Marcus", blurb: "Confident Closer", url: marcus, voice: "echo", instructions: "Confident and persuasive, crisp consonants, steady pace with a light smile in the voice." },
  { id: "nia", name: "Nia", blurb: "Luxury Specialist", url: nia, voice: "coral", instructions: "Polished and refined, unhurried and elegant, the tone of a luxury property specialist." },
  { id: "kai", name: "Kai", blurb: "Friendly Guide", url: kai, voice: "verse", instructions: "Easygoing and conversational, like a friend showing you around. Relaxed pace." },
  { id: "sofia", name: "Sofia", blurb: "Neighborhood Expert", url: sofia, voice: "sage", instructions: "Bright, knowledgeable and neighborly, with a helpful local-expert energy." },
  { id: "grant", name: "Grant", blurb: "Veteran Broker", url: grant, voice: "ash", instructions: "Deeper, seasoned and reassuring, measured delivery with authority." },
];

/** Sample line every presenter reads when the user previews the voice. */
export const AVATAR_SAMPLE_SCRIPT =
  "Hi, I'm your presenter for this tour. Let's step inside and take a look around this beautiful home.";

/** Narration voice and delivery for a presenter (uploaded headshots use a neutral default). */
export function avatarVoice(id: string): { voice: string; instructions: string } {
  const a = findAvatar(id);
  return {
    voice: a.voice || "alloy",
    instructions: a.instructions || "Warm, natural real estate narration at a moderate pace.",
  };
}

const BUCKET = "room-photos";
const custom: Avatar[] = [];
export const getCustomAvatars = () => custom.slice();
export const allAvatars = () => [...PRESET_AVATARS, ...custom];
export const findAvatar = (id: string) => allAvatars().find((a) => a.id === id) || PRESET_AVATARS[0]!;

let loaded = false;
let loading: Promise<Avatar[]> | null = null;

/** Load headshots the user previously uploaded (once per session). */
export function loadCustomAvatars(force = false): Promise<Avatar[]> {
  if (loaded && !force) return Promise.resolve(getCustomAvatars());
  if (loading) return loading;
  loading = (async () => {
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth?.user?.id;
      if (!uid) return getCustomAvatars();
      const { data: files } = await supabase.storage
        .from(BUCKET)
        .list(`${uid}/avatars`, { limit: 50, sortBy: { column: "created_at", order: "desc" } });
      for (const f of files || []) {
        const id = "custom:" + f.name;
        if (custom.some((a) => a.id === id)) continue;
        const { data: signed } = await supabase.storage
          .from(BUCKET)
          .createSignedUrl(`${uid}/avatars/${f.name}`, 60 * 60 * 8);
        if (!signed?.signedUrl) continue;
        custom.push({ id, name: "My Presenter", blurb: "Uploaded Headshot", url: signed.signedUrl, custom: true });
      }
      loaded = true;
    } catch (_) {
      /* offline or signed out — session uploads still work */
    }
    return getCustomAvatars();
  })();
  const p = loading;
  p.finally(() => {
    loading = null;
  });
  return p;
}

/** Add an uploaded headshot; usable immediately and persisted in the background. */
export function addCustomAvatar(file: File): Avatar {
  const ext = (file.name.match(/\.[a-z0-9]+$/i) || [".jpg"])[0]!.toLowerCase();
  const key = `${Date.now()}${ext}`;
  const a: Avatar = {
    id: "custom:" + key,
    name: "My Presenter",
    blurb: "Uploaded Headshot",
    url: URL.createObjectURL(file),
    custom: true,
  };
  custom.unshift(a);
  void (async () => {
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth?.user?.id;
      if (!uid) return;
      await supabase.storage.from(BUCKET).upload(`${uid}/avatars/${key}`, file, {
        contentType: file.type || "image/jpeg",
        upsert: true,
      });
    } catch (_) {
      /* keep the session-only copy */
    }
  })();
  return a;
}

/** A short spoken opener the narration script can start with. */
export function avatarGreeting(cfg: AvatarConfig, title?: string | null): string {
  if (cfg.greeting.trim()) return cfg.greeting.trim();
  const who = cfg.name.trim() || findAvatar(cfg.avatarId).name;
  const role = cfg.title.trim() ? `, ${cfg.title.trim()}` : "";
  const what = (title || "").trim() ? ` Let me walk you through ${title!.trim()}.` : " Let me walk you through this home.";
  return `Hi, I'm ${who}${role}.${what}`;
}
