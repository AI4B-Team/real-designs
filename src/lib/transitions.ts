/**
 * Transitions between scenes — shared capability model.
 *
 * A transition belongs to the CONNECTION between two ordered scenes, never to
 * a scene card and never to an array index: it is identified by the stable
 * scene keys on both sides, so reordering, adding or removing photos
 * reconciles cleanly instead of silently re-pointing at a different pair.
 *
 * Standard transitions are deterministic, free, and rendered by the real
 * browser renderer, so preview and export match exactly. AI transitions are a
 * generated clip that must begin on scene A and end on scene B; that needs a
 * provider accepting a first AND a last frame (see `AI_TRANSITION_AVAILABLE`).
 */

export type TransitionType =
  | "auto"
  | "cut"
  | "dissolve"
  | "fade"
  | "ai"
  | "slide_left"
  | "slide_right"
  | "push"
  | "wipe"
  | "zoom_match"
  | "match_move";

/** Primary choices in the connector popover. */
export const PRIMARY_TRANSITIONS: Array<[TransitionType, string]> = [
  ["auto", "Auto"],
  ["cut", "Cut"],
  ["dissolve", "Dissolve"],
  ["fade", "Fade"],
  ["ai", "AI"],
];

/** Deterministic extras, tucked under More. */
export const MORE_TRANSITIONS: Array<[TransitionType, string]> = [
  ["slide_left", "Slide Left"],
  ["slide_right", "Slide Right"],
  ["push", "Push"],
  ["wipe", "Wipe"],
  ["zoom_match", "Zoom Match"],
  ["match_move", "Match Move"],
];

export const ALL_TRANSITIONS: Array<[TransitionType, string]> = [...PRIMARY_TRANSITIONS, ...MORE_TRANSITIONS];

/** Compact badge text once a connection is configured. */
export function transitionLabel(t?: string | null): string {
  const hit = ALL_TRANSITIONS.find(([id]) => id === (t || "auto"));
  return hit ? hit[1] : "Auto";
}

export const DEFAULT_TRANSITION_MS = 600;
export const MIN_TRANSITION_MS = 0;
export const MAX_TRANSITION_MS = 2000;

/** A cut has no duration: any stored value is ignored by the renderer. */
export function transitionDurationMs(type: string, ms?: number | null): number {
  if (type === "cut") return 0;
  const n = Number.isFinite(ms as number) ? Number(ms) : DEFAULT_TRANSITION_MS;
  return Math.min(MAX_TRANSITION_MS, Math.max(MIN_TRANSITION_MS, Math.round(n)));
}

/* ---------- Auto ---------- */

export type SceneShape = {
  key: string;
  room_name?: string | null;
  /** true when the scene plays a generated clip rather than a still photo. */
  use_clip?: boolean;
  motion?: string | null;
};

export type RoomClass = "exterior" | "entry" | "interior" | "unknown";

const EXTERIOR = /(exterior|front|back ?yard|backyard|yard|garden|landscap|pool|patio|deck|porch|driveway|street|aerial|facade|curb|balcon|terrace|outdoor)/i;
const ENTRY = /(entry|entrance|foyer|hall(way)?|mudroom|stair|landing|lobby)/i;
const INTERIOR =
  /(living|family|great|kitchen|dining|bed|primary|master|bath|office|den|study|laundry|closet|basement|attic|game|media|gym|nursery|pantry|bonus|sunroom|loft|interior)/i;

export function classifyRoom(name?: string | null): RoomClass {
  const n = String(name || "").trim();
  if (!n) return "unknown";
  if (EXTERIOR.test(n)) return "exterior";
  if (ENTRY.test(n)) return "entry";
  if (INTERIOR.test(n)) return "interior";
  return "unknown";
}

function sameRoom(a?: string | null, b?: string | null): boolean {
  const x = String(a || "").trim().toLowerCase();
  const y = String(b || "").trim().toLowerCase();
  return !!x && x === y;
}

/**
 * Auto picks a restrained transition from the two adjacent scenes. It never
 * chooses a novelty move: the result is always Cut, Dissolve, Fade, Push or
 * Match Move.
 */
export function resolveAuto(from?: SceneShape | null, to?: SceneShape | null): Exclude<TransitionType, "auto" | "ai"> {
  if (!from || !to) return "dissolve";
  const a = classifyRoom(from.room_name);
  const b = classifyRoom(to.room_name);

  /* Two generated clips back to back already carry their own movement. */
  if (from.use_clip && to.use_clip) return "cut";

  if (a === "exterior" && b === "entry") return "push";
  if (a === "entry" && b === "interior") return "dissolve";
  if (a === "interior" && b === "exterior") return "fade";
  if (sameRoom(from.room_name, to.room_name) && a !== "unknown") return "match_move";
  if (a === "interior" && b === "interior") return "cut";
  if (a === "unknown" || b === "unknown") return "dissolve";
  return "dissolve";
}

/** The deterministic move the renderer must actually draw. */
export function resolveTransition(
  type: string | null | undefined,
  from?: SceneShape | null,
  to?: SceneShape | null,
): Exclude<TransitionType, "auto"> {
  const t = (type || "auto") as TransitionType;
  if (t === "auto") return resolveAuto(from, to);
  if (ALL_TRANSITIONS.some(([id]) => id === t)) return t as Exclude<TransitionType, "auto">;
  return resolveAuto(from, to);
}

/* ---------- connections ---------- */

export type TransitionRow = {
  id?: string;
  video_project_id?: string;
  from_key: string;
  to_key: string;
  from_scene_id?: string | null;
  to_scene_id?: string | null;
  type: string;
  duration_ms: number;
  settings?: Record<string, any> | null;
  generated_clip_path?: string | null;
  generation_job_id?: string | null;
  status?: string | null;
};

export function connectionKey(fromKey: string, toKey: string): string {
  return `${fromKey}→${toKey}`;
}

/** Ordered list of connections for the current scene order. */
export function connectionsFor(scenes: Array<{ key: string }>): Array<{ from: string; to: string; key: string }> {
  const out: Array<{ from: string; to: string; key: string }> = [];
  for (let i = 0; i < scenes.length - 1; i++) {
    const a = scenes[i]?.key;
    const b = scenes[i + 1]?.key;
    if (!a || !b) continue;
    out.push({ from: a, to: b, key: connectionKey(a, b) });
  }
  return out;
}

/**
 * Reconcile stored rows against the live scene order. Rows for pairs that are
 * still adjacent are kept exactly as configured; rows whose pair no longer
 * exists (reorder, deletion) are stale and returned separately so the caller
 * can delete them. Nothing is re-pointed at a different pair.
 */
export function reconcileTransitions<T extends TransitionRow>(
  scenes: Array<{ key: string }>,
  rows: T[],
): { keep: T[]; stale: T[] } {
  const live = new Set(connectionsFor(scenes).map((c) => c.key));
  const seen = new Set<string>();
  const keep: T[] = [];
  const stale: T[] = [];
  for (const r of rows || []) {
    if (!r) continue;
    const k = connectionKey(r.from_key, r.to_key);
    if (live.has(k) && !seen.has(k)) {
      seen.add(k);
      keep.push(r);
    } else stale.push(r);
  }
  return { keep, stale };
}

/** Map of connection key -> row, deduped, for the current order only. */
export function transitionMap<T extends TransitionRow>(scenes: Array<{ key: string }>, rows: T[]): Map<string, T> {
  const { keep } = reconcileTransitions(scenes, rows);
  return new Map(keep.map((r) => [connectionKey(r.from_key, r.to_key), r]));
}

/* ---------- AI transitions ---------- */

/**
 * A real AI transition has to start on scene A's last frame and land on scene
 * B's first frame. The connected video model (`/v1/videos`) only accepts a
 * single start image, so a generated clip could not be guaranteed to finish on
 * scene B. Rather than label a one-image animation an "AI transition", the
 * option stays disclosed and switched off; the job, credit and persistence
 * path below is real and turns on with a compatible provider.
 */
export const AI_TRANSITION_AVAILABLE = false;
export const AI_TRANSITION_UNAVAILABLE_REASON =
  "An AI transition has to begin on this scene and land on the next one. The connected video model only accepts a start frame, so it cannot guarantee the ending — this stays off until a first-and-last-frame provider is connected.";
export const AI_TRANSITION_CREDITS = 40;

export const AI_TRANSITION_TEMPLATES: Array<[string, string, string]> = [
  ["walkthrough", "Walkthrough", "The camera walks forward from this scene into the next."],
  ["room_to_room", "Room To Room", "A continuous move out of one room and into the next."],
  ["exterior_to_interior", "Exterior To Interior", "Approach the property and step inside."],
  ["approach", "Approach Property", "Move toward the property from the street."],
  ["day_to_night", "Day To Night", "The light shifts from day to evening across the cut."],
  ["custom", "Custom", "Describe the movement yourself."],
];

export function aiTemplateLabel(id?: string | null): string {
  const hit = AI_TRANSITION_TEMPLATES.find(([i]) => i === (id || "room_to_room"));
  return hit ? hit[1] : "Room To Room";
}

/* ---------- credits ---------- */

/**
 * Credits are reserved when a job is created and released the moment the job
 * fails or is refused. Pure so the accounting is testable without a provider.
 */
export type CreditLedgerLine = { reserved: number; charged: number; released: number };

export function reserveCredits(cost: number): CreditLedgerLine {
  return { reserved: Math.max(0, Math.round(cost)), charged: 0, released: 0 };
}

/** Only an accepted provider job converts a reservation into a charge. */
export function commitCredits(line: CreditLedgerLine): CreditLedgerLine {
  return { ...line, charged: line.reserved, reserved: 0 };
}

/** A refused or failed job gives everything back — reserved or charged. */
export function releaseCredits(line: CreditLedgerLine): CreditLedgerLine {
  return { reserved: 0, charged: 0, released: line.released + line.reserved + line.charged };
}

/* ---------- render manifest ---------- */

export type ManifestScene = {
  key: string;
  url: string;
  durationMs: number;
  motion?: string | null;
  caption?: string | null;
  clipUrl?: string | null;
  locked?: boolean;
};

export type ManifestTransition = {
  from: string;
  to: string;
  type: Exclude<TransitionType, "auto">;
  requested: string;
  durationMs: number;
  clipUrl?: string | null;
};

export type RenderManifest = {
  scenes: ManifestScene[];
  transitions: ManifestTransition[];
  totalMs: number;
  audio?: { music?: string | null; narrationUrl?: string | null; narrationStartMs?: number } | null;
  titles?: { headline?: string | null; sub?: string | null; startMs?: number; endMs?: number } | null;
};

/**
 * The single authoritative description of the finished video. Preview and
 * export both consume this, so what a user previews is what downloads.
 */
export function buildRenderManifest(input: {
  scenes: ManifestScene[];
  rows: TransitionRow[];
  sceneMeta?: Record<string, SceneShape>;
  audio?: RenderManifest["audio"];
  titles?: RenderManifest["titles"];
  projectDefault?: string;
}): RenderManifest {
  const scenes = (input.scenes || []).filter(Boolean);
  const map = transitionMap(scenes, input.rows || []);
  const transitions: ManifestTransition[] = [];
  for (const c of connectionsFor(scenes)) {
    const row = map.get(c.key);
    const requested = row?.type || input.projectDefault || "auto";
    const from = input.sceneMeta?.[c.from] || { key: c.from };
    const to = input.sceneMeta?.[c.to] || { key: c.to };
    const clipUrl = row?.status === "completed" ? row?.generated_clip_path || null : null;
    /* An AI transition with no finished clip must still render something
       deterministic, so it falls back to the Auto choice. */
    const type = requested === "ai" && !clipUrl ? resolveAuto(from, to) : resolveTransition(requested, from, to);
    transitions.push({
      from: c.from,
      to: c.to,
      requested,
      type,
      durationMs: transitionDurationMs(type, row?.duration_ms),
      clipUrl,
    });
  }
  const totalMs =
    scenes.reduce((a, s) => a + Math.max(0, s.durationMs || 0), 0) +
    transitions.reduce((a, t) => a + t.durationMs, 0);
  return { scenes, transitions, totalMs, audio: input.audio ?? null, titles: input.titles ?? null };
}

/* ---------- smart timing ---------- */

export type SmartTimingInput = {
  scenes: ManifestScene[];
  rows: TransitionRow[];
  sceneMeta?: Record<string, SceneShape>;
  targetMs?: number | null;
  narrationMs?: number | null;
  beatMs?: number | null;
};

/**
 * Optional project setting. It fills in the timings the user has not decided
 * for themselves: any scene marked `locked` (an explicit duration edit) keeps
 * its value exactly.
 */
export function smartTiming(input: SmartTimingInput): {
  scenes: ManifestScene[];
  transitions: ManifestTransition[];
  totalMs: number;
} {
  const scenes = (input.scenes || []).map((s) => ({ ...s }));
  const base = buildRenderManifest({ scenes, rows: input.rows || [], sceneMeta: input.sceneMeta });
  const transitions = base.transitions.map((t) => ({ ...t }));

  const lockedMs = scenes.filter((s) => s.locked).reduce((a, s) => a + (s.durationMs || 0), 0);
  const free = scenes.filter((s) => !s.locked);
  const transMs = transitions.reduce((a, t) => a + t.durationMs, 0);

  const target = input.narrationMs && input.narrationMs > 0 ? input.narrationMs + 1200 : input.targetMs || 0;
  if (target > 0 && free.length) {
    const room = Math.max(free.length * 1200, target - lockedMs - transMs);
    let per = Math.round(room / free.length);
    if (input.beatMs && input.beatMs > 200) per = Math.max(1200, Math.round(per / input.beatMs) * input.beatMs);
    for (const s of free) s.durationMs = per;
  } else {
    for (const s of free) {
      /* A generated clip plays at its own length; a still needs long enough
         for its camera move to read. */
      if (!s.durationMs || s.durationMs < 1200) s.durationMs = s.clipUrl ? 5000 : 3200;
    }
  }
  const totalMs = scenes.reduce((a, s) => a + s.durationMs, 0) + transMs;
  return { scenes, transitions, totalMs };
}
