/* Music preview + custom track uploads for REAL DESIGNS video builders.
   Built-in tracks are synthesized with WebAudio so previews work offline.
   Uploaded tracks play through an <audio> element for the current session. */

type Mood = {
  bpm: number;
  root: number;
  scale: number[];
  wave: OscillatorType;
  pad: number;
  bright: number;
};

const MOODS: Record<string, Mood> = {
  modern: { bpm: 104, root: 261.63, scale: [0, 4, 7, 11, 14], wave: "triangle", pad: 0.14, bright: 1600 },
  luxury: { bpm: 76, root: 196.0, scale: [0, 3, 7, 10, 14], wave: "sine", pad: 0.2, bright: 1100 },
  warm: { bpm: 88, root: 220.0, scale: [0, 4, 7, 9, 12], wave: "sine", pad: 0.18, bright: 1300 },
  cinematic: { bpm: 68, root: 174.61, scale: [0, 3, 7, 12, 15], wave: "sawtooth", pad: 0.1, bright: 900 },
  upbeat: { bpm: 122, root: 293.66, scale: [0, 4, 7, 9, 12], wave: "square", pad: 0.06, bright: 2000 },
  minimal: { bpm: 96, root: 246.94, scale: [0, 5, 7, 12], wave: "triangle", pad: 0.09, bright: 1500 },
};

export type CustomTrack = { id: string; name: string; url: string };

const BUCKET = "user-audio";
const customTracks: CustomTrack[] = [];
export const getCustomTracks = () => customTracks.slice();
export const isCustom = (id: string) => id.startsWith("custom:");

let loaded = false;
let loading: Promise<CustomTrack[]> | null = null;

/** Load previously uploaded tracks for the signed-in user (once per session). */
export function loadCustomTracks(force = false): Promise<CustomTrack[]> {
  if (loaded && !force) return Promise.resolve(getCustomTracks());
  if (loading) return loading;
  loading = (async () => {
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth?.user?.id;
      if (!uid) return getCustomTracks();
      const { data: files } = await supabase.storage.from(BUCKET).list(uid, { limit: 100, sortBy: { column: "created_at", order: "desc" } });
      for (const f of files || []) {
        const id = "custom:" + f.name;
        if (customTracks.some((t) => t.id === id)) continue;
        const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(`${uid}/${f.name}`, 60 * 60 * 8);
        if (!signed?.signedUrl) continue;
        const name = f.name.replace(/^\d+-/, "").replace(/\.[a-z0-9]+$/i, "").slice(0, 60) || "My Track";
        customTracks.push({ id, name, url: signed.signedUrl });
      }
      loaded = true;
    } catch (_) { /* offline / signed out — session-only tracks still work */ }
    return getCustomTracks();
  })();
  const p = loading;
  p.finally(() => { loading = null; });
  return p;
}

export function addCustomTrack(file: File): CustomTrack {
  const ext = (file.name.match(/\.[a-z0-9]+$/i) || [".mp3"])[0].toLowerCase();
  const key = `${Date.now()}-${file.name.replace(/[^a-z0-9._-]+/gi, "-").slice(-48)}`.replace(/\.[a-z0-9]+$/i, "") + ext;
  const t: CustomTrack = {
    id: "custom:" + key,
    name: file.name.replace(/\.[a-z0-9]+$/i, "").slice(0, 60) || "My Track",
    url: URL.createObjectURL(file),
  };
  customTracks.push(t);
  // Persist in the background so the track survives reloads.
  void (async () => {
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth?.user?.id;
      if (!uid) return;
      await supabase.storage.from(BUCKET).upload(`${uid}/${key}`, file, {
        contentType: file.type || "audio/mpeg",
        upsert: true,
      });
    } catch (_) { /* keep the local object URL */ }
  })();
  return t;
}


/* ---------------- playback ---------------- */
let ctx: AudioContext | null = null;
let stopFn: (() => void) | null = null;
let currentId: string | null = null;
let audioEl: HTMLAudioElement | null = null;
const listeners = new Set<(id: string | null) => void>();

export function onMusicChange(fn: (id: string | null) => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
const emit = () => listeners.forEach((f) => { try { f(currentId); } catch (_) { /* noop */ } });

export const playingId = () => currentId;

export function stopMusic() {
  if (stopFn) { try { stopFn(); } catch (_) { /* noop */ } stopFn = null; }
  if (audioEl) { try { audioEl.pause(); } catch (_) { /* noop */ } audioEl = null; }
  currentId = null;
  emit();
}

function synth(mood: Mood) {
  if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  const ac = ctx;
  if (ac.state === "suspended") ac.resume().catch(() => {});

  const master = ac.createGain();
  master.gain.value = 0;
  const filter = ac.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = mood.bright;
  filter.connect(master);
  master.connect(ac.destination);
  master.gain.linearRampToValueAtTime(0.5, ac.currentTime + 0.5);

  // sustained pad (two detuned oscillators on the root + fifth)
  const pads: OscillatorNode[] = [];
  [0, 7].forEach((semi, i) => {
    const o = ac.createOscillator();
    o.type = "sine";
    o.frequency.value = mood.root * Math.pow(2, semi / 12) / 2;
    o.detune.value = i ? 6 : -6;
    const g = ac.createGain();
    g.gain.value = mood.pad;
    o.connect(g); g.connect(filter);
    o.start();
    pads.push(o);
  });

  // arpeggio
  const step = 60 / mood.bpm / 2;
  let i = 0;
  const tick = () => {
    const semi = (mood.scale[i % mood.scale.length] ?? 0) + (i % 8 >= 4 ? 12 : 0);
    const o = ac.createOscillator();
    o.type = mood.wave;
    o.frequency.value = mood.root * Math.pow(2, semi / 12);
    const g = ac.createGain();
    const t = ac.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.12, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + step * 1.6);
    o.connect(g); g.connect(filter);
    o.start(t); o.stop(t + step * 1.8);
    i += 1;
  };
  tick();
  const timer = window.setInterval(tick, step * 1000);

  return () => {
    window.clearInterval(timer);
    try { master.gain.cancelScheduledValues(ac.currentTime); } catch (_) { /* noop */ }
    master.gain.linearRampToValueAtTime(0.0001, ac.currentTime + 0.15);
    window.setTimeout(() => pads.forEach((o) => { try { o.stop(); } catch (_) { /* noop */ } }), 200);
  };
}

/** Toggle preview playback for a track id. Returns true when it started playing. */
export function toggleMusic(id: string): boolean {
  if (!id || id === "none") { stopMusic(); return false; }
  if (currentId === id) { stopMusic(); return false; }
  stopMusic();

  if (isCustom(id)) {
    const t = customTracks.find((c) => c.id === id);
    if (!t) return false;
    audioEl = new Audio(t.url);
    audioEl.loop = true;
    audioEl.volume = 0.8;
    audioEl.addEventListener("ended", () => stopMusic());
    audioEl.play().catch(() => {});
    currentId = id;
    emit();
    return true;
  }

  const mood = MOODS[id];
  if (!mood) return false;
  try { stopFn = synth(mood); } catch (_) { return false; }
  currentId = id;
  emit();
  return true;
}
