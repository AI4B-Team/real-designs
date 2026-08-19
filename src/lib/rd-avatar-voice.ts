/* Voice previews for the AI Presenter picker.

   Every presenter reads the same short hello script so the user can compare
   voices side by side. Clips are synthesized once per presenter and cached for
   the session, so replaying is instant and costs nothing extra. */

import { AVATAR_SAMPLE_SCRIPT, avatarVoice, findAvatar } from "@/lib/rd-avatars";

const cache = new Map<string, string>();
const pending = new Map<string, Promise<string>>();
let current: HTMLAudioElement | null = null;
let currentId = "";

/** The hello line a given presenter reads, personalized with their name. */
export function avatarSampleScript(id: string): string {
  const name = findAvatar(id).name;
  return AVATAR_SAMPLE_SCRIPT.replace("your presenter", name);
}

/** Id of the presenter currently speaking, or "" when nothing is playing. */
export const speakingAvatar = () => currentId;

export function stopAvatarVoice() {
  try {
    current?.pause();
  } catch (_) {
    /* noop */
  }
  current = null;
  currentId = "";
  emit();
}

function emit() {
  try {
    window.dispatchEvent(new CustomEvent("rd:avatar-voice"));
  } catch (_) {
    /* noop */
  }
}

async function clipFor(id: string): Promise<string> {
  const hit = cache.get(id);
  if (hit) return hit;
  const inFlight = pending.get(id);
  if (inFlight) return inFlight;
  const job = (async () => {
    const { synthesizeNarration } = await import("@/lib/narration.functions");
    const { voice, instructions } = avatarVoice(id);
    const out = await synthesizeNarration({
      data: { script: avatarSampleScript(id), voice, instructions },
    });
    cache.set(id, out.audio);
    return out.audio;
  })();
  pending.set(id, job);
  // Detach bookkeeping from the caller's chain so a failed clip never surfaces
  // as an unhandled rejection.
  void job.finally(() => pending.delete(id)).catch(() => {});
  return job;
}

/**
 * Play (or stop) a presenter's sample line.
 * Returns "played" | "stopped", and throws with a readable message on failure.
 */
export async function playAvatarVoice(id: string): Promise<"played" | "stopped"> {
  if (currentId === id) {
    stopAvatarVoice();
    return "stopped";
  }
  stopAvatarVoice();
  currentId = id;
  emit();
  let src: string;
  try {
    src = await clipFor(id);
  } catch (err) {
    if (currentId === id) stopAvatarVoice();
    throw err instanceof Error ? err : new Error("Voice Preview Failed.");
  }
  if (currentId !== id) return "stopped"; // user moved on while it rendered
  const audio = new Audio(src);
  current = audio;
  audio.addEventListener("ended", () => {
    if (current === audio) stopAvatarVoice();
  });
  audio.addEventListener("error", () => {
    if (current === audio) stopAvatarVoice();
  });
  try {
    await audio.play();
  } catch (_) {
    stopAvatarVoice();
    throw new Error("Your Browser Blocked Playback. Tap Again To Listen.");
  }
  return "played";
}
