/* Music preview + custom track uploads for REAL DESIGNS video builders.
   Built-in tracks are synthesized with WebAudio so previews work offline.
   Uploaded tracks play through an <audio> element for the current session. */

type Mood = {
  bpm: number;
  root: number; // Hz of the tonic
  prog: number[][]; // chord progression, semitone offsets from the tonic
  scale: number[]; // melodic scale over the tonic
  lead: OscillatorType; // melody timbre
  padWave: OscillatorType; // chord bed timbre
  pad: number; // chord bed level
  bright: number; // master lowpass, Hz
  swing: number; // 0..0.3 shuffle amount
  drums: "none" | "brush" | "soft" | "house" | "pop" | "cine";
  bass: number; // bass level, 0 disables
  arp: number; // melody level, 0 disables
  delay: number; // echo feedback level
};

/* One preset per built-in track. Each is a short chord progression with a bass
   line, melody and its own drum feel, so the genres are actually distinct. */
const MOODS: Record<string, Mood> = {
  modern: {
    bpm: 104,
    root: 261.63,
    prog: [
      [0, 4, 7, 11],
      [-3, 2, 5, 9],
      [-5, 0, 4, 7],
      [-1, 2, 7, 11],
    ],
    scale: [0, 2, 4, 7, 9, 11],
    lead: "triangle",
    padWave: "sine",
    pad: 0.1,
    bright: 2600,
    swing: 0.04,
    drums: "soft",
    bass: 0.16,
    arp: 0.09,
    delay: 0.22,
  },
  luxury: {
    bpm: 74,
    root: 196.0,
    prog: [
      [0, 3, 7, 10],
      [-4, 0, 3, 7],
      [-7, -2, 2, 5],
      [-5, 0, 3, 10],
    ],
    scale: [0, 3, 5, 7, 10],
    lead: "sine",
    padWave: "sine",
    pad: 0.16,
    bright: 1500,
    swing: 0.06,
    drums: "none",
    bass: 0.13,
    arp: 0.06,
    delay: 0.34,
  },
  warm: {
    bpm: 88,
    root: 220.0,
    prog: [
      [0, 4, 7, 9],
      [-3, 0, 4, 7],
      [-5, -1, 2, 7],
      [0, 4, 7, 12],
    ],
    scale: [0, 2, 4, 7, 9],
    lead: "sine",
    padWave: "triangle",
    pad: 0.14,
    bright: 1800,
    swing: 0.1,
    drums: "brush",
    bass: 0.14,
    arp: 0.08,
    delay: 0.24,
  },
  cinematic: {
    bpm: 66,
    root: 174.61,
    prog: [
      [0, 3, 7, 14],
      [-5, -1, 2, 7],
      [-3, 0, 4, 12],
      [-7, 0, 3, 10],
    ],
    scale: [0, 3, 5, 7, 10, 12],
    lead: "sawtooth",
    padWave: "sawtooth",
    pad: 0.13,
    bright: 1200,
    swing: 0,
    drums: "cine",
    bass: 0.18,
    arp: 0.05,
    delay: 0.4,
  },
  upbeat: {
    bpm: 122,
    root: 293.66,
    prog: [
      [0, 4, 7, 11],
      [2, 5, 9, 12],
      [-3, 0, 4, 9],
      [-1, 4, 7, 11],
    ],
    scale: [0, 2, 4, 7, 9, 12],
    lead: "square",
    padWave: "triangle",
    pad: 0.06,
    bright: 3200,
    swing: 0,
    drums: "pop",
    bass: 0.17,
    arp: 0.11,
    delay: 0.16,
  },
  minimal: {
    bpm: 96,
    root: 246.94,
    prog: [
      [0, 7, 12],
      [-5, 2, 7],
      [-3, 4, 9],
      [0, 5, 12],
    ],
    scale: [0, 5, 7, 12],
    lead: "triangle",
    padWave: "sine",
    pad: 0.09,
    bright: 2200,
    swing: 0,
    drums: "soft",
    bass: 0.1,
    arp: 0.08,
    delay: 0.3,
  },
  porchlight: {
    bpm: 92,
    root: 233.08,
    prog: [
      [0, 4, 7],
      [5, 9, 12],
      [-3, 0, 4],
      [-5, 0, 7],
    ],
    scale: [0, 2, 4, 5, 7, 9],
    lead: "triangle",
    padWave: "triangle",
    pad: 0.08,
    bright: 2400,
    swing: 0.16,
    drums: "brush",
    bass: 0.16,
    arp: 0.12,
    delay: 0.14,
  },
  sunroom: {
    bpm: 110,
    root: 277.18,
    prog: [
      [0, 4, 7, 11],
      [-2, 2, 5, 9],
      [-5, 0, 4, 9],
      [-3, 2, 5, 11],
    ],
    scale: [0, 2, 4, 7, 11],
    lead: "triangle",
    padWave: "sine",
    pad: 0.09,
    bright: 3000,
    swing: 0.05,
    drums: "pop",
    bass: 0.15,
    arp: 0.1,
    delay: 0.2,
  },
  nightdrive: {
    bpm: 124,
    root: 220.0,
    prog: [
      [0, 3, 7, 10],
      [-2, 3, 5, 10],
      [-5, 0, 3, 7],
      [-4, 0, 5, 10],
    ],
    scale: [0, 3, 5, 7, 10],
    lead: "sawtooth",
    padWave: "sawtooth",
    pad: 0.08,
    bright: 2800,
    swing: 0,
    drums: "house",
    bass: 0.2,
    arp: 0.1,
    delay: 0.28,
  },
  openhouse: {
    bpm: 100,
    root: 261.63,
    prog: [
      [0, 4, 9],
      [-3, 2, 7],
      [-5, 0, 4],
      [2, 7, 11],
    ],
    scale: [0, 2, 4, 7, 9],
    lead: "triangle",
    padWave: "triangle",
    pad: 0.1,
    bright: 2500,
    swing: 0.12,
    drums: "brush",
    bass: 0.13,
    arp: 0.11,
    delay: 0.22,
  },
  stringlight: {
    bpm: 70,
    root: 207.65,
    prog: [
      [0, 4, 7, 11],
      [-4, 0, 5, 9],
      [-7, -3, 2, 7],
      [-2, 2, 7, 11],
    ],
    scale: [0, 2, 4, 7, 11, 14],
    lead: "sine",
    padWave: "sawtooth",
    pad: 0.15,
    bright: 1400,
    swing: 0,
    drums: "none",
    bass: 0.12,
    arp: 0.07,
    delay: 0.38,
  },
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
      const { data: files } = await supabase.storage
        .from(BUCKET)
        .list(uid, { limit: 100, sortBy: { column: "created_at", order: "desc" } });
      for (const f of files || []) {
        const id = "custom:" + f.name;
        if (customTracks.some((t) => t.id === id)) continue;
        const { data: signed } = await supabase.storage
          .from(BUCKET)
          .createSignedUrl(`${uid}/${f.name}`, 60 * 60 * 8);
        if (!signed?.signedUrl) continue;
        const name =
          f.name
            .replace(/^\d+-/, "")
            .replace(/\.[a-z0-9]+$/i, "")
            .slice(0, 60) || "My Track";
        customTracks.push({ id, name, url: signed.signedUrl });
      }
      loaded = true;
    } catch (_) {
      /* offline / signed out — session-only tracks still work */
    }
    return getCustomTracks();
  })();
  const p = loading;
  p.finally(() => {
    loading = null;
  });
  return p;
}

export function addCustomTrack(file: File): CustomTrack {
  const ext = (file.name.match(/\.[a-z0-9]+$/i) || [".mp3"])[0].toLowerCase();
  const key =
    `${Date.now()}-${file.name.replace(/[^a-z0-9._-]+/gi, "-").slice(-48)}`.replace(
      /\.[a-z0-9]+$/i,
      "",
    ) + ext;
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
    } catch (_) {
      /* keep the local object URL */
    }
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
const emit = () =>
  listeners.forEach((f) => {
    try {
      f(currentId);
    } catch (_) {
      /* noop */
    }
  });

export const playingId = () => currentId;

export function stopMusic() {
  if (stopFn) {
    try {
      stopFn();
    } catch (_) {
      /* noop */
    }
    stopFn = null;
  }
  if (audioEl) {
    try {
      audioEl.pause();
    } catch (_) {
      /* noop */
    }
    audioEl = null;
  }
  currentId = null;
  emit();
}

/* A small arranger: chords, bass, melody and drums scheduled a bar ahead so
   playback stays in time. Every voice runs through a shared echo + lowpass. */
function synth(mood: Mood, out?: AudioNode, ac2?: AudioContext) {
  if (!ac2 && !ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  const ac = ac2 || ctx!;
  if (ac.state === "suspended") ac.resume().catch(() => {});

  const master = ac.createGain();
  master.gain.value = 0;
  master.connect(out || ac.destination);

  const filter = ac.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = mood.bright;
  filter.Q.value = 0.6;
  filter.connect(master);

  // shared echo send, gives the beds some room
  const delay = ac.createDelay(1.2);
  delay.delayTime.value = (60 / mood.bpm) * 0.75;
  const fb = ac.createGain();
  fb.gain.value = Math.min(0.45, mood.delay);
  const wet = ac.createGain();
  wet.gain.value = mood.delay * 0.5;
  delay.connect(fb);
  fb.connect(delay);
  delay.connect(wet);
  wet.connect(filter);

  master.gain.linearRampToValueAtTime(0.55, ac.currentTime + 0.8);

  const hz = (semi: number) => mood.root * Math.pow(2, semi / 12);
  const beat = 60 / mood.bpm;
  const bar = beat * 4;

  /* one shot voices ------------------------------------------------------ */
  function tone(
    t: number,
    freq: number,
    dur: number,
    level: number,
    type: OscillatorType,
    send = 0.3,
    detune = 0,
  ) {
    const o = ac.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    o.detune.value = detune;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.001, level), t + Math.min(0.08, dur * 0.2));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(filter);
    if (send > 0) {
      const s = ac.createGain();
      s.gain.value = send;
      g.connect(s);
      s.connect(delay);
    }
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  function noise(t: number, dur: number, level: number, hp: number, send = 0.1) {
    const len = Math.max(1, Math.floor(ac.sampleRate * dur));
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ac.createBufferSource();
    src.buffer = buf;
    const bp = ac.createBiquadFilter();
    bp.type = "highpass";
    bp.frequency.value = hp;
    const g = ac.createGain();
    g.gain.value = level;
    src.connect(bp);
    bp.connect(g);
    g.connect(filter);
    if (send > 0) {
      const s = ac.createGain();
      s.gain.value = send;
      g.connect(s);
      s.connect(delay);
    }
    src.start(t);
  }

  function kick(t: number, level = 0.5) {
    const o = ac.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    const g = ac.createGain();
    g.gain.setValueAtTime(level, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
    o.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + 0.3);
  }

  /* the arrangement ------------------------------------------------------ */
  let barIndex = 0;
  let nextBarAt = ac.currentTime + 0.12;

  function scheduleBar(t0: number, n: number) {
    const chord = mood.prog[n % mood.prog.length] || [0, 4, 7];

    // chord bed, held for the bar with a soft swell
    chord.forEach((semi, i) => {
      tone(t0, hz(semi) / 2, bar * 1.05, mood.pad, mood.padWave, 0.35, i % 2 ? 7 : -7);
    });

    // bass: root on 1 and 3, fifth pickup on the and of 4
    if (mood.bass > 0) {
      const rootSemi = (chord[0] ?? 0) - 12;
      tone(t0, hz(rootSemi) / 2, beat * 1.4, mood.bass, "sine", 0.05);
      tone(t0 + beat * 2, hz(rootSemi) / 2, beat * 1.2, mood.bass * 0.85, "sine", 0.05);
      tone(t0 + beat * 3.5, hz(rootSemi + 7) / 2, beat * 0.4, mood.bass * 0.6, "sine", 0.05);
    }

    // melody: eighth-note figure drawn from the scale over the chord
    if (mood.arp > 0) {
      const steps = 8;
      for (let s = 0; s < steps; s += 1) {
        if (n % 4 === 3 && s % 2 === 1) continue; // breathe on the turnaround bar
        const sw = s % 2 ? mood.swing * beat : 0;
        const t = t0 + s * (beat / 2) + sw;
        const tone1 = chord[s % chord.length] ?? 0;
        const passing = mood.scale[(s * 2 + n) % mood.scale.length] ?? 0;
        const semi = (s % 3 === 2 ? passing : tone1) + (s >= 4 ? 12 : 0);
        tone(t, hz(semi), beat * 0.72, mood.arp * (s % 4 === 0 ? 1 : 0.7), mood.lead, 0.32);
      }
    }

    // drums
    const d = mood.drums;
    if (d === "house") {
      for (let b = 0; b < 4; b += 1) {
        kick(t0 + b * beat, 0.55);
        noise(t0 + b * beat + beat / 2, 0.05, 0.09, 7000, 0.05);
      }
      noise(t0 + beat * 2, 0.18, 0.11, 1800, 0.12);
    } else if (d === "pop") {
      kick(t0, 0.5);
      kick(t0 + beat * 2.5, 0.42);
      noise(t0 + beat, 0.16, 0.12, 1600, 0.12);
      noise(t0 + beat * 3, 0.16, 0.12, 1600, 0.12);
      for (let s = 0; s < 8; s += 1) noise(t0 + s * (beat / 2), 0.035, 0.05, 8000, 0.03);
    } else if (d === "brush") {
      for (let s = 0; s < 8; s += 1) {
        const sw = s % 2 ? mood.swing * beat : 0;
        noise(t0 + s * (beat / 2) + sw, 0.07, s % 2 ? 0.035 : 0.06, 5200, 0.06);
      }
      noise(t0 + beat, 0.14, 0.07, 1400, 0.1);
      noise(t0 + beat * 3, 0.14, 0.07, 1400, 0.1);
    } else if (d === "soft") {
      kick(t0, 0.34);
      kick(t0 + beat * 2, 0.28);
      for (let s = 0; s < 4; s += 1) noise(t0 + s * beat + beat / 2, 0.04, 0.04, 9000, 0.04);
    } else if (d === "cine") {
      kick(t0, 0.5);
      if (n % 2 === 1) kick(t0 + beat * 3, 0.4);
      noise(t0 + beat * 2, 0.5, 0.05, 900, 0.3);
    }
  }

  // lookahead scheduler
  scheduleBar(nextBarAt, barIndex);
  barIndex += 1;
  nextBarAt += bar;
  const timer = window.setInterval(
    () => {
      while (nextBarAt < ac.currentTime + bar) {
        scheduleBar(nextBarAt, barIndex);
        barIndex += 1;
        nextBarAt += bar;
      }
    },
    Math.max(120, bar * 250),
  );

  return () => {
    window.clearInterval(timer);
    try {
      master.gain.cancelScheduledValues(ac.currentTime);
    } catch (_) {
      /* noop */
    }
    try {
      master.gain.setValueAtTime(master.gain.value, ac.currentTime);
    } catch (_) {
      /* noop */
    }
    master.gain.linearRampToValueAtTime(0.0001, ac.currentTime + 0.25);
    try {
      fb.gain.value = 0;
    } catch (_) {
      /* noop */
    }
  };
}

/** Toggle preview playback for a track id. Returns true when it started playing. */
export function toggleMusic(id: string): boolean {
  if (!id || id === "none") {
    stopMusic();
    return false;
  }
  if (currentId === id) {
    stopMusic();
    return false;
  }
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
  try {
    stopFn = synth(mood);
  } catch (_) {
    return false;
  }
  currentId = id;
  emit();
  return true;
}

/* ---------------- soundtrack for rendered videos ---------------- */

/** Build a live audio track for a music id (plus optional narration), to mux
 *  into a MediaRecorder stream. Music ducks automatically under narration. */
export async function createMusicTrack(
  id: string | null | undefined,
  volume = 0.6,
  narrationUrl?: string | null,
): Promise<{ track: MediaStreamTrack; stop: () => void } | null> {
  if ((!id || id === "none") && !narrationUrl) return null;
  try {
    const ac: AudioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (ac.state === "suspended") await ac.resume().catch(() => {});
    const dest = ac.createMediaStreamDestination();
    const gain = ac.createGain();
    gain.gain.value = volume;
    gain.connect(dest);

    let stopSrc: () => void = () => {};
    let stopVoice: () => void = () => {};

    if (narrationUrl) {
      try {
        const vres = await fetch(narrationUrl);
        const vbuf = await ac.decodeAudioData(await vres.arrayBuffer());
        const vsrc = ac.createBufferSource();
        vsrc.buffer = vbuf;
        const vgain = ac.createGain();
        vgain.gain.value = 1;
        vsrc.connect(vgain);
        vgain.connect(dest);
        vsrc.start();
        stopVoice = () => {
          try {
            vsrc.stop();
          } catch (_) {
            /* noop */
          }
        };
        // duck the music bed while a voice is present
        gain.gain.value = Math.min(volume, 0.22);
      } catch (_) {
        /* narration is optional */
      }
    }

    if (!id || id === "none") {
      const track0 = dest.stream.getAudioTracks()[0];
      if (!track0) {
        ac.close().catch(() => {});
        return null;
      }
      return {
        track: track0,
        stop: () => {
          stopVoice();
          try {
            track0.stop();
          } catch (_) {
            /* noop */
          }
          window.setTimeout(() => {
            ac.close().catch(() => {});
          }, 250);
        },
      };
    }

    if (isCustom(id)) {
      const t = customTracks.find((c) => c.id === id);
      if (!t) {
        ac.close().catch(() => {});
        return null;
      }
      const res = await fetch(t.url);
      const buf = await ac.decodeAudioData(await res.arrayBuffer());
      const src = ac.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      src.connect(gain);
      src.start();
      stopSrc = () => {
        try {
          src.stop();
        } catch (_) {
          /* noop */
        }
      };
    } else {
      const mood = MOODS[id];
      if (!mood) {
        ac.close().catch(() => {});
        return null;
      }
      stopSrc = synth(mood, gain, ac);
    }

    const track = dest.stream.getAudioTracks()[0];
    if (!track) {
      ac.close().catch(() => {});
      return null;
    }
    return {
      track,
      stop: () => {
        try {
          stopSrc();
        } catch (_) {
          /* noop */
        }
        try {
          stopVoice();
        } catch (_) {
          /* noop */
        }
        try {
          track.stop();
        } catch (_) {
          /* noop */
        }
        window.setTimeout(() => {
          ac.close().catch(() => {});
        }, 250);
      },
    };
  } catch (_) {
    return null;
  }
}
