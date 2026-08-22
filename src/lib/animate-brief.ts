/**
 * Animate — the Studio motion-clip engine.
 *
 * One image in, one short cinematic clip out. This is deliberately NOT the
 * Property Video builder: it animates the picture on the canvas and nothing
 * else, so nothing here may ever imply a walkthrough of rooms the camera has
 * never seen.
 *
 * Everything the panel offers is checked against what the provider (Veo on the
 * Lovable AI Gateway) actually supports, so a user can never select a
 * combination that will be rejected after their credits are spent.
 */

export const TOOL_NAME = "Animate";
export const TOOL_PROMISE =
  "Turn the current design into a polished short motion clip while preserving the room and design.";
export const TOOL_EXPLAINER = "Create a short AI motion clip from the current image.";
export const NOT_A_WALKTHROUGH =
  "This animates the image on your canvas. It does not walk through rooms the camera cannot see \u2014 use Property Video for a full listing tour.";

/* ------------------------------------------------- provider capabilities */

/**
 * Provider capability detection. Veo accepts 4, 6 or 8 second generations,
 * 16:9 or 9:16, and derives orientation from an input image. Square is simply
 * not offered by the provider, so the panel shows it disabled with the reason
 * rather than failing the job after the charge.
 */
export const PROVIDER = {
  model: "google/veo-3.1-lite",
  durations: [4, 6, 8] as const,
  aspects: ["16:9", "9:16"] as const,
  resolutions: ["720p", "1080p"] as const,
  audio: false,
  maxSeconds: 8,
};

export type Aspect = "16:9" | "9:16" | "1:1";

export type AspectOption = {
  id: Aspect;
  label: string;
  supported: boolean;
  reason: string | null;
};

export const ASPECT_OPTIONS: AspectOption[] = [
  { id: "16:9", label: "Landscape 16:9", supported: true, reason: null },
  { id: "9:16", label: "Vertical 9:16", supported: true, reason: null },
  {
    id: "1:1",
    label: "Square 1:1",
    supported: false,
    reason: "The video model renders 16:9 or 9:16 only. Crop to square after download.",
  },
];

export type DurationOption = { seconds: number; label: string; supported: boolean; reason: string | null };

export const DURATION_OPTIONS: DurationOption[] = [
  { seconds: 4, label: "4s", supported: true, reason: null },
  { seconds: 5, label: "5s", supported: false, reason: "The video model renders 4, 6 or 8 seconds." },
  { seconds: 6, label: "6s", supported: true, reason: null },
  { seconds: 8, label: "8s", supported: true, reason: null },
];

export function supportsAspect(aspect: string): boolean {
  return (PROVIDER.aspects as readonly string[]).includes(aspect);
}

export function supportsDuration(seconds: number): boolean {
  return (PROVIDER.durations as readonly number[]).includes(seconds);
}

/** Snaps an unsupported request onto the nearest thing the provider will run. */
export function nearestDuration(seconds: number): number {
  return PROVIDER.durations.reduce((best, d) =>
    Math.abs(d - seconds) < Math.abs(best - seconds) ? d : best,
  );
}

/* ------------------------------------------------------------- motions */

export type MotionId =
  | "dolly_in"
  | "dolly_out"
  | "pan_left"
  | "pan_right"
  | "slow_push"
  | "reveal"
  | "handheld"
  | "static"
  | "custom";

export type Motion = {
  id: MotionId;
  label: string;
  blurb: string;
  icon: string;
  directive: string;
  /** Handheld is the one move where a little camera movement is the point. */
  allowsShake: boolean;
  defaultStrength: number;
};

export const MOTIONS: Motion[] = [
  {
    id: "dolly_in",
    label: "Dolly In",
    blurb: "Moves forward into the room",
    icon: "move-right",
    directive: "The camera dollies slowly forward into the room at a steady eye level.",
    allowsShake: false,
    defaultStrength: 50,
  },
  {
    id: "dolly_out",
    label: "Dolly Out",
    blurb: "Pulls back to reveal the space",
    icon: "move-left",
    directive: "The camera dollies slowly backward, opening up more of the same room.",
    allowsShake: false,
    defaultStrength: 50,
  },
  {
    id: "pan_left",
    label: "Pan Left",
    blurb: "Sweeps to the left",
    icon: "arrow-left",
    directive: "The camera pans smoothly to the left across the room from a fixed position.",
    allowsShake: false,
    defaultStrength: 45,
  },
  {
    id: "pan_right",
    label: "Pan Right",
    blurb: "Sweeps to the right",
    icon: "arrow-right",
    directive: "The camera pans smoothly to the right across the room from a fixed position.",
    allowsShake: false,
    defaultStrength: 45,
  },
  {
    id: "slow_push",
    label: "Slow Push",
    blurb: "A gentle, barely-there push in",
    icon: "chevrons-right",
    directive: "A very gentle, almost imperceptible push in toward the center of the room.",
    allowsShake: false,
    defaultStrength: 25,
  },
  {
    id: "reveal",
    label: "Reveal",
    blurb: "Rises and settles on the room",
    icon: "sparkles",
    directive:
      "The camera begins low and slightly tilted, then rises and levels out to reveal the room.",
    allowsShake: false,
    defaultStrength: 55,
  },
  {
    id: "handheld",
    label: "Subtle Handheld",
    blurb: "Light, intentional human motion",
    icon: "hand",
    directive:
      "A subtle handheld feel: small, natural, organic camera drift as if held by a steady operator.",
    allowsShake: true,
    defaultStrength: 35,
  },
  {
    id: "static",
    label: "Static Cinematic",
    blurb: "Locked camera, living light",
    icon: "square",
    directive:
      "The camera is locked off and does not move. Only light, shadow and soft ambience change.",
    allowsShake: false,
    defaultStrength: 10,
  },
  {
    id: "custom",
    label: "Custom Prompt",
    blurb: "Describe the camera move yourself",
    icon: "pencil",
    directive: "",
    allowsShake: true,
    defaultStrength: 45,
  },
];

export function motion(id: string): Motion {
  return MOTIONS.find((m) => m.id === id) || MOTIONS[0]!;
}

/* --------------------------------------------------------- clip kinds */

export type ClipKindId = "single" | "before_after" | "angle_sequence";

export type ClipKind = {
  id: ClipKindId;
  label: string;
  blurb: string;
  /** How many images the provider job needs before it can run. */
  frames: number;
  requires: string | null;
};

export const CLIP_KINDS: ClipKind[] = [
  {
    id: "single",
    label: "Motion Clip",
    blurb: "Animates the selected image.",
    frames: 1,
    requires: null,
  },
  {
    id: "before_after",
    label: "Before / After Reveal",
    blurb: "Starts on the original photo and resolves into the design.",
    frames: 2,
    requires: "An original photo and a finished design.",
  },
  {
    id: "angle_sequence",
    label: "Angle Sequence",
    blurb: "One clip per saved angle, kept in set order.",
    frames: 1,
    requires: "A saved angle set.",
  },
];

export function clipKind(id: string): ClipKind {
  return CLIP_KINDS.find((k) => k.id === id) || CLIP_KINDS[0]!;
}

/* ------------------------------------------------------------ sources */

export type SourceKindId = "current" | "original" | "version" | "angle_set";

export type ClipSource = {
  kind: SourceKindId;
  /** Storage path. A clip may only run from a persisted source. */
  path: string | null;
  label: string;
  thumbUrl: string | null;
  versionId?: string | null;
  angleSetId?: string | null;
  /** Angle sets carry every member so a sequence can be rendered in order. */
  members?: Array<{ path: string; label: string }>;
};

export const SOURCE_LABELS: Record<SourceKindId, string> = {
  current: "Current Visible Version",
  original: "Original Photo",
  version: "Saved Version",
  angle_set: "Angle Set",
};

/** A job may only start from something that is already saved. */
export function sourceReady(source: ClipSource | null): boolean {
  if (!source) return false;
  if (source.kind === "angle_set") return !!(source.members && source.members.length);
  return !!source.path;
}

/* ------------------------------------------------------ quality rules */

export const QUALITY_RULES = [
  "Do not change, add or remove any furniture.",
  "Do not change any finish, material or colour.",
  "Do not move, bend or reshape walls, floors or ceilings.",
  "Do not morph, resize or move windows and doors.",
  "Nothing may appear or disappear during the clip.",
  "No people, pets or vehicles.",
  "No text, captions, watermarks or logos.",
  "No cuts, no flashes, no speed ramps.",
  "Motion must be smooth and continuous.",
  "Lighting, white balance and exposure stay stable throughout.",
];

export const SHAKE_RULE = "No camera shake, no jitter, no wobble.";
export const PEOPLE_RULE = "No people in frame at any point.";

/** Everything the provider must be told to avoid, as plain descriptors. */
export function negativePrompt(opts: {
  motionId: string;
  allowPeople?: boolean;
  extra?: string | null;
}): string {
  const m = motion(opts.motionId);
  const parts = [
    "morphing furniture",
    "melting walls",
    "warping windows",
    "changing materials",
    "objects appearing",
    "objects disappearing",
    "text",
    "captions",
    "watermark",
    "logo",
    "flicker",
    "exposure shift",
    "cuts",
  ];
  if (!opts.allowPeople) parts.push("people", "pets");
  if (!m.allowsShake) parts.push("camera shake", "jitter", "handheld wobble");
  const extra = String(opts.extra || "").trim();
  if (extra) parts.push(extra);
  return parts.join(", ");
}

/* ------------------------------------------------------------ payload */

export type AnimateSettings = {
  clipKind: ClipKindId;
  motionId: MotionId;
  customPrompt?: string | null;
  seconds: number;
  aspect: Aspect;
  resolution?: "720p" | "1080p";
  /** 0-100: how much the camera travels. */
  strength: number;
  /** 0-100: how fast it travels. */
  speed: number;
  lockArchitecture: boolean;
  allowPeople?: boolean;
  negative?: string | null;
  roomType?: string | null;
  styleName?: string | null;
  endCard?: boolean;
  disclosure?: boolean;
};

export type AnimatePayload = {
  clip_kind: ClipKindId;
  motion: MotionId;
  motion_label: string;
  seconds: number;
  aspect: Aspect;
  resolution: "720p" | "1080p";
  strength: number;
  speed: number;
  lock_architecture: boolean;
  allow_people: boolean;
  room_type: string | null;
  style_name: string | null;
  source_kind: SourceKindId;
  source_label: string;
  source_path: string | null;
  prompt: string;
  negative_prompt: string;
  end_card: boolean;
  disclosure: boolean;
  model: string;
};

const STRENGTH_WORDS = (v: number) =>
  v <= 20 ? "barely perceptible" : v <= 45 ? "restrained" : v <= 70 ? "moderate" : "pronounced";
const SPEED_WORDS = (v: number) =>
  v <= 25 ? "very slow" : v <= 50 ? "slow" : v <= 75 ? "measured" : "brisk";

/** The English direction sent to the provider. Creative direction, not a script. */
export function animatePrompt(s: AnimateSettings, kind: ClipKindId = "single"): string {
  const m = motion(s.motionId);
  const move =
    m.id === "custom"
      ? String(s.customPrompt || "").trim() || "The camera moves gently through the space."
      : m.directive;
  const lines: string[] = [];
  if (kind === "before_after")
    lines.push(
      "A single continuous shot of one interior that dissolves smoothly from the first frame's condition into the second frame's finished design, with no cut.",
    );
  lines.push(move);
  lines.push(
    `Camera travel is ${STRENGTH_WORDS(s.strength)} and ${SPEED_WORDS(s.speed)}, one continuous take.`,
  );
  lines.push(
    "The room in the reference image is real: its architecture, furniture, finishes, decor and lighting stay exactly as shown.",
  );
  if (s.lockArchitecture)
    lines.push("Walls, ceilings, floors, windows and doors are fixed geometry and must not move or change shape.");
  lines.push(QUALITY_RULES.join(" "));
  if (!s.allowPeople) lines.push(PEOPLE_RULE);
  if (!m.allowsShake) lines.push(SHAKE_RULE);
  if (s.roomType) lines.push(`The space is a ${s.roomType}.`);
  if (s.styleName) lines.push(`Interior style: ${s.styleName}.`);
  return lines.join(" ");
}

export type AnimateBrief = {
  valid: boolean;
  missing: string[];
  credits: number;
  payload: AnimatePayload;
  /** One provider job per entry — an angle sequence is several jobs. */
  jobs: Array<{ id: string; label: string; source_path: string; frame_path?: string | null }>;
  warnings: string[];
};

export const CREDITS_PER_CLIP = 40;

export function clipCredits(jobCount: number): number {
  return Math.max(1, jobCount) * CREDITS_PER_CLIP;
}

let seq = 0;
export function newClipId(prefix = "clip"): string {
  seq += 1;
  return `${prefix}_${Date.now().toString(36)}_${seq}`;
}

export function buildAnimateBrief(input: {
  settings: AnimateSettings;
  source: ClipSource | null;
  originalPath?: string | null;
}): AnimateBrief {
  const s = input.settings;
  const src = input.source;
  const missing: string[] = [];
  const warnings: string[] = [];

  if (!sourceReady(src)) missing.push("Choose a saved image to animate.");
  if (!supportsAspect(s.aspect)) missing.push("That format is not supported by the video model.");
  if (!supportsDuration(s.seconds)) missing.push("That length is not supported by the video model.");
  if (s.motionId === "custom" && !String(s.customPrompt || "").trim())
    missing.push("Describe the camera move for a custom clip.");
  if (s.clipKind === "before_after" && !input.originalPath)
    missing.push("A before / after reveal needs the original photo saved.");
  if (s.clipKind === "angle_sequence" && !(src && src.members && src.members.length))
    missing.push("An angle sequence needs a saved angle set.");

  const jobs: AnimateBrief["jobs"] = [];
  if (src) {
    if (s.clipKind === "angle_sequence" && src.members && src.members.length) {
      src.members.forEach((m, i) => {
        jobs.push({ id: newClipId("angle"), label: m.label || `Angle ${i + 1}`, source_path: m.path });
      });
    } else if (s.clipKind === "before_after" && input.originalPath && src.path) {
      jobs.push({
        id: newClipId("reveal"),
        label: "Before / After Reveal",
        source_path: input.originalPath,
        frame_path: src.path,
      });
    } else if (src.path) {
      jobs.push({ id: newClipId("clip"), label: motion(s.motionId).label, source_path: src.path });
    }
  }

  if (s.clipKind === "before_after")
    warnings.push(
      "A before / after reveal is generated as one continuous shot, so the change is a dissolve rather than a hard cut.",
    );
  if (jobs.length > 1)
    warnings.push(`${jobs.length} clips will be rendered, and each one is charged separately.`);
  if (s.strength > 75)
    warnings.push("Strong camera travel raises the chance of warping. Reduce it if the result morphs.");

  const payload: AnimatePayload = {
    clip_kind: s.clipKind,
    motion: s.motionId,
    motion_label: motion(s.motionId).label,
    seconds: s.seconds,
    aspect: s.aspect,
    resolution: s.resolution || "720p",
    strength: s.strength,
    speed: s.speed,
    lock_architecture: !!s.lockArchitecture,
    allow_people: !!s.allowPeople,
    room_type: s.roomType || null,
    style_name: s.styleName || null,
    source_kind: src ? src.kind : "current",
    source_label: src ? src.label : SOURCE_LABELS.current,
    source_path: src ? src.path : null,
    prompt: animatePrompt(s, s.clipKind),
    negative_prompt: negativePrompt({
      motionId: s.motionId,
      allowPeople: !!s.allowPeople,
      extra: s.negative ?? null,
    }),
    end_card: !!s.endCard,
    disclosure: !!s.disclosure,
    model: PROVIDER.model,
  };

  return {
    valid: missing.length === 0 && jobs.length > 0,
    missing,
    credits: clipCredits(jobs.length),
    payload,
    jobs,
    warnings,
  };
}

/** A retry that trades motion for stability, used after a morphing warning. */
export function reducedMotion(s: AnimateSettings): AnimateSettings {
  return {
    ...s,
    strength: Math.max(10, Math.round(s.strength * 0.5)),
    speed: Math.max(10, Math.round(s.speed * 0.6)),
    motionId: s.motionId === "handheld" ? "slow_push" : s.motionId,
    lockArchitecture: true,
  };
}

export function defaultSettings(): AnimateSettings {
  return {
    clipKind: "single",
    motionId: "dolly_in",
    customPrompt: null,
    seconds: 8,
    aspect: "16:9",
    resolution: "720p",
    strength: 50,
    speed: 40,
    lockArchitecture: true,
    allowPeople: false,
    negative: null,
    roomType: null,
    styleName: null,
    endCard: false,
    disclosure: false,
  };
}

/* ------------------------------------------------------ quality check */

export type MotionCheck = {
  /** 0-100 similarity between the first and last frame's fixed elements. */
  score: number;
  issues: string[];
  morphing: boolean;
  advice: string | null;
};

export const MORPH_THRESHOLD = 70;

export function summarizeMotionCheck(raw: {
  score?: number;
  issues?: string[];
  notes?: string | null;
}): MotionCheck {
  const score = Math.max(0, Math.min(100, Math.round(Number(raw.score ?? 0))));
  const issues = Array.isArray(raw.issues) ? raw.issues.filter(Boolean).map(String).slice(0, 6) : [];
  const morphing = score < MORPH_THRESHOLD || issues.length > 0;
  return {
    score,
    issues,
    morphing,
    advice: morphing
      ? "The room drifts during this clip. Regenerate with reduced motion to hold the design steady."
      : null,
  };
}

/* -------------------------------------------------------- job records */

export type JobStatus = "queued" | "in_progress" | "completed" | "failed";

export type MotionJob = {
  id: string;
  title: string;
  status: JobStatus;
  progress: number;
  provider_job_id: string | null;
  output_path: string | null;
  url?: string | null;
  thumbnail_path?: string | null;
  error: string | null;
  credits: number;
  refunded: boolean;
  source_path: string | null;
  source_label: string | null;
  payload: AnimatePayload | null;
  created_at: string;
  video_project_id?: string | null;
  check?: MotionCheck | null;
};

export function isActive(job: { status: string }): boolean {
  return job.status === "queued" || job.status === "in_progress";
}

/** Honest waiting copy: the provider's own status, never invented progress. */
export function statusLine(job: { status: string; progress?: number; error?: string | null }): string {
  if (job.status === "queued") return "Queued with the video provider";
  if (job.status === "in_progress")
    return typeof job.progress === "number" && job.progress > 0
      ? `Rendering, ${Math.round(job.progress)}% reported by the provider`
      : "Rendering. Most clips take one to three minutes.";
  if (job.status === "completed") return "Ready";
  return job.error || "This clip did not finish. Your credits were returned.";
}

/** Duplicate submissions are stopped by a stable key, not by a disabled button. */
export function idempotencyKey(payload: AnimatePayload, sourcePath: string, salt = ""): string {
  const basis = [
    sourcePath,
    payload.clip_kind,
    payload.motion,
    payload.seconds,
    payload.aspect,
    payload.resolution,
    payload.strength,
    payload.speed,
    payload.lock_architecture ? "lock" : "free",
    payload.allow_people ? "people" : "empty",
    payload.negative_prompt,
    salt,
  ].join("|");
  let h = 5381;
  for (let i = 0; i < basis.length; i++) h = ((h << 5) + h + basis.charCodeAt(i)) >>> 0;
  return `mc_${h.toString(36)}_${basis.length.toString(36)}`;
}
