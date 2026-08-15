/* Voice Cloning for REAL DESIGNS narration.

   The user records or uploads a short sample of their own voice. A speech model
   profiles it (closest synthesis voice + delivery brief) and the profile is
   reused by every video builder, so AI narration sounds like the user instead
   of a stock preset. The sample itself is stored in the signed-in user's own
   audio folder so the profile survives a reload on any device. */

export type VoiceProfile = {
  id: string;
  label: string;
  voice: string;
  instructions: string;
  summary: string;
  createdAt: number;
  samplePath?: string;
};

const KEY = "rd.voiceProfile";
const BUCKET = "user-audio";

let cached: VoiceProfile | null | undefined;

export function getVoiceProfile(): VoiceProfile | null {
  if (cached !== undefined) return cached;
  try {
    const raw = localStorage.getItem(KEY);
    cached = raw ? (JSON.parse(raw) as VoiceProfile) : null;
  } catch (_) {
    cached = null;
  }
  return cached;
}

export function saveVoiceProfile(p: VoiceProfile) {
  cached = p;
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch (_) { /* private mode — session only */ }
  try {
    window.dispatchEvent(new CustomEvent("rd:voice-profile"));
  } catch (_) { /* noop */ }
}

export function clearVoiceProfile() {
  cached = null;
  try {
    localStorage.removeItem(KEY);
  } catch (_) { /* noop */ }
  try {
    window.dispatchEvent(new CustomEvent("rd:voice-profile"));
  } catch (_) { /* noop */ }
}

/** Voice id used in builder selects when the user picks their own voice. */
export const MY_VOICE = "myvoice";

/** Resolve a builder voice choice into the narration request fields. */
export function voiceRequest(choice: string | null | undefined, map: Record<string, string>) {
  const key = (choice || "").toLowerCase();
  if (key === MY_VOICE) {
    const p = getVoiceProfile();
    if (p) return { voice: p.voice, instructions: p.instructions };
  }
  return { voice: map[key] || "alloy", instructions: null as string | null };
}

const EXT: Record<string, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/flac": "flac",
  "audio/aac": "aac",
};

/** Container the speech model expects, derived from the recording's MIME type. */
export function audioFormat(file: Blob & { name?: string }): string {
  const mime = (file.type || "").split(";")[0]!.toLowerCase();
  if (EXT[mime]) return EXT[mime]!;
  const ext = (file.name || "").match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase();
  if (ext && ["wav", "mp3", "webm", "m4a", "ogg", "aac", "flac"].includes(ext)) return ext;
  return "webm";
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).replace(/^data:[^,]+,/, ""));
    r.onerror = () => rej(new Error("Could not read that audio file."));
    r.readAsDataURL(blob);
  });
}

/** Store the sample under the signed-in user's own folder. Best effort. */
async function storeSample(blob: Blob, ext: string): Promise<string | undefined> {
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth?.user?.id;
    if (!uid) return undefined;
    const path = `${uid}/voice-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { upsert: true });
    return error ? undefined : path;
  } catch (_) {
    return undefined;
  }
}

/** Profile a recorded or uploaded sample and save it as the active voice. */
export async function createVoiceProfile(blob: Blob & { name?: string }, label: string): Promise<VoiceProfile> {
  const format = audioFormat(blob);
  const audio = await blobToBase64(blob);
  if (audio.length < 64) throw new Error("That recording is too short. Read two sentences and try again.");
  const { analyzeVoiceSample } = await import("@/lib/voice-clone.functions");
  const out = await analyzeVoiceSample({ data: { audio, format: format as any, label: label || "My Voice" } });
  const samplePath = await storeSample(blob, format);
  const profile: VoiceProfile = {
    id: "vp-" + Date.now(),
    label: (label || out.label || "My Voice").slice(0, 48),
    voice: out.voice,
    instructions: out.instructions,
    summary: out.summary || "",
    createdAt: Date.now(),
    ...(samplePath ? { samplePath } : {}),
  };
  saveVoiceProfile(profile);
  return profile;
}

/** Sample sentences the user reads so the model hears range and pace. */
export const VOICE_SCRIPT =
  "Welcome to this beautifully renovated home. Natural light fills the open living space, and the kitchen opens straight onto the terrace. Book a private showing this weekend.";
